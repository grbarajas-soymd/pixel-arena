#!/usr/bin/env python3
"""
Pixel Arena — Custom Font Generator (Bitmap Grid)

Clean monospace pixel font. Each character is defined on a 5-wide pixel grid
and converted to filled TrueType rectangles. No curves, no winding issues.

Usage:
    pip install fonttools
    python generate_font.py
"""

import sys, argparse
from pathlib import Path

try:
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen
except ImportError:
    print("Install fonttools: pip install fonttools"); sys.exit(1)

# ── Font Metrics ──────────────────────────────────────────────────────────
UPM = 1000
ADVANCE = 500       # monospace advance width (tight — bitmap dots provide spacing)
PX = 100            # pixel size in font units
COLS = 5            # character grid width
X_OFF = 0           # no padding — characters fill the full advance

CAP = 7 * PX        # 700 — capital height
XH = 5 * PX         # 500 — x-height
FONT_ASCENT = 800
FONT_DESCENT = 200

# ── Drawing ──────────────────────────────────────────────────────────────

def _rect(pen, x, y, w, h):
    pen.moveTo((x, y))
    pen.lineTo((x + w, y))
    pen.lineTo((x + w, y + h))
    pen.lineTo((x, y + h))
    pen.closePath()

def draw_bitmap(pen, bitmap, top_y):
    for row_i, row in enumerate(bitmap):
        y = top_y - (row_i + 1) * PX
        col = 0
        while col < len(row):
            if row[col] == '#':
                start = col
                while col < len(row) and row[col] == '#':
                    col += 1
                _rect(pen, X_OFF + start * PX, y, (col - start) * PX, PX)
            else:
                col += 1

# ── Glyph Definitions ────────────────────────────────────────────────────
# (bitmap_rows_top_to_bottom, top_y)

G = {
    # ━━ Uppercase (7 rows) ━━
    'A': (['.###.','#...#','#...#','#####','#...#','#...#','#...#'], CAP),
    'B': (['####.','#...#','#...#','####.','#...#','#...#','####.'], CAP),
    'C': (['.###.','#...#','#....','#....','#....','#...#','.###.'], CAP),
    'D': (['####.','#...#','#...#','#...#','#...#','#...#','####.'], CAP),
    'E': (['#####','#....','#....','####.','#....','#....','#####'], CAP),
    'F': (['#####','#....','#....','####.','#....','#....','#....'], CAP),
    'G': (['.###.','#...#','#....','#.###','#...#','#...#','.####'], CAP),
    'H': (['#...#','#...#','#...#','#####','#...#','#...#','#...#'], CAP),
    'I': (['#####','..#..','..#..','..#..','..#..','..#..','#####'], CAP),
    'J': (['.####','...#.','...#.','...#.','...#.','#..#.','.##..'], CAP),
    'K': (['#...#','#..#.','#.#..','##...','#.#..','#..#.','#...#'], CAP),
    'L': (['#....','#....','#....','#....','#....','#....','#####'], CAP),
    'M': (['#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#'], CAP),
    'N': (['#...#','##..#','##..#','#.#.#','#..##','#..##','#...#'], CAP),
    'O': (['.###.','#...#','#...#','#...#','#...#','#...#','.###.'], CAP),
    'P': (['####.','#...#','#...#','####.','#....','#....','#....'], CAP),
    'Q': (['.###.','#...#','#...#','#...#','#.#.#','#..#.','.##.#'], CAP),
    'R': (['####.','#...#','#...#','####.','#.#..','#..#.','#...#'], CAP),
    'S': (['.###.','#...#','#....','.###.','....#','#...#','.###.'], CAP),
    'T': (['#####','..#..','..#..','..#..','..#..','..#..','..#..'], CAP),
    'U': (['#...#','#...#','#...#','#...#','#...#','#...#','.###.'], CAP),
    'V': (['#...#','#...#','#...#','#...#','.#.#.','.#.#.','..#..'], CAP),
    'W': (['#...#','#...#','#...#','#.#.#','#.#.#','##.##','.#.#.'], CAP),
    'X': (['#...#','#...#','.#.#.','..#..','.#.#.','#...#','#...#'], CAP),
    'Y': (['#...#','#...#','.#.#.','..#..','..#..','..#..','..#..'], CAP),
    'Z': (['#####','....#','...#.','..#..','.#...','#....','#####'], CAP),

    # ━━ Numbers (7 rows) ━━
    '0': (['.###.','#..##','#.#.#','#.#.#','##..#','#...#','.###.'], CAP),
    '1': (['..#..','.##..','..#..','..#..','..#..','..#..','.###.'], CAP),
    '2': (['.###.','#...#','....#','..##.','.#...','#....','#####'], CAP),
    '3': (['.###.','#...#','....#','..##.','....#','#...#','.###.'], CAP),
    '4': (['...#.','..##.','.#.#.','#..#.','#####','...#.','...#.'], CAP),
    '5': (['#####','#....','####.','....#','....#','#...#','.###.'], CAP),
    '6': (['.###.','#....','#....','####.','#...#','#...#','.###.'], CAP),
    '7': (['#####','....#','...#.','..#..','.#...','.#...','.#...'], CAP),
    '8': (['.###.','#...#','#...#','.###.','#...#','#...#','.###.'], CAP),
    '9': (['.###.','#...#','#...#','.####','....#','....#','.###.'], CAP),

    # ━━ Lowercase ━━
    'a': (['.###.','....#','.####','#...#','.####'], XH),
    'b': (['#....','#....','####.','#...#','#...#','#...#','####.'], CAP),
    'c': (['.###.','#....','#....','#....','.###.'], XH),
    'd': (['....#','....#','.####','#...#','#...#','#...#','.####'], CAP),
    'e': (['.###.','#...#','#####','#....','.###.'], XH),
    'f': (['..###','.#...','.#...','####.','.#...','.#...','.#...'], CAP),
    'g': (['.####','#...#','#...#','.####','....#','....#','.###.'], XH),
    'h': (['#....','#....','####.','#...#','#...#','#...#','#...#'], CAP),
    'i': (['..#..','.....','.##..','..#..','..#..','..#..','.###.'], CAP),
    'j': (['...#.','.....','...#.','...#.','...#.','...#.','...#.','#..#.','.##..'], CAP),
    'k': (['#....','#....','#..#.','#.#..','##...','#.#..','#..#.'], CAP),
    'l': (['.##..','..#..','..#..','..#..','..#..','..#..','.###.'], CAP),
    'm': (['##.##','#.#.#','#.#.#','#...#','#...#'], XH),
    'n': (['####.','#...#','#...#','#...#','#...#'], XH),
    'o': (['.###.','#...#','#...#','#...#','.###.'], XH),
    'p': (['####.','#...#','#...#','#...#','####.','#....','#....'], XH),
    'q': (['.####','#...#','#...#','#...#','.####','....#','....#'], XH),
    'r': (['#.##.','##...','#....','#....','#....'], XH),
    's': (['.###.','#....','.###.','....#','.###.'], XH),
    't': (['..#..','..#..','####.','..#..','..#..','..#..','..##.'], CAP),
    'u': (['#...#','#...#','#...#','#...#','.####'], XH),
    'v': (['#...#','#...#','#...#','.#.#.','..#..'], XH),
    'w': (['#...#','#...#','#.#.#','##.##','.#.#.'], XH),
    'x': (['#...#','.#.#.','..#..','.#.#.','#...#'], XH),
    'y': (['#...#','#...#','.#.#.','..#..','..#..','.#...','#....'], XH),
    'z': (['#####','...#.','..#..','.#...','#####'], XH),

    # ━━ Punctuation (7 rows) ━━
    '!': (['..#..','..#..','..#..','..#..','..#..','.....',  '..#..'], CAP),
    '"': (['.#.#.','.#.#.','.....','.....','.....','.....',  '.....'], CAP),
    '#': (['.#.#.','.#.#.','#####','.#.#.','#####','.#.#.',  '.#.#.'], CAP),
    '$': (['..#..','.####','#.#..','.###.','..#.#','####.',  '..#..'], CAP),
    '%': (['##...','##..#','...#.','..#..','.#...','#..##',  '...##'], CAP),
    '&': (['.##..','#..#.','#..#.','.##..','#..#.','#...#',  '.##.#'], CAP),
    "'": (['..#..','..#..','.....','.....','.....','.....',  '.....'], CAP),
    '(': (['...#.','..#..','.#...','.#...','.#...','..#..',  '...#.'], CAP),
    ')': (['.#...','..#..','...#.','...#.','...#.','..#..',  '.#...'], CAP),
    '*': (['.....','..#..','#.#.#','.###.','#.#.#','..#..',  '.....'], CAP),
    '+': (['.....','..#..','..#..','#####','..#..','..#..',  '.....'], CAP),
    ',': (['.....','.....','.....','.....','.....','..#..',  '.#...'], CAP),
    '-': (['.....','.....','.....','.###.','.....',  '.....','.....'], CAP),
    '.': (['.....','.....','.....','.....','.....','.....',  '..#..'], CAP),
    '/': (['....#','...#.','...#.','..#..','.#...','.#...',  '#....'], CAP),
    ':': (['.....','..#..','..#..','.....',  '..#..','..#..','.....'], CAP),
    ';': (['.....','..#..','..#..','.....','..#..','..#..',  '.#...'], CAP),
    '<': (['....#','...#.','..#..','.#...','..#..','...#.',  '....#'], CAP),
    '=': (['.....','.....',  '#####','.....','#####','.....','.....'], CAP),
    '>': (['#....','.#...','..#..','...#.','..#..','.#...',  '#....'], CAP),
    '?': (['.###.','#...#','....#','..##.','..#..','.....',  '..#..'], CAP),
    '@': (['.###.','#...#','#.###','#.#.#','#.##.','#....',  '.####'], CAP),
    '[': (['.###.','.#...','.#...','.#...','.#...','.#...',  '.###.'], CAP),
    '\\':(['#....','.#...','.#...','..#..','...#.','...#.',  '....#'], CAP),
    ']': (['.###.','...#.','...#.','...#.','...#.','...#.',  '.###.'], CAP),
    '^': (['..#..','.#.#.','#...#','.....','.....','.....',  '.....'], CAP),
    '_': (['.....','.....','.....','.....','.....','.....',  '#####'], CAP),
    '`': (['.#...','..#..','.....','.....','.....',  '.....','.....'], CAP),
    '{': (['...#.','..#..','..#..','.#...','..#..','..#..',  '...#.'], CAP),
    '|': (['..#..','..#..','..#..','..#..','..#..','..#..',  '..#..'], CAP),
    '}': (['.#...','..#..','..#..','...#.','..#..','..#..',  '.#...'], CAP),
    '~': (['.....','.....','.#..#','#.##.','.....',  '.....','.....'], CAP),
}


# ── Font Assembly ─────────────────────────────────────────────────────────

def build_font():
    glyph_names = [".notdef"]
    cmap = {}

    for cp in range(32, 127):
        ch = chr(cp)
        name = "space" if ch == ' ' else (ch if ch.isalpha() else f"uni{cp:04X}")
        glyph_names.append(name)
        cmap[cp] = name

    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(glyph_names)
    fb.setupCharacterMap(cmap)

    glyph_table = {}

    # .notdef — empty box
    pen = TTGlyphPen(None)
    _rect(pen, X_OFF, 0, COLS * PX, CAP)
    # Inner hole (CCW)
    pen.moveTo((X_OFF + PX, PX))
    pen.lineTo((X_OFF + PX, CAP - PX))
    pen.lineTo((X_OFF + (COLS - 1) * PX, CAP - PX))
    pen.lineTo((X_OFF + (COLS - 1) * PX, PX))
    pen.closePath()
    glyph_table[".notdef"] = pen.glyph()

    # Build each glyph
    errors = []
    for cp in range(32, 127):
        ch = chr(cp)
        name = cmap[cp]
        pen = TTGlyphPen(None)
        if ch in G:
            try:
                bitmap, top_y = G[ch]
                draw_bitmap(pen, bitmap, top_y)
            except Exception as e:
                errors.append(f"  {ch!r} ({name}): {e}")
                pen = TTGlyphPen(None)
        # else: space or missing — empty glyph
        glyph_table[name] = pen.glyph()

    if errors:
        print(f"Warnings — {len(errors)} glyphs had errors:")
        for e in errors:
            print(e)

    fb.setupGlyf(glyph_table)
    metrics = {name: (ADVANCE, 0) for name in glyph_names}
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=FONT_ASCENT, descent=-FONT_DESCENT)

    fb.setupNameTable({
        "familyName": "Somdie Mono",
        "styleName": "Regular",
        "psName": "SomdieMono-Regular",
        "manufacturer": "SoftBacon Software",
        "designer": "SoftBacon Software",
        "description": "Custom monospace pixel font for Some of You May Die",
        "vendorURL": "https://someofyoumaydie.com",
        "licenseDescription": "Proprietary — SoftBacon Software. All rights reserved.",
        "version": "Version 3.0",
    })

    fb.setupOS2(
        sTypoAscender=FONT_ASCENT,
        sTypoDescender=-FONT_DESCENT,
        sTypoLineGap=0,
        usWinAscent=FONT_ASCENT,
        usWinDescent=FONT_DESCENT,
        sxHeight=XH,
        sCapHeight=CAP,
        achVendID="SBSW",
        fsType=0x0008,
    )
    fb.setupPost(isFixedPitch=1)

    return fb.font


def main():
    parser = argparse.ArgumentParser(description="Generate Somdie Mono font")
    parser.parse_args()

    out_dir = Path(__file__).parent.parent / "assets" / "fonts"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "somdie_mono.ttf"

    print("Building Somdie Mono (bitmap grid)...")
    font = build_font()
    font.save(str(out_path))

    size = out_path.stat().st_size
    print(f"Saved: {out_path} ({size:,} bytes)")
    print(f"Glyphs: 95 printable ASCII (32-126)")
    print(f"Metrics: UPM={UPM}, advance={ADVANCE}, px={PX}, cap={CAP}, x-height={XH}")


if __name__ == "__main__":
    main()
