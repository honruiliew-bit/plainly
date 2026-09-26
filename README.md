# Plainly

Financial news, explained like you are a person.

Plainly turns finance headlines into what happened, how it works, and who it affects. It has a live feed, a paste-anything explainer, and an embeddable widget.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind |
| Backend | FastAPI, Python |
| AI | Claude via the Anthropic API (forced tool call for structured output) |
| Auth + DB | Supabase |
| Scheduling | Tower (calls `POST /refresh`) |
| Hosting | Vercel (frontend), Railway (backend) |

## How it works

- The backend refreshes itself every 10 minutes (`REFRESH_MINUTES`). It pulls RSS from about a dozen finance sources, writes a quick card for each new story with Claude, and stores it in `explainers`. Non-finance stories are stored as `skip` so they are never checked again.
- Opening a story writes its full deep dive once (`POST /deepdive`) and caches it for everyone. Pasted text or links (`POST /explain`) produce a deep dive straight away and are saved to the user's Saved tab.
- `POST /ask` answers follow-up questions about a deep dive.
- After 7am New York time (`BRIEF_HOUR_UTC=11`) the backend writes one daily brief from the last 36 hours of stories. `GET /brief` serves it.
- Users can save deep dives (`/save`, `/unsave`, `GET /saved`).
- `POST /refresh` and `POST /brief/generate` (guarded by `X-Cron-Secret`) trigger the same jobs by hand. The Tower job in `tower/` is an optional daily backup.
- Set `AUTO_REFRESH=0` to turn the built-in loop off.

## Setup

1. Create a Supabase project. Copy the URL, anon key and service role key.
2. Run `supabase/migrations/001_explainers.sql`, then `002_brief_and_skip.sql`, then `003_saved_items.sql` in the Supabase SQL editor, in that order.
3. `cp frontend/.env.local.example frontend/.env.local` and fill it in.
4. `cp backend/.env.example backend/.env` and fill it in. You need an `ANTHROPIC_API_KEY` and a `CRON_SECRET` (any long random string).
5. Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
6. Frontend: `cd frontend && npm install && npm run dev`
7. The feed fills itself a few seconds after the backend starts. To force it: `curl -X POST localhost:8000/refresh -H "X-Cron-Secret: <your secret>"`. To force today's brief: `curl -X POST "localhost:8000/brief/generate?force=true" -H "X-Cron-Secret: <your secret>"`
8. Open http://localhost:3000, sign up, and try the Brief, Feed, Explain and Saved tabs.

In Supabase Auth settings, turn off "Confirm email" for the demo so sign-up logs in immediately.

## Deploying

1. Push to GitHub.
2. Railway: new project from the repo, root directory `backend`. Set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `FRONTEND_URL` (fill after step 3). Health check is `/health`.
3. Vercel: import the repo, root directory `frontend`. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (the Railway URL). Project name must start with `plainly` for the CORS regex, or add your domain to `allow_origins` in `backend/main.py`.
4. Set `FRONTEND_URL` on Railway to the Vercel URL.
5. The Railway backend refreshes itself. Keep it always on (no sleeping) so the loop keeps running. `tower deploy` is optional.

## Notes

- Explanations are AI generated from headline and summary text. The UI says so and says they are not financial advice.
- The model defaults to `claude-haiku-4-5` for speed and cost. Change `ANTHROPIC_MODEL` to upgrade.
- Some RSS feeds block server IPs now and then. Failures are skipped silently, so check the `/refresh` response counts if the feed stays empty.
