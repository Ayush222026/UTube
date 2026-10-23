# Bhakti Dhara
**Bhakti • Knowledge • Podcasts**

A video website for bhajans, spiritual teachings, educational videos and podcasts. Plain HTML, CSS and JavaScript. **No API key, no Google Cloud, no paid backend. Free on GitHub Pages.**

## How videos get on the site
1. **Channels (automatic).** You list channels in `channels.txt`. A free GitHub Action (`.github/workflows/update.yml`) runs every 4 hours, reads each channel's public YouTube feed, skips videos that can't be embedded, and adds new videos to `videos.json`. Old videos are never removed, so the list grows over time.
2. **Your own links (optional).** Paste video or playlist links into `LINKS` at the top of `script.js`. They appear first.

The feed of a channel only shows its latest ~15 videos, so the site starts with about 15 videos per channel and grows with every update. A big library (thousands of videos) needs many channels and time. Searching all of YouTube from inside the site, or loading a channel's full back catalogue, needs a YouTube API key and is not part of this version.

## channels.txt
```
podcast | https://www.youtube.com/@rajshamani
podcast | https://www.youtube.com/@shubhankarmishraofficial
```
Format: `category | channel link`. Categories: `all, bhajans, hindu, gita, epics, hanuman, mahadev, krishna, yoga, spiritual-edu, edu, podcast`. Any normal channel link works (the `?si=...` part is ignored). After editing, open **Actions → Update videos → Run workflow** to see the change right away.

## Features
Category filters, search over the videos on the site (with a "Search on YouTube" button), infinite scroll plus "Load more", embedded official YouTube player, "Watch on YouTube" link, related videos from the same category, watchlist, recently watched, share link, light/dark theme, responsive layout.

## Files
```
index.html                     page structure
style.css                      design and themes
script.js                      site logic + your own LINKS
channels.txt                   channels to follow
update_videos.py               fetches new videos (runs in GitHub Actions)
videos.json                    created automatically by the Action
.github/workflows/update.yml   the 4-hour timer
assets/logo.svg                logo
```

## Deploy on GitHub Pages
1. Upload the files to your repository (same names overwrite old ones). `logo.svg` goes inside `assets/`.
2. Create `.github/workflows/update.yml`: **Add file → Create new file**, type that exact path as the name, paste the contents, commit.
3. **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.**
4. **Actions** tab → **Update videos** → **Run workflow** (first run fills `videos.json`).
5. Open the site link shown in Settings → Pages.

## Good to know
- GitHub runs the timer roughly every 4 hours; it can be 10–30 minutes late.
- GitHub pauses scheduled runs in a repository nobody has touched for 60 days. If that happens, open the Actions tab and re-enable it.
- If a run fails with a permissions error: Settings → Actions → General → Workflow permissions → **Read and write permissions**.

## Privacy and policies
- No accounts, no tracking, no personal data collected.
- `localStorage` stores only the theme and video IDs (watchlist/history) in this browser on this device. It is not an account and does not sync between devices. "Clear saved data" removes it.
- Videos play only in YouTube's official embedded player, so YouTube's ads and rules apply. The site never downloads videos or bypasses restrictions.
- Bhakti Dhara is not affiliated with YouTube.
