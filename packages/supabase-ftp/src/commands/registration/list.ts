import getFileStat from '../../helpers/file-stat.js';
import { CommandRegistry } from '../registry.js';

export const list: CommandRegistry = {
  directive: 'LIST',
  handler: async function ({ command }) {
    const fs = this.fs;

    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.get) return this.reply(402, 'Not supported by file system');
    if (!fs.list) return this.reply(402, 'Not supported by file system');

    const simple = command.directive === 'NLST';

    let path = '.';
    let showHidden = false;
    if (command.arg) {
      const args = command.arg.split(/\s+/).filter(Boolean);

      const options = args.filter(arg => arg.startsWith('-'));
      showHidden = options.some(arg => arg.includes('a')); // -a or -al

      const nonOption = args.find(arg => !arg.startsWith('-'));
      if (nonOption) path = nonOption;
    }
    return this.connector
      .waitForConnection()
      .then(() => {
        this.commandSocket.pause();
      })
      .then(() => fs.get(path))
      .then(stat =>
        stat.isDirectory() ? fs.list(path, { showHidden }) : [stat]
      )
      .then(files => {
        this.reply(
          150,
          `Accepted data connection, returning ${files.length} file(s)`
        );

        if (!this.connector.socket) {
          console.error('No data connection established');
          return this.reply(425, 'No data connection established');
        }
        if (!files) {
          return this.reply({
            raw: true,
            socket: this.connector.socket,
            useEmptyMessage: true,
          });
        }

        const message = files
          .map(file => {
            if (simple) return file.name;
            const fileFormat = this?.server?.options?.listFormat ?? 'ls';
            return getFileStat(file, fileFormat);
          })
          .join('\r\n');

        return this.reply(
          { raw: true, socket: this.connector.socket },
          message
        );
      })
      .then(() => this.reply(226))
      .catch(err => {
        if (err && err.name === 'TimeoutError') {
          console.error(err);
          return this.reply(425, 'No connection established');
        }
        console.error(err);
        return this.reply(451, err.message || 'No directory');
      })
      .then(() => {
        this.connector.end();
        this.commandSocket.resume();
      });
  },
  syntax: '{{cmd}} [<path>]',
  description:
    'Returns information of a file or directory if specified, else information of the current working directory is returned',
};

export default list;
