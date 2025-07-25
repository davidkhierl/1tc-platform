import { CommandRegistry } from '../registry.js';

const cwd: CommandRegistry = {
  directive: ['CWD', 'XCWD'],
  handler: async function ({ command }) {
    const fs = this.fs;
    if (!fs) return this.reply(550, 'File system not instantiated');
    if (!fs.chdir) return this.reply(402, 'Not supported by file system');

    return Promise.resolve()
      .then(() => fs.chdir(command.arg))
      .then(cwd => {
        const path = cwd ? '"' + cwd.replace(/"/g, '""') + '"' : '';
        return this.reply(250, `OK. Current directory is ${path}`);
      })
      .catch(err => {
        console.error(err);
        return this.reply(550, err.message);
      });
  },
  syntax: '{{cmd}} <path>',
  description: 'Change working directory',
};

export default cwd;
