# EvidenceKit — PostgreSQL Setup & Deployment Guide

This guide documents the setup, configuration, and verification of PostgreSQL for the EvidenceKit monorepo, supporting TraceVault and the core evidence engine.

---

## 1. Prerequisites & System Requirements

- **PostgreSQL Version:** 14.x, 15.x, 16.x, or 18.x
- **Node.js:** v20.x or v22.x+ (Tested on v24.13.0)
- **Package Manager:** `pnpm` v9.x or v11.x
- **Supported Environments:** Windows native, WSL2 (Ubuntu/Debian), macOS, Linux, Docker, or Cloud Managed (Neon, Supabase, AWS RDS).

---

## 2. Setup Options

### Option A: WSL2 (Recommended on Windows)

If you are developing on Windows with WSL2:

1. **Install PostgreSQL in WSL2:**
   ```bash
   wsl -d Ubuntu -u root apt-get update
   wsl -d Ubuntu -u root apt-get install -y postgresql postgresql-contrib
   ```

2. **Configure PostgreSQL for External Connectivity:**
   Edit `/etc/postgresql/<version>/main/postgresql.conf`:
   ```conf
   listen_addresses = '*'
   ```
   Edit `/etc/postgresql/<version>/main/pg_hba.conf`:
   ```conf
   # Allow local development connections
   host all all all trust
   ```

3. **Start the Service & Set Up Database:**
   ```bash
   wsl -d Ubuntu -u root service postgresql start
   wsl -d Ubuntu -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres' SUPERUSER;"
   wsl -d Ubuntu -u postgres psql -c "CREATE DATABASE evidencekit OWNER postgres;"
   ```

4. **Determine the WSL2 Host IP:**
   ```powershell
   wsl -d Ubuntu hostname -I
   # e.g., 172.31.88.58
   ```

5. **Configure `.env` in Repository Root:**
   ```env
   DATABASE_URL=postgresql://postgres:postgres@172.31.88.58:5432/evidencekit
   ```
   *(Replace `172.31.88.58` with your actual WSL2 IP, or `localhost` if mirrored networking is enabled)*.

---

### Option B: Docker / Docker Compose

To launch an isolated container in one command:

```bash
docker run --name evidencekit-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=evidencekit \
  -p 5432:5432 \
  -d postgres:16-alpine
```

Set your `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/evidencekit
```

---

### Option C: Native Windows Installation

1. Download the installer from [EnterpriseDB PostgreSQL](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
2. Install with default port `5432`, user `postgres`, and set a password.
3. Launch `pgAdmin` or `psql` to create the database:
   ```sql
   CREATE DATABASE evidencekit;
   ```
4. Set `.env`:
   ```env
   DATABASE_URL=postgresql://postgres:<your-password>@localhost:5432/evidencekit
   ```

---

### Option D: Hosted Cloud Database (Neon / Supabase)

1. Create a project at [Neon](https://neon.tech) or [Supabase](https://supabase.com).
2. Create database `evidencekit`.
3. Copy the pooled or direct connection string into `.env`:
   ```env
   DATABASE_URL=postgresql://<user>:<password>@<host>/evidencekit?sslmode=require
   ```

---

## 3. Database Migration & Initialization

Once `DATABASE_URL` is set in `.env`:

### Run Migrations
Applies Drizzle schema migrations to initialize tables (`workspaces`, `users`, `cases`, `events`, `chain_heads`, `evidence_artifacts`, etc.):
```bash
pnpm db:migrate
```

### Seed Demo Data (Optional)
Populates initial sample workspaces, users, and incidents for evaluation:
```bash
pnpm db:seed
```

### Generate New Migrations (Developers)
When schema changes are made in `packages/db/src/schema/index.ts`:
```bash
pnpm db:generate
```

---

## 4. Verification & Health Check

Run the automated PostgreSQL verification test suite:
```bash
pnpm exec vitest run tests/postgres-persistence.test.ts
```

Expected output:
```text
✓ tests/postgres-persistence.test.ts (1 test) 116ms
Test Files  1 passed (1)
Tests  1 passed (1)
```

---

## 5. Troubleshooting Common Issues

| Issue | Cause | Solution |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running or listening on localhost | Verify service status: `wsl -d Ubuntu service postgresql status`. Check port listening: `ss -tlpn`. |
| WSL2 IP unreachable | WSL2 uses dynamic NAT address by default | Obtain current IP with `wsl hostname -I` and update `.env`, or configure Windows port forwarding / WSL mirrored networking (`.wslconfig`). |
| Foreign key constraint violation on `cases` | `workspace_id` does not exist in `workspaces` table | Ensure the workspace row exists prior to case insertion (EvidenceKit handles this with automatic upsert in `IncidentService`). |
| Node process hanging after DB queries | Open `pg.Pool` connection pool handles | Ensure `await pool.end()` is invoked in scripts or `afterAll()` in test suites. |
| Password authentication failed for user | `pg_hba.conf` requires md5/scram or wrong password | Update password or configure `trust` for local loopback in `pg_hba.conf`, then reload `service postgresql reload`. |
