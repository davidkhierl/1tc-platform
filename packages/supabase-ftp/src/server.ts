import { FtpServer, FtpServerOptions } from "./ftp-server.js";

const PASV_MIN = 1024;
const PASV_MAX = 65535;

export function createFtpServer(
  options: Partial<FtpServerOptions> = {}
): FtpServer {
  return new FtpServer({
    url: "ftp://127.0.1:21",
    passivePortRange: [PASV_MIN, PASV_MAX],
    passiveHostname: null,
    anonymous: false,
    listFormat: "ls",
    blacklist: [],
    whitelist: [],
    timeout: 0,
    endOnProcessSignal: true,
    ...options,
  });
}
