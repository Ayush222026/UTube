/* Bhakti Dhara – plain JavaScript, no build step.
   Sections: 1 Config · 2 Helpers · 3 YouTube API · 4 Feed · 5 Watch page · 6 Local data · 7 UI wiring */

/* ============ 1. CONFIG ============ */
const CONFIG = {
  // Paste your YouTube Data API v3 key between the quotes.
  // IMPORTANT: on a static website this key is visible to every visitor.
  // Restrict it in Google Cloud (website + YouTube Data API v3 only). See README.
  YOUTUBE_API_KEY: "PASTE_YOUR_API_KEY_HERE",
  PAGE_SIZE: 12,
};

const API_BASE = "https://www.googleapis.com/youtube/v3";

const CATEGORIES = [
  { id: "all", label: "All Videos", q: "bhakti spirituality knowledge podcast" },
  { id: "bhajans", label: "Bhakti & Bhajans", q: "bhakti bhajan kirtan" },
  { id: "hindu", label: "Hindu Spirituality", q: "Hindu spirituality Sanatan Dharma philosophy" },
  { id: "gita", label: "Bhagavad Gita", q: "Bhagavad Gita explained" },
  { id: "epics", label: "Ramayana & Mahabharata", q: "Ramayana Mahabharata story" },
  { id: "hanuman", label: "Hanuman Ji", q: "Hanuman Ji bhajan Hanuman Chalisa" },
  { id: "mahadev", label: "Mahadev", q: "Mahadev Shiv bhajan Shiva" },
  { id: "krishna", label: "Shri Krishna", q: "Shri Krishna bhajan Krishna leela" },
  { id: "yoga", label: "Meditation & Yoga", q: "meditation yoga pranayama" },
  { id: "spiritual-edu", label: "Spiritual Education", q: "Vedanta Upanishad spiritual discourse" },
  { id: "edu", label: "General Education", q: "educational lecture explained" },
  { id: "podcast", label: "Podcasts & Interviews", q: "spiritual podcast interview" },
];

/* ============ 2. HELPERS ============ */
const $ = (sel) => document.querySelector(sel);

// Tiny element builder. Text is added with append(), so titles can never inject HTML.
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  el.append(...kids.flat().filter(Boolean));
  return el;
}

// localStorage wrapper: only theme + video IDs are stored, never anything personal.
const KEYS = { theme: "bd_theme", saved: "bd_saved", recent: "bd_recent" };
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};

function fmtViews(n) {
  return n == null ? "" : new Intl.NumberFormat("en", { notation: "compact" }).format(n) + " views";
}
function fmtAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [name, secs] of units) {
    if (s >= secs) { const n = Math.floor(s / secs); return `${n} ${name}${n > 1 ? "s" : ""} ago`; }
  }
  return "just now";
}
function fmtDuration(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return "";
  const hrs = +m[1] || 0, min = +m[2] || 0, sec = String(+m[3] || 0).padStart(2, "0");
  return hrs ? `${hrs}:${String(min).padStart(2, "0")}:${sec}` : `${min}:${sec}`;
}

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

function setStatus(el, title, text, button) {
  el.replaceChildren(h("strong", {}, title), h("p", {}, text || ""), button);
  el.hidden = false;
}
function clearStatus(el) { el.hidden = true; el.replaceChildren(); }

function addSkeletons(container, n) {
  for (let i = 0; i < n; i++) {
    container.append(h("article", { class: "card skeleton", "aria-hidden": "true" },
      h("div", { class: "thumb" }),
      h("div", { class: "info" }, h("div", { class: "line" }), h("div", { class: "line short" }))));
  }
}
function removeSkeletons(container) { container.querySelectorAll(".skeleton").forEach((s) => s.remove()); }

/* ============ 3. YOUTUBE API ============ */
const hasKey = () => !!CONFIG.YOUTUBE_API_KEY && !CONFIG.YOUTUBE_API_KEY.startsWith("PASTE");
const videoCache = new Map(); // id -> normalized video

function friendlyError(status, reason) {
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded" || reason === "rateLimitExceeded")
    return "This site has used up its free YouTube quota for today. It resets daily, so please try again tomorrow.";
  if (status === 400) return "The YouTube API key looks invalid. Check the key in script.js.";
  if (reason === "accessNotConfigured") return "YouTube Data API v3 is not enabled for this API key's Google Cloud project.";
  if (status === 403) return "YouTube refused the request. If the key is restricted, make sure this website's address is allowed in the key's website restrictions.";
  return `YouTube returned an error (code ${status}). Please try again in a moment.`;
}

async function api(endpoint, params) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries({ ...params, key: CONFIG.YOUTUBE_API_KEY })) url.searchParams.set(k, v);
  let res;
  try { res = await fetch(url); }
  catch { throw new Error("Network problem. Check your internet connection and try again."); }
  if (res.ok) return res.json();
  let reason = "";
  try { reason = (await res.json()).error.errors[0].reason; } catch { /* no details */ }
  throw new Error(friendlyError(res.status, reason));
}

function normalize(v) {
  const sn = v.snippet;
  const thumbs = sn.thumbnails || {};
  return {
    id: v.id,
    title: sn.title,
    channel: sn.channelTitle,
    published: sn.publishedAt,
    thumb: (thumbs.medium || thumbs.high || thumbs.default || {}).url || "",
    views: v.statistics && v.statistics.viewCount != null ? Number(v.statistics.viewCount) : null,
    duration: fmtDuration(v.contentDetails && v.contentDetails.duration),
  };
}

// Looks up details for video IDs (1 quota unit per call, up to 50 IDs).
// onlyPlayable keeps only public videos that allow embedding.
async function getVideos(ids, onlyPlayable = true) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await api("videos", {
      part: "snippet,statistics,contentDetails,status",
      id: ids.slice(i, i + 50).join(","),
      maxResults: 50,
    });
    for (const v of data.items || []) {
      const playable = v.status && v.status.embeddable && v.status.privacyStatus === "public";
      if (onlyPlayable && !playable) continue;
      const video = normalize(v);
      videoCache.set(video.id, video);
      out.push(video);
    }
  }
  return out.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

/* ============ 4. FEED ============ */
const state = {
  view: "home",       // "home" | "saved" | "recent"
  category: "all",
  query: "",
  nextToken: null,
  done: false,        // no more pages
  loading: false,     // blocks overlapping requests
  failed: false,      // last request failed (stops auto-retry loops)
  rid: 0,             // bumped on every reset so late responses are ignored
  seen: new Set(),    // video IDs already shown (de-duplication)
};

const grid = $("#grid");
const statusEl = $("#status");
const loadMoreBtn = $("#loadMore");
const sentinel = $("#sentinel");
const feedTitle = $("#feedTitle");

const currentCategory = () => CATEGORIES.find((c) => c.id === state.category);

function buildQuery() {
  const cat = currentCategory();
  if (!state.query) return cat.q;
  return state.category === "all" ? state.query : `${state.query} ${cat.q}`;
}

function updateTitle() {
  const cat = currentCategory();
  feedTitle.textContent = state.query
    ? `Results for “${state.query}”${state.category === "all" ? "" : " in " + cat.label}`
    : cat.label;
}

function showMissingKey() {
  setStatus(statusEl, "Add your YouTube API key to start",
    "Open script.js, replace PASTE_YOUR_API_KEY_HERE with your key, and reload. The README explains how to get one.");
}

function resetFeed() {
  state.rid++;
  state.nextToken = null;
  state.done = false;
  state.loading = false;
  state.failed = false;
  state.seen.clear();
  grid.replaceChildren();
  clearStatus(statusEl);
  loadMoreBtn.hidden = true;
}

function card(v) {
  const link = `#watch=${v.id}`;
  return h("article", { class: "card" },
    h("a", { class: "thumb", href: link, "aria-label": `Play: ${v.title}` },
      h("img", { src: v.thumb, alt: "", loading: "lazy" }),
      v.duration ? h("span", { class: "dur" }, v.duration) : null),
    h("div", { class: "info" },
      h("a", { class: "title", href: link }, v.title),
      h("p", { class: "ch" }, v.channel),
      h("p", { class: "sub" }, [fmtViews(v.views), fmtAgo(v.published)].filter(Boolean).join(" • "))));
}

async function loadPage() {
  if (state.view !== "home" || state.loading || state.done) return;
  if (!hasKey()) { showMissingKey(); return; }

  const rid = state.rid;
  state.loading = true;
  state.failed = false;
  clearStatus(statusEl);
  loadMoreBtn.hidden = true;
  addSkeletons(grid, 6);

  let added = 0, tries = 0;
  try {
    // If a whole page is filtered out (not embeddable etc.), try the next page.
    while (added === 0 && !state.done && tries < 3) {
      tries++;
      const params = {
        part: "snippet", type: "video", videoEmbeddable: "true", safeSearch: "strict",
        maxResults: CONFIG.PAGE_SIZE, q: buildQuery(),
      };
      if (state.nextToken) params.pageToken = state.nextToken;

      const data = await api("search", params);
      if (rid !== state.rid) return;
      state.nextToken = data.nextPageToken || null;
      if (!state.nextToken) state.done = true;

      const ids = [...new Set((data.items || []).map((i) => i.id && i.id.videoId).filter((id) => id && !state.seen.has(id)))];
      const videos = ids.length ? await getVideos(ids) : [];
      if (rid !== state.rid) return;

      const frag = document.createDocumentFragment();
      for (const v of videos) {
        if (state.seen.has(v.id)) continue;
        state.seen.add(v.id);
        frag.append(card(v));
        added++;
      }
      grid.insertBefore(frag, grid.querySelector(".skeleton"));
    }
  } catch (err) {
    if (rid === state.rid) {
      state.failed = true;
      setStatus(statusEl, "Couldn't load videos", err.message,
        h("button", { class: "btn", onclick: loadPage }, "Try again"));
    }
  } finally {
    if (rid === state.rid) {
      state.loading = false;
      removeSkeletons(grid);
      afterLoad();
    }
  }
}

function afterLoad() {
  if (state.failed) { loadMoreBtn.hidden = true; return; }
  if (!grid.children.length && state.done) {
    setStatus(statusEl, "No videos found", "Try a different keyword or another category.");
    loadMoreBtn.hidden = true;
    return;
  }
  loadMoreBtn.hidden = state.done;
  // If the page is still short on screen, fetch more.
  if (!state.done) requestAnimationFrame(() => {
    if (!state.failed && sentinel.getBoundingClientRect().top < window.innerHeight + 300) loadPage();
  });
}

// Infinite scroll: load the next page when the bottom is close.
new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !state.failed) loadPage();
}, { rootMargin: "300px" }).observe(sentinel);
loadMoreBtn.addEventListener("click", loadPage);

async function showLocalList(kind) {
  state.rid++;
  state.done = true; state.loading = false; state.failed = false;
  grid.replaceChildren(); clearStatus(statusEl); loadMoreBtn.hidden = true;
  feedTitle.textContent = kind === "saved" ? "Watchlist" : "Recently watched";

  const ids = store.get(KEYS[kind], []);
  if (!ids.length) {
    setStatus(statusEl, "Nothing here yet",
      kind === "saved" ? "Open a video and tap “Save to watchlist”." : "Videos you watch will appear here.");
    return;
  }
  if (!hasKey()) { showMissingKey(); return; }

  const rid = state.rid;
  addSkeletons(grid, Math.min(ids.length, 6));
  try {
    const videos = await getVideos(ids);
    if (rid !== state.rid) return;
    removeSkeletons(grid);
    if (videos.length) grid.append(...videos.map(card));
    else setStatus(statusEl, "These videos are no longer available", "They may have been removed or made private.");
  } catch (err) {
    if (rid === state.rid) { removeSkeletons(grid); setStatus(statusEl, "Couldn't load your list", err.message); }
  }
}

function showView(view) {
  leaveWatch();
  state.view = view;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("#chips").hidden = view !== "home";
  if (view === "home") { updateTitle(); resetFeed(); loadPage(); }
  else showLocalList(view);
  closeDrawer();
}

function renderChips() {
  const box = $("#chips");
  box.replaceChildren(...CATEGORIES.map((c) =>
    h("button", {
      class: "chip", "data-id": c.id, "aria-pressed": String(c.id === state.category),
      onclick: () => {
        state.category = c.id;
        box.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === c.id)));
        showView("home");
      },
    }, c.label)));
}

/* ============ 5. WATCH PAGE ============ */
const feedView = $("#feedView");
const watchView = $("#watchView");
let player = null, currentId = null, feedScroll = 0, stepsIn = 0, ytReady = null;

function loadYT() {
  if (ytReady) return ytReady;
  ytReady = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve();
    window.onYouTubeIframeAPIReady = resolve;
    document.head.append(h("script", {
      src: "https://www.youtube.com/iframe_api",
      onerror: () => showPlayerMsg("Couldn't load the YouTube player", "Check your connection, or open the video on YouTube."),
    }));
  });
  return ytReady;
}

function showPlayerMsg(title, text) {
  const link = h("a", { class: "btn", href: `https://www.youtube.com/watch?v=${currentId}`, target: "_blank", rel: "noopener noreferrer" }, "Watch on YouTube");
  setStatus($("#playerMsg"), title, text, link);
}

function onPlayerError(e) {
  if (e.data === 101 || e.data === 150)
    showPlayerMsg("This video can't be played here", "Its owner doesn't allow embedding. You can still watch it on YouTube.");
  else if (e.data === 100)
    showPlayerMsg("Video unavailable", "It was removed or made private.");
  else
    showPlayerMsg("Playback problem", "YouTube couldn't play this video. Try watching it on YouTube.");
}

async function startPlayer(id) {
  await loadYT();
  if (player && typeof player.loadVideoById === "function") { player.loadVideoById(id); return; }
  if (player) return; // still initialising; onReady below picks up currentId
  player = new YT.Player("player", {
    videoId: id,
    playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
    events: {
      onReady: () => { if (currentId !== id) player.loadVideoById(currentId); },
      onError: onPlayerError,
    },
  });
}

function renderSaveButton() {
  const saved = store.get(KEYS.saved, []).includes(currentId);
  $("#saveBtn").textContent = saved ? "✓ Saved" : "Save to watchlist";
}

async function openWatch(id) {
  if (!watchView.hidden && currentId === id) return;
  if (watchView.hidden) feedScroll = window.scrollY;
  currentId = id;
  feedView.hidden = true; watchView.hidden = false;
  window.scrollTo(0, 0);
  clearStatus($("#playerMsg"));
  $("#ytLink").href = `https://www.youtube.com/watch?v=${id}`;
  $("#watchTitle").textContent = "";
  $("#watchMeta").textContent = "";
  $("#relatedGrid").replaceChildren();
  clearStatus($("#relatedStatus"));
  renderSaveButton();
  addRecent(id);
  startPlayer(id);

  let v = videoCache.get(id);
  if (!v && hasKey()) {
    try { [v] = await getVideos([id], false); } catch { /* details are optional */ }
  }
  if (currentId !== id) return;
  $("#watchTitle").textContent = v ? v.title : "YouTube video";
  $("#watchMeta").textContent = v ? [v.channel, fmtViews(v.views), fmtAgo(v.published)].filter(Boolean).join(" • ") : "";
  document.title = v ? `${v.title} – Bhakti Dhara` : "Bhakti Dhara";
  loadRelated(v);
}

function closeWatch() {
  if (watchView.hidden) return;
  watchView.hidden = true; feedView.hidden = false;
  if (player && typeof player.stopVideo === "function") player.stopVideo();
  currentId = null; stepsIn = 0;
  document.title = "Bhakti Dhara – Bhakti • Knowledge • Podcasts";
  window.scrollTo(0, feedScroll);
}

// Used by nav buttons / search / logo: leave the watch page without keeping its history entry.
function leaveWatch() {
  if (watchView.hidden) return;
  feedScroll = 0;
  history.replaceState(null, "", location.pathname + location.search);
  closeWatch();
}

async function loadRelated(v) {
  const box = $("#relatedGrid"), st = $("#relatedStatus");
  if (!v || !hasKey()) return;
  const id = v.id;
  addSkeletons(box, 4);
  try {
    // "relatedToVideoId" was retired by YouTube, so we search using the title's words.
    const q = v.title.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
    const data = await api("search", { part: "snippet", type: "video", videoEmbeddable: "true", safeSearch: "strict", maxResults: 10, q });
    const ids = [...new Set((data.items || []).map((i) => i.id && i.id.videoId).filter((x) => x && x !== id))];
    const vids = ids.length ? (await getVideos(ids)).slice(0, 8) : [];
    if (currentId !== id) return;
    removeSkeletons(box);
    if (vids.length) box.append(...vids.map(card)); else setStatus(st, "No related videos found", "");
  } catch (err) {
    if (currentId === id) { removeSkeletons(box); setStatus(st, "Couldn't load related videos", err.message); }
  }
}

function route() {
  const m = /^#watch=([\w-]{11})$/.exec(location.hash);
  if (m) { if (!watchView.hidden) stepsIn++; else stepsIn = 1; openWatch(m[1]); }
  else closeWatch();
}
window.addEventListener("hashchange", route);

$("#backBtn").addEventListener("click", () => {
  if (stepsIn > 0) history.go(-stepsIn);
  else { history.replaceState(null, "", location.pathname + location.search); closeWatch(); }
});

$("#saveBtn").addEventListener("click", () => {
  const saved = toggleSaved(currentId);
  renderSaveButton();
  toast(saved ? "Saved to your watchlist" : "Removed from watchlist");
});

$("#shareBtn").addEventListener("click", async () => {
  const url = location.href; // link back to this video on Bhakti Dhara
  const title = $("#watchTitle").textContent || "Bhakti Dhara";
  try {
    if (navigator.share) await navigator.share({ title, url });
    else { await navigator.clipboard.writeText(url); toast("Link copied"); }
  } catch { /* user closed the share sheet */ }
});

/* ============ 6. LOCAL DATA (this browser only) ============ */
function addRecent(id) {
  store.set(KEYS.recent, [id, ...store.get(KEYS.recent, []).filter((x) => x !== id)].slice(0, 30));
}
function toggleSaved(id) {
  const list = store.get(KEYS.saved, []);
  const has = list.includes(id);
  store.set(KEYS.saved, has ? list.filter((x) => x !== id) : [id, ...list]);
  return !has;
}

$("#clearBtn").addEventListener("click", () => {
  if (!confirm("Clear your watchlist and watch history from this browser?")) return;
  store.remove(KEYS.saved); store.remove(KEYS.recent);
  toast("Saved data cleared");
  if (state.view !== "home") showLocalList(state.view);
  if (currentId) renderSaveButton();
});

/* ============ 7. UI WIRING ============ */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = $("#themeBtn");
  btn.textContent = theme === "dark" ? "☀️" : "🌙";
  btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
}
applyTheme(store.get(KEYS.theme, "light"));
$("#themeBtn").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  store.set(KEYS.theme, next);
});

const wide = window.matchMedia("(min-width: 900px)");
function closeDrawer() { document.body.classList.remove("nav-open"); }
$("#menuBtn").addEventListener("click", () => {
  document.body.classList.toggle(wide.matches ? "sidebar-collapsed" : "nav-open");
});
$("#overlay").addEventListener("click", closeDrawer);
document.querySelectorAll(".nav-item").forEach((b) =>
  b.addEventListener("click", () => {
    if (b.dataset.view === "home") { state.query = ""; $("#searchInput").value = ""; }
    showView(b.dataset.view);
  }));

$("#brand").addEventListener("click", (e) => {
  e.preventDefault();
  state.query = ""; state.category = "all"; $("#searchInput").value = "";
  renderChips();
  showView("home");
  window.scrollTo(0, 0);
});

$("#searchForm").addEventListener("submit", (e) => {
  e.preventDefault(); // handles both the Enter key and the Search button
  state.query = $("#searchInput").value.trim();
  showView("home");
  window.scrollTo(0, 0);
});

// Start
renderChips();
if (/^#watch=/.test(location.hash)) { updateTitle(); route(); }
else { showView("home"); }
