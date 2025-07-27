import registry from './registry.js';
import { CommandRegistry } from '../../registry.js';

const site: CommandRegistry = {
  directive: 'SITE',
  handler: function ({ command }) {
    const rawSubCommand = command?.arg ?? '';
    const subCommand = this.commands.parse(rawSubCommand);

    if (!Object.prototype.hasOwnProperty.call(registry, subCommand.directive))
      return this.reply(502);

    const handler =
      registry[subCommand.directive as keyof typeof registry].handler.bind(
        this
      );
    return Promise.resolve(handler({ command: subCommand }));
  },
  syntax: '{{cmd}} <subVerb> [...<subParams>]',
  description: 'Sends site specific commands to remote server',
};

export default site;
