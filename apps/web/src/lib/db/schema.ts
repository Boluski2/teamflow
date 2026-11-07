
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  primaryKey,
  unique,
  index,
  uniqueIndex,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------
// ENUMS
// ---------------------------------------------

export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const invitationRoleEnum = pgEnum("invitation_role", [
  "admin",
  "member",
  "viewer",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "archived",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const invitationEmailStatusEnum = pgEnum(
  "invitation_email_status",
  ["pending", "sending", "sent", "failed"],
);

// ---------------------------------------------
// USERS
// ---------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  // External identity provided by Clerk
  clerkUserId: text("clerk_user_id").notNull().unique(),

  email: text("email").notNull().unique(),

  name: text("name").notNull(),

  avatarUrl: text("avatar_url"),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).notNull().defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  }).notNull().defaultNow(),
});

// ---------------------------------------------
// ORGANIZATIONS
// ---------------------------------------------

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    name: text("name").notNull(),

    slug: text("slug").notNull().unique(),

    description: text("description"),

    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).notNull().defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    index("organizations_created_by_idx").on(table.createdById),
  ],
);

// ---------------------------------------------
// MEMBERSHIPS
// ---------------------------------------------

export const memberships = pgTable(
  "memberships",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    role: organizationRoleEnum("role").notNull().default("member"),

    joinedAt: timestamp("joined_at", {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.organizationId, table.userId],
    }),
    index("memberships_user_idx").on(table.userId),
    index("memberships_organization_role_idx").on(
      table.organizationId,
      table.role,
    ),
  ],
);

// ---------------------------------------------
// INVITATIONS
// ---------------------------------------------

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    email: text("email").notNull(),

    role: invitationRoleEnum("role").notNull().default("member"),

    tokenHash: text("token_hash").notNull().unique(),

    invitedById: uuid("invited_by_id")
   .notNull()
   .references(() => users.id, { onDelete: "restrict" }),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    acceptedAt: timestamp("accepted_at", {
      withTimezone: true,
    }),

    emailStatus: invitationEmailStatusEnum("email_status")
      .notNull()
      .default("pending"),

    emailSentAt: timestamp("email_sent_at", {
      withTimezone: true,
      mode: "date",
    }),

    emailProviderId: text("email_provider_id"),

    emailAttemptCount: integer("email_attempt_count")
      .notNull()
      .default(0),

    emailLastAttemptAt: timestamp("email_last_attempt_at", {
      withTimezone: true,
      mode: "date",
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).notNull().defaultNow(),

  },
  (table) => [
    index("invitations_organization_idx").on(table.organizationId),
    index("invitations_email_idx").on(table.email),
    uniqueIndex("invitations_pending_org_email_unique")
  .on(
    table.organizationId,
    sql`lower(${table.email})`,
  )
  .where(sql`${table.acceptedAt} IS NULL`),
  ],
);

// ---------------------------------------------
// PROJECTS
// ---------------------------------------------

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    name: text("name").notNull(),

    description: text("description"),

    status: projectStatusEnum("status").notNull().default("active"),

    createdById: uuid("created_by_id")
   .notNull()
   .references(() => users.id, { onDelete: "restrict" }),

    startDate: timestamp("start_date", {
      withTimezone: true,
    }),

    dueDate: timestamp("due_date", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).notNull().defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    unique("projects_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("projects_organization_idx").on(table.organizationId),
    index("projects_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
);

// ---------------------------------------------
// TASKS
// ---------------------------------------------

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id").notNull(),

    projectId: uuid("project_id").notNull(),

    parentTaskId: uuid("parent_task_id"),

    title: text("title").notNull(),

    description: text("description"),

    status: taskStatusEnum("status").notNull().default("todo"),

    priority: taskPriorityEnum("priority").notNull().default("normal"),

    assigneeId: uuid("assignee_id"),

    createdById: uuid("created_by_id")
   .notNull()
   .references(() => users.id, { onDelete: "restrict" }),

    dueDate: timestamp("due_date", {
      withTimezone: true,
    }),

    position: integer("position").notNull().default(0),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).notNull().defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).notNull().defaultNow(),

    completedAt: timestamp("completed_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [
        projects.organizationId,
        projects.id,
      ],
      name: "tasks_project_organization_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.projectId, table.parentTaskId],
      foreignColumns: [
        table.organizationId,
        table.projectId,
        table.id,
      ],
      name: "tasks_parent_task_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.assigneeId],
      foreignColumns: [
        memberships.organizationId,
        memberships.userId,
      ],
      name: "tasks_assignee_membership_fk",
    }),
    unique("tasks_organization_project_id_unique").on(
      table.organizationId,
      table.projectId,
      table.id,
    ),
    index("tasks_project_idx").on(table.projectId),
    index("tasks_organization_idx").on(table.organizationId),
    index("tasks_assignee_idx").on(table.assigneeId),
    index("tasks_status_idx").on(
      table.organizationId,
      table.status,
    ),
    index("tasks_due_date_idx").on(table.dueDate),
    check("tasks_position_nonnegative", sql`${table.position} >= 0`),
    check(
      "tasks_not_own_parent",
      sql`${table.parentTaskId} IS NULL OR ${table.parentTaskId} <> ${table.id}`,
    ),
  ],
);
