# AGENTS.md — Repository rules

## Mandatory formatting for AI agents

- Whenever you create or change files in this project, run `pnpm format` at the repository root after the changes and before the final checks. Format the whole project, including `components/ui`, without waiting for the user to ask.
- After the last change, run `pnpm format:check` and fix any failure before finishing the task. If you need to edit again, repeat the formatting and the check.
- Use Oxfmt and the `.oxfmtrc.json` configuration; keep the exclusions for dependencies, builds and generated metadata. Do not create exclusions for code maintained in the project just to avoid formatting it.
- If formatting fails or cannot be run, state the reason in the final answer. Do not claim it passed without running the check.

## React Router

- The app uses React Router 8 Framework Mode with Vite and SSR. Routes are explicit in `app/routes.ts`.
- Data and permissions live in loaders; mutations live in actions. Use `.server.ts` modules for private code and preserve the boundary validated by the build.
- Run `pnpm typecheck`, `pnpm lint`, tests and build when changing the application. The runtime and the container use Node 26.12.0.

---

## 1. Code Standards and Control Flow

### 1.1. Strict Ban on `else` and `else if`

- **Never use `else` or `else if`**. Chained conditional structures increase cyclomatic complexity and obscure the primary flow.
- All divergent logic must be handled through **Early Returns**, guard clauses, polymorphism or structured mappings (dictionaries/hashmaps).

### 1.2. Mandatory Early Return (Guard Clauses)

- Handle error conditions, limits and exceptions right at the start of the method/function.
- The success flow ("happy path") must always stay at the main indentation level, with no unnecessary nesting.

```typescript
// Incorrect
export async function requireUser(returnTo: string): Promise<UserSession> {
  const current = await getUserSession();
  if (current) {
    if (getEnv().REQUIRE_EMAIL_VERIFICATION && !current.user.emailVerified) {
      redirect(`/verificar-email?voltar=${encodeURIComponent(returnTo)}`);
    } else {
      return current;
    }
  } else {
    redirect(`/entrar?voltar=${encodeURIComponent(returnTo)}`);
  }
}

// Correct (features/auth/server/participant-session.server.ts)
export async function requireUser(returnTo: string): Promise<UserSession> {
  const current = await getUserSession();
  if (!current) redirect(`/entrar?voltar=${encodeURIComponent(returnTo)}`);
  if (getEnv().REQUIRE_EMAIL_VERIFICATION && !current.user.emailVerified) {
    redirect(`/verificar-email?voltar=${encodeURIComponent(returnTo)}`);
  }
  return current;
}
```

### 1.3. Systematic Null & Undefined Checks

- Validate null/undefined references before accessing any property or method.
- Use the language's defensive operators where applicable (`?.`, `??`), but prefer explicit guard clauses at the input boundary of functions.
- Fail Fast: if a null dependency or argument makes the flow impossible, throw the exception immediately or return the expected null/empty state.

---

## 2. Git & GitHub: Atomic Commits and Best Practices

### 2.1. Atomic Commits

- Each commit must contain **a single logical unit of work**.
- Do not mix refactoring with new features or bug fixes.
- An atomic commit must keep the codebase always compiling and passing all automated tests.
- Keep style formatting separate from functional changes.

### 2.2. Message Format (Conventional Commits)

- Use the **Conventional Commits** format, always in English (see `docs/adr/0004-language-and-naming.md`):
- `feat`: new feature
- `fix`: bug fix
- `refactor`: code change that doesn't alter external behavior
- `test`: adding or adjusting tests
- `docs`: documentation-only changes
- `chore`: maintenance of build, dependencies or auxiliary tooling
- `perf`: performance improvement without behavior change
- `ci`: CI and workflow changes

- Scopes in use: `room`, `auth`, `account`, `admin`, `mascot`, `home`, `ui`, `server`, `db`, `deploy`, `ci`, `docs`.
- The first line must be imperative and concise (72 characters max):

```bash
feat(auth): validate null session before token generation
fix(checkout): add early return for expired coupons
```

### 2.3. Push and Continuous Integration Best Practices

- `main` is protected: changes land only through a PR, the CI checks must pass and the branch must be up to date with `main`.
- One branch per theme (`feature/`, `fix/`, `refactor/`, `docs/`), one PR per branch.
- Before pushing changes, rebase locally onto the main branch to keep history linear and resolve divergences early:

```bash
git fetch origin
git rebase origin/main
```

### 2.4. Pull Requests and Review

- PRs are merged with a merge commit, which keeps the atomic commits in `main`'s history.
- Make sure the test suite and linters pass locally before opening the PR.
- Do not commit temporary files, credentials, environment files (`.env`) or compiled dependencies.
