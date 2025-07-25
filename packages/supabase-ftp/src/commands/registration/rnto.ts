import { CommandRegistry } from '../registry.js';

const rnto: CommandRegistry = {
  directive: 'RNTO',
  handler: async function ({ command }) {
    if (!this.renameFrom) return this.reply(503);

    const fs = this.fs;
    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.rename) return this.reply(402, 'Not supported by file system');

    const from = this.renameFrom;
    const to = command.arg;

    if (!to) return this.reply(503);

    return Promise.resolve()
      .then(() => fs.rename(from, to))
      .then(() => {
        return this.reply(250);
      })
      .then(() => this.emit('RNTO', null, to))
      .catch(err => {
        console.error(err);
        this.emit('RNTO', err);
        return this.reply(550, err.message);
      })
      .then(() => {
        this.renameFrom = null;
      });
  },
  syntax: '{{cmd}} <name>',
  description: 'Rename to',
};

export default rnto;
