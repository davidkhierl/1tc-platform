import REGISTRY from './registry.js';
import { Connection } from '../connection.js';
import { GeneralError } from '../errors.js';

const CMD_FLAG_REGEX = new RegExp(/^-(\w{1})$/);

export interface ParsedCommand {
  directive: string;
  arg: string | null;
  flags: string[];
  raw: string;
}

export class Commands {
  readonly connection: Connection;
  previousCommand?: ParsedCommand;
  blacklist: string[] = [];
  whitelist: string[] = [];

  constructor(connection: Connection) {
    this.connection = connection;
    this.blacklist = (connection?.server?.options?.blacklist ?? []).map(cmd =>
      typeof cmd === 'string'
        ? cmd
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
            .toUpperCase()
        : cmd
    );
    this.whitelist = (connection?.server?.options?.whitelist ?? []).map(cmd =>
      typeof cmd === 'string'
        ? cmd
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
            .toUpperCase()
        : cmd
    );
  }

  parse(message: string): ParsedCommand {
    const strippedMessage = message.replace(/"/g, '');
    let [directive, ...args] = strippedMessage.split(' ');
    directive = directive?.trim().toUpperCase();

    if (!directive) throw new GeneralError('Failed to parse command', 500);

    const parseCommandFlags = !['RETR', 'SIZE', 'STOR'].includes(directive);
    const params = args.reduce<{ arg: string[]; flags: string[] }>(
      ({ arg, flags }, param) => {
        if (parseCommandFlags && CMD_FLAG_REGEX.test(param)) flags.push(param);
        else arg.push(param);
        return { arg, flags };
      },
      { arg: [], flags: [] }
    );

    return {
      directive,
      arg: params.arg.length ? params.arg.join(' ') : null,
      flags: params.flags,
      raw: message,
    };
  }

  async handle(command: string | ParsedCommand) {
    if (typeof command === 'string') command = this.parse(command);

    console.debug('Handling command:', command);

    if (!Object.prototype.hasOwnProperty.call(REGISTRY, command.directive))
      return this.connection.reply(
        502,
        `Command not allowed: ${command.directive}`
      );

    if (this.blacklist.includes(command.directive))
      return this.connection.reply(
        502,
        `Command blacklisted: ${command.directive}`
      );

    if (
      this.whitelist.length > 0 &&
      !this.whitelist.includes(command.directive)
    )
      return this.connection.reply(
        502,
        `Command not whitelisted: ${command.directive}`
      );

    const commandRegister = REGISTRY[command.directive];
    if (!commandRegister)
      return this.connection.reply(
        502,
        `Command not registered: ${command.directive}`
      );

    const commandFlags =
      commandRegister && commandRegister.flags ? commandRegister.flags : {};
    if (!commandFlags.no_auth && !this.connection.authenticated)
      return this.connection.reply(
        530,
        `Command requires authentication: ${command.directive}`
      );

    if (!commandRegister.handler)
      return this.connection.reply(
        502,
        `Handler not set on command: ${command.directive}`
      );

    const handler = commandRegister.handler.bind(this.connection);
    return Promise.resolve(
      handler({ command, previousCommand: this.previousCommand }).then(() => {
        this.previousCommand = { ...command };
      })
    );
  }
}
