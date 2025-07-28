import { Connection } from '../../connection.js';
import { CommandRegistry } from '../registry.js';

const OPTIONS = {
  UTF8: utf8,
  'UTF-8': utf8,
  LIST: listOpts,
};

const opts: CommandRegistry = {
  directive: 'OPTS',
  handler: function ({ command }) {
    if (!command || !command.arg) return this.reply(501);

    const [_option, ...args] = command.arg.split(' ');
    const option = _option ? _option.toUpperCase() : '';

    if (!Object.prototype.hasOwnProperty.call(OPTIONS, option))
      return this.reply(501, 'Unknown option command');

    if (option === 'LIST') {
      const allArgs = [...args, ...(command.flags || [])];
      return OPTIONS[option].call(this, allArgs);
    }

    return (OPTIONS as any)[option].call(this, args);
  },
  syntax: '{{cmd}}',
  description: 'Select options for a feature',
  flags: {
    feat: 'UTF8',
  },
};

function utf8(this: Connection, [setting]: string[] = []) {
  const getEncoding = () => {
    switch ((setting || '').toUpperCase()) {
      case 'ON':
        return 'utf8';
      case 'OFF':
        return 'ascii';
      default:
        return null;
    }
  };

  const encoding = getEncoding();
  if (!encoding) return this.reply(501, 'Unknown setting for option');

  this.encoding = encoding;

  return this.reply(200, `UTF8 encoding ${(setting || '').toLowerCase()}`);
}

function listOpts(this: Connection, [setting]: string[] = []) {
  const option = (setting || '').toUpperCase();

  switch (option) {
    case '-E':
      this.listFormat = 'ep';
      return this.reply(200, 'EPLF format enabled');
    case '-L':
      this.listFormat = 'ls';
      return this.reply(200, 'Standard format enabled');
    default:
      return this.reply(501, 'Unknown LIST option');
  }
}

export default opts;
