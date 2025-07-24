import type { PlopTypes } from '@turbo/gen';

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setHelper('eq', (a, b) => a === b);

  // Node Package/App Generator
  plop.setGenerator('node-package', {
    description: 'Create a new Node.js package or application',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'What is the name of the new package?',
        validate: (input: string) => {
          if (input.includes('.')) {
            return 'Package name cannot include an extension';
          }
          if (input.includes(' ')) {
            return 'Package name cannot include spaces';
          }
          if (input.length === 0) {
            return 'Package name is required';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'description',
        message: 'What is the description of the new package?',
        default: 'A Node.js package',
      },
      {
        type: 'list',
        name: 'type',
        message: 'What type of Node.js project?',
        choices: [
          { name: 'Package (shared library)', value: 'package' },
          { name: 'Application (standalone app)', value: 'app' },
        ],
        default: 'package',
      },
      {
        type: 'confirm',
        name: 'hasTests',
        message: 'Do you want to include test setup?',
        default: true,
      },
    ],
    actions: data => {
      const actions: PlopTypes.ActionType[] = [];
      const destination = data?.type === 'package' ? 'packages' : 'apps';

      // Add package.json
      actions.push({
        type: 'add',
        path: `${destination}/{{ dashCase name }}/package.json`,
        templateFile: 'templates/node-package/package.json.hbs',
      });

      // Add tsconfig.json
      actions.push({
        type: 'add',
        path: `${destination}/{{ dashCase name }}/tsconfig.json`,
        templateFile: 'templates/node-package/tsconfig.json.hbs',
      });

      // Add eslint config
      actions.push({
        type: 'add',
        path: `${destination}/{{ dashCase name }}/eslint.config.mjs`,
        templateFile: 'templates/node-package/eslint.config.mjs.hbs',
      });

      // Add README
      actions.push({
        type: 'add',
        path: `${destination}/{{ dashCase name }}/README.md`,
        templateFile: 'templates/node-package/README.md.hbs',
      });

      // Add source files
      actions.push({
        type: 'add',
        path: `${destination}/{{ dashCase name }}/src/index.ts`,
        templateFile: 'templates/node-package/src/index.ts.hbs',
      });

      // Add test files if requested
      if (data?.hasTests) {
        actions.push({
          type: 'add',
          path: `${destination}/{{ dashCase name }}/vitest.config.ts`,
          templateFile: 'templates/node-package-tests/vitest.config.ts.hbs',
        });

        actions.push({
          type: 'add',
          path: `${destination}/{{ dashCase name }}/tests/index.test.ts`,
          templateFile: 'templates/node-package-tests/tests/index.test.ts.hbs',
        });
      }

      return actions;
    },
  });
}
