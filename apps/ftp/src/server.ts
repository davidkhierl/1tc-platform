import { createFtpServer } from "@repo/supabase-ftp";
import { passiveHostname } from "@repo/supabase-ftp/helpers/passive-hostname";
import { GeneralError } from "@repo/supabase-ftp/errors";

const ftpServer = createFtpServer({
  url: "ftp://127.0.0.1:2121",
  anonymous: true,
  passiveHostname: passiveHostname,
});

ftpServer.on("login", ({ connection, username, password }, resolve, reject) => {
  if (username === "anonymous") {
    return resolve({ root: "/" });
  }
  return reject(new GeneralError("Invalid username or password", 401));
});

ftpServer.listen().then((host) => {
  console.log(
    `FTP server is running at ${host.protocol}://${host.ip}:${host.port}`
  );
});
