import { CommandRegistry } from '../registry.js';

const rnfr: CommandRegistry = {
  directive: 'RNFR',
  handler: async function ({ command }) {
    const fs = this.fs;
    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.get) return this.reply(502, 'Not supported by file system');

    const fileName = command.arg;
    if (!fileName) return this.reply(501, 'Must provide file name');
    return Promise.resolve()
      .then(() => fs.get(fileName))
      .then(() => {
        this.renameFrom = fileName;
        return this.reply(350);
      })
      .catch(err => {
        console.error(err);
        return this.reply(550, err.message);
      });
  },
  syntax: '{{cmd}} <name>',
  description: 'Rename from',
};

export default rnfr;
