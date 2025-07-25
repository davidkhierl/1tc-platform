import { CommandRegistry } from '../registry.js';

const quit: CommandRegistry = {
  directive: 'QUIT',
  handler: function () {
    return this.close(221, 'Client called QUIT');
  },
  syntax: '{{cmd}}',
  description: 'Disconnect',
  flags: {
    no_auth: true,
  },
};

export default quit;
