import { CommandRegistry } from "../registry.js";

const syst: CommandRegistry = {
  directive: "SYST",
  handler: function () {
    return this.reply(215);
  },
  syntax: "{{cmd}}",
  description: "Return system type",
  flags: {
    no_auth: true,
  },
};

export default syst;
