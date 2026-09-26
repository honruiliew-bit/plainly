"""
Plainly: Tower scheduled job (optional).
The backend already refreshes the feed itself every few minutes and writes the
daily brief after 7am New York time. This job is a backup that asks the backend
to write today's brief, in case the backend was asleep.
"""

import json
import os
import urllib.error
import urllib.request

API_URL = os.environ.get("api_url", "http://localhost:8000")
SECRET = os.environ.get("cron_secret", "")


def call(path: str):
    req = urllib.request.Request(
        f"{API_URL}{path}",
        method="POST",
        headers={"Content-Type": "application/json", "X-Cron-Secret": SECRET},
        data=b"{}",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            print(f"[plainly] {path}: {json.loads(resp.read().decode())}")
    except urllib.error.HTTPError as e:
        print(f"[plainly] {path} HTTP {e.code}: {e.read().decode()}")
        raise


def main():
    call("/refresh")
    call("/brief/generate")


if __name__ == "__main__":
    main()
