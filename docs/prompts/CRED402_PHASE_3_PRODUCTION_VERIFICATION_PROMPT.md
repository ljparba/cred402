# Cred402 — Phase 3: Production Verification and Final Status Reconciliation

You are the **Production Verification Orchestrator** for Cred402.

Continue from the current clean local repository state.

This phase has two goals:

1. Prove that the built application runs correctly in local production mode.
2. Resolve the remaining stale Phase 2 wording in `docs/PROGRESS.md`.

Do not push, deploy, rotate keys, reset the main database, re-anchor HCS events, or create a new live x402 settlement unless the owner explicitly authorizes that exact action during this phase.

Create one local checkpoint commit only.

---

# 1. Current source of truth

Use this as the baseline unless direct repository inspection proves otherwise:

- Branch: `master`
- Starting commit: `e59838f`
- Working tree should be clean
- Phase 1 documentation cleanup: complete
- Phase 2 security and repository-readiness audit: complete
- No secrets found in tracked files, Git history, or client bundle
- `npm test`: **86/86 passed**
- Frontend structural guards: **52**
- `npm run verify:samples`: **7/7 passed**
- Lint: passed
- Typecheck: passed
- Production build: passed
- DB-backed tests close naturally
- Mobile/responsive owner acceptance: complete
- Live HCS anchoring: owner-verified on Hedera Testnet
- Real x402 HBAR settlement: owner-verified on Hedera Testnet
- Mirror Node and HashScan evidence: previously observed
- B6 replay rejection and B7 idempotent re-access are not yet recorded as manually run
- Public GitHub push and Render deployment have not happened

---

# 2. Phase scope

Allowed:

- Production-mode local verification
- Safe read-only API and route checks
- Safe local upload/report-gate checks
- Minimal source/config fixes only when a confirmed production issue is found
- Tests required to prove a confirmed fix
- Documentation/status reconciliation
- One local commit

Not allowed without separate explicit owner authorization:

- New live x402 HBAR payment
- New HCS topic message or re-anchoring
- Tamper Demo live registration that writes to HCS
- Key rotation
- Render deployment
- Git push
- Database reset or destructive migration
- Deleting the main `.pglite`
- Printing or logging private keys, signed payment payloads, database credentials, or full secret-bearing environment values

Do not use `process.exit()` as a workaround for a hanging process.

---

# 3. Mandatory initial inspection

Run and record:

```bash
git branch --show-current
git status --short
git log --oneline --decorate -10
```

Inspect:

```text
package.json
next.config.*
tsconfig.json
.env.example
README.md
docs/PROGRESS.md
docs/TESTING.md
docs/OWNER_ACCEPTANCE_TEST.md
docs/BOUNTY_SUBMISSION_CHECKLIST.md
docs/RENDER_DEPLOYMENT.md
docs/KNOWN_LIMITATIONS.md
src/app/api/health/route.ts
src/app/api/verify/route.ts
src/app/api/report/[requestId]/route.ts
src/app/api/samples/route.ts
src/app/api/samples/[slug]/route.ts
```

Confirm the exact production commands from `package.json` instead of assuming them.

---

# 4. Preflight quality gates

Run from a clean state:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Expected:

```text
86 passed
0 failed
clean natural exit
production build succeeds
```

If any command fails:

1. Identify the root cause
2. Make the smallest safe fix
3. Add or update a test where practical
4. Rerun the failed command and the relevant full gate
5. Document the exact issue and fix

Do not proceed to production smoke testing with a failed build.

---

# 5. Production server process management

Start the built app with `npm run start` on a dedicated unused local port.

Preferred:

```bash
npm run start -- -p 3100
```

Use another free port if 3100 is occupied.

Requirements:

- Track the exact process started by this phase
- Do not kill unrelated `node.exe` or other developer processes
- Capture only sanitized logs
- Stop the production server cleanly at the end
- Confirm the port is released after shutdown
- Do not leave orphaned Node processes

Use a second shell/session for HTTP checks where needed.

---

# 6. Production-mode route smoke test

Against the local production server, verify:

## 6.1 Main pages

- `GET /`
- `GET /how-it-works`

Expected:

- HTTP 200
- Cred402 branding present
- No server error page
- No unhandled exception
- No missing production asset
- No hydration/runtime error in available logs

## 6.2 Health endpoint

- `GET /api/health`

Expected:

- HTTP 200
- `status: "ok"`
- `db.ok: true`
- Mode/config booleans match the current environment
- No private key, database password, raw secret, or stack trace
- Only safe public endpoints and booleans are returned

Do not include the full health response in the final report if it contains public account identifiers that the owner has not chosen to publish yet. Summarize safely.

## 6.3 Samples API

- `GET /api/samples`

Expected:

- HTTP 200
- Expected sample catalogue returned
- No private data
- No broken file references

## 6.4 Sample downloads

Check at least:

- one valid sample
- the tampered sample

Expected:

- HTTP 200
- `Content-Type: application/pdf`
- non-empty response
- safe filename/content-disposition where applicable

Do not modify sample files.

---

# 7. Production upload and free-preview verification

Use a known sample file in a safe, read-only verification request:

```text
samples/tampered/data-structures-tampered.pdf
```

Call `POST /api/verify`.

Expected:

- HTTP success
- `locked: true`
- request ID/report URL returned
- hash and safe identification metadata may be present
- no full verdict
- no verification checks
- no payment settlement
- no raw file persistence
- no stack trace or secret leak

Record the resulting request ID only in temporary local output. Do not commit it to docs unless it is intentionally public evidence.

---

# 8. Genuine HTTP 402 production check

Using the request created in the previous step, call:

```text
GET /api/report/<requestId>
```

without payment credentials.

Expected:

- HTTP `402 Payment Required`
- genuine x402 v2 challenge
- `PAYMENT-REQUIRED` header where configuration supports it
- no report verdict
- no verification checks
- no accidental bypass
- no signed payment payload created by this test

Decode the challenge only when needed for validation.

Do not print or commit any signed transaction, payment signature, private key, or bearer-style secret.

Validate safe public fields only:

- x402 version
- scheme
- Hedera testnet network
- HBAR asset
- configured price
- timeout
- public facilitator fee-payer field where present

---

# 9. Configured-mode bypass check

When the production server is running in configured mode, call:

```text
GET /api/report/<requestId>?demo=1
```

without payment.

Expected:

- still HTTP 402
- no full report
- configured mode ignores the unconfigured demo bypass

If the current environment is not configured, do not alter secrets just for this check. Record it as environment-blocked and rely on prior owner verification plus code inspection.

---

# 10. Error-path production checks

Safely verify representative production errors:

- unknown report/request ID → expected typed 404
- invalid upload type → expected typed 415 or documented validation status
- empty upload → expected validation error
- malformed credential ID where applicable → expected typed safe error
- unsupported sample slug → expected typed 404

Expected for all:

- no stack traces
- no filesystem paths
- no SQL details
- no environment secrets
- stable JSON error structure where applicable

Do not fuzz aggressively or send large-volume traffic.

---

# 11. B6 replay rejection and B7 idempotent re-access

These are manual live-path checks and must be handled carefully.

## 11.1 First preference: reuse existing safe evidence

Inspect whether the current local database and existing owner-run acceptance artifacts already contain:

- a paid request ID
- its recorded settlement transaction ID
- enough safe data to re-access the already-paid report

Do not reveal values in the handoff report unless the owner has already designated them as public.

### B7 — idempotent re-access

If an existing paid request is available:

- call `GET /api/report/<paidRequestId>` without another payment
- confirm the same report returns
- confirm no new charge or settlement is created

This is a read-only check and may be run when safe.

## 11.2 B6 replay rejection

Run B6 only if an already-captured payment signature/transaction payload is safely available and reusing it will not create a new valid settlement.

Expected:

```text
HTTP 409 PAYMENT_ALREADY_CONSUMED
```

Do not print the reused signed payload.

## 11.3 No existing reusable evidence

If the required safe artifact is not available:

- do not create a new live payment automatically
- leave B6/B7 open
- state exactly what evidence is missing
- provide the owner with the precise manual command/process to run later
- do not mark the checks passed from code inspection alone

A new testnet settlement requires explicit owner authorization during this phase.

---

# 12. Database and side-effect verification

During production smoke testing, confirm:

- Main `.pglite` is not reset or deleted
- No unexpected migration runs on `npm start`
- No `hedera:anchor` command runs automatically
- No Tamper Demo HCS write occurs without an explicit user action
- No new payment settlement occurs during read-only smoke checks
- Verification-request rows created by the upload test are acceptable local test artifacts
- No sensitive file bytes are persisted

Do not run `reset`, destructive SQL, or cleanup that risks owner data.

---

# 13. Fix the remaining stale wording in `docs/PROGRESS.md`

The current document still has references that treat Phase 2 as future work.

Find and correct wording such as:

- “Remaining work is Phase 2 repository-readiness/security audit...”
- “Remaining before submission: Phase 2 repository readiness...”
- “Optional future follow-ups (Phase 2/3)...”

Update the current status to make the phase sequence unambiguous:

```text
Phase 2 security and repository readiness: COMPLETE
Phase 3 production verification: COMPLETE after this phase passes
Remaining: Phase 4 deployment and submission
```

At the end of this phase, `PROGRESS.md` should accurately state:

- Phase 1 complete
- Phase 2 complete
- Phase 3 complete
- Production-mode local smoke test passed
- `npm run start` passed
- B6/B7 status exactly as actually verified
- Remaining owner actions:
  - decide whether development prompt files stay public
  - public GitHub push
  - Render configuration/deployment
  - deployed-site verification
  - public evidence values
  - demo video
  - bounty submission

Do not claim B6/B7 passed unless they were actually run.

---

# 14. Update acceptance and bounty docs only when supported

Update these only when the phase produces direct evidence:

```text
docs/OWNER_ACCEPTANCE_TEST.md
docs/BOUNTY_SUBMISSION_CHECKLIST.md
docs/TESTING.md
docs/PROGRESS.md
```

Examples:

- Tick `npm run start` only after successful local production boot
- Record production route/API smoke test after it passes
- Tick B6 only after actual 409 replay rejection
- Tick B7 only after actual idempotent re-access
- Leave public GitHub/Render/video/evidence placeholders open

Do not invent public IDs or links.

---

# 15. Final validation after any fixes

After all code/docs changes:

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
git status --short
```

Then perform one final short `npm run start` boot confirmation if source/config changed after the first smoke test.

Expected:

- 86/86 tests
- 0 failures
- natural test exit
- build succeeds
- production server boots
- no secret leak
- no orphan server process
- clean diff check

---

# 16. Commit strategy

Create one local checkpoint commit.

Suggested message when only docs/status changed:

```text
docs: record production verification results
```

Suggested message when a confirmed production issue required a code/config fix:

```text
fix: close production verification findings
```

Requirements:

- One coherent local commit
- Working tree clean after commit
- No `.env`, `.env.local`, `.next`, logs, local DBs, or secret-bearing files staged
- Nothing pushed
- Nothing deployed

---

# 17. Completion criteria

Do not mark Phase 3 complete until:

- Lint passes
- Typecheck passes
- 86/86 tests pass naturally
- Production build succeeds
- `npm run start` boots successfully
- `/` returns 200
- `/how-it-works` returns 200
- `/api/health` is safe and healthy
- Samples API works
- Sample PDF downloads work
- Upload returns a locked preview without verdict/check leakage
- Unpaid report returns genuine HTTP 402
- Configured-mode `?demo=1` is verified or clearly environment-blocked
- Error paths return safe typed responses
- No unexpected live side effects occur
- Production server exits cleanly
- Stale Phase 2 wording is fixed
- B6/B7 are recorded honestly
- `git diff --check` passes
- One local commit exists
- Working tree is clean
- Nothing was pushed or deployed

---

# 18. Final handoff report

Return a concise but complete report with:

## Git

- Branch
- Starting commit
- Ending commit
- Commit message
- Working-tree status
- Confirmation: nothing pushed/deployed

## Quality gates

- Lint
- Typecheck
- Tests
- Build
- Natural test exit

## Production server

- Port used
- Boot result
- Shutdown result
- Confirmation no orphan process remained

## Route/API smoke results

- `/`
- `/how-it-works`
- `/api/health`
- `/api/samples`
- sample downloads
- upload/free preview
- unpaid report 402
- configured `?demo=1`
- error paths

## Security invariants

- no verdict/check leak
- no secret exposure
- no unexpected HCS/payment action
- no DB reset
- main `.pglite` preserved

## B6/B7

- exact status of replay rejection
- exact status of idempotent re-access
- whether existing artifacts were sufficient
- whether owner action remains

## Documentation

- stale Phase 2 wording fixed
- `npm run start` status recorded
- acceptance/checklist updates
- final remaining Phase 4 actions

## Files changed

- list all files
- explain any code/config fix

## Validation

- `git diff --check`
- clean working tree
- server process cleanup

Do not include secrets, signed payment payloads, private keys, or unpublished public evidence identifiers in the report.

---

# 19. Start now

1. Inspect Git and package scripts
2. Run quality gates
3. Start the production server on a dedicated port
4. Run the route/API production smoke matrix
5. Verify 402 and no-leak behavior
6. Check configured-mode bypass behavior
7. Run B6/B7 only when safe existing evidence is available
8. Stop the production server cleanly
9. Fix confirmed issues only
10. Reconcile `PROGRESS.md` and supported checklists
11. Rerun final validation
12. Create one local checkpoint commit
13. Produce the final handoff report

Do not mark checks passed from code inspection alone when the phase requires runtime evidence.
