import { FTP_CODES, type FtpCode } from './messages.js';

/**
 * Base FTP Error class following RFC 959 standards
 */
export class SupabaseFtpError extends Error {
  readonly code: FtpCode;

  constructor(
    message: string,
    code: FtpCode = FTP_CODES.FILE_ACTION_NOT_TAKEN
  ) {
    super(message);
    this.code = code;
    this.name = 'SupabaseFTPError';
  }
}

/**
 * Low-level socket and network errors
 */
export class SocketError extends SupabaseFtpError {
  constructor(
    message: string,
    code: FtpCode = FTP_CODES.ACTION_ABORTED_LOCAL_ERROR
  ) {
    super(message, code);
    this.name = 'SocketError';
  }
}

/**
 * Connection establishment and configuration errors
 */
export class ConnectorError extends SupabaseFtpError {
  constructor(
    message: string,
    code: FtpCode = FTP_CODES.SERVICE_NOT_AVAILABLE
  ) {
    super(message, code);
    this.name = 'ConnectorError';
  }
}

/**
 * FTP protocol-level connection errors (421, 425, 426)
 */
export class ConnectionError extends SupabaseFtpError {
  constructor(
    message: string,
    code: FtpCode = FTP_CODES.SERVICE_NOT_AVAILABLE
  ) {
    super(message, code);
    this.name = 'ConnectionError';
  }
}

/**
 * Authentication and authorization errors (530, 331, 332, 430)
 */
export class AuthenticationError extends SupabaseFtpError {
  constructor(message: string, code: FtpCode = FTP_CODES.NOT_LOGGED_IN) {
    super(message, code);
    this.name = 'AuthenticationError';
  }
}

/**
 * Command syntax and implementation errors (500, 501, 502, 503, 504)
 */
export class CommandError extends SupabaseFtpError {
  constructor(
    message: string,
    code: FtpCode = FTP_CODES.SYNTAX_ERROR_COMMAND_UNRECOGNIZED
  ) {
    super(message, code);
    this.name = 'CommandError';
  }
}

/**
 * File system and file operation errors (450, 550, 551, 552, 553)
 */
export class FileSystemError extends SupabaseFtpError {
  constructor(message: string, code: FtpCode = FTP_CODES.FILE_UNAVAILABLE) {
    super(message, code);
    this.name = 'FileSystemError';
  }
}

/**
 * Data transfer errors (125, 150, 425, 426, 451)
 */
export class TransferError extends SupabaseFtpError {
  constructor(
    message: string,
    code: FtpCode = FTP_CODES.CANT_OPEN_DATA_CONNECTION
  ) {
    super(message, code);
    this.name = 'TransferError';
  }
}

/**
 * Security-related errors (RFC 2228: 533, 534, 535, 536, 537)
 */
export class SecurityError extends SupabaseFtpError {
  constructor(
    message: string,
    code: FtpCode = FTP_CODES.FAILED_SECURITY_CHECK
  ) {
    super(message, code);
    this.name = 'SecurityError';
  }
}

/**
 * Policy and permission errors (532, 534)
 */
export class PermissionError extends SupabaseFtpError {
  constructor(
    message: string,
    code: FtpCode = FTP_CODES.NEED_ACCOUNT_FOR_STORING_FILES
  ) {
    super(message, code);
    this.name = 'PermissionError';
  }
}

/**
 * Storage and quota errors (452, 552)
 */
export class StorageError extends SupabaseFtpError {
  constructor(
    message: string,
    code: FtpCode = FTP_CODES.ACTION_NOT_TAKEN_INSUFFICIENT_STORAGE
  ) {
    super(message, code);
    this.name = 'StorageError';
  }
}

/**
 * Timeout and resource unavailability errors (431)
 */
export class TimeoutError extends SupabaseFtpError {
  constructor(
    message: string,
    code: FtpCode = FTP_CODES.NEED_UNAVAILABLE_RESOURCE
  ) {
    super(message, code);
    this.name = 'TimeoutError';
  }
}
