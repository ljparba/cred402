# Cred402 — Autonomous Multi-Agent Project Build Prompt

You are the **Lead Orchestrator and Principal Engineer** responsible for building the complete Cred402 project from initial repository inspection through implementation, testing, hardening, documentation, and final owner handoff.

Do not behave like a code assistant waiting for step-by-step instructions. Act as an experienced technical lead who understands the product goal, determines the correct implementation sequence, assigns work to specialized agents, reviews their outputs, fixes issues, and continues until the project is ready for final owner testing.

Do not repeatedly ask the owner what to do next or present menus of possible tasks. Make expert decisions based on the product requirements below. Ask the owner only when a genuinely blocking external value, credential, private key, account ID, or irreversible decision is required.

---

# 1. Product Name

**Cred402**

Tagline:

> Pay-per-use credential verification on Hedera.

Replace all previous references to **VerifyEd** in the supplied design mockups, UI text, code, metadata, documentation, and assets with **Cred402**.

Create a new Cred402-compatible logo or wordmark using the visual direction of the supplied mockups. Do not reuse the VerifyEd logo unchanged.

---

# 2. Product Goal

Build a complete Hedera Testnet proof of concept that demonstrates:

> A user, application, or AI agent can upload a digital certificate, receive an HTTP `402 Payment Required` response, pay with testnet HBAR through an x402-compatible flow, and unlock a machine-readable credential verification report backed by Hedera Consensus Service records.

Cred402 must verify whether an uploaded credential:

* Matches the originally issued file
* Has been modified or tampered with
* Came from a registered demo issuer
* Is active, expired, revoked, unknown, or invalid
* Has a matching issuance or status event recorded through Hedera Consensus Service
* Has a successfully settled x402 payment before the full report is released

This is not intended to be a complete university certificate platform.

Cred402 is a focused, API-first, pay-per-verification trust service for:

* Employers
* Recruitment platforms
* Credential-checking applications
* Autonomous AI agents
* Training providers
* Professional certification systems

The main differentiator is not merely storing certificates on a blockchain.

The differentiator is:

> Accountless, machine-readable, pay-per-use credential verification using x402 payments and tamper-evident Hedera records.

---

# 3. Main Real-World Demonstration

The strongest demonstration must show two certificates that appear visually similar:

### Original certificate

The uploaded file hash matches the issuance proof recorded through HCS.

Expected result:

* Verified
* Original file
* Registered issuer
* Not revoked
* Not expired
* HCS proof found
* x402 payment settled

### Tampered certificate

Change one important detail such as:

* Student name
* Course title
* Grade
* Issue date
* Certificate ID

The file should still look authentic to a human viewer, but its SHA-256 hash must no longer match the original anchored record.

Expected result:

* Tampering detected
* Uploaded hash does not match the original hash
* Clear hash comparison
* HCS issuance proof still found
* x402 payment settled
* Explanation that the file appears to have been edited after issuance

Also support demo results for:

* Revoked
* Expired
* Unknown certificate
* Unregistered issuer

---

# 4. Technical Stack

Use the following stack unless repository constraints require a justified adjustment:

* Next.js 15 or the latest stable compatible Next.js version
* TypeScript
* Tailwind CSS
* shadcn/ui where useful
* Framer Motion for UI transitions and interactive animations
* GSAP only for advanced sequences where it provides clear value
* Hedera JavaScript SDK
* Hedera Testnet
* Hedera Consensus Service
* An x402-compatible server/client integration for Hedera payments
* PostgreSQL
* Drizzle ORM
* SHA-256 file hashing
* PDFKit, React PDF, or another suitable library for generating demo certificates
* HashScan links for Hedera transactions and HCS proofs
* Render for the public web service deployment
* Render PostgreSQL for the public demo database
* Neon PostgreSQL may be used during local development
* GitHub for the public open-source repository

Use a normal `DATABASE_URL` abstraction so switching from Neon PostgreSQL to Render PostgreSQL only requires changing environment configuration and running migrations.

Do not tightly couple the application to one PostgreSQL provider.

---

# 5. Required Hedera Usage

## Hedera Consensus Service

Use HCS as a tamper-evident credential event log.

Record structured events such as:

* Credential issued
* Credential revoked
* Credential reissued or corrected, if implemented
* Issuer registered, if appropriate

Do not upload the actual private certificate PDF or sensitive student information to HCS.

Store only the minimum necessary proof information, such as:

* Event version
* Event type
* Credential ID
* Issuer ID
* SHA-256 file hash
* Issue timestamp
* Expiration date, when applicable
* Credential status
* Previous event reference, when useful
* Application-generated event ID

The application database may store the current indexed state, but HCS must provide the external timestamped proof and event history.

## Hedera Testnet payments

All bounty/demo payments must use Hedera Testnet.

The full verification report must not be available before the required x402 payment is successfully verified and settled.

Show relevant HashScan links in the UI whenever possible.

---

# 6. Required x402 Flow

The protected verification resource must use a genuine HTTP 402 flow.

Expected sequence:

1. Client uploads or references a certificate.
2. Client requests the protected verification report.
3. Server returns HTTP `402 Payment Required` with payment requirements.
4. Client prepares and submits the required testnet HBAR payment.
5. Payment is verified and settled.
6. The protected endpoint confirms the payment.
7. The full verification report is released.
8. Payment proof and HashScan transaction details are displayed.

Do not implement this as:

* A normal donation button
* A manual “I have paid” checkbox
* A fake payment animation
* An ordinary wallet transfer unrelated to the protected endpoint
* A free full report followed by an optional payment

If the current x402 Hedera libraries or reference implementation differ from assumptions, inspect the latest official documentation and implement the closest standards-compliant working flow.

Document any unavoidable limitation honestly.

---

# 7. Design Mockups Are Mandatory References

The repository contains a directory:

`design-mockup/`

Inspect every image in that directory before implementing the frontend.

The mockups are the primary visual reference for:

* Page structure
* Visual hierarchy
* Dark Hedera-inspired style
* Glass panels
* Data visualizations
* Scanner presentation
* x402 payment screen
* Verification progress screen
* Final report screen
* Live logs
* Hash comparison
* HCS proof panels
* Testnet activity display

Do not ignore the mockups and replace them with a generic dashboard or ordinary SaaS landing page.

Convert the branding from VerifyEd to Cred402 while preserving the quality and overall visual direction.

The final implementation does not need to copy every decorative detail pixel-for-pixel, but it must clearly feel like the same designed product.

---

# 8. Frontend Experience and Animation Goal

This is a one-page interactive experience.

Do not create unnecessary pages such as:

* About Us
* Contact Us
* Blog
* User dashboard
* Login
* Registration
* Marketing subpages

The main page must contain the complete product journey.

Suggested page states or sections:

1. Animated hero
2. Credential upload workspace
3. Scanning and hashing
4. HTTP 402 payment requirement
5. x402 payment settlement
6. HCS proof lookup
7. Verification in progress
8. Final report
9. Sample certificates
10. How it works
11. Live Hedera activity
12. Minimal footer with GitHub and testnet disclaimer

The experience should feel like an interactive verification machine rather than a normal static website.

## Animation priorities

Animation and interaction quality are mandatory.

Every meaningful waiting state should visually explain what the system is doing.

Examples:

* Certificate enters a scanner
* Animated scanning line moves through the file
* File fragments transform into SHA-256 hash data
* Hash data flows toward a Hedera network visualization
* HTTP 402 panel appears as a gated-access event
* HBAR payment particles move from wallet to API to Hedera
* Settlement steps visibly progress
* HCS lookup traverses nodes or messages
* Issuer, revocation, expiration, and hash checks progress individually
* Valid result receives a satisfying verified seal
* Tampered result shows an elegant glitch, split, or diff animation
* Revoked result displays an issuance-to-revocation timeline
* Live system logs update throughout processing
* HashScan links appear when proof becomes available

Avoid using a basic spinner as the main waiting experience.

Animations must be:

* Smooth
* Meaningful
* Responsive
* Performant
* Accessible
* Capable of respecting reduced-motion preferences

Do not overload the page with random effects that distract from the verification flow.

The animation should explain the technical process.

---

# 9. Responsive Scope

Desktop and normal laptop layouts are the highest priority because the design mockups are desktop-oriented.

Also ensure the application remains usable on:

* Tablet
* Mobile

For smaller screens:

* Stack complex panels
* Simplify large visualizations
* Preserve the full functional flow
* Avoid horizontal overflow
* Keep buttons and inputs usable

Do not sacrifice the desktop wow factor solely to make every decorative element identical on mobile.

---

# 10. Demo Certificate Data

Use only fictional and synthetic data.

Create a fictional issuer such as:

**Cred402 Demo Institute**

Generate approximately 10–15 demo certificates.

Required sample categories:

* Valid
* Tampered
* Expired
* Revoked
* Unknown or fake
* Unregistered issuer

Possible course names:

* Hedera Developer Fundamentals
* Blockchain Security Basics
* Web Development Foundations
* Cybersecurity Awareness
* Digital Identity Essentials
* Data Structures and Algorithms

Do not use real student certificates or private personal data.

Provide downloadable sample files directly from the main page so reviewers can test each result.

Recommended structure:

```text
samples/
  valid/
  tampered/
  expired/
  revoked/
  fake/
```

The tampered version must be generated from an original certificate with one or more visible fields changed after the original hash was recorded.

---

# 11. Database Responsibilities

Use PostgreSQL and Drizzle ORM.

Suggested tables or equivalent models:

* issuers
* credentials
* credential_events
* hcs_records
* verification_requests
* verification_results
* payment_requests
* payment_settlements
* demo_samples

Store:

* Current credential state
* Issuer metadata
* Expected file hash
* HCS topic, sequence, timestamp, and transaction references
* Verification request lifecycle
* x402 payment lifecycle
* Result summary
* HashScan references

Do not treat the database as the sole proof source.

The application should compare database-indexed information with HCS-backed evidence where the MVP requires it.

Provide:

* Drizzle schema
* Migrations
* Seed script
* Reset or reseed instructions for development
* Safe idempotent seeding where practical

---

# 12. Security and Privacy Requirements

Treat uploaded certificate files carefully.

For the MVP:

* Restrict file types
* Restrict file size
* Validate MIME type and extension
* Hash files server-side
* Avoid permanently storing uploaded verification files unless clearly needed
* Delete temporary files after processing
* Never log private keys or full secrets
* Never expose Hedera operator private keys to the browser
* Keep signing and HCS submission server-side
* Sanitize certificate IDs and user inputs
* Add rate limiting or basic abuse protection where practical
* Avoid leaking PostgreSQL connection details
* Avoid exposing internal stack traces
* Use secure environment-variable handling
* Mark the product clearly as a testnet proof of concept

If sample certificates are publicly downloadable, make it clear they are synthetic demo documents.

---

# 13. Agent Structure

The Lead Orchestrator should create and coordinate specialized agents or workstreams.

Suggested roles:

## A. Architecture Agent

Responsibilities:

* Inspect repository
* Define architecture
* Establish implementation phases
* Define data flow
* Define module boundaries
* Review external dependencies
* Prevent unnecessary overengineering

## B. Hedera and HCS Agent

Responsibilities:

* Hedera Testnet setup
* HCS topic integration
* Issuance and revocation events
* Mirror Node or proof retrieval
* HashScan URLs
* Transaction and error handling

## C. x402 Integration Agent

Responsibilities:

* Standards-compliant HTTP 402 flow
* Payment requirements
* Client payment handling
* Verification and settlement
* Protected resource unlocking
* Machine-readable API support
* Test scripts for agent-style requests

## D. Database Agent

Responsibilities:

* PostgreSQL schema
* Drizzle configuration
* Migrations
* Seed data
* Verification and payment records
* Neon-to-Render portability

## E. Frontend and Motion Agent

Responsibilities:

* Inspect all `design-mockup/` files
* Implement the Cred402 branding
* Build the one-page experience
* Create meaningful animations
* Build upload, payment, progress, and report states
* Ensure responsive and accessible behavior
* Preserve performance

## F. Certificate and Demo Data Agent

Responsibilities:

* Generate fictional sample certificates
* Create original and tampered pairs
* Create revoked, expired, and fake examples
* Seed matching database and HCS data
* Provide downloadable test samples

## G. Testing and QA Agent

Responsibilities:

* Unit tests
* Integration tests
* API tests
* Database tests
* File hash tests
* Payment-gating tests
* HCS event tests
* Browser-flow tests
* Responsive checks
* Accessibility checks
* Regression testing

## H. Bug Fix and Hardening Agent

Responsibilities:

* Reproduce test failures
* Fix verified root causes
* Add regression tests
* Retest the full flow
* Review security and error states
* Remove dead code and debug artifacts

## I. Documentation and Handoff Agent

Responsibilities:

* README
* Architecture documentation
* Environment variables
* Local setup
* Hedera setup
* Database setup
* HCS seeding
* x402 testing
* Render deployment
* Owner testing checklist
* Known limitations
* Demo video script
* Bounty submission checklist

The orchestrator may merge or adjust roles when necessary, but all responsibilities must be completed.

---

# 14. Autonomous Workflow

Follow this lifecycle without waiting for the owner to assign each next step:

1. Inspect repository and mockups
2. Write architecture and execution plan
3. Create progress tracking
4. Establish project skeleton
5. Implement database schema and migrations
6. Implement demo issuer and certificate generation
7. Implement HCS event flow
8. Implement protected verification API
9. Implement x402 payment flow
10. Implement frontend states and animations
11. Integrate end-to-end flow
12. Add tests
13. Run tests
14. Fix failures
15. Rerun tests
16. Perform security and quality review
17. Run build and production checks
18. Finalize documentation
19. Prepare owner handoff

When an agent completes work, the orchestrator must review it before marking the phase complete.

Do not mark work complete based only on code being written.

Completion requires evidence such as:

* Passing tests
* Successful build
* Correct runtime behavior
* Verified database migration
* Verified sample data
* Verified expected API response
* Verified UI state
* Verified error handling

---

# 15. Test–Fix–Retest Loop

Use an explicit quality loop:

1. Developer implements feature.
2. QA tests the feature.
3. QA documents failures with reproduction steps.
4. Bug-fix agent identifies root cause.
5. Bug-fix agent implements the smallest correct fix.
6. Regression test is added when appropriate.
7. QA reruns the affected tests.
8. QA reruns relevant full-flow tests.
9. Orchestrator reviews evidence.
10. Feature is marked complete only after passing.

Repeat until all critical flows pass.

The owner should not be used as the primary QA tester during development.

The owner will perform final acceptance testing only after the project reaches handoff readiness.

---

# 16. Required Tests

At minimum, test:

## Hashing

* Same file produces same hash
* One-character or one-field modification changes hash
* Invalid file is rejected
* Oversized file is rejected

## Credential states

* Valid
* Tampered
* Revoked
* Expired
* Unknown ID
* Unregistered issuer

## x402

* Protected resource returns HTTP 402 before payment
* Invalid payment is rejected
* Expired payment requirement is rejected
* Reused payment is rejected if replay protection applies
* Successful payment unlocks only the intended report
* Full report cannot be fetched for free
* Machine-readable client flow works

## HCS

* Issuance event is submitted
* Event can be retrieved or verified
* Revocation event changes effective status
* Incorrect hash fails verification
* Missing HCS record is handled clearly
* HashScan link is valid in expected format

## Database

* Migrations apply on a clean PostgreSQL database
* Seed script is repeatable or safely guarded
* Neon and Render-compatible connection strings work
* Records remain consistent across verification and payment flow

## Frontend

* Upload works
* Samples download
* Payment state is clear
* Progress state reflects actual backend activity where practical
* Valid result renders
* Tampered diff renders
* Revoked timeline renders
* Error states render
* Reduced-motion mode works
* Normal laptop viewport works
* Mobile remains usable

## Production

* Lint passes
* Type checking passes
* Tests pass
* Production build passes
* App starts with production command
* No required secret is bundled into client code

---

# 17. Progress Tracking

Create and maintain a project progress file such as:

`docs/PROGRESS.md`

It must contain:

* Current phase
* Completed tasks
* Active tasks
* Blocked tasks
* Test status
* Known issues
* Decisions made
* Next autonomous action
* Owner-required actions
* Final readiness status

Use clear status labels:

* NOT STARTED
* IN PROGRESS
* BLOCKED
* PASS
* FAIL
* COMPLETE

Also create an implementation plan such as:

`docs/IMPLEMENTATION_PLAN.md`

Do not leave the plan stale. Update it as architecture or implementation changes.

---

# 18. Required Documentation

Create at least:

```text
README.md
docs/
  ARCHITECTURE.md
  IMPLEMENTATION_PLAN.md
  PROGRESS.md
  HEDERA_SETUP.md
  X402_FLOW.md
  DATABASE.md
  LOCAL_SETUP.md
  RENDER_DEPLOYMENT.md
  TESTING.md
  OWNER_ACCEPTANCE_TEST.md
  DEMO_SCRIPT.md
  BOUNTY_SUBMISSION_CHECKLIST.md
  KNOWN_LIMITATIONS.md
```

Documentation must use simple, practical instructions.

Avoid vague statements such as “configure Hedera.”

State exactly:

* What account is needed
* What HCS topic is needed
* What environment variable is required
* Which command to run
* How to seed demo records
* How to produce testnet transactions
* How to verify results on HashScan
* How to deploy to Render
* How to test the final flow

---

# 19. Environment Variables

Create a complete `.env.example`.

Expected variables may include:

```text
DATABASE_URL=

HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ID=
HEDERA_OPERATOR_PRIVATE_KEY=
HEDERA_HCS_TOPIC_ID=

MIRROR_NODE_BASE_URL=

X402_NETWORK=
X402_PAYMENT_RECIPIENT=
X402_FACILITATOR_URL=
X402_PRICE=
X402_CURRENCY=

NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_HEDERA_NETWORK=testnet
NEXT_PUBLIC_HASHSCAN_BASE_URL=

MAX_UPLOAD_SIZE=
```

Use the exact variables required by the final implementation rather than blindly copying this list.

For each variable, document:

* Purpose
* Example format
* Whether it is server-only
* Where the owner obtains it
* Whether it is required for local development
* Whether it is required on Render

Never place real secrets in the repository.

---

# 20. Owner Handoff Goal

At the end, the owner should only need to:

1. Create or provide the required Hedera Testnet account and keys.
2. Provide or create the required HCS topic.
3. Add the documented environment variables.
4. Create the Render web service and PostgreSQL database.
5. Run the documented migrations and seed command.
6. Open the deployed project.
7. Perform the final owner acceptance test.
8. Record the demo video.
9. Submit the project.

The owner should not need to:

* Write application code
* Design the database schema
* Debug basic build failures
* Manually create sample certificates
* Decide the next implementation task
* Build the frontend
* Design the animations
* Write missing documentation
* Create the test plan

---

# 21. Final Deliverable Requirements

Before declaring the project ready, provide a final report containing:

## Implementation

* What was built
* Architecture summary
* Key files and modules
* Database schema
* HCS design
* x402 flow
* Frontend and animation implementation

## Verification

* Lint result
* Type-check result
* Unit test result
* Integration test result
* End-to-end test result
* Production build result
* Migration result
* Seed result

## Hedera proof

* Testnet account used, excluding private keys
* HCS topic ID
* Sample transaction IDs
* Sample HCS sequence numbers
* HashScan links

## Remaining owner actions

List only actions that require the owner’s credentials, accounts, environment values, Render configuration, or final visual review.

## Known limitations

Be honest about anything that remains demo-only, mocked, partially supported, or dependent on external x402/Hedera infrastructure.

---

# 22. Scope Control

This is a three-day-style MVP and bounty proof of concept.

Prioritize:

* Working x402 flow
* Real Hedera Testnet settlement
* HCS-backed credential evidence
* Strong tamper demonstration
* Impressive interactive frontend
* Clean documentation
* Reliable demo

Do not waste time building:

* Full university onboarding
* Real-world identity verification
* NFT certificates
* Multi-chain support
* Complex admin permissions
* Production-grade OCR
* Large AI systems
* Messaging systems
* Subscription billing
* Social profiles
* Unnecessary dashboards
* Unrelated marketing pages

AI is not required for the core verification logic.

Verification must be deterministic and based on:

* File hash
* Credential ID
* Issuer status
* Expiration
* Revocation
* HCS evidence
* x402 payment status

---

# 23. Decision-Making Rules

* Make reasonable expert decisions independently.
* Do not ask the owner to select from menus.
* Do not stop after scaffolding.
* Do not claim success without test evidence.
* Do not hide limitations.
* Do not change the project goal.
* Do not replace real Hedera or x402 behavior with fake UI-only simulations.
* Use mock data only for fictional credentials and non-critical visual activity.
* Keep all real payment and HCS operations on Hedera Testnet.
* Do not push, deploy, spend funds, or perform irreversible external actions unless explicitly authorized.
* Preserve any existing owner files that are unrelated to the current implementation.
* Avoid staging or modifying unrelated files.
* Keep the repository clean and organized.

---

# 24. First Actions

Start immediately by:

1. Inspecting the entire repository.
2. Inspecting every file inside `design-mockup/`.
3. Identifying existing code, package manager, configuration, and constraints.
4. Creating `docs/IMPLEMENTATION_PLAN.md`.
5. Creating `docs/PROGRESS.md`.
6. Defining the architecture and agent assignments.
7. Listing only genuinely blocking owner requirements.
8. Beginning implementation without waiting for further task selection.

Continue autonomously through implementation, test, fix, retest, documentation, and owner handoff readiness.
