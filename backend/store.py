"""Tiny Supabase PostgREST client using the service key. Backend only."""
import os
import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
KEY = os.getenv("SUPABASE_SERVICE_KEY", "")


def _h(extra: dict | None = None) -> dict:
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def _url(table: str) -> str:
    return f"{os.getenv('SUPABASE_URL', SUPABASE_URL)}/rest/v1/{table}"


async def select(table: str, params: dict) -> list[dict]:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(_url(table), params=params, headers=_h())
        r.raise_for_status()
        return r.json()


async def upsert(table: str, row: dict, on_conflict: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            _url(table),
            params={"on_conflict": on_conflict},
            json=row,
            headers=_h({"Prefer": "resolution=merge-duplicates,return=representation"}),
        )
        r.raise_for_status()
        return r.json()[0]


async def delete(table: str, params: dict) -> None:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.delete(_url(table), params=params, headers=_h())
        r.raise_for_status()
