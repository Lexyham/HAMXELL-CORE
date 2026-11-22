#!/usr/bin/env python3
"""
HAMXELL CORE — cinematic logo intro (procedural renderer + procedural synth score)

Story (13 s, 1920x1080 @ 30 fps):
  0.7  a lone spark flickers in the dark
  1.3  IGNITION: the orange core detonates, shockwaves + embers + anamorphic flare
  1.55 blue rings ripple outward, 6 petals draw themselves with glowing heads (pentatonic arpeggio)
  4.15 emblem completes, an energy comet laps the outer ring, chord blooms
  4.85 UNRAVEL: the emblem's own strokes shatter into ~6500 light particles that swirl and
       stream (left -> right) into the letters of "HAMXELL CORE"; the orange core flies on an arc
       and lands as the heart of the "O" — rings ripple out of it exactly like in the opening
  6.9  impact: wordmark ignites white-hot, sparks, flare, resolved chord
  8.2  tagline resolves phrase by phrase: "One ecosystem." / "Multiple products." / "One identity."
  Sound: all synthesized from scratch with numpy (additive/FM/noise synthesis + convolution reverb),
         timed from the same timeline constants as the visuals. Particle arrivals trigger
         pan-positioned shimmer notes (letters sing as they form).

Usage:  python3 hamxell_cinematic_intro.py            -> mp4 (with audio), gif, wav
        python3 hamxell_cinematic_intro.py --preview 1.4 3 4.5 5.5 6.6 7.5 9 11   -> PNG stills
Needs: numpy, scipy, opencv-python, pillow, ffmpeg
"""
import math, subprocess, sys, time, wave
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from scipy.signal import butter, sosfilt, fftconvolve

W, H, FPS, DUR, SS, SR = 1920, 1080, 30, 13.0, 2, 48000
OUT = 'hamxell_cinematic_intro'

# ----------------------------------------------------------------- timeline (seconds)
T_SPARK, T_IGNITE = 0.7, 1.3
T_RING = (1.55, 1.8, 2.05)
T_PET0, PET_STEP, PET_DUR = 2.1, 0.18, 1.0
T_COMPLETE = 4.15
T_COMET0, T_COMET1 = 3.9, 4.85
T_UN, UN_SPAN = 4.85, 0.75           # unravel start; spread of particle departures
T_FLY, T_LAND = 5.0, 6.3             # core flight
T_IMPACT = 6.9
T_UL0, T_UL1 = 7.3, 8.0
T_TAG = (8.2, 9.1, 10.0)

# ----------------------------------------------------------------- style / geometry
CX, CY, S = 960.0, 540.0, 2.0
R_CORE, R_IN, R_ARC, R_OUT = 30, 80, 124, 165
PET_R, PET_D, PET_T = 42, 113, 38
BLUE_RGB = (43, 103, 255)
ORANGE_RGB = (250, 169, 7)
BLUE_H = np.array([0.17, 0.40, 1.0], np.float32)
ORANGE_H = np.array([1.0, 0.41, 0.0], np.float32)   # tuned so core reads as logo orange after bloom
FONT_MAIN = '/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf'
FONT_TAG = '/usr/share/fonts/truetype/google-fonts/Poppins-Light.ttf'
CROP_X0, CROP_Y0, CROP = 460, 40, 1000     # emblem is drawn (supersampled) inside this window

def seg(t, a, b): return min(max((t - a) / (b - a), 0.0), 1.0)
def sstep(x): x = min(max(x, 0.0), 1.0); return x * x * (3 - 2 * x)
def ease_out_cubic(x): x = min(max(x, 0.0), 1.0); return 1 - (1 - x) ** 3
def ease_out_back(x, k=1.7): x = min(max(x, 0.0), 1.0); return 1 + (k + 1) * (x - 1) ** 3 + k * (x - 1) ** 2

# ----------------------------------------------------------------- camera
SHAKES = [(T_IGNITE, 14, 0.40), (T_COMPLETE, 7, 0.30), (T_LAND, 5, 0.25), (T_IMPACT, 12, 0.45)] + \
         [(T_PET0 + PET_STEP * k + PET_DUR, 2.5, 0.14) for k in range(6)]
def cam(t):
    z = 1 + 0.14 * sstep(seg(t, 0.9, 4.85)) * (1 - sstep(seg(t, 4.85, 5.7)))
    sx = sy = 0.0
    for i, (t0, a, tau) in enumerate(SHAKES):
        if t >= t0:
            e = a * math.exp(-(t - t0) / tau)
            sx += e * math.sin((t - t0) * 51 + i); sy += e * math.cos((t - t0) * 43 + 2 * i)
    return z, sx, sy
def energy(t):
    return sum(math.exp(-(t - t0) / (tau * 1.2)) * min(a, 14) / 14 for t0, a, tau in SHAKES if t >= t0)

# ----------------------------------------------------------------- emblem geometry
def petal_halves(n=40):
    L = PET_D - PET_T; a0 = math.acos(PET_R / L); out = []
    for sgn in (1, -1):
        tp = (PET_D + PET_R * math.cos(math.pi - a0), sgn * PET_R * math.sin(math.pi - a0))
        pts = [(PET_T + (tp[0] - PET_T) * i / (n - 1), tp[1] * i / (n - 1)) for i in range(n)]
        st = sgn * (math.pi - a0)
        pts += [(PET_D + PET_R * math.cos(st * (1 - u)), PET_R * math.sin(st * (1 - u))) for u in (i / (2 * n - 1) for i in range(1, 2 * n))]
        out.append(pts)
    return out
HALVES = petal_halves()
def plen(p): return sum(math.dist(p[i], p[i + 1]) for i in range(len(p) - 1))
def partial(p, frac):
    tot = plen(p) * frac; out = [p[0]]; run = 0
    for i in range(len(p) - 1):
        d = math.dist(p[i], p[i + 1])
        if run + d >= tot:
            u = (tot - run) / d if d else 0
            out.append((p[i][0] + (p[i + 1][0] - p[i][0]) * u, p[i][1] + (p[i + 1][1] - p[i][1]) * u)); return out
        out.append(p[i + 1]); run += d
    return out
def petal_world(k, half, frac, rot_off=0.0):
    a = math.radians(90 - 60 * k) + rot_off; ca, sa = math.cos(a), math.sin(a)
    return [(CX + (x * ca - y * sa) * S, CY + (x * sa + y * ca) * S) for x, y in partial(HALVES[half], frac)]

# ----------------------------------------------------------------- wordmark + tagline layers
def spaced(text, font, track):
    xs, x = [], 0.0
    for ch in text: xs.append(x); x += font.getlength(ch) + track
    return xs, x - track
TEXT_BASE, TAG_BASE = 560, 692
UL_Y = TEXT_BASE + 52
TB0, TB1 = 380, 640                         # wordmark row band
TAG0, TAG1 = TAG_BASE - 60, TAG_BASE + 30

def build_text():
    f = ImageFont.truetype(FONT_MAIN, 150 * SS)
    chars = 'HAMXELL CORE'; xs, total = spaced(chars, f, 27 * SS); x0 = W * SS / 2 - total / 2
    img = Image.new('L', (W * SS, (TB1 - TB0) * SS), 0); d = ImageDraw.Draw(img)
    oi = chars.index('O', 8); geo = None
    for i, ch in enumerate(chars):
        if ch == ' ': continue
        if i == oi:
            l, t, r, b = f.getbbox('O', anchor='ls')
            cx = (x0 + xs[i] + (l + r) / 2) / SS; cy = (TEXT_BASE - TB0) * SS + (t + b) / 2
            geo = (cx, TB0 + cy / SS, ((r - l) + (b - t)) / 4 / SS)
            continue                                   # the O is generated by the core + rings
        d.text((x0 + xs[i], (TEXT_BASE - TB0) * SS), ch, font=f, fill=255, anchor='ls')
    m = cv2.resize(np.asarray(img), (W, TB1 - TB0), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    return m, geo, total / SS
TEXT_BAND, O_GEO, TEXT_W = build_text()
OX, OY, RO = O_GEO

def build_tag():
    f = ImageFont.truetype(FONT_TAG, 41 * SS); ph = ['One ecosystem.', 'Multiple products.', 'One identity.']
    track, gap = 4.5 * SS, 50 * SS
    ws = [spaced(p, f, track)[1] for p in ph]; x = W * SS / 2 - (sum(ws) + 2 * gap) / 2; layers = []
    for p, wd in zip(ph, ws):
        img = Image.new('L', (W * SS, (TAG1 - TAG0) * SS), 0); d = ImageDraw.Draw(img); xs, _ = spaced(p, f, track)
        for ch, cx in zip(p, xs): d.text((x + cx, (TAG_BASE - TAG0) * SS), ch, font=f, fill=255, anchor='ls')
        layers.append(cv2.resize(np.asarray(img), (W, TAG1 - TAG0), interpolation=cv2.INTER_AREA).astype(np.float32) / 255)
        x += wd + gap
    return layers
TAG_L = build_tag(); TAG_B = [cv2.GaussianBlur(l, (0, 0), 9) * 1.7 for l in TAG_L]
TAG_COL = [np.array([0.72, 0.78, 0.92], np.float32)] * 2 + [np.array([0.97, 0.98, 1.0], np.float32)]

# ----------------------------------------------------------------- particle system (emblem strokes -> letters)
NP = 6500
rng = np.random.default_rng(11)
def circle_pts(r, a0=0, a1=360, n=240):
    return [(CX + r * S * math.cos(math.radians(a0 + (a1 - a0) * i / n)), CY + r * S * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
def src_polylines():
    polys = []                                         # (points, is_white)
    for k in range(6):
        a = petal_world(k, 0, 1.0); b = petal_world(k, 1, 1.0)
        polys.append((a + b[::-1], True))
    polys += [(circle_pts(R_OUT), False), (circle_pts(R_IN), False)]
    polys += [(circle_pts(R_ARC, k * 60 - 20, k * 60 + 20, 40), False) for k in range(6)]
    return polys
def build_particles():
    polys = src_polylines(); lens = np.array([plen(p) for p, _ in polys]); cnt = np.round(lens / lens.sum() * NP).astype(int)
    pts, cols = [], []
    for (p, white), n in zip(polys, cnt):
        a = np.asarray(p); sg = np.hypot(*np.diff(a, axis=0).T); cum = np.r_[0, np.cumsum(sg)]
        s = rng.uniform(0, cum[-1], n); pts.append(np.c_[np.interp(s, cum, a[:, 0]), np.interp(s, cum, a[:, 1])])
        cols.append(np.tile([1.0, 1.0, 1.0] if white else BLUE_H * 1.15, (n, 1)))
    src = np.concatenate(pts); col = np.concatenate(cols).astype(np.float32); n = len(src)
    ys, xs = np.nonzero(TEXT_BAND > 0.6); pick = rng.integers(0, len(xs), n)
    tgt = np.c_[xs[pick] + rng.uniform(0, 1, n), ys[pick] + TB0 + rng.uniform(0, 1, n)]
    o1 = np.argsort(src[:, 0] + rng.normal(0, 28, n)); o2 = np.argsort(tgt[:, 0] + rng.normal(0, 18, n))
    return src[o1], col[o1], tgt[o2], n
SRC, SRC_COL, TGT, N = build_particles()
SRC_XS, TGT_XS = np.sort(SRC[:, 0]), np.sort(TGT[:, 0])
RANK = np.arange(N) / N
DELAY = RANK * UN_SPAN + rng.uniform(0, 0.1, N)
PDUR = 0.85 + rng.uniform(0, 0.25, N)
AMP = rng.uniform(60, 240, N) * rng.choice([-1, 1], N)
LIFT = rng.uniform(30, 210, N); PH = rng.uniform(0, 2 * math.pi, N); RAD = rng.uniform(0, 150, N)
_d = TGT - SRC; _n = np.hypot(_d[:, 0], _d[:, 1]) + 1e-6; PERP = np.c_[-_d[:, 1], _d[:, 0]] / _n[:, None]
_r = SRC - [CX, CY]; RADV = _r / (np.hypot(_r[:, 0], _r[:, 1])[:, None] + 1e-6)
TARR = T_UN + DELAY + PDUR

def pcl_state(t):
    u = np.clip((t - T_UN - DELAY) / PDUR, 0, 1); e = u * u * u * (u * (u * 6 - 15) + 10); s = np.sin(np.pi * u)
    sw = AMP * s * np.cos(PH); lf = LIFT * s * np.sin(PH) ** 2
    rd = RAD * np.sin(np.pi * np.minimum(u * 1.6, 1))
    x = SRC[:, 0] + _d[:, 0] * e + PERP[:, 0] * sw + RADV[:, 0] * rd + 6 * s * np.sin(t * 9 + PH * 5)
    y = SRC[:, 1] + _d[:, 1] * e + PERP[:, 1] * sw - lf + RADV[:, 1] * rd + 6 * s * np.cos(t * 8 + PH * 3)
    vis = np.clip((t - T_UN - DELAY) / 0.05 + 0.2, 0, 1) * (t >= T_UN - 0.01)
    w = vis * np.where(u < 1, 1.0, np.exp(-(t - TARR) / 0.28))
    col = SRC_COL * (1 - e[:, None]) + np.array([1.0, 1.0, 1.0], np.float32) * e[:, None]
    return x, y, w.astype(np.float32), col, (u > 0) & (u < 1)

# embers / sparks (deterministic bursts)
def make_burst(n, speed, life, cols, seed, spread=None):
    r = np.random.default_rng(seed)
    return dict(n=n, ang=r.uniform(0, 2 * math.pi, n), spd=r.uniform(*speed, n), life=life * r.uniform(0.5, 1.0, n),
                col=np.array(cols, np.float32)[r.integers(0, len(cols), n)], ph=r.uniform(0, 6.28, n),
                ox=(r.uniform(*spread, n) if spread else None))
B_IGN = make_burst(420, (150, 950), 2.0, [(1, .75, .2), (1, .55, .05), (1, .9, .6)], 1)
B_LAND = make_burst(260, (80, 520), 1.6, [(1, .65, .1), (.3, .55, 1), (1, 1, 1)], 2)
B_IMP = make_burst(520, (30, 330), 1.9, [(1, 1, 1), (.5, .75, 1), (.3, .55, 1)], 3, spread=(OX - 520, OX + 520))
def burst_em(b, t, t0, ox, oy):
    dt = t - t0
    if dt < 0: return None
    k = 2.2; r = b['spd'] * (1 - np.exp(-dt * k)) / k
    x = (b['ox'] if b['ox'] is not None else ox) + np.cos(b['ang']) * r * (0.35 if b['ox'] is not None else 1)
    y = oy + np.sin(b['ang']) * r + 40 * dt * dt
    w = np.clip(1 - dt / b['life'], 0, 1) ** 1.6 * (0.7 + 0.3 * np.sin(dt * 25 + b['ph'])) * 1.6
    return x, y, w.astype(np.float32), b['col']
DUST_N = 260
_dr = np.random.default_rng(5)
DUST = dict(x=_dr.uniform(0, W, DUST_N), y=_dr.uniform(0, H, DUST_N), vx=_dr.uniform(-9, 9, DUST_N), vy=_dr.uniform(-14, -2, DUST_N),
            d=_dr.uniform(0.2, 1.0, DUST_N), a=_dr.uniform(0.12, 0.5, DUST_N), ph=_dr.uniform(0, 6.28, DUST_N))

# ----------------------------------------------------------------- numpy drawing helpers
_YY, _XX = np.mgrid[0:H, 0:W]
_rr = np.hypot(_XX - CX, _YY - CY).astype(np.float32)
HAZE = np.exp(-(_rr / 700.0) ** 2).astype(np.float32)
VIGN = (1 - 0.55 * np.clip(np.hypot((_XX - W / 2) / (W / 2), (_YY - H / 2) / (H / 2)) / 1.25, 0, 1) ** 2.2).astype(np.float32)[..., None]
del _YY, _XX, _rr

def add_disc(F, cx, cy, r, col, a=1.0, hot=0.0):
    if r < 0.3 or a <= 0: return
    x0, x1, y0, y1 = int(max(cx - r - 3, 0)), int(min(cx + r + 4, W)), int(max(cy - r - 3, 0)), int(min(cy + r + 4, H))
    if x1 <= x0 or y1 <= y0: return
    d = np.hypot(np.arange(x0, x1)[None, :] - cx, np.arange(y0, y1)[:, None] - cy)
    al = np.clip(r - d + 0.5, 0, 1) * a
    c = col[None, None, :] * (1 + hot * np.clip(1 - d / r, 0, 1))[..., None]
    F[y0:y1, x0:x1] += al[..., None] * c
def add_ring(F, cx, cy, r, w, col, a=1.0):
    if a <= 0 or w <= 0: return
    R = r + w + 4; x0, x1, y0, y1 = int(max(cx - R, 0)), int(min(cx + R, W)), int(max(cy - R, 0)), int(min(cy + R, H))
    if x1 <= x0 or y1 <= y0: return
    d = np.hypot(np.arange(x0, x1)[None, :] - cx, np.arange(y0, y1)[:, None] - cy)
    al = np.clip(w / 2 - np.abs(d - r) + 0.5, 0, 1) * a
    F[y0:y1, x0:x1] += al[..., None] * col[None, None, :]
def add_glow(F, cx, cy, rad, col, amp):
    if amp <= 0.003: return
    R = rad * 2.6; x0, x1, y0, y1 = int(max(cx - R, 0)), int(min(cx + R, W)), int(max(cy - R, 0)), int(min(cy + R, H))
    if x1 <= x0 or y1 <= y0: return
    d2 = (np.arange(x0, x1)[None, :] - cx) ** 2 + (np.arange(y0, y1)[:, None] - cy) ** 2
    F[y0:y1, x0:x1] += (amp * np.exp(-d2 / rad ** 2))[..., None] * col[None, None, :]
def add_flare(F, cx, cy, amp, length, col, thick=3.2):
    if amp <= 0.01: return
    y0, y1, x0, x1 = int(max(cy - 40, 0)), int(min(cy + 40, H)), int(max(cx - length, 0)), int(min(cx + length, W))
    if x1 <= x0 or y1 <= y0: return
    yy = np.arange(y0, y1)[:, None] - cy; xx = np.arange(x0, x1)[None, :] - cx
    a = amp * np.exp(-(yy / thick) ** 2) * np.exp(-np.abs(xx) / (length * 0.27))
    F[y0:y1, x0:x1] += a[..., None] * np.asarray(col, np.float32)[None, None, :]
def splat(F, xs, ys, ws, cols):
    x = np.concatenate(xs); y = np.concatenate(ys); w = np.concatenate(ws); c = np.concatenate(cols)
    m = (x >= 0) & (x < W - 1) & (y >= 0) & (y < H - 1) & (w > 1e-3)
    x, y, w, c = x[m], y[m], w[m], c[m]
    if len(x) == 0: return
    x0 = np.floor(x).astype(np.int64); y0 = np.floor(y).astype(np.int64); fx = x - x0; fy = y - y0
    ids = np.concatenate([y0 * W + x0, y0 * W + x0 + 1, (y0 + 1) * W + x0, (y0 + 1) * W + x0 + 1])
    wt = np.concatenate([(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy]) * np.tile(w, 4)
    buf = np.empty((H, W, 3), np.float32)
    for ch in range(3):
        buf[..., ch] = np.bincount(ids, weights=wt * np.tile(c[:, ch], 4), minlength=H * W).reshape(H, W)
    F += cv2.GaussianBlur(buf, (0, 0), 0.85) * 2.2

# ----------------------------------------------------------------- emblem (supersampled strokes)
def draw_emblem(t, z, sx, sy, r_un):
    big = Image.new('RGBA', (CROP * SS, CROP * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(big)
    def P(wx, wy): return ((((wx - CX) * z + CX + sx) - CROP_X0) * SS, (((wy - CY) * z + CY + sy) - CROP_Y0) * SS)
    def L(x, y): return P(CX + x * S, CY + y * S)
    def stroke(pts, width, color, alpha=1.0):
        if len(pts) < 2 or alpha <= 0: return
        fill = tuple(color) + (int(255 * min(alpha, 1)),); w = max(1, int(width * z * SS))
        d.line(pts, fill=fill, width=w, joint='curve')
        for p in (pts[0], pts[-1]): d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=fill)
    def ring(r, width, color, alpha, a0=0, a1=360):
        n = max(24, int((a1 - a0) / 1.5))
        stroke([L(r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)], width, color, alpha)
    for k, dt0 in enumerate((0.0, 0.12, 0.26)):                         # ignition shockwaves
        u = seg(t, T_IGNITE + dt0, T_IGNITE + dt0 + 1.1)
        if 0 < u < 1: ring(R_CORE + (232 - R_CORE) * ease_out_cubic(u), 1.2 + 4 * (1 - u), (150, 195, 255), 0.85 * (1 - u) ** 1.8 * (1 - 0.25 * k))
    for i, (st, rT, wd) in enumerate(((T_RING[0], R_IN, 6.5), (T_RING[1], R_ARC, 5.5), (T_RING[2], R_OUT, 7.5))):
        u = ease_out_cubic(seg(t, st, st + 1.1))
        if u <= 0: continue
        r = R_CORE + (rT - R_CORE) * u; a = min(1, u * 3)
        if i == 1:
            for k in range(6):
                c = k * 60 - 60 * (1 - ease_out_cubic(seg(t, st, st + 1.5)))
                ring(r, wd, BLUE_RGB, a * 0.92, c - 20, c + 20)
        else: ring(r, wd, BLUE_RGB, a)
    for st in (T_RING[0] - 0.05, T_RING[1] - 0.05):                      # faint travelling ripples
        u = seg(t, st, st + 1.2)
        if 0 < u < 1: ring(R_CORE + (R_OUT + 25 - R_CORE) * ease_out_cubic(u), 2.5, BLUE_RGB, 0.5 * (1 - u))
    heads = []
    for k in range(6):
        st = T_PET0 + PET_STEP * k; u = sstep(seg(t, st, st + PET_DUR))
        if u <= 0: continue
        rot = (1 - ease_out_cubic(seg(t, st - 0.1, st + PET_DUR + 0.3))) * math.radians(-40)
        for h in (0, 1):
            pw = petal_world(k, h, u, rot); stroke([P(x, y) for x, y in pw], 7.5, (250, 250, 250), min(1, u * 4))
            if u < 0.999: heads.append(((pw[-1][0] - CX) * z + CX + sx, (pw[-1][1] - CY) * z + CY + sy))
    arr = np.asarray(big); a = arr[..., 3].astype(np.float32) / 255
    if r_un > 0:                                                         # unravel erosion sweeping left -> right
        fxw = SRC_XS[min(int(r_un * N), N - 1)]; fx = (fxw - CX) * z + CX + sx
        xs = CROP_X0 + (np.arange(CROP * SS) + 0.5) / SS
        a *= np.clip((xs - fx) / 16 + 0.5, 0, 1)[None, :]
    rgb = (arr[..., :3].astype(np.float32) / 255) * a[..., None]
    return cv2.resize(rgb, (CROP, CROP), interpolation=cv2.INTER_AREA), heads

# ----------------------------------------------------------------- core state
def core_state(t):
    """returns x, y, radius(px), alpha, hot"""
    if t < T_SPARK: return CX, CY, 0, 0, 0
    if t < T_IGNITE:
        sp = seg(t, T_SPARK, T_IGNITE); fl = 0.55 + 0.45 * math.sin(t * 83) * math.sin(t * 41 + 1)
        return CX, CY, 1.5 + 4 * sp, (0.25 + 0.75 * sp) * max(fl, 0.1), 1.2
    cs = ease_out_back(seg(t, T_IGNITE, T_IGNITE + 0.7)); dt = max(0, t - (T_IGNITE + 0.7))
    pulse = 1 + 0.08 * math.sin(dt * 5.0) * math.exp(-dt * 0.8)
    r0 = R_CORE * S * cs * pulse * cam(t)[0]
    rf = 0.5 * (RO - 17)
    if t < T_FLY: return CX + cam(t)[1], CY + cam(t)[2], r0, 1.0, 0.7
    u = sstep(seg(t, T_FLY, T_LAND)); p0 = (CX, CY); p1 = (CX + 140, CY - 400); p2 = (OX, OY)
    x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0]; y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]
    r = (R_CORE * S * pulse) * (1 - u) + rf * u
    if t >= T_LAND: dtl = t - T_LAND; r *= 1 + 0.22 * math.exp(-dtl / 0.22) * math.cos(dtl * 22)
    return x, y, r, 1.0, 0.7

def ring_prog(t):
    return ease_out_cubic(seg(t, T_LAND, T_LAND + 0.55))

# ----------------------------------------------------------------- frame
def render(t):
    z, sx, sy = cam(t)
    F = np.zeros((H, W, 3), np.float32)
    F += HAZE[..., None] * (np.array([0.0, 0.05, 0.17], np.float32) * (0.9 * sstep(seg(t, 1.3, 3.6)) * (1 - 0.3 * sstep(seg(t, 5, 7)))))
    r_un = (t - T_UN) / UN_SPAN
    heads = []
    if t >= T_RING[0] - 0.05 or (T_IGNITE <= t):
        if r_un < 1.03:
            emb, heads = draw_emblem(t, z, sx, sy, r_un)
            F[CROP_Y0:CROP_Y0 + CROP, CROP_X0:CROP_X0 + CROP] += emb
    # wordmark band (letters ignite as the particle wave arrives)
    r_t = (t - T_UN - 0.97) / UN_SPAN
    if r_t > 0:
        fx = W + 200.0 if r_t >= 1 else float(TGT_XS[int(r_t * N)])
        xs = np.arange(W, dtype=np.float32); acol = np.clip((fx - xs) / 36 + 0.5, 0, 1)
        band = 1.9 * np.exp(-((xs - (fx - 30)) / 150.0) ** 2) if r_t < 1.2 else 0 * xs
        fl = math.exp(-(t - T_IMPACT) / 0.3) if t >= T_IMPACT else 0.0
        val = TEXT_BAND[..., None] * (acol * (0.97 + band + 1.0 * fl))[None, :, None] * np.array([0.97, 0.98, 1.0], np.float32)
        if t > 5.7 and (sx or sy):
            val = cv2.warpAffine(val, np.float32([[1, 0, sx], [0, 1, sy]]), (W, TB1 - TB0))
        F[TB0:TB1] += val
    # underline
    if t >= T_UL0:
        u = sstep(seg(t, T_UL0, T_UL1)); hw = u * (TEXT_W / 2 + 20)
        xs = np.arange(W, dtype=np.float32) - W / 2; prof = np.clip(1 - (np.abs(xs) / max(hw, 1)) ** 3, 0, 1) * (np.abs(xs) < hw)
        c = np.exp(-(xs / 140.0) ** 2) * 0.85
        colr = BLUE_H[None, :] * 1.5 * (1 - c[:, None]) + c[:, None]
        for dy, wv in ((-1, .45), (0, 1.0), (1, .45)): F[UL_Y + dy] += (prof * wv)[:, None] * colr
    # tagline phrases
    for i in range(3):
        a = ease_out_cubic(seg(t, T_TAG[i], T_TAG[i] + 0.85))
        if a <= 0: continue
        m = TAG_L[i] * a + TAG_B[i] * ((1 - a) ** 1.5) * a * 1.2
        dy = int(round(14 * (1 - a))); m = np.roll(m, dy, axis=0)
        boost = 1 + (0.9 * math.exp(-(t - T_TAG[2] - 0.5) / 0.4) if i == 2 and t > T_TAG[2] + 0.5 else 0)
        F[TAG0:TAG1] += m[..., None] * TAG_COL[i][None, None, :] * boost
    # O of CORE: rings ripple out of the landing core
    if t >= T_LAND:
        u = ring_prog(t); th = 4 + 13 * u; ro = 0.5 * RO * 0.6 * (1 - u) + (RO - th / 2) * u
        add_ring(F, OX, OY, ro, th, BLUE_H * 1.5, 1.0)
        for k, dt0 in enumerate((0, 0.16)):
            uu = seg(t, T_LAND + dt0, T_LAND + dt0 + 1.0)
            if 0 < uu < 1: add_ring(F, OX, OY, RO * (0.6 + 2.2 * ease_out_cubic(uu)), 3, np.array([0.55, 0.75, 1.0], np.float32), 0.7 * (1 - uu) ** 1.6)
    # core + trail + glow
    cx, cy, cr, ca, hot = core_state(t)
    if T_FLY < t < T_LAND + 0.05:
        for j in range(1, 13):
            x2, y2, r2, _, _ = core_state(t - 0.022 * j)
            add_disc(F, x2, y2, r2 * (1 - j / 14), ORANGE_H * 0.9, 0.6 * (1 - j / 13) ** 1.5)
    add_disc(F, cx, cy, cr, ORANGE_H, ca, 0.12 * hot)
    add_glow(F, cx, cy, max(cr * 2.2, 6), ORANGE_H, 0.26 * ca)
    if T_IGNITE <= t < T_IGNITE + 1.6: add_glow(F, CX, CY, 280, np.array([1.0, 0.55, 0.15], np.float32), 0.5 * math.exp(-(t - T_IGNITE) / 0.28))
    # flares
    if T_SPARK + 0.2 < t < T_IGNITE: add_flare(F, CX, CY, 0.5 * seg(t, 1.0, 1.3) * (0.6 + 0.4 * math.sin(t * 61)), 500, (0.4, 0.55, 1.0))
    if t >= T_IGNITE: add_flare(F, CX, CY, 1.5 * math.exp(-(t - T_IGNITE) / 0.45), 760, (0.35, 0.55, 1.0))
    if t >= T_COMPLETE and t < T_COMPLETE + 1.5: add_flare(F, CX, CY, 0.8 * math.exp(-(t - T_COMPLETE) / 0.4), 950, (0.6, 0.75, 1.0))
    if t >= T_LAND and t < T_LAND + 1.5: add_flare(F, OX, OY, 1.1 * math.exp(-(t - T_LAND) / 0.4), 520, (0.75, 0.75, 1.0))
    if t >= T_IMPACT and t < T_IMPACT + 2: add_flare(F, W / 2, TEXT_BASE - 55, 1.3 * math.exp(-(t - T_IMPACT) / 0.5), 1150, (0.7, 0.8, 1.0), 4)
    if t >= T_TAG[2] and t < T_TAG[2] + 1.5: add_flare(F, W / 2, TAG_BASE - 14, 0.6 * math.exp(-(t - T_TAG[2]) / 0.4), 700, (0.8, 0.85, 1.0), 2.5)
    # additive emitters: dust, embers, comet, petal heads, particles
    X, Y, Wt, C = [], [], [], []
    def em(x, y, w, c):
        X.append(np.asarray(x, np.float64)); Y.append(np.asarray(y, np.float64)); Wt.append(np.asarray(w, np.float32))
        C.append(np.broadcast_to(np.asarray(c, np.float32), (len(X[-1]), 3)))
    fade = sstep(seg(t, 0.3, 1.5)); tw = 0.6 + 0.4 * np.sin(t * 2 + DUST['ph'])
    dx = (DUST['x'] + DUST['vx'] * t) % W; dy = (DUST['y'] + DUST['vy'] * t) % H
    par = 1 + (z - 1) * DUST['d'] * 2
    em((dx - CX) * par + CX + sx * DUST['d'], (dy - CY) * par + CY + sy * DUST['d'], DUST['a'] * tw * fade * 0.55, (0.6, 0.7, 1.0))
    for b, t0, ox, oy in ((B_IGN, T_IGNITE, CX, CY), (B_LAND, T_LAND, OX, OY), (B_IMP, T_IMPACT, OX, TEXT_BASE - 55)):
        r = burst_em(b, t, t0, ox, oy)
        if r: em(*r)
    for (hx, hy) in heads: em([hx], [hy], [5.0], (1, 1, 1))
    if T_COMET0 < t < T_COMET1:
        th = math.radians(-90) + math.radians(360 * 1.25) * sstep(seg(t, T_COMET0, T_COMET1)); amp = math.sin(math.pi * seg(t, T_COMET0, T_COMET1)) ** 0.7
        a = th - np.linspace(math.radians(75), 0, 70); wts = (np.linspace(0, 1, 70) ** 3) * 1.4 * amp; wts[-1] = 6 * amp
        cxw = CX + R_OUT * S * np.cos(a); cyw = CY + R_OUT * S * np.sin(a)
        em((cxw - CX) * z + CX + sx, (cyw - CY) * z + CY + sy, wts, (0.55, 0.8, 1.0))
    if t >= T_UN - 0.01:
        for dtm, wm in ((0, 1.0), (0.035, 0.5), (0.07, 0.25)):
            x, y, w, col, fl = pcl_state(t - dtm)
            w = w * (wm if dtm == 0 else fl * (0.7 if dtm < 0.05 else 0.42))
            em((x - CX) * z + CX + sx, (y - CY) * z + CY + sy, w * 2.3, col)
    splat(F, X, Y, Wt, C)
    # post: bloom, chromatic aberration, vignette, fades
    gain = 0.65 + 0.6 * math.exp(-(t - T_IGNITE) / 0.4) * (t >= T_IGNITE) + 0.7 * math.exp(-(t - T_COMPLETE) / 0.35) * (t >= T_COMPLETE) \
        + 1.1 * math.exp(-(t - T_IMPACT) / 0.4) * (t >= T_IMPACT) + 0.4 * math.exp(-(t - T_LAND) / 0.3) * (t >= T_LAND)
    b = cv2.resize(np.maximum(F - 0.45, 0), (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    bl = 0.9 * cv2.GaussianBlur(b, (0, 0), 3) + 0.9 * cv2.GaussianBlur(b, (0, 0), 11) + 0.5 * cv2.GaussianBlur(b, (0, 0), 26)
    F += cv2.resize(bl, (W, H), interpolation=cv2.INTER_LINEAR) * gain
    ca = int(round(energy(t) * 4))
    if ca > 0: F[:, ca:, 0] = F[:, :-ca, 0].copy(); F[:, :-ca, 2] = F[:, ca:, 2].copy()
    F *= VIGN
    F *= min(1.0, t / 0.35) * min(1.0, max(0.0, (DUR - t) / 0.7))
    return (np.clip(F, 0, 1) * 255 + 0.5).astype(np.uint8)

# ================================================================= SOUND (procedural synthesis)
def build_audio(path):
    r = np.random.default_rng(7); n = int(DUR * SR)
    Lc, Rc, SEND = np.zeros(n), np.zeros(n), np.zeros(n)
    tt = lambda d: np.arange(int(d * SR)) / SR
    def put(sig, t0, gain=1.0, pan=0.0, send=0.3):
        i0 = int(t0 * SR)
        if i0 >= n or i0 < 0: return
        sig = sig[:n - i0]; pn = np.broadcast_to(np.asarray(pan, float), sig.shape) if np.ndim(pan) == 0 else np.interp(np.linspace(0, 1, len(sig)), np.linspace(0, 1, len(pan)), pan)
        a = (pn + 1) * math.pi / 4
        Lc[i0:i0 + len(sig)] += sig * np.cos(a) * gain; Rc[i0:i0 + len(sig)] += sig * np.sin(a) * gain; SEND[i0:i0 + len(sig)] += sig * gain * send
    def env(d, tau, att=0.003): t = tt(d); return np.minimum(t / att, 1) * np.exp(-t / tau)
    def bell(f, d, tau=0.9, idx=2.0, ratio=2.0):
        t = tt(d); return np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * f * ratio * t) * idx * np.exp(-t / (tau * 0.5))) * env(d, tau, 0.002)
    def boom(f0, f1, d, tf=0.12, ta=0.9):
        t = tt(d); f = f1 + (f0 - f1) * np.exp(-t / tf); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, ta, 0.004)
    def filt(x, kind, fc):
        return sosfilt(butter(2, fc, btype=kind, fs=SR, output='sos'), x)
    def nburst(d, tau, kind='low', fc=2000, att=0.002): return filt(r.standard_normal(int(d * SR)), kind, fc) * env(d, tau, att)
    def sweep(d, f0, f1, bw=0.5):
        N_ = int(d * SR); x = r.standard_normal(N_); out = np.zeros(N_); zi = None
        for b in range(0, N_, 512):
            fc = f0 * (f1 / f0) ** (b / N_); sos = butter(2, [max(fc * (1 - bw), 30), min(fc * (1 + bw), SR * 0.45)], btype='band', fs=SR, output='sos')
            if zi is None: zi = np.zeros((sos.shape[0], 2))
            y, zi = sosfilt(sos, x[b:b + 512], zi=zi); out[b:b + 512] = y
        return out / (np.std(out) + 1e-9) * 0.3
    def pad(freqs, d, att=0.25, tau=2.5):
        t = tt(d); out = np.zeros_like(t)
        for f in freqs:
            for dt_ in (-0.0015, 0.0015): out += (np.sin(2 * np.pi * f * (1 + dt_) * t) + 0.35 * np.sin(4 * np.pi * f * (1 + dt_) * t) + 0.12 * np.sin(6 * np.pi * f * t)) / 2
        return filt(out / len(freqs), 'low', 3200) * np.minimum(t / att, 1) * np.exp(-t / tau)
    # --- drone bed (additive), swells with the story
    t = tt(DUR); amp = np.interp(t, [0, 1.0, 1.3, 2, 4.1, 4.85, 6.9, 8, 12, 13], [0, .22, .4, .5, .8, .6, 1.0, .7, .55, 0])
    bri = np.interp(t, [0, 1.3, 4.1, 6.9, 13], [.35, .6, .85, .95, .6]); dr = np.zeros(n)
    for f, g in ((55, 1.0), (82.41, .45), (110.2, .5)):
        for h in range(1, 9): dr += np.sin(2 * np.pi * f * h * t) * (g / h) * bri ** (h - 1) * (1 + 0.04 * np.sin(t * 0.7 + h))
    put(dr * amp * 0.11, 0, 1, 0, 0.35)
    put(nburst(DUR, 1e9, 'low', 700, 1.0) * np.interp(t, [0, 1.5, 7, 13], [0.02, 0.05, .08, 0]) * 1.0, 0, 1, 0, 0.2)
    # --- spark crackles then riser into ignition
    for tc in np.sort(r.uniform(T_SPARK, T_IGNITE, 28) ** 1 * 0 + np.linspace(T_SPARK, T_IGNITE, 28) ** 1 + r.uniform(-0.02, 0.02, 28)):
        put(nburst(0.008, 0.002, 'high', r.uniform(2500, 7000)), tc, r.uniform(.04, .18) * (0.4 + (tc - T_SPARK)), r.uniform(-.6, .6), .5)
    rs = sweep(T_IGNITE - 0.6, 300, 7500, .6) * (np.linspace(0, 1, int((T_IGNITE - .6) * SR)) ** 2.5); put(rs, 0.6, 1.1, 0, .4)
    gl = np.sin(2 * np.pi * np.cumsum(110 * (8 ** np.linspace(0, 1, int(.7 * SR)))) / SR) * np.linspace(0, 1, int(.7 * SR)) ** 2; put(gl, 0.6, .12, 0, .4)
    # --- ignition impact
    put(boom(120, 36, 3.0, .13, 1.0), T_IGNITE, 1.0, 0, .35); put(nburst(1.2, .35, 'low', 1800), T_IGNITE, .6, 0, .6)
    for fm, g in zip((220, 607, 1188, 1958), (.5, .3, .2, .12)): put(np.sin(2 * np.pi * fm * tt(2) + 0) * env(2, .7), T_IGNITE, g * .22, 0, .7)
    put(nburst(1.5, .5, 'high', 5500), T_IGNITE, .25, 0, .7)
    # --- rings: sonar pings
    for tr, f, p in zip(T_RING, (659.25, 880, 1318.5), (-.35, 0, .35)):
        put(bell(f, 2.5, .8, 2.2), tr, .22, p, .6); put(bell(f, 2.5, .8, 2.2), tr + .26, .09, -p, .6)
    # --- petals: stroke whoosh -> pluck on lock (A minor pentatonic arpeggio)
    notes = (440, 523.25, 587.33, 659.25, 783.99, 880)
    for k in range(6):
        ts = T_PET0 + PET_STEP * k; pan = .8 * math.cos(math.radians(90 - 60 * k)) if k % 3 else (-.2 if k else .2)
        put(sweep(PET_DUR, 700, 4800, .45) * np.linspace(.2, 1, int(PET_DUR * SR)) ** 1.5, ts, .22, np.linspace(pan * .5, pan, 50), .35)
        put(bell(notes[k], 2.0, .9, 2.0), ts + PET_DUR, .20, pan, .6); put(bell(notes[k] / 2, 1.5, .6, 1.2), ts + PET_DUR, .08, pan, .5)
    # --- comet lap + complete bloom
    cd = T_COMET1 - T_COMET0; put(sweep(cd, 500, 3200, .4) * np.hanning(int(cd * SR) * 2)[:int(cd * SR)] ** .8, T_COMET0, .5, np.linspace(-.8, .8, 40), .4)
    gl2 = np.sin(2 * np.pi * np.cumsum(220 * (4 ** np.linspace(0, 1, int(1.0 * SR)))) / SR) * np.linspace(0, 1, int(SR)) ** 2; put(gl2, T_COMPLETE - 0.6, .1, 0, .5)
    put(pad([110, 220, 261.63, 329.63, 493.88, 659.25], 5.0, .3, 2.2), T_COMPLETE, .30, 0, .5)
    put(boom(80, 40, 2.5, .1, .8), T_COMPLETE, .6, 0, .3); put(nburst(1.6, .5, 'high', 5000), T_COMPLETE, .16, 0, .7)
    # --- reverse swell then the hard cut into the unravel
    put(nburst(.45, 1e9, 'high', 3000, .001) * np.linspace(0, 1, int(.45 * SR)) ** 3, T_UN - .45, .45, 0, .3)
    # --- UNRAVEL whoosh (L->R), granular shimmer per particle arrival, letters sing
    ud = 1.9; put(sweep(ud, 140, 7500, .55) * np.sin(np.linspace(0, np.pi, int(ud * SR))) ** .8, T_UN, .75, np.linspace(-.85, .85, 60), .45)
    put(boom(70, 45, 2.5, .3, 1.2) * np.sin(np.linspace(0, np.pi, int(2.5 * SR))) ** 1.5, T_UN, .35, 0, .3)
    scale = np.array([440, 523.25, 587.33, 659.25, 783.99]); sc = np.concatenate([scale, scale * 2, scale * 4])
    xmin, xmax = TGT_XS[0], TGT_XS[-1]
    for i in r.choice(N, 170, replace=False):
        fr = (TGT[i, 0] - xmin) / (xmax - xmin); f = sc[min(int(fr * (len(sc) - 1) + r.integers(0, 2)), len(sc) - 1)]
        put(bell(f, .6, .22, 1.2, 3.0), TARR[i], r.uniform(.02, .06), (TGT[i, 0] - W / 2) / (W / 2) * .85, .6)
    for i in r.choice(N, 60, replace=False):
        put(nburst(.02, .006, 'high', r.uniform(3000, 8000)), T_UN + DELAY[i], r.uniform(.03, .1), (SRC[i, 0] - W / 2) / (W / 2) * .8, .3)
    # --- core flight and landing in the O
    fd = T_LAND - T_FLY; ff = 260 * (4.5 ** sstep_arr(np.linspace(0, 1, int(fd * SR))))
    put(np.sin(2 * np.pi * np.cumsum(ff) / SR + 2 * np.sin(2 * np.pi * 6 * tt(fd)[:len(ff)])) * np.sin(np.linspace(0, np.pi, len(ff))) ** 1.2, T_FLY, .12, np.linspace(-.1, .45, 60), .6)
    put(boom(150, 55, 2.5, .09, .8), T_LAND, .55, .35, .4); put(bell(220, 3.5, 1.6, 2.0), T_LAND, .24, .35, .7)
    for k, f in enumerate((1318.5, 1760, 2637)): put(bell(f, 1.8, .6, 1.5), T_LAND + .1 + .12 * k, .1, .35 + .1 * k, .7)
    # --- wordmark impact
    put(nburst(1.3, .45, 'high', 4200), T_IMPACT - .5, 0, 0, 0)
    put(sweep(.75, 2500, 9500, .5) * np.sin(np.linspace(0, np.pi, int(.75 * SR))) ** 1.5, T_IMPACT - .45, .35, np.linspace(-.7, .7, 40), .4)
    put(boom(90, 32, 4.0, .16, 1.4), T_IMPACT, 1.1, 0, .35); put(nburst(1.6, .4, 'low', 3500), T_IMPACT, .65, 0, .6)
    for fm, g in zip((110, 303, 594, 979, 1470), (.6, .4, .3, .2, .12)): put(np.sin(2 * np.pi * fm * tt(3)) * env(3, 1.1), T_IMPACT, g * .18, 0, .7)
    put(pad([110, 164.81, 220, 261.63, 329.63, 493.88, 587.33], 6.0, .12, 3.0), T_IMPACT, .36, 0, .55)
    for k in range(9): put(bell(440 * 2 ** (k * 2 / 5 if k < 5 else k * 2 / 5), 1.5, .5, 1.2), T_IMPACT + .04 * k, .06, -.8 + .2 * k, .7)
    # --- underline whisper, tagline cadence
    put(np.sin(2 * np.pi * np.cumsum(880 * 2 ** np.linspace(0, 1, int(.7 * SR))) / SR) * np.sin(np.linspace(0, np.pi, int(.7 * SR))) ** 2, T_UL0, .05, 0, .7)
    for i, (f, g) in enumerate(((659.25, .13), (783.99, .15), (880, .2))):
        put(nburst(.03, .008, 'band', [3000, 6000]) if False else nburst(.03, .008, 'high', 4000), T_TAG[i], .12, 0, .4)
        put(sweep(.55, 900, 6000, .5) * np.sin(np.linspace(0, np.pi, int(.55 * SR))), T_TAG[i] - .1, .12, 0, .4)
        put(bell(f, 3.0, 1.1, 1.6), T_TAG[i], g, (-.25, 0, .25)[i], .7)
    put(pad([110, 220, 329.63, 440, 659.25], 4.5, .1, 2.2), T_TAG[2], .30, 0, .55); put(boom(70, 41, 3.5, .15, 1.3), T_TAG[2], .7, 0, .3)
    put(bell(1760, 3.0, 1.0, 1.2), T_TAG[2] + .12, .07, .3, .8)
    # --- reverb (synthetic stereo impulse response)
    ir_t = tt(3.4); wets = []
    for _ in range(2):
        ir = r.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.8) * (1 - np.exp(-ir_t / 0.025)); ir = filt(ir, 'low', 5500); ir[:int(.018 * SR)] = 0
        wets.append(fftconvolve(SEND, ir / np.sqrt(np.sum(ir ** 2)))[:n])
    Lc += wets[0] * .30; Rc += wets[1] * .30
    # --- master: dips, filter, limiter, fades
    tm = tt(DUR)
    duck = 1 - .72 * np.exp(-((tm - T_UN - .03) / .045) ** 2) - .75 * np.exp(-((tm - (T_IMPACT - .035)) / .035) ** 2)
    out = np.stack([Lc, Rc]) * duck
    out = np.stack([sosfilt(butter(2, 28, 'high', fs=SR, output='sos'), c) for c in out])
    out = np.tanh(1.5 * out) / np.tanh(1.5); out *= 0.89 / np.max(np.abs(out))
    out *= np.minimum(tm / .03, 1) * np.minimum((DUR - tm) / .8, 1)
    pcm = (out.T * 32767).astype('<i2')
    with wave.open(path, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def sstep_arr(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)

# ================================================================= driver
def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--preview':
        for s in sys.argv[2:]:
            Image.fromarray(render(float(s))).save(f'preview_{s}.png')
        return
    t0 = time.time(); build_audio(f'{OUT}.wav'); print(f'audio done {time.time() - t0:.1f}s', flush=True)
    if len(sys.argv) > 1 and sys.argv[1] == '--audio-only': return
    base = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-']
    mp4 = subprocess.Popen(base[:-1] + ['-i', f'{OUT}.wav' if False else '-'] if False else
                           base + ['-i', f'{OUT}.wav', '-vf', 'format=yuv420p,noise=alls=2:allf=t', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
                                   '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', f'{OUT}.mp4'], stdin=subprocess.PIPE)
    gif = subprocess.Popen(base + ['-vf', 'fps=15,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
                                   f'{OUT}.gif'], stdin=subprocess.PIPE)
    nf = int(DUR * FPS)
    for i in range(nf):
        b = render(i / FPS).tobytes(); mp4.stdin.write(b); gif.stdin.write(b)
        if i % 15 == 0: print(f'frame {i}/{nf}  {time.time() - t0:.0f}s', flush=True)
    for p in (mp4, gif): p.stdin.close(); p.wait()
    print('done', flush=True)

if __name__ == '__main__':
    main()
