#!/usr/bin/env python3
"""Bhakti Dhara video updater (no API key needed).

Run by GitHub Actions every 4 hours. For each channel in channels.txt it:
  1. finds the channel ID from the channel link,
  2. reads the channel's public YouTube feed (latest ~15 videos),
  3. skips videos that cannot be embedded,
  4. adds NEW videos to videos.json (old videos are never removed).
Only the Python standard library is used.
"""
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

CHANNELS_FILE = "channels.txt"
OUT_FILE = "videos.json"
UA = "Mozilla/5.0 (compatible; BhaktiDharaUpdater/1.0)"
CATEGORIES = {"all", "bhajans", "hindu", "gita", "epics", "hanuman", "mahadev",
              "krishna", "yoga", "spiritual-edu", "edu", "podcast"}
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}


def fetch(url, extra_headers=None):
    headers = {"User-Agent": UA, "Accept-Language": "en", "Cookie": "CONSENT=YES+1"}
    headers.update(extra_headers or {})
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def read_channels():
    """Returns a list of (category, clean channel url)."""
    out = []
    with open(CHANNELS_FILE, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "|" not in line:
                print(f"channels.txt line {n}: use  category | link  (skipped)")
                continue
            cat, url = [p.strip() for p in line.split("|", 1)]
            if cat not in CATEGORIES:
                print(f"channels.txt line {n}: unknown category '{cat}' (skipped)")
                continue
            url = url.split("?")[0].rstrip("/")  # drop ?si=... tracking part
            out.append((cat, url))
    return out


def resolve_channel_id(url):
    m = re.search(r"/channel/(UC[\w-]{22})", url)
    if m:
        return m.group(1)
    html = fetch(url)
    for pattern in (r'rel="canonical" href="https://www\.youtube\.com/channel/(UC[\w-]{22})"',
                    r'itemprop="channelId" content="(UC[\w-]{22})"',
                    r'"externalId":"(UC[\w-]{22})"'):
        m = re.search(pattern, html)
        if m:
            return m.group(1)
    raise ValueError("channel ID not found")


def parse_feed(xml_text):
    root = ET.fromstring(xml_text)
    videos = []
    for e in root.findall("a:entry", NS):
        vid = e.findtext("yt:videoId", default="", namespaces=NS)
        if not vid:
            continue
        videos.append({
            "id": vid,
            "title": (e.findtext("a:title", default="", namespaces=NS) or "").strip(),
            "channel": (e.findtext("a:author/a:name", default="", namespaces=NS) or "").strip(),
            "published": e.findtext("a:published", default="", namespaces=NS),
        })
    return videos


def embeddable(video_id):
    """oEmbed answers 401 when embedding is disabled and 404 when the video is gone."""
    url = ("https://www.youtube.com/oembed?format=json&url="
           + urllib.parse.quote(f"https://www.youtube.com/watch?v={video_id}", safe=""))
    try:
        fetch(url)
        return True
    except urllib.error.HTTPError as err:
        return err.code not in (401, 403, 404)
    except Exception:
        return True  # unknown problem: keep the video, the player shows an error if needed


def main():
    try:
        with open(OUT_FILE, encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        data = {}
    channel_ids = data.get("channels", {})
    videos = {v["id"]: v for v in data.get("videos", [])}
    blocked = set(data.get("blocked", []))
    before = json.dumps([channel_ids, videos, sorted(blocked)], sort_keys=True)

    channels = read_channels()
    failures = 0
    for cat, url in channels:
        try:
            cid = channel_ids.get(url) or resolve_channel_id(url)
            channel_ids[url] = cid
            feed = fetch(f"https://www.youtube.com/feeds/videos.xml?channel_id={cid}")
            entries = parse_feed(feed)
        except Exception as err:  # one bad channel must not stop the others
            failures += 1
            print(f"FAILED {url}: {err}")
            continue
        added = 0
        for v in entries:
            if v["id"] in videos:
                if cat not in videos[v["id"]]["cats"]:
                    videos[v["id"]]["cats"].append(cat)
                continue
            if v["id"] in blocked:
                continue
            if not embeddable(v["id"]):
                blocked.add(v["id"])
                continue
            v["cats"] = [cat]
            videos[v["id"]] = v
            added += 1
            time.sleep(0.3)
        print(f"{url}: {len(entries)} in feed, {added} new")
        time.sleep(0.5)

    after = json.dumps([channel_ids, videos, sorted(blocked)], sort_keys=True)
    if after != before:
        data = {
            "updated": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
            "channels": channel_ids,
            "blocked": sorted(blocked),
            "videos": sorted(videos.values(), key=lambda v: v["published"], reverse=True),
        }
        with open(OUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        print(f"Saved {len(videos)} videos.")
    else:
        print("No changes.")
    if channels and failures == len(channels):
        sys.exit(1)


if __name__ == "__main__":
    main()
