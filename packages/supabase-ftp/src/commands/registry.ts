import { ParsedCommand } from "./commands.js";
import { Connection } from "../connection.js";
import user from "./registration/user.js";
import help, { setHelpRegistry } from "./registration/help.js";
import syst from "./registration/syst.js";
import feat from "./registration/feat.js";
import pwd from "./registration/pwd.js";
import tType from "./registration/type.js";
import pasv from "./registration/pasv.js";
import list from "./registration/list.js";
import nlst from "./registration/nlst.js";
import cwd from "./registration/cwd.js";
import rest from "./registration/rest.js";
import opts from "./registration/opts.js";
import retr from "./registration/retr.js";
import stor from "./registration/stor.js";
import dele from "./registration/dele.js";
import mkd from "./registration/mkd.js";
import rmd from "./registration/rmd.js";

export interface CommandFlags {
  no_auth?: boolean;
  feat?: string;
  obsolete?: boolean;
}

export interface CommandRegistry<T = any> {
  directive: string | string[];
  arg?: string | null;
  flags?: CommandFlags;
  raw?: string;
  syntax: string;
  description: string;
  handler?: (
    this: Connection,
    args: { command: ParsedCommand; previousCommand?: ParsedCommand }
  ) => Promise<T> | T;
}

const commands: CommandRegistry[] = [
  cwd,
  dele,
  feat,
  help,
  list,
  mkd,
  nlst,
  opts,
  pasv,
  pwd,
  rest,
  retr,
  rmd,
  stor,
  syst,
  tType,
  user,
];

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
