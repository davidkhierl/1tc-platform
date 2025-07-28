import { FileSystemError } from '../../errors.js';
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

        if (err instanceof FileSystemError) {
          return this.reply(550, `File system error: ${err.message}`);
        }

        if (err.code === 'ENOENT') {
          return this.reply(550, `${path}: No such file or directory`);
        }
        if (err.code === 'EACCES') {
          return this.reply(550, `${path}: Permission denied`);
        }
        if (err.code === 'EISDIR' && path !== '.') {
          return this.reply(550, `${path}: Is a directory`);
        }

        return this.reply(
          550,
          `Failed to get file info: ${err.message || 'Unknown error'}`
        );
      });
  },
  syntax: '{{cmd}} [<path>]',
  description: 'List single object for machine processing',
};

export default mlst;
