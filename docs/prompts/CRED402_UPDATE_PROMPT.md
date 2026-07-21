# Cred402 — Responsive UI, Dedicated How It Works, and Custom Tamper Demo Update

You are the **Lead Orchestrator and Principal Engineer** for Cred402.

Continue from the current clean repository and existing commits. Inspect the current implementation before changing anything. Coordinate frontend, backend, Hedera, database, QA, security, and documentation workstreams as needed.

Do not ask the owner what task to do next. Make expert implementation decisions, test them, fix failures, and continue until the update is ready for owner acceptance.

Do not push, deploy, expose secrets, or perform irreversible external actions unless explicitly authorized.

---

# 1. Update Goal

Implement three connected improvements:

1. **Fix the homepage and verification-report responsiveness**
2. **Create a dedicated `/how-it-works` page**
3. **Add a controlled “Create Tamper Demo” feature** that lets a reviewer register an original file on Hedera Testnet and later prove that a modified version no longer matches

Preserve all existing Cred402 functionality:

- Genuine HTTP 402 report gate
- Hedera Testnet HCS proof
- x402 settlement
- Original/tampered sample flow
- Existing deterministic verification engine
- Current visual identity, branding, animations, and dark Hedera-inspired design
- Existing database portability and security model

This is an enhancement, not a redesign or rewrite.

---

# 2. Mandatory Repository Inspection

Before editing:

1. Read the current architecture, progress, testing, Hedera, x402, database, owner-acceptance, deployment, and known-limitations documentation.
2. Inspect the homepage, report page, navigation, shared layout, responsive styles, API routes, database schema, Hedera submission helpers, and existing rate-limit/security utilities.
3. Inspect the current mobile behavior at common widths:
   - 320px
   - 360px
   - 390px
   - 430px
   - 768px
4. Identify every current source of horizontal overflow.
5. Update `docs/IMPLEMENTATION_PLAN.md` and `docs/PROGRESS.md` before implementation.

Do not mark the work complete only because code was written.

---

# 3. Navigation and Dedicated Route

Create a real route:

```text
/how-it-works
```

Update navigation everywhere:

- Logo → `/`
- How It Works → `/how-it-works`
- Samples → homepage samples section or a stable samples route
- GitHub → the configured external repository URL
- Verify another → the correct verification start state

The **How It Works** navigation item must never depend on a homepage anchor.

It must work from:

- Homepage
- Scan state
- Payment state
- Verification progress state
- Final report page
- Mobile navigation

---

# 4. Homepage Layout Update

Use this final desktop/tablet direction.

## Row 1 — Sample Certificates

Make **Sample Certificates** a dedicated full-width row.

Requirements:

- Give sample cards enough width and spacing
- Avoid cramped labels and clipped buttons
- Keep all current sample states and actions
- Preserve sample download support
- Use a responsive card grid
- Do not force cards into a narrow fixed-width container

Recommended grid behavior:

- Large desktop: 4 cards per row where space permits
- Normal desktop: 3 cards per row
- Tablet: 2 cards per row
- Mobile: 1 card per row

## Row 2 — How It Works Preview + Live Activity

Place:

- **How It Works preview** on the left
- **Live Activity** on the right

The How It Works preview should be compact and should link to `/how-it-works`.

It should not contain the entire long explanation.

The Live Activity panel may remain vertically scrollable inside its own panel, but the page itself must not gain horizontal scrolling.

---

# 5. Homepage Mobile Requirements

At mobile widths:

## Hero feature cards

These three cards must become **one card per row**:

- HCS Proof
- x402 Payment
- Tamper Detection

## Stats

These four stats must become **one item per row**:

- Certificates Anchored
- Verifications
- HCS Events
- Average Verify Time

Do not use a cramped 2×2 mobile grid.

## Samples

Sample certificate cards must be:

- One per row
- Full available width
- Properly spaced
- No clipped text
- No overlapping buttons
- No fixed widths larger than the viewport

## How It Works preview

Use a clean vertical preview on mobile:

1. Upload
2. Pay via x402
3. Get Report

Each step should be a compact horizontal card or row containing:

- Step number
- Icon
- Title
- Short description

Do not use the current awkward tall centered layout with long text lines.

## Live Activity

- One activity entry per row
- HashScan links must remain tappable
- Long IDs must wrap or truncate safely
- Timestamps and status labels must remain readable

---

# 6. Verification Report Responsive Cleanup

Audit the final report page separately.

## Desktop

Keep the strong multi-column layout, but make all columns flexible.

Requirements:

- Add `min-width: 0` to grid/flex children where necessary
- Long hashes, topic IDs, transaction IDs, request IDs, filenames, and evidence strings must not overflow
- Use safe wrapping, truncation, copy buttons, or expandable values
- Preserve readability of verification checks
- Avoid compressing the center report column excessively

## Mobile layout order

Use a single-column stack in this order:

1. Verdict banner
2. Payment Proof
3. HCS Proof
4. Credential
5. Verification Checks
6. Verification Activity
7. Reference Samples

All sections must be one per row.

Verification check cards must also be one per row.

## Long technical values

Use the correct treatment per value:

- Hashes: monospace, `break-all` or safe middle truncation, copy button
- Transaction IDs: safe wrap or middle truncation, copy button, HashScan link
- Request IDs: safe wrap/truncation
- Filenames: `break-words`
- Evidence descriptions: normal word wrapping
- Never hide the only copy of a proof value

---

# 7. Global Responsive Rules

The entire application must pass a horizontal-overflow audit.

Mandatory:

- No page-level horizontal scrollbar at supported mobile widths
- No child wider than the viewport
- No hard-coded desktop widths on mobile
- Use `min-width: 0` correctly in flex/grid layouts
- Use `max-width: 100%` for media and cards
- Use responsive padding
- Use `overflow-x: hidden` only as a final safety net, not to hide broken layouts
- Preserve keyboard navigation
- Preserve `prefers-reduced-motion`
- Maintain usable tap targets
- Preserve visible focus states

Test all major UI states, not only the homepage.

---

# 8. Dedicated `/how-it-works` Page

Build a polished, expanded page using the existing Cred402 visual system.

The page should explain the product clearly enough that a reviewer understands:

- What Cred402 does
- What it does not do
- Why no login is needed
- How arbitrary/custom uploads behave
- What makes it different
- How Hedera and x402 are actually used
- How the new tamper demo works

## Section A — Hero

Headline direction:

> How Cred402 Works

Core explanation:

> Upload a credential, pay only when you need the full report, and verify it against tamper-evident Hedera records—without creating an account.

Primary actions:

- Verify a Certificate
- Try a Sample
- Create Tamper Demo

## Section B — Full verification flow

Explain the full flow with a visual process:

1. Upload the credential
2. Validate and hash the file in memory
3. Identify the credential
4. Receive a free locked preview
5. Receive a genuine HTTP 402 challenge
6. Settle the testnet HBAR payment
7. Check Hedera evidence
8. Release the deterministic report

Use meaningful diagrams/animations already consistent with the project.

## Section C — What Cred402 checks

Explain the six checks:

- Hash integrity
- Credential known
- Issuer registered
- Not revoked
- Not expired
- HCS evidence

Explain the verdicts:

- VALID
- TAMPERED
- REVOKED
- EXPIRED
- UNREGISTERED_ISSUER
- UNKNOWN

## Section D — What happens with a custom certificate?

Clearly explain:

- Any supported file can be uploaded
- Cred402 does not decide that a document is authentic because it “looks real”
- Verification requires a previously registered proof
- Exact known files can match by SHA-256
- Known PDFs may also identify through an embedded credential ID
- Random unregistered files return `UNKNOWN`
- PNG/JPEG uploads are hash-only because there is no OCR in this MVP

Use this important message prominently:

> Cred402 verifies a file against a previously registered and anchored proof. It does not guess whether an arbitrary document looks authentic.

## Section E — Why there is no login or registration

Explain:

- No password
- No user profile
- No subscription
- No stored wallet session
- No account balance
- No API key for the basic machine-readable flow
- The verification request itself is temporary
- Payment unlocks only the protected report for that request

Clarify that **verifiers** do not need accounts.

## Section F — How credentials normally become verifiable

Explain the issuer side:

1. An issuer creates a credential
2. The original file is hashed
3. The credential and issuer references are registered
4. The issuance event is anchored through HCS
5. Later revocation/correction events may be published
6. Verifiers compare an uploaded file with that prior evidence

State honestly:

> The current testnet proof of concept uses synthetic issuers and demo credentials. Full public issuer onboarding and real-world issuer identity verification are outside the current MVP.

## Section G — What makes Cred402 different

Use a comparison section.

Typical systems may rely on:

- Account registration
- Subscription plans
- Database-only certificate lookup
- Human-only portals
- Optional payment buttons
- Full-document storage

Cred402 combines:

- Accountless verification
- Genuine HTTP 402 payment gating
- Pay-per-report pricing
- File-level SHA-256 tamper detection
- HCS-backed issuance and revocation evidence
- Browser, API, and AI-agent compatibility
- Minimal proof data on-chain
- Independent Mirror Node settlement verification

Do not claim to be globally superior or the world’s first.

Use precise wording:

> Cred402 combines file-integrity verification, issuer status, Hedera event proof, and x402-native payment gating in one focused workflow.

## Section H — Privacy and security

Explain:

- Files are validated and hashed server-side
- Uploaded verification files are not permanently stored
- No PDF or sensitive personal data is written to HCS
- HCS stores only minimal proof information
- Private keys remain server-only
- Payment is independently verified through Mirror Node
- Testnet HBAR has no monetary value
- The project is a proof of concept, not a production identity authority

## Section I — Original vs tampered demonstration

Show:

- Original registered file
- Modified file
- Same demo credential reference
- Different SHA-256
- Clear TAMPERED result

Explain why a visual match is not enough.

## Section J — Who it is for

Compact cards:

- Employers
- Recruitment platforms
- Schools and training providers
- Professional certification bodies
- Application developers
- Autonomous AI agents

---

# 9. New Feature — Create Tamper Demo

Add a controlled feature called:

```text
Create Tamper Demo
```

Purpose:

A reviewer can register an original certificate under the **Cred402 Demo Issuer**, anchor its proof on Hedera Testnet, modify the file, and upload the modified copy to receive a clear `TAMPERED` result.

This is a tamper-integrity demonstration, not real issuer authorization.

## Required flow

### Step 1 — Register original

The user:

- Opens Create Tamper Demo
- Uploads an original PDF, PNG, or JPEG
- Reviews the demo disclaimer
- Submits the registration

The server:

- Validates file type and size
- Hashes the file in memory
- Generates a unique `demoCredentialId`
- Creates a synthetic credential under `Cred402 Demo Issuer`
- Creates a credential issuance event
- Anchors the issuance event on the configured HCS topic
- Stores the minimum registry/index information
- Never stores the uploaded file permanently

### Step 2 — Return a demo reference

After successful registration, return:

- `demoCredentialId`
- Original SHA-256
- HCS topic ID
- HCS sequence number
- Hedera transaction ID
- HashScan link
- Clear next-step instructions

Important technical requirement:

**Do not pretend that a modified arbitrary file can be linked to the original by hash alone.**

Because the modified hash will differ and arbitrary images/PDFs may contain no usable embedded ID, the follow-up tamper check must use an explicit stable reference.

Use the simplest honest MVP design:

- Require the user to provide or select the generated `demoCredentialId` when uploading the modified copy, or
- Persist the current demo session client-side and submit the `demoCredentialId` with the next upload

The API must always receive the stable `demoCredentialId` explicitly for custom demo re-verification.

Do not use OCR or visual similarity claims.

### Step 3 — Upload modified copy

The user:

- Edits the original file locally
- Returns with the generated demo credential ID
- Uploads the modified file
- Requests verification

Cred402:

- Resolves the known demo credential by `demoCredentialId`
- Compares the uploaded SHA-256 with the original anchored SHA-256
- Returns `TAMPERED` when they differ
- Shows both hashes and HCS proof
- Uses the existing x402 report gate unless the orchestrator documents a justified demo-specific flow

Prefer reusing the existing genuine x402 report path so the feature strengthens the full product story.

---

# 10. Demo Registration Disclaimer

Display this before and after registration:

> Demo registration proves whether a file changed after it was anchored. It does not prove that the uploader is a real school, authorized issuer, or owner of the credential.

Also label all created records as:

- Synthetic
- Demo
- Hedera Testnet
- Cred402 Demo Issuer

Never present demo registration as real-world credential issuance.

---

# 11. Abuse Protection

The public demo registration endpoint writes to HCS, so protect it.

Implement practical controls:

- Feature flag, for example `TAMPER_DEMO_ENABLED`
- Testnet-only guard
- Strict upload validation
- Existing maximum upload size
- Server-side rate limiting
- Recommended default: no more than 3 demo registrations per IP per hour
- Request timeout and clear errors
- Prevent duplicate rapid submissions
- Never expose operator keys
- Never accept an arbitrary issuer identity from the public request
- Always force the issuer to `Cred402 Demo Issuer`
- No user-provided HCS topic
- No user-provided transaction payer
- Sanitize display names and credential labels
- Avoid storing raw files
- Log only safe metadata

If the existing deployment environment makes in-memory rate limiting unreliable across instances, implement the minimum reliable database-backed limiter using the existing PostgreSQL/PGlite abstraction.

Document the tradeoff honestly.

---

# 12. Database and HCS Design

Reuse the existing schema and event model where clean.

Add the minimum necessary schema changes for:

- Demo registration lifecycle
- Stable `demoCredentialId`
- Original hash
- HCS coordinates
- Rate-limit state if database-backed
- Created timestamp
- Synthetic/demo source marker

Do not duplicate existing credential, event, or HCS-record structures unnecessarily.

The HCS event must contain minimal proof only:

- Event version
- Event type
- Demo credential ID
- Demo issuer ID
- SHA-256
- Timestamp
- Demo/synthetic marker

No uploaded file or personal document content goes on-chain.

Create a migration and prove it applies cleanly to:

- Fresh PGlite
- Existing local database
- PostgreSQL-compatible production path

Preserve idempotency where appropriate.

---

# 13. Suggested API Surface

The orchestrator may adjust names to fit the current architecture, but the responsibilities must exist.

Possible routes:

```text
POST /api/demo/register
POST /api/demo/verify
GET  /api/demo/[demoCredentialId]
```

Or reuse the existing verification route with explicit mode fields.

Requirements:

- Typed validation
- Clear machine-readable errors
- No stack-trace leaks
- No verdict leakage before payment if using the protected report flow
- Explicit demo marker in all responses
- HCS and HashScan proof returned after registration
- Stable credential reference required for modified-file verification

---

# 14. UI for Create Tamper Demo

Use a clear multi-step interface:

1. Upload original
2. Anchor proof
3. Save demo ID
4. Modify file locally
5. Upload modified copy
6. View tamper result

Add visible progress states:

- Validating file
- Computing SHA-256
- Creating demo credential
- Submitting HCS event
- Waiting for consensus
- Retrieving Mirror Node proof
- Registration complete

Do not use only a generic spinner.

On success, provide:

- Copy demo ID
- Copy original hash
- Open HashScan
- Continue to tamper test
- Start another demo

Mobile must remain single-column with no horizontal scrolling.

---

# 15. Tests

Add automated tests for all new behavior.

## Responsive/UI

- Homepage renders the new layout
- `/how-it-works` route works from all navigation states
- Mobile hero feature cards are one per row
- Mobile stats are one per row
- Mobile samples are one per row
- Mobile report sections are one per row
- No horizontal overflow at 320/360/390/430px
- Long hashes and transaction IDs do not overflow
- Reduced-motion behavior remains valid
- Keyboard navigation remains usable

Use browser/E2E tooling already present. If no browser test framework exists, add the smallest justified setup or create deterministic layout assertions and owner-browser checks.

## Demo registration

- Feature disabled → safe rejection
- Non-testnet → safe rejection
- Invalid file rejected
- Oversized file rejected
- Rate limit enforced
- Original registration creates a demo credential
- Original hash stored
- HCS event envelope is correct
- No raw file persisted
- Stable demo ID returned
- Modified file + demo ID returns TAMPERED
- Original file + demo ID returns VALID
- Unknown demo ID returns UNKNOWN or a clear typed error
- Demo issuer is always forced server-side
- User cannot choose a trusted issuer
- HCS/HashScan proof fields are returned correctly
- Existing sample verification still passes
- Existing x402 payment flow still passes all available tests
- Existing 29 tests remain green or are intentionally expanded and renumbered

## Production gates

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run verify:samples
npm run build
```

Also run configured-mode owner tests that do not expose secrets.

---

# 16. Documentation Updates

Update at minimum:

```text
README.md
docs/ARCHITECTURE.md
docs/IMPLEMENTATION_PLAN.md
docs/PROGRESS.md
docs/HEDERA_SETUP.md
docs/X402_FLOW.md
docs/DATABASE.md
docs/LOCAL_SETUP.md
docs/RENDER_DEPLOYMENT.md
docs/TESTING.md
docs/OWNER_ACCEPTANCE_TEST.md
docs/DEMO_SCRIPT.md
docs/BOUNTY_SUBMISSION_CHECKLIST.md
docs/KNOWN_LIMITATIONS.md
.env.example
```

Document:

- New `/how-it-works` page
- Exact custom-upload behavior
- Stable demo credential ID requirement
- Why arbitrary tampered files cannot be linked by hash alone
- Demo-registration disclaimer
- New environment variables
- Rate-limit behavior
- New database migration
- HCS event format
- Owner acceptance flow
- Render setup changes
- Known limitations

Suggested environment variables:

```dotenv
TAMPER_DEMO_ENABLED=false
TAMPER_DEMO_RATE_LIMIT_MAX=3
TAMPER_DEMO_RATE_LIMIT_WINDOW_SECONDS=3600
```

Use the exact final names implemented.

---

# 17. Owner Acceptance Additions

Add an owner test for:

1. Open `/how-it-works`
2. Confirm all navigation works
3. Confirm no horizontal scrolling on supported mobile widths
4. Register an original custom certificate
5. Copy the generated demo credential ID
6. Open the HCS/HashScan proof
7. Modify the local file
8. Upload the modified file with the demo ID
9. Complete the x402 report flow
10. Confirm `TAMPERED`
11. Confirm original and uploaded hashes differ
12. Confirm the same original file still returns `VALID`
13. Confirm the UI states the demo does not prove issuer identity
14. Confirm rate limiting works
15. Confirm existing synthetic samples and real configured x402 flow remain functional

---

# 18. Completion Criteria

Do not declare this update complete until:

- `/how-it-works` is live and linked everywhere
- Homepage uses the final layout
- Mobile homepage has one-per-row cards/stats/samples
- Report page is fully responsive
- No supported mobile viewport has horizontal scrolling
- Long technical values never escape cards
- Custom original registration works
- HCS proof is created for the custom demo
- Stable demo ID is returned and required
- Modified copy produces `TAMPERED`
- Original copy produces `VALID`
- Demo disclaimer is prominent
- Rate limiting is active
- Existing verification and x402 flows are not broken
- All tests and production gates pass
- Documentation is consistent
- Working tree is clean
- A local checkpoint commit is created
- Nothing is pushed or deployed without owner approval

---

# 19. Final Report

Return a concise final report containing:

- Files and modules changed
- New routes
- New database migration
- New environment variables
- Homepage layout result
- Mobile overflow test result
- Report-page responsive result
- `/how-it-works` content summary
- Custom tamper demo flow
- HCS proof evidence, excluding private keys
- Rate-limit implementation
- Test results
- Build result
- Known limitations
- Exact remaining owner actions
- Commit hash
- Confirmation that nothing was pushed or deployed

---

# 20. Start Now

Begin immediately:

1. Inspect the repository and current configured flow
2. Update the implementation plan and progress tracker
3. Reproduce the mobile overflow problems
4. Implement responsive fixes
5. Create `/how-it-works`
6. Design and implement the controlled custom tamper demo
7. Add migration and tests
8. Run test–fix–retest loops
9. Update documentation
10. Create a local checkpoint commit
11. Produce the final owner handoff report

Do not stop at a plan or partial implementation.
