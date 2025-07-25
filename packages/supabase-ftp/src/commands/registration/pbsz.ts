import { CommandRegistry } from '../registry.js';

const pbsz: CommandRegistry = {
  directive: 'PBSZ',
  handler: function ({ command }) {
    if (!this.secure) return this.reply(202, 'Not supported');
    if (!command.arg) return this.reply(501, 'Must provide buffer size');

    this.bufferSize = parseInt(command.arg, 10);
    return this.reply(
      200,
      this.bufferSize === 0 ? 'OK' : 'Buffer too large: PBSZ=0'
    );
  },
  syntax: '{{cmd}}',
  description: 'Protection Buffer Size',
  flags: {
    no_auth: true,
    feat: 'PBSZ',
  },
};

export default pbsz;
