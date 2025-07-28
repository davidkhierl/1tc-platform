import { CommandRegistry } from '../registry.js';

const dele: CommandRegistry = {
  directive: 'DELE',
  handler: async function ({ command }) {
    const fs = this.fs;
    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.delete) return this.reply(502, 'Not supported by file system');

    const arg = command.arg;
    if (!arg) return this.reply(501, 'Syntax error in parameters or arguments');

    return Promise.resolve()
      .then(() => fs.delete(arg))
      .then(() => {
        return this.reply(250, 'Requested file action okay, completed');
      })
      .catch(err => {
        console.error(err);
        return this.reply(550, err.message);
      });
  },
  syntax: '{{cmd}} <path>',
  description: 'Delete file',
};

export default dele;
