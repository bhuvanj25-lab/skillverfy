# SkillVerify

Skills verification platform (React + Tailwind, Node/Express API, Supabase, Claude interviews), structured to deploy on Vercel.

## Structure

- `frontend/`: React (Vite) + Tailwind UI
- `api/`: Vercel serverless functions (Express app wrapper later)

## Local dev

```bash
npm install
npm run dev
```

## Supabase setup (required for Worker Signup)

- Create a Supabase project and enable **Phone Auth (SMS OTP)**.
- In `frontend/`, create `.env` based on `.env.example`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Run the SQL in `supabase/schema.sql` inside Supabase SQL editor.

## Claude interview API (Vercel serverless)

Set these environment variables (local `.env`, and in Vercel project settings):

- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose to frontend)

Endpoints:

- `POST /api/interview/start` body: `{ "workerId": "<uuid>", "skill": "Web Development" }`
- `POST /api/interview/answer` body: `{ "sessionId": "<uuid>", "answer": "..." }`

## Company browse + Admin

- Public verified workers browsing requires running the latest `supabase/schema.sql`
  (adds RLS policy `Public can read verified workers`).
- Contact requests endpoint:
  - `POST /api/contact/request`
- Admin workers endpoint (protected by shared key):
  - Set `ADMIN_KEY` (server env only)
  - Call `GET /api/admin/workers` with header `x-admin-key: <ADMIN_KEY>`

