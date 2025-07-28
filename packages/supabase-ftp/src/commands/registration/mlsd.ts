import { ConnectorError, TimeoutError } from '../../errors.js';
import getFileStat from '../../helpers/file-stat.js';
import { CommandRegistry } from '../registry.js';

const mlsd: CommandRegistry = {
  directive: 'MLSD',
  handler: async function ({ command }) {
    const fs = this.fs;

    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.get) return this.reply(502, 'Not supported by file system');
    if (!fs.list) return this.reply(502, 'MLSD not supported by file system');

    let path = '.';
    let showHidden = false;
    if (command.arg) {
      const options = command.arg.split(/\s+/).filter(Boolean);
      showHidden = options.some(arg => {
        const flags = arg.slice(1);
        return /^[la]*a[la]*$/.test(flags);
      });

      const nonOption = options.find(arg => !arg.startsWith('-'));
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
        this.reply(150, 'Opening ASCII mode data connection for MLSD');

        const socket = this.connector.socket ?? undefined;

        const message = files
          .map(file => {
            return getFileStat(file, 'mlsd');
          })
          .join('\r\n');

        return this.reply(
          {
            raw: true,
            socket,
          },
          message
        );
      })
      .then(() => this.reply(226, 'MLSD complete'))
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
  description: 'List directory contents for machine processing',
  flags: {
    feat: 'MLSD Type*;Size*;Modify*;Perm*;',
  },
};

export default mlsd;
