import getFileStat from '../../helpers/file-stat.js';
import { CommandRegistry } from '../registry.js';
import { FileStats } from '../../fs/fs.js';

const stat: CommandRegistry = {
  directive: 'STAT',
  handler: async function ({ command }) {
    const path = command?.arg;
    if (path) {
      const fs = this.fs;
      if (!fs) return this.reply(550, 'File system not instantiated');
      if (!fs.get) return this.reply(402, 'Not supported by file system');

      return Promise.resolve(fs.get(path))
        .then(async (stat: FileStats) => {
          if (stat.isDirectory()) {
            if (!fs.list)
              return this.reply(402, 'Not supported by file system');

            return Promise.resolve(fs.list(path)).then(
              async (stats: FileStats[]) => {
                return Promise.all(
                  stats.map((file: FileStats) => {
                    const message = getFileStat(
                      file,
                      this?.server?.options?.listFormat || 'ls'
                    );
                    return {
                      raw: true,
                      message,
                    };
                  })
                ).then(messages =>
                  this.reply(213, 'Status begin', ...messages, 'Status end')
                );
              }
            );
          } else {
            const message = getFileStat(
              stat,
              this?.server?.options?.listFormat || 'ls'
            );
            return this.reply(
              212,
              'Status begin',
              {
                raw: true,
                message,
              },
              'Status end'
            );
          }
        })
        .catch((err: any) => {
          console.error(err);
          return this.reply(450, err.message);
        });
    } else {
      return this.reply(211, 'Status OK');
    }
  },
  syntax: '{{cmd}} [<path>]',
  description: 'Returns the current status',
};

export default stat;
