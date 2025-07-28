import tls from 'node:tls';
import net from 'node:net';
import EventEmitter from 'node:events';
import { getNextPortFactory } from './helpers/find-port.js';
import { Connection } from './connection.js';
import { SupabaseClient } from '@supabase/supabase-js';
import FileSystem from './fs/fs.js';
import { SupabaseFtpError } from './errors.js';
import { findWanIp } from './helpers/find-wan-ip.js';
import { RateLimiter } from './rate-limiter.js';
import { isV4Format, normalize } from '@1tc/utils/ip';

export interface FtpServerOptions {
  url: string;
  passivePortRange: [number, number];
  passiveHostname: string | null | ((ip?: string | null) => string);
  greeting?: string | string[];
  anonymous: boolean;
  listFormat: 'ls' | 'ep';
  blacklist: string[];
  whitelist: string[];
  tls?: tls.TlsOptions;
  timeout: number;
  endOnProcessSignal: boolean;
  wanIp?: string | null;
  wanIpCheckUrl?: string;
}

export interface FtpServerHost {
  protocol: string;
  ip: string;
  port: number;
}

export interface FtpServerEvent {
  login: [
    { username: string; password: string; connection: Connection },
    (value: {
      root: string;
      cwd: string;
      fs?: FileSystem;
      blacklist?: string[];
      whitelist?: string[];
    }) => void,
    (reason?: Error | SupabaseFtpError) => void,
  ];
  connect: [{ id: string; connection: Connection; newConnectionCount: number }];
  disconnect: [
    { id: string; connection: Connection; newConnectionCount: number },
  ];
  'client-error': [{ connection: Connection; context: string; error: Error }];
  'server-error': [{ error: Error }];
  closing: [];
  closed: [];
}

type EventDataParams<T extends readonly unknown[]> = T extends readonly [
  ...infer Data,
  (value: any) => void,
  (reason?: any) => void,
]
  ? Data
  : T extends readonly [...infer Data, (value: any) => void]
    ? Data
    : T;

// Helper type to extract the resolved value type
type EventResolveType<T extends readonly unknown[]> = T extends readonly [
  ...any[],
  (value: infer R) => void,
  (reason?: any) => void,
]
  ? R
  : T extends readonly [...any[], (value: infer R) => void]
    ? R
    : T extends readonly [infer First, ...any[]]
      ? First
      : void;

export class FtpServer extends EventEmitter<FtpServerEvent> {
  options: FtpServerOptions;
  private _greeting: string[] = [];
  private _features: string = '';
  private _connections: Map<string, Connection> = new Map();
  readonly url: URL;
  readonly server: net.Server;
  readonly supabase: SupabaseClient;
  private connectionRateLimiter: RateLimiter;

  readonly getNextPassivePort: () => Promise<number>;

  constructor(supabase: SupabaseClient, options: FtpServerOptions) {
    super();

    this.options = options;
    this.supabase = supabase;

    this.connectionRateLimiter = new RateLimiter(30, 60000);

    this._greeting = this.setupGreeting(this.options.greeting);
    this._features = this.setupFeaturesMessage();

    delete this.options.greeting;

    this.url = new URL(this.options.url);
    this.getNextPassivePort = getNextPortFactory(
      this.url.hostname,
      ...this.options.passivePortRange
    );

    const timeout = Number(this.options.timeout);
    this.options.timeout = isNaN(timeout) ? 0 : timeout;

    const serverConnectionHandler = async (socket: net.Socket) => {
      const rawClientIp = socket.remoteAddress || 'unknown';

      let clientIp = rawClientIp;
      try {
        if (rawClientIp !== 'unknown') {
          clientIp = normalize(rawClientIp);
        }
      } catch {
        if (rawClientIp.startsWith('::ffff:')) {
          const extractedIp = rawClientIp.substring(7);
          if (isV4Format(extractedIp)) {
            clientIp = extractedIp;
          }
        }
      }

      if (!this.connectionRateLimiter.isAllowed(clientIp)) {
        console.warn('Connection rate limit exceeded for IP:', clientIp);
        socket.write('421 Too many connections from your IP address\r\n');
        socket.destroy();
        return;
      }

      if (this.options.timeout > 0) socket.setTimeout(this.options.timeout);

      let connection = new Connection(this, socket);
      this._connections.set(connection.id, connection);

      console.log(
        `New FTP connection: ${clientIp} (${connection.id}) - Total: ${this._connections.size}`
      );

      socket.on('close', () => this.disconnectClient(connection.id));
      socket.once('close', () => {
        this.emit('disconnect', {
          id: connection.id,
          connection,
          newConnectionCount: this._connections.size,
        });
      });

      this.emit('connect', {
        id: connection.id,
        connection,
        newConnectionCount: this._connections.size,
      });

      const greeting = this._greeting || [];
      const features = this._features || 'Ready';
      return connection
        .reply(220, ...greeting, features)
        .then(() => socket.resume());
    };

    if (this.isTLS)
      this.server = tls.createServer(
        {
          ...this.options.tls,
          pauseOnConnect: true,
        },
        serverConnectionHandler
      );
    else
      this.server = net.createServer(
        {
          pauseOnConnect: true,
        },
        serverConnectionHandler
      );

    this.server.on('error', err => {
      console.error('Server error:', err);
      this.emit('server-error', { error: err });
    });

    const quit = (() => {
      let timeout: NodeJS.Timeout | null = null;
      return () => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        timeout = setTimeout(() => this.quit(), 100);
      };
    })();

    if (this.options.endOnProcessSignal) {
      process.on('SIGINT', quit);
      process.on('SIGTERM', quit);
      process.on('SIGQUIT', quit);
    }
  }

  get isTLS() {
    return this.url.protocol === 'ftps:' && !!this.options.tls;
  }

  async listen(cb?: (host: FtpServerHost) => void) {
    if (!this.options.wanIp && !this.options.passiveHostname) {
      console.warn('WAN IP not set, attempting to determine it automatically.');
      try {
        this.options.wanIp = await findWanIp(this.options.wanIpCheckUrl);
        console.log(`Detected WAN IP: ${this.options.wanIp}`);
      } catch (error) {
        if (error instanceof Error)
          console.error(`Error fetching WAN IP: ${error.message}`);
      }
    }

    if (!this.options.passiveHostname) {
      this.options.passiveHostname =
        this.options.wanIp || this.url.hostname || 'localhost';
      console.warn(
        `Passive hostname not set. Defaulting to: ${this.options.passiveHostname}`
      );
    }

    return new Promise<FtpServerHost>((resolve, reject) => {
      this.server.once('error', reject);
      const port = this.url.port || (this.url.protocol === 'ftps:' ? 990 : 21);
      this.server.listen(Number(port), this.url.hostname, () => {
        this.server.removeListener('error', reject);
        const host = {
          protocol: this.url.protocol.replace(/\W/g, ''),
          ip: this.url.hostname,
          port: Number(port),
          passiveHostname: this.options.passiveHostname,
          passivePortRange: this.options.passivePortRange,
        };
        resolve(host);
        if (cb) cb(host);
      });
    });
  }

  emitPromise<K extends keyof FtpServerEvent>(
    action: K,
    ...data: EventDataParams<FtpServerEvent[K]>
  ): Promise<EventResolveType<FtpServerEvent[K]>> {
    return new Promise((resolve, reject) => {
      const params = [...data, resolve, reject];
      (this.emit as any).call(this, action, ...params);
    });
  }

  setupGreeting(greeting?: string | string[]) {
    if (!greeting) return [];
    return Array.isArray(greeting) ? greeting : greeting.split('\n');
  }

  setupFeaturesMessage() {
    let features = [];
    if (this.options.anonymous) features.push('a');

    if (features.length) {
      features.unshift('Features:');
      features.push('.');
    }
    return features.length ? features.join(' ') : 'Ready';
  }

  disconnectClient(id: string) {
    return new Promise<boolean>((resolve, reject) => {
      const client = this._connections.get(id);
      if (!client) return resolve(false);

      this._connections.delete(id);

      const timeoutId = setTimeout(() => {
        reject(new Error(`Client disconnect timeout for ${id}`));
      }, this.options.timeout || 1e3);

      try {
        client.close();
        clearTimeout(timeoutId);
        resolve(true);
      } catch (error) {
        clearTimeout(timeoutId);
        console.error(`Error closing client: ${id}`, error);
        resolve(false);
      }
    });
  }

  async quit() {
    return this.close().then(() => process.exit(0));
  }

  async close() {
    this.server.maxConnections = 0;
    this.emit('closing');

    return Promise.all(
      Array.from(this._connections.entries()).map(([id]) =>
        this.disconnectClient(id)
      )
    ).then(() =>
      new Promise(resolve => {
        this.server.close(err => {
          if (err) console.error('Error closing server:', err);
          resolve(!err);
        });
      }).then(() => {
        this.emit('closed');
        this.removeAllListeners();
        return;
      })
    );
  }
}
