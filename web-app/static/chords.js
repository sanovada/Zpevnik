// Chord names, transposition and guitar chord diagrams (Czech notation: H = B natural, B = B flat).

export const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "B", "H"];
const BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 10, H: 11 };
export const CHORD_RE = /^[A-H](#|b)?(maj|min|mi|m|dim|sus|add|aug|[0-9]|[()+\-*.°]|\/[A-H](#|b)?)*$/;
// A chord inside a longer annotation such as "(G)" or "Emi," – not part of a word.
const CORE_RE = /(?<![A-Za-z#])([A-H])(#|b)?((?:maj|min|mi|m|dim|sus|add|aug|[0-9]|[+°-])*)(?:\/([A-H])(#|b)?)?(?![A-Za-z])/g;

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (str) => String(str).replace(/[&<>"']/g, (c) => ESC[c]);

export function noteIndex(letter, accidental) {
  let n = BASE[letter];
  if (accidental === "#") n += 1;
  else if (accidental === "b" && letter !== "B") n -= 1; // Czech "B" already is B flat
  return (n + 12) % 12;
}
const shift = (letter, acc, steps) => NOTES[(noteIndex(letter, acc) + steps + 120) % 12];

/** Chord text -> HTML with every chord transposed and wrapped in a clickable span. */
export function chordHtml(text, steps) {
  let html = "", last = 0;
  for (const m of text.matchAll(CORE_RE)) {
    const [whole, root, acc, suffix, bass, bassAcc] = m;
    const name = shift(root, acc, steps) + suffix + (bass ? `/${shift(bass, bassAcc, steps)}` : "");
    html += esc(text.slice(last, m.index))
      + `<span class="cn" role="button" tabindex="0" data-ch="${esc(name)}">${esc(name)}</span>`;
    last = m.index + whole.length;
  }
  return html + esc(text.slice(last));
}

// ── Chord qualities ──
const QUALITY = {
  "": "", m: "mi", mi: "mi", min: "mi",
  7: "7", mi7: "mi7", m7: "mi7", min7: "mi7", "7mi": "mi7",
  maj7: "maj7", maj: "maj7", "7maj": "maj7",
  sus4: "sus4", sus: "sus4", "4sus": "sus4", 4: "sus4",
  sus2: "sus2", "2sus": "sus2", 2: "sus2",
  6: "6", mi6: "mi6", m6: "mi6", 9: "9", add9: "add9", add2: "add9",
  dim: "dim", dim7: "dim", "°": "dim", aug: "aug", "+": "aug", "5+": "aug",
  "7sus4": "7sus4", "7sus": "7sus4", 5: "5",
  mi7b5: "m7b5", m7b5: "m7b5", "mi75-": "m7b5", "mi7/5-": "m7b5",
};
const QUALITY_LABEL = {
  "": "dur", mi: "moll", 7: "dominantní septakord", mi7: "mollový septakord", maj7: "velký septakord",
  sus4: "sus4", sus2: "sus2", 6: "sextakord", mi6: "mollový sextakord", 9: "nónový akord", add9: "add9",
  dim: "zmenšený", aug: "zvětšený", "7sus4": "septakord sus4", 5: "kvinta (power chord)", m7b5: "polozmenšený",
};

// Open-position shapes, strings low E → high e ("x" = muted)
const OPEN = {
  C: "x32010", D: "xx0232", E: "022100", G: "320003", A: "x02220",
  Dmi: "xx0231", Emi: "022000", Ami: "x02210",
  C7: "x32310", D7: "xx0212", E7: "020100", G7: "320001", A7: "x02020", H7: "x21202",
  Dmi7: "xx0211", Emi7: "020000", Ami7: "x02010",
  Cmaj7: "x32000", Dmaj7: "xx0222", Emaj7: "021100", Fmaj7: "xx3210", Gmaj7: "320002", Amaj7: "x02120",
  Dsus4: "xx0233", Esus4: "022200", Asus4: "x02230", Dsus2: "xx0230", Asus2: "x02200",
  C6: "x32210", D6: "xx0202", E6: "022120", G6: "320000", A6: "x02222",
  Emi6: "022020", Ami6: "x02212", Dmi6: "xx0201",
  Cadd9: "x32030", Gadd9: "3x0203",
  D7sus4: "xx0213", E7sus4: "020200", A7sus4: "x02030",
  E5: "022xxx", A5: "x022xx", D5: "xx023x",
};
// Movable (barre) shapes as fret offsets from the root fret; null = muted
const E_SHAPE = {
  "": [0, 2, 2, 1, 0, 0], mi: [0, 2, 2, 0, 0, 0], 7: [0, 2, 0, 1, 0, 0], mi7: [0, 2, 0, 0, 0, 0],
  maj7: [0, null, 1, 1, 0, null], sus4: [0, 2, 2, 2, 0, 0], "7sus4": [0, 2, 0, 2, 0, 0],
  5: [0, 2, 2, null, null, null], dim: [0, 1, 2, 0, 2, 0], mi6: [0, null, -1, 0, 0, 0],
};
const A_SHAPE = {
  "": [null, 0, 2, 2, 2, 0], mi: [null, 0, 2, 2, 1, 0], 7: [null, 0, 2, 0, 2, 0], mi7: [null, 0, 2, 0, 1, 0],
  maj7: [null, 0, 2, 1, 2, 0], sus4: [null, 0, 2, 2, 3, 0], sus2: [null, 0, 2, 2, 0, 0],
  6: [null, 0, 2, 2, 2, 2], mi6: [null, 0, 2, 2, 1, 2], 9: [null, 0, -1, 0, 0, 0], add9: [null, 0, 2, 4, 2, 0],
  "7sus4": [null, 0, 2, 0, 3, 0], 5: [null, 0, 2, 2, null, null], dim: [null, 0, 1, -1, 1, null],
  aug: [null, 0, -1, -2, -2, null], m7b5: [null, 0, 1, 0, 1, null],
};

const D_SHAPE = {
  "": [null, null, 0, 2, 3, 2], mi: [null, null, 0, 2, 3, 1], 7: [null, null, 0, 2, 1, 2],
  mi7: [null, null, 0, 2, 1, 1], maj7: [null, null, 0, 2, 2, 2], sus4: [null, null, 0, 2, 3, 3],
  sus2: [null, null, 0, 2, 3, 0], 6: [null, null, 0, 2, 0, 2], mi6: [null, null, 0, 2, 0, 1],
};

function movable(offsets, rootFret) {
  if (!offsets) return null;
  const min = Math.min(...offsets.filter((o) => o !== null));
  const r = rootFret + min < 0 ? rootFret + 12 : rootFret;
  return offsets.map((o) => (o === null ? null : r + o));
}
const span = (frets) => Math.max(...frets.filter((f) => f !== null));

/** Parses a chord name; returns null when it is not a chord. */
export function parseChord(name) {
  const m = /^([A-H])(#|b)?([^/]*)(?:\/([A-H])(#|b)?)?$/.exec(name);
  if (!m) return null;
  const [, letter, acc, suffix, bass, bassAcc] = m;
  let quality = QUALITY[suffix];
  let approx = false;
  if (quality === undefined) {
    approx = true;
    quality = suffix.startsWith("mi9") ? "mi7" : /^m(?!aj)/.test(suffix) ? "mi" : "";
  }
  return {
    root: noteIndex(letter, acc),
    quality,
    approx,
    bass: bass ? NOTES[noteIndex(bass, bassAcc)] : "",
  };
}

/** Best guitar fingering: open shape when there is one, else the lowest movable shape (E, A or D root). */
export function chordFrets({ root, quality }) {
  const open = OPEN[NOTES[root] + quality];
  if (open) return [...open].map((c) => (c === "x" ? null : Number(c)));
  const candidates = [
    movable(E_SHAPE[quality], (root - 4 + 12) % 12),
    movable(A_SHAPE[quality], (root - 9 + 12) % 12),
    movable(D_SHAPE[quality], (root - 2 + 12) % 12),
  ].filter(Boolean);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => span(a) - span(b))[0];
}

export const qualityLabel = (q) => QUALITY_LABEL[q] ?? "";

/** SVG chord box (6 strings × 5 frets). */
export function chordSvg(frets) {
  const W = 132, X0 = 26, DX = 16, Y0 = 34, DY = 22, FRETS = 5;
  const played = frets.filter((f) => f !== null && f > 0);
  const max = played.length ? Math.max(...played) : 0;
  const base = max <= FRETS ? 1 : Math.min(...played);
  const xs = (i) => X0 + i * DX;
  const yDot = (f) => Y0 + (f - base + 0.5) * DY;
  let svg = `<svg class="cd" viewBox="0 0 ${W} ${Y0 + FRETS * DY + 10}" width="${W}" role="img" aria-hidden="true">`;

  // grid
  for (let i = 0; i <= FRETS; i++) {
    svg += `<line class="cd-fret" x1="${xs(0)}" x2="${xs(5)}" y1="${Y0 + i * DY}" y2="${Y0 + i * DY}"/>`;
  }
  for (let s = 0; s < 6; s++) svg += `<line class="cd-str" x1="${xs(s)}" x2="${xs(s)}" y1="${Y0}" y2="${Y0 + FRETS * DY}"/>`;
  if (base === 1) svg += `<rect class="cd-nut" x="${xs(0) - 1}" y="${Y0 - 4}" width="${5 * DX + 2}" height="5"/>`;
  else svg += `<text class="cd-base" x="${xs(0) - 8}" y="${yDot(base) + 4}" text-anchor="end">${base}.</text>`;

  // barre (movable shapes only, i.e. no open strings): lowest fret held from the lowest fretted string to the top string
  const low = played.length ? Math.min(...played) : 0;
  const first = frets.findIndex((f) => f !== null && f > 0);
  if (low && !frets.includes(0) && frets[first] === low && frets[5] === low && frets.filter((f) => f === low).length >= 2) {
    svg += `<rect class="cd-dot" x="${xs(first) - 6}" y="${yDot(low) - 6}" width="${xs(5) - xs(first) + 12}" height="12" rx="6"/>`;
  }
  frets.forEach((f, s) => {
    const x = xs(s);
    if (f === null) {
      svg += `<path class="cd-mute" d="M${x - 4} ${Y0 - 16}l8 8m0 -8l-8 8"/>`;
    } else if (f === 0) {
      svg += `<circle class="cd-open" cx="${x}" cy="${Y0 - 12}" r="4"/>`;
    } else {
      svg += `<circle class="cd-dot" cx="${x}" cy="${yDot(f)}" r="6"/>`;
    }
  });
  return svg + "</svg>";
}
