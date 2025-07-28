import { CommandRegistry } from '../registry.js';
import { FTP_CODES } from '../../messages.js';

const allo: CommandRegistry = {
  directive: 'ALLO',
  handler: function () {
    return this.reply(FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS);
  },
  syntax: '{{cmd}}',
  description: 'Allocate sufficient disk space to receive a file',
  flags: {
    obsolete: true,
  },
};

export default allo;
