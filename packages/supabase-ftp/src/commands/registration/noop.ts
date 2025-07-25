import { CommandRegistry } from '../registry.js';

const noop: CommandRegistry = {
  directive: 'NOOP',
  handler: function () {
    return this.reply(200, 'Zzz...');
  },
  syntax: '{{cmd}}',
  description: 'No operation',
  flags: {
    no_auth: true,
  },
};

export default noop;
