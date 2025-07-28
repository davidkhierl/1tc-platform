import PassiveConnector from '../../connector/passive.js';
import { ConnectionError } from '../../errors.js';
import { CommandRegistry } from '../registry.js';
import { FTP_CODES } from '../../messages.js';

const epsv: CommandRegistry = {
  directive: 'EPSV',
  handler: async function () {
    this.connector = new PassiveConnector(this);
    return this.connector
      .setupServer()
      .then(server => {
        const addr = server.address();
        if (!addr || typeof addr !== 'object' || !('port' in addr)) {
          throw new ConnectionError('Failed to get server address');
        }
        return this.reply(
          FTP_CODES.ENTERING_EXTENDED_PASSIVE_MODE,
          `EPSV OK (|||${addr.port}|)`
        );
      })
      .catch(err => {
        console.log('EPSV connection error:', err);
        return this.reply(
          err.code || FTP_CODES.CANT_OPEN_DATA_CONNECTION,
          err.message
        );
      });
  },
  syntax: '{{cmd}} [<protocol>]',
  description: 'Initiate passive mode',
  flags: {
    feat: 'EPSV',
  },
};

export default epsv;
