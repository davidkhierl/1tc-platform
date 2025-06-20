export class ConnectorError extends Error {
  readonly code: number;
  constructor(message: string, code: number = 400) {
    super(message);
    this.code = code;
    this.name = "ConnectorError";
  }
}
