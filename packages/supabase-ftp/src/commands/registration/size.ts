import { CommandRegistry } from '../registry.js';

const size: CommandRegistry = {
  directive: 'SIZE',
  handler: async function ({ command }) {
    const fs = this.fs;
    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.get) return this.reply(502, 'Not supported by file system');

    if (!command.arg) return this.reply(503);

    return Promise.resolve()
      .then(() => fs.get(command.arg!))
      .then(fileStat => {
        return this.reply(213, { message: fileStat.size.toString() });
      })
      .catch(err => {
        console.error(err);
        return this.reply(550, err.message);
      });
  },
  syntax: '{{cmd}} <path>',
  description: 'Return the size of a file',
  flags: {
    feat: 'SIZE',
  },
};

export default size;
