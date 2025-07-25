import { CommandRegistry } from '../registry.js';

const mkd: CommandRegistry = {
  directive: ['MKD', 'XMKD'],
  handler: async function ({ command }) {
    const fs = this.fs;
    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.mkdir) return this.reply(402, 'Not supported by file system');

    const arg = command.arg;
    if (!arg) return this.reply(501, 'Syntax error in parameters or arguments');

    return Promise.resolve()
      .then(() => fs.mkdir(arg))
      .then(dir => {
        const path = dir ? `"${dir.replace(/"/g, '""')}"` : '';
        return this.reply(257, path);
      })
      .catch(err => {
        console.error(err);
        return this.reply(550, err.message);
      });
  },
  syntax: '{{cmd}} <path>',
  description: 'Make directory',
};

export default mkd;
