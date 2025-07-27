import getFileStat from '../../helpers/file-stat.js';
import { CommandRegistry } from '../registry.js';

const mlsd: CommandRegistry = {
  directive: 'MLSD',
  handler: async function ({ command }) {
    const fs = this.fs;

    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.list) return this.reply(502, 'MLSD not supported by file system');

    let path = '.';
    if (command.arg) {
      path = command.arg.trim();
    }

    return this.connector
      .waitForConnection()
      .then(() => {
        return Promise.resolve(fs.list(path)).then(async stats => {
          return Promise.all(
            stats.map(stat => {
              const message = getFileStat(stat, 'mlsd');
              return {
                raw: true,
                message,
              };
            })
          ).then(messages =>
            this.reply(
              150,
              'Opening ASCII mode data connection for MLSD',
              ...messages,
              '226 MLSD complete'
            )
          );
        });
      })
      .catch((err: any) => {
        console.error('MLSD error:', err);
        return this.reply(550, `Failed to list directory: ${err.message}`);
      });
  },
  syntax: '{{cmd}} [<path>]',
  description: 'List directory contents for machine processing',
  flags: {
    feat: 'MLST Type*;Size*;Modify*;Perm*;UNIX.mode*;',
  },
};

export default mlsd;
