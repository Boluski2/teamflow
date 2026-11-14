# Teamflow

Teamflow is a collaborative project and task management application built with Next.js. It includes Clerk authentication, organization and membership management, role-based permissions, email invitations, project and task workflows, task comments and activity history, and in-app notifications.

## Features

- Create organizations and manage members with `owner`, `admin`, `member`, and `viewer` roles.
- Invite people by email, resend invitations, and accept invitations using a verified email address.
- Create and archive projects, organize tasks and subtasks, assign work, set status, priority, and due dates.
- Discuss tasks with comments and review task activity history.
- Receive in-app notifications for task assignments, unassignments, status changes, and priority changes; view, refresh, and mark notifications as read.
- Receive due-soon reminders for assigned, incomplete tasks due within the next 24 hours. A scheduled cron request creates each reminder once per task due date.
- View organization dashboards and project summaries.

## Repository layout

```text
.
├── README.md
└── apps/
    └── web/                     # Next.js web application
        ├── drizzle/             # PostgreSQL schema migrations
        └── src/
            ├── app/             # App Router pages and API routes
            └── lib/             # Authentication, database, invitation, and organization logic
```

## Technology

- Next.js 16 App Router and React 19
- TypeScript and Tailwind CSS 4
- Clerk authentication
- Drizzle ORM and Drizzle Kit
- Neon serverless PostgreSQL
- Resend and React Email for invitation email rendering and delivery
- Vitest for unit and route tests

## Prerequisites

- Node.js 22.12 or newer (required by the current Vitest version)
- npm
- A Clerk application
- A Neon PostgreSQL database

## Getting started

1. Clone the repository and enter the web application directory:

   ```bash
   git clone https://github.com/Boluski2/teamflow.git
   cd teamflow/apps/web
   ```

2. Install dependencies (including the Resend and React Email packages):

   ```bash
   npm install
   ```

3. Create `apps/web/.env.local` with the Clerk and database credentials:

   ```dotenv
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
   ```

   Keep real credentials private. Environment files are ignored by Git. `DATABASE_URL` is required for database access and migrations.

4. To configure the invitation email sender, also add the Resend API key, a verified sender address, and the public application URL:

   ```dotenv
   RESEND_API_KEY=re_...
   RESEND_FROM_EMAIL=TeamFlow <invitations@example.com>
   APP_URL=http://localhost:3000
   CRON_SECRET=replace-with-a-long-random-secret
   ```

   The invitation API sends email through Resend. If delivery fails because configuration or the provider is unavailable, the invitation is still created and the API response reports the delivery status. `CRON_SECRET` protects the due-soon notification endpoint; configure the same value in the scheduler and send it as a bearer token.

5. Apply the checked-in migrations:

   ```bash
   npm run db:migrate
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000).

## API routes

All routes require a valid authenticated user unless noted otherwise. The server synchronizes the Clerk identity with the Teamflow user record before organization and invitation operations.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/me` | Return the current authenticated user. |
| `GET` | `/api/organizations` | List organizations the current user belongs to. |
| `POST` | `/api/organizations` | Create an organization and its owner membership. |
| `GET` | `/api/organizations/:organizationId` | Return organization details for a member. |
| `PATCH` | `/api/organizations/:organizationId` | Update organization name or description; requires the `organization.update` permission. |
| `GET` | `/api/organizations/:organizationId/invitations` | List invitations for an organization. |
| `POST` | `/api/organizations/:organizationId/invitations` | Create an invitation and attempt to email it; requires the appropriate organization permission. Returns delivery status while keeping the raw token private. |
| `POST` | `/api/organizations/:organizationId/invitations/:invitationId/resend` | Renew an unaccepted invitation and send a fresh email; rotates its token and seven-day expiry. An active delivery attempt returns a conflict. |
| `POST` | `/api/invitations/accept` | Accept an invitation using the authenticated user’s verified email. |
| `GET` | `/api/organizations/:organizationId/members` | List organization members. |
| `GET` / `POST` | `/api/organizations/:organizationId/projects` | List or create projects. |
| `GET` / `PATCH` | `/api/organizations/:organizationId/projects/:projectId` | View or update a project. |
| `GET` / `POST` | `/api/organizations/:organizationId/projects/:projectId/tasks` | List or create project tasks. |
| `GET` / `PATCH` / `DELETE` | `/api/organizations/:organizationId/projects/:projectId/tasks/:taskId` | View, update, or delete a task. |
| `GET` / `POST` | `/api/organizations/:organizationId/projects/:projectId/tasks/:taskId/comments` | List or add task comments. |
| `PATCH` / `DELETE` | `/api/organizations/:organizationId/projects/:projectId/tasks/:taskId/comments/:commentId` | Edit or delete a task comment. |
| `GET` | `/api/organizations/:organizationId/projects/:projectId/tasks/:taskId/activities` | List task activity history. |
| `GET` | `/api/organizations/:organizationId/notifications` | List notifications for the current user. |
| `GET` | `/api/organizations/:organizationId/notifications/unread-count` | Get the current user’s unread notification count. |
| `PATCH` | `/api/organizations/:organizationId/notifications/:notificationId` | Mark a notification as read. |
| `PATCH` | `/api/organizations/:organizationId/notifications/read-all` | Mark all notifications as read. |
| `GET` | `/api/cron/due-soon` | Create notifications for assigned, incomplete tasks due within the next 24 hours. Requires `Authorization: Bearer <CRON_SECRET>`; call from a scheduled job. |

Organization membership roles are `owner`, `admin`, `member`, and `viewer`. Invitation roles are `admin`, `member`, and `viewer`. Invitation tokens are stored as hashes, expire, and can be accepted only once by a matching email address. Invitation records also track email status, provider ID, delivery time, and attempt metadata. Delivery claims are atomic; a `sending` attempt can be reclaimed after five minutes if it becomes stale.

## Available commands

Run these from `apps/web`:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run unit and API route tests. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npx vitest run --config vitest.integration.config.ts` | Run Neon-backed integration tests. |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema. |
| `npm run db:migrate` | Apply migrations to the configured database. |
| `npm run db:studio` | Open Drizzle Studio for the configured database. |

Integration tests load `.env.local` and use the configured `DATABASE_URL`. Run them against a development or test database; they create and clean up fixture records.

## Data model and migrations

The Drizzle schema is in `apps/web/src/lib/db/schema.ts`; SQL migrations are in `apps/web/drizzle/`. The schema covers users, organizations, memberships, invitations, projects, tasks, task comments, task activity, and notifications. Foreign keys and indexes enforce organization/project relationships and membership-based task assignment. Task statuses are `todo`, `in_progress`, `in_review`, `done`, and `cancelled`; priorities are `low`, `normal`, `high`, and `urgent`.

To change the schema, update the Drizzle definitions and generate a migration from `apps/web`:

```bash
npm run db:generate
```

Review generated SQL before applying schema changes to a shared or production database.

## Authentication and deployment

The application uses Clerk authentication. The sign-in and sign-up pages are available at `/sign-in` and `/sign-up`. Configure the local Clerk keys in `.env.local` and set the same values as environment variables in the deployment platform. Deploy the Next.js app from `apps/web`, and apply the checked-in Drizzle migrations to the target PostgreSQL database as part of deployment preparation.

Due-soon reminders run through the GitHub Actions workflow at `.github/workflows/due-soon-notifications.yml`. It calls `/api/cron/due-soon` hourly at 17 minutes past the hour (UTC); you can also run it manually from the Actions tab. Add `APP_URL` (the deployed app's base URL) and `CRON_SECRET` as repository Actions secrets under **Settings → Secrets and variables → Actions**. The workflow sends `CRON_SECRET` as a bearer token to authenticate the request.

## Contributing

1. Create a branch for your change.
2. Install dependencies from `apps/web` and make the change.
3. Run `npm run lint`, `npm test`, and, for production-facing changes, `npm run build` from `apps/web`.
4. Open a pull request describing the change and any environment or migration requirements.

## License

No license is currently specified. All rights are reserved unless the repository owner adds a license granting additional permissions.
