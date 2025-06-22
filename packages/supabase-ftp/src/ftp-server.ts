import tls from "node:tls";
import net from "node:net";
import { Stats } from "node:fs";
import EventEmitter from "node:events";
import { getNextPortFactory } from "./helpers/find-port.js";
import { Connection } from "./connection.js";
import { SupabaseClient } from "@supabase/supabase-js";
import FileSystem from "./fs/fs.js";
import { SupabaseFtpError } from "./errors.js";

export interface FtpServerOptions {
  url: string;
  passivePortRange: [number, number];
  passiveHostname: string | null | ((ip?: string | null) => string);
  greeting?: string | string[];
  anonymous: boolean;
  listFormat: ((stat: Stats) => string) | Promise<string> | "ls" | "ep";
  blacklist: string[];
  whitelist: string[];
  tls?: tls.TlsOptions;
  timeout: number;
  endOnProcessSignal: boolean;
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
  "server-error": [{ error: Error }];
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
  private _features: string = "";
  private _connections: Map<string, Connection> = new Map();
  readonly url: URL;
  readonly server: net.Server;
  readonly supabase: SupabaseClient;

  readonly getNextPassivePort: () => Promise<number>;

  constructor(supabase: SupabaseClient, options: FtpServerOptions) {
    super();

    this.options = options;
    this.supabase = supabase;

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
      if (this.options.timeout > 0) socket.setTimeout(this.options.timeout);

      let connection = new Connection(this, socket);
      this._connections.set(connection.id, connection);

      socket.on("close", () => this.disconnectClient(connection.id));
      socket.once("close", () => {
        this.emit("disconnect", {
          id: connection.id,
          connection,
          newConnectionCount: this._connections.size,
        });
      });

      this.emit("connect", {
        id: connection.id,
        connection,
        newConnectionCount: this._connections.size,
      });

      const greeting = this._greeting || [];
      const features = this._features || "Ready";
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

    this.server.on("error", (err) => {
      console.error("Server error:", err);
      this.emit("server-error", { error: err });
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
      process.on("SIGINT", quit);
      process.on("SIGTERM", quit);
      process.on("SIGQUIT", quit);
    }
  }

  get isTLS() {
    return this.url.protocol === "ftps:" && !!this.options.tls;
  }

  listen(cb?: (host: FtpServerHost) => void) {
    if (!this.options.passiveHostname)
      console.warn(
        "Passive host is not set. Passive connections not available."
      );

    return new Promise<FtpServerHost>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(Number(this.url.port), this.url.hostname, () => {
        this.server.removeListener("error", reject);
        const host = {
          protocol: this.url.protocol.replace(/\W/g, ""),
          ip: this.url.hostname,
          port: Number(this.url.port),
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
    return Array.isArray(greeting) ? greeting : greeting.split("\n");
  }

  setupFeaturesMessage() {
    let features = [];
    if (this.options.anonymous) features.push("a");

    if (features.length) {
      features.unshift("Features:");
      features.push(".");
    }
    return features.length ? features.join(" ") : "Ready";
  }

  disconnectClient(id: string) {
    return new Promise<boolean>((resolve, reject) => {
      const client = this._connections.get(id);
      if (!client) return resolve(false);

      this._connections.delete(id);

      setTimeout(() => {
        reject(new Error("Client disconnect timeout"));
      }, this.options.timeout || 1e3);

      try {
        client.close();
      } catch (error) {
        console.error(`Error closing client: ${id}`, error);
      }

      resolve(true);
    });
  }

  async quit() {
    return this.close().then(() => process.exit(0));
  }

  async close() {
    this.server.maxConnections = 0;
    this.emit("closing");

    return Promise.all(
      Array.from(this._connections.entries()).map(([id]) =>
        this.disconnectClient(id)
      )
    ).then(() =>
      new Promise((resolve) => {
        this.server.close((err) => {
          if (err) console.error("Error closing server:", err);
          resolve(!err);
        });
      }).then(() => {
        this.emit("closed");
        this.removeAllListeners();
        return;
      })
    );
  }
}
