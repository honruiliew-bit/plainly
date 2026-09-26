import asyncio
import copy
import hashlib
import json
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal
from collections import defaultdict, deque

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field

load_dotenv()

import explain as ex  # noqa: E402  (after load_dotenv so env is set)
import feeds  # noqa: E402
import store  # noqa: E402

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
CRON_SECRET = os.getenv("CRON_SECRET", "")
REFRESH_MINUTES = int(os.getenv("REFRESH_MINUTES", "10"))
BRIEF_HOUR_UTC = int(os.getenv("BRIEF_HOUR_UTC", "11"))  # 11 UTC = 7am New York (summer)
AUTO_REFRESH = os.getenv("AUTO_REFRESH", "1") == "1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(auto_loop()) if AUTO_REFRESH and SUPABASE_URL else None
    yield
    if task:
        task.cancel()


app = FastAPI(title="Plainly", lifespan=lifespan)


# ── CORS ──────────────────────────────────────────────────────────────────────
# Vercel gives every branch/PR its own preview URL (project-git-branch-team.vercel.app).
# The regex covers those automatically so you don't hand-edit CORS after every push.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[u.strip().rstrip("/") for u in FRONTEND_URL.split(",") if u.strip()],
    allow_origin_regex=r"https://plainly-.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth ──────────────────────────────────────────────────────────────────────
# Verifies the Supabase-issued JWT the frontend sends as a Bearer token.
# No secret shared between frontend and backend: fetches Supabase's public JWKS
# once and caches it.
security = HTTPBearer(auto_error=False)
_jwks_cache = None


async def get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
            _jwks_cache = res.json()
    return _jwks_cache


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = credentials.credentials
    try:
        jwks = await get_jwks()
        last_error = None
        for key in jwks.get("keys", []):
            try:
                return jwt.decode(token, key, algorithms=["RS256", "ES256", "HS256"], audience="authenticated")
            except JWTError as e:
                last_error = e
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(last_error))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


# ── Rate limits (in memory, per process) ──────────────────────────────────────
_hits: dict[str, deque] = defaultdict(deque)


def limit(bucket: str, max_calls: int, window: int):
    now = time.time()
    q = _hits[bucket]
    while q and q[0] < now - window:
        q.popleft()
    if len(q) >= max_calls:
        raise HTTPException(status_code=429, detail="Slow down. Try again in a few minutes.")
    q.append(now)


# ── Helpers ───────────────────────────────────────────────────────────────────
def shape(row: dict) -> dict:
    payload = copy.deepcopy(row["payload"])
    return {
        "id": row["key"],
        "kind": row["kind"],
        "title": row["title"],
        "source": row.get("source"),
        "url": row.get("url"),
        "published_at": row.get("published_at"),
        "created_at": row.get("created_at"),
        "explanation": payload,
    }


V = f"v{ex.LESSON_VERSION}"
LESSON_FILTER = {"payload->>lesson_v": f"eq.{ex.LESSON_VERSION}"}


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/me")
async def get_me(user=Depends(get_current_user)):
    return {"id": user.get("sub"), "email": user.get("email"), "role": user.get("role")}


async def interest_counts(uid: str) -> dict[str, int]:
    """How many saved articles the user has per topic."""
    links = await store.select("saved_items", {"user_id": f"eq.{uid}", "select": "key", "limit": "200"})
    keys = [l["key"] for l in links]
    if not keys:
        return {}
    rows = await store.select("explainers", {"key": f"in.({','.join(keys)})", "select": "key,topic:payload->>topic"})
    counts: dict[str, int] = {}
    for r in rows:
        t = r.get("topic")
        if t:
            counts[t] = counts.get(t, 0) + 1
    return counts


@app.get("/feed")
async def feed(limit_n: int = 20, topic: str | None = None, sort: str = "latest", user=Depends(get_current_user)):
    params = {"kind": "eq.feed", "order": "published_at.desc.nullslast", "limit": str(min(limit_n, 100)), **LESSON_FILTER}
    if topic:
        params["payload->>topic"] = f"eq.{topic}"
    rows = await store.select("explainers", params)
    items = [shape(r) for r in rows]
    if sort == "foryou":
        counts = await interest_counts(user.get("sub"))
        total = sum(counts.values())
        if total:
            now = datetime.now(timezone.utc)

            def score(it: dict) -> float:
                w = counts.get(it["explanation"].get("topic"), 0) / total
                it["match"] = w > 0
                try:
                    age = (now - datetime.fromisoformat(it["published_at"].replace("Z", "+00:00"))).total_seconds() / 3600
                except Exception:
                    age = 48
                return 2 * w + 1 / (1 + age / 12)

            items.sort(key=score, reverse=True)
    return {"items": items}


@app.get("/interests")
async def interests(user=Depends(get_current_user)):
    counts = await interest_counts(user.get("sub"))
    topics = [{"topic": t, "count": c} for t, c in sorted(counts.items(), key=lambda x: -x[1])]
    return {"topics": topics, "total": sum(counts.values())}


class ProfileIn(BaseModel):
    housing: Literal["rent", "own_mortgage", "own_outright", "family", "other"]
    debts: list[Literal["student", "car", "credit_card", "personal", "none"]] = Field(default_factory=list, max_length=5)
    savings: Literal["none", "small", "months", "substantial"]
    work: Literal["student", "employed", "self_employed", "retired", "between_jobs"]
    location: str = Field(default="", max_length=80)
    notes: str = Field(default="", max_length=200)


@app.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    rows = await store.select("profiles", {"user_id": f"eq.{user.get('sub')}", "limit": "1"})
    return {"profile": rows[0]["data"] if rows else None}


@app.post("/profile")
async def save_profile(body: ProfileIn, user=Depends(get_current_user)):
    data = body.model_dump()
    await store.upsert(
        "profiles",
        {"user_id": user.get("sub"), "data": data, "updated_at": datetime.now(timezone.utc).isoformat()},
        on_conflict="user_id",
    )
    return {"profile": data}


class PersonalIn(BaseModel):
    id: str = Field(max_length=64)


@app.post("/personal")
async def personal(body: PersonalIn, user=Depends(get_current_user)):
    """How this story could touch this specific user, based on their profile. Cached per user and story."""
    uid = user.get("sub")
    prof = await store.select("profiles", {"user_id": f"eq.{uid}", "limit": "1"})
    if not prof:
        raise HTTPException(400, "Add your situation in the You tab first.")
    profile = prof[0]["data"]
    phash = hashlib.sha256(json.dumps(profile, sort_keys=True).encode()).hexdigest()[:16]
    cached = await store.select("personal_impacts", {"user_id": f"eq.{uid}", "key": f"eq.{body.id}", "limit": "1"})
    if cached and cached[0]["phash"] == phash:
        return {"personal": cached[0]["payload"]}
    rows = await store.select("explainers", {"key": f"eq.{body.id}", "limit": "1"})
    if not rows:
        raise HTTPException(404, "Story not found.")
    limit(f"pers:{uid}", 30, 3600)
    try:
        payload = await ex.personal_impact(rows[0]["payload"], rows[0]["title"], profile)
    except Exception as e:
        print("[claude error]", repr(e), flush=True)
        raise HTTPException(502, "Could not tailor that just now. Try again.")
    await store.upsert("personal_impacts", {"user_id": uid, "key": body.id, "phash": phash, "payload": payload}, on_conflict="user_id,key")
    return {"personal": payload}


@app.get("/public/feed")
async def public_feed(request: Request, limit_n: int = 8):
    """No login. Read-only, cached rows only, used by the embed widget."""
    limit(f"pub:{request.client.host if request.client else 'x'}", 60, 60)
    params = {
        "kind": "eq.feed",
        "select": "key,kind,title,source,url,published_at,created_at,payload",
        "order": "published_at.desc.nullslast",
        "limit": str(min(limit_n, 12)),
        **LESSON_FILTER,
    }
    rows = await store.select("explainers", params)
    return {"items": [shape(r) for r in rows]}


class ExplainIn(BaseModel):
    text: str | None = Field(default=None, max_length=20000)
    url: str | None = Field(default=None, max_length=2000)


@app.post("/explain")
async def explain(body: ExplainIn, user=Depends(get_current_user)):
    uid = user.get("sub")
    limit(f"exp:{uid}", 15, 3600)
    text = (body.text or "").strip()
    url = (body.url or "").strip() or None
    if not text and not url:
        raise HTTPException(400, "Paste a headline, article text, or a link.")

    title = ""
    if url and not text:
        try:
            title, text = await feeds.fetch_article_text(url)
        except ValueError as e:
            raise HTTPException(422, str(e))
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (401, 402, 403, 429):
                raise HTTPException(
                    422,
                    "That site blocks automatic reading (Reuters, WSJ and Bloomberg often do). Paste the article text instead.",
                )
            raise HTTPException(422, "Could not open that link. Paste the article text instead.")
        except Exception:
            raise HTTPException(422, "Could not open that link. Paste the article text instead.")
    elif len(text) < 300 and "\n" not in text:
        title, text = text, text  # a bare headline

    key = feeds.key_for(f"{V}|{title}|{text[:4000]}")
    hit = await store.select("explainers", {"key": f"eq.{key}", "limit": "1"})
    if hit:
        await store.upsert("saved_items", {"user_id": uid, "key": key}, on_conflict="user_id,key")
        return shape(hit[0])

    try:
        payload = await ex.explain_text(title, text)
    except Exception as e:
        print("[claude error]", repr(e), flush=True)
        raise HTTPException(502, "The explainer is busy. Try again in a moment.")
    row = await store.upsert(
        "explainers",
        {
            "key": key,
            "kind": "custom",
            "title": title or text[:120],
            "url": url,
            "payload": payload,
            "user_id": uid,
        },
        on_conflict="key",
    )
    return shape(row)


class AskIn(BaseModel):
    id: str = Field(max_length=64)
    question: str = Field(min_length=1, max_length=600)
    history: list[dict] = Field(default_factory=list, max_length=6)


@app.post("/ask")
async def ask(body: AskIn, user=Depends(get_current_user)):
    """Answers a follow-up question about an explainer."""
    limit(f"ask:{user.get('sub')}", 30, 3600)
    rows = await store.select("explainers", {"key": f"eq.{body.id}", "limit": "1"})
    if not rows:
        raise HTTPException(404, "Explainer not found.")
    try:
        answer = await ex.answer_followup(rows[0]["payload"], body.question.strip(), body.history)
    except Exception as e:
        print("[claude error]", repr(e), flush=True)
        raise HTTPException(502, "Could not answer just now. Try again.")
    return {"answer": answer}


class DeepIn(BaseModel):
    id: str = Field(max_length=64)


@app.post("/deepdive")
async def deepdive(body: DeepIn, user=Depends(get_current_user)):
    """Writes the full deep dive for a feed story the first time anyone opens it, then caches it."""
    rows = await store.select("explainers", {"key": f"eq.{body.id}", "limit": "1"})
    if not rows:
        raise HTTPException(404, "Story not found.")
    row = rows[0]
    if row["payload"].get("sections"):
        return shape(row)
    limit(f"deep:{user.get('sub')}", 20, 3600)
    src = row["payload"].get("source_text") or row["title"]
    try:
        deep = await ex.explain_text(row["title"], src)
    except Exception as e:
        print("[claude error]", repr(e), flush=True)
        raise HTTPException(502, "The explainer is busy. Try again in a moment.")
    merged = dict(row["payload"])
    for k in ("sections", "takeaways", "follow_ups", "jargon", "unknowns"):
        merged[k] = deep.get(k, merged.get(k))
    saved_row = await store.upsert(
        "explainers",
        {**{k: row[k] for k in ("key", "kind", "title", "source", "url", "published_at")}, "payload": merged},
        on_conflict="key",
    )
    return shape(saved_row)


class SaveIn(BaseModel):
    id: str = Field(max_length=64)


@app.get("/saved")
async def saved(user=Depends(get_current_user)):
    """The user's saved articles, newest first."""
    links = await store.select(
        "saved_items", {"user_id": f"eq.{user.get('sub')}", "select": "key", "order": "created_at.desc", "limit": "100"}
    )
    keys = [l["key"] for l in links]
    if not keys:
        return {"items": []}
    rows = await store.select("explainers", {"key": f"in.({','.join(keys)})", **LESSON_FILTER})
    by_key = {r["key"]: r for r in rows}
    return {"items": [shape(by_key[k]) for k in keys if k in by_key]}


@app.post("/save")
async def save(body: SaveIn, user=Depends(get_current_user)):
    rows = await store.select("explainers", {"key": f"eq.{body.id}", "select": "key,payload", "limit": "1"})
    if not rows or not rows[0]["payload"].get("sections"):
        raise HTTPException(400, "Open the deep dive first, then save it.")
    await store.upsert("saved_items", {"user_id": user.get("sub"), "key": body.id}, on_conflict="user_id,key")
    return {"saved": True}


@app.post("/unsave")
async def unsave(body: SaveIn, user=Depends(get_current_user)):
    await store.delete("saved_items", {"user_id": f"eq.{user.get('sub')}", "key": f"eq.{body.id}"})
    return {"saved": False}


# ── Refresh + daily brief ──────────────────────────────────────────────────────
_refresh_lock = asyncio.Lock()


async def run_refresh(max_new: int = 40) -> dict:
    """Pulls RSS, writes a quick card for each new story, stores it. Non-finance stories are stored as 'skip'."""
    if _refresh_lock.locked():
        return {"busy": True}
    async with _refresh_lock:
        items = await feeds.fetch_all()
        keyed = [(feeds.key_for(f"{V}|{i['url']}"), i) for i in items]
        keys = [k for k, _ in keyed]
        existing = await store.select("explainers", {"select": "key", "key": f"in.({','.join(keys)})"}) if keys else []
        have = {r["key"] for r in existing}
        todo = [(k, i) for k, i in keyed if k not in have][:max_new]
        sem = asyncio.Semaphore(6)

        async def build(key: str, i: dict) -> str:
            async with sem:
                try:
                    text = f"{i['title']}. {i['summary']}"
                    payload = await ex.card_text(i["title"], text)
                except Exception:
                    return "failed"
                base = {"key": key, "title": i["title"], "source": i["source"], "url": i["url"], "published_at": i["published_at"]}
                if not payload.get("is_financial", True):
                    await store.upsert("explainers", {**base, "kind": "skip", "payload": {}}, on_conflict="key")
                    return "skipped"
                payload["source_text"] = text[:3000]
                await store.upsert("explainers", {**base, "kind": "feed", "payload": payload}, on_conflict="key")
                return "added"

        results = await asyncio.gather(*[build(k, i) for k, i in todo])
        return {
            "added": results.count("added"),
            "skipped": results.count("skipped"),
            "failed": results.count("failed"),
            "seen": len(items),
        }


async def make_brief(force: bool = False) -> dict:
    now = datetime.now(timezone.utc)
    if now.hour < BRIEF_HOUR_UTC and not force:
        return {"status": "too early"}
    key = f"brief-{now.date().isoformat()}"
    if not force and await store.select("explainers", {"key": f"eq.{key}", "select": "key", "limit": "1"}):
        return {"status": "exists"}
    since = (now - timedelta(hours=36)).isoformat()
    rows = await store.select(
        "explainers",
        {"kind": "eq.feed", "published_at": f"gte.{since}", "order": "published_at.desc", "limit": "40", **LESSON_FILTER},
    )
    if len(rows) < 5:
        return {"status": "not enough stories", "count": len(rows)}
    payload = await ex.brief_text([r["payload"] for r in rows])
    for it in payload.get("items", []):
        links, seen = [], set()
        for n in it.pop("sources", []) or []:
            if isinstance(n, int) and 1 <= n <= len(rows):
                r = rows[n - 1]
                if r.get("url") and r["url"] not in seen:
                    seen.add(r["url"])
                    links.append({"source": r.get("source") or "Source", "url": r["url"]})
        it["links"] = links[:3]
    await store.upsert(
        "explainers",
        {"key": key, "kind": "brief", "title": payload.get("headline", "Daily brief"), "published_at": now.isoformat(), "payload": payload},
        on_conflict="key",
    )
    return {"status": "created", "key": key, "stories_used": len(rows)}


async def auto_loop():
    """Keeps the feed fresh without any external scheduler. Also builds the daily brief once per day."""
    await asyncio.sleep(5)
    while True:
        try:
            print("[auto] refresh:", await run_refresh(40))
            print("[auto] brief:", await make_brief())
        except Exception as e:  # never let the loop die
            print("[auto] error:", repr(e))
        await asyncio.sleep(max(1, REFRESH_MINUTES) * 60)


def _check_secret(x_cron_secret: str | None):
    if not CRON_SECRET or x_cron_secret != CRON_SECRET:
        raise HTTPException(401, "Bad secret")


@app.post("/refresh")
async def refresh(max_new: int = 40, x_cron_secret: str | None = Header(default=None)):
    _check_secret(x_cron_secret)
    return await run_refresh(max_new)


@app.post("/brief/generate")
async def brief_generate(force: bool = False, x_cron_secret: str | None = Header(default=None)):
    _check_secret(x_cron_secret)
    return await make_brief(force)


@app.get("/brief")
async def latest_brief(user=Depends(get_current_user)):
    rows = await store.select("explainers", {"kind": "eq.brief", "order": "published_at.desc", "limit": "1"})
    return {"brief": shape(rows[0]) if rows else None}
