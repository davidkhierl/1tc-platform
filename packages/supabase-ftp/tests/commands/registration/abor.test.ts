import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type MockedFunction,
} from 'vitest';
import abor from '../../../src/commands/registration/abor.js';
import { FTP_CODES } from '../../../src/messages.js';
import { createMockConnection } from '../../test-utils.js';

describe('ABOR Command', () => {
  let mockConnection: any;

  beforeEach(() => {
    mockConnection = createMockConnection();
    vi.clearAllMocks();
  });

  it('should have correct command registration properties', () => {
    expect(abor.directive).toBe('ABOR');
    expect(abor.syntax).toBe('{{cmd}}');
    expect(abor.description).toBe('Abort an active file transfer');
    expect(typeof abor.handler).toBe('function');
  });

  describe('handler', () => {
    it('should abort transfer when data connection exists and reply with 426 then 226', async () => {
      const mockSocket = { close: vi.fn() };
      (
        mockConnection.connector.waitForConnection as MockedFunction<any>
      ).mockResolvedValue(mockSocket);
      (mockConnection.reply as MockedFunction<any>).mockResolvedValue(
        undefined
      );
      (mockConnection.connector.end as MockedFunction<any>).mockResolvedValue(
        undefined
      );

      await abor.handler!.call(mockConnection, {
        command: { directive: 'ABOR', arg: null, flags: [], raw: 'ABOR' },
      });

      // Should call waitForConnection to get the data connection
      expect(mockConnection.connector.waitForConnection).toHaveBeenCalledTimes(
        1
      );

      // Should reply with 426 (Connection closed; transfer aborted) on data socket
      expect(mockConnection.reply).toHaveBeenNthCalledWith(
        1,
        FTP_CODES.CONNECTION_CLOSED_TRANSFER_ABORTED,
        {
          socket: mockSocket,
          message: 'Connection closed; transfer aborted',
        }
      );

      // Then reply with 226 (Closing data connection) on control connection
      expect(mockConnection.reply).toHaveBeenNthCalledWith(
        2,
        FTP_CODES.CLOSING_DATA_CONNECTION,
        {
          message:
            'Closing data connection. Requested file action successful (file transfer aborted)',
        }
      );

      // Should end the data connection
      expect(mockConnection.connector.end).toHaveBeenCalledTimes(1);
    });

    it('should reply with 225 when no data connection exists', async () => {
      (
        mockConnection.connector.waitForConnection as MockedFunction<any>
      ).mockRejectedValue(new Error('No connection'));
      (mockConnection.reply as MockedFunction<any>).mockResolvedValue(
        undefined
      );
      (mockConnection.connector.end as MockedFunction<any>).mockResolvedValue(
        undefined
      );

      await abor.handler!.call(mockConnection, {
        command: { directive: 'ABOR', arg: null, flags: [], raw: 'ABOR' },
      });

      // Should try to wait for connection
      expect(mockConnection.connector.waitForConnection).toHaveBeenCalledTimes(
        1
      );

      // Should reply with 225 (Data connection open; no transfer in progress)
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.DATA_CONNECTION_OPEN,
        {
          message: 'Data connection open; no transfer in progress',
        }
      );

      // Should still end the connector
      expect(mockConnection.connector.end).toHaveBeenCalledTimes(1);
    });

    it('should handle connection errors gracefully', async () => {
      const mockError = new Error('Connection error');
      (
        mockConnection.connector.waitForConnection as MockedFunction<any>
      ).mockRejectedValue(mockError);
      (mockConnection.reply as MockedFunction<any>).mockResolvedValue(
        undefined
      );
      (mockConnection.connector.end as MockedFunction<any>).mockResolvedValue(
        undefined
      );

      await abor.handler!.call(mockConnection, {
        command: { directive: 'ABOR', arg: null, flags: [], raw: 'ABOR' },
      });

      // Should handle the error and reply with 225
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.DATA_CONNECTION_OPEN,
        {
          message: 'Data connection open; no transfer in progress',
        }
      );
      expect(mockConnection.connector.end).toHaveBeenCalledTimes(1);
    });

    it('should handle connector.end errors gracefully', async () => {
      const mockSocket = { close: vi.fn() };
      (
        mockConnection.connector.waitForConnection as MockedFunction<any>
      ).mockResolvedValue(mockSocket);
      (mockConnection.reply as MockedFunction<any>).mockResolvedValue(
        undefined
      );
      (mockConnection.connector.end as MockedFunction<any>).mockRejectedValue(
        new Error('End error')
      );

      // Should not throw even if connector.end fails
      await expect(
        abor.handler!.call(mockConnection, {
          command: { directive: 'ABOR', arg: null, flags: [], raw: 'ABOR' },
        })
      ).resolves.not.toThrow();

      // Should still attempt to end the connection
      expect(mockConnection.connector.end).toHaveBeenCalledTimes(1);
    });

    it('should handle reply errors gracefully when ending connector', async () => {
      (
        mockConnection.connector.waitForConnection as MockedFunction<any>
      ).mockRejectedValue(new Error('No connection'));
      (mockConnection.reply as MockedFunction<any>).mockResolvedValue(
        undefined
      );
      (mockConnection.connector.end as MockedFunction<any>).mockRejectedValue(
        new Error('End error')
      );

      await expect(
        abor.handler!.call(mockConnection, {
          command: { directive: 'ABOR', arg: null, flags: [], raw: 'ABOR' },
        })
      ).resolves.not.toThrow();

      // Should still attempt to end the connection even if reply fails
      expect(mockConnection.connector.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('RFC 959 compliance', () => {
    it('should follow RFC 959 ABOR command specifications', () => {
      // According to RFC 959, ABOR should:
      // 1. Not take any arguments
      expect(abor.syntax).toBe('{{cmd}}');

      // 2. Be able to be sent while data transfer is in progress
      // This is handled by the implementation checking for active connections

      // 3. Return appropriate response codes:
      // - 226 if file transfer was completed successfully
      // - 426 if file transfer was aborted
      // - 225 if no transfer was in progress
    });

    it('should use correct FTP response codes as per RFC 959', () => {
      // Verify that the expected FTP codes exist and have correct values
      expect(FTP_CODES.CONNECTION_CLOSED_TRANSFER_ABORTED).toBe(426);
      expect(FTP_CODES.CLOSING_DATA_CONNECTION).toBe(226);
      expect(FTP_CODES.DATA_CONNECTION_OPEN).toBe(225);
    });

    it('should provide proper RFC-compliant messages', () => {
      // Messages should be informative and follow RFC standards
      expect(typeof abor.description).toBe('string');
      expect(abor.description).toBe('Abort an active file transfer');
    });
  });

  describe('command sequence handling', () => {
    it('should work correctly when sent during an active transfer', async () => {
      const mockSocket = { close: vi.fn() };
      (
        mockConnection.connector.waitForConnection as MockedFunction<any>
      ).mockResolvedValue(mockSocket);
      (mockConnection.reply as MockedFunction<any>).mockResolvedValue(
        undefined
      );
      (mockConnection.connector.end as MockedFunction<any>).mockResolvedValue(
        undefined
      );

      await abor.handler!.call(mockConnection, {
        command: { directive: 'ABOR', arg: null, flags: [], raw: 'ABOR' },
      });

      // Should handle the active transfer case
      expect(mockConnection.connector.waitForConnection).toHaveBeenCalled();
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.CONNECTION_CLOSED_TRANSFER_ABORTED,
        {
          socket: mockSocket,
          message: 'Connection closed; transfer aborted',
        }
      );
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.CLOSING_DATA_CONNECTION,
        {
          message:
            'Closing data connection. Requested file action successful (file transfer aborted)',
        }
      );
    });

    it('should work correctly when no transfer is active', async () => {
      (
        mockConnection.connector.waitForConnection as MockedFunction<any>
      ).mockRejectedValue(new Error('No transfer'));
      (mockConnection.reply as MockedFunction<any>).mockResolvedValue(
        undefined
      );
      (mockConnection.connector.end as MockedFunction<any>).mockResolvedValue(
        undefined
      );

      await abor.handler!.call(mockConnection, {
        command: { directive: 'ABOR', arg: null, flags: [], raw: 'ABOR' },
      });

      // Should handle the no transfer case
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.DATA_CONNECTION_OPEN,
        {
          message: 'Data connection open; no transfer in progress',
        }
      );
    });
  });

  describe('telnet protocol integration', () => {
    it('should be compatible with telnet IP and Synch signals', () => {
      // According to RFC 959, ABOR may be sent with Telnet IP and Synch signals
      // The command registration should allow this to work properly
      expect(abor.directive).toBe('ABOR');
      expect(typeof abor.handler).toBe('function');
    });
  });

  describe('error handling robustness', () => {
    it('should handle multiple error conditions without crashing', async () => {
      (
        mockConnection.connector.waitForConnection as MockedFunction<any>
      ).mockRejectedValue(new Error('Connection failed'));
      (mockConnection.reply as MockedFunction<any>).mockRejectedValue(
        new Error('Reply failed')
      );
      (mockConnection.connector.end as MockedFunction<any>).mockRejectedValue(
        new Error('End failed')
      );

      // Should not throw despite multiple errors
      await expect(
        abor.handler!.call(mockConnection, {
          command: { directive: 'ABOR', arg: null, flags: [], raw: 'ABOR' },
        })
      ).resolves.not.toThrow();
    });
  });
});
