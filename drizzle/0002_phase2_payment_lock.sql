-- Phase 2: atomic per-request payment claim + settlement uniqueness backstop.
--
-- Purely ADDITIVE and idempotent-safe: three new nullable/defaulted columns, a
-- data-preserving backfill, and one PARTIAL unique index. Nothing is dropped,
-- reset, or deleted. Runs identically on PostgreSQL and PGlite.
ALTER TABLE "verification_requests" ADD COLUMN "payment_state" text DEFAULT 'UNPAID' NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD COLUMN "payment_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD COLUMN "payment_claim_tx_id" text;--> statement-breakpoint
-- Backfill: any request that already has a successful settlement is PAID, so a
-- pre-Phase-2 paid request can never be re-opened for a second payment.
UPDATE "verification_requests" AS vr
   SET "payment_state" = 'PAID'
 WHERE EXISTS (
   SELECT 1 FROM "payment_settlements" ps
    WHERE ps."request_id" = vr."id" AND ps."status" = 'SETTLED'
 );--> statement-breakpoint
-- Duplicate detection BEFORE enforcing uniqueness. Settlement rows are payment
-- evidence: if any request already has more than one SETTLED row we abort with
-- an actionable message rather than silently deleting the conflicting rows.
DO $$
DECLARE duplicate_requests int;
BEGIN
  SELECT count(*) INTO duplicate_requests
    FROM (
      SELECT "request_id"
        FROM "payment_settlements"
       WHERE "status" = 'SETTLED'
       GROUP BY "request_id"
      HAVING count(*) > 1
    ) d;
  IF duplicate_requests > 0 THEN
    RAISE EXCEPTION
      'Cred402 migration 0002 aborted: % verification request(s) already have more than one SETTLED payment_settlements row. These rows are payment evidence and are NOT deleted automatically — reconcile them by hand (keep the genuine settlement, mark the others FAILED), then re-run the migration.',
      duplicate_requests;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_settlements_settled_request_idx" ON "payment_settlements" USING btree ("request_id") WHERE "payment_settlements"."status" = 'SETTLED';
