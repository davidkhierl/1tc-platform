import { CommandRegistry } from '../registry.js';
import { FTP_CODES } from '../../messages.js';

/**
 * ABOR Command - RFC 959 Compliant
 *
 * The ABOR command tells the server to abort the previous FTP service command
 * and any associated transfer of data. The abort command may require "special action",
 * as discussed in the Section on FTP Commands, to force recognition by the server.
 *
 * No action is to be taken if the previous command has been completed (including
 * data transfer). The control connection is not to be closed by the server, but
 * the data connection must be closed.
 *
 * RFC 959 Response Codes:
 * - 225: Data connection open; no transfer in progress
 * - 226: Closing data connection. Requested file action successful
 * - 426: Connection closed; transfer aborted
 */
const abor: CommandRegistry = {
  directive: 'ABOR',
  handler: async function () {
    try {
      // Try to get the active data connection
      const socket = await this.connector.waitForConnection();

      // If we have an active data connection, abort the transfer
      // RFC 959: Reply with 426 on the data connection, then 226 on control connection
      try {
        await this.reply(FTP_CODES.CONNECTION_CLOSED_TRANSFER_ABORTED, {
          socket,
          message: 'Connection closed; transfer aborted',
        });
      } catch (replyError) {
        console.debug(
          'ABOR: Error sending 426 response on data connection:',
          replyError
        );
      }

      // Follow up with success on control connection
      try {
        await this.reply(FTP_CODES.CLOSING_DATA_CONNECTION, {
          message:
            'Closing data connection. Requested file action successful (file transfer aborted)',
        });
      } catch (replyError) {
        console.debug(
          'ABOR: Error sending 226 response on control connection:',
          replyError
        );
      }
    } catch (error) {
      // No active data connection or connection error
      // RFC 959: Reply with 225 if no transfer was in progress
      try {
        await this.reply(FTP_CODES.DATA_CONNECTION_OPEN, {
          message: 'Data connection open; no transfer in progress',
        });
      } catch (replyError) {
        console.debug('ABOR: Error sending 225 response:', replyError);
      }
    } finally {
      try {
        this.connector.end();
      } catch (endError) {
        console.debug('ABOR: Error ending connector:', endError);
      }
    }
  },
  syntax: '{{cmd}}',
  description: 'Abort an active file transfer',
};

export default abor;
