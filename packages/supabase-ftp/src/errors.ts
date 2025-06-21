export class GeneralError extends Error {
  readonly code: number;
  constructor(message: string, code = 400) {
    super(message);
    this.code = code;
    this.name = "GeneralError";
  }
}

export class ConnectorError extends Error {
  readonly code: number;
  constructor(message: string, code: number = 400) {
    super(message);
    this.code = code;
    this.name = "ConnectorError";
  }
}

export class SocketError extends Error {
  readonly code: number;
  constructor(message: string, code = 500) {
    super(message);
    this.code = code;
    this.name = "SocketError";
  }
}
