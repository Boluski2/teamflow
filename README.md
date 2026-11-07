# Teamflow

Teamflow is a collaborative project and task management application built with Next.js. The current implementation includes Clerk authentication, organization and membership management, role-based organization permissions, and email-based organization invitations. The database schema also defines projects and tasks.

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
- Resend and React Email dependencies for transactional email
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

4. Apply the checked-in migrations:

   ```bash
   npm run db:migrate
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

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
| `POST` | `/api/organizations/:organizationId/invitations` | Create an invitation; requires the appropriate organization permission. |
| `POST` | `/api/invitations/accept` | Accept an invitation using the authenticated user’s verified email. |

Organization membership roles are `owner`, `admin`, `member`, and `viewer`. Invitation roles are `admin`, `member`, and `viewer`. Invitation tokens are stored as hashes, expire, and can be accepted only once by a matching email address.

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

The Drizzle schema is in `apps/web/src/lib/db/schema.ts`; SQL migrations are in `apps/web/drizzle/`. The schema covers users, organizations, memberships, invitations, projects, and tasks. Foreign keys and indexes enforce organization/project relationships and membership-based task assignment. Task statuses are `todo`, `in_progress`, `in_review`, `done`, and `cancelled`; priorities are `low`, `normal`, `high`, and `urgent`.

To change the schema, update the Drizzle definitions and generate a migration from `apps/web`:

```bash
npm run db:generate
```

Review generated SQL before applying schema changes to a shared or production database.

## Authentication and deployment

The application uses Clerk authentication. The sign-in and sign-up pages are available at `/sign-in` and `/sign-up`. Configure the local Clerk keys in `.env.local` and set the same values as environment variables in the deployment platform. Deploy the Next.js app from `apps/web`, and apply the checked-in Drizzle migrations to the target PostgreSQL database as part of deployment preparation.

## Contributing

1. Create a branch for your change.
2. Install dependencies from `apps/web` and make the change.
3. Run `npm run lint`, `npm test`, and, for production-facing changes, `npm run build` from `apps/web`.
4. Open a pull request describing the change and any environment or migration requirements.

## License

No license is currently specified. All rights are reserved unless the repository owner adds a license granting additional permissions.
