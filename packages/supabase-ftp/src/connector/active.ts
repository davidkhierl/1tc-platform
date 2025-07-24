import net from "node:net";
import tls from "node:tls";
import { Connection } from "../connection.js";
import { Connector } from "./base.js";
import { isEqual } from "@1tc/utils/ip";
import { SocketError } from "../errors.js";
import { Socket } from "node:net";

export default class ActiveConnector extends Connector {
  constructor(connection: Connection) {
    super(connection);
    this.type = "active";
  }

  waitForConnection({ timeout = 5e3, delay = 250 } = {}) {
    return new Promise<net.Socket>((resolve, reject) => {
      let delayTimeoutId: NodeJS.Timeout | null = null;

      const timeoutId = setTimeout(() => {
        if (delayTimeoutId) clearTimeout(delayTimeoutId);
        reject(new Error("FTP active connection timeout"));
      }, timeout);

      const checkSocket = (): void => {
        if (this.dataSocket?.connected) {
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

  async setupConnection(host: string, port: number, family = 4): Promise<void> {
    if (this.dataSocket) {
      this.dataSocket.destroy();
      this.dataSocket = null;
    }

    if (
      !this.connection.commandSocket.remoteAddress ||
      !isEqual(this.connection.commandSocket.remoteAddress, host)
    ) {
      throw new SocketError("The given address is not yours", 500);
    }

    return new Promise((resolve, reject) => {
      this.dataSocket = new Socket();

      this.dataSocket.on("error", (err) => {
        if (this.server) {
          this.server.emit("client-error", {
            connection: this.connection,
            context: "dataSocket",
            error: err,
          });
        }
        reject(err);
      });

      this.dataSocket.connect({ host, port, family }, () => {
        try {
          this.dataSocket?.pause();

          if (this.connection.secure) {
            const secureContext = tls.createSecureContext(
              this.server.options.tls
            );
            const secureSocket = new tls.TLSSocket(this.dataSocket!, {
              isServer: true,
              secureContext,
            });
            this.dataSocket = secureSocket;
          }

          if (this.dataSocket) {
            this.dataSocket.connected = true;
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}
