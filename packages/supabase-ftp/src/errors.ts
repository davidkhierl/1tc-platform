export class SupabaseFTPError extends Error {
  readonly code: number;
  constructor(message: string, code = 400) {
    super(message);
    this.code = code;
    this.name = "SupabaseFTPError";
  }
}

export class GeneralError extends SupabaseFTPError {
  constructor(message: string, code = 400) {
    super(message, code);
    this.name = "GeneralError";
  }
}

export class ConnectorError extends SupabaseFTPError {
  constructor(message: string, code: number = 400) {
    super(message, code);
    this.name = "ConnectorError";
  }
}

export class SocketError extends SupabaseFTPError {
  constructor(message: string, code = 500) {
    super(message, code);
    this.name = "SocketError";
  }
}

export class FileSystemError extends SupabaseFTPError {
  constructor(message: string, code = 400) {
    super(message, code);
    this.name = "FileSystemError";
  }
}
