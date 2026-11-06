CREATE TYPE "public"."invitation_role" AS ENUM('admin', 'member', 'viewer');--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "role" SET DATA TYPE "public"."invitation_role" USING "role"::text::"public"."invitation_role";--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "role" SET DEFAULT 'member';--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_pending_org_email_unique" ON "invitations" USING btree ("organization_id",lower("email")) WHERE "invitations"."accepted_at" IS NULL;