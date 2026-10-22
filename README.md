# Bhakti Dhara
**Bhakti • Knowledge • Podcasts**

A YouTube-powered video discovery site for bhajans, spiritual teachings, educational videos and podcasts. Plain HTML, CSS and JavaScript. No paid backend, no build step.

- Search and 12 category filters (YouTube Data API v3)
- Infinite scroll, plus a "Load more" button as fallback
- Embedded player (YouTube IFrame Player API), related videos, a link to watch on YouTube
- Watchlist, recently watched, share link, light/dark theme (saved in this browser only)

> The feed is **YouTube search results** for devotional/educational keywords. It is not a curated list, so it is not guaranteed to be exclusively devotional.

## Files
```
bhakti-dhara/
├── index.html      page structure
├── style.css       design, themes, responsive layout
├── script.js       all logic (API key goes at the top of this file)
├── README.md       this guide
└── assets/
    └── logo.svg    Om-inspired logo
```

## 1. Get a YouTube API key
1. Open <https://console.cloud.google.com> and sign in.
2. Create a project (any name).
3. Go to **APIs & Services → Library**, search **YouTube Data API v3**, tap **Enable**.
4. Go to **APIs & Services → Credentials → Create credentials → API key**. Copy the key.
5. Tap the key to edit it, then **restrict it**:
   - **Application restrictions → Websites**: add `https://YOUR-GITHUB-USERNAME.github.io/*`
   - **API restrictions → Restrict key**: choose **YouTube Data API v3** only.
   - Save. Changes can take a few minutes to apply.

## 2. Put the key in the code
Open `script.js` and replace `PASTE_YOUR_API_KEY_HERE`:

```js
YOUTUBE_API_KEY: "AIza...your key...",
```

### The key is public
This is a static website, so **anyone who opens the site can see the key** (View Source). That is normal for browser-based YouTube keys, and it is why the restrictions in step 1 matter: a restricted key only works from your website and only for YouTube Data API v3. Never put a private secret, password or a server credential in these files.

## 3. Quota limits
YouTube gives a free quota of **10,000 units per day** per Google Cloud project (shared by all visitors).

| Call | Cost |
|---|---|
| Search (one feed page, search, or related videos) | 100 units |
| Video details (stats, duration, embeddable check) | 1 unit |

That is roughly **95–100 feed pages per day in total**. When the quota is used up the site shows a friendly message and works again after the daily reset (midnight Pacific Time). You can request more quota in Google Cloud if the site grows.

## 4. Deploy on GitHub Pages (works from an Android phone)
1. Open <https://github.com> in Chrome and sign in. Tap ⋮ and tick **Desktop site** to make the menus easier to find.
2. Tap **+ → New repository**. Name: `bhakti-dhara`. Choose **Public**. Do **not** tick "Add a README" or any other option. Tap **Create repository**.
3. Upload the 4 root files (`index.html`, `style.css`, `script.js`, `README.md`): tap **uploading an existing file**, pick the files from your phone's Downloads, then tap **Commit changes**.
4. Add the logo folder: tap **Add file → Create new file**. In the name box type `assets/logo.svg` (typing `/` creates the folder). Paste the contents of `logo.svg`, then **Commit changes**.
5. Add your key: open `script.js` in the repository, tap the ✏️ pencil icon, replace `PASTE_YOUR_API_KEY_HERE` with your key, then **Commit changes**.
6. Go to **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch **main**, Folder **/ (root)**, then **Save**.
7. Wait 1–3 minutes and refresh the Pages screen. The live address appears at the top, in the form `https://YOUR-GITHUB-USERNAME.github.io/bhakti-dhara/`.

On a laptop the steps are the same; you can also drag the whole folder into the upload page.

## 5. Test checklist
- [ ] Videos appear when the site opens (if you see "Add your YouTube API key", re-check step 2)
- [ ] Tapping a category chip changes the feed
- [ ] Searching with Enter and with the Search button both work
- [ ] Scrolling to the bottom loads more videos; "Load more" also works
- [ ] Tapping a video plays it on the site; "Watch on YouTube" opens YouTube
- [ ] Related videos show under the player
- [ ] Save, Share, dark mode, Watchlist, Recently watched, "Clear saved data" work
- [ ] The Android back button returns from the player to the feed

## Troubleshooting
| Message | Fix |
|---|---|
| Add your YouTube API key | Key not set in `script.js`, or the change isn't committed yet |
| API key looks invalid | Copy the key again without spaces or quotes inside |
| YouTube refused the request | The key's website restriction doesn't match your site address (note the `/*` at the end) |
| API not enabled | Enable **YouTube Data API v3** in the same Google Cloud project |
| Quota used up | Wait for the daily reset |
| "Can't be played here" | The video owner disabled embedding; use **Watch on YouTube** |

## Privacy and policies
- No accounts, no tracking, no personal data collected by this site.
- `localStorage` stores only the theme and video IDs for your watchlist/history. It stays in that one browser on that one device: it is **not** an account and does **not** sync between devices. "Clear saved data" removes it.
- Videos play only in YouTube's official embedded player, so YouTube's ads and rules apply. The site never downloads videos or bypasses restrictions.
- Bhakti Dhara is not affiliated with YouTube. Using the API means following the [YouTube API Services Terms](https://developers.google.com/youtube/terms/api-services-terms-of-service).

## Optional: hide the key with a small backend
GitHub Pages cannot keep a secret. If you later need a truly private key, or want caching to save quota:
1. Create a tiny proxy (for example a free Cloudflare Worker or Google Cloud Function) that stores the key as a server-side secret.
2. The proxy accepts requests from your site, adds the key, calls `googleapis.com/youtube/v3`, and returns the JSON (cache popular searches).
3. In `script.js`, point `API_BASE` at the proxy and stop sending the key from the browser.
