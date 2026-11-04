# Teamflow

Teamflow is a web application starter for collaborative project and task management. The repository currently contains a Next.js application scaffold, Clerk authentication entry points, and a PostgreSQL data model for organizations, memberships, invitations, projects, and tasks.

> The current home page is still the stock Next.js starter screen. The database schema describes the intended collaboration domain; a complete project-management UI and the workflows that use this schema have not yet been implemented.

## Repository layout

```text
.
├── README.md
└── apps/
    └── web/                 # Next.js web application
        ├── drizzle/         # PostgreSQL migration history
        ├── public/          # Static assets
        └── src/
            ├── app/         # App Router pages and global styles
            ├── lib/db/      # Drizzle schema and Neon connection
            └── proxy.ts     # Clerk middleware
```

## Technology

- Next.js 16 with the App Router and React 19
- TypeScript
- Tailwind CSS 4
- Clerk for authentication
- Drizzle ORM and Drizzle Kit
- Neon serverless PostgreSQL

## Prerequisites

- Node.js compatible with the Next.js version in `apps/web/package.json`
- npm
- A Clerk application for authentication
- A Neon PostgreSQL database for database operations

## Getting started

1. Clone the repository and move into the web application directory:

   ```bash
   git clone https://github.com/Boluski2/teamflow.git
   cd teamflow/apps/web
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `apps/web/.env.local` and add the values for your Clerk application and Neon database:

   ```dotenv
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
   ```

   Keep real credentials private. Environment files are ignored by Git. Clerk keys are needed for the authentication integration; `DATABASE_URL` is required by the Drizzle database client and migration commands.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Available commands

Run these from `apps/web`:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint. |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema. |
| `npm run db:migrate` | Apply migrations to the configured database. |
| `npm run db:studio` | Open Drizzle Studio for the configured database. |

## Authentication routes

Clerk is provided to the application from the root layout, and the Clerk middleware is configured in `src/proxy.ts`. The current authentication pages are:

- `/sign-in`
- `/sign-up`

Configure the Clerk application’s local development keys in `.env.local` before using these routes. Add the matching production environment variables in your deployment platform when deploying.

## Data model

The Drizzle schema is in `apps/web/src/lib/db/schema.ts`; generated PostgreSQL migrations are in `apps/web/drizzle/`.

- **Users** store email, name, avatar URL, and active state.
- **Organizations** belong to a creator and have a unique slug.
- **Memberships** associate users with organizations and assign `owner`, `admin`, `member`, or `viewer` roles.
- **Invitations** record an organization, invitee email, role, token hash, expiration, and acceptance time.
- **Projects** belong to organizations and can be active or archived.
- **Tasks** belong to projects and support parent tasks, assignees, due dates, ordering, status, priority, and completion time.

Task statuses are `todo`, `in_progress`, `in_review`, `done`, and `cancelled`; priorities are `low`, `normal`, `high`, and `urgent`. Foreign keys and indexes encode organization/project relationships and membership-based task assignment.

### Database workflow

Set `DATABASE_URL` in `.env.local`, then run the commands from `apps/web`:

```bash
npm run db:generate
npm run db:migrate
```

Use `npm run db:studio` to inspect the configured database. Review generated SQL before applying schema changes to a shared or production database.

## Deployment

Deploy the Next.js app from the `apps/web` directory using a platform that supports Next.js. Configure the Clerk keys and `DATABASE_URL` as environment variables in that platform. Apply the checked-in Drizzle migrations to the target PostgreSQL database as part of deployment preparation.

## Contributing

1. Create a branch for your change.
2. Install dependencies in `apps/web` and make the change.
3. Run `npm run lint` and, for production-facing changes, `npm run build` from `apps/web`.
4. Open a pull request describing the change and any environment or database migration requirements.

## License

No license is currently specified. All rights are reserved unless the repository owner adds a license granting additional permissions.
