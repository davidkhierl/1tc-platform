import { ParsedCommand } from "./commands.js";
import { Connection } from "../connection.js";
import user from "./registration/user.js";
import { setHelpRegistry } from "./registration/help.js";

export interface CommandFlags {
  no_auth?: boolean;
  feat?: string;
  obsolete?: boolean;
}

export interface CommandRegistry {
  directive: string;
  arg?: string | null;
  flags?: CommandFlags;
  raw?: string;
  syntax: string;
  description: string;
  handler?: (
    this: Connection,
    args: { command: ParsedCommand; previousCommand?: ParsedCommand }
  ) => Promise<any>;
}

const commands = [user];

const registry = commands.reduce<Record<string, CommandRegistry>>(
  (result, cmd) => {
    const aliases = Array.isArray(cmd.directive)
      ? cmd.directive
      : [cmd.directive];
    aliases.forEach((alias) => (result[alias] = cmd));
    return result;
  },
  {}
);

setHelpRegistry(registry);

export default registry;
