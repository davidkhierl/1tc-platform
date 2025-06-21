import EventEmitter from "node:events";
import { Stats } from "node:fs";
import { getNextPortFactory } from "./helpers/find-port.js";
import tls from "node:tls";
import net from "node:net";
import { Connection } from "./connection.js";

export interface FtpServerOptions {
  url: string;
  passivePortRange: [number, number];
  passiveHostname: string | null;
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

export class FtpServer extends EventEmitter {
  private _options: FtpServerOptions;
  private _greeting: string[] = [];
  private _features: string = "";
  private _connections: Map<string, Connection> = new Map();
  private _url: URL;
  readonly server: net.Server;

  readonly getNextPassivePort: () => Promise<number>;

  constructor(options: FtpServerOptions) {
    super();

    this._options = options;

    this._greeting = this.setupGreeting(this._options.greeting);
    this._features = this.setupFeaturesMessage();

    delete this._options.greeting;

    this._url = new URL(this._options.url);
    this.getNextPassivePort = getNextPortFactory(
      this._url.hostname,
      ...this._options.passivePortRange
    );

    const timeout = Number(this._options.timeout);
    this._options.timeout = isNaN(timeout) ? 0 : timeout;

    const serverConnectionHandler = async (socket: net.Socket) => {
      if (this._options.timeout > 0) socket.setTimeout(this._options.timeout);

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
          ...this._options.tls,
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

    if (this._options.endOnProcessSignal) {
      process.on("SIGINT", quit);
      process.on("SIGTERM", quit);
      process.on("SIGQUIT", quit);
    }
  }

  get isTLS() {
    return this._url.protocol === "ftps:" && !!this._options.tls;
  }

  listen(cb?: (host: FtpServerHost) => void) {
    if (!this._options.passiveHostname)
      console.warn(
        "Passive host is not set. Passive connections not available."
      );

    return new Promise<FtpServerHost>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(Number(this._url.port), this._url.hostname, () => {
        this.server.removeListener("error", reject);
        const host = {
          protocol: this._url.protocol.replace(/\W/g, ""),
          ip: this._url.hostname,
          port: Number(this._url.port),
        };
        resolve(host);
        if (cb) cb(host);
      });
    });
  }

  emitPromise(action: string, ...data: any[]) {
    return new Promise((resolve, reject) => {
      const params = [...data, resolve, reject];
      this.emit.call(this, action, ...params);
    });
  }

  setupGreeting(greeting?: string | string[]) {
    if (!greeting) return [];
    return Array.isArray(greeting) ? greeting : greeting.split("\n");
  }

  setupFeaturesMessage() {
    let features = [];
    if (this._options.anonymous) features.push("a");

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
      }, this._options.timeout || 1e3);

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

    const connections = Array.from(this._connections.values());
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
