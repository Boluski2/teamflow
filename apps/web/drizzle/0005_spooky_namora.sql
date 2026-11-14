ALTER TABLE "projects" 
ADD CONSTRAINT "projects_dates_valid_check" CHECK (
        "projects"."start_date" IS NULL
        OR "projects"."due_date" IS NULL
        OR "projects"."due_date" >= "projects"."start_date"
      );