import getFileStat from '../../helpers/file-stat.js';
import { CommandRegistry } from '../registry.js';

const mlst: CommandRegistry = {
  directive: 'MLST',
  handler: async function ({ command }) {
    const fs = this.fs;

    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.get) return this.reply(502, 'MLST not supported by file system');

    let path = '.';
    if (command.arg) {
      path = command.arg.trim();
    }

    return Promise.resolve(fs.get(path))
      .then(async stat => {
        const message = getFileStat(stat, 'mlsd');
        return this.reply(
          250,
          'MLST begin',
          {
            raw: true,
            message: ` ${message}`, // Space before facts as per RFC 3659
          },
          'MLST end'
        );
      })
      .catch((err: any) => {
        console.error('MLST error:', err);
        return this.reply(550, `Failed to get file info: ${err.message}`);
      });
  },
  syntax: '{{cmd}} [<path>]',
  description: 'List single object for machine processing',
  flags: {
    feat: 'MLST Type*;Size*;Modify*;Perm*;UNIX.mode*;',
  },
};

export default mlst;
