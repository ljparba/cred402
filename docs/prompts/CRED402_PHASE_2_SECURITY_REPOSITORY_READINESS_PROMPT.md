# Cred402 — Phase 2: Security and Repository Readiness Audit
## Includes the remaining Phase 1 documentation inconsistencies

You are the **Security and Repository Readiness Auditor** for Cred402.

Continue from the current clean local repository state.

This phase has two goals:

1. Perform a focused security and repository-readiness audit before public GitHub push and Render deployment.
2. Resolve the two remaining documentation inconsistencies from Phase 1.

Do not push, deploy, rotate keys, reset databases, reseed the main database, run live x402 settlement, run Tamper Demo registration, or re-anchor HCS events.

Create one local checkpoint commit only.

---

# 1. Current verified state

Use this as the source of truth unless direct repository inspection proves otherwise:

- Branch: `master`
- Latest Phase 1 docs commit: `78c7c92`
- All mobile and responsive owner checks passed
- `npm test` passes with **86/86**
- `tests/frontend-layout.test.ts` contains **52 structural guards**
- `npm run verify:samples` passes **7/7**
- Typecheck passes
- Lint passes
- Production build passes
- DB-backed tests now close PGlite naturally and return to the prompt
- Live HCS anchoring was owner-verified on Hedera Testnet
- A real x402 HBAR settlement was owner-verified
- Mirror Node confirmation and HashScan proof were observed
- Nothing has been pushed or deployed yet
- Replay rejection B6 and idempotent re-access B7 are not yet recorded as run
- `npm run start` production smoke test is not yet recorded as run

---

# 2. Scope

This phase may change:

- Security-related source files only if a confirmed issue requires a safe, minimal fix
- Repository configuration
- `.gitignore`
- `.env.example`
- README/docs/checklists
- Build/deployment configuration
- Test coverage only when needed to prove a security/repository-readiness fix

This phase must not:

- Redesign UI
- Change product scope
- Change pricing
- Change HCS topic or account IDs
- Rotate or reveal secrets
- Make live Hedera writes
- Push to GitHub
- Deploy to Render
- Delete/reset the main `.pglite`
- Add forced `process.exit()`
- Add speculative architecture changes without a confirmed issue

Prefer audit-and-preserve. Change code only for a real, evidenced problem.

---

# 3. Mandatory repository inspection

Inspect at minimum:

```text
git status
git log --oneline --decorate -20
git branch --show-current
package.json
package-lock.json
next.config.*
tsconfig.json
.gitignore
.env.example
README.md
LICENSE
src/
scripts/
tests/
drizzle/
docs/
samples/
public/
```

Confirm:

- Working tree is clean before starting
- No temporary build/test scaffolding remains
- No accidental large files
- No debug files
- No duplicate or abandoned source modules
- No generated secret files
- All expected docs exist
- All package scripts referenced in docs exist

---

# 4. Secrets audit

Perform a careful secrets audit over:

- Current tracked files
- Git index
- Recent commit history
- Client build output after production build
- Logs/config/docs/examples

Search for possible:

- Hedera private keys
- DER/ECDSA/ED25519 key material
- 64-hex private-key-like values
- Mnemonics
- API tokens
- Database credentials
- Connection strings
- Render secrets
- Facilitator secrets
- Demo-payer private keys
- Operator private keys
- `.env.local`
- `.env`
- backup files such as `.bak`, `.old`, `.copy`, `.tmp`

At minimum inspect with equivalent commands such as:

```bash
git ls-files
git status --ignored
git check-ignore .env.local
git log --all -- .env .env.local
git grep -n -I -E "PRIVATE_KEY|MNEMONIC|DATABASE_URL|API_KEY|SECRET|TOKEN"
```

Do not print secret values in the handoff report.

If a potential secret is found:

1. Do not expose it in output
2. Identify whether it is a placeholder, public ID, hash, transaction ID, or real secret
3. Remove it from tracked files if needed
4. Document required owner rotation separately
5. Do not rewrite Git history unless explicitly authorized

---

# 5. Client bundle and server-boundary audit

Verify that no secret values are bundled into client JavaScript.

Inspect:

- Client components importing server config
- `NEXT_PUBLIC_*` usage
- Dynamic environment access
- `src/lib/config.ts`
- HashScan/public-config helpers
- Health endpoint output
- Error responses
- Browser bundle output from `next build`

Confirm:

- Only public values reach client code
- `/api/health` returns booleans/public diagnostics only
- No raw operator account recipient secret or private key is exposed
- No stack trace leaks in production-safe handlers
- No server-only module is imported into client code unless safe
- Server env variable names appearing as public string literals are documented honestly if still present

There is an existing hygiene recommendation:

> Split `publicConfig` into a dedicated client-safe module so `src/lib/config.ts` never enters a client bundle.

Do not implement this automatically unless direct inspection shows it is safe, minimal, and improves the boundary without risking working behavior. If not implemented, record it as a non-blocking recommendation.

---

# 6. Upload and input-security audit

Verify:

- File size limits
- Empty-file rejection
- PDF/PNG/JPEG magic-byte sniffing
- Declared MIME mismatch rejection
- Unsupported file rejection
- File bytes are processed in memory
- Raw uploads are not persisted
- Filenames/labels are safely handled
- Tamper Demo label sanitisation
- Stable demo credential ID cannot be client-selected beyond allowed flow
- Demo issuer/topic/payer are server-forced
- No user-controlled path traversal
- No unsafe HTML rendering
- No command injection through scripts/API inputs
- No sensitive data written to HCS

Do not broaden scope into OCR or malware scanning. Record those as non-goals/limitations where applicable.

---

# 7. x402 and settlement-security audit

Verify and preserve:

- Genuine HTTP 402 before payment
- No verdict/check leak before payment
- Configured mode ignores `?demo=1`
- Exact recipient verification
- Exact tinybar amount verification
- Mirror Node confirms `SUCCESS`
- Transaction ID uniqueness
- Reuse is checked before settlement acceptance
- Idempotent paid report access
- Resource-bound nonce is freshness/TTL only
- Hedera exact scheme does not cryptographically bind resource nonce
- Safe typed errors
- No facilitator response is trusted without independent Mirror proof

Do not perform a live settlement in this phase.

Because B6/B7 are not recorded as owner-run, do not mark them passed merely from code inspection. You may mark implementation coverage as present, while leaving live/manual acceptance open.

---

# 8. HCS security audit

Verify:

- Minimal event envelopes
- No PDFs or PII on-chain
- Issuance/revocation events are versioned
- HashScan links are built safely
- Mirror Node ingestion lag is handled
- Re-seeding does not re-anchor
- Tamper Demo writes only when enabled and on testnet
- No live write occurs during page render or tests
- HCS topic/account values remain public identifiers only
- No private keys appear in logs or docs

Do not run `hedera:anchor`.

---

# 9. Database and test-isolation audit

Verify:

- PGlite dev DB remains separate from isolated test DBs
- `.pglite-test` and `.pglite-demotest` are ignored
- Main `.pglite` is never deleted/reset by tests
- `closeDb()` disposes PGlite/postgres.js correctly
- DB singleton is cleared safely
- Test teardown runs even on setup/test failure
- Migrations are complete and ordered
- Seed is idempotent
- Render/Postgres path does not depend on PGlite-only behavior
- No destructive migration command is hidden in startup scripts

Do not modify schema unless a confirmed critical issue exists.

---

# 10. Repository readiness audit

Confirm public-repo readiness:

- `README.md` complete and accurate
- `LICENSE` present and consistent
- `.gitignore` excludes secrets, local DBs, build output, logs, temp files
- `.env.example` contains placeholders only
- All 13 core docs exist
- Sample files required by the demo are tracked
- No personal/private development files are tracked
- No owner prompt files should be published unless intentionally kept
- No stale screenshots or private notes
- No broken README/doc links
- GitHub URL placeholder is clear until public repo exists
- Package metadata is appropriate
- Scripts work cross-platform where documented
- No absolute local machine paths appear in tracked files
- No references to `C:\Users\...` or private directories
- No accidental references to hidden credentials

Inspect whether `docs/prompts/` should remain public. Preserve it if intentionally part of the development record; otherwise document a recommendation rather than deleting it without evidence.

---

# 11. Deployment-readiness audit

Review `docs/RENDER_DEPLOYMENT.md`, package scripts, and runtime configuration.

Confirm:

- Correct build command
- Correct start command
- Node version compatibility
- Render PostgreSQL instructions
- `DATABASE_URL` handling
- Migration/seed sequence
- Certificate generation requirement
- Health endpoint
- Required environment variables
- Tamper Demo feature flag default
- Production DB persistence
- No PGlite fallback accidentally used in production
- No live anchor command runs automatically on every deployment
- No private keys required at build time if only needed at runtime
- HashScan/Mirror/facilitator public endpoints configured safely

Do not deploy.

---

# 12. Resolve the remaining Phase 1 documentation inconsistencies

Fix these during the same phase.

## 12.1 `docs/PROGRESS.md`

There are historical lines that still say:

- `33 guards (67 total)`
- `Remaining: owner browser visual checks`

These conflict with the current final state.

Either:

- Rewrite them as clearly labelled historical snapshots, or
- Replace/remove them where they read as current status

The current final state must be unambiguous:

```text
86 total tests
52 frontend-layout structural guards
Responsive/mobile owner acceptance complete
```

Do not erase useful development history; label it clearly when preserved.

## 12.2 `docs/BOUNTY_SUBMISSION_CHECKLIST.md`

The document already states that live HCS anchoring and real x402 settlement were owner-verified, but the action boxes remain unchecked.

Reconcile them honestly:

- Mark `hedera:anchor` / HCS population as completed if owner verification clearly confirms it
- Mark real x402 settlement as completed if owner verification clearly confirms it
- Keep exact public evidence fields open until IDs/links are inserted
- Keep replay rejection open unless actually run
- Keep exact transaction ID/HashScan link placeholders open until filled

Separate:

1. **Action completed**
2. **Public evidence value still needs to be recorded**

Do not invent IDs.

---

# 13. Optional minimal fixes

A code/config change is allowed only when the audit finds a confirmed issue.

For every code change:

1. State the exact finding
2. Explain exploitability or readiness impact
3. Make the smallest safe fix
4. Add/update tests when practical
5. Rerun relevant gates
6. Document the change

Do not make purely stylistic refactors.

---

# 14. Validation

Run the following after all changes:

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
git status --short
```

Expected:

```text
86 passed
0 failed
clean natural test exit
```

Do not run `verify:samples` if the dev server is holding the main PGlite DB unless you stop it or explicitly use a safe isolated already-seeded DB.

Do not run live network-write commands.

Also verify:

- No secret-like values were added
- No source map or build artifact is staged
- No `.env.local` staged
- No main `.pglite` changes
- Markdown links resolve
- Current test counts are consistent

---

# 15. Commit strategy

Preferred outcome:

- One local commit for confirmed security/repository fixes plus documentation reconciliation

Suggested commit message:

```text
chore: complete security and repository readiness audit
```

If the audit finds no source/config issue and only docs change, use:

```text
docs: close security readiness audit findings
```

Requirements:

- Working tree clean after commit
- Nothing pushed
- Nothing deployed
- No secret files staged
- Main `.pglite` untouched

---

# 16. Completion criteria

Do not mark Phase 2 complete until:

- Secrets audit completed
- Current tracked files inspected
- Recent history inspected
- Client bundle boundary reviewed
- Upload/input security reviewed
- x402 settlement security reviewed
- HCS safety reviewed
- Database/test isolation reviewed
- Public-repo readiness reviewed
- Render/deployment readiness reviewed
- Remaining Phase 1 inconsistencies fixed
- 86/86 tests pass naturally
- Lint passes
- Typecheck passes
- Build passes
- `git diff --check` passes
- No secret is exposed
- One local checkpoint commit exists
- Working tree is clean
- Nothing was pushed or deployed

---

# 17. Final handoff report

Return a concise but complete report containing:

## Git

- Branch
- Starting commit
- Ending commit
- Commit message
- Working-tree status
- Nothing pushed/deployed confirmation

## Security audit

- Secrets audit result
- Git-history audit result
- Client bundle result
- Health/error exposure result
- Upload/input result
- x402 result
- HCS result
- Database/test-isolation result

## Repository readiness

- `.gitignore`
- `.env.example`
- README/LICENSE/docs
- Broken links
- Local/private paths
- Public repo readiness
- Deployment readiness

## Documentation fixes

- `PROGRESS.md` inconsistency resolution
- `BOUNTY_SUBMISSION_CHECKLIST.md` action/evidence separation
- Final test-count wording
- Final owner-acceptance wording

## Changes

- Files changed
- Exact confirmed findings fixed
- Non-blocking recommendations left for later

## Validation

- Lint
- Typecheck
- Tests
- Build
- `git diff --check`

## Confirmations

- No private keys revealed
- No live Hedera/HCS/x402 actions
- No database reset
- Main `.pglite` preserved
- No push
- No deploy

---

# 18. Start now

1. Inspect git and repository state
2. Audit secrets and history
3. Audit client/server boundaries
4. Audit uploads, x402, HCS, DB/test lifecycle
5. Audit repository and deployment readiness
6. Fix only confirmed issues
7. Resolve the two remaining documentation inconsistencies
8. Run final validation gates
9. Create one local checkpoint commit
10. Produce the final handoff report

Do not stop at recommendations. Fix confirmed safe issues within scope and leave the repository ready for Phase 3 production verification.
