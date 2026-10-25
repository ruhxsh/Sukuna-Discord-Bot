# Sukuna Discord moderation bot

Sukuna is a JavaScript Discord bot for server moderation, role management, welcome messages, and utility commands.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/sukuna-bot run dev` — run Sukuna in the project shell
- `pnpm --filter @workspace/sukuna-bot run check` — check bot JavaScript syntax
- `pnpm --filter @workspace/sukuna-bot test` — run bot storage and validation tests
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required secret: `DISCORD_TOKEN` — Discord bot token (Replit Secrets only)

## Stack

- pnpm workspaces, Node.js 24, JavaScript, discord.js v14, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

Sukuna supports prefix-based moderation and server utilities. Server configuration and warnings are stored in an ignored JSON file under `BOT_DATA_DIR` (default: `data/`).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
