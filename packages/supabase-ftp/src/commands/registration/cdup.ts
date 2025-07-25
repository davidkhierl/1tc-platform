import { CommandRegistry } from '../registry.js';
import cwd from './cwd.js';

const cdup: CommandRegistry = {
  directive: ['CDUP', 'XCUP'],
  handler: function (args) {
    args.command.arg = '..';
    if (!cwd.handler) return this.reply(502, 'CDUP command not implemented');
    return cwd.handler.call(this, args);
  },
  syntax: '{{cmd}}',
  description: 'Change to Parent Directory',
};

export default cdup;
