import { createFtpServer } from "@repo/supabase-ftp/server";

const ftpServer = createFtpServer({
  url: "ftp://127.0.0.1:2121",
  anonymous: true,
});

ftpServer.listen().then((host) => {
  console.log(
    `FTP server is running at ${host.protocol}://${host.ip}:${host.port}`
  );
});
