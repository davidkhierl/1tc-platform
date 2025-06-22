import EventEmitter from "node:events";
import net from "node:net";
import crypto from "node:crypto";
import { Connector } from "./connector/base.js";
import { FtpServer } from "./ftp-server.js";
import { GeneralError, SocketError } from "./errors.js";
import { Commands } from "./commands/commands.js";
import DEFAULT_MESSAGES from "./messages.js";

async function mapSeries<T extends any[], R>(
  arr: T,
  fn: (item: T[number], index: number) => Promise<R>
) {
  const results = [];
  for (let i = 0; i < arr.length; i++) {
    results.push(await fn(arr[i], i));
  }
  return results;
}

export interface ReplyOptionObject {
  raw: boolean;
  socket: net.Socket;
  useEmptyMessage: boolean;
  code: number;
  eol?: boolean;
}

export type ReplyOptions = number | Partial<ReplyOptionObject>;

export interface LetterObject {
  message: string;
  raw: boolean;
  socket: net.Socket;
  encoding: BufferEncoding;
  code: number;
}

export type ReplyLetters = string | Partial<LetterObject>;

export class Connection extends EventEmitter {
  readonly id = "u" + crypto.randomBytes(8).toString("hex");
  readonly server: FtpServer;
  readonly commandSocket: net.Socket;
  connector = new Connector(this);
  commands = new Commands(this);
  transferType = "binary";
  encoding: BufferEncoding = "utf8";
  bufferSize = false;
  authenticated = false;
  username: string | null = null;
  private _restByteCount = 0;
  private _secure = false;

  constructor(server: FtpServer, socket: net.Socket) {
    super();
    this.server = server;
    this.commandSocket = socket;

    this.commandSocket.on("error", (err) => {
      console.error("Client command socket error:", err);
      this.emit("client-error", {
        connection: this,
        context: "commandSocket",
        error: err,
      });
    });
    this.commandSocket.on("data", this._handleData.bind(this));
    this.commandSocket.on("timeout", () => {
      console.warn("Client command socket timeout");
      this.close();
    });
    this.commandSocket.on("close", () => {
      if (this.connector) this.connector.end();
      if (this.commandSocket && !this.commandSocket.destroyed)
        this.commandSocket.destroy();
      this.removeAllListeners();
    });
  }

  private _handleData(data: Buffer<ArrayBufferLike>) {
    const messages = data.toString(this.encoding).split("\r\n").filter(Boolean);
    console.log("Received data:", messages);
    return mapSeries(messages, (message) => this.commands.handle(message));
  }

  get ip() {
    try {
      return this.commandSocket ? this.commandSocket.remoteAddress : undefined;
    } catch {
      return null;
    }
  }

  get restByteCount(): number | undefined {
    return this._restByteCount > 0 ? this._restByteCount : undefined;
  }

  set restByteCount(value: number) {
    this._restByteCount = value;
  }

  get secure() {
    return this.server.isTLS || this._secure;
  }

  set secure(value: boolean) {
    this._secure = value;
  }

  async close(code = 421, message = "Service closing control connection") {
    return Promise.resolve(code)
      .then((_code) => {
        if (_code) this.reply(_code, message);
      })
      .then(() => {
        if (this.commandSocket) this.commandSocket.destroy();
      });
  }

  async login(username: string, password: string) {
    return (
      Promise.resolve()
        // TODO: Create return type for login
        .then((): Promise<any> => {
          const loginListener = this.server.listeners("login");
          if (!loginListener || !loginListener.length) {
            if (!this.server.options.anonymous)
              throw new GeneralError(
                'No "login" event listener registered',
                500
              );
          }

          return this.server.emitPromise("login", {
            connection: this,
            username,
            password,
          });
        })
        .then(({ root, cwd, fs, blacklist = [], whitelist = [] } = {}) => {
          this.authenticated = true;
          this.commands.blacklist = [...this.commands.blacklist, ...blacklist];
          this.commands.whitelist = [...this.commands.whitelist, ...whitelist];
          // this.fs = fs || new FileSystem(this, { root, cwd });
        })
    );
  }

  async reply(options: ReplyOptions, ...letters: ReplyLetters[]) {
    const satisfyParameters = () => {
      if (typeof options === "number") options = { code: options };
      if (!Array.isArray(letters)) letters = [letters];
      if (!letters.length) letters = [{}];

      return Promise.all(
        letters.map(async (promise, index) => {
          return Promise.resolve(promise).then(async (letter) => {
            if (!letter) letter = {};
            else if (typeof letter === "string") letter = { message: letter };

            if (typeof options === "number")
              throw new Error("Options must be an object");

            if (!letter.socket)
              letter.socket = options.socket
                ? options.socket
                : this.commandSocket;
            if (!options.useEmptyMessage) {
              if (!letter.message)
                letter.message = options.code
                  ? DEFAULT_MESSAGES[
                      options.code as keyof typeof DEFAULT_MESSAGES
                    ] || "No information"
                  : "No message";

              if (!letter.encoding) letter.encoding = this.encoding;
            }

            if (!letter.message) throw new Error("Message is required");

            return Promise.resolve(letter.message).then((message) => {
              if (typeof options === "number")
                throw new Error("Options must be an object");

              if (!options.useEmptyMessage) {
                const separator = !Object.prototype.hasOwnProperty.call(
                  options,
                  "eol"
                )
                  ? letters.length - 1 === index
                    ? " "
                    : "-"
                  : options.eol
                    ? " "
                    : "-";

                message = !letter.raw
                  ? [letter.code || options.code!, message]
                      .filter(Boolean)
                      .join(separator)
                  : message;
                letter.message = message;
              } else letter.message = "";

              return letter as LetterObject;
            });
          });
        })
      );
    };

    const processLetter = (letter: LetterObject) =>
      new Promise((resolve, reject) => {
        if (letter.socket && letter.socket.writable) {
          console.debug("Writing reply to socket:", {
            port: (letter.socket.address() as net.AddressInfo).port,
            encoding: letter.encoding,
            message: letter.message,
          });
          letter.socket.write(
            letter.message + "\r\n",
            letter.encoding,
            (err) => {
              if (err) {
                console.error("Error writing to socket:", err);
                return reject(err);
              }

              resolve(undefined);
            }
          );
        } else {
          console.warn("Could not write message to socket:", letter);
          reject(new SocketError("Socket is not writable or does not exist"));
        }
      });

    return satisfyParameters()
      .then((satisfiedLetters) =>
        mapSeries(satisfiedLetters, (letter) => processLetter(letter))
      )
      .catch((error) => {
        console.error("Satisfy Parameters Error", error);
      });
  }
}
