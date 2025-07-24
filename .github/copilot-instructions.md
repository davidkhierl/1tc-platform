---
applyTo: "**/*.{ts,tsx,js,jsx,mjs,json,yaml,yml,md}"
---

# GitHub Copilot Instructions

## Project Overview

This is a monorepo managed by **Turborepo** using **pnpm** as the package manager. The project follows a structured approach with shared packages and multiple applications.

## Monorepo Structure

```
├── apps/                    # Applications
│   ├── docs/               # Documentation site (Next.js)
│   ├── ftp/                # FTP server application
│   ├── studio/             # Studio application (Next.js)
│   └── web/                # Main web application (Next.js)
├── packages/               # Shared packages
│   ├── eslint-config/      # Shared ESLint configurations
│   ├── supabase-ftp/       # Supabase FTP utilities
│   ├── typescript-config/  # Shared TypeScript configurations
│   ├── ui/                 # Shared UI components
│   ├── utils/              # Shared utility functions
│   └── vitest-config/      # Shared Vitest configurations
└── supabase/               # Supabase configuration and migrations
```

## Technology Stack

- **Monorepo**: Turborepo
- **Package Manager**: pnpm (v10.13.1+)
- **Language**: TypeScript
- **Frontend Framework**: Next.js (for web apps)
- **Database**: Supabase
- **Testing**: Vitest
- **Linting**: ESLint
- **Styling**: Tailwind CSS (implied by components.json files)

## Development Guidelines

### Package Management

- Use `pnpm` for all package operations
- Workspace packages are defined in `pnpm-workspace.yaml`
- All packages follow the workspace protocol for internal dependencies

### Build System

- Turborepo manages build, dev, lint, and type-checking tasks
- Use `turbo run <task>` for running tasks across the monorepo
- Individual packages can be built/run using workspace filtering

### Code Organization

- **Apps**: Standalone applications that can be deployed independently
- **Packages**: Shared code, configurations, and utilities
- Internal packages use `@1tc/` scoping convention

### TypeScript Configuration

- Shared TypeScript configs in `packages/typescript-config/`
- Each package/app extends from shared base configurations
- Maintain consistent TypeScript settings across the monorepo

### Linting and Formatting

- Shared ESLint configurations in `packages/eslint-config/`
- Prettier for code formatting
- Consistent code style across all packages and apps

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development mode for all apps
pnpm dev

# Build all packages and apps
pnpm build

# Run linting across the monorepo
pnpm lint

# Format code
pnpm format

# Type checking
pnpm check-types
```

## When Adding New Code

1. **New Applications**: Add to `apps/` directory
2. **Shared Code**: Add to `packages/` directory
3. **Internal Dependencies**: Use workspace protocol (`workspace:*`)
4. **External Dependencies**: Add to the appropriate package.json
5. **Configurations**: Extend from shared configs in `packages/`

## Important Notes

- Node.js version requirement: >=18
- All packages are private (not published to npm)
- Supabase is used for backend services
- The project uses modern TypeScript and Next.js patterns
