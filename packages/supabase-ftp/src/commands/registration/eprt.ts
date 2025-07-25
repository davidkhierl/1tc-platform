import ActiveConnector from '../../connector/active.js';
import { CommandRegistry } from '../registry.js';

const FAMILY: Record<string, number> = {
  '1': 4,
  '2': 6,
};

const eprt: CommandRegistry = {
  directive: 'EPRT',
  handler: async function ({ command }) {
    const arg = command?.arg || '';

    if (!arg.startsWith('|') || !arg.endsWith('|')) {
      return this.reply(501, 'Invalid EPRT format');
    }

    const parts = arg.split('|');
    if (parts.length !== 5) {
      return this.reply(501, 'Invalid EPRT format');
    }

    const [, protocol, ip, portStr] = parts;

    if (!protocol || !ip || !portStr) {
      return this.reply(501, 'Invalid EPRT format');
    }

    const family = FAMILY[protocol];
    if (!family) {
      return this.reply(522, 'Network protocol not supported');
    }

    const portNum = parseInt(portStr, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return this.reply(501, 'Invalid port number');
    }

    this.connector = new ActiveConnector(this);
    return (this.connector as ActiveConnector)
      .setupConnection(ip.trim(), portNum, family)
      .then(() => this.reply(200, 'EPRT command successful'))
      .catch(err => {
        console.error('EPRT connection error:', err);
        return this.reply(425, "Can't open data connection");
      });
  },
  syntax: '{{cmd}} |<protocol>|<address>|<port>|',
  description:
    'Specifies an extended address and port to which the server should connect',
};

export default eprt;
