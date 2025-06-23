import { CommandRegistry } from "../registry.js";

const pwd: CommandRegistry = {
  directive: ["PWD", "XPWD"],
  handler: async function () {
    const fs = this.fs;
    if (!fs) return this.reply(550, "File system not instantiated");
    if (!fs.currentDirectory)
      return this.reply(402, "Not supported by file system");

    return Promise.resolve()
      .then(() => fs.currentDirectory())
      .then((cwd) => {
        const path = cwd ? `"${cwd.replace(/"/g, '""')}"` : "";
        return this.reply(257, `${path} is your current location`);
      })
      .catch((err) => {
        return this.reply(550, err.message);
      });
  },
  syntax: "{{cmd}}",
  description: "Print current working directory",
};

export default pwd;
