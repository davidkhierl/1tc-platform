import { Readable, Writable } from 'node:stream';
import { TransferError, TimeoutError } from '../../errors.js';
import { CommandRegistry } from '../registry.js';
import { Socket } from 'node:net';
import { FTP_CODES } from '../../messages.js';

const appe: CommandRegistry = {
  directive: 'APPE',
  handler: async function ({ command }) {
    const fs = this.fs;

    if (!fs)
      return this.reply(
        FTP_CODES.FILE_UNAVAILABLE,
        'File system not instantiated'
      );
    if (!fs.write)
      return this.reply(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED,
        'Not supported by file system'
      );

    const fileName = command.arg;

    if (!fileName)
      return this.reply(
        FTP_CODES.SYNTAX_ERROR_PARAMETERS,
        'File name required'
      );

    return this.connector
      .waitForConnection()
      .then(() => this.commandSocket.pause())
      .then(() =>
        Promise.resolve().then(() =>
          fs.write(fileName, { append: true, start: this.restByteCount })
        )
      )
      .then(async fsResponse => {
        let { stream, clientPath } = fsResponse;
        if (!stream && !clientPath) {
          stream = fsResponse as unknown as Readable | Writable;
          clientPath = fileName;
        }

        const serverPath = (stream as any).path || fileName;

        const destroyConnection =
          (
            connection: Socket | Readable | Writable | null,
            reject: (err?: Error) => void
          ) =>
          (err: Error) => {
            try {
              if (connection) {
                if (!(connection instanceof Readable) && connection.writable)
                  connection.end();
                connection.destroy(err);
              }
            } finally {
              reject(err);
            }
          };

        const streamPromise = new Promise<void>((resolve, reject) => {
          stream.once(
            'error',
            destroyConnection(this.connector.socket, reject)
          );
          stream.once('finish', () => resolve(void 0));
        });

        const socketPromise = new Promise((resolve, reject) => {
          if (stream instanceof Readable)
            return reject(new TransferError('Stream is not writable'));

          this.connector.socket?.pipe(stream, { end: false });
          this.connector.socket?.once('end', () => {
            if (stream.listenerCount('close')) stream.emit('close');
            else stream.end();
            resolve(void 0);
          });
          this.connector.socket?.once(
            'error',
            destroyConnection(stream, reject)
          );
        });

        this.restByteCount = 0;

        return this.reply(FTP_CODES.FILE_STATUS_OK_OPENING_DATA_CONNECTION)
          .then(() => this.connector.socket && this.connector.socket.resume())
          .then(() => Promise.all([streamPromise, socketPromise]))
          .then(() => this.emit('STOR', null, serverPath))
          .then(() =>
            this.reply(FTP_CODES.CLOSING_DATA_CONNECTION, clientPath)
          );
      })
      .catch(err => {
        console.error(err);
        if (err instanceof TimeoutError) {
          return this.reply(
            FTP_CODES.CANT_OPEN_DATA_CONNECTION,
            'No connection established'
          );
        }
        this.emit('STOR', err);
        return this.reply(FTP_CODES.FILE_UNAVAILABLE, err.message);
      })
      .then(() => {
        this.connector.end();
        this.commandSocket.resume();
      });
  },
  syntax: '{{cmd}} <path>',
  description: 'Append to a file',
};

export default appe;
