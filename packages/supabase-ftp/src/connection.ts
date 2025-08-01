import EventEmitter from 'node:events';
import net from 'node:net';
import crypto from 'node:crypto';
import { Connector } from './connector/base.js';
import { FtpServer } from './ftp-server.js';
import { SocketError, SecurityError } from './errors.js';
import { Commands } from './commands/commands.js';
import DEFAULT_MESSAGES, { FTP_CODES } from './messages.js';
import FileSystem from './fs/fs.js';
import SupabaseFileSystem from './fs/supabase-fs.js';
import { RateLimiter } from './rate-limiter.js';

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
  readonly id = 'u' + crypto.randomBytes(8).toString('hex');
  readonly server: FtpServer;
  commandSocket: net.Socket;
  connector = new Connector(this);
  commands = new Commands(this);
  transferType = 'binary';
  encoding: BufferEncoding = 'utf8';
  bufferSize: number = 0;
  authenticated = false;
  username: string | null = null;
  private _restByteCount = 0;
  private _secure = false;
  fs: FileSystem | null = null;
  renameFrom: string | null = null;
  listFormat: 'ls' | 'ep' = 'ls';
  private rateLimiter: RateLimiter;

  constructor(server: FtpServer, socket: net.Socket) {
    super();
    this.server = server;
    this.commandSocket = socket;

    this.rateLimiter = new RateLimiter(300, 60000);

    if (this.server.options.timeout > 0) {
      this.commandSocket.setTimeout(this.server.options.timeout);
    }

    this.commandSocket.on('error', err => {
      console.error('Client command socket error:', err);
      this.emit('client-error', {
        connection: this,
        context: 'commandSocket',
        error: err,
      });
    });
    this.commandSocket.on('data', this._handleData.bind(this));
    this.commandSocket.on('timeout', () => {
      console.warn('Client command socket timeout');
      this.close(
        FTP_CODES.SERVICE_NOT_AVAILABLE,
        DEFAULT_MESSAGES[FTP_CODES.SERVICE_NOT_AVAILABLE]
      );
    });
    this.commandSocket.on('close', () => {
      if (this.connector) this.connector.end();
      if (this.commandSocket && !this.commandSocket.destroyed)
        this.commandSocket.destroy();
      this.removeAllListeners();
    });
  }

  private _handleData(data: Buffer<ArrayBufferLike>) {
    const maxMessageSize = 8192;
    if (data.length > maxMessageSize) {
      console.warn('Oversized command received, closing connection');
      this.close(
        FTP_CODES.SYNTAX_ERROR_COMMAND_UNRECOGNIZED,
        'Command line too long'
      );
      return Promise.resolve();
    }

    const rawMessages = data.toString(this.encoding).split('\r\n');

    const messages = rawMessages
      .filter(Boolean)
      .map(msg => msg.trim())
      .filter(msg => msg.length > 0 && msg.length <= 512)
      .slice(0, 10);

    if (messages.length === 0) {
      return Promise.resolve();
    }

    console.log('FTP messages received:', messages);

    const clientId = this.ip || this.id;
    if (!this.rateLimiter.isAllowed(clientId)) {
      console.warn('Rate limit exceeded for client');
      this.close(
        FTP_CODES.SERVICE_NOT_AVAILABLE,
        DEFAULT_MESSAGES[FTP_CODES.SERVICE_NOT_AVAILABLE]
      );
      return Promise.resolve();
    }

    return mapSeries(messages, message => this.commands.handle(message));
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

  async close(code?: number, message?: string) {
    const defaultCode = FTP_CODES.SERVICE_NOT_AVAILABLE;
    const defaultMessage = DEFAULT_MESSAGES[FTP_CODES.SERVICE_NOT_AVAILABLE];

    return Promise.resolve(code || defaultCode)
      .then(_code => {
        if (_code) this.reply(_code, message || defaultMessage);
      })
      .then(() => {
        if (this.commandSocket) this.commandSocket.destroy();
      });
  }

  async login(username: string, password: string) {
    return Promise.resolve()
      .then(() => {
        const loginListener = this.server.listeners('login');
        if (!loginListener || !loginListener.length) {
          if (!this.server.options.anonymous)
            throw new SecurityError(
              'No "login" event listener registered',
              FTP_CODES.COMMAND_NOT_IMPLEMENTED
            );
        }

        return this.server.emitPromise('login', {
          connection: this,
          username,
          password,
        });
      })
      .then(({ root, cwd, fs, blacklist = [], whitelist = [] }) => {
        this.authenticated = true;
        this.commands.blacklist = [...this.commands.blacklist, ...blacklist];
        this.commands.whitelist = [...this.commands.whitelist, ...whitelist];
        this.fs = fs || new SupabaseFileSystem(this, { root, cwd });
      });
  }

  async reply(options: ReplyOptions, ...letters: ReplyLetters[]) {
    const satisfyParameters = () => {
      if (typeof options === 'number') options = { code: options };
      if (!Array.isArray(letters)) letters = [letters];
      if (!letters.length) letters = [{}];

      return Promise.all(
        letters.map(async (promise, index) => {
          return Promise.resolve(promise).then(async letter => {
            if (!letter) letter = {};
            else if (typeof letter === 'string') letter = { message: letter };

            if (typeof options === 'number')
              throw new Error('Options must be an object');

            if (!letter.socket)
              letter.socket = options.socket
                ? options.socket
                : this.commandSocket;
            if (!options.useEmptyMessage) {
              if (!letter.message)
                letter.message = options.code
                  ? DEFAULT_MESSAGES[
                      options.code as keyof typeof DEFAULT_MESSAGES
                    ] || 'No information'
                  : 'No message';

              if (!letter.encoding) letter.encoding = this.encoding;
            }

            if (!letter.message) throw new Error('Message is required');

            return Promise.resolve(letter.message).then(message => {
              if (typeof options === 'number')
                throw new Error('Options must be an object');

              if (!options.useEmptyMessage) {
                const separator = !Object.prototype.hasOwnProperty.call(
                  options,
                  'eol'
                )
                  ? letters.length - 1 === index
                    ? ' '
                    : '-'
                  : options.eol
                    ? ' '
                    : '-';

                message = !letter.raw
                  ? [letter.code || options.code!, message]
                      .filter(Boolean)
                      .join(separator)
                  : message;
                letter.message = message;
              } else letter.message = '';

              return letter as LetterObject;
            });
          });
        })
      );
    };

    const processLetter = (letter: LetterObject) =>
      new Promise<string>((resolve, reject) => {
        if (letter.socket && letter.socket.writable) {
          console.debug('Writing reply to socket:', {
            port: (letter.socket.address() as net.AddressInfo).port,
            encoding: letter.encoding,
            message: letter.message,
          });
          letter.socket.write(letter.message + '\r\n', letter.encoding, err => {
            if (err) {
              console.error('Error writing to socket:', err);
              return reject(err);
            }

            resolve(letter.message);
          });
        } else {
          console.warn('Could not write message to socket:', letter);
          reject(new SocketError('Socket is not writable or does not exist'));
        }
      });

    return satisfyParameters()
      .then(satisfiedLetters =>
        mapSeries(satisfiedLetters, letter => processLetter(letter))
      )
      .catch(error => {
        // Log error details for debugging but don't expose to client
        console.error('Reply processing error:', error);
        // Send generic error to client to avoid information disclosure
        if (this.commandSocket && this.commandSocket.writable) {
          this.commandSocket.write(
            `${FTP_CODES.ACTION_ABORTED_LOCAL_ERROR} ${DEFAULT_MESSAGES[FTP_CODES.ACTION_ABORTED_LOCAL_ERROR]}\r\n`
          );
        }
      });
  }
}
