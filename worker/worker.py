#!/usr/bin/env python3
"""Travelstream media worker.

Polls Plone over plone.restapi for video Files marked ``processing``,
downloads the blob, runs ffmpeg (poster frame + faststart remux), writes
the poster into the File's lead-image field and the remuxed video back,
and sets ``processed`` or ``failed``. No ZODB access — restapi only, so
it runs happily in its own container.

Environment:
  PLONE_URL       Base URL of the site, e.g. http://backend:8080/Plone
  PLONE_USER      Service account with Editor rights on the trips area
  PLONE_PASSWORD  Its password
  POLL_SECONDS    Poll interval (default 15)
"""

import base64
import logging
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import requests


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("travelstream.worker")

PLONE_URL = os.environ.get("PLONE_URL", "http://backend:8080/Plone").rstrip("/")
PLONE_USER = os.environ.get("PLONE_USER", "admin")
PLONE_PASSWORD = os.environ.get("PLONE_PASSWORD", "admin")
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "15"))
# One hung socket must not stall the single-threaded poll loop.
HTTP_TIMEOUT = (10, 300)  # (connect, read) seconds


def session() -> requests.Session:
    s = requests.Session()
    s.auth = (PLONE_USER, PLONE_PASSWORD)
    s.headers.update({"Accept": "application/json"})
    return s


def poll_processing(s: requests.Session) -> list[dict]:
    response = s.get(
        f"{PLONE_URL}/@search",
        params={"processing_status": "processing", "portal_type": "File"},
        timeout=HTTP_TIMEOUT,
    )
    response.raise_for_status()
    return response.json().get("items", [])


def download_blob(s: requests.Session, item_url: str, target: Path) -> None:
    with s.get(f"{item_url}/@@download/file", stream=True, timeout=HTTP_TIMEOUT) as response:
        response.raise_for_status()
        with open(target, "wb") as fh:
            for chunk in response.iter_content(1 << 20):
                fh.write(chunk)


def run_ffmpeg(source: Path, workdir: Path) -> tuple[Path, Path]:
    """Return (poster_path, remuxed_path); raises CalledProcessError."""
    poster = workdir / "poster.jpg"
    remuxed = workdir / f"remuxed{source.suffix or '.mp4'}"
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(source), "-ss", "0.5", "-frames:v", "1",
         "-vf", "scale='min(1280,iw)':-2", str(poster)],
        check=True, capture_output=True, timeout=600,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(source), "-c", "copy",
         "-movflags", "+faststart", str(remuxed)],
        check=True, capture_output=True, timeout=1800,
    )
    return poster, remuxed


def write_results(
    s: requests.Session, item_url: str, filename: str, poster: Path, remuxed: Path
) -> None:
    payload = {
        "image": {
            "data": base64.b64encode(poster.read_bytes()).decode("ascii"),
            "encoding": "base64",
            "filename": "poster.jpg",
            "content-type": "image/jpeg",
        },
        "file": {
            "data": base64.b64encode(remuxed.read_bytes()).decode("ascii"),
            "encoding": "base64",
            "filename": filename or "video.mp4",
            "content-type": "video/mp4",
        },
        "processing_status": "processed",
        "processing_error": None,
    }
    response = s.patch(f"{item_url}", json=payload, timeout=HTTP_TIMEOUT)
    response.raise_for_status()


def mark_failed(s: requests.Session, item_url: str, reason: str) -> None:
    try:
        s.patch(
            item_url,
            json={"processing_status": "failed", "processing_error": reason[:2000]},
            timeout=HTTP_TIMEOUT,
        ).raise_for_status()
    except requests.RequestException:
        log.exception("could not even mark %s as failed", item_url)


def process_one(s: requests.Session, item: dict) -> None:
    item_url = item["@id"]
    log.info("processing %s", item_url)
    try:
        with tempfile.TemporaryDirectory(prefix="tsworker-") as tmp:
            workdir = Path(tmp)
            source = workdir / "source"
            download_blob(s, item_url, source)
            poster, remuxed = run_ffmpeg(source, workdir)
            info = s.get(item_url, timeout=HTTP_TIMEOUT).json()
            filename = (info.get("file") or {}).get("filename", "video.mp4")
            write_results(s, item_url, filename, poster, remuxed)
        log.info("processed %s", item_url)
    except subprocess.CalledProcessError as error:
        stderr = (error.stderr or b"").decode("utf-8", "replace")
        log.error("ffmpeg failed for %s: %s", item_url, stderr[-500:])
        mark_failed(s, item_url, f"ffmpeg failed: {stderr[-1500:]}")
    except requests.RequestException as error:
        # API trouble: leave the item in `processing` so the next poll
        # retries — do not mark failed for transient backend errors.
        log.warning("API error while processing %s: %s", item_url, error)
    except Exception as error:  # noqa: BLE001 — worker must never die
        log.exception("unexpected error for %s", item_url)
        mark_failed(s, item_url, f"worker error: {error}")


def main() -> int:
    log.info("media worker polling %s every %ss", PLONE_URL, POLL_SECONDS)
    s = session()
    while True:
        try:
            for item in poll_processing(s):
                process_one(s, item)
        except requests.RequestException as error:
            log.warning("poll failed (backend down?): %s", error)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    sys.exit(main())
