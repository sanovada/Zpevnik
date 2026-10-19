// Songbook PWA – list, search, song view with chords. No dependencies, no build step.
import { CHORD_RE, chordHtml, parseChord, chordFrets, chordSvg, qualityLabel } from "./chords.js";

// ── Storage (localStorage can throw, e.g. in private windows) ──
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore quota / privacy errors */ }
  },
};

const $ = (sel) => document.querySelector(sel);
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (str) => String(str).replace(/[&<>"']/g, (c) => ESC[c]);
const collator = new Intl.Collator("cs", { sensitivity: "base", numeric: true });
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Search normalisation: no diacritics, lower case, one output char per code point
// (so match positions map 1:1 back onto the original text for highlighting).
function fold(str) {
  let out = "";
  for (const ch of str) {
    const n = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    out += n.length === 1 ? n : " ";
  }
  return out;
}

// ── State (everything read from storage is validated) ──
const THEMES = { auto: "◐", light: "☀", dark: "☾" };
const THEME_LABELS = { auto: "Vzhled: podle systému", light: "Vzhled: světlý", dark: "Vzhled: tmavý" };
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const SCROLL_BASE = 7.7; // px per second at 1× (and 17px font)
const FONT_MIN = 11, FONT_MAX = 32;

function loadSettings() {
  const raw = store.get("settings", {});
  const s = isObject(raw) ? raw : {};
  return {
    font: Number.isInteger(s.font) ? Math.min(FONT_MAX, Math.max(FONT_MIN, s.font)) : 17,
    chords: typeof s.chords === "boolean" ? s.chords : true,
    speed: SPEEDS.includes(s.speed) ? s.speed : 1,
    theme: Object.hasOwn(THEMES, s.theme) ? s.theme : "auto",
    artist: typeof s.artist === "string" ? s.artist : "",
    onlyFavs: s.onlyFavs === true,
  };
}
function loadTranspose() {
  const raw = store.get("transpose", {});
  const out = Object.create(null);
  if (isObject(raw)) for (const [id, v] of Object.entries(raw)) if (Number.isInteger(v) && v >= -6 && v <= 6) out[id] = v;
  return out;
}

let songs = [];
const byId = new Map();
let current = null;   // song shown in the song view
let listScroll = 0;
const settings = loadSettings();
const favs = new Set((Array.isArray(store.get("favs", [])) ? store.get("favs", []) : []).filter((x) => typeof x === "string"));
const transpose = loadTranspose();
const saveSettings = () => store.set("settings", settings);

// ── Data loading ──
async function load() {
  const res = await fetch("songs.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  songs = Array.isArray(data.songs) ? data.songs : [];
  for (const s of songs) {
    s.lines = [];
    for (const block of s.blocks) {
      for (const line of block.lines) {
        const text = line.map((seg) => (typeof seg === "string" ? seg : seg[1])).join("").replace(/ /g, " ").trim();
        if (text) s.lines.push(text);
      }
    }
    s.fLines = s.lines.map(fold);
    s.fHead = fold(`${s.title} ${s.artist}`);
    s.fTitle = fold(s.title);
    s.key = firstChord(s);
    byId.set(s.id, s);
  }
  songs.sort((a, b) => collator.compare(a.title, b.title) || collator.compare(a.artist, b.artist));

  // artist filter with song counts
  const counts = new Map();
  for (const s of songs) if (s.artist) counts.set(s.artist, (counts.get(s.artist) || 0) + 1);
  const select = $("#artist");
  for (const artist of [...counts.keys()].sort(collator.compare)) {
    select.append(new Option(`${artist} (${counts.get(artist)})`, artist));
  }
  if (!counts.has(settings.artist)) settings.artist = "";
  setArtist(settings.artist);
}

// single place that changes the artist filter (keeps select + clear button in sync)
function setArtist(artist) {
  settings.artist = artist;
  saveSettings();
  $("#artist").value = artist;
  $("#artist-clear").hidden = !artist;
  $("#artist").classList.toggle("active", Boolean(artist));
}

function firstChord(song) {
  for (const block of song.blocks) for (const line of block.lines) for (const seg of line) {
    if (typeof seg === "string") continue;
    const token = seg[0].split(" ")[0];
    if (CHORD_RE.test(token)) return token;
  }
  return "";
}

// ── Song list ──
function letterOf(title) {
  const t = title.trim();
  if (/^ch/i.test(t)) return "Ch";
  const c = t.charAt(0).toUpperCase();
  if (/[0-9]/.test(c)) return "#";
  return "ÁÉÍÓÚŮÝĚ".includes(c) ? c.normalize("NFD")[0] : c;
}

function search(pool, words) {
  const rows = [];
  for (const s of pool) {
    let score = 0, hit = -1;
    if (words.every((w) => s.fHead.includes(w))) {
      score = s.fTitle.startsWith(words[0]) ? 3 : words.every((w) => s.fTitle.includes(w)) ? 2 : 1;
    } else {
      hit = s.fLines.findIndex((l) => words.every((w) => l.includes(w)));
      if (hit < 0 && words.every((w) => s.fLines.some((l) => l.includes(w)))) {
        hit = s.fLines.findIndex((l) => l.includes(words[0]));
      }
      if (hit < 0) continue;
    }
    rows.push({ s, score, hit });
  }
  return rows.sort((a, b) => b.score - a.score || collator.compare(a.s.title, b.s.title));
}

function renderList() {
  const words = fold($("#search").value.trim()).split(/\s+/).filter(Boolean);
  let pool = songs;
  if (settings.artist) pool = pool.filter((s) => s.artist === settings.artist);
  if (settings.onlyFavs) pool = pool.filter((s) => favs.has(s.id));
  const rows = words.length ? search(pool, words) : pool.map((s) => ({ s, hit: -1 }));

  let html = "", last = "";
  const letters = [];
  for (const { s, hit } of rows) {
    if (!words.length) {
      const L = letterOf(s.title);
      if (L !== last) {
        html += `<li class="letter" data-l="${esc(L)}">${esc(L)}</li>`;
        letters.push(L);
        last = L;
      }
    }
    const snippet = hit >= 0 ? `<div class="hit">${highlight(s.lines[hit], s.fLines[hit], words)}</div>` : "";
    html += `<li><a href="#/s/${encodeURIComponent(s.id)}"><div class="meta"><div class="t">${esc(s.title)}</div>`
      + (s.artist ? `<div class="a">${esc(s.artist)}</div>` : "") + snippet + "</div>"
      + (favs.has(s.id) ? `<span class="star" aria-label="oblíbená">★</span>` : "")
      + (s.key ? `<span class="key" title="První akord">${esc(s.key)}</span>` : "") + "</a></li>";
  }
  $("#list").innerHTML = html;
  $("#empty").hidden = rows.length > 0;
  $("#count").textContent = `${rows.length} písní`;
  renderIndex(letters.length > 3 ? letters : []);
}

function highlight(text, folded, words) {
  const chars = [...text];
  const marks = new Array(chars.length).fill(false);
  for (const w of words) {
    for (let i = folded.indexOf(w); i >= 0; i = folded.indexOf(w, i + w.length)) {
      for (let k = i; k < i + w.length; k++) marks[k] = true;
    }
  }
  let out = "", open = false;
  chars.forEach((ch, i) => {
    if (marks[i] !== open) { out += open ? "</mark>" : "<mark>"; open = marks[i]; }
    out += esc(ch);
  });
  return out + (open ? "</mark>" : "");
}

// ── A–Z index: tap or drag a finger along it ──
function renderIndex(letters) {
  const az = $("#az");
  az.innerHTML = letters.map((L) => `<button type="button" data-l="${esc(L)}" aria-label="Písmeno ${esc(L)}">${esc(L)}</button>`).join("");
  az.hidden = !letters.length;
  $("#list").classList.toggle("indexed", letters.length > 0);
  updateHeaderHeight();
}
function updateHeaderHeight() {
  document.documentElement.style.setProperty("--hdr", `${$("#view-list .bar").offsetHeight}px`);
}
function jumpTo(letter) {
  const li = document.querySelector(`#list .letter[data-l="${CSS.escape(letter)}"]`);
  if (li) window.scrollTo(0, li.getBoundingClientRect().top + window.scrollY - $("#view-list .bar").offsetHeight);
}
let endIndexDrag = () => {};
function bindIndex() {
  const az = $("#az");
  const bubble = document.createElement("div");
  bubble.id = "az-bubble";
  bubble.hidden = true;
  bubble.setAttribute("aria-hidden", "true");
  document.body.append(bubble);
  let lastLetter = "", safety = 0;
  const pick = (e) => {
    // Safety net: some mobile browsers occasionally drop pointerup/pointercancel.
    clearTimeout(safety);
    safety = setTimeout(end, 3000);
    const el = document.elementFromPoint(az.getBoundingClientRect().left + az.offsetWidth / 2, e.clientY);
    const letter = el?.parentNode === az ? el.dataset.l : null;
    if (!letter || letter === lastLetter) return;
    lastLetter = letter;
    jumpTo(letter);
    bubble.textContent = letter;
    bubble.hidden = false;
    for (const b of az.children) b.classList.toggle("on", b === el);
  };
  const end = () => {
    clearTimeout(safety);
    lastLetter = "";
    bubble.hidden = true;
    for (const b of az.children) b.classList.remove("on");
  };
  endIndexDrag = end;
  az.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return; // mouse uses plain clicks below
    az.setPointerCapture(e.pointerId);
    pick(e);
    e.preventDefault();
  });
  az.addEventListener("pointermove", (e) => { if (az.hasPointerCapture(e.pointerId)) pick(e); });
  az.addEventListener("pointerup", end);
  az.addEventListener("pointercancel", end);
  az.addEventListener("lostpointercapture", end);
  window.addEventListener("pointerup", end);
  window.addEventListener("blur", end);
  document.addEventListener("visibilitychange", end);
  az.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) jumpTo(b.dataset.l); });
  window.addEventListener("resize", updateHeaderHeight);
}

// ── Song view ──
const isBlank = (str) => !str.replace(/[\s |/:.]/g, "");
const isChordOnly = (line) => line.every((seg) => isBlank(typeof seg === "string" ? seg : seg[1]));

function renderSong() {
  hideChord();
  const s = current;
  const steps = transpose[s.id] || 0;
  let html = "";
  for (const block of s.blocks) {
    const first = block.lines[0];
    const hasChords = first?.some((seg) => typeof seg !== "string") && !isChordOnly(first);
    const cls = ["block", block.type, block.label ? "" : "nolabel", hasChords ? "chords" : "", block.lines.length ? "" : "ref"]
      .filter(Boolean).join(" ");
    const body = block.lines.length
      ? block.lines.map((line) => renderLine(line, steps)).join("")
      : `<div class="ln">${block.type === "chorus" ? "Refrén" : ""}</div>`;
    html += `<div class="${cls}"><div class="lab">${esc(block.label || "")}</div><div class="body">${body}</div></div>`;
  }
  const el = $("#song");
  el.innerHTML = html;
  el.style.setProperty("--fs", `${settings.font}px`);
  el.classList.toggle("nochords", !settings.chords);
  $("#tr").textContent = steps > 0 ? `+${steps}` : String(steps);
}

function renderLine(line, steps) {
  if (!line.length) return `<div class="ln gap"></div>`;
  const hasChord = line.some((seg) => typeof seg !== "string");
  const chordOnly = hasChord && isChordOnly(line);
  let html = "";
  for (const seg of line) {
    if (typeof seg === "string") { html += esc(seg); continue; }
    const [chord, text] = seg;
    const anchor = /^\S*/.exec(text)[0]; // syllable / word the chord sits on
    html += `<span class="an"><span class="c">${chordHtml(chord, steps)}</span>`
      + `<span class="w">${esc(anchor) || "​"}</span></span>${esc(text.slice(anchor.length))}`;
  }
  return `<div class="ln${hasChord ? " ch" : ""}${chordOnly ? " chordonly" : ""}">${html}</div>`;
}

// ── Chord diagram popover ──
let chordAnchor = null;
function showChord(el) {
  const pop = $("#chord-pop");
  if (chordAnchor === el && !pop.hidden) { hideChord(); return; }
  const name = el.dataset.ch;
  const chord = parseChord(name);
  const frets = chord && chordFrets(chord);
  const notes = [];
  if (chord) notes.push(qualityLabel(chord.quality));
  if (chord?.approx) notes.push("zjednodušeně");
  if (chord?.bass) notes.push(`basa ${chord.bass}`);
  pop.innerHTML = `<div class="cp-head"><strong>${esc(name)}</strong><span class="muted">${esc(notes.filter(Boolean).join(" · "))}</span></div>`
    + (frets ? chordSvg(frets) : `<p class="muted">Diagram není k dispozici.</p>`);
  pop.hidden = false;
  chordAnchor = el;
  // place under the chord (above it when there is no room), clamped to the viewport
  const r = el.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), document.documentElement.clientWidth - w - 8);
  const below = r.bottom + 6 + h < window.innerHeight;
  pop.style.left = `${left + window.scrollX}px`;
  pop.style.top = `${(below ? r.bottom + 6 : r.top - h - 6) + window.scrollY}px`;
}
function hideChord() {
  $("#chord-pop").hidden = true;
  chordAnchor = null;
}

function openSong(id) {
  const s = byId.get(id);
  if (!s) { location.hash = "#/"; return; }
  if ($("#view-song").hidden) listScroll = window.scrollY;
  current = s;
  endIndexDrag();
  stopScroll();
  hideChord();
  $("#s-title").textContent = s.title;
  $("#s-artist").textContent = s.artist;
  $("#s-artist").disabled = !s.artist;
  document.title = `${s.title} – Zpěvník`;
  updateFav();
  renderSong();
  $("#view-list").hidden = true;
  $("#view-song").hidden = false;
  window.scrollTo(0, 0);
  wakeLock(true);
}
function showList() {
  current = null;
  endIndexDrag();
  hideChord();
  stopScroll();
  wakeLock(false);
  document.title = "Zpěvník";
  $("#view-song").hidden = true;
  $("#view-list").hidden = false;
  renderList();
  window.scrollTo(0, listScroll);
}
function updateFav() {
  const on = favs.has(current.id);
  $("#fav").textContent = on ? "★" : "☆";
  $("#fav").setAttribute("aria-pressed", String(on));
}

// ── Auto-scroll ──
let scrollRAF = 0, scrollPos = 0, lastT = 0;
function startScroll() {
  setPressed($("#scroll-btn"), true);
  $("#scroll-btn").textContent = "❚❚";
  scrollPos = window.scrollY;
  lastT = 0;
  const step = (t) => {
    if (lastT) {
      scrollPos += ((t - lastT) / 1000) * SCROLL_BASE * settings.speed * (settings.font / 17);
      window.scrollTo(0, scrollPos);
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) { stopScroll(); return; }
    }
    lastT = t;
    scrollRAF = requestAnimationFrame(step);
  };
  scrollRAF = requestAnimationFrame(step);
}
function stopScroll() {
  cancelAnimationFrame(scrollRAF);
  scrollRAF = 0;
  setPressed($("#scroll-btn"), false);
  $("#scroll-btn").textContent = "▶";
}
// manual scrolling during auto-scroll takes over the position
window.addEventListener("touchend", () => { scrollPos = window.scrollY; }, { passive: true });
window.addEventListener("wheel", () => { scrollPos = window.scrollY; }, { passive: true });

// ── Keep the screen on while a song is open ──
let lock = null;
async function wakeLock(on) {
  try {
    if (on && !lock && "wakeLock" in navigator) {
      lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => { lock = null; });
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch { /* not supported or denied */ }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && current) wakeLock(true);
});

// ── Theme ──
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === "auto") root.removeAttribute("data-theme");
  else root.dataset.theme = settings.theme;
  const btn = $("#theme-btn");
  btn.textContent = THEMES[settings.theme];
  btn.setAttribute("aria-label", THEME_LABELS[settings.theme]);
  btn.title = THEME_LABELS[settings.theme];
  const dark = settings.theme === "dark" || (settings.theme === "auto" && darkQuery.matches);
  $('meta[name="theme-color"]').content = dark ? "#1d1d1d" : "#d4622a";
}

// ── UI wiring ──
function toast(message, actionLabel, onAction) {
  const el = $("#toast");
  el.replaceChildren(message);
  if (actionLabel) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = actionLabel;
    btn.addEventListener("click", onAction);
    el.append(" ", btn);
  }
  el.hidden = false;
  clearTimeout(toast.timer);
  if (!actionLabel) toast.timer = setTimeout(() => { el.hidden = true; }, 2500);
}

const setPressed = (btn, on) => btn.setAttribute("aria-pressed", String(on));
const updateFavsBtn = () => setPressed($("#favs-btn"), settings.onlyFavs);
const updateChordBtn = () => setPressed($("#chords-btn"), settings.chords);
const updateSpeedBtn = () => { $("#speed-btn").textContent = `${String(settings.speed).replace(".", ",")}×`; };
const resetListScroll = () => window.scrollTo(0, 0);

function onToolClick(e) {
  const action = e.target.closest("button")?.dataset.act;
  if (!action || !current) return;
  const id = current.id;
  switch (action) {
    case "tr+":
    case "tr-": {
      const v = (((transpose[id] || 0) + (action === "tr+" ? 1 : -1) + 18) % 12) - 6; // range -6..+5
      if (v) transpose[id] = v; else delete transpose[id];
      store.set("transpose", transpose);
      if (v && !settings.chords) { settings.chords = true; saveSettings(); updateChordBtn(); }
      renderSong();
      break;
    }
    case "chords":
      settings.chords = !settings.chords;
      saveSettings(); updateChordBtn(); renderSong();
      break;
    case "font+":
    case "font-":
      settings.font = Math.min(FONT_MAX, Math.max(FONT_MIN, settings.font + (action === "font+" ? 1 : -1)));
      saveSettings(); renderSong();
      break;
    case "scroll":
      if (scrollRAF) stopScroll(); else startScroll();
      break;
    case "speed":
      settings.speed = SPEEDS[(SPEEDS.indexOf(settings.speed) + 1) % SPEEDS.length];
      saveSettings(); updateSpeedBtn();
      break;
  }
}

function bind() {
  let debounce;
  const syncSearchClear = () => { $("#search-clear").hidden = !$("#search").value; };
  $("#search").addEventListener("input", () => {
    syncSearchClear();
    clearTimeout(debounce);
    debounce = setTimeout(() => { renderList(); resetListScroll(); }, 120);
  });
  $("#search-clear").addEventListener("click", () => {
    $("#search").value = "";
    syncSearchClear();
    renderList(); resetListScroll();
    $("#search").focus();
  });
  $("#search-form").addEventListener("submit", (e) => { e.preventDefault(); $("#search").blur(); });
  $("#artist").addEventListener("change", (e) => {
    setArtist(e.target.value);
    renderList(); resetListScroll();
  });
  $("#artist-clear").addEventListener("click", () => {
    setArtist("");
    renderList(); resetListScroll();
  });
  $("#favs-btn").addEventListener("click", () => {
    settings.onlyFavs = !settings.onlyFavs;
    saveSettings(); updateFavsBtn(); renderList(); resetListScroll();
  });
  // tapping the artist in the song view lists all their songs
  $("#s-artist").addEventListener("click", () => {
    if (!current?.artist) return;
    settings.onlyFavs = false;
    setArtist(current.artist);
    $("#search").value = "";
    $("#search-clear").hidden = true;
    updateFavsBtn();
    listScroll = 0;
    location.hash = "#/";
  });
  bindIndex();
  $("#theme-btn").addEventListener("click", () => {
    const keys = Object.keys(THEMES);
    settings.theme = keys[(keys.indexOf(settings.theme) + 1) % keys.length];
    saveSettings(); applyTheme();
  });
  $("#back").addEventListener("click", () => {
    if (history.state?.fromList) history.back(); else location.hash = "#/";
  });
  $("#fav").addEventListener("click", () => {
    if (favs.has(current.id)) favs.delete(current.id); else favs.add(current.id);
    store.set("favs", [...favs]);
    updateFav();
    toast(favs.has(current.id) ? "Přidáno do oblíbených" : "Odebráno z oblíbených");
  });
  $(".tools").addEventListener("click", onToolClick);
  $("#song").addEventListener("click", (e) => {
    const chord = e.target.closest(".cn");
    if (chord) showChord(chord); else hideChord();
  });
  $("#song").addEventListener("keydown", (e) => {
    const chord = e.target.closest(".cn");
    if (chord && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); showChord(chord); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideChord(); });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#chord-pop, #song")) hideChord();
  });
  // opening a song from the list pushes a history entry, so "back" restores the list
  $("#list").addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    listScroll = window.scrollY;
    history.pushState({ fromList: true }, "", link.getAttribute("href"));
    route();
  });
  window.addEventListener("hashchange", route);
  window.addEventListener("popstate", route);
  darkQuery.addEventListener("change", applyTheme);
}

function route() {
  const m = /^#\/s\/(.+)$/.exec(location.hash);
  if (!m) { showList(); return; }
  let id;
  try { id = decodeURIComponent(m[1]); } catch { location.hash = "#/"; return; }
  openSong(id);
}

// ── Service worker (offline + installable app) ──
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) toast("Je k dispozici nová verze zpěvníku.", "Obnovit", () => location.reload());
  });
}

async function init() {
  applyTheme();
  updateChordBtn();
  updateSpeedBtn();
  updateFavsBtn();
  bind();
  registerServiceWorker();
  try {
    await load();
  } catch {
    $("#empty").textContent = "Nepodařilo se načíst písničky.";
    $("#empty").hidden = false;
    return;
  }
  route();
}

init();
