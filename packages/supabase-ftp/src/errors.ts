export class SupabaseFtpError extends Error {
  readonly code: number;
  constructor(message: string, code = 400) {
    super(message);
    this.code = code;
    this.name = 'SupabaseFTPError';
  }
}

export class GeneralError extends SupabaseFtpError {
  constructor(message: string, code = 400) {
    super(message, code);
    this.name = 'GeneralError';
  }
}

export class ConnectorError extends SupabaseFtpError {
  constructor(message: string, code: number = 400) {
    super(message, code);
    this.name = 'ConnectorError';
  }
}

export class SocketError extends SupabaseFtpError {
  constructor(message: string, code = 500) {
    super(message, code);
    this.name = 'SocketError';
  }
}

export class FileSystemError extends SupabaseFtpError {
  constructor(message: string, code = 400) {
    super(message, code);
    this.name = 'FileSystemError';
  }
}

export class TimeoutError extends SupabaseFtpError {
  constructor(message: string, code = 425) {
    super(message, code);
    this.name = 'TimeoutError';
  }
}
