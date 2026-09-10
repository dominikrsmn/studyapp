# Codex Working Agreement

## Core principles

- Prefer the simplest correct solution.
- Use YAGNI aggressively.
- Prefer existing patterns over new architecture.
- Prefer local changes over broad refactors.
- Do not optimize for theoretical extensibility or architectural purity.
- A little duplication is better than the wrong abstraction.

## Scope

Only change what the task requires.

Do not add unrelated:

- refactors
- abstractions
- validation
- error handling
- comments/docs
- tests
- file reorganizations

Do not clean up neighboring code unless necessary.

Do not create Markdown documentation, implementation notes, changelogs, summaries, or similar files unless explicitly requested.

## Prisma / Database

For normal schema changes:

- modify `schema.prisma` only
- do not create a migration
- do not run a migration
- do not apply schema changes to a database

`prisma/migrations/**` is off-limits unless the user explicitly asks for migration work.

**Never hand-write, manually create, or manually edit Prisma migration SQL/files.**

Do never write or apply a migration!!

After you've done database changes, you are allowed to run prisma generate, in order to get type safety

## Tests

- Do not create tests unless explicitly requested.
- Do not run tests unless explicitly requested.
- Only adjust existing tests if the requested change directly requires it.

## Abstractions

Do not extract helpers merely to shorten code.

Create an abstraction only when it:

- is meaningfully reused
- isolates genuinely complex logic
- represents an important domain concept
- clearly improves readability

One or two usages alone do not justify extraction.

Avoid tiny helpers, unnecessary wrappers, single-use interfaces, factories, repositories, strategies, etc. without concrete need.

Keep straightforward logic together.

## Defensive code

Trust established types and invariants inside the application.

Do not add redundant validation for values already guaranteed by:

- TypeScript
- DTO/schema validation
- database constraints
- trusted internal code

Validate at real boundaries such as user input, external APIs, files, or LLM output.

Do not defend against hypothetical impossible states.

## Comments & documentation

Prefer self-explanatory code.

Only comment non-obvious:

- intent
- constraints
- invariants
- business rules
- workarounds

Do not restate the code.
Do not add JSDoc automatically.
Do not create documentation files unless explicitly requested.

## TypeScript

- Prefer precise types over `any`.
- Avoid unnecessary casts.
- Avoid redundant runtime checks.
- Avoid complex generics or utility types without clear value.

Type safety should simplify code, not make it more abstract.

## Frontend

- Follow existing components and patterns.
- Use utility classes for layout, spacing, typography, and responsiveness.
- Use theme colors only.
- Do not create reusable components for simple one-off UI.

## Hard boundaries

- Never access outside the workspace.
- Never expose secrets or environment variables.
- Do not modify generated artifacts.
- Do not modify or scan `node_modules/**`.
- Do not bypass WSL into Windows.

## Commands

Ask before:

- installing dependencies
- modifying lockfiles
- Docker commands
- Prisma migration/seed commands
- network-facing commands
- dev servers
- Git commands that modify repository state

Never run unless explicitly requested:

- migration application
- destructive DB commands
- `curl`, `wget`, `ssh`, `scp`
- `rm -rf`
- `git push`

## Workflow

If the task is clear, proceed without unnecessary questions.

Inspect the relevant existing code and choose the smallest coherent solution.

Afterwards, briefly state:

- what changed
- what was verified
- anything the user needs to do

Do not persist this summary into the repository.

## Decision rule

When multiple solutions work, prefer:

1. fewer concepts
2. fewer abstractions
3. fewer files
4. less indirection
5. less code
6. easier readability

Complexity must justify itself.
