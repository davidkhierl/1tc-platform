import { format, differenceInMonths, getUnixTime } from 'date-fns';
import { FileSystemError } from '../errors.js';
import { FileStats } from '../fs/fs.js';

const FORMATS = {
  ls,
  ep,
  mlsd,
};

export default function getFileStat(
  fileStat: FileStats,
  format: string | ((stat: FileStats) => string) = 'ls'
): string {
  if (typeof format === 'function') return format(fileStat);
  if (!Object.prototype.hasOwnProperty.call(FORMATS, format)) {
    throw new FileSystemError('Bad file stat formatter');
  }
  return FORMATS[format as keyof typeof FORMATS](fileStat);
}

function ls(fileStat: FileStats): string {
  const now = new Date();
  const mtime = new Date(fileStat.mtime);
  const timeDiff = differenceInMonths(now, mtime);
  const dateFormat = timeDiff < 6 ? 'MMM dd HH:mm' : 'MMM dd  yyyy';

  return [
    fileStat.mode
      ? [
          fileStat.isDirectory() ? 'd' : '-',
          fileStat.mode & 256 ? 'r' : '-',
          fileStat.mode & 128 ? 'w' : '-',
          fileStat.mode & 64 ? 'x' : '-',
          fileStat.mode & 32 ? 'r' : '-',
          fileStat.mode & 16 ? 'w' : '-',
          fileStat.mode & 8 ? 'x' : '-',
          fileStat.mode & 4 ? 'r' : '-',
          fileStat.mode & 2 ? 'w' : '-',
          fileStat.mode & 1 ? 'x' : '-',
        ].join('')
      : fileStat.isDirectory()
        ? 'drwxr-xr-x'
        : '-rwxr-xr-x',
    '1',
    '1', // uid - default to 1 for Supabase
    '1', // gid - default to 1 for Supabase
    String(fileStat.size || 0).padStart(12),
    String(format(mtime, dateFormat)).padStart(12),
    fileStat.name,
  ].join(' ');
}

function ep(fileStat: FileStats): string {
  const mtime = new Date(fileStat.mtime);
  const unixTimestamp = getUnixTime(mtime);

  const facts = [
    `s${fileStat.size || 0}`,
    `m${unixTimestamp}`,
    fileStat.mode ? `up${(fileStat.mode & 4095).toString(8)}` : 'up644',
    fileStat.isDirectory() ? '/' : 'r',
  ]
    .filter(Boolean)
    .join(',');
  return `+${facts}\t${fileStat.name}`;
}

function mlsd(fileStat: FileStats): string {
  const mtime = new Date(fileStat.mtime);

  const facts: string[] = [];

  if (fileStat.isDirectory()) {
    facts.push('Type=dir');
  } else {
    facts.push('Type=file');
  }

  if (fileStat.isFile()) {
    facts.push(`Size=${fileStat.size || 0}`);
  }

  const modifyTime = mtime
    .toISOString()
    .replace(/[-:T]/g, '')
    .replace(/\.\d{3}Z$/, '');
  facts.push(`Modify=${modifyTime}`);

  let perm = '';
  if (fileStat.isDirectory()) {
    // Directory permissions
    perm += 'e'; // enter (cd into directory)
    perm += 'l'; // list (read directory contents)
    if (fileStat.mode && fileStat.mode & 0o200) {
      perm += 'c'; // create files in directory
      perm += 'm'; // make subdirectories
      perm += 'd'; // delete files in directory
      perm += 'f'; // rename files in directory
      perm += 'p'; // purge (delete directory and contents)
    }
  } else {
    // File permissions
    if (fileStat.mode && fileStat.mode & 0o400) {
      perm += 'r'; // read file
    }
    if (fileStat.mode && fileStat.mode & 0o200) {
      perm += 'a'; // append to file
      perm += 'w'; // write file
      perm += 'd'; // delete file
      perm += 'f'; // rename file
    }
  }
  facts.push(`Perm=${perm}`);

  const factsString = facts.join(';');

  return `${factsString}; ${fileStat.name}`;
}
