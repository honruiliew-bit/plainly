"""RSS pulls and safe URL text extraction."""
import asyncio
import hashlib
import ipaddress
import re
import socket
from datetime import datetime, timezone
from html import unescape
from urllib.parse import urlparse

import httpx
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

FEEDS = [
    ("CNBC", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664"),
    ("CNBC Economy", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258"),
    ("CNBC Investing", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069"),
    ("CNBC Top News", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"),
    ("MarketWatch", "http://feeds.marketwatch.com/marketwatch/topstories/"),
    ("MarketWatch Pulse", "http://feeds.marketwatch.com/marketwatch/marketpulse/"),
    ("Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml"),
    ("Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
    ("NYT Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"),
    ("NYT Economy", "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml"),
    ("BBC Business", "http://feeds.bbci.co.uk/news/business/rss.xml"),
    ("The Guardian", "https://www.theguardian.com/uk/business/rss"),
    ("BLS", "https://www.bls.gov/feed/bls_latest.rss"),
]

TAG = re.compile(r"<[^>]+>")
SCRIPT = re.compile(r"<(script|style|nav|footer|header|aside)[\s\S]*?</\1>", re.I)


def key_for(s: str) -> str:
    return hashlib.sha256(s.strip().lower().encode()).hexdigest()[:32]


def clean(html: str) -> str:
    return re.sub(r"\s+", " ", unescape(TAG.sub(" ", SCRIPT.sub(" ", html)))).strip()


def _text(el, *names):
    for n in names:
        found = el.find(n)
        if found is not None and (found.text or "").strip():
            return found.text
    return ""


def _parse(xml: str, source: str) -> list[dict]:
    root = ET.fromstring(xml)
    atom = "{http://www.w3.org/2005/Atom}"
    nodes = root.findall(".//item") or root.findall(f".//{atom}entry")
    out = []
    for e in nodes[:12]:
        title = clean(_text(e, "title", f"{atom}title"))
        link = _text(e, "link")
        if not link:
            a = e.find(f"{atom}link")
            link = a.get("href", "") if a is not None else ""
        summary = clean(_text(e, "description", f"{atom}summary", f"{atom}content"))
        raw = _text(e, "pubDate", f"{atom}updated", f"{atom}published")
        published = None
        if raw:
            try:
                published = parsedate_to_datetime(raw).astimezone(timezone.utc).isoformat()
            except Exception:
                try:
                    published = datetime.fromisoformat(raw.replace("Z", "+00:00")).isoformat()
                except Exception:
                    published = None
        if link and title:
            out.append({"source": source, "url": link.strip(), "title": title, "summary": summary, "published_at": published})
    return out


async def _fetch_feed(source: str, url: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={"User-Agent": "Plainly/1.0"}) as c:
            r = await c.get(url)
            r.raise_for_status()
        return _parse(r.text, source)
    except Exception:
        return []


async def fetch_all() -> list[dict]:
    batches = await asyncio.gather(*[_fetch_feed(s, u) for s, u in FEEDS])
    seen, items = set(), []
    for b in batches:
        for i in b:
            if i["url"] not in seen:
                seen.add(i["url"])
                items.append(i)
    items.sort(key=lambda i: i["published_at"] or "", reverse=True)
    return items


def _is_public(host: str) -> bool:
    try:
        for info in socket.getaddrinfo(host, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except Exception:
        return False


async def fetch_article_text(url: str) -> tuple[str, str]:
    """Returns (title, text). Blocks non-http(s) and private network targets."""
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname or not _is_public(p.hostname):
        raise ValueError("That link cannot be fetched.")
    async with httpx.AsyncClient(timeout=15, follow_redirects=False, headers={"User-Agent": "Mozilla/5.0 Plainly/1.0"}) as c:
        r = await c.get(url)
        if r.is_redirect:
            loc = r.headers.get("location", "")
            p2 = urlparse(loc)
            if p2.hostname and _is_public(p2.hostname) and p2.scheme in ("http", "https"):
                r = await c.get(loc)
        r.raise_for_status()
    html = r.text[:600_000]
    m = re.search(r"<title[^>]*>([\s\S]*?)</title>", html, re.I)
    title = clean(m.group(1)) if m else ""
    paras = re.findall(r"<p[^>]*>([\s\S]*?)</p>", html, re.I)
    text = " ".join(clean(x) for x in paras if len(clean(x)) > 40)
    if len(text) < 200:
        raise ValueError("Could not read enough text from that page. Paste the article text instead.")
    return title, text
