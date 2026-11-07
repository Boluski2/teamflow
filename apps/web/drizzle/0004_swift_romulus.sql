CREATE TYPE "public"."invitation_email_status" AS ENUM('pending', 'sending', 'sent', 'failed');--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "email_status" "invitation_email_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "email_provider_id" text;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "email_attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "email_last_attempt_at" timestamp with time zone;