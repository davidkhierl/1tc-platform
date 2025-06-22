import net from "node:net";
import { Connection } from "../connection.js";
import { ConnectorError } from "../errors.js";

export class Connector {
  readonly connection: Connection;
  dataSocket: net.Socket | null = null;
  dataServer: net.Server | null = null;
  type: boolean | "active" | "passive" = false;
  connected = false;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  get socket() {
    return this.dataSocket;
  }

  get server() {
    return this.connection.server;
  }

  waitForConnection(): Promise<net.Socket> {
    return Promise.reject(
      new ConnectorError("No connector setup, send PASV or PORT")
    );
  }

  async setupServer(): Promise<net.Server> {
    return Promise.reject(
      new ConnectorError("No connector setup, send PASV or PORT")
    );
  }

  closeSocket() {
    if (this.dataSocket) {
      const socket = this.dataSocket;
      this.dataSocket.end(() => socket && socket.destroy());
      this.dataSocket = null;
    }
  }

  closeServer() {
    if (this.dataServer) {
      this.dataServer.close();
      this.dataServer = null;
    }
  }

  end() {
    this.closeSocket();
    this.closeServer();
    this.type = false; // Reset the type
    this.connection.connector = new Connector(this.connection);
  }
}
