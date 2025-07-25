import PassiveConnector from '../../connector/passive.js';
import { GeneralError } from '../../errors.js';
import { CommandRegistry } from '../registry.js';

const epsv: CommandRegistry = {
  directive: 'EPSV',
  handler: async function () {
    this.connector = new PassiveConnector(this);
    return this.connector
      .setupServer()
      .then(server => {
        const addr = server.address();
        if (!addr || typeof addr !== 'object' || !('port' in addr)) {
          throw new GeneralError('Failed to get server address', 425);
        }
        return this.reply(229, `EPSV OK (|||${addr.port}|)`);
      })
      .catch(err => {
        console.log('EPSV connection error:', err);
        return this.reply(err.code || 425, err.message);
      });
  },
  syntax: '{{cmd}} [<protocol>]',
  description: 'Initiate passive mode',
  flags: {
    feat: 'EPSV',
  },
};

export default epsv;
