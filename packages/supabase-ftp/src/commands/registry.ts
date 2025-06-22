import { ParsedCommand } from "./commands.js";
import { Connection } from "../connection.js";
import user from "./registration/user.js";
import help, { setHelpRegistry } from "./registration/help.js";
import syst from "./registration/syst.js";
import feat from "./registration/feat.js";
import pwd from "./registration/pwd.js";
import tType from "./registration/type.js";
import pasv from "./registration/pasv.js";

export interface CommandFlags {
  no_auth?: boolean;
  feat?: string;
  obsolete?: boolean;
}

export interface CommandRegistry {
  directive: string | string[];
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

const commands: CommandRegistry[] = [feat, help, pasv, pwd, syst, tType, user];

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
