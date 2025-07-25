import { CommandRegistry } from '../registry.js';

const mode: CommandRegistry = {
  directive: 'MODE',
  handler: function ({ command }) {
    if (!command.arg)
      return this.reply(501, 'MODE command requires an argument');

    return this.reply(/^S$/i.test(command.arg) ? 200 : 504);
  },
  syntax: '{{cmd}} <mode>',
  description: 'Sets the transfer mode (Stream, Block, or Compressed)',
  flags: {
    obsolete: true,
  },
};

export default mode;
