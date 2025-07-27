import { ParsedCommand } from './commands.js';
import { Connection } from '../connection.js';
import user from './registration/user.js';
import help, { setHelpRegistry } from './registration/help.js';
import syst from './registration/syst.js';
import feat from './registration/feat.js';
import pwd from './registration/pwd.js';
import tType from './registration/type.js';
import pasv from './registration/pasv.js';
import list from './registration/list.js';
import nlst from './registration/nlst.js';
import cwd from './registration/cwd.js';
import rest from './registration/rest.js';
import opts from './registration/opts.js';
import retr from './registration/retr.js';
import stor from './registration/stor.js';
import dele from './registration/dele.js';
import mkd from './registration/mkd.js';
import rmd from './registration/rmd.js';
import abor from './registration/abor.js';
import allo from './registration/allo.js';
import auth from './registration/auth.js';
import eprt from './registration/eprt.js';
import port from './registration/port.js';
import epsv from './registration/epsv.js';
import appe from './registration/appe.js';
import cdup from './registration/cdup.js';
import mode from './registration/mode.js';
import noop from './registration/noop.js';
import pass from './registration/pass.js';
import pbsz from './registration/pbsz.js';
import prot from './registration/prot.js';
import quit from './registration/quit.js';
import rnfr from './registration/rnfr.js';
import rnto from './registration/rnto.js';
import size from './registration/size.js';
import stat from './registration/stat.js';
import stou from './registration/stou.js';
import stru from './registration/stru.js';
import site from './registration/site/site.js';
import mdtm from './registration/mdtm.js';
import mlsd from './registration/mlsd.js';
import mlst from './registration/mlst.js';

export interface CommandFlags {
  no_auth?: boolean;
  feat?: string;
  obsolete?: boolean;
}

export type CommandRegistryHandler<T = any> = (
  this: Connection,
  args: { command: ParsedCommand; previousCommand?: ParsedCommand }
) => Promise<T> | T;

export interface CommandRegistry<T = any> {
  directive: string | string[];
  arg?: string | null;
  flags?: CommandFlags;
  raw?: string;
  syntax: string;
  description: string;
  handler?: CommandRegistryHandler<T>;
}

const commands: CommandRegistry[] = [
  abor,
  allo,
  appe,
  auth,
  cdup,
  cwd,
  dele,
  eprt,
  epsv,
  feat,
  help,
  list,
  mdtm,
  mkd,
  mlsd,
  mlst,
  mode,
  nlst,
  noop,
  opts,
  pass,
  pasv,
  pbsz,
  port,
  prot,
  pwd,
  quit,
  rest,
  retr,
  rmd,
  rnfr,
  rnto,
  site,
  size,
  stat,
  stor,
  stou,
  stru,
  syst,
  tType,
  user,
];

const registry = commands.reduce<Record<string, CommandRegistry>>(
  (result, cmd) => {
    const aliases = Array.isArray(cmd.directive)
      ? cmd.directive
      : [cmd.directive];
    aliases.forEach(alias => (result[alias] = cmd));
    return result;
  },
  {}
);

setHelpRegistry(registry);

export default registry;
