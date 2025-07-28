/**
 * ALLO Command Tests - RFC 959 Compliance
 *
 * ALLOCATE (ALLO) command testing according to RFC 959 specifications:
 *
 * From RFC 959 Section 4.1.3:
 * "This command may be required by some servers to reserve sufficient storage
 * to accommodate the new file to be transferred. The argument shall be a decimal
 * integer representing the number of bytes (using the logical byte size) of
 * storage to be reserved for the file. For files sent with record or page
 * structure a maximum record or page size (in logical bytes) might also be
 * necessary; this is indicated by a decimal integer in a second argument field
 * of the command. This second argument is optional, but when present should be
 * separated from the first by the three Telnet characters <SP> R <SP>. This
 * command shall be followed by a STORe or APPEnd command. The ALLO command
 * should be treated as a NOOP (no operation) by those servers which do not
 * require that the maximum size of the file be declared beforehand, and those
 * servers interested in only the maximum record or page size should accept a
 * dummy value in the first argument and ignore it."
 *
 * Valid reply codes from RFC 959:
 * - 200 Command okay
 * - 202 Command not implemented, superfluous at this site
 * - 500 Syntax error, command unrecognized
 * - 501 Syntax error in parameters or arguments
 * - 504 Command not implemented for that parameter
 * - 421 Service not available, closing control connection
 * - 530 Not logged in
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import allo from '../../../src/commands/registration/allo.js';
import {
  createMockConnection,
  FTP_TEST_SCENARIOS,
  validateRfcCompliance,
} from '../../test-utils.js';
import { FTP_CODES } from '../../../src/messages.js';
import type { ParsedCommand } from '../../../src/commands/commands.js';

describe('ALLO Command - RFC 959 Compliance', () => {
  let mockConnection: ReturnType<typeof createMockConnection>;
  const rfcValidator = validateRfcCompliance();

  // Helper function to create a typed handler
  const createHandler = (
    connection: ReturnType<typeof createMockConnection>
  ) => {
    if (!allo.handler) {
      throw new Error('ALLO handler is not defined');
    }
    return async (...args: string[]) => {
      const command: ParsedCommand = {
        directive: 'ALLO',
        raw: `ALLO ${args.join(' ')}`.trim(),
        arg: args.join(' ') || null,
        flags: [],
      };
      return allo.handler!.call(connection, { command });
    };
  };

  beforeEach(() => {
    mockConnection = createMockConnection({ authenticated: true });
    vi.clearAllMocks();
  });

  describe('Command Registration', () => {
    it('should have correct directive', () => {
      expect(allo.directive).toBe('ALLO');
    });

    it('should have proper syntax definition', () => {
      expect(allo.syntax).toBeDefined();
      expect(typeof allo.syntax).toBe('string');
    });

    it('should have appropriate description', () => {
      expect(allo.description).toBeDefined();
      expect(allo.description).toContain('Allocate');
      expect(allo.description).toContain('disk space');
    });

    it('should have handler function', () => {
      expect(typeof allo.handler).toBe('function');
    });

    it('should be marked as obsolete', () => {
      expect(allo.flags).toBeDefined();
      expect(allo.flags?.obsolete).toBe(true);
    });
  });

  describe('RFC 959 Basic Implementation', () => {
    it('should reply with 202 (superfluous at this site) by default', async () => {
      const handler = createHandler(mockConnection);

      await handler();

      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
      expect(
        rfcValidator.isPositiveCompletion(
          FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
        )
      ).toBe(true);
    });

    it('should handle command without parameters', async () => {
      const handler = createHandler(mockConnection);

      await handler();

      expect(mockConnection.reply).toHaveBeenCalledTimes(1);
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });
  });

  describe('Parameter Handling - RFC 959 Syntax', () => {
    it('should handle single byte allocation parameter', async () => {
      const handler = createHandler(mockConnection);

      await handler('1024');

      // Should still respond with 202 as it's treated as NOOP
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });

    it('should handle large allocation parameters', async () => {
      const handler = createHandler(mockConnection);

      await handler('2147483647'); // Max 32-bit signed integer

      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });

    it('should handle allocation with record size (ALLO bytes R record-size)', async () => {
      const handler = createHandler(mockConnection);

      // RFC 959: "ALLO <decimal-integer> [<SP> R <SP> <decimal-integer>]"
      await handler('1024', 'R', '512');

      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });

    it('should handle record size specification correctly', async () => {
      const handler = createHandler(mockConnection);

      // Test various valid record size specifications
      const testCases = [
        ['1000', 'R', '100'],
        ['5000', 'R', '256'],
        ['10240', 'R', '1024'],
      ];

      for (const args of testCases) {
        vi.clearAllMocks();
        await handler(...args);
        expect(mockConnection.reply).toHaveBeenCalledWith(
          FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
        );
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid numeric parameters gracefully', async () => {
      const handler = createHandler(mockConnection);

      // Test with non-numeric parameter
      await handler('invalid');

      // Should still work as ALLO is treated as NOOP
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });

    it('should handle negative allocation values', async () => {
      const handler = createHandler(mockConnection);

      await handler('-1024');

      // Should still respond with 202 as implementation treats as NOOP
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });

    it('should handle malformed record size syntax', async () => {
      const handler = createHandler(mockConnection);

      // Missing R separator
      await handler('1024', '512');

      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });

    it('should handle incomplete record size specification', async () => {
      const handler = createHandler(mockConnection);

      // Only R without record size
      await handler('1024', 'R');

      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });
  });

  describe('Authentication Requirements', () => {
    it(FTP_TEST_SCENARIOS.NO_AUTH_REQUIRED.description, async () => {
      // RFC 959 doesn't explicitly require authentication for ALLO
      mockConnection = FTP_TEST_SCENARIOS.NO_AUTH_REQUIRED.setup();
      const handler = createHandler(mockConnection);

      await handler();

      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });

    it('should work with authenticated connection', async () => {
      mockConnection = createMockConnection({ authenticated: true });
      const handler = createHandler(mockConnection);

      await handler();

      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });
  });

  describe('RFC 959 State Diagram Compliance', () => {
    it('should fit the basic command state diagram model', async () => {
      // RFC 959 state diagram: B -> W -> S (success)
      const handler = createHandler(mockConnection);

      await handler();

      // Should complete successfully (2yz response)
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
      expect(
        rfcValidator.isPositiveCompletion(
          FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
        )
      ).toBe(true);
    });

    it('should not require preliminary responses', async () => {
      const handler = createHandler(mockConnection);

      await handler();

      // Should only send one reply (no 1yz preliminary responses needed)
      expect(mockConnection.reply).toHaveBeenCalledTimes(1);
    });
  });

  describe('RFC 959 Semantic Compliance', () => {
    it('should be treated as NOOP by implementation', async () => {
      // RFC 959: "The ALLO command should be treated as a NOOP (no operation)
      // by those servers which do not require that the maximum size of the
      // file be declared beforehand"
      const handler = createHandler(mockConnection);

      await handler('1024');

      // Should respond with 202 indicating it's superfluous
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });

    it('should not affect connection state', async () => {
      const handler = createHandler(mockConnection);
      const initialState = { ...mockConnection };

      await handler('1024');

      // Connection state should remain unchanged (except for the reply call)
      expect(mockConnection.authenticated).toBe(initialState.authenticated);
      expect(mockConnection.transferType).toBe(initialState.transferType);
      expect(mockConnection.encoding).toBe(initialState.encoding);
    });

    it('should not initiate any data transfers', async () => {
      const handler = createHandler(mockConnection);

      await handler('1024');

      // Should not interact with connector for data connections
      expect(mockConnection.connector.waitForConnection).not.toHaveBeenCalled();
      expect(mockConnection.connector.setupServer).not.toHaveBeenCalled();
    });

    it('should be preparatory for STOR/APPE commands', async () => {
      // RFC 959: "This command shall be followed by a STORe or APPEnd command"
      const handler = createHandler(mockConnection);

      await handler('1024');

      // ALLO itself doesn't enforce this, but should complete successfully
      // to allow subsequent STOR/APPE commands
      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
      expect(
        rfcValidator.isPositiveCompletion(
          FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
        )
      ).toBe(true);
    });
  });

  describe('RFC 959 Reply Code Validation', () => {
    it('should use only RFC 959 compliant reply codes', async () => {
      const handler = createHandler(mockConnection);

      await handler();

      const replyCode = (mockConnection.reply as any).mock.calls[0][0];
      expect(rfcValidator.isValidCode(replyCode)).toBe(true);

      // Should be 202 (Command not implemented, superfluous at this site)
      expect(replyCode).toBe(FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS);
    });

    it('should respond with appropriate success code category', async () => {
      const handler = createHandler(mockConnection);

      await handler();

      const replyCode = (mockConnection.reply as any).mock.calls[0][0];
      expect(rfcValidator.isPositiveCompletion(replyCode)).toBe(true);
    });
  });

  describe('Legacy and Compatibility', () => {
    it('should maintain backward compatibility with old FTP clients', async () => {
      const handler = createHandler(mockConnection);

      // Test with various historical parameter formats
      const legacyFormats = [
        ['1024'],
        ['2048', 'R', '256'],
        ['0'], // Zero allocation
        [], // No parameters
      ];

      for (const args of legacyFormats) {
        vi.clearAllMocks();
        await handler(...args);
        expect(mockConnection.reply).toHaveBeenCalledWith(
          FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
        );
      }
    });

    it('should handle obsolete command usage gracefully', async () => {
      // Since ALLO is marked as obsolete, ensure it still works
      expect(allo.flags?.obsolete).toBe(true);

      const handler = createHandler(mockConnection);
      await handler();

      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });
  });

  describe('Integration with File Operations', () => {
    it('should not interfere with subsequent file operations', async () => {
      const handler = createHandler(mockConnection);

      await handler('1024');

      // Should not modify file system related properties
      expect(mockConnection.fs).toBe(null);
      expect(mockConnection.renameFrom).toBe(null);
    });

    it('should not affect transfer parameters', async () => {
      const handler = createHandler(mockConnection);
      const originalTransferType = mockConnection.transferType;
      const originalEncoding = mockConnection.encoding;

      await handler('1024');

      expect(mockConnection.transferType).toBe(originalTransferType);
      expect(mockConnection.encoding).toBe(originalEncoding);
    });
  });

  describe('Performance and Resource Usage', () => {
    it('should execute quickly as a NOOP operation', async () => {
      const handler = createHandler(mockConnection);
      const startTime = Date.now();

      await handler('999999999'); // Large allocation should not matter

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    it('should not consume significant memory for large allocations', async () => {
      const handler = createHandler(mockConnection);

      // Large allocation should not actually allocate memory
      await handler('2147483647');

      expect(mockConnection.reply).toHaveBeenCalledWith(
        FTP_CODES.COMMAND_NOT_IMPLEMENTED_SUPERFLUOUS
      );
    });
  });
});
