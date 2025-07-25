import net from 'node:net';
import tls from 'node:tls';
import { Connector } from './base.js';
import { ConnectorError } from '../errors.js';
import { Connection } from '../connection.js';
import { error } from 'node:console';

const CONNECT_TIMEOUT = 30e3;

export default class PassiveConnector extends Connector {
  constructor(connection: Connection) {
    super(connection);
    this.type = 'passive';
  }

  waitForConnection({ timeout = 5e3, delay = 250 } = {}) {
    if (!this.dataServer)
      return Promise.reject(new ConnectorError('Passive server not setup'));

    return new Promise<net.Socket>((resolve, reject) => {
      let delayTimeoutId: NodeJS.Timeout | null = null;

      const timeoutId = setTimeout(() => {
        if (delayTimeoutId) clearTimeout(delayTimeoutId);
        reject(new Error('FTP passive connection timeout'));
      }, timeout);

      const checkSocket = (): void => {
        if (
          this.dataServer &&
          this.dataServer.listening &&
          this.dataSocket &&
          this.dataSocket.connected
        ) {
          clearTimeout(timeoutId);
          if (delayTimeoutId) clearTimeout(delayTimeoutId);
          resolve(this.dataSocket);
          return;
        }

        delayTimeoutId = setTimeout(() => checkSocket(), delay);
      };

      checkSocket();
    });
  }

  async setupServer() {
    this.closeServer();
    return this.server.getNextPassivePort().then(async port => {
      this.dataSocket = null;

      let idleServerTimeout: NodeJS.Timeout | undefined;

      const connectionHandler = async (socket: net.Socket) => {
        const normalizeAddress = (addr: string) => addr.replace(/^::ffff:/, '');

        if (
          !this.connection.commandSocket.remoteAddress ||
          !socket.remoteAddress ||
          normalizeAddress(this.connection.commandSocket.remoteAddress) !==
            normalizeAddress(socket.remoteAddress)
        ) {
          console.error('Connecting address does not match', {
            passiveConnection: socket.remoteAddress,
            commandConnection: this.connection.commandSocket.remoteAddress,
          });
          socket.destroy();
          return this.connection
            .reply(550, 'Remote addresses do not match')
            .then(() => this.connection.close());
        }
        clearTimeout(idleServerTimeout);

        console.log('Passive connection established from', {
          port,
          remoteAddress: socket.remoteAddress,
        });

        this.dataSocket = socket;
        this.dataSocket.on(
          'error',
          err =>
            this.server &&
            this.server.emit('client-error', {
              connection: this.connection,
              context: 'dataSocket',
              error: err,
            })
        );
        this.dataSocket.once('close', () => this.closeServer());

        if (!this.connection.secure) {
          this.dataSocket.connected = true;
        }
      };

      if (this.connection.secure)
        this.dataServer = tls.createServer(
          {
            ...this.server.options.tls,
            pauseOnConnect: true,
          },
          connectionHandler
        );
      else
        this.dataServer = net.createServer(
          { pauseOnConnect: true },
          connectionHandler
        );

      this.dataServer.maxConnections = 1;

      this.dataServer.on(
        'error',
        err =>
          this.server &&
          this.server.emit('client-error', {
            connection: this.connection,
            context: 'dataServer',
            error: err,
          })
      );
      this.dataServer.on('close', () => {
        console.debug('Passive server closed');
        this.end();
      });

      if (this.connection.secure)
        (this.dataServer as tls.Server).on('secureConnection', socket => {
          socket.connected = true;
        });

      return new Promise<net.Server>((resolve, _reject) => {
        this.dataServer?.listen(port, this.server.url.hostname, () => {
          idleServerTimeout = setTimeout(
            () => this.closeServer(),
            CONNECT_TIMEOUT
          );
          console.debug('Passive server listening on', {
            port,
            hostname: this.server.url.hostname,
          });
          resolve(this.dataServer!);
        });
      }).catch((err: Error) => {
        console.error(err.message, error);
        throw error;
      });
    });
  }
}
