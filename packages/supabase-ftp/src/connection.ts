import EventEmitter from "node:events";
import { FtpServer } from "./ftp-server.js";
import net from "node:net";
import crypto from "node:crypto";

export class Connection extends EventEmitter {
  readonly id: string;
  readonly server: FtpServer;
  readonly commandSocket: net.Socket;
  transferType = "binary";

  constructor(server: FtpServer, socket: net.Socket) {
    super();
    this.server = server;
    this.id = "u" + crypto.randomBytes(8).toString("hex");
    this.commandSocket = socket;
  }

  close(code = 421, message = "Service closing control connection") {
    return Promise.resolve(code);
  }

  async reply(options: number | Record<string, any>, ...letters: string[]) {
    if (typeof options === "number") options = { code: options };
  }
}
