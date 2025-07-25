import { CommandRegistry } from '../registry.js';

const abor: CommandRegistry = {
  directive: 'ABOR',
  handler: async function () {
    return this.connector
      .waitForConnection()
      .then(async socket => {
        return this.reply(426, { socket }).then(() => this.reply(226));
      })
      .catch(() => this.reply(225))
      .then(() => this.connector.end());
  },
  syntax: '{{cmd}}',
  description: 'Abort an active file transfer',
};

export default abor;
