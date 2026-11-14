CREATE TYPE "public"."task_activity_type" AS ENUM('task_created', 'task_updated', 'task_status_changed', 'task_priority_changed', 'task_assigned', 'task_unassigned', 'task_due_date_changed', 'subtask_created', 'task_deleted', 'comment_created', 'comment_updated', 'comment_deleted');--> statement-breakpoint
CREATE TABLE "task_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"task_id" uuid,
	"actor_id" uuid,
	"actor_name" text NOT NULL,
	"type" "task_activity_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"content" text NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_comments_content_not_empty" CHECK (length(btrim("task_comments"."content")) > 0)
);
--> statement-breakpoint
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_fk" FOREIGN KEY ("organization_id","project_id","task_id") REFERENCES "public"."tasks"("organization_id","project_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_activities_organization_created_idx" ON "task_activities" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "task_activities_task_created_idx" ON "task_activities" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_activities_actor_idx" ON "task_activities" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "task_comments_task_created_idx" ON "task_comments" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_comments_organization_idx" ON "task_comments" USING btree ("organization_id");