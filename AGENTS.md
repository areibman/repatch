# Repository Guidelines

## Project Structure & Module Organization
The Next.js App Router lives in `app/`, where route segments own their UI, server actions, and API routes. Shared UI and form primitives belong in `components/`, reusable hooks in `hooks/`, and TypeScript contracts in `types/`. `lib/` centralizes integrations: `github/` provides a modular GitHub API client with Octokit, caching, and rate limiting; `ai-summarizer.ts` wraps LiteLLM requests to AWS Bedrock; and `supabase/` stores SQL migrations. Keep automation scripts in `scripts/`, static assets in `public/`, and Remotion compositions in `remotion/`.

## Build, Test, and Development Commands
Install dependencies with `bun install`, then launch the local server with `bun dev`. Produce a production bundle via `bun run build` and serve it using `bun start`. Run linting through `bun run lint`, check formatting with `bunx prettier --check .`, and seed demo data using `bun run db:seed`. Render video previews through `bun run preview` before sharing Motion assets.

## Coding Style & Naming Conventions
Write TypeScript using ES modules, 2-space indentation, and descriptive camelCase symbols. Components and pages should use PascalCase file names that mirror their route segment (e.g., `PatchNotesPage.tsx`). Favor Tailwind utility classes composed with `clsx`/`tailwind-merge`, and avoid bespoke CSS unless necessary. All new code must clear the rules in `eslint.config.mjs`; run Prettier with defaults to normalize formatting. Centralize Bedrock model IDs, prompts, and LiteLLM options inside `lib/ai-summarizer.ts` so newsletter tone stays consistent.

## Testing Guidelines
Jest is available but not yet wired into CI, so add targeted `*.test.ts` files alongside the modules you touch. Import helpers from `lib/utils.ts` or dedicated fixtures instead of duplicating setup. Execute suites with `bunx jest --runInBand` for deterministic output, and narrow the scope (`bunx jest lib/github`) while iterating. When touching API routes or summarization logic, cover both happy paths and key error states related to missing credentials or GitHub rate limits.

## Commit & Pull Request Guidelines
Use short, present-tense summaries similar to `proper gh fetch for branches`, and group related changes per commit. Reference issues with `Refs #123` in the body when applicable, and prefer descriptive branch names like `feature/email-drip`. Pull requests should describe the problem, outline the solution, list manual/automated test results, and include screenshots or Loom links for UI updates. Tag reviewers early when adding new environment variables or integrations.

## Security & Configuration Tips
Secrets belong in `.env.local`; never commit API keys or Supabase credentials. For AWS Bedrock access, export `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`, then point LiteLLM at the chosen model. Resend keys must match the audience surfaced in `app/subscribers/page.tsx`, and GitHub tokens should include `public_repo` scope to avoid rate limits. Before emailing or rendering videos, confirm Supabase migrations are applied and background jobs have the necessary environment variables.
