import { CommandRegistry } from "../registry.js";
import list from "./list.js";

const nlst: CommandRegistry = {
  directive: "NLST",
  handler: function (args) {
    return list.handler?.call(this, args);
  },
  syntax: "{{cmd}} [<path>]",
  description: "Returns a list of file names in a specified directory",
};

export default nlst;
