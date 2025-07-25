import { CommandRegistry } from '../registry.js';

const rest: CommandRegistry = {
  directive: 'REST',
  handler: function ({ command }) {
    const arg = command?.arg;
    if (!arg) return this.reply(501, 'Byte count is required');

    const byteCount = parseInt(arg, 10);

    if (isNaN(byteCount) || byteCount < 0)
      return this.reply(501, 'Byte count must be 0 or greater');

    this.restByteCount = byteCount;
    return this.reply(350, `Restarting next transfer at ${byteCount}`);
  },
  syntax: '{{cmd}} <byte-count>',
  description:
    'Restart transfer from the specified point. Resets after any STORE or RETRIEVE',
};

export default rest;
