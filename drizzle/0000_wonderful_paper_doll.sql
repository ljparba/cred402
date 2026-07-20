CREATE TABLE "credential_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"credential_id" text,
	"issuer_id" text NOT NULL,
	"sha256" text,
	"status" text,
	"issued_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"prev_event_id" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer_id" text NOT NULL,
	"student_name" text NOT NULL,
	"course_name" text NOT NULL,
	"grade" text,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"sha256" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_samples" (
	"slug" text PRIMARY KEY NOT NULL,
	"credential_id" text,
	"category" text NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"filename" text NOT NULL,
	"expected_verdict" text NOT NULL,
	"sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hcs_records" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"sequence_number" bigint NOT NULL,
	"consensus_timestamp" text,
	"transaction_id" text NOT NULL,
	"running_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issuers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"registered" boolean DEFAULT true NOT NULL,
	"hedera_topic_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"scheme" text DEFAULT 'exact' NOT NULL,
	"network" text NOT NULL,
	"asset" text NOT NULL,
	"amount" text NOT NULL,
	"pay_to" text NOT NULL,
	"fee_payer" text,
	"max_timeout_seconds" integer DEFAULT 180 NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_settlements" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"payment_request_id" text,
	"transaction_id" text NOT NULL,
	"payer" text,
	"pay_to" text NOT NULL,
	"amount" text NOT NULL,
	"consensus_timestamp" text,
	"mirror_verified" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"hashscan_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"uploaded_filename" text,
	"uploaded_size" integer,
	"uploaded_mime" text,
	"sha256" text NOT NULL,
	"credential_id" text,
	"issuer_id" text,
	"nonce" text NOT NULL,
	"nonce_expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'AWAITING_PAYMENT' NOT NULL,
	"preview_verdict" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_results" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"verdict" text NOT NULL,
	"checks" jsonb NOT NULL,
	"uploaded_hash" text NOT NULL,
	"anchored_hash" text,
	"hcs_sequence_number" bigint,
	"hcs_transaction_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_credential_id_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_issuer_id_issuers_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_samples" ADD CONSTRAINT "demo_samples_credential_id_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hcs_records" ADD CONSTRAINT "hcs_records_event_id_credential_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."credential_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_request_id_verification_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."verification_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settlements" ADD CONSTRAINT "payment_settlements_request_id_verification_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."verification_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_settlements" ADD CONSTRAINT "payment_settlements_payment_request_id_payment_requests_id_fk" FOREIGN KEY ("payment_request_id") REFERENCES "public"."payment_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_results" ADD CONSTRAINT "verification_results_request_id_verification_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."verification_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credential_events_credential_idx" ON "credential_events" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "credentials_sha256_idx" ON "credentials" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "credentials_issuer_idx" ON "credentials" USING btree ("issuer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hcs_records_event_idx" ON "hcs_records" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hcs_records_topic_seq_idx" ON "hcs_records" USING btree ("topic_id","sequence_number");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_settlements_tx_idx" ON "payment_settlements" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "verification_requests_sha256_idx" ON "verification_requests" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "verification_requests_nonce_idx" ON "verification_requests" USING btree ("nonce");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_results_request_idx" ON "verification_results" USING btree ("request_id");