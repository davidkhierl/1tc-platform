import { createClient } from '@supabase/supabase-js';
import { createFtpServer } from '@1tc/supabase-ftp';
import { passiveHostname } from '@1tc/supabase-ftp/helpers/passive-hostname';
import { GeneralError } from '@1tc/supabase-ftp/errors';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const ftpServer = createFtpServer(supabase, {
  url: 'ftp://0.0.0.0:2121',
  anonymous: true,
  greeting: 'Welcome to the Supabase FTP Server! powered by 1TC',
  passiveHostname: passiveHostname,
});

ftpServer.on('login', ({ connection, username, password }, resolve, reject) => {
  if (username === 'anonymous') {
    return resolve({
      root: '/media-uploads-public',
      cwd: '/',
    });
  }
  return reject(new GeneralError('Invalid username or password', 401));
});

ftpServer.listen().then(host => {
  console.log(
    `FTP server is running at ${host.protocol}://${host.ip}:${host.port}`
  );
});
