# NestJS + Supabase Auth API

Small NestJS API that uses Supabase Auth for protecting routes and exposes a `POST /reports` endpoint that stores a PDF in Supabase Storage and creates a row in the `reports` table.

## Prerequisites
- Node.js 18+
- Supabase project (URL + Service Role Key + JWT secret)
- A storage bucket named `reports` (or change `SUPABASE_BUCKET`)
- The tables from your schema (`reports`, `moderators`, `institutions_data`)

## Environment
Create a `.env` file:
```
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_SECRET_ROLE_KEY=your-jwt-secret
SUPABASE_BUCKET=reports
```

**Note about Prisma:**
- The app works with or without Prisma. Currently, database operations use Supabase client directly.
- `DATABASE_URL` is **optional** - only needed if you want to use Prisma ORM.
- If you want to use Prisma: Supabase **IS** a PostgreSQL database. Get your connection string from **Settings > Database > Connection string** (URI format) in your Supabase dashboard.

## Install & run
```
yarn install
yarn start:dev
# or build & run
yarn build && yarn start
```

## Docker
```
cp env.example .env
docker compose up --build
```
The service binds to `PORT` from your `.env` file (defaults to `3000`).

Swagger UI is available at `http://localhost:<PORT>/docs` once the service is running.

## Auth
All protected routes use a simple guard that calls `supabase.auth.getUser()` with the bearer token. Provide the access token obtained from Supabase Auth as `Authorization: Bearer <token>`.

## Reports endpoint
- URL: `POST /reports`
- Auth: bearer token required
- Body (multipart/form-data):
  - `pdf`: required PDF file
  - `reporterName`, `reporterEmail` (required)
  - Optional: `reportedInstitution`, `reportDescription`, `reportContent` (JSON), `institutionName`, `institutionId`, `numerRspo`, `reportReason`
- Behavior:
  - Uploads the PDF to Supabase Storage under the bucket `SUPABASE_BUCKET`.
  - Inserts a row into `reports` where `institution_id` falls back to `numerRspo` when `institutionId` is not provided.
  - Stores the storage path and `numer_rspo` inside `report_content` JSON.

Example (using `form-data`):
```
curl -X POST http://localhost:3000/reports \
  -H "Authorization: Bearer <access-token>" \
  -F reporterName="Jane Doe" \
  -F reporterEmail="jane@example.com" \
  -F numerRspo="123456" \
  -F pdf=@report.pdf
```
