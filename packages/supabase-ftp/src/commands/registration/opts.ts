import { Connection } from "../../connection.js";
import { CommandRegistry } from "../registry.js";

const OPTIONS = {
  UTF8: utf8,
  "UTF-8": utf8,
};

const opts: CommandRegistry = {
  directive: "OPTS",
  handler: function ({ command }) {
    if (!command || !command.arg) return this.reply(501);

    const [_option, ...args] = command.arg.split(" ");
    const option = _option ? _option.toUpperCase() : "";

    if (!Object.prototype.hasOwnProperty.call(OPTIONS, option))
      return this.reply(501, "Unknown option command");
    return (OPTIONS as any)[option].call(this, args);
  },
  syntax: "{{cmd}}",
  description: "Select options for a feature",
};

function utf8(this: Connection, [setting]: string[] = []) {
  const getEncoding = () => {
    switch ((setting || "").toUpperCase()) {
      case "ON":
        return "utf8";
      case "OFF":
        return "ascii";
      default:
        return null;
    }
  };

  const encoding = getEncoding();
  if (!encoding) return this.reply(501, "Unknown setting for option");

  this.encoding = encoding;

  return this.reply(200, `UTF8 encoding ${(setting || "").toLowerCase()}`);
}

export default opts;
