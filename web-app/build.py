"""
Builds the web songbook: converts songs/*.tex into songs.json (including chords)
and copies the static app files into the output directory.

Usage:
    python web-app/build.py                       # songs/ -> web-app/dist/
    python web-app/build.py --songs songs --out /dist
"""
import argparse
import glob
import hashlib
import json
import os
import re
import shutil
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

NBSP = "\u00a0"

# Commands whose argument is plain text (formatting is dropped).
TRANSPARENT = {"textit", "textbf", "emph", "textsc", "underline", "mbox", "text", "textrm", "textsf"}
# Argument-less commands that produce no output.
NOOP = {
    "small", "footnotesize", "scriptsize", "tiny", "large", "Large", "normalsize", "bfseries", "itshape",
    "centering", "noindent", "relax", "fill", "vfill", "hfill", "columnbreak", "newpage", "pagebreak",
    "clearpage", "medskip", "smallskip", "bigskip", "restoregeometry", "item", "folder", "pic", "esong",
}
# Commands dropped together with their [optional] and {mandatory} arguments.
DROP_ARGS = {
    "vspace", "includegraphics", "IfFileExists", "begin", "end", "newgeometry", "setlength", "setcounter",
    "thispagestyle", "pagestyle", "usepackage", "setstretch", "label", "addtocounter", "columnsep",
    "phantom", "hphantom", "vphantom", "rule",
}
SYMBOLS = {"ldots": "…", "dots": "…", "guitarSharp": "#", "guitarFlat": "b", "sharp": "#", "flat": "b",
           "quad": NBSP * 2, "qquad": NBSP * 4, "enspace": NBSP, "space": " ", "newline": None, "par": None}


class Song:
    def __init__(self):
        self.blocks = []
        self.block = None
        self.line = []
        self.verse_no = 0
        self.start_block("text", "")

    # --- output ---
    def start_block(self, kind, label):
        self.end_line()
        self.close_block()
        self.block = {"type": kind, "label": label, "lines": []}

    def close_block(self):
        b = self.block
        if b is None:
            return
        while b["lines"] and b["lines"][-1] == []:
            b["lines"].pop()
        keep = b["lines"] or b["type"] == "chorus" or b["label"]
        if keep:
            self.blocks.append(b)
        self.block = None

    def text(self, s):
        if not s:
            return
        if not self.line:
            self.line.append(["", ""])
        seg = self.line[-1]
        if s == " ":
            prev = seg[1][-1:]
            if not prev and len(self.line) > 1:  # chord above a space: the space is already in the previous segment
                prev = self.line[-2][1][-1:]
            at_start = len(self.line) == 1 and not seg[0] and not seg[1]
            if at_start or prev == " ":
                return
        seg[1] += s

    def chord(self, c):
        c = re.sub(r"\s+", " ", c).strip()
        if c:
            self.line.append([c, ""])

    def end_line(self):
        line = self.line
        self.line = []
        if not line:
            return
        line[0][1] = line[0][1].lstrip(" ")
        line[-1][1] = line[-1][1].rstrip(" ")
        if not any(c or t.strip(" " + NBSP) for c, t in line):
            return
        out = [t if not c else [c, t] for c, t in line if c or t]
        self.block["lines"].append(out)

    def paragraph(self):
        self.end_line()
        if self.block["lines"] and self.block["lines"][-1] != []:
            self.block["lines"].append([])

    def finish(self):
        self.end_line()
        self.close_block()
        return self.blocks


class Parser:
    def __init__(self, src, song):
        self.s = src
        self.i = 0
        self.out = song

    def peek(self, k=0):
        j = self.i + k
        return self.s[j] if j < len(self.s) else ""

    def group(self, open_="{", close="}"):
        """Reads a balanced {…} group and returns its content, otherwise None."""
        if self.peek() != open_:
            return None
        depth, j = 0, self.i
        while j < len(self.s):
            ch = self.s[j]
            if ch == "\\":
                j += 2
                continue
            if ch == open_:
                depth += 1
            elif ch == close:
                depth -= 1
                if depth == 0:
                    inner = self.s[self.i + 1:j]
                    self.i = j + 1
                    return inner
            j += 1
        inner = self.s[self.i + 1:]
        self.i = len(self.s)
        return inner

    def skip_args(self):
        if self.peek() == "*":
            self.i += 1
        while self.peek() in ("{", "["):
            if self.peek() == "{":
                self.group()
            else:
                self.group("[", "]")

    def sub(self, src):
        p = Parser(src, self.out)
        p.run()

    def run(self):
        s, out = self.s, self.out
        while self.i < len(s):
            ch = s[self.i]
            if ch == "%":
                nl = s.find("\n", self.i)
                self.i = len(s) if nl == -1 else nl + 1
            elif ch == "\\":
                self.command()
            elif ch in "{}$":
                self.i += 1
            elif ch == "\n":
                m = re.compile(r"\n[ \t\r]*(?:%[^\n]*)?\n").match(s, self.i)
                if m:
                    out.paragraph()
                    self.i = m.end()
                    while True:  # swallow further blank lines
                        m = re.compile(r"[ \t\r]*(?:%[^\n]*)?\n").match(s, self.i)
                        if not m or m.end() == self.i:
                            break
                        self.i = m.end()
                else:
                    out.text(" ")
                    self.i += 1
            elif ch in " \t\r":
                out.text(" ")
                self.i += 1
            elif ch == "~":
                out.text(NBSP)
                self.i += 1
            elif s.startswith("---", self.i):
                out.text("—")
                self.i += 3
            elif s.startswith("--", self.i):
                out.text("–")
                self.i += 2
            elif s.startswith("``", self.i):
                out.text("“")
                self.i += 2
            elif s.startswith("''", self.i):
                out.text("”")
                self.i += 2
            else:
                out.text(ch)
                self.i += 1

    def command(self):
        s, out = self.s, self.out
        self.i += 1
        nxt = self.peek()
        if nxt == "\\":  # \\ = line break
            self.i += 1
            if self.peek() == "*":
                self.i += 1
            if self.peek() == "[":  # \\[1em] = gap between stanzas
                self.group("[", "]")
                out.paragraph()
            else:
                out.end_line()
            return
        if not nxt.isalpha():
            self.i += 1
            if nxt in " ,;:":
                out.text(" ")
            elif nxt not in "-/":
                out.text(nxt)
            return
        m = re.compile(r"[A-Za-z]+").match(s, self.i)
        name = m.group()
        self.i = m.end()
        while self.peek() in (" ", "\t"):
            self.i += 1

        if name in ("ch", "c"):
            arg = self.group()
            if arg is not None:
                out.chord(latex_to_plain(arg))
        elif name == "ve":
            self.skip_args()
            out.verse_no += 1
            out.start_block("verse", f"{out.verse_no}.")
        elif name == "cho":
            self.skip_args()
            out.start_block("chorus", "R:")
        elif name == "re":
            arg = self.group()
            out.start_block("rest", latex_to_plain(arg or "").strip())
        elif name == "uv":
            arg = self.group() or ""
            out.text("„")
            self.sub(arg)
            out.text("“")
        elif name in TRANSPARENT:
            arg = self.group()
            if arg is not None:
                self.sub(arg)
        elif name in ("hspace", "hskip"):
            if self.peek() == "*":
                self.i += 1
            if self.group() is None:
                m = re.compile(r"-?[\d.,]+\s*[a-z]{2}").match(s, self.i)
                if m:
                    self.i = m.end()
            out.text(NBSP * 3)
        elif name in SYMBOLS:
            v = SYMBOLS[name]
            if self.peek() == "{" and s.startswith("{}", self.i):
                self.i += 2
            if v is None:
                out.end_line() if name == "newline" else out.paragraph()
            else:
                out.text(v)
        elif name in DROP_ARGS:
            self.skip_args()
        elif name in NOOP:
            if s.startswith("{}", self.i):
                self.i += 2
        # unknown command: drop the name, keep the following text


def latex_to_plain(src):
    """Converts a LaTeX snippet (chord, title, label) to plain text."""
    tmp = Song()
    Parser(src, tmp).run()
    tmp.end_line()
    lines = tmp.block["lines"]
    parts = []
    for line in lines:
        for seg in line:
            parts.append(seg if isinstance(seg, str) else seg[0] + " " + seg[1])
    return re.sub(r"\s+", " ", " ".join(parts).replace(NBSP, " ")).strip()


START_RE = re.compile(r"\\(song|subsection\*?)\s*\{")


def split_songs(content):
    """Finds the individual songs in a file (\\song{…} or \\subsection{…})."""
    # strip comments (except escaped \%)
    content = re.sub(r"(?<!\\)%[^\n]*", "", content)
    starts = list(START_RE.finditer(content))
    songs = []
    for k, m in enumerate(starts):
        p = Parser(content, None)
        p.i = m.end() - 1
        head = p.group() or ""
        body_end = starts[k + 1].start() if k + 1 < len(starts) else len(content)
        body = content[p.i:body_end]
        e = re.search(r"\\esong\b", body)
        if e:
            body = body[:e.start()]
        songs.append((head, body))
    return songs


def parse_head(head):
    plain = latex_to_plain(head)
    m = re.match(r"^(.*?)\s*\(([^()]+)\)\s*$", plain)
    if m and m.group(1):
        return m.group(1).strip(), m.group(2).strip()
    return plain, ""


def ascii_fold(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def parse_file(path):
    with open(path, encoding="utf-8-sig") as f:
        content = f.read()
    stem = os.path.splitext(os.path.basename(path))[0]
    found = split_songs(content)
    result = []
    for n, (head, body) in enumerate(found):
        title, artist = parse_head(head)
        song = Song()
        Parser(body, song).run()
        blocks = song.finish()
        if not title or not blocks:
            continue
        sid = stem if len(found) == 1 else f"{stem}-{n + 1}"
        result.append({
            "id": sid,
            "file": os.path.basename(path),
            "title": title,
            "artist": artist,
            "blocks": blocks,
        })
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--songs", default=os.path.join(ROOT, "songs"))
    ap.add_argument("--out", default=os.path.join(HERE, "dist"))
    args = ap.parse_args()

    songs, skipped = [], []
    for path in sorted(glob.glob(os.path.join(args.songs, "*.tex"))):
        try:
            parsed = parse_file(path)
        except Exception as e:  # one broken song must not break the build
            print(f"ERROR {os.path.basename(path)}: {e}")
            parsed = []
        if parsed:
            songs.extend(parsed)
        else:
            skipped.append(os.path.basename(path))

    songs.sort(key=lambda s: (ascii_fold(s["title"]).lower(), s["id"]))
    data = json.dumps({"songs": songs}, ensure_ascii=False, separators=(",", ":"))

    # static files
    static = os.path.join(HERE, "static")
    if os.path.isdir(args.out):
        shutil.rmtree(args.out)
    shutil.copytree(static, args.out)
    with open(os.path.join(args.out, "songs.json"), "w", encoding="utf-8") as f:
        f.write(data)

    # version = hash of all files -> a new service worker on every change
    h = hashlib.sha1()
    for dirpath, _, files in sorted(os.walk(args.out)):
        for fn in sorted(files):
            with open(os.path.join(dirpath, fn), "rb") as f:
                h.update(f.read())
    version = h.hexdigest()[:10]
    sw = os.path.join(args.out, "sw.js")
    with open(sw, encoding="utf-8") as f:
        code = f.read().replace("__BUILD__", version)
    with open(sw, "w", encoding="utf-8") as f:
        f.write(code)

    print(f"OK: {len(songs)} songs, version {version} -> {args.out}")
    if skipped:
        print("Skipped:", ", ".join(skipped))


if __name__ == "__main__":
    main()
