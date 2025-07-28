import { Socket } from 'node:net';
import { TimeoutError } from '../../errors.js';
import { CommandRegistry } from '../registry.js';
import { Readable, Writable } from 'node:stream';

const retr: CommandRegistry = {
  directive: 'RETR',
  handler: async function ({ command }) {
    const fs = this.fs;
    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.read) return this.reply(502, 'Not supported by file system');

    const filePath = command.arg;

    if (!filePath) return this.reply(501, 'No file path specified');

    return this.connector
      .waitForConnection()
      .then(() => {
        this.commandSocket.pause();
      })
      .then(() => fs.get(filePath))
      .then(fileStat => {
        if (fileStat.isDirectory()) {
          throw new Error('Cannot retrieve a directory');
        }

        return fs.read(filePath, { start: this.restByteCount });
      })
      .then(async fsResponse => {
        let { stream, clientPath } = fsResponse;
        if (!stream && !clientPath) {
          stream = fsResponse as unknown as Readable | Writable;
          clientPath = filePath;
        }

        const serverPath = clientPath || filePath;

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

        const eventsPromise = new Promise<void>((resolve, reject) => {
          let totalBytes = 0;

          stream.on('data', data => {
            totalBytes += data.length;
            if (this.connector.socket && this.connector.socket.writable) {
              this.connector.socket.write(data);
            } else {
              reject(new Error('Data connection lost'));
            }
          });

          stream.once('end', () => {
            console.log(`File transfer completed: ${totalBytes} bytes sent`);
            resolve(void 0);
          });

          stream.once('error', err => {
            console.error('Stream error:', err);
            destroyConnection(this.connector.socket, reject)(err);
          });

          this.connector.socket?.once('error', err => {
            console.error('Data connection error:', err);
            destroyConnection(stream, reject)(err);
          });

          this.connector.socket?.once('close', () => {
            console.log('Data connection closed');
          });
        });

        this.restByteCount = 0;

        return eventsPromise
          .then(() => this.emit('RETR', null, serverPath))
          .then(() => this.reply(226, `Transfer complete for ${clientPath}`))
          .then(() => {
            if (stream.destroy) stream.destroy();
          });
      })
      .catch(err => {
        console.error('RETR error:', err);
        if (err && err instanceof TimeoutError) {
          return this.reply(425, 'No connection established');
        }
        this.emit('RETR', err);
        return this.reply(
          550,
          err.message || 'File not found or cannot be retrieved'
        );
      })
      .then(() => {
        this.connector.end();
        this.commandSocket.resume();
      });
  },
  syntax: '{{cmd}} <path>',
  description: 'Retrieve a file',
};

export default retr;
