import { CommandRegistry } from '../registry.js';
import stor from './stor.js';

const stou: CommandRegistry = {
  directive: 'STOU',
  handler: async function (args) {
    const fs = this.fs;
    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.get || !fs.getUniqueName)
      return this.reply(502, 'Not supported by file system');

    const fileName = args.command.arg;
    if (!fileName) return this.reply(503, 'Must provide file name');
    return Promise.resolve()
      .then(() => fs.get(fileName))
      .then(() => fs.getUniqueName(fileName))
      .catch(() => fileName)
      .then(name => {
        args.command.arg = name;
        return stor.handler?.call(this, args);
      });
  },
  syntax: '{{cmd}}',
  description: 'Store file uniquely',
};

export default stou;
