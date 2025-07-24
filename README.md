# 1TC Platform

The comprehensive digital platform for **1Take Collective**, built as a modern monorepo containing all apps, websites, landing pages, microservices, and servers.

## Getting Started

Clone the repository and install dependencies:

```sh
git clone <repository-url>
cd 1tc-platform
pnpm install
```

## What's inside?

This platform includes the following packages/apps:

### Apps and Packages

- `docs`: Documentation [Next.js](https://nextjs.org/) app
- `web`: Main website [Next.js](https://nextjs.org/) app  
- `studio`: Studio application [Next.js](https://nextjs.org/) app
- `ftp`: FTP server application
- `@1tc/ui`: Shared React component library used across all applications
- `@1tc/eslint-config`: ESLint configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@1tc/typescript-config`: TypeScript configurations used throughout the monorepo
- `@1tc/utils`: Shared utility functions and helpers
- `@1tc/supabase-ftp`: FTP server integration with Supabase
- `@1tc/vitest-config`: Vitest testing configurations

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Tech Stack

This platform is built with modern tools:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [Next.js](https://nextjs.org/) for React applications
- [Turborepo](https://turborepo.com/) for monorepo management
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting
- [Vitest](https://vitest.dev/) for testing
- [pnpm](https://pnpm.io/) for package management

## Development

### Build All

To build all apps and packages:

```bash
pnpm build
```

### Development Mode

To start all apps in development mode:

```bash
pnpm dev
```

### Linting

To lint all packages:

```bash
pnpm lint
```

### Testing

To run tests:

```bash
pnpm test
```

## Platform Architecture

### Applications
- **Web**: Main customer-facing website
- **Studio**: Internal studio management application
- **Docs**: Documentation and developer resources
- **FTP**: File transfer and media management server

### Shared Packages
- **UI Library**: Consistent design system across all apps
- **Utils**: Common utilities and helpers
- **Configs**: Shared tooling configurations

## Remote Caching

This platform uses [Turborepo Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching) to share build artifacts across machines and CI/CD pipelines.

To enable remote caching:

1. Create a [Vercel account](https://vercel.com/signup)
2. Authenticate: `npx turbo login`
3. Link your repo: `npx turbo link`

## Useful Links

Learn more about the tools powering this platform:

- [Turborepo Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Turborepo Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)

---

**1Take Collective** - *One take, infinite possibilities.*
