# Admin Agent (Mastra) — Users Workflow

A minimal Mastra-based agent project demonstrating how to fetch users from a Nutella/Highspot-style API. The repository includes a `usersWorkflow` that calls a `usersTool`, which in turn uses a small `NutellaClient` HTTP wrapper.

This README covers:
- Project purpose and structure
- Setup and development
- Environment variables (including `NUTELLA_API_HOST`)
- Running the dev server
- Examples: calling `usersWorkflow` with an auth token or cookies
- Troubleshooting and next steps

## Setup

1. Copy `.env.example` to `.env` and fill required secrets (if present).
2. Install dependencies:

```bash
npm install
```

3. Type-check (optional):

```bash
npx tsc --noEmit
```

## Environment variables

- `OPENAI_API_KEY` — (optional) OpenAI API key used by the agent if you use LLM features.
- `NUTELLA_API_HOST` — (optional) Base URL for the Nutella/Highspot API (e.g. `https://api.highspot.com/v1.0`). If not set, the project defaults to `https://api.highspot.com/v1.0`.

Set these in your shell or CI environment. Example:

```bash
export NUTELLA_API_HOST="https://api.highspot.com/v1.0"
export OPENAI_API_KEY="sk-..."
```

## Run the dev server (Mastra)

This project includes a `dev` script that starts the Mastra dev server.

```bash
npm run dev
```

When running you'll see a local playground and API endpoints, for example:

- Playground: http://localhost:4111/
- API: http://localhost:4111/api

The dev server boots and hot-reloads on changes.

## How the users flow works

- `usersWorkflow` accepts optional inputs: `authToken` (Basic token), `hsCsrfToken`, `cookies`, and `query`.
- The workflow calls `fetchUsers` which invokes the `usersTool`.
- `usersTool` prefers `authToken` (Authorization header) when provided; otherwise it uses the provided cookies and hs-csrf header to call the API.
- The `queryUsers` step filters the users by a substring match on the provided `query`.

This lets you call the workflow either with a token (automation) or with cookies (browser-proxied session).

## Examples

### 1) Run the pre-built JS example (no Mastra runtime)

This is the simplest way to test the API with a token or cookies. It calls the API directly and prints JSON results.

```bash
# Using a Basic token
API_HOST="https://api.highspot.com/v1.0" AUTH_TOKEN="<base64-token>" node examples/run-users-workflow.js

# Using cookies
API_HOST="https://api.highspot.com/v1.0" COOKIES="session=abc123; other=value" node examples/run-users-workflow.js
```

`examples/run-users-workflow.js` reads `API_HOST`, `AUTH_TOKEN`, `COOKIES`, and `QUERY` from environment variables.

### 2) Run the TypeScript example (best-effort, may require ts-node)

```bash
# Build first
npx tsc
# Run via ts-node or your preferred loader (example using ts-node ESM loader)
node --loader ts-node/esm examples/run-users-workflow.ts
```

The TypeScript example demonstrates calling `usersWorkflow` in-process. Mastra runtime versions vary; if your environment requires bootstrapping Mastra to execute workflows you may need to adapt the call.

### 3) Call `usersWorkflow` via the Mastra dev API

If you run `npm run dev` the Mastra dev server exposes an API. You can call the workflow from the Playground or the API endpoints (check the Playground UI for how to invoke a workflow). If you want to call it programmatically, create a client against `http://localhost:4111/api` and follow the Mastra API shape.

## Troubleshooting

- "CloudExporter disabled": this means Mastra Cloud integration is not configured; you can ignore if you don't use Mastra Cloud.
- If the dev server fails to start, run `npx tsc --noEmit` to catch TypeScript errors, or check the console logs from `npm run dev`.

## Next steps (suggestions)

- Add a server-side proxy route if you want the browser to trigger `getUsers` while keeping cookies HttpOnly.
- Add unit tests for `NutellaClient` and workflow steps (mock axios responses).
- Wire `NUTELLA_API_HOST` into a config module and validate it at startup using zod.

If you'd like, I can implement the server-side proxy route or add a small example showing how an express/fastify endpoint reads incoming cookies and calls `NutellaClient` on behalf of the browser. Just say which option you prefer and I'll implement it.
