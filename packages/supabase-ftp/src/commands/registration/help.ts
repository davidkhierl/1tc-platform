import { CommandRegistry } from '../registry.js';

let registryRef: Record<string, CommandRegistry> = {};

const help: CommandRegistry = {
  directive: 'HELP',
  handler: function ({ command }) {
    const directive = (command.arg || '').toUpperCase();
    if (directive) {
      if (!Object.prototype.hasOwnProperty.call(registryRef, directive))
        return this.reply(502, `Unknown command ${directive}.`);

      const commandRegistry = registryRef[directive];
      if (!commandRegistry) return this.reply(502, 'Command not registered.');

      const { syntax, description } = commandRegistry;

      const reply = [syntax.replace('{{cmd}}', directive), description];
      return this.reply(214, ...reply);
    } else {
      const keys = Object.keys(registryRef);
      const supportedCommands = [];
      for (let i = 0; i < keys.length; i += 5) {
        supportedCommands.push(keys.slice(i, i + 5).join('\t'));
      }
      return this.reply(
        211,
        'Supported commands:',
        ...supportedCommands,
        'Use "HELP [command]" for syntax help.'
      );
    }
  },
  syntax: '{{cmd}} [<command>]',
  description:
    'Returns usage documentation on a command if specified, else a general help document is returned',
  flags: {
    no_auth: true,
  },
};

export function setHelpRegistry(registry: Record<string, CommandRegistry>) {
  registryRef = registry;
}

export default help;
