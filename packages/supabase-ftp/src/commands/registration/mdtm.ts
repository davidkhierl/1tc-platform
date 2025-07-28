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

    return Promise.resolve()
      .then(() => fs.get(command.arg!))
      .then(fileStat => {
        const modificationTime = format(fileStat.mtime, 'yyyyMMddHHmmss.SSS');
        return this.reply(213, modificationTime);
      });
  },
  syntax: '{{cmd}} <path>',
  description: 'Returns the last modification time of a file or directory',
  flags: {
    feat: 'MDTM',
  },
};

export default mdtm;
