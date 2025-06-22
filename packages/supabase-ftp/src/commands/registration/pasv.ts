import { PassiveConnector } from "../../connector/passive.js";
import { GeneralError } from "../../errors.js";
import { CommandRegistry } from "../registry.js";

const pasv: CommandRegistry = {
  directive: "PASV",
  handler: function () {
    if (!this.server.options.passiveHostname) {
      return this.reply(502);
    }

    this.connector = new PassiveConnector(this);
    return this.connector
      .setupServer()
      .then((server) => {
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new GeneralError("Failed to get server address", 425);
        }
        const port = address.port;
        let pasvAddress = this.server.options.passiveHostname;
        if (!pasvAddress)
          throw new GeneralError("Passive hostname not set", 425);
        if (typeof pasvAddress === "function") {
          return Promise.resolve()
            .then(() => pasvAddress(this.ip))
            .then((address) => ({ address, port }));
        }
        return { address: pasvAddress, port };
      })
      .then(({ address, port }) => {
        const host = address.replace(/\./g, ",");
        const portByte1 = (port / 256) | 0;
        const portByte2 = port % 256;

        return this.reply(227, `PASV OK (${host},${portByte1},${portByte2})`);
      })
      .catch((err: GeneralError) => {
        console.error(err);
        return this.reply(err.code || 425, err.message);
      });
  },
  syntax: "{{cmd}}",
  description: "Initiate passive mode",
};

export default pasv;
