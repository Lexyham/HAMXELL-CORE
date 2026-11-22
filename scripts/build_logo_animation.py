#!/usr/bin/env python3
"""
HAMXELL CORE logo generator (Python standard library only). Run: python3 scripts/build_logo_animation.py

Writes into public/brand/:
  emblem.svg   static emblem (six petals, rings, core), transparent background; also used for the site-wide background
  logo.svg     static horizontal lockup (wordmark with the ring-and-dot "O"), transparent background
  intro.svg    the animated landing intro (CSS keyframes inside the SVG; plays when the file loads; no script, no audio)

All geometry lives here, so the three files can never drift apart. Edit the constants and re-run.
"""
import math
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "brand"
BLUE, GOLD, WHITE, MUTED = "#2865F5", "#F5AE00", "#F4F5F7", "#969DA8"

# ---------- emblem (coordinates relative to its centre) ----------
R_OUT, R_IN, R_CORE = 165, 108, 30
PETAL = "M0 -58L29.5 -87.1A42 42 0 1 0 -29.5 -87.1Z"  # teardrop pointing at the centre
PETAL_ANGLES = list(range(0, 360, 60))
SW_RING, SW_ARC, SW_PETAL = 9, 7, 8


def pt(r, deg):
    a = math.radians(deg)
    return r * math.sin(a), -r * math.cos(a)


def arc(r, a0, a1):
    x0, y0 = pt(r, a0)
    x1, y1 = pt(r, a1)
    return f"M{x0:.2f} {y0:.2f}A{r} {r} 0 0 1 {x1:.2f} {y1:.2f}"


INNER_ARCS = [arc(R_IN, c - 15, c + 15) for c in range(30, 360, 60)]

# ---------- wordmark (stroked geometric capitals; no fonts needed) ----------
H, SW, GAP, WORD_GAP = 76, 8, 20, 56
WIDTH = dict(H=56, A=62, M=68, X=58, E=48, L=48, C=60, O=76, R=56)
TEXT = "HAMXELL CORE"


def glyph(ch, w):
    h = H
    return {
        "H": f"M0 0V{h}M{w} 0V{h}M0 {h/2}H{w}",
        "A": f"M0 {h}L{w/2} 0L{w} {h}M{w*.2:.1f} {h*.64:.1f}H{w*.8:.1f}",
        "M": f"M0 {h}V0L{w/2} {h*.58:.1f}L{w} 0V{h}",
        "X": f"M0 0L{w} {h}M{w} 0L0 {h}",
        "E": f"M{w} 0H0V{h}H{w}M0 {h/2}H{w*.85:.1f}",
        "L": f"M0 0V{h}H{w}",
        "C": f"M{w*.98:.1f} {h*.22:.1f}A{w*.5:.1f} {h*.5:.1f} 0 1 0 {w*.98:.1f} {h*.78:.1f}",
        "R": f"M0 {h}V0H{w*.6:.1f}A{w*.4:.1f} {h*.25:.1f} 0 0 1 {w*.6:.1f} {h*.5:.1f}H0M{w*.55:.1f} {h*.5:.1f}L{w} {h}",
    }[ch]


def layout():
    x, out = 0, []
    for ch in TEXT:
        if ch == " ":
            x += WORD_GAP - GAP
            continue
        w = WIDTH[ch]
        out.append(dict(ch=ch, x=x, w=w))
        x += w + GAP
    return out, x - GAP


LETTERS, WM_W = layout()


def write(name, svg):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(svg, encoding="utf-8")
    print(f"wrote {name} ({len(svg):,} bytes)")


def emblem_parts():
    arcs = "".join(f'<path d="{d}"/>' for d in INNER_ARCS)
    petals = "".join(f'<path d="{PETAL}" transform="rotate({a})"/>' for a in PETAL_ANGLES)
    return (
        f'<circle r="{R_OUT}" fill="none" stroke="{BLUE}" stroke-width="{SW_RING}"/>'
        f'<g fill="none" stroke="{BLUE}" stroke-width="{SW_ARC}" stroke-linecap="round">{arcs}</g>'
        f'<g fill="none" stroke="{WHITE}" stroke-width="{SW_PETAL}" stroke-linejoin="round">{petals}</g>'
        f'<circle r="{R_CORE}" fill="{GOLD}"/>'
    )


def wordmark_static(dx=0, dy=0):
    g = []
    for L in LETTERS:
        if L["ch"] == "O":
            cx, cy = dx + L["x"] + L["w"] / 2, dy + H / 2
            g.append(f'<circle cx="{cx}" cy="{cy}" r="{H/2-SW/2}" fill="none" stroke="{BLUE}" stroke-width="{SW}"/>')
            g.append(f'<circle cx="{cx}" cy="{cy}" r="11" fill="{GOLD}"/>')
        else:
            g.append(f'<path transform="translate({dx + L["x"]} {dy})" d="{glyph(L["ch"], L["w"])}"/>')
    return f'<g fill="none" stroke="{WHITE}" stroke-width="{SW}" stroke-linecap="square" stroke-linejoin="miter">{"".join(g)}</g>'


def build_static():
    write("emblem.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-190 -190 380 380" width="380" height="380" role="img" aria-label="HAMXELL CORE emblem">{emblem_parts()}</svg>')
    pad = 24
    write("logo.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WM_W + 2*pad} {H + 2*pad}" width="{WM_W + 2*pad}" height="{H + 2*pad}" role="img" aria-label="HAMXELL CORE">{wordmark_static(pad, pad)}</svg>')


# ---------- animated intro ----------
W, HT = 1280, 720
EX, EY, ES = 640, 322, 0.95  # emblem centre and scale
WM_X, WM_Y = (W - WM_W) / 2, 360 - H / 2  # wordmark top-left, vertically centred in the frame
TOTAL = 8.4  # seconds until the page may take over (last animation ends at ~8.1)

CSS = """
:root{--t:0s}
.a{animation-fill-mode:both;animation-timing-function:cubic-bezier(.4,0,.2,1);animation-delay:calc(var(--d,0s) - var(--t,0s));animation-duration:var(--dur,1s)}
.draw{stroke-dasharray:1 1;animation-name:draw}@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.fade{animation-name:fade}@keyframes fade{from{opacity:0}to{opacity:1}}
.rise{animation-name:rise}@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.pop{animation-name:pop}@keyframes pop{0%{opacity:0;transform:scale(0)}60%{opacity:1;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}
.spark{animation-name:spark}@keyframes spark{0%{opacity:0;transform:scale(.4)}40%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.4)}}
.shock{animation-name:shock}@keyframes shock{0%{opacity:0;transform:scale(.3)}8%{opacity:.85}100%{opacity:0;transform:scale(3.4)}}
.collapse{animation-name:collapse;animation-timing-function:cubic-bezier(.5,0,.75,0)}@keyframes collapse{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.35)}}
.travel{animation-name:travel;animation-timing-function:cubic-bezier(.65,0,.35,1)}@keyframes travel{from{transform:translate(0,0) scale(1)}to{transform:translate(var(--dx),var(--dy)) scale(var(--sc))}}
.bar{transform-box:fill-box;transform-origin:center;animation-name:bar}@keyframes bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.glow{animation-name:glow}@keyframes glow{0%{opacity:0}30%{opacity:.9}100%{opacity:.28}}
""".strip()


def d(delay, dur=None):
    return f"--d:{delay:.2f}s" + (f";--dur:{dur:.2f}s" if dur else "")


def build_intro():
    o = next(l for l in LETTERS if l["ch"] == "O")
    ocx, ocy = WM_X + o["x"] + o["w"] / 2, WM_Y + H / 2
    dx, dy = (ocx - EX) / ES, (ocy - EY) / ES
    sc = (11 / ES) / R_CORE
    P = []

    P.append(f'<rect width="{W}" height="{HT}" fill="#000"/>')
    P.append('<defs><filter id="core-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="9"/></filter><filter id="wm-glow" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="9"/></filter></defs>')

    # emblem (centre origin): spark, shock rings, rings, petals, core
    P.append(f'<g transform="translate({EX} {EY}) scale({ES})">')
    P.append(f'<circle r="4" fill="{WHITE}" class="a spark" style="{d(0.45, 0.7)}"/>')
    for i, t in enumerate((0.95, 1.25)):
        P.append(f'<circle r="42" fill="none" stroke="{BLUE}" stroke-width="3" class="a shock" style="{d(t, 1.5)}"/>')
    P.append('<g class="a collapse" style="--d:4.30s;--dur:.85s">')
    P.append(f'<circle r="{R_OUT}" transform="rotate(-90)" pathLength="1" fill="none" stroke="{BLUE}" stroke-width="{SW_RING}" class="a draw" style="{d(1.4, 1.4)}"/>')
    for i, a in enumerate(INNER_ARCS):
        P.append(f'<path d="{a}" pathLength="1" fill="none" stroke="{BLUE}" stroke-width="{SW_ARC}" stroke-linecap="round" class="a draw" style="{d(1.95 + i*0.1, 0.7)}"/>')
    for i, ang in enumerate(PETAL_ANGLES):
        P.append(f'<g transform="rotate({ang})"><path d="{PETAL}" pathLength="1" fill="none" stroke="{WHITE}" stroke-width="{SW_PETAL}" stroke-linejoin="round" class="a draw" style="{d(2.3 + i*0.2, 0.9)}"/></g>')
    P.append("</g>")
    # core: outer group travels to the "O", inner group pops in
    P.append(f'<g class="a travel" style="--d:4.30s;--dur:1.10s;--dx:{dx:.2f}px;--dy:{dy:.2f}px;--sc:{sc:.4f}">')
    P.append(f'<g class="a pop" style="{d(0.9, 0.7)}"><circle r="{R_CORE+6}" fill="{GOLD}" opacity=".55" filter="url(#core-glow)"/><circle r="{R_CORE}" fill="{GOLD}"/></g>')
    P.append("</g></g>")

    # wordmark (+ soft glow copy that shares every delay)
    def letters(glow):
        g = []
        for i, L in enumerate((l for l in LETTERS)):
            t = 4.6 + i * 0.12
            if L["ch"] == "O":
                cx, cy = WM_X + L["x"] + L["w"] / 2, WM_Y + H / 2
                col = WHITE if glow else BLUE
                g.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{H/2-SW/2}" transform="rotate(-90 {cx:.1f} {cy:.1f})" pathLength="1" fill="none" stroke="{col}" stroke-width="{SW}" class="a draw" style="{d(5.35, 0.6)}"/>')
            else:
                g.append(f'<path transform="translate({WM_X + L["x"]:.1f} {WM_Y:.1f})" d="{glyph(L["ch"], L["w"])}" pathLength="1" class="a draw" style="{d(t, 0.55)}"/>')
        return "".join(g)

    P.append(f'<g fill="none" stroke="{WHITE}" stroke-width="{SW + 6}" stroke-linecap="square" filter="url(#wm-glow)" class="a glow" style="{d(6.2, 1.4)}">{letters(True)}</g>')
    P.append(f'<g fill="none" stroke="{WHITE}" stroke-width="{SW}" stroke-linecap="square" stroke-linejoin="miter">{letters(False)}</g>')
    # ring pulse where the core lands
    P.append(f'<g transform="translate({ocx:.1f} {ocy:.1f})"><circle r="16" fill="none" stroke="{BLUE}" stroke-width="3" class="a shock" style="{d(5.3, 1.1)}"/></g>')
    P.append(f'<g transform="translate({ocx:.1f} {ocy:.1f})"><circle r="11" fill="{GOLD}" class="a fade" style="{d(5.4, 0.01)}"/></g>')
    # underline + tagline
    uy = WM_Y + H + 34
    P.append(f'<rect x="{WM_X:.1f}" y="{uy:.1f}" width="{WM_W}" height="3" fill="{BLUE}" class="a bar" style="{d(6.3, 0.9)}"/>')
    ty = uy + 70
    fam = "'Cascadia Code',Consolas,'Courier New',monospace"
    for x, txt, col, t in ((240, "One ecosystem.", MUTED, 6.7), (640, "Multiple products.", MUTED, 7.1), (1040, "One identity.", WHITE, 7.5)):
        P.append(f'<text x="{x}" y="{ty:.1f}" text-anchor="middle" font-family="{fam}" font-size="34" fill="{col}" class="a rise" style="{d(t, 0.7)}">{txt}</text>')

    write("intro.svg", f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {HT}" width="{W}" height="{HT}" role="img" aria-label="HAMXELL CORE. One ecosystem. Multiple products. One identity."><style>{CSS}</style>{"".join(P)}</svg>')
    print(f"intro duration: ends at ~8.2 s, page takes over at {TOTAL} s")


if __name__ == "__main__":
    build_static()
    build_intro()
