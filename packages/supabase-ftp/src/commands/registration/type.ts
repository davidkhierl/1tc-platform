import { CommandRegistry } from '../registry.js';

const type: CommandRegistry = {
  directive: 'TYPE',
  handler: function ({ command }) {
    if (!command.arg) {
      return this.reply(501, 'Must provide transfer type');
    }
    if (/^A[0-9]?$/i.test(command.arg)) {
      this.transferType = 'ascii';
    } else if (/^L[0-9]?$/i.test(command.arg) || /^I$/i.test(command.arg)) {
      this.transferType = 'binary';
    } else {
      return this.reply(501);
    }
    return this.reply(200, `Switch to "${this.transferType}" transfer mode.`);
  },
  syntax: '{{cmd}} <mode>',
  description: 'Set the transfer mode, binary (I) or ascii (A)',
  flags: {
    feat: 'TYPE A,I,L',
  },
};

export default type;
