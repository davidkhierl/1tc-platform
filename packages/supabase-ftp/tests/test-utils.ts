/**
 * FTP Command Testing Utilities
 *
 * This file provides utilities for testing FTP commands in compliance with
 * RFC 959, RFC 3659, RFC 2428, and other FTP-related RFCs.
 */

import { vi, type MockedFunction } from 'vitest';
import { Connection } from '../src/connection.js';
import { FTP_CODES } from '../src/messages.js';

/**
 * Mock connection factory for FTP command testing
 */
export function createMockConnection(
  overrides: Partial<Connection> = {}
): Connection {
  const mockConnection = {
    id: 'u' + Math.random().toString(16).slice(2, 10),
    server: {
      options: {
        url: 'ftp://localhost:21',
        pasv_url: 'ftp://localhost',
        pasv_min: 1024,
        pasv_max: 65535,
        timeout: 0,
        anonymous: false,
        tls: {},
      },
      isTLS: false,
      listeners: vi.fn().mockReturnValue([]),
      emitPromise: vi.fn(),
      emit: vi.fn(),
    },
    commandSocket: {
      write: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
      setTimeout: vi.fn(),
      on: vi.fn(),
      writable: true,
      remoteAddress: '127.0.0.1',
      address: vi.fn().mockReturnValue({ port: 21 }),
    },
    connector: {
      waitForConnection: vi.fn(),
      end: vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
      setupConnection: vi.fn(),
      setupServer: vi.fn(),
      closeSocket: vi.fn(),
      closeServer: vi.fn(),
      type: false,
      connected: false,
      dataSocket: null,
      dataServer: null,
    },
    commands: {
      handle: vi.fn(),
      blacklist: [],
      whitelist: [],
    },

    transferType: 'binary',
    encoding: 'utf8',
    bufferSize: 0,
    authenticated: false,
    username: null,
    fs: null,
    renameFrom: null,
    listFormat: 'ls',

    _restByteCount: 0,
    _secure: false,

    // Methods
    reply: vi.fn(),
    close: vi.fn(),
    login: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  // Add getters and setters
  Object.defineProperty(mockConnection, 'ip', {
    get() {
      return this.commandSocket?.remoteAddress || null;
    },
    configurable: true,
  });

  Object.defineProperty(mockConnection, 'restByteCount', {
    get() {
      return this._restByteCount > 0 ? this._restByteCount : undefined;
    },
    set(value: number) {
      this._restByteCount = value;
    },
    configurable: true,
  });

  Object.defineProperty(mockConnection, 'secure', {
    get() {
      return this.server?.isTLS || this._secure || false;
    },
    set(value: boolean) {
      this._secure = value;
    },
    configurable: true,
  });

  // Apply overrides
  Object.assign(mockConnection, overrides);

  return mockConnection as unknown as Connection;
}

/**
 * Standard test scenarios for FTP commands
 * These provide reusable test patterns for common FTP command behaviors
 */
export const FTP_TEST_SCENARIOS = {
  /**
   * Tests for commands that require authentication
   */
  REQUIRES_AUTH: {
    description: 'should require authentication',
    setup: () => createMockConnection({ authenticated: false }),
    expectation: 'should reply with 530 Not logged in',
    expectedCode: FTP_CODES.NOT_LOGGED_IN,
  },

  /**
   * Tests for commands that work without authentication
   */
  NO_AUTH_REQUIRED: {
    description: 'should work without authentication',
    setup: () => createMockConnection({ authenticated: false }),
    expectation: 'should not require authentication',
  },

  /**
   * Tests for file system operations
   */
  FILE_SYSTEM: {
    FILE_NOT_FOUND: {
      description: 'should handle file not found',
      expectation: 'should reply with 550 File unavailable',
      expectedCode: FTP_CODES.FILE_UNAVAILABLE,
    },
    PERMISSION_DENIED: {
      description: 'should handle permission denied',
      expectation: 'should reply with 550 File unavailable',
      expectedCode: FTP_CODES.FILE_UNAVAILABLE,
    },
    SUCCESS: {
      description: 'should handle successful operation',
      expectation: 'should reply with appropriate success code',
    },
  },

  /**
   * Tests for data connection operations
   */
  DATA_CONNECTION: {
    ACTIVE_TRANSFER: {
      description: 'should handle active data transfer',
      expectation: 'should work with active data connection',
    },
    NO_TRANSFER: {
      description: 'should handle no active transfer',
      expectation: 'should handle case when no transfer is active',
    },
    CONNECTION_ERROR: {
      description: 'should handle data connection errors',
      expectation: 'should gracefully handle connection failures',
      expectedCode: FTP_CODES.CANT_OPEN_DATA_CONNECTION,
    },
  },
};

/**
 * RFC 959 Response Code Validation utilities
 * Uses the actual FTP_CODES from the implementation to ensure consistency
 */
export function validateRfcCompliance() {
  return {
    codes: Object.values(FTP_CODES),
    isValidCode: (code: number) => {
      return code >= 100 && code <= 699;
    },
    isPositivePreliminary: (code: number) => code >= 100 && code <= 199,
    isPositiveCompletion: (code: number) => code >= 200 && code <= 299,
    isPositiveIntermediate: (code: number) => code >= 300 && code <= 399,
    isTransientNegative: (code: number) => code >= 400 && code <= 499,
    isPermanentNegative: (code: number) => code >= 500 && code <= 599,
    isProtectedReply: (code: number) => code >= 600 && code <= 699,
  };
}

/**
 * Command test template generator
 * Helps create consistent tests for FTP commands
 */
export function createCommandTestSuite(
  commandName: string,
  commandModule: any
) {
  return {
    basic: {
      description: `${commandName} Command - Basic Properties`,
      hasDirective: () => commandModule.directive !== undefined,
      hasSyntax: () => commandModule.syntax !== undefined,
      hasDescription: () => commandModule.description !== undefined,
      hasHandler: () => typeof commandModule.handler === 'function',
    },

    rfc959: {
      description: `${commandName} Command - RFC 959 Compliance`,
      followsRfc959: true, // Implementation specific
      usesCorrectResponseCodes: true, // Implementation specific
    },

    errorHandling: {
      description: `${commandName} Command - Error Handling`,
      handlesConnectionErrors: true, // To be tested in actual tests
      handlesInvalidParameters: true, // To be tested in actual tests
    },
  };
}
