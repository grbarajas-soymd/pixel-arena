#!/usr/bin/env python3
"""
Pixel Arena — Custom Font Generator (Smooth Vector Outlines)

Generates a clean geometric monospace sans-serif font using quadratic bezier
curves (TrueType outlines). NOT bitmap/pixel grids — proper smooth curves.

Usage:
    pip install fonttools
    python generate_font.py
"""

import math, sys, shutil, argparse
from pathlib import Path

try:
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen
except ImportError:
    print("Install fonttools: pip install fonttools"); sys.exit(1)

# ── Font Metrics ──────────────────────────────────────────────────────────
UPM = 1000
ADVANCE = 600       # monospace advance width
CAP = 700           # capital letter height
XH = 490            # x-height (lowercase body)
ASC = 740           # ascender height (b, d, h, k, l)
DSC = -210          # descender depth (g, j, p, q, y)
SW = 88             # stroke width
FONT_ASCENT = 800
FONT_DESCENT = 200

# Horizontal positions (centered in advance width)
PAD = 55            # left/right side bearing
GL = PAD            # glyph left edge
GR = ADVANCE - PAD  # glyph right edge
GCX = ADVANCE // 2  # glyph center x
GW = GR - GL        # glyph width = 490

# ── Quadratic Bezier Circle Approximation ─────────────────────────────────
# 8-segment approximation: each segment spans 45 degrees
# K = tan(pi/8) ≈ 0.4142 — off-curve control point factor
# S = sin(pi/4) ≈ 0.7071 — on-curve point at 45 degrees
_K = math.tan(math.pi / 8)
_S = math.sin(math.pi / 4)

# Unit circle on-curve points at 45-degree intervals (0=right, CCW)
_CP = [(1,0), (_S,_S), (0,1), (-_S,_S), (-1,0), (-_S,-_S), (0,-1), (_S,-_S)]
# Control points for CCW arcs between consecutive on-curve points
_CC = [(1,_K), (_K,1), (-_K,1), (-1,_K), (-1,-_K), (-_K,-1), (_K,-1), (1,-_K)]

def _r(v):
    """Round to int for font coordinates."""
    return round(v)

# ── Shape Primitives ──────────────────────────────────────────────────────

def _rect(pen, x, y, w, h):
    """Filled rectangle (clockwise = outer contour in TrueType)."""
    pen.moveTo((_r(x), _r(y)))
    pen.lineTo((_r(x+w), _r(y)))
    pen.lineTo((_r(x+w), _r(y+h)))
    pen.lineTo((_r(x), _r(y+h)))
    pen.closePath()

def _ellipse(pen, cx, cy, rx, ry, cw=True):
    """Full ellipse. cw=True for outer contour, False for hole."""
    def p(i):
        x, y = _CP[i % 8]
        return (_r(cx + rx*x), _r(cy + ry*y))
    def c(i):
        x, y = _CC[i % 8]
        return (_r(cx + rx*x), _r(cy + ry*y))

    pen.moveTo(p(0))
    if cw:  # CW: 0→7→6→...→1→0 (outer)
        for i in range(7, -1, -1):
            pen.qCurveTo(c(i), p(i))
    else:   # CCW: 0→1→2→...→7→0 (hole)
        for i in range(8):
            pen.qCurveTo(c(i), p((i+1) % 8))
    pen.closePath()

def _ring(pen, cx, cy, orx, ory, irx, iry):
    """Ring shape (ellipse with hole)."""
    _ellipse(pen, cx, cy, orx, ory, cw=True)
    _ellipse(pen, cx, cy, irx, iry, cw=False)

def _open_ring(pen, cx, cy, orx, ory, sw, gap_start, gap_end):
    """
    Ring with a gap. Gap is defined by angle indices (0=right, 1=top-right, etc).
    gap_start/gap_end: the arc is REMOVED between these points on the right side.
    The result is a single closed contour (outer arc + end caps + inner arc).

    For C-shape: gap_start=7, gap_end=1 (gap on right, from 315° to 45°)
    """
    irx, iry = orx - sw, ory - sw

    def op(i):
        x, y = _CP[i % 8]
        return (_r(cx + orx*x), _r(cy + ory*y))
    def oc(i):
        x, y = _CC[i % 8]
        return (_r(cx + orx*x), _r(cy + ory*y))
    def ip(i):
        x, y = _CP[i % 8]
        return (_r(cx + irx*x), _r(cy + iry*y))
    def ic(i):
        x, y = _CC[i % 8]
        return (_r(cx + irx*x), _r(cy + iry*y))

    # Outer arc: CW from gap_end to gap_start (going around the non-gap side)
    pen.moveTo(op(gap_end))
    i = gap_end
    while i != gap_start:
        prev = (i - 1) % 8
        pen.qCurveTo(oc(prev), op(prev))
        i = prev

    # Line from outer gap_start to inner gap_start (bottom arm end cap)
    pen.lineTo(ip(gap_start))

    # Inner arc: CCW from gap_start to gap_end (going back around)
    i = gap_start
    while i != gap_end:
        nxt = (i + 1) % 8
        pen.qCurveTo(ic(i), ip(nxt))
        i = nxt

    # Line from inner gap_end back to outer gap_end (top arm end cap)
    pen.closePath()

def _half_ring_right(pen, cx, cy, orx, ory, sw):
    """Right half of a ring (for D, b, d shapes). Single closed contour."""
    irx, iry = orx - sw, ory - sw
    def op(i):
        x, y = _CP[i % 8]
        return (_r(cx + orx*x), _r(cy + ory*y))
    def oc(i):
        x, y = _CC[i % 8]
        return (_r(cx + orx*x), _r(cy + ory*y))
    def ip(i):
        x, y = _CP[i % 8]
        return (_r(cx + irx*x), _r(cy + iry*y))
    def ic(i):
        x, y = _CC[i % 8]
        return (_r(cx + irx*x), _r(cy + iry*y))

    # Outer arc CW: from top (2) → top-right(1) → right(0) → bot-right(7) → bot(6)
    pen.moveTo(op(2))
    for i in [1, 0, 7, 6]:
        pen.qCurveTo(oc(i), op(i))
    # Line to inner bottom
    pen.lineTo(ip(6))
    # Inner arc CCW: from bot(6) → bot-right(7) → right(0) → top-right(1) → top(2)
    for i in [6, 7, 0, 1]:
        pen.qCurveTo(ic(i), ip((i+1) % 8))
    pen.closePath()

def _top_bowl(pen, cx, cy, orx, ory, sw):
    """Top half of a ring (for P, top of B). Single closed contour."""
    irx, iry = orx - sw, ory - sw
    def op(i):
        x, y = _CP[i % 8]
        return (_r(cx + orx*x), _r(cy + ory*y))
    def oc(i):
        x, y = _CC[i % 8]
        return (_r(cx + orx*x), _r(cy + ory*y))
    def ip(i):
        x, y = _CP[i % 8]
        return (_r(cx + irx*x), _r(cy + iry*y))
    def ic(i):
        x, y = _CC[i % 8]
        return (_r(cx + irx*x), _r(cy + iry*y))

    # Outer CW: left(4) → bot-left(5) → bot(6) → bot-right(7) → right(0) → top-right(1) → top(2) → top-left(3) → left(4)
    # But we only want top half: from right(0) going CW to left(4)
    # Wait - top half means the upper semicircle.
    # Outer CW: from left(4) → top-left(3) → top(2) → top-right(1) → right(0)
    pen.moveTo(op(4))
    for i in [3, 2, 1, 0]:
        pen.qCurveTo(oc(i), op(i))
    # Line down to inner right
    pen.lineTo(ip(0))
    # Inner CCW: right(0) → top-right(1) → top(2) → top-left(3) → left(4)
    for i in [0, 1, 2, 3]:
        pen.qCurveTo(ic(i), ip((i+1) % 8))
    pen.closePath()

def _bottom_bowl(pen, cx, cy, orx, ory, sw):
    """Bottom half of a ring (for bottom of B, J-hook). Single closed contour."""
    irx, iry = orx - sw, ory - sw
    def op(i):
        x, y = _CP[i % 8]
        return (_r(cx + orx*x), _r(cy + ory*y))
    def oc(i):
        x, y = _CC[i % 8]
        return (_r(cx + orx*x), _r(cy + ory*y))
    def ip(i):
        x, y = _CP[i % 8]
        return (_r(cx + irx*x), _r(cy + iry*y))
    def ic(i):
        x, y = _CC[i % 8]
        return (_r(cx + irx*x), _r(cy + iry*y))

    # Outer CW: right(0) → bot-right(7) → bot(6) → bot-left(5) → left(4)
    pen.moveTo(op(0))
    for i in [7, 6, 5, 4]:
        pen.qCurveTo(oc(i), op(i))
    # Line to inner left
    pen.lineTo(ip(4))
    # Inner CCW: left(4) → bot-left(5) → bot(6) → bot-right(7) → right(0)
    for i in [4, 5, 6, 7]:
        pen.qCurveTo(ic(i), ip((i+1) % 8))
    pen.closePath()

def _arch(pen, cx, cy, orx, ory, sw):
    """Top arch for n, h, m — goes from left stem up and over to right stem."""
    irx, iry = orx - sw, ory - sw
    def op(i):
        x, y = _CP[i % 8]
        return (_r(cx + orx*x), _r(cy + ory*y))
    def oc(i):
        x, y = _CC[i % 8]
        return (_r(cx + orx*x), _r(cy + ory*y))
    def ip(i):
        x, y = _CP[i % 8]
        return (_r(cx + irx*x), _r(cy + iry*y))
    def ic(i):
        x, y = _CC[i % 8]
        return (_r(cx + irx*x), _r(cy + iry*y))

    # Outer CW: left(4) → top-left(3) → top(2) → top-right(1) → right(0)
    pen.moveTo(op(4))
    for i in [3, 2, 1, 0]:
        pen.qCurveTo(oc(i), op(i))
    # Line down right side (outer to inner at right)
    pen.lineTo(ip(0))
    # Inner CCW: right(0) → top-right(1) → top(2) → top-left(3) → left(4)
    for i in [0, 1, 2, 3]:
        pen.qCurveTo(ic(i), ip((i+1) % 8))
    pen.closePath()

def _u_bowl(pen, cx, cy, orx, ory, sw):
    """Bottom U-shape — bottom arc connecting left and right stems."""
    irx, iry = orx - sw, ory - sw
    def op(i):
        x, y = _CP[i % 8]
        return (_r(cx + orx*x), _r(cy + ory*y))
    def oc(i):
        x, y = _CC[i % 8]
        return (_r(cx + orx*x), _r(cy + ory*y))
    def ip(i):
        x, y = _CP[i % 8]
        return (_r(cx + irx*x), _r(cy + iry*y))
    def ic(i):
        x, y = _CC[i % 8]
        return (_r(cx + irx*x), _r(cy + iry*y))

    # Outer CW: right(0) → bot-right(7) → bot(6) → bot-left(5) → left(4)
    pen.moveTo(op(0))
    for i in [7, 6, 5, 4]:
        pen.qCurveTo(oc(i), op(i))
    # Up to inner left
    pen.lineTo(ip(4))
    # Inner CCW: left(4) → bot-left(5) → bot(6) → bot-right(7) → right(0)
    for i in [4, 5, 6, 7]:
        pen.qCurveTo(ic(i), ip((i+1) % 8))
    pen.closePath()

# ── Glyph Definitions ────────────────────────────────────────────────────

# Common measurements
_stem_l = GL                # left stem x
_stem_r = GR - SW           # right stem x
_cap_mid = CAP // 2         # vertical midpoint of capitals
_xh_mid = XH // 2           # vertical midpoint of lowercase
_cross = round(CAP * 0.42)  # crossbar height for A, H

def _make_glyph(draw_fn):
    """Create a glyph from a drawing function."""
    pen = TTGlyphPen(None)
    draw_fn(pen)
    return pen.glyph()

# ── Uppercase Letters ─────────────────────────────────────────────────────

def _draw_A(p):
    mid = GCX
    # Left diagonal: thick line from bottom-left to top-center
    p.moveTo((_r(GL), 0))
    p.lineTo((_r(mid - SW//2), _r(CAP)))
    p.lineTo((_r(mid + SW//2), _r(CAP)))
    p.lineTo((_r(GL + SW*1.3), 0))
    p.closePath()
    # Right diagonal
    p.moveTo((_r(GR), 0))
    p.lineTo((_r(mid + SW//2), _r(CAP)))
    p.lineTo((_r(mid - SW//2), _r(CAP)))
    p.lineTo((_r(GR - SW*1.3), 0))
    p.closePath()
    # Crossbar
    _rect(p, GL + SW + 10, _cross, GW - 2*SW - 20, SW)

def _draw_B(p):
    _rect(p, GL, 0, SW, CAP)  # stem
    mid = _cap_mid + 10
    # Top bowl
    bow_rx = (GR - GL - SW) * 0.85
    _top_bowl(p, GL + SW, mid, bow_rx, mid, SW)
    # Bottom bowl
    bow_rx2 = (GR - GL - SW) * 0.95
    _bottom_bowl(p, GL + SW, mid, bow_rx2, CAP - mid, SW)
    # Horizontal bars
    _rect(p, GL + SW, CAP - SW, _r(bow_rx * 0.7), SW)
    _rect(p, GL + SW, mid - SW//2, _r(bow_rx2 * 0.5), SW)
    _rect(p, GL + SW, 0, _r(bow_rx2 * 0.7), SW)

def _draw_C(p):
    cx = GCX
    cy = CAP // 2
    rx = GW // 2
    ry = CAP // 2
    _open_ring(p, cx, cy, rx, ry, SW, 7, 1)

def _draw_D(p):
    _rect(p, GL, 0, SW, CAP)  # stem
    cx = GL + SW
    cy = CAP // 2
    rx = GR - GL - SW
    ry = CAP // 2
    _half_ring_right(p, cx, cy, rx, ry, SW)
    # Top/bottom bars connecting stem to bowl
    _rect(p, GL + SW, CAP - SW, SW, SW)
    _rect(p, GL + SW, 0, SW, SW)

def _draw_E(p):
    _rect(p, GL, 0, SW, CAP)  # stem
    _rect(p, GL, CAP - SW, GW, SW)  # top bar
    _rect(p, GL, _cap_mid - SW//2, GW - 40, SW)  # middle bar
    _rect(p, GL, 0, GW, SW)  # bottom bar

def _draw_F(p):
    _rect(p, GL, 0, SW, CAP)
    _rect(p, GL, CAP - SW, GW, SW)
    _rect(p, GL, _cap_mid - SW//2, GW - 60, SW)

def _draw_G(p):
    cx = GCX
    cy = CAP // 2
    rx = GW // 2
    ry = CAP // 2
    _open_ring(p, cx, cy, rx, ry, SW, 7, 1)
    # Horizontal spur at middle-right
    _rect(p, GCX, cy - SW//2, GR - GCX, SW)

def _draw_H(p):
    _rect(p, GL, 0, SW, CAP)
    _rect(p, _stem_r, 0, SW, CAP)
    _rect(p, GL, _cross, GW, SW)

def _draw_I(p):
    cx = GCX - SW//2
    _rect(p, cx, 0, SW, CAP)
    _rect(p, GL + 40, CAP - SW, GW - 80, SW)
    _rect(p, GL + 40, 0, GW - 80, SW)

def _draw_J(p):
    _rect(p, _stem_r, CAP // 3, SW, CAP - CAP // 3)
    _rect(p, GL + 60, CAP - SW, GR - GL - 60, SW)
    # Bottom hook
    cx = (GL + GR) // 2
    _bottom_bowl(p, cx, 0, cx - GL, CAP // 3, SW)

def _draw_K(p):
    _rect(p, GL, 0, SW, CAP)
    # Upper diagonal
    p.moveTo((_r(GL + SW), _r(_cross + SW)))
    p.lineTo((_r(GR), _r(CAP)))
    p.lineTo((_r(GR - SW*1.2), _r(CAP)))
    p.lineTo((_r(GL + SW), _r(_cross)))
    p.closePath()
    # Lower diagonal
    p.moveTo((_r(GL + SW), _r(_cross)))
    p.lineTo((_r(GR), 0))
    p.lineTo((_r(GR - SW*1.2), 0))
    p.lineTo((_r(GL + SW), _r(_cross - SW)))
    p.closePath()

def _draw_L(p):
    _rect(p, GL, 0, SW, CAP)
    _rect(p, GL, 0, GW, SW)

def _draw_M(p):
    _rect(p, GL, 0, SW, CAP)
    _rect(p, _stem_r, 0, SW, CAP)
    # Left diagonal
    p.moveTo((_r(GL + SW), _r(CAP)))
    p.lineTo((_r(GCX), _r(CAP * 0.35)))
    p.lineTo((_r(GCX + SW*0.7), _r(CAP * 0.35)))
    p.lineTo((_r(GL + SW + SW*0.7), _r(CAP)))
    p.closePath()
    # Right diagonal
    p.moveTo((_r(_stem_r), _r(CAP)))
    p.lineTo((_r(GCX), _r(CAP * 0.35)))
    p.lineTo((_r(GCX - SW*0.7), _r(CAP * 0.35)))
    p.lineTo((_r(_stem_r - SW*0.7), _r(CAP)))
    p.closePath()

def _draw_N(p):
    _rect(p, GL, 0, SW, CAP)
    _rect(p, _stem_r, 0, SW, CAP)
    # Diagonal
    p.moveTo((_r(GL), _r(CAP)))
    p.lineTo((_r(GL + SW), _r(CAP)))
    p.lineTo((_r(GR), 0))
    p.lineTo((_r(GR - SW), 0))
    p.closePath()

def _draw_O(p):
    cx = GCX
    cy = CAP // 2
    rx = GW // 2
    ry = CAP // 2
    _ring(p, cx, cy, rx, ry, rx - SW, ry - SW)

def _draw_P(p):
    _rect(p, GL, 0, SW, CAP)
    # Top bowl
    mid = _cap_mid + 20
    bow_rx = GR - GL - SW
    _top_bowl(p, GL + SW, mid, bow_rx * 0.9, mid, SW)
    _rect(p, GL + SW, CAP - SW, _r(bow_rx * 0.6), SW)
    _rect(p, GL + SW, mid - SW//2, _r(bow_rx * 0.5), SW)

def _draw_Q(p):
    _draw_O(p)
    # Tail
    p.moveTo((_r(GCX + 30), _r(80)))
    p.lineTo((_r(GR + 20), _r(-40)))
    p.lineTo((_r(GR + 20 - SW), _r(-40)))
    p.lineTo((_r(GCX + 30 - SW*0.7), _r(80)))
    p.closePath()

def _draw_R(p):
    _draw_P(p)
    # Leg
    mid = _cap_mid + 20
    p.moveTo((_r(GCX), _r(mid - SW)))
    p.lineTo((_r(GR), 0))
    p.lineTo((_r(GR - SW*1.2), 0))
    p.lineTo((_r(GCX - SW*0.3), _r(mid - SW)))
    p.closePath()

def _draw_S(p):
    cy = CAP // 2
    rx = GW // 2
    top_ry = cy
    # Top arc (open on right-bottom)
    top_cy = CAP - top_ry
    _open_ring(p, GCX, top_cy, rx, top_ry, SW, 6, 0)
    # Bottom arc (open on left-top)
    bot_cy = top_ry
    _open_ring(p, GCX, bot_cy, rx, top_ry, SW, 2, 4)

def _draw_T(p):
    _rect(p, GCX - SW//2, 0, SW, CAP)
    _rect(p, GL, CAP - SW, GW, SW)

def _draw_U(p):
    _rect(p, GL, CAP * 0.35, SW, CAP * 0.65)
    _rect(p, _stem_r, CAP * 0.35, SW, CAP * 0.65)
    cy = CAP * 0.35
    _u_bowl(p, GCX, cy, GW // 2, cy, SW)

def _draw_V(p):
    mid = GCX
    p.moveTo((_r(GL), _r(CAP)))
    p.lineTo((_r(GL + SW*1.3), _r(CAP)))
    p.lineTo((_r(mid + SW//2), 0))
    p.lineTo((_r(mid - SW//2), 0))
    p.closePath()
    p.moveTo((_r(GR), _r(CAP)))
    p.lineTo((_r(GR - SW*1.3), _r(CAP)))
    p.lineTo((_r(mid - SW//2), 0))
    p.lineTo((_r(mid + SW//2), 0))
    p.closePath()

def _draw_W(p):
    q1 = GL + GW * 0.25
    q3 = GL + GW * 0.75
    # Left leg
    p.moveTo((_r(GL), _r(CAP)))
    p.lineTo((_r(GL + SW), _r(CAP)))
    p.lineTo((_r(q1 + SW*0.4), 0))
    p.lineTo((_r(q1 - SW*0.4), 0))
    p.closePath()
    # Left-center
    p.moveTo((_r(q1 - SW*0.4), 0))
    p.lineTo((_r(q1 + SW*0.4), 0))
    p.lineTo((_r(GCX + SW*0.4), _r(CAP * 0.5)))
    p.lineTo((_r(GCX - SW*0.4), _r(CAP * 0.5)))
    p.closePath()
    # Right-center
    p.moveTo((_r(q3 - SW*0.4), 0))
    p.lineTo((_r(q3 + SW*0.4), 0))
    p.lineTo((_r(GCX + SW*0.4), _r(CAP * 0.5)))
    p.lineTo((_r(GCX - SW*0.4), _r(CAP * 0.5)))
    p.closePath()
    # Right leg
    p.moveTo((_r(GR), _r(CAP)))
    p.lineTo((_r(GR - SW), _r(CAP)))
    p.lineTo((_r(q3 - SW*0.4), 0))
    p.lineTo((_r(q3 + SW*0.4), 0))
    p.closePath()

def _draw_X(p):
    # Forward diagonal
    p.moveTo((_r(GL), _r(CAP)))
    p.lineTo((_r(GL + SW*1.1), _r(CAP)))
    p.lineTo((_r(GR), 0))
    p.lineTo((_r(GR - SW*1.1), 0))
    p.closePath()
    # Back diagonal
    p.moveTo((_r(GR), _r(CAP)))
    p.lineTo((_r(GR - SW*1.1), _r(CAP)))
    p.lineTo((_r(GL), 0))
    p.lineTo((_r(GL + SW*1.1), 0))
    p.closePath()

def _draw_Y(p):
    mid = GCX
    # Left arm
    p.moveTo((_r(GL), _r(CAP)))
    p.lineTo((_r(GL + SW*1.2), _r(CAP)))
    p.lineTo((_r(mid + SW//2), _r(_cap_mid)))
    p.lineTo((_r(mid - SW//2), _r(_cap_mid)))
    p.closePath()
    # Right arm
    p.moveTo((_r(GR), _r(CAP)))
    p.lineTo((_r(GR - SW*1.2), _r(CAP)))
    p.lineTo((_r(mid - SW//2), _r(_cap_mid)))
    p.lineTo((_r(mid + SW//2), _r(_cap_mid)))
    p.closePath()
    # Stem
    _rect(p, mid - SW//2, 0, SW, _cap_mid)

def _draw_Z(p):
    _rect(p, GL, CAP - SW, GW, SW)
    _rect(p, GL, 0, GW, SW)
    p.moveTo((_r(GR), _r(CAP - SW)))
    p.lineTo((_r(GR - SW*1.1), _r(CAP - SW)))
    p.lineTo((_r(GL), _r(SW)))
    p.lineTo((_r(GL + SW*1.1), _r(SW)))
    p.closePath()

# ── Lowercase Letters ─────────────────────────────────────────────────────

def _draw_a(p):
    cx = GCX
    cy = XH // 2
    rx = GW // 2
    ry = XH // 2
    _ring(p, cx, cy, rx, ry, rx - SW, ry - SW)
    _rect(p, _stem_r, 0, SW, XH)  # right stem

def _draw_b(p):
    _rect(p, GL, 0, SW, ASC)  # tall left stem
    cx = GCX
    cy = XH // 2
    rx = GW // 2
    ry = XH // 2
    _ring(p, cx, cy, rx, ry, rx - SW, ry - SW)

def _draw_c(p):
    cx = GCX
    cy = XH // 2
    rx = GW // 2
    ry = XH // 2
    _open_ring(p, cx, cy, rx, ry, SW, 7, 1)

def _draw_d(p):
    _rect(p, _stem_r, 0, SW, ASC)  # tall right stem
    cx = GCX
    cy = XH // 2
    rx = GW // 2
    ry = XH // 2
    _ring(p, cx, cy, rx, ry, rx - SW, ry - SW)

def _draw_e(p):
    cx = GCX
    cy = XH // 2
    rx = GW // 2
    ry = XH // 2
    # C-shape (open bottom-right)
    _open_ring(p, cx, cy, rx, ry, SW, 7, 0)
    # Horizontal bar through middle
    _rect(p, GL + SW - 10, cy - SW//2, GW - SW + 10, SW)

def _draw_f(p):
    # Vertical stem
    stem_x = GCX - SW//2 + 20
    _rect(p, stem_x, 0, SW, ASC - 60)
    # Top curve
    _arch(p, stem_x + SW, ASC - 60, (GR - stem_x - SW) * 0.8, 60, SW)
    # Crossbar
    _rect(p, GL + 30, XH - SW, GW - 60, SW)

def _draw_g(p):
    cx = GCX
    cy = XH // 2
    rx = GW // 2
    ry = XH // 2
    _ring(p, cx, cy, rx, ry, rx - SW, ry - SW)
    _rect(p, _stem_r, DSC, SW, XH - DSC)  # right stem goes down
    # Bottom hook
    _bottom_bowl(p, GCX, DSC, GW // 2, abs(DSC), SW)

def _draw_h(p):
    _rect(p, GL, 0, SW, ASC)
    # Arch from left stem
    cx = GCX
    arch_ry = XH * 0.45
    _arch(p, cx, XH - arch_ry, GW // 2, arch_ry, SW)
    _rect(p, _stem_r, 0, SW, _r(XH - arch_ry))

def _draw_i(p):
    cx = GCX - SW//2
    _rect(p, cx, 0, SW, XH)
    # Dot
    dot_y = XH + 60
    _rect(p, cx, dot_y, SW, SW)

def _draw_j(p):
    sx = GCX + 20
    _rect(p, sx, DSC + abs(DSC) * 0.4, SW, XH - DSC - abs(DSC) * 0.4)
    # Dot
    _rect(p, sx, XH + 60, SW, SW)
    # Bottom hook
    hook_cx = sx
    hook_r = abs(DSC) * 0.4
    _bottom_bowl(p, hook_cx, DSC, sx - GL + 30, hook_r, SW)

def _draw_k(p):
    _rect(p, GL, 0, SW, ASC)
    mid = XH // 2
    # Upper diagonal
    p.moveTo((_r(GL + SW), _r(mid + SW)))
    p.lineTo((_r(GR - 10), _r(XH)))
    p.lineTo((_r(GR - 10 - SW*1.1), _r(XH)))
    p.lineTo((_r(GL + SW), _r(mid)))
    p.closePath()
    # Lower diagonal
    p.moveTo((_r(GL + SW), _r(mid)))
    p.lineTo((_r(GR - 10), 0))
    p.lineTo((_r(GR - 10 - SW*1.1), 0))
    p.lineTo((_r(GL + SW), _r(mid - SW)))
    p.closePath()

def _draw_l(p):
    cx = GCX - SW//2
    _rect(p, cx, 0, SW, ASC)

def _draw_m(p):
    _rect(p, GL, 0, SW, XH)
    mid = GCX
    # Left arch
    arch_ry = XH * 0.45
    _arch(p, (GL + SW + mid) // 2, XH - arch_ry, (mid - GL - SW) // 2 + SW//2, arch_ry, SW)
    _rect(p, mid - SW//2, 0, SW, _r(XH - arch_ry))
    # Right arch
    _arch(p, (mid + GR) // 2, XH - arch_ry, (GR - mid) // 2 + SW//2, arch_ry, SW)
    _rect(p, _stem_r, 0, SW, _r(XH - arch_ry))

def _draw_n(p):
    _rect(p, GL, 0, SW, XH)
    cx = GCX
    arch_ry = XH * 0.45
    _arch(p, cx, XH - arch_ry, GW // 2, arch_ry, SW)
    _rect(p, _stem_r, 0, SW, _r(XH - arch_ry))

def _draw_o(p):
    cx = GCX
    cy = XH // 2
    rx = GW // 2
    ry = XH // 2
    _ring(p, cx, cy, rx, ry, rx - SW, ry - SW)

def _draw_p(p):
    _rect(p, GL, DSC, SW, XH - DSC)
    cx = GCX
    cy = XH // 2
    rx = GW // 2
    ry = XH // 2
    _ring(p, cx, cy, rx, ry, rx - SW, ry - SW)

def _draw_q(p):
    _rect(p, _stem_r, DSC, SW, XH - DSC)
    cx = GCX
    cy = XH // 2
    rx = GW // 2
    ry = XH // 2
    _ring(p, cx, cy, rx, ry, rx - SW, ry - SW)

def _draw_r(p):
    _rect(p, GL, 0, SW, XH)
    # Short top curve
    _arch(p, GCX, XH * 0.55, GW // 2, XH * 0.45, SW)

def _draw_s(p):
    cy = XH // 2
    rx = GW // 2
    ry = XH // 4
    _open_ring(p, GCX, XH - ry, rx, ry, SW, 6, 0)
    _open_ring(p, GCX, ry, rx, ry, SW, 2, 4)

def _draw_t(p):
    stem_x = GCX - SW//2 + 20
    _rect(p, stem_x, 0, SW, ASC - 80)
    _rect(p, GL + 30, XH - SW, GW - 60, SW)
    # Bottom curve
    _bottom_bowl(p, stem_x + SW + 40, 0, 50, 50, SW)

def _draw_u(p):
    _rect(p, GL, XH * 0.35, SW, XH * 0.65)
    _rect(p, _stem_r, 0, SW, XH)
    cy = XH * 0.35
    _u_bowl(p, GCX, cy, GW // 2, cy, SW)

def _draw_v(p):
    mid = GCX
    p.moveTo((_r(GL), _r(XH)))
    p.lineTo((_r(GL + SW*1.3), _r(XH)))
    p.lineTo((_r(mid + SW//2), 0))
    p.lineTo((_r(mid - SW//2), 0))
    p.closePath()
    p.moveTo((_r(GR), _r(XH)))
    p.lineTo((_r(GR - SW*1.3), _r(XH)))
    p.lineTo((_r(mid - SW//2), 0))
    p.lineTo((_r(mid + SW//2), 0))
    p.closePath()

def _draw_w(p):
    q1 = GL + GW * 0.25
    q3 = GL + GW * 0.75
    p.moveTo((_r(GL), _r(XH)))
    p.lineTo((_r(GL + SW*0.9), _r(XH)))
    p.lineTo((_r(q1 + SW*0.3), 0))
    p.lineTo((_r(q1 - SW*0.3), 0))
    p.closePath()
    p.moveTo((_r(q1 - SW*0.3), 0))
    p.lineTo((_r(q1 + SW*0.3), 0))
    p.lineTo((_r(GCX + SW*0.3), _r(XH * 0.5)))
    p.lineTo((_r(GCX - SW*0.3), _r(XH * 0.5)))
    p.closePath()
    p.moveTo((_r(q3 - SW*0.3), 0))
    p.lineTo((_r(q3 + SW*0.3), 0))
    p.lineTo((_r(GCX + SW*0.3), _r(XH * 0.5)))
    p.lineTo((_r(GCX - SW*0.3), _r(XH * 0.5)))
    p.closePath()
    p.moveTo((_r(GR), _r(XH)))
    p.lineTo((_r(GR - SW*0.9), _r(XH)))
    p.lineTo((_r(q3 - SW*0.3), 0))
    p.lineTo((_r(q3 + SW*0.3), 0))
    p.closePath()

def _draw_x(p):
    p.moveTo((_r(GL), _r(XH)))
    p.lineTo((_r(GL + SW*1.1), _r(XH)))
    p.lineTo((_r(GR), 0))
    p.lineTo((_r(GR - SW*1.1), 0))
    p.closePath()
    p.moveTo((_r(GR), _r(XH)))
    p.lineTo((_r(GR - SW*1.1), _r(XH)))
    p.lineTo((_r(GL), 0))
    p.lineTo((_r(GL + SW*1.1), 0))
    p.closePath()

def _draw_y(p):
    mid = GCX
    # Left arm
    p.moveTo((_r(GL), _r(XH)))
    p.lineTo((_r(GL + SW*1.2), _r(XH)))
    p.lineTo((_r(mid + SW//2), _r(_xh_mid)))
    p.lineTo((_r(mid - SW//2), _r(_xh_mid)))
    p.closePath()
    # Right arm going to descender
    p.moveTo((_r(GR), _r(XH)))
    p.lineTo((_r(GR - SW*1.2), _r(XH)))
    p.lineTo((_r(mid - SW//2), _r(_xh_mid)))
    p.lineTo((_r(mid + SW//2), _r(_xh_mid)))
    p.closePath()
    # Descender stem
    _rect(p, mid - SW//2, DSC, SW, _xh_mid - DSC)

def _draw_z(p):
    _rect(p, GL, XH - SW, GW, SW)
    _rect(p, GL, 0, GW, SW)
    p.moveTo((_r(GR - SW*0.5), _r(XH - SW)))
    p.lineTo((_r(GR), _r(XH - SW)))
    p.lineTo((_r(GL + SW*0.5), _r(SW)))
    p.lineTo((_r(GL), _r(SW)))
    p.closePath()

# ── Digits ────────────────────────────────────────────────────────────────

def _draw_0(p):
    cx, cy = GCX, CAP // 2
    rx, ry = GW // 2, CAP // 2
    _ring(p, cx, cy, rx, ry, rx - SW, ry - SW)
    # Diagonal slash inside
    p.moveTo((_r(cx - 30), _r(cy + ry * 0.5)))
    p.lineTo((_r(cx - 30 + SW*0.6), _r(cy + ry * 0.5)))
    p.lineTo((_r(cx + 30), _r(cy - ry * 0.5)))
    p.lineTo((_r(cx + 30 - SW*0.6), _r(cy - ry * 0.5)))
    p.closePath()

def _draw_1(p):
    cx = GCX
    _rect(p, cx - SW//2, 0, SW, CAP)
    _rect(p, GL + 40, 0, GW - 80, SW)  # base
    # Serif/flag
    p.moveTo((_r(cx - SW//2), _r(CAP)))
    p.lineTo((_r(cx + SW//2), _r(CAP)))
    p.lineTo((_r(cx - SW//2), _r(CAP - SW*1.5)))
    p.closePath()

def _draw_2(p):
    # Top arc
    top_cy = CAP - CAP * 0.28
    _open_ring(p, GCX, top_cy, GW // 2, CAP * 0.28, SW, 5, 0)
    # Diagonal to bottom
    p.moveTo((_r(GR - SW*0.5), _r(top_cy - SW)))
    p.lineTo((_r(GR), _r(top_cy)))
    p.lineTo((_r(GL + SW*0.5), _r(SW)))
    p.lineTo((_r(GL), _r(SW)))
    p.closePath()
    _rect(p, GL, 0, GW, SW)

def _draw_3(p):
    mid = _cap_mid
    rx = GW // 2
    # Top half
    _open_ring(p, GCX, CAP - CAP * 0.27, rx, CAP * 0.27, SW, 4, 0)
    # Bottom half
    _open_ring(p, GCX, CAP * 0.27, rx, CAP * 0.27, SW, 4, 0)

def _draw_4(p):
    cross_y = CAP * 0.35
    # Vertical stem on right
    _rect(p, _stem_r - 30, 0, SW, CAP)
    # Horizontal bar
    _rect(p, GL, cross_y, GW, SW)
    # Diagonal from top-left to crossbar
    p.moveTo((_r(GL), _r(cross_y + SW)))
    p.lineTo((_r(GL + SW*1.1), _r(cross_y + SW)))
    p.lineTo((_r(_stem_r - 30), _r(CAP)))
    p.lineTo((_r(_stem_r - 30 - SW*1.1), _r(CAP)))
    p.closePath()

def _draw_5(p):
    _rect(p, GL, CAP - SW, GW, SW)
    _rect(p, GL, CAP - SW, SW, CAP * 0.35)
    mid = _cap_mid + 20
    _rect(p, GL, mid, GW * 0.8, SW)
    # Bottom bowl
    _open_ring(p, GCX, mid // 2, GW // 2, mid // 2, SW, 3, 0)

def _draw_6(p):
    cx, cy = GCX, CAP * 0.32
    rx, ry = GW // 2, CAP * 0.32
    _ring(p, cx, cy, rx, ry, rx - SW, ry - SW)
    # Top arc
    _rect(p, GL, cy, SW, CAP * 0.45)
    _open_ring(p, GCX, CAP - CAP * 0.24, GW // 2, CAP * 0.24, SW, 6, 2)

def _draw_7(p):
    _rect(p, GL, CAP - SW, GW, SW)
    p.moveTo((_r(GR - SW), _r(CAP - SW)))
    p.lineTo((_r(GR), _r(CAP - SW)))
    p.lineTo((_r(GCX + SW//2), 0))
    p.lineTo((_r(GCX - SW//2), 0))
    p.closePath()

def _draw_8(p):
    rx = GW // 2
    top_ry = CAP * 0.26
    bot_ry = CAP * 0.27
    top_cy = CAP - top_ry
    bot_cy = bot_ry
    _ring(p, GCX, top_cy, rx - 10, top_ry, rx - 10 - SW, top_ry - SW)
    _ring(p, GCX, bot_cy, rx, bot_ry, rx - SW, bot_ry - SW)

def _draw_9(p):
    cx, cy = GCX, CAP - CAP * 0.32
    rx, ry = GW // 2, CAP * 0.32
    _ring(p, cx, cy, rx, ry, rx - SW, ry - SW)
    _rect(p, _stem_r, CAP * 0.24, SW, CAP * 0.45)
    _open_ring(p, GCX, CAP * 0.24, GW // 2, CAP * 0.24, SW, 2, 6)

# ── Punctuation & Symbols ────────────────────────────────────────────────

def _draw_space(p):
    pass  # empty glyph

def _draw_exclam(p):
    cx = GCX - SW//2
    _rect(p, cx, SW * 2.5, SW, CAP - SW * 2.5)
    _rect(p, cx, 0, SW, SW)

def _draw_dquote(p):
    _rect(p, GCX - 60, CAP - SW * 2.5, SW, SW * 2.5)
    _rect(p, GCX + 60 - SW, CAP - SW * 2.5, SW, SW * 2.5)

def _draw_hash(p):
    x1, x2 = GCX - 80, GCX + 80 - SW
    _rect(p, x1, CAP * 0.15, SW, CAP * 0.7)
    _rect(p, x2, CAP * 0.15, SW, CAP * 0.7)
    _rect(p, GL + 20, CAP * 0.55, GW - 40, SW)
    _rect(p, GL + 20, CAP * 0.3, GW - 40, SW)

def _draw_dollar(p):
    _draw_S(p)
    _rect(p, GCX - SW//2, -30, SW, CAP + 60)

def _draw_percent(p):
    r = 70
    _ring(p, GL + r + 10, CAP - r - 10, r, r, r - SW + 20, r - SW + 20)
    _ring(p, GR - r - 10, r + 10, r, r, r - SW + 20, r - SW + 20)
    p.moveTo((_r(GR - 20), _r(CAP)))
    p.lineTo((_r(GR - 20 - SW*0.8), _r(CAP)))
    p.lineTo((_r(GL + 20), 0))
    p.lineTo((_r(GL + 20 + SW*0.8), 0))
    p.closePath()

def _draw_ampersand(p):
    # Simplified &
    top_r = CAP * 0.22
    _ring(p, GCX - 20, CAP - top_r, top_r + 20, top_r, top_r + 20 - SW, top_r - SW)
    bot_r = CAP * 0.3
    _ring(p, GCX - 10, bot_r, bot_r + 30, bot_r, bot_r + 30 - SW, bot_r - SW)
    # Tail
    p.moveTo((_r(GR - 40), _r(CAP * 0.55)))
    p.lineTo((_r(GR), _r(CAP * 0.55)))
    p.lineTo((_r(GR), _r(CAP * 0.55 - SW)))
    p.lineTo((_r(GR - 40), _r(CAP * 0.55 - SW)))
    p.closePath()

def _draw_squote(p):
    _rect(p, GCX - SW//2, CAP - SW * 2.5, SW, SW * 2.5)

def _draw_lparen(p):
    cx = GCX + 80
    ry = CAP * 0.55
    rx = 160
    _open_ring(p, cx, CAP // 2, rx, ry, SW, 3, 5)

def _draw_rparen(p):
    cx = GCX - 80
    ry = CAP * 0.55
    rx = 160
    _open_ring(p, cx, CAP // 2, rx, ry, SW, 7, 1)

def _draw_asterisk(p):
    cy = CAP * 0.7
    _rect(p, GCX - SW//2, _r(cy - 70), SW, 140)
    p.moveTo((_r(GCX - 70), _r(cy + 40)))
    p.lineTo((_r(GCX - 70 + SW*0.7), _r(cy + 40)))
    p.lineTo((_r(GCX + 70), _r(cy - 40)))
    p.lineTo((_r(GCX + 70 - SW*0.7), _r(cy - 40)))
    p.closePath()
    p.moveTo((_r(GCX + 70), _r(cy + 40)))
    p.lineTo((_r(GCX + 70 - SW*0.7), _r(cy + 40)))
    p.lineTo((_r(GCX - 70), _r(cy - 40)))
    p.lineTo((_r(GCX - 70 + SW*0.7), _r(cy - 40)))
    p.closePath()

def _draw_plus(p):
    cy = _cap_mid
    _rect(p, GL + 60, cy - SW//2, GW - 120, SW)
    _rect(p, GCX - SW//2, cy - 120, SW, 240)

def _draw_comma(p):
    _rect(p, GCX - SW//2, -40, SW, SW + 40)

def _draw_minus(p):
    _rect(p, GL + 40, _cap_mid - SW//2, GW - 80, SW)

def _draw_period(p):
    _rect(p, GCX - SW//2, 0, SW, SW)

def _draw_slash(p):
    p.moveTo((_r(GR - 30), _r(CAP)))
    p.lineTo((_r(GR - 30 - SW*0.9), _r(CAP)))
    p.lineTo((_r(GL + 30), 0))
    p.lineTo((_r(GL + 30 + SW*0.9), 0))
    p.closePath()

def _draw_colon(p):
    cx = GCX - SW//2
    _rect(p, cx, XH * 0.6, SW, SW)
    _rect(p, cx, 0, SW, SW)

def _draw_semicolon(p):
    cx = GCX - SW//2
    _rect(p, cx, XH * 0.6, SW, SW)
    _rect(p, cx, -40, SW, SW + 40)

def _draw_less(p):
    p.moveTo((_r(GR - 30), _r(CAP - 60)))
    p.lineTo((_r(GR - 30), _r(CAP - 60 - SW)))
    p.lineTo((_r(GL + 30), _r(_cap_mid)))
    p.lineTo((_r(GL + 30), _r(_cap_mid + SW)))
    p.closePath()
    p.moveTo((_r(GL + 30), _r(_cap_mid)))
    p.lineTo((_r(GL + 30), _r(_cap_mid - SW)))
    p.lineTo((_r(GR - 30), _r(60)))
    p.lineTo((_r(GR - 30), _r(60 + SW)))
    p.closePath()

def _draw_equals(p):
    _rect(p, GL + 40, _cap_mid + 40, GW - 80, SW)
    _rect(p, GL + 40, _cap_mid - 40 - SW, GW - 80, SW)

def _draw_greater(p):
    p.moveTo((_r(GL + 30), _r(CAP - 60)))
    p.lineTo((_r(GL + 30), _r(CAP - 60 - SW)))
    p.lineTo((_r(GR - 30), _r(_cap_mid)))
    p.lineTo((_r(GR - 30), _r(_cap_mid + SW)))
    p.closePath()
    p.moveTo((_r(GR - 30), _r(_cap_mid)))
    p.lineTo((_r(GR - 30), _r(_cap_mid - SW)))
    p.lineTo((_r(GL + 30), _r(60)))
    p.lineTo((_r(GL + 30), _r(60 + SW)))
    p.closePath()

def _draw_question(p):
    top_cy = CAP - CAP * 0.28
    _open_ring(p, GCX, top_cy, GW // 2, CAP * 0.28, SW, 5, 0)
    _rect(p, GCX - SW//2, _r(CAP * 0.3), SW, _r(CAP * 0.15))
    _rect(p, GCX - SW//2, 0, SW, SW)

def _draw_at(p):
    cx, cy = GCX, CAP // 2
    rx, ry = GW // 2, CAP // 2
    _open_ring(p, cx, cy, rx, ry, SW, 7, 1)
    # Inner spiral
    ir = rx * 0.5
    _ring(p, cx + 30, cy, ir, ir, ir - SW + 15, ir - SW + 15)
    _rect(p, cx + 30 + _r(ir) - SW, cy - _r(ir), SW, _r(ir))

def _draw_lbracket(p):
    _rect(p, GL + 60, 0, SW, CAP)
    _rect(p, GL + 60, CAP - SW, 120, SW)
    _rect(p, GL + 60, 0, 120, SW)

def _draw_backslash(p):
    p.moveTo((_r(GL + 30), _r(CAP)))
    p.lineTo((_r(GL + 30 + SW*0.9), _r(CAP)))
    p.lineTo((_r(GR - 30), 0))
    p.lineTo((_r(GR - 30 - SW*0.9), 0))
    p.closePath()

def _draw_rbracket(p):
    _rect(p, GR - 60 - SW, 0, SW, CAP)
    _rect(p, GR - 60 - 120, CAP - SW, 120, SW)
    _rect(p, GR - 60 - 120, 0, 120, SW)

def _draw_caret(p):
    mid = GCX
    p.moveTo((_r(mid - SW//2), _r(CAP)))
    p.lineTo((_r(mid + SW//2), _r(CAP)))
    p.lineTo((_r(GR - 30), _r(CAP * 0.6)))
    p.lineTo((_r(GR - 30 - SW), _r(CAP * 0.6)))
    p.closePath()
    p.moveTo((_r(mid - SW//2), _r(CAP)))
    p.lineTo((_r(mid + SW//2), _r(CAP)))
    p.lineTo((_r(GL + 30 + SW), _r(CAP * 0.6)))
    p.lineTo((_r(GL + 30), _r(CAP * 0.6)))
    p.closePath()

def _draw_underscore(p):
    _rect(p, GL, -30, GW, SW)

def _draw_backtick(p):
    p.moveTo((_r(GCX - 60), _r(CAP)))
    p.lineTo((_r(GCX - 60 + SW), _r(CAP)))
    p.lineTo((_r(GCX + 10 + SW), _r(CAP - 100)))
    p.lineTo((_r(GCX + 10), _r(CAP - 100)))
    p.closePath()

def _draw_lbrace(p):
    cx = GCX + 60
    _rect(p, cx - SW//2, _cap_mid + 30, SW, CAP // 2 - 60)
    _rect(p, cx - SW//2, 30, SW, CAP // 2 - 60)
    # Top curve
    _open_ring(p, cx + 60, CAP - 60, 60, 60, SW, 3, 2)
    # Bottom curve
    _open_ring(p, cx + 60, 60, 60, 60, SW, 6, 5)
    # Middle bump
    _open_ring(p, cx - 60, _cap_mid, 60, 60, SW, 0, 1)

def _draw_pipe(p):
    _rect(p, GCX - SW//2, DSC, SW, CAP - DSC)

def _draw_rbrace(p):
    cx = GCX - 60
    _rect(p, cx - SW//2, _cap_mid + 30, SW, CAP // 2 - 60)
    _rect(p, cx - SW//2, 30, SW, CAP // 2 - 60)
    _open_ring(p, cx - 60, CAP - 60, 60, 60, SW, 2, 1)
    _open_ring(p, cx - 60, 60, 60, 60, SW, 5, 6)
    _open_ring(p, cx + 60, _cap_mid, 60, 60, SW, 4, 3)

def _draw_tilde(p):
    cy = _cap_mid
    # Approximate S-curve with two arcs
    _open_ring(p, GCX - 60, cy + 20, 80, 50, SW, 6, 2)
    _open_ring(p, GCX + 60, cy - 20, 80, 50, SW, 2, 6)


# ── Glyph Registry ───────────────────────────────────────────────────────

GLYPH_MAP = {
    ' ': _draw_space,
    '!': _draw_exclam,
    '"': _draw_dquote,
    '#': _draw_hash,
    '$': _draw_dollar,
    '%': _draw_percent,
    '&': _draw_ampersand,
    "'": _draw_squote,
    '(': _draw_lparen,
    ')': _draw_rparen,
    '*': _draw_asterisk,
    '+': _draw_plus,
    ',': _draw_comma,
    '-': _draw_minus,
    '.': _draw_period,
    '/': _draw_slash,
    '0': _draw_0, '1': _draw_1, '2': _draw_2, '3': _draw_3, '4': _draw_4,
    '5': _draw_5, '6': _draw_6, '7': _draw_7, '8': _draw_8, '9': _draw_9,
    ':': _draw_colon,
    ';': _draw_semicolon,
    '<': _draw_less,
    '=': _draw_equals,
    '>': _draw_greater,
    '?': _draw_question,
    '@': _draw_at,
    'A': _draw_A, 'B': _draw_B, 'C': _draw_C, 'D': _draw_D, 'E': _draw_E,
    'F': _draw_F, 'G': _draw_G, 'H': _draw_H, 'I': _draw_I, 'J': _draw_J,
    'K': _draw_K, 'L': _draw_L, 'M': _draw_M, 'N': _draw_N, 'O': _draw_O,
    'P': _draw_P, 'Q': _draw_Q, 'R': _draw_R, 'S': _draw_S, 'T': _draw_T,
    'U': _draw_U, 'V': _draw_V, 'W': _draw_W, 'X': _draw_X, 'Y': _draw_Y,
    'Z': _draw_Z,
    '[': _draw_lbracket,
    '\\': _draw_backslash,
    ']': _draw_rbracket,
    '^': _draw_caret,
    '_': _draw_underscore,
    '`': _draw_backtick,
    'a': _draw_a, 'b': _draw_b, 'c': _draw_c, 'd': _draw_d, 'e': _draw_e,
    'f': _draw_f, 'g': _draw_g, 'h': _draw_h, 'i': _draw_i, 'j': _draw_j,
    'k': _draw_k, 'l': _draw_l, 'm': _draw_m, 'n': _draw_n, 'o': _draw_o,
    'p': _draw_p, 'q': _draw_q, 'r': _draw_r, 's': _draw_s, 't': _draw_t,
    'u': _draw_u, 'v': _draw_v, 'w': _draw_w, 'x': _draw_x, 'y': _draw_y,
    'z': _draw_z,
    '{': _draw_lbrace,
    '|': _draw_pipe,
    '}': _draw_rbrace,
    '~': _draw_tilde,
}


# ── Font Assembly ─────────────────────────────────────────────────────────

def build_font():
    """Build the complete TTF font."""
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
    _rect(pen, 50, 0, ADVANCE - 100, CAP)
    pen2 = TTGlyphPen(None)
    _rect(pen2, 50 + SW, SW, ADVANCE - 100 - 2*SW, CAP - 2*SW)
    # Draw as two contours (outer CW + inner CCW)
    notdef_pen = TTGlyphPen(None)
    _rect(notdef_pen, 50, 0, ADVANCE - 100, CAP)
    # Inner (hole) — counter-clockwise
    notdef_pen.moveTo((50 + SW, SW))
    notdef_pen.lineTo((50 + SW, CAP - SW))
    notdef_pen.lineTo((ADVANCE - 50 - SW, CAP - SW))
    notdef_pen.lineTo((ADVANCE - 50 - SW, SW))
    notdef_pen.closePath()
    glyph_table[".notdef"] = notdef_pen.glyph()

    # Build each glyph
    errors = []
    for cp in range(32, 127):
        ch = chr(cp)
        name = cmap[cp]
        draw_fn = GLYPH_MAP.get(ch)
        pen = TTGlyphPen(None)
        if draw_fn:
            try:
                draw_fn(pen)
            except Exception as e:
                errors.append(f"  {ch!r} ({name}): {e}")
                pen = TTGlyphPen(None)  # empty fallback
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
        "description": "Custom geometric monospace font for Some of You May Die",
        "vendorURL": "https://someofyoumaydie.com",
        "licenseDescription": "Proprietary — SoftBacon Software. All rights reserved.",
        "version": "Version 2.0",
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

    print("Building Somdie Mono (smooth vector outlines)...")
    font = build_font()
    font.save(str(out_path))

    size = out_path.stat().st_size
    print(f"Saved: {out_path} ({size:,} bytes)")
    print(f"Glyphs: 95 printable ASCII (32-126)")
    print(f"Metrics: UPM={UPM}, advance={ADVANCE}, cap={CAP}, x-height={XH}")


if __name__ == "__main__":
    main()
