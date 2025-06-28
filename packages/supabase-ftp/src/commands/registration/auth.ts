import tls from "tls";
import { CommandRegistry } from "../registry.js";
import { Connection } from "../../connection.js";
import net from "net";

const auth: CommandRegistry = {
  directive: "AUTH",
  handler: function ({ command }) {
    const method = (command.arg || "").toUpperCase();

    switch (method) {
      case "TLS":
        return handleTLS.call(this);
      default:
        return this.reply(504);
    }
  },
  syntax: "{{cmd}} <type>",
  description: "Set authentication mechanism",
  flags: {
    no_auth: true,
    feat: "AUTH TLS",
  },
};

async function handleTLS(this: Connection) {
  if (!this.server.options.tls) return this.reply(502);
  if (this.secure) return this.reply(202);

  return this.reply(234).then(() => {
    const secureContext = tls.createSecureContext(this.server.options.tls);
    const secureSocket = new tls.TLSSocket(this.commandSocket, {
      isServer: true,
      secureContext,
    });
    ["data", "timeout", "end", "close", "drain", "error"].forEach((event) => {
      function forwardEvent(this: net.Socket, ...args: any[]) {
        this.emit(event, ...args);
      }
      secureSocket.on(event, forwardEvent.bind(this.commandSocket));
    });
    this.commandSocket = secureSocket;
    this.secure = true;
  });
}

export default auth;
