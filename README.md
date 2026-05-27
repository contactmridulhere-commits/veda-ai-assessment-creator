# VedaAI · AI Assessment Creator

Teacher-facing tool that generates sectioned, difficulty-balanced question papers in seconds. Built against the provided Figma designs.

**Two deployment paths in one repo:**

| Path | Where it runs | Storage | Realtime | Use when |
|---|---|---|---|---|
| **Vercel + Supabase** | Next.js API routes | Supabase Postgres | HTTP polling | You want a free, zero-infra shareable demo |
| **Full stack** | Express + BullMQ worker | MongoDB | WebSocket | Local dev, or production with Railway/Render |

The frontend is identical in both. Only the data layer + queue swap out.

---

## Live demo

🔗 **Live demo:** _(your Vercel URL here)_
📦 **GitHub:** _(your repo URL here)_

---

## Quick start — Vercel + Supabase (no backend needed)

This path uses Next.js API routes, Supabase Postgres, Groq for AI, and Vercel's `waitUntil` for background generation. No Mongo, no Redis, no separate worker.

### 1. Set up Supabase (5 min)

1. Create a free project at <https://supabase.com>
2. Open **SQL Editor** → New query → paste the contents of `supabase/schema.sql` → **Run**
3. Settings → **API** → copy:
   - **Project URL** → `SUPABASE_URL`
   - **`service_role` secret** → `SUPABASE_SERVICE_ROLE_KEY` (the long one starting `eyJhbGci…`, **not** the anon key)

### 2. Get a Groq key

Sign up at <https://console.groq.com> → API Keys → Create. Copy it.

### 3. Deploy to Vercel

1. Push this repo to GitHub
2. <https://vercel.com> → **Add New → Project** → import the repo
3. **Root Directory** → `frontend`
4. **Environment Variables** — add these (Production + Preview + Development):

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | from Step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Step 1 |
   | `GROQ_API_KEY` | from Step 2 |
   | `GROQ_MODEL` | `openai/gpt-oss-20b` |
   | `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` |
   | `AI_MAX_TOKENS` | `4000` |
   | `AI_TEMPERATURE` | `0.4` |

5. **Deploy.** That's it. The URL Vercel gives you is the shareable link.

### How it works

- `POST /api/assignments` inserts a row with `status='queued'`, returns 202 immediately, then runs the Groq call via `waitUntil`. The Vercel function stays alive past the response to finish the work.
- `GET /api/assignments/:id` returns the row — used by the polling on `/generating/[jobId]` to detect completion.
- Generation takes ~3–10 seconds for GPT-OSS-20B; well within the 60-second `maxDuration` cap on Hobby plan.

---

## Local dev — full stack (Express + BullMQ + Mongo)

If you want to see the original architecture in action:

```bash
# Start Mongo + Redis
docker run -d --name veda-mongo -p 27017:27017 mongo:7
docker run -d --name veda-redis -p 6379:6379 redis:7

# Backend (terminal 1)
cd backend
cp .env.example .env       # edit GROQ_API_KEY
npm install
npm run dev

# Worker (terminal 2)
cd backend
npm run worker

# Frontend (terminal 3) — point at the local backend
cd frontend
cp .env.example .env
# Edit .env: set NEXT_PUBLIC_API_URL=http://localhost:4000 and
#            NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
npm install
npm run dev
```

Open <http://localhost:3000>.

In this mode the frontend talks to the Express API and subscribes to a real WebSocket for stage-by-stage progress. The worker uses BullMQ to process jobs from Redis and writes results to MongoDB.

---

## Architecture

### Vercel + Supabase (the deployed demo)

```
Browser ──► Vercel (Next.js)
              ├─ pages
              └─ /api/assignments  ─► Groq (openai/gpt-oss-20b)
                                  └─► Supabase Postgres
```

### Full stack (local dev)

```
Frontend ─► Express API ─► Mongo
              │           Redis
              ▼
        BullMQ queue ─► Worker ─► Groq
                                Redis cache
                                Mongo
              ▲
              └── WebSocket back to frontend (live progress)
```

---

## Tech stack

| Layer | Vercel path | Full stack path |
|---|---|---|
| Frontend | Next.js 15 · React 19 · TS · Tailwind · Zustand | same |
| API | Next.js route handlers | Express · TypeScript |
| Database | Supabase Postgres | MongoDB (Mongoose) |
| Queue | `waitUntil` (Vercel built-in) | BullMQ on Redis |
| Cache | — | Redis (model-aware FNV-1a key) |
| Realtime | HTTP polling (3s) | `ws` server, topic pub/sub |
| AI | Groq · `openai/gpt-oss-20b` | same |

---

## Project layout

```
veda-ai/
├── README.md                                   you are here
├── assessment-creator.jsx                      single-file React demo of the full flow
├── supabase/
│   └── schema.sql                              Vercel path: run this in Supabase SQL editor
├── backend/                                    Full stack path: Node/Express + BullMQ + Mongo
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── controllers/  models/  routes/      HTTP layer
│       ├── services/     ai · prompt · parser  AI service
│       ├── queues/       BullMQ queue + worker · cache key
│       ├── ws/           WebSocket pub/sub
│       └── types/        shared domain types
└── frontend/                                   Next.js 15 (deployed to Vercel)
    ├── .env.example
    ├── package.json
    └── src/
        ├── app/
        │   ├── api/
        │   │   └── assignments/
        │   │       ├── route.ts                POST (create + waitUntil) · GET (list)
        │   │       ├── [id]/route.ts           GET one
        │   │       ├── [id]/regenerate/route.ts  POST regenerate
        │   │       └── by-job/[jobId]/route.ts   GET by job id (for polling)
        │   ├── layout.tsx · globals.css        sidebar + mobile bars wrapper
        │   ├── page.tsx                        home — empty state · list
        │   ├── create/page.tsx                 multi-step form
        │   ├── generating/[jobId]/page.tsx     live progress (WS + polling)
        │   └── output/[id]/page.tsx            exam paper · print → PDF · regenerate
        ├── components/                         Sidebar · TopHeader · Mobile bars · UI primitives
        ├── hooks/useJobSocket.ts               WS subscriber (no-op when WS URL unset)
        ├── lib/
        │   ├── types.ts                        domain types
        │   ├── api.ts                          fetch wrapper
        │   ├── supabase.ts                     server-side Supabase admin client
        │   └── ai.ts                           Groq client + prompt + parser (Vercel)
        └── store/useAssessmentStore.ts         Zustand: form state · validation
```

---

## Design decisions

**Why two paths.** The brief asked for MongoDB + Redis + BullMQ + WebSocket. That stack lives in `backend/` and is fully runnable locally. But for a free, public, shareable demo, Vercel + Supabase is dramatically simpler — one deploy, no separate worker, no managed Redis. The frontend doesn't change; it just talks to a different `/api/...` host.

**Why Groq + `openai/gpt-oss-20b`.** Free tier, sub-2s typical latency, OpenAI-compatible REST so no SDK is needed. The parser strips fences and re-validates with Zod, so the LLM can't break the contract.

**Why `waitUntil` instead of synchronous response.** On Vercel, returning quickly with `status='queued'` and finishing the work in `waitUntil` lets the frontend's existing polling-based generating page work unchanged. The user sees stages tick over while Groq runs.

**Why polling fallback in the WebSocket hook.** On the Vercel deployment there's no WS at all; on the Express deployment WS is primary. The same generating page works in both modes because it polls every 3s as a backup — flaky WS or no WS, the user still gets to the output.

**Why strict Zod validation of the LLM response.** Brief says "do not directly render LLM response." The parser is the safety net: fence-strip, brace-find, Zod-validate, then enforce MCQs have 4 options. Malformed papers fail the job with a clear error instead of corrupting the DB.

**Why a 2-step form.** Step 1 is what teachers decide up front (title, subject, grade, optional source). Step 2 is the per-question configuration. Splitting it keeps either screen breathable.

**Print → PDF instead of headless Chrome.** `window.print()` plus `@media print` rules render the paper full-bleed with `page-break-inside: avoid` on sections. Clean vector PDF, zero server cost.

---

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/assignments` | Create + enqueue generation (returns 202) |
| GET | `/api/assignments` | List newest first |
| GET | `/api/assignments/:id` | Fetch one by id |
| GET | `/api/assignments/by-job/:jobId` | Fetch by job id (used by polling) |
| POST | `/api/assignments/:id/regenerate` | Archive current paper, regenerate |
| GET | `/api/health` *(Express path only)* | Mongo & Redis liveness |
| POST | `/api/assignments/upload` *(Express path only)* | Multer-handled PDF/TXT upload |

Create payload:

```jsonc
{
  "title": "Quiz on Electricity",
  "subject": "Science",
  "grade": "8th",
  "dueDate": "2026-06-15",
  "questionTypes": [
    { "type": "mcq",   "count": 5, "marks": 1 },
    { "type": "short", "count": 4, "marks": 2 }
  ],
  "additionalInstructions": "Focus on Ohm's Law…",
  "sourceText": "(optional, up to 50k chars)"
}
```

---

## Bonus items shipped

- **PDF export** via styled print stylesheet — no Puppeteer needed.
- **Cache** (Express path) keyed by input hash + model name.
- **paper_history** array stores previous versions on regenerate.
- **Visual difficulty pills** alongside the bracketed prefix from the Figma.
- **Polling fallback** so the generating screen never strands a user.
- **Source-material upload** — TXT direct, PDF via `pdf-parse` (Express path).
