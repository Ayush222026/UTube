/* Bhakti Dhara – NO API KEY version. Plain JavaScript, no build step.
   Videos come from two places:
   1. LINKS below (links you paste by hand), shown first.
   2. videos.json, filled automatically every 4 hours from the channels in channels.txt. */

/* ============ 1. YOUR OWN LINKS (optional, edit this part) ============
   Paste normal YouTube links inside the quotes, one per line.
   Works with: youtu.be/... links, youtube.com/watch?v=... links, and playlist links
   (youtube.com/playlist?list=...). Playlist links play the whole playlist inside the site.
   Category names on the left must stay exactly as they are. */
const LINKS = {
  all: [],
  bhajans: [],
  hindu: [],
  gita: [],
  epics: [],
  hanuman: [
    "https://youtu.be/Ds6nlDvNHss",
    "https://youtu.be/xJ3vatsNQDU",
  ],
  mahadev: [],
  krishna: [],
  yoga: [],
  "spiritual-edu": [],
  edu: [],
  podcast: [],
};

const CATEGORIES = [
  { id: "all", label: "All Videos" },
  { id: "bhajans", label: "Bhakti & Bhajans" },
  { id: "hindu", label: "Hindu Spirituality" },
  { id: "gita", label: "Bhagavad Gita" },
  { id: "epics", label: "Ramayana & Mahabharata" },
  { id: "hanuman", label: "Hanuman Ji" },
  { id: "mahadev", label: "Mahadev" },
  { id: "krishna", label: "Shri Krishna" },
  { id: "yoga", label: "Meditation & Yoga" },
  { id: "spiritual-edu", label: "Spiritual Education" },
  { id: "edu", label: "General Education" },
  { id: "podcast", label: "Podcasts & Interviews" },
];

/* ============ 2. HELPERS ============ */
const $ = (sel) => document.querySelector(sel);

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

// Only the theme and video IDs are stored, in this browser only.
const KEYS = { theme: "bd_theme", saved: "bd_saved", recent: "bd_recent" };
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};

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

/* ============ 3. LINKS -> ITEMS ============ */
function parseLink(raw) {
  const s = String(raw).trim();
  const vid = /(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/.exec(s);
  if (vid) return { type: "video", id: vid[1] };
  const list = /[?&]list=([\w-]+)/.exec(s);
  if (list) return { type: "playlist", id: list[1] };
  return null;
}

const ITEMS = new Map(); // id -> { id, type, cats:Set, title, channel, thumb, published, hidden }
for (const [cat, links] of Object.entries(LINKS)) {
  for (const link of links) {
    const p = parseLink(link);
    if (!p) { console.warn("Bhakti Dhara: could not read this link:", link); continue; }
    const item = ITEMS.get(p.id) || { ...p, cats: new Set(), title: "", channel: "", thumb: "", hidden: false };
    item.cats.add(cat);
    ITEMS.set(p.id, item);
  }
}
const manualItems = [...ITEMS.values()];

function fmtAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!iso || isNaN(s)) return "";
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [name, secs] of units) {
    if (s >= secs) { const n = Math.floor(s / secs); return `${n} ${name}${n > 1 ? "s" : ""} ago`; }
  }
  return "just now";
}

// videos.json is written by the GitHub Action (see update_videos.py). Newest first.
async function loadVideosJson() {
  try {
    const res = await fetch("videos.json", { cache: "no-cache" });
    if (!res.ok) return;
    const data = await res.json();
    for (const v of data.videos || []) {
      if (!v.id || ITEMS.has(v.id)) continue;
      ITEMS.set(v.id, {
        id: v.id, type: "video", cats: new Set(v.cats || []),
        title: v.title || "", channel: v.channel || "", thumb: "",
        published: v.published || "", hidden: false,
      });
    }
  } catch { /* no videos.json yet: only your own LINKS are shown */ }
}

const ytUrl = (it) => it.type === "playlist"
  ? `https://www.youtube.com/playlist?list=${it.id}`
  : `https://www.youtube.com/watch?v=${it.id}`;
const thumbOf = (it) => it.thumb || (it.type === "video" ? `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg` : "");
const titleOf = (it) => it.title || (it.type === "playlist" ? "YouTube playlist" : "YouTube video");

// YouTube's public oEmbed gives title + channel without any key.
// 401/404 means the video can't be embedded or no longer exists, so we hide it.
async function loadMeta(it) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(ytUrl(it))}`);
    if (res.status === 401 || res.status === 404) { it.hidden = true; return; }
    if (!res.ok) return;
    const d = await res.json();
    it.title = d.title || "";
    it.channel = d.author_name || "";
    if (it.type === "playlist" && d.thumbnail_url) it.thumb = d.thumbnail_url;
  } catch { /* offline or blocked: we still show the card with a basic title */ }
}
const metaReady = Promise.allSettled([loadVideosJson(), ...manualItems.map(loadMeta)]);

/* ============ 4. FEED ============ */
const state = { view: "home", category: "all", query: "" };
const grid = $("#grid");
const statusEl = $("#status");
const feedTitle = $("#feedTitle");
let renderId = 0;
const PAGE = 24;           // cards added per step
let list = [], shown = 0;  // current filtered list and how many are on screen
const loadMoreBtn = $("#loadMore");
const sentinel = $("#sentinel");

const currentCategory = () => CATEGORIES.find((c) => c.id === state.category);

function updateTitle() {
  const cat = currentCategory();
  feedTitle.textContent = state.query
    ? `Results for “${state.query}”${state.category === "all" ? "" : " in " + cat.label}`
    : cat.label;
}

function card(it) {
  const link = `#watch=${it.id}`;
  return h("article", { class: "card" },
    h("a", { class: "thumb", href: link, "aria-label": `Play: ${titleOf(it)}` },
      thumbOf(it) ? h("img", { src: thumbOf(it), alt: "", loading: "lazy" }) : null,
      it.type === "playlist" ? h("span", { class: "dur" }, "Playlist") : null),
    h("div", { class: "info" },
      h("a", { class: "title", href: link }, titleOf(it)),
      it.channel ? h("p", { class: "ch" }, it.channel) : null,
      it.published ? h("p", { class: "sub" }, fmtAgo(it.published)) : null));
}

function youtubeSearchButton() {
  return h("a", {
    class: "btn", target: "_blank", rel: "noopener noreferrer",
    href: `https://www.youtube.com/results?search_query=${encodeURIComponent(state.query)}`,
  }, "Search on YouTube");
}

function visibleItems() {
  const words = state.query.toLowerCase().split(/\s+/).filter(Boolean);
  return [...ITEMS.values()]
    .filter((it) => !it.hidden)
    .filter((it) => state.category === "all" || it.cats.has(state.category))
    .filter((it) => {
      const text = `${it.title} ${it.channel}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
}

async function renderFeed() {
  const my = ++renderId;
  grid.replaceChildren(); clearStatus(statusEl);
  list = []; shown = 0; loadMoreBtn.hidden = true;
  addSkeletons(grid, 6);
  await metaReady;
  if (my !== renderId) return;
  grid.replaceChildren();
  list = visibleItems();
  if (!ITEMS.size) {
    setStatus(statusEl, "No videos yet", "Add channels in channels.txt (or links in script.js) and run the update.");
  } else if (list.length) {
    appendMore();
    if (state.query) setStatus(statusEl, "Looking for something else?", "Search all of YouTube for this keyword.", youtubeSearchButton());
  } else if (state.query) {
    setStatus(statusEl, "No matching videos", "Nothing in this site's list matches your search. You can search on YouTube instead.", youtubeSearchButton());
  } else {
    setStatus(statusEl, "No videos in this category yet", "Add a channel for it in channels.txt, or links in script.js.");
  }
}

function appendMore() {
  if (state.view !== "home" || shown >= list.length) return;
  grid.append(...list.slice(shown, shown + PAGE).map(card));
  shown += PAGE;
  loadMoreBtn.hidden = shown >= list.length;
  // still room on screen? keep going
  requestAnimationFrame(() => {
    if (shown < list.length && sentinel.getBoundingClientRect().top < window.innerHeight + 300) appendMore();
  });
}
loadMoreBtn.addEventListener("click", appendMore);
// Infinite scroll over the already-loaded list (no extra network requests).
new IntersectionObserver((entries) => { if (entries[0].isIntersecting) appendMore(); }, { rootMargin: "400px" }).observe(sentinel);

async function renderLocal(kind) {
  const my = ++renderId;
  list = []; shown = 0; loadMoreBtn.hidden = true;
  grid.replaceChildren(); clearStatus(statusEl);
  feedTitle.textContent = kind === "saved" ? "Watchlist" : "Recently watched";
  const ids = store.get(KEYS[kind], []);
  if (!ids.length) {
    setStatus(statusEl, "Nothing here yet",
      kind === "saved" ? "Open a video and tap “Save to watchlist”." : "Videos you watch will appear here.");
    return;
  }
  addSkeletons(grid, Math.min(ids.length, 6));
  await metaReady;
  if (my !== renderId) return;
  grid.replaceChildren();
  const items = ids.map((id) => ITEMS.get(id)).filter((it) => it && !it.hidden);
  if (items.length) grid.append(...items.map(card));
  else setStatus(statusEl, "These videos are no longer in the list", "They may have been removed from the site.");
}

function showView(view) {
  leaveWatch();
  state.view = view;
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("#chips").hidden = view !== "home";
  if (view === "home") { updateTitle(); renderFeed(); } else renderLocal(view);
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
  const it = ITEMS.get(currentId);
  const link = it ? h("a", { class: "btn", href: ytUrl(it), target: "_blank", rel: "noopener noreferrer" }, "Watch on YouTube") : null;
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

function playNow(it) {
  if (it.type === "playlist") player.loadPlaylist({ listType: "playlist", list: it.id });
  else player.loadVideoById(it.id);
}

async function startPlayer(it) {
  await loadYT();
  if (player && typeof player.loadVideoById === "function") { playNow(it); return; }
  if (player) return; // still starting; onReady below plays currentId
  const playerVars = { autoplay: 1, playsinline: 1, rel: 0 };
  const config = {
    playerVars,
    events: {
      onReady: () => { const now = ITEMS.get(currentId); if (now && now.id !== it.id) playNow(now); },
      onError: onPlayerError,
    },
  };
  if (it.type === "playlist") { playerVars.listType = "playlist"; playerVars.list = it.id; }
  else config.videoId = it.id;
  player = new YT.Player("player", config);
}

function renderSaveButton() {
  const saved = store.get(KEYS.saved, []).includes(currentId);
  $("#saveBtn").textContent = saved ? "✓ Saved" : "Save to watchlist";
}

async function openWatch(id) {
  const it = ITEMS.get(id);
  if (!it) {
    history.replaceState(null, "", location.pathname + location.search);
    toast("That video isn't in this site's list.");
    return;
  }
  if (!watchView.hidden && currentId === id) return;
  if (watchView.hidden) feedScroll = window.scrollY;
  currentId = id;
  feedView.hidden = true; watchView.hidden = false;
  window.scrollTo(0, 0);
  clearStatus($("#playerMsg"));
  $("#ytLink").href = ytUrl(it);
  $("#watchTitle").textContent = titleOf(it);
  $("#watchMeta").textContent = "";
  renderSaveButton();
  addRecent(id);
  startPlayer(it);

  await metaReady;
  if (currentId !== id) return;
  $("#watchTitle").textContent = titleOf(it);
  $("#watchMeta").textContent = [it.channel, it.type === "playlist" ? "Playlist" : ""].filter(Boolean).join(" • ");
  document.title = `${titleOf(it)} – Bhakti Dhara`;
  renderRelated(it);
}

function renderRelated(it) {
  const box = $("#relatedGrid"), st = $("#relatedStatus");
  box.replaceChildren(); clearStatus(st);
  // Related = other videos from the same categories on this site.
  const related = [...ITEMS.values()]
    .filter((x) => x.id !== it.id && !x.hidden && [...x.cats].some((c) => c !== "all" && it.cats.has(c)))
    .slice(0, 8);
  if (related.length) box.append(...related.map(card));
  else setStatus(st, "No related videos yet", "More videos will show here as they are added to this category.");
}

function closeWatch() {
  if (watchView.hidden) return;
  watchView.hidden = true; feedView.hidden = false;
  if (player && typeof player.stopVideo === "function") player.stopVideo();
  currentId = null; stepsIn = 0;
  document.title = "Bhakti Dhara – Bhakti • Knowledge • Podcasts";
  window.scrollTo(0, feedScroll);
}

function leaveWatch() {
  if (watchView.hidden) return;
  feedScroll = 0;
  history.replaceState(null, "", location.pathname + location.search);
  closeWatch();
}

function route() {
  const m = /^#watch=([\w-]{6,40})$/.exec(location.hash);
  if (m) { stepsIn = watchView.hidden ? 1 : stepsIn + 1; openWatch(m[1]); }
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
  const url = location.href;
  const title = $("#watchTitle").textContent || "Bhakti Dhara";
  try {
    if (navigator.share) await navigator.share({ title, url });
    else { await navigator.clipboard.writeText(url); toast("Link copied"); }
  } catch { /* share sheet closed */ }
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
  if (state.view !== "home") renderLocal(state.view);
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
  e.preventDefault();
  state.query = $("#searchInput").value.trim();
  showView("home");
  window.scrollTo(0, 0);
});

// Start
renderChips();
if (/^#watch=/.test(location.hash)) { updateTitle(); renderFeed(); route(); }
else { showView("home"); }
