import REGISTRY from './registry.js';
import { Connection } from '../connection.js';
import { CommandError } from '../errors.js';
import { FTP_CODES } from '../messages.js';

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
    // Input validation and sanitization
    if (!message || message.length > 512) {
      throw new CommandError('Invalid command length');
    }

    // Remove dangerous characters and normalize
    const sanitizedMessage = message
      .replace(/[^\x20-\x7E\r\n]/g, '') // Remove non-printable chars
      .replace(/"/g, '')
      .trim();

    if (!sanitizedMessage) {
      throw new CommandError('Empty command');
    }

    let [directive, ...args] = sanitizedMessage.split(' ');
    directive = directive?.trim().toUpperCase();

    if (!directive || directive.length > 4) {
      throw new CommandError('Invalid command directive');
    }

    // Validate directive contains only letters
    if (!/^[A-Z]+$/.test(directive)) {
      throw new CommandError('Invalid command format');
    }

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
      raw: sanitizedMessage,
    };
  }

  async handle(command: string | ParsedCommand) {
    if (typeof command === 'string') command = this.parse(command);

    console.debug('Handling command:', command);

    if (!Object.prototype.hasOwnProperty.call(REGISTRY, command.directive))
      return this.connection.reply(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED,
        `Command not allowed: ${command.directive}`
      );

    if (this.blacklist.includes(command.directive))
      return this.connection.reply(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED,
        `Command blacklisted: ${command.directive}`
      );

    if (
      this.whitelist.length > 0 &&
      !this.whitelist.includes(command.directive)
    )
      return this.connection.reply(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED,
        `Command not whitelisted: ${command.directive}`
      );

    const commandRegister = REGISTRY[command.directive];
    if (!commandRegister)
      return this.connection.reply(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED,
        `Command not registered: ${command.directive}`
      );

    const commandFlags =
      commandRegister && commandRegister.flags ? commandRegister.flags : {};
    if (!commandFlags.no_auth && !this.connection.authenticated)
      return this.connection.reply(
        FTP_CODES.NOT_LOGGED_IN,
        `Command requires authentication: ${command.directive}`
      );

    if (!commandRegister.handler)
      return this.connection.reply(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED,
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
