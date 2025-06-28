import ActiveConnector from "../../connector/active.js";
import { CommandRegistry } from "../registry.js";

const port: CommandRegistry = {
  directive: "PORT",
  handler: async function ({ command }) {
    this.connector = new ActiveConnector(this);

    const rawConnection = (command?.arg ?? "").split(",");
    if (rawConnection.length !== 6) return this.reply(425);

    const numericParts = rawConnection.map((part) => parseInt(part, 10));
    if (numericParts.some(isNaN))
      return this.reply(425, "Invalid PORT arguments");

    const ip = numericParts.slice(0, 4).join(".");
    const portBytes = numericParts.slice(4);

    if (
      portBytes.length !== 2 ||
      typeof portBytes[0] !== "number" ||
      typeof portBytes[1] !== "number" ||
      isNaN(portBytes[0]) ||
      isNaN(portBytes[1])
    )
      return this.reply(425, "Invalid PORT arguments");

    const targetPort = portBytes[0] * 256 + portBytes[1];

    if (targetPort < 1 || targetPort > 65535) {
      return this.reply(425, "Invalid port number");
    }

    return (this.connector as ActiveConnector)
      .setupConnection(ip, targetPort)
      .then(() => this.reply(200))
      .catch((err) => {
        console.error(err);
        return this.reply(err.code || 425, err.message);
      });
  },
  syntax: "{{cmd}} <x>,<x>,<x>,<x>,<y>,<y>",
  description:
    "Specifies an address and port to which the server should connect",
};

export default port;
