import { CommandRegistry } from '../registry.js';

const stru: CommandRegistry = {
  directive: 'STRU',
  handler: function ({ command }) {
    if (!command.arg) return this.reply(503);
    return this.reply(/^F$/i.test(command.arg) ? 200 : 504);
  },
  syntax: '{{cmd}} <structure>',
  description: 'Set file transfer structure',
  flags: {
    obsolete: true,
  },
};

export default stru;
