import { CommandRegistryHandler } from '../../registry.js';

const chmodHandler: CommandRegistryHandler = async function ({ command }) {
  const fs = this.fs;
  if (!fs) return this.reply(550, 'File system not instantiated');
  if (!fs.chmod) return this.reply(502, 'Not supported by file system');

  if (!command.arg)
    return this.reply(503, 'Syntax error in parameters or arguments');

  const [mode, ...fileNameParts] = command.arg.split(' ');
  const fileName = fileNameParts.join(' ');

  if (!mode || !fileName) {
    return this.reply(501, 'Syntax error in parameters or arguments');
  }

  return Promise.resolve()
    .then(() => fs.chmod(fileName, parseInt(mode, 8)))
    .then(() => {
      return this.reply(200);
    })
    .catch(err => {
      console.error(err);
      return this.reply(500);
    });
};

export default chmodHandler;
