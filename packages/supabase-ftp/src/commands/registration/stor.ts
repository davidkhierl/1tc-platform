import { Readable, Writable } from "node:stream";
import { CommandRegistry } from "../registry.js";
import { Socket } from "node:net";
import { TimeoutError } from "../../errors.js";

const stor: CommandRegistry = {
  directive: "STOR",
  handler: async function ({ command }) {
    const fs = this.fs;
    if (!fs) return this.reply(550, "File system not instantiated");
    if (!fs.write) return this.reply(402, "Not supported by file system");

    const fileName = command.arg;

    if (!fileName)
      return this.reply(501, "Syntax error in parameters or arguments");

    return this.connector
      .waitForConnection()
      .then(() => this.commandSocket.pause())
      .then(() => fs.write(fileName))
      .then(async (fsResponse) => {
        let { stream, clientPath } = fsResponse;
        if (!stream && !clientPath) {
          stream = fsResponse as unknown as Readable | Writable;
          clientPath = fileName;
        }

        const serverPath = fileName;

        const destroyConnection =
          (
            connection: Socket | Readable | Writable | null,
            reject: (err?: Error) => void
          ) =>
          (err: Error) => {
            try {
              if (connection) {
                if (
                  (connection instanceof Socket ||
                    connection instanceof Writable) &&
                  connection.writable
                )
                  connection.end();
                connection.destroy(err);
              }
            } finally {
              reject(err);
            }
          };

        await this.reply(150, `Opening data connection for ${clientPath}`);

        const streamPromise = new Promise<void>((resolve, reject) => {
          stream.once(
            "error",
            destroyConnection(this.connector.socket, reject)
          );
          stream.once("finish", () => resolve());
        });

        const socketPromise = new Promise<void>((resolve, reject) => {
          if (
            this.connector.socket &&
            this.connector.socket.writable &&
            stream instanceof Writable
          ) {
            this.connector.socket.pipe(stream, { end: false });
            this.connector.socket.once("end", () => {
              if (stream.listenerCount("close")) stream.emit("close");
              else stream.end();
              resolve(void 0);
            });
            this.connector.socket.once(
              "error",
              destroyConnection(stream, reject)
            );
          }
        });

        this.restByteCount = 0;

        return Promise.resolve()
          .then(() => this.connector.socket && this.connector.socket.resume())
          .then(() => Promise.all([streamPromise, socketPromise]))
          .then(() => this.emit("STOR", null, serverPath))
          .then(() => this.reply(226, clientPath));
      })
      .catch((err) => {
        console.error(err);
        if (err instanceof TimeoutError) {
          return this.reply(425, "No connection established");
        }
        this.emit("STOR", err);
        return this.reply(550, err.message);
      })
      .then(() => {
        this.connector.end();
        this.commandSocket.resume();
      });
  },
  syntax: "{{cmd}} <path>",
  description: "Store data as a file at the server site",
};

export default stor;
