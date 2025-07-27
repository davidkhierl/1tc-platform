import { ConnectorError, TimeoutError } from '../../errors.js';
import getFileStat from '../../helpers/file-stat.js';
import { CommandRegistry } from '../registry.js';

export const list: CommandRegistry = {
  directive: 'LIST',
  handler: async function ({ command }) {
    const fs = this.fs;

    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.get) return this.reply(502, 'Not supported by file system');
    if (!fs.list) return this.reply(502, 'LIST not supported by file system');

    if (!this.connector)
      return this.reply(
        425,
        'Use PASV or PORT to establish data connection first'
      );

    let path = '.';
    let showHidden = false;
    if (command.arg) {
      const args = command.arg.split(/\s+/).filter(Boolean);

      const options = args.filter(arg => arg.startsWith('-'));
      showHidden = options.some(arg => {
        const flags = arg.slice(1);
        return /^[la]*a[la]*$/.test(flags);
      });

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
      .then(async files => {
        this.reply(
          150,
          `Accepted data connection, returning ${files.length} file(s)`
        );

        const socket = this.connector.socket ?? undefined;

        if (!files) {
          return this.reply({
            raw: true,
            socket,
            useEmptyMessage: true,
          });
        }

        return Promise.try(() =>
          files.map(file => {
            const fileFormat =
              this.listFormat || this.server.options.listFormat || 'ls';
            return getFileStat(file, fileFormat);
          })
        ).then(formattedFiles => {
          return this.reply(
            {},
            { raw: true, socket, message: formattedFiles.join('\r\n') }
          );
        });
      })
      .then(() => this.reply(226, 'LIST complete'))
      .catch(err => {
        if (err instanceof TimeoutError) {
          console.error(err);
          return this.reply(425, 'No connection established');
        }
        if (err instanceof ConnectorError) {
          console.error(err);
          return this.reply(
            425,
            'Use PASV or PORT to establish data connection first'
          );
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
