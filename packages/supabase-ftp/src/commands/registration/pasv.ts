import PassiveConnector from '../../connector/passive.js';
import { ConnectionError } from '../../errors.js';
import { CommandRegistry } from '../registry.js';
import { FTP_CODES } from '../../messages.js';

const pasv: CommandRegistry = {
  directive: 'PASV',
  handler: async function () {
    if (!this.server.options.passiveHostname) {
      return this.reply(FTP_CODES.COMMAND_NOT_IMPLEMENTED);
    }

    this.connector = new PassiveConnector(this);
    return this.connector
      .setupServer()
      .then(server => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          throw new ConnectionError('Failed to get server address');
        }
        const port = address.port;
        let pasvAddress = this.server.options.passiveHostname;
        if (!pasvAddress) throw new ConnectionError('Passive hostname not set');
        if (typeof pasvAddress === 'function') {
          return Promise.resolve()
            .then(() => pasvAddress(this.ip))
            .then(address => ({ address, port }));
        }
        return { address: pasvAddress, port };
      })
      .then(({ address, port }) => {
        const host = address.replace(/\./g, ',');
        const portByte1 = (port / 256) | 0;
        const portByte2 = port % 256;

        return this.reply(
          FTP_CODES.ENTERING_PASSIVE_MODE,
          `PASV OK (${host},${portByte1},${portByte2})`
        );
      })
      .catch((err: ConnectionError) => {
        console.error(err);
        return this.reply(
          err.code || FTP_CODES.CANT_OPEN_DATA_CONNECTION,
          err.message
        );
      });
  },
  syntax: '{{cmd}}',
  description: 'Initiate passive mode',
  flags: {
    feat: 'PASV',
  },
};

export default pasv;
