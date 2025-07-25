import { CommandRegistry } from '../registry.js';
import dele from './dele.js';

const rmd: CommandRegistry = {
  directive: ['RMD', 'XRMD'],
  handler: function (args) {
    if (!dele.handler) return this.reply(550, 'RMD command not supported');
    return dele.handler.call(this, args);
  },
  syntax: '{{cmd}} <path>',
  description: 'Remove a directory',
};

export default rmd;
