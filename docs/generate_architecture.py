#!/usr/bin/env python3
"""
WintEHR Architecture Diagram — Publication-ready SVG generator.
Output: /tmp/wintehr_arch.svg
"""

W, H = 1400, 760

# ── Colour palette ────────────────────────────────────────────────────────────
BG       = '#FFFFFF'
SLATE    = '#334155'
MUTED    = '#64748B'
LIGHT    = '#94A3B8'
BORDER   = '#CBD5E1'
SURF     = '#F8FAFC'

# Layer/component accent colours
COL_EXT  = ('#F1F5F9', '#94A3B8')          # bg, border
COL_NGX  = ('#1E3A8A', '#3B82F6')          # fill, accent
COL_PRS  = ('#F0FDF4', '#16A34A')
COL_API  = ('#FFFBEB', '#D97706')
COL_HAP  = ('#FFF7ED', '#EA580C')
COL_PG   = ('#EFF6FF', '#2563EB')
COL_RDS  = ('#FFF1F2', '#E11D48')
COL_SYN  = ('#FAF5FF', '#7C3AED')

# ── SVG helpers ───────────────────────────────────────────────────────────────
parts = []
def emit(s): parts.append(s)

def R(x, y, w, h, fill, stroke, sw=1.2, rx=7, extra=''):
    emit(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
         f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{extra}/>')

def T(x, y, s, sz=10.5, w='normal', fill=SLATE, anchor='start', cls=''):
    cls_s = f' class="{cls}"' if cls else ''
    emit(f'<text x="{x}" y="{y}" font-size="{sz}" font-weight="{w}" '
         f'fill="{fill}" text-anchor="{anchor}"{cls_s}>{s}</text>')

def PILL(cx, cy, label, bg='#F1F5F9', fg=MUTED, border='#CBD5E1'):
    pw = len(label) * 5.4 + 14
    emit(f'<rect x="{cx - pw/2}" y="{cy - 9}" width="{pw}" height="16" '
         f'rx="5" fill="{bg}" stroke="{border}" stroke-width="0.8"/>')
    T(cx, cy + 4, label, sz=8.5, fill=fg, anchor='middle')

def LAYER_LABEL(x, y, s):
    T(x, y, s.upper(), sz=8, w='600', fill=LIGHT)

def BOX(x, y, w, h, col, title, bullets=(), footnote=''):
    """Coloured-header component box."""
    bg, accent = col
    R(x, y, w, h, bg, accent, sw=1.5, rx=8,
      extra=' filter="url(#sh)"')
    # Header strip
    emit(f'<rect x="{x}" y="{y}" width="{w}" height="28" rx="8" fill="{accent}"/>')
    emit(f'<rect x="{x}" y="{y+14}" width="{w}" height="14" rx="0" fill="{accent}"/>')
    T(x + w//2, y + 18, title, sz=10.5, w='700', fill='#FFFFFF', anchor='middle')
    # Bullets
    for i, b in enumerate(bullets):
        by = y + 42 + i * 16
        emit(f'<circle cx="{x+14}" cy="{by-4}" r="2" fill="{accent}"/>')
        T(x + 23, by, b, sz=9.5, fill=SLATE)
    # Footnote
    if footnote:
        T(x + w//2, y + h - 10, footnote, sz=8, fill=LIGHT, anchor='middle')

def ARROW(x1, y1, x2, y2, color=None, dashed=False, marker='ah', sw=1.6):
    color = color or MUTED
    dash = ' stroke-dasharray="6,3"' if dashed else ''
    emit(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" '
         f'stroke-width="{sw}"{dash} marker-end="url(#{marker})"/>')

def POLY(pts, color=None, dashed=False, marker='ah', sw=1.6):
    color = color or MUTED
    dash = ' stroke-dasharray="6,3"' if dashed else ''
    pt_s = ' '.join(f'{x},{y}' for x, y in pts)
    emit(f'<polyline points="{pt_s}" stroke="{color}" stroke-width="{sw}" '
         f'fill="none"{dash} marker-end="url(#{marker})"/>')

def ACTOR(cx, cy, r, color, letter, label1, label2=''):
    """Circular actor node (external environment)."""
    emit(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="white" '
         f'stroke="{color}" stroke-width="2"/>')
    T(cx, cy + 5, letter, sz=13, w='700', fill=color, anchor='middle')
    T(cx, cy + r + 14, label1, sz=9.5, w='600', fill=SLATE, anchor='middle')
    if label2:
        T(cx, cy + r + 26, label2, sz=8.5, fill=MUTED, anchor='middle')

# ── Layout constants ──────────────────────────────────────────────────────────
MX, MW   = 22, 970          # Main panel x, width
SX, SW   = 1012, 368        # Side panel x, width

EY, EH   = 22, 126          # External row
NY, NH   = 166, 62          # NGINX row
AY, AH   = 250, 275         # App layer row
PY, PH   = 548, 155         # Persistence row

# App layer sub-columns
PRW  = 200                              # Presentation width
FAX  = MX + PRW + 14                   # FastAPI x
FAW  = 330                             # FastAPI width
HX   = FAX + FAW + 14                  # HAPI x
HW   = MW - PRW - FAW - 28             # HAPI width  (≈ 380)

PGW  = 670                             # PostgreSQL width
RDX  = MX + PGW + 14                   # Redis x
RDW  = MW - PGW - 14                   # Redis width

SY, SH   = EY, PY + PH - EY   # side panel Y start / height
SYN_Y  = SY + 32
SYN_H  = 100
PIP_Y  = SYN_Y + SYN_H + 50
PIP_H  = 110

# ── SVG OPEN ─────────────────────────────────────────────────────────────────
emit(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs>
  <style>
    * {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif; }}
  </style>
  <filter id="sh" x="-4%" y="-4%" width="108%" height="108%">
    <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.06"/>
  </filter>
  <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5"
          markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M0 1.5 L8.5 5 L0 8.5z" fill="{MUTED}"/>
  </marker>
  <marker id="ah-d" viewBox="0 0 10 10" refX="8" refY="5"
          markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M0 1.5 L8.5 5 L0 8.5z" fill="{BORDER}"/>
  </marker>
  <marker id="ah-p" viewBox="0 0 10 10" refX="8" refY="5"
          markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M0 1.5 L8.5 5 L0 8.5z" fill="#7C3AED"/>
  </marker>
</defs>
''')

# Background
emit(f'<rect width="{W}" height="{H}" fill="{BG}"/>')

# Figure title
T(W//2, 14, 'WintEHR — System Architecture', sz=12, w='600', fill=MUTED, anchor='middle')

# ── EXTERNAL ENVIRONMENT ─────────────────────────────────────────────────────
R(MX, EY, MW, EH, COL_EXT[0], COL_EXT[1], sw=1, rx=9,
  extra=' stroke-dasharray="6,3"')
LAYER_LABEL(MX + 9, EY + 12, 'External Environment')

ACTOR(150,  EY + 55, 26, '#475569', 'B', 'Learners &amp; Clinicians', 'Web Browser')
ACTOR(MX + MW - 155, EY + 55, 26, '#475569', 'S', 'SMART on FHIR Apps', 'External Clients')

# ── NGINX ────────────────────────────────────────────────────────────────────
R(MX, NY, MW, NH, COL_NGX[0], COL_NGX[0], rx=8,
  extra=' filter="url(#sh)"')
LAYER_LABEL(MX + 10, NY + 11, 'Reverse Proxy Layer')
T(MX + MW//2, NY + 30, 'NGINX Proxy', sz=12, w='700', fill='#FFFFFF', anchor='middle')
T(MX + MW//2, NY + 47, "Routing  ·  Let's Encrypt TLS  ·  certbot",
  sz=9, fill='#BFDBFE', anchor='middle')

# Route pills on NGINX bottom edge
def ROUTE(cx, label):
    pw = len(label)*5.3 + 14
    emit(f'<rect x="{cx-pw/2}" y="{NY+NH-2}" width="{pw}" height="16" '
         f'rx="4" fill="{COL_NGX[0]}" stroke="#BFDBFE" stroke-width="0.8"/>')
    T(cx, NY+NH+10, label, sz=8, fill='#BFDBFE', anchor='middle', w='600')

ROUTE(MX + PRW//2,                "route: '/'")
ROUTE(FAX + FAW//2,               "route: '/api'  '/ws'")
ROUTE(HX + HW//2,                 "route: '/fhir'")

# ── APPLICATION LAYER ────────────────────────────────────────────────────────
R(MX, AY, MW, AH, '#FAFAF9', '#E2E8E0', rx=9)
LAYER_LABEL(MX + 9, AY + 11, 'Application / Integration Layer')

# Presentation sub-section
R(MX, AY, PRW, AH, COL_PRS[0], COL_PRS[1], rx=9)
LAYER_LABEL(MX + 8, AY + 11, 'Presentation')

# React Frontend
BOX(MX + 6, AY + 16, PRW - 12, AH - 23, (BG, COL_PRS[1]),
    'React Frontend (SPA)',
    ('Clinical Workspace', 'DICOM Viewer', 'FHIR Explorer',
     'CDS Studio', 'Pharmacy Module'),
    footnote='MUI v5  ·  React 18  ·  TS')

# FastAPI Backend
BOX(FAX, AY + 14, FAW, AH - 21, (BG, COL_API[1]),
    'FastAPI Backend',
    ('Clinical Workflows', 'WebSocket Manager (in-process)',
     'CDS Hooks Services', 'Auth / SMART Auth',
     'DICOM API', 'Provider Directory'),
    footnote='Python 3.9  ·  async SQLAlchemy')

# HAPI FHIR
BOX(HX, AY + 14, HW, AH - 21, (BG, COL_HAP[1]),
    'HAPI FHIR  (v8.6.0-1)',
    ('FHIR R4 REST API', 'Resource Validation',
     'ClinicalReasoning / PlanDefinition'),
    footnote='Spring Boot  ·  JPA  ·  JDBC')

# ── PERSISTENCE LAYER ────────────────────────────────────────────────────────
R(MX, PY, MW, PH, '#F9FAFB', '#D1D5DB', rx=9)
LAYER_LABEL(MX + 9, PY + 11, 'Persistence Layer')

# PostgreSQL — two-column schema layout
BOX(MX + 4, PY + 17, PGW - 4, PH - 20, (COL_PG[0], COL_PG[1]),
    'PostgreSQL 15')
# Left column schemas
schemas_L = [('hfj_*',            'HAPI JPA schema — FHIR resources'),
             ('auth',             'users, sessions, roles'),
             ('cds_hooks',        'CDS service config')]
schemas_R = [('cds_visual_builder', 'CDS Studio rule state'),
             ('smart_auth',        'SMART authorization'),
             ('audit',             'audit log')]
LCX = MX + 16
RCX = MX + 16 + (PGW - 4)//2 + 8
for i, (sch, desc) in enumerate(schemas_L):
    oy = PY + 53 + i*30
    T(LCX, oy,    sch,  sz=9,   w='700', fill=COL_PG[1])
    T(LCX, oy+13, desc, sz=8.5, fill=MUTED)
for i, (sch, desc) in enumerate(schemas_R):
    oy = PY + 53 + i*30
    T(RCX, oy,    sch,  sz=9,   w='700', fill=COL_PG[1])
    T(RCX, oy+13, desc, sz=8.5, fill=MUTED)

# Redis
RX2, RY2, RW2, RH2 = RDX, PY + 17, RDW, PH - 20
BOX(RX2, RY2, RW2, RH2, (COL_RDS[0], COL_RDS[1]), 'Redis 7')
T(RX2 + RW2//2, RY2 + 52, 'Session token cache', sz=9.5, fill=COL_RDS[1], anchor='middle')
T(RX2 + RW2//2, RY2 + 68, '(limited active use)', sz=8.5, fill=MUTED, anchor='middle')
T(RX2 + RW2//2, RY2 + RH2 - 12, '256 MB  ·  allkeys-lru', sz=8, fill=LIGHT, anchor='middle')

# ── SYNTHEA SIDE PANEL ───────────────────────────────────────────────────────
SP_Y = SY + 22       # = 22 + 22 = 44... use EY
SP_Y = EY
SP_H = PY + PH - EY
R(SX, SP_Y, SW, SP_H, COL_SYN[0], COL_SYN[1], sw=1.2, rx=9,
  extra=' stroke-dasharray="5,3"')
LAYER_LABEL(SX + 10, SP_Y + 13, 'Synthetic Data Generation Pipeline')

SYBOX_Y = SP_Y + 30
BOX(SX + 12, SYBOX_Y, SW - 24, 105, (BG, COL_SYN[1]),
    'Synthea Engine',
    ('Synthetic patient generation',),
    footnote='Java  ·  v3.3.0')

PIP_Y2 = SYBOX_Y + 105 + 48
BOX(SX + 12, PIP_Y2, SW - 24, 110, (BG, '#A78BFA'),
    'Python Data Pipeline',
    ('FHIR Bundle generation', 'Synthetic DICOM creation'),
    footnote='deploy.sh  ·  scripts/')

# ── ARROWS ───────────────────────────────────────────────────────────────────

# Vertical midpoints
BR_CX   = 150
SM_CX   = MX + MW - 155
FA_MX   = FAX + FAW//2
H_MX    = HX + HW//2
PRS_MX  = MX + PRW//2
APP_MID = AY + AH//2
HAPI_RX = HX + HW          # right edge of HAPI box

# 1 & 2 — actors → NGINX
ARROW(BR_CX, EY+EH, BR_CX, NY-1)
PILL(BR_CX, (EY+EH+NY)//2, 'HTTPS')

ARROW(SM_CX, EY+EH, SM_CX, NY-1)
PILL(SM_CX, (EY+EH+NY)//2, 'HTTPS / REST')

# 3,4,5 — NGINX → layers (from route pills)
ARROW(PRS_MX, NY+NH+14, PRS_MX, AY+16)
ARROW(FA_MX,  NY+NH+14, FA_MX,  AY+14)
ARROW(H_MX,   NY+NH+14, H_MX,   AY+14)

# 6 — Frontend ↔ FastAPI (two parallel arrows)
F_RX  = MX + PRW - 6
FA_LX = FAX
ARROW(F_RX, APP_MID - 5, FA_LX - 3, APP_MID - 5)
ARROW(FA_LX - 3, APP_MID + 7, F_RX, APP_MID + 7)
PILL((F_RX + FA_LX)//2, APP_MID + 1, 'REST &amp; WebSockets',
     bg='#FFFBEB', fg=COL_API[1], border=COL_API[1])

# 7 — FastAPI ↔ HAPI (two parallel arrows)
FA_RX  = FAX + FAW
HAPI_LX = HX
MID2 = AY + 95
ARROW(FA_RX, MID2 - 5, HAPI_LX - 3, MID2 - 5)
ARROW(HAPI_LX - 3, MID2 + 7, FA_RX, MID2 + 7)
PILL((FA_RX + HAPI_LX)//2, MID2 + 1, 'FHIR API')

# 8 — Frontend → HAPI direct (via /fhir nginx route)
# Routed below the app layer through the persistence gap
FE_CX   = MX + (PRW//2)
BELOW_Y = PY - 16
POLY([(FE_CX, AY+AH), (FE_CX, BELOW_Y), (H_MX, BELOW_Y), (H_MX, AY+AH)])
PILL((FE_CX+H_MX)//2, BELOW_Y, 'FHIR API  (direct via nginx /fhir)',
     bg='#EFF6FF', fg=COL_PG[1], border=COL_PG[1])

# 9 — FastAPI → PostgreSQL
ARROW(FA_MX, AY+AH, FA_MX, PY+17)
PILL(FA_MX, (AY+AH+PY+17)//2, 'SQL / SQLAlchemy')

# 10 — HAPI → PostgreSQL
ARROW(H_MX, AY+AH, H_MX, PY+17)
PILL(H_MX, (AY+AH+PY+17)//2, 'JDBC / JPA')

# 11 — FastAPI → Redis (dashed)
RD_MX = RDX + RDW//2
ARROW_Y_R = PY + PH//2
POLY([(FA_MX + 50, AY+AH), (FA_MX+50, ARROW_Y_R), (RDX-3, ARROW_Y_R)],
     color=BORDER, dashed=True, marker='ah-d')
PILL((FA_MX+50+RDX)//2, ARROW_Y_R, 'session cache  (limited)',
     bg='#FFF1F2', fg=COL_RDS[1], border=COL_RDS[1])

# 12 — Synthea → Pipeline
SYN_BTM = SYBOX_Y + 105
SYBOX_CX = SX + SW//2
ARROW(SYBOX_CX, SYN_BTM, SYBOX_CX, PIP_Y2-2, color=COL_SYN[1])
PILL(SYBOX_CX, (SYN_BTM+PIP_Y2)//2, 'JSON Bundles',
     bg='#FAF5FF', fg=COL_SYN[1], border=COL_SYN[1])

# 13 — Pipeline → HAPI (Load Resources)
PIP_MY   = PIP_Y2 + 110//2
MID_GAP  = (HAPI_RX + SX) // 2
POLY([(SX+12, PIP_MY), (MID_GAP, PIP_MY), (MID_GAP, AY+130), (HAPI_RX+2, AY+130)],
     color=COL_SYN[1], marker='ah-p')
PILL(MID_GAP, (PIP_MY+AY+130)//2, 'Load Resources',
     bg='#FAF5FF', fg=COL_SYN[1], border=COL_SYN[1])

# ── LEGEND ───────────────────────────────────────────────────────────────────
LY = PIP_Y2 + 115 + 15
LX = SX + 10
LW = SW - 20
R(LX, LY, LW, 110, '#F9FAFB', '#E2E8F0', rx=7)
T(LX + 10, LY + 14, 'Key', sz=9.5, w='700', fill=SLATE)

def LEG_ITEM(y, label, dashed=False, bidir=False):
    lw = 38
    y0 = LY + y
    col = BORDER if dashed else MUTED
    dash = ' stroke-dasharray="5,3"' if dashed else ''
    emit(f'<line x1="{LX+10}" y1="{y0}" x2="{LX+10+lw}" y2="{y0}" '
         f'stroke="{col}" stroke-width="1.5"{dash} marker-end="url(#ah)"/>')
    if bidir:
        emit(f'<line x1="{LX+10+lw}" y1="{y0+8}" x2="{LX+10}" y2="{y0+8}" '
             f'stroke="{col}" stroke-width="1.5" marker-end="url(#ah)"/>')
    T(LX + 10 + lw + 8, y0 + 4, label, sz=8.5, fill=MUTED)

LEG_ITEM(28, 'Synchronous data flow')
LEG_ITEM(48, 'Bidirectional', bidir=True)
LEG_ITEM(68, 'Limited / optional path', dashed=True)
T(LX + 10, LY + 93, '* Redis provisioned; no Python client import found in backend.',
  sz=7.5, fill=LIGHT)

# ── CLOSE ────────────────────────────────────────────────────────────────────
emit('</svg>')

with open('/tmp/wintehr_arch.svg', 'w') as f:
    f.write('\n'.join(parts))

print('Done → /tmp/wintehr_arch.svg')
