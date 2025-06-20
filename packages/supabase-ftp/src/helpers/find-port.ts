import { createServer } from "node:net";
import { ConnectorError } from "../errors.js";

const MAX_PORT = 65535;
const MAX_PORT_CHECK_ATTEMPT = 5;

export function* portNumberGenerator(
  min: number,
  max = MAX_PORT
): Generator<number> {
  let current = min;

  while (true) {
    if (current > MAX_PORT || current > max) {
      current = min;
    }
    yield current++;
  }
}

export function getNextPortFactory(
  host: string,
  portMin: number,
  portMax: number,
  maxAttempts = MAX_PORT_CHECK_ATTEMPT
) {
  const nextPortNumber = portNumberGenerator(portMin, portMax);

  return () =>
    new Promise<number>((resolve, reject) => {
      const portCheckServer = createServer();
      portCheckServer.maxConnections = 0;

      let attemptCount = 0;
      const tryGetPort = () => {
        attemptCount++;
        if (attemptCount > maxAttempts) {
          reject(new ConnectorError("Unable to find valid port"));
          return;
        }

        const { value: port } = nextPortNumber.next();

        portCheckServer.removeAllListeners();
        portCheckServer.once("error", (err: NodeJS.ErrnoException) => {
          if (err.code && ["EADDRINUSE"].includes(err.code)) {
            tryGetPort();
          } else {
            reject(err);
          }
        });
        portCheckServer.once("listening", () => {
          portCheckServer.removeAllListeners();
          portCheckServer.close(() => resolve(port));
        });

        try {
          if (typeof port === "number") portCheckServer.listen(port, host);
        } catch (err) {
          reject(err);
        }
      };

      tryGetPort();
    });
}
