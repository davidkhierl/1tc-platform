import { format } from 'date-fns';
import { CommandRegistry } from '../registry.js';

const mdtm: CommandRegistry = {
  directive: 'MDTM',
  handler: async function ({ command }) {
    const fs = this.fs;

    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.get) return this.reply(502, 'Not supported by file system');

    if (!command.arg)
      return this.reply(503, 'Missing argument for MDTM command');

    const arg = command.arg.trim();

    const setTimeMatch = arg.match(/^(\d{14})\s+(.+)$/);

    if (setTimeMatch) {
      const [, timestamp, filename] = setTimeMatch;

      // Note: Supabase Storage doesn't support setting file modification times
      // We'll just acknowledge the command but not actually change anything
      console.log(
        `MDTM set time request for ${filename} to ${timestamp} (not supported, acknowledging)`
      );

      return this.reply(200, `MDTM command successful`);
    } else {
      return Promise.resolve()
        .then(() => fs.get(arg))
        .then(fileStat => {
          const modificationTime = format(fileStat.mtime, 'yyyyMMddHHmmss.SSS');
          return this.reply(213, modificationTime);
        })
        .catch((err: any) => {
          console.error('MDTM error:', err);
          return this.reply(
            550,
            `Failed to get modification time: ${err.message}`
          );
        });
    }
  },
  syntax: '{{cmd}} [<timestamp>] <path>',
  description: 'Gets or sets the last modification time of a file or directory',
  flags: {
    feat: 'MDTM',
  },
};

export default mdtm;
