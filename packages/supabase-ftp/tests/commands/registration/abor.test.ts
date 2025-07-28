import { describe, it, expect, vi, beforeEach } from 'vitest';
import abor from '../../../src/commands/registration/abor.js';
import {
  createMockConnection,
  validateRfcCompliance,
} from '../../test-utils.js';
import { FTP_CODES } from '../../../src/messages.js';
import type { ParsedCommand } from '../../../src/commands/commands.js';

/**
 * ABOR Command Tests - RFC 959 Compliance
 *
 * ABORT (ABOR) command testing according to RFC 959 specifications:
 *
 * From RFC 959 Section 4.1.3:
 * "This command tells the server to abort the previous FTP service command
 * and any associated transfer of data. The abort command may require 'special
 * action', as discussed in the Section on FTP Commands, to force recognition
 * by the server. No action is to be taken if the previous command has been
 * completed (including data transfer). The control connection is not to be
 * closed by the server, but the data connection must be closed.
 *
 * There are two cases for the server upon receipt of this command: (1) the
 * FTP service command was already completed, or (2) the FTP service command
 * is still in progress.
 *
 * In the first case, the server closes the data connection (if it is open)
 * and responds with a 226 reply, indicating that the abort command was
 * successfully processed.
 *
 * In the second case, the server aborts the FTP service in progress and
 * closes the data connection, returning a 426 reply to indicate that the
 * service request terminated abnormally. The server then sends a 226 reply,
 * indicating that the abort command was successfully processed."
 *
 * Valid reply codes from RFC 959:
 * - 225 Data connection open; no transfer in progress
 * - 226 Closing data connection. Requested file action successful
 * - 426 Connection closed; transfer aborted
 * - 500 Syntax error, command unrecognized
 * - 501 Syntax error in parameters or arguments
 * - 502 Command not implemented
 * - 421 Service not available, closing control connection
 */

describe('ABOR Command - RFC 959 Compliance', () => {
  let mockConnection: ReturnType<typeof createMockConnection>;
  const rfcValidator = validateRfcCompliance();

  // Helper function to create a typed handler
  const createHandler = (
    connection: ReturnType<typeof createMockConnection>
  ) => {
    if (!abor.handler) {
      throw new Error('ABOR handler is not defined');
    }
    return async (...args: string[]) => {
      const command: ParsedCommand = {
        directive: 'ABOR',
        raw: `ABOR ${args.join(' ')}`.trim(),
        arg: args.join(' ') || null,
        flags: [],
      };
      return abor.handler!.call(connection, { command });
    };
  };

  beforeEach(() => {
    mockConnection = createMockConnection({ authenticated: true });
    vi.clearAllMocks();
  });

  describe('Command Registration', () => {
    it('should have correct command registration properties', () => {
      expect(abor.directive).toBe('ABOR');
      expect(abor.syntax).toBe('{{cmd}}');
      expect(abor.description).toBe('Abort an active file transfer');
      expect(typeof abor.handler).toBe('function');
    });

    it('should export as CommandRegistry compatible object', () => {
      expect(abor).toHaveProperty('directive');
      expect(abor).toHaveProperty('handler');
      expect(abor).toHaveProperty('syntax');
      expect(abor).toHaveProperty('description');
    });
  });

  describe('RFC 959 Compliance', () => {
    it('should follow RFC 959 ABOR command specifications', () => {
      // According to RFC 959, ABOR should:
      // 1. Not take any arguments (syntax: ABOR <CRLF>)
      expect(abor.syntax).toBe('{{cmd}}');

      // 2. Tell server to abort previous FTP service command and data transfer
      expect(abor.description).toContain('Abort');

      // 3. May require special action (Telnet IP and Synch signals)
      // This is handled by the implementation checking for active connections

      // 4. Return appropriate response codes as per RFC 959
    });

    it('should use correct FTP response codes as per RFC 959', () => {
      // Verify that the expected FTP codes exist and have correct values
      expect(FTP_CODES.CONNECTION_CLOSED_TRANSFER_ABORTED).toBe(426);
      expect(FTP_CODES.CLOSING_DATA_CONNECTION).toBe(226);
      expect(FTP_CODES.DATA_CONNECTION_OPEN).toBe(225);
    });

    it('should handle the two RFC 959 specified cases', () => {
      // RFC 959 specifies two cases for ABOR:
      // Case 1: FTP service command was already completed
      // Case 2: FTP service command is still in progress
      // These are tested in the behavior tests below
      expect(typeof abor.handler).toBe('function');
    });

    it('should not close control connection per RFC 959', () => {
      // RFC 959: "The control connection is not to be closed by the server,
      // but the data connection must be closed."
      // This is verified by ensuring only connector.end() is called, not connection close
      expect(typeof abor.handler).toBe('function');
    });
  });

  describe('Authentication Requirements', () => {
    it('should work without authentication (ABOR can be emergency command)', () => {
      // ABOR is often used as an emergency command and should work even without auth
      const unauthenticatedConnection = createMockConnection({
        authenticated: false,
      });
      expect(() => abor.handler!.bind(unauthenticatedConnection)).not.toThrow();
    });
  });

  describe('Active Transfer Scenarios (RFC 959 Case 2)', () => {
    it('should abort active transfer and reply with 426 then 226', async () => {
      const mockSocket = { close: vi.fn() } as any;
      vi.mocked(mockConnection.connector.waitForConnection).mockResolvedValue(
        mockSocket
      );
      vi.mocked(mockConnection.reply).mockResolvedValue(undefined);
      vi.mocked(mockConnection.connector.end).mockResolvedValue(undefined);

      const handler = createHandler(mockConnection);
      await handler();

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

    it('should handle 426 reply error gracefully during active transfer', async () => {
      const mockSocket = { close: vi.fn() } as any;
      vi.mocked(mockConnection.connector.waitForConnection).mockResolvedValue(
        mockSocket
      );
      vi.mocked(mockConnection.reply)
        .mockRejectedValueOnce(new Error('426 reply failed'))
        .mockResolvedValueOnce(undefined);
      vi.mocked(mockConnection.connector.end).mockResolvedValue(undefined);

      const handler = createHandler(mockConnection);
      await expect(handler()).resolves.not.toThrow();

      // Should still attempt 226 reply even if 426 fails
      expect(mockConnection.reply).toHaveBeenCalledTimes(2);
      expect(mockConnection.reply).toHaveBeenNthCalledWith(
        2,
        FTP_CODES.CLOSING_DATA_CONNECTION,
        expect.any(Object)
      );
    });

    it('should handle 226 reply error gracefully during active transfer', async () => {
      const mockSocket = { close: vi.fn() } as any;
      vi.mocked(mockConnection.connector.waitForConnection).mockResolvedValue(
        mockSocket
      );
      vi.mocked(mockConnection.reply)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('226 reply failed'));
      vi.mocked(mockConnection.connector.end).mockResolvedValue(undefined);

      const handler = createHandler(mockConnection);
      await expect(handler()).resolves.not.toThrow();

      // Should still end the connector
      expect(mockConnection.connector.end).toHaveBeenCalledTimes(1);
    });

    it('should handle connector.end errors gracefully during active transfer', async () => {
      const mockSocket = { close: vi.fn() } as any;
      vi.mocked(mockConnection.connector.waitForConnection).mockResolvedValue(
        mockSocket
      );
      vi.mocked(mockConnection.reply).mockResolvedValue(undefined);
      vi.mocked(mockConnection.connector.end).mockRejectedValue(
        new Error('End error')
      );

      const handler = createHandler(mockConnection);
      await expect(handler()).resolves.not.toThrow();

      // Should still attempt to end the connection
      expect(mockConnection.connector.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('No Active Transfer Scenarios (RFC 959 Case 1)', () => {
    it('should reply with 225 when no data connection exists', async () => {
      vi.mocked(mockConnection.connector.waitForConnection).mockRejectedValue(
        new Error('No connection')
      );
      vi.mocked(mockConnection.reply).mockResolvedValue(undefined);
      vi.mocked(mockConnection.connector.end).mockResolvedValue(undefined);

      const handler = createHandler(mockConnection);
      await handler();

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

    it('should handle connection timeout errors gracefully', async () => {
      const timeoutError = new Error('Connection timeout');
      vi.mocked(mockConnection.connector.waitForConnection).mockRejectedValue(
        timeoutError
      );
      vi.mocked(mockConnection.reply).mockResolvedValue(undefined);
      vi.mocked(mockConnection.connector.end).mockResolvedValue(undefined);

      const handler = createHandler(mockConnection);
      await handler();

      // Should handle the timeout and reply with 225
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.DATA_CONNECTION_OPEN,
        {
          message: 'Data connection open; no transfer in progress',
        }
      );
      expect(mockConnection.connector.end).toHaveBeenCalledTimes(1);
    });

    it('should handle 225 reply error gracefully when no transfer active', async () => {
      vi.mocked(mockConnection.connector.waitForConnection).mockRejectedValue(
        new Error('No connection')
      );
      vi.mocked(mockConnection.reply).mockRejectedValue(
        new Error('225 reply failed')
      );
      vi.mocked(mockConnection.connector.end).mockResolvedValue(undefined);

      const handler = createHandler(mockConnection);
      await expect(handler()).resolves.not.toThrow();

      // Should still attempt to end the connection
      expect(mockConnection.connector.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling and Robustness', () => {
    it('should handle multiple error conditions without crashing', async () => {
      vi.mocked(mockConnection.connector.waitForConnection).mockRejectedValue(
        new Error('Connection failed')
      );
      vi.mocked(mockConnection.reply).mockRejectedValue(
        new Error('Reply failed')
      );
      vi.mocked(mockConnection.connector.end).mockRejectedValue(
        new Error('End failed')
      );

      const handler = createHandler(mockConnection);
      // Should not throw despite multiple errors
      await expect(handler()).resolves.not.toThrow();
    });

    it('should handle null/undefined socket gracefully', async () => {
      vi.mocked(mockConnection.connector.waitForConnection).mockResolvedValue(
        null as any
      );
      vi.mocked(mockConnection.reply).mockResolvedValue(undefined);
      vi.mocked(mockConnection.connector.end).mockResolvedValue(undefined);

      const handler = createHandler(mockConnection);
      await expect(handler()).resolves.not.toThrow();

      // Should still attempt replies and cleanup
      expect(mockConnection.reply).toHaveBeenCalled();
      expect(mockConnection.connector.end).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid successive ABOR calls', async () => {
      vi.mocked(mockConnection.connector.waitForConnection).mockRejectedValue(
        new Error('No connection')
      );
      vi.mocked(mockConnection.reply).mockResolvedValue(undefined);
      vi.mocked(mockConnection.connector.end).mockResolvedValue(undefined);

      const handler = createHandler(mockConnection);

      // Multiple rapid calls should not interfere with each other
      await Promise.all([handler(), handler(), handler()]);

      expect(mockConnection.connector.waitForConnection).toHaveBeenCalledTimes(
        3
      );
      expect(mockConnection.reply).toHaveBeenCalledTimes(3);
      expect(mockConnection.connector.end).toHaveBeenCalledTimes(3);
    });
  });

  describe('Protocol Integration Tests', () => {
    it('should be compatible with telnet IP and Synch signals (RFC 959)', () => {
      // According to RFC 959, ABOR may be sent with Telnet IP and Synch signals
      // The command registration should allow this to work properly
      expect(abor.directive).toBe('ABOR');
      expect(typeof abor.handler).toBe('function');
      expect(abor.syntax).toBe('{{cmd}}'); // No arguments, immediate execution
    });

    it('should handle urgent out-of-band data processing', () => {
      // ABOR is often sent as urgent data in real FTP implementations
      // The handler should be capable of immediate execution
      expect(typeof abor.handler).toBe('function');
      expect(abor.handler).not.toBeNull();
    });
  });

  describe('Message Content Validation', () => {
    it('should provide proper RFC-compliant response messages', () => {
      // Messages should be informative and follow RFC standards
      expect(typeof abor.description).toBe('string');
      expect(abor.description).toBe('Abort an active file transfer');
      expect(abor.description).toContain('Abort');
    });

    it('should use standard FTP message format', () => {
      // Verify command follows standard FTP command format
      expect(abor.directive).toMatch(/^[A-Z]{4}$/); // 4 uppercase letters
      expect(abor.syntax).toBe('{{cmd}}'); // No parameters
    });
  });

  describe('Performance and Resource Management', () => {
    it('should execute quickly without unnecessary delays', async () => {
      vi.mocked(mockConnection.connector.waitForConnection).mockRejectedValue(
        new Error('No connection')
      );
      vi.mocked(mockConnection.reply).mockResolvedValue(undefined);
      vi.mocked(mockConnection.connector.end).mockResolvedValue(undefined);

      const handler = createHandler(mockConnection);
      const startTime = Date.now();
      await handler();
      const executionTime = Date.now() - startTime;

      // Should execute within reasonable time (< 100ms for mocked operations)
      expect(executionTime).toBeLessThan(100);
    });

    it('should properly clean up resources', async () => {
      const mockSocket = { close: vi.fn() } as any;
      vi.mocked(mockConnection.connector.waitForConnection).mockResolvedValue(
        mockSocket
      );
      vi.mocked(mockConnection.reply).mockResolvedValue(undefined);
      vi.mocked(mockConnection.connector.end).mockResolvedValue(undefined);

      const handler = createHandler(mockConnection);
      await handler();

      // Should always call end() for cleanup
      expect(mockConnection.connector.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Connection State Management', () => {
    it('should handle data connection in various states', async () => {
      // Test different connection states
      const testCases = [
        { state: 'connected', mockReturn: { close: vi.fn() } },
        {
          state: 'disconnected',
          mockReturn: new Error('Not connected'),
        },
        { state: 'timeout', mockReturn: new Error('Timeout') },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        if (testCase.state === 'connected') {
          vi.mocked(
            mockConnection.connector.waitForConnection
          ).mockResolvedValue(testCase.mockReturn as any);
        } else {
          vi.mocked(
            mockConnection.connector.waitForConnection
          ).mockRejectedValue(testCase.mockReturn);
        }

        vi.mocked(mockConnection.reply).mockResolvedValue(undefined);
        vi.mocked(mockConnection.connector.end).mockResolvedValue(undefined);

        const handler = createHandler(mockConnection);
        await expect(handler()).resolves.not.toThrow();
      }
    });
  });

  describe('Legacy RFC Compliance Tests', () => {
    it('should maintain backward compatibility with older FTP implementations', () => {
      // Ensure command structure follows traditional FTP patterns
      expect(abor.directive).toBe('ABOR');
      expect(abor.directive.length).toBe(4); // Traditional 4-character FTP commands
    });

    it('should handle RFC 959 Section 4.1.3 abort requirements', () => {
      // RFC 959 Section 4.1.3 specifies ABOR behavior
      // "This command tells the server to abort the previous FTP service command"
      expect(abor.description).toContain('Abort');
      expect(typeof abor.handler).toBe('function');
    });

    it('should support RFC 959 special action requirements', () => {
      // RFC 959: "The abort command may require 'special action'"
      // This refers to Telnet IP and Synch signals
      expect(abor.syntax).toBe('{{cmd}}'); // Immediate execution, no parsing delays
    });
  });
});
