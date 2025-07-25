import 'node:net';
import 'node:tls';
import { FtpServer, FtpServerOptions } from './ftp-server.js';
import { SupabaseClient } from '@supabase/supabase-js';

declare module 'node:net' {
  interface Socket {
    connected?: boolean;
  }
}

declare module 'node:tls' {
  interface TLSSocket {
    connected?: boolean;
  }
}

const PASV_MIN = 1024;
const PASV_MAX = 65535;

export function createFtpServer(
  supabase: SupabaseClient,
  options: Partial<FtpServerOptions>
): FtpServer {
  return new FtpServer(supabase, {
    url: 'ftp://127.0.1:21',
    passivePortRange: [PASV_MIN, PASV_MAX],
    passiveHostname: null,
    anonymous: false,
    listFormat: 'ls',
    blacklist: [],
    whitelist: [],
    timeout: 0,
    endOnProcessSignal: true,
    ...options,
  });
}
