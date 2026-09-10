# Supabase setup for this project

This covers provisioning Supabase for the admin panel's **Users** and **Activity
Log** data only. Everything else — submissions (Sheet1), masterclass codes
(Sheet2), and certificate templates (Drive) — stays in Google Sheets/Drive,
since those are tied to the external Apps Script that actually generates and
emails certificates, which lives outside this repo.

This document covers provisioning only. Swapping `lib/users.js` and
`lib/activityLog.js` to actually query Supabase instead of Sheets is a
separate code change, not included here.

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Pick an org, a name (e.g. `certificate-admin`), a database password (save
   it somewhere — it's for direct Postgres access, not used by this app), and
   a region close to where the app is deployed.
3. Wait for provisioning to finish (a minute or two).

## 2. Get your credentials

In the project → **Settings → API Keys**. Newer Supabase projects (like this
one) show a **"Publishable and secret API keys"** tab by default — that's a
rename, not a different system: `anon` became **Publishable key**, and
`service_role` became **Secret key**. (There's a "Legacy anon, service_role
API keys" tab next to it if you ever need the old names/format instead — you
don't need that tab for this setup.)

- **Project URL** (Settings → General → Project URL, or **Settings → Data API**) → `SUPABASE_URL`
- **Secret key** (`sb_secret_...`, under "Secret keys" — **not** the Publishable key) → `SUPABASE_SERVICE_ROLE_KEY`

Keep the env var name `SUPABASE_SERVICE_ROLE_KEY` in this project regardless
of what Supabase's dashboard calls it today — that's just our own variable
name, and it's what most Supabase client examples/docs still expect.

The Secret key bypasses Row Level Security and has full read/write
access — every use in this app is server-side only (API routes), so it's
never sent to the browser. Treat it like the `GOOGLE_PRIVATE_KEY` you already
have: a secret that only lives in server environment variables, never in
client code or a `NEXT_PUBLIC_*` variable.

## 3. Environment variables

Add to `.env.local` and to Vercel's project environment variables:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## 4. Database schema

In the Supabase dashboard → **SQL Editor**, run:

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text not null,
  role text not null check (role in ('admin', 'general')),
  workshops text[] not null default '{}',
  org_name text,
  logo_url text,
  password_salt text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  details text,
  actor_email text,
  created_at timestamptz not null default now()
);

create index idx_activity_log_created_at on activity_log (created_at desc);
create index idx_users_email on users (lower(email));
```

If you provisioned these tables before `workshops`/`org_name`/`logo_url`/
`actor_email` existed, add them with:

```sql
alter table users add column if not exists workshops text[] not null default '{}';
alter table users add column if not exists org_name text;
alter table users add column if not exists logo_url text;
alter table activity_log add column if not exists actor_email text;
```

Notes:
- `email` has a `unique` constraint at the database level — this replaces the
  manual "does this email already exist" scan `lib/users.js` currently does
  against every row in the Sheet.
- `password_salt` / `password_hash` — same scheme already used against the
  Sheet (`node:crypto` `scrypt` + `timingSafeEqual`), just stored in Postgres
  columns instead of sheet cells. The actual password is still never stored.
- `role` is constrained to exactly `'admin'` or `'general'` at the database
  level, so bad data can't be written even if application code has a bug.
- `workshops` scopes which workshops' data an account can see/manage — empty
  means unrestricted (sees everything).
- `org_name` / `logo_url` are optional per-account branding shown in that
  account's nav bar instead of the default product name/mark — this is what
  lets each society's dashboard feel like their own portal.
- `actor_email` records which account performed each activity-log entry (null
  for the master admin login, which has no per-user row). A scoped/general
  account's Activity Log view is filtered to rows matching their own email;
  only a fully unrestricted admin (master, or an admin account with no
  workshop scope) sees the whole log.

## 5. Row Level Security

Enable RLS on both tables even though only the Secret key (which bypasses RLS
entirely) will ever touch them — this is defense in depth in case a different
key is ever used against this project by mistake:

```sql
alter table users enable row level security;
alter table activity_log enable row level security;
-- No policies added on purpose: with RLS on and zero policies, every request
-- using the Publishable key (or a logged-in Supabase Auth user, if that's
-- ever added later) is denied by default. Only the Secret key — used
-- server-side in this app — can read or write.
```

## 6. Install the client library

```bash
npm install @supabase/supabase-js
```

## 7. Where these credentials would be used in the codebase

Once the code migration happens (not part of this document):

- `lib/supabaseClient.js` (new) — creates a single server-side client using
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, mirroring how
  `lib/googleAuth.js` centralizes the Google auth client today.
- `lib/users.js` — `createUser`, `findUserByEmail`, `listUsers`,
  `deleteUserByEmail` would query the `users` table instead of the "Users"
  Google Sheet tab. The hashing logic (`scrypt`) doesn't change.
- `lib/activityLog.js` — `logActivity`, `getRecentActivity` would query the
  `activity_log` table instead of the "ActivityLog" Google Sheet tab.
- Every API route that currently imports from these two files
  (`app/api/admin/login`, `app/api/admin/users/*`, and the `logActivity(...)`
  calls sprinkled through the codes/templates/submissions routes) keeps
  working unchanged — only the two lib files' internals would change.

## 8. Deploying

After adding `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Vercel's
project environment variables, redeploy so the new build picks them up —
same as any other env var change in this project.
