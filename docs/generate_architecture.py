#!/usr/bin/env python3
"""
WintEHR Architecture Diagram — Publication-ready SVG generator v3.
Output: /tmp/wintehr_arch.svg

Render:
  python3 docs/generate_architecture.py
  node -e "
    const {chromium}=require('/path/to/playwright');const fs=require('fs');
    (async()=>{const b=await chromium.launch();const p=await b.newPage();
    await p.setViewportSize({width:1300,height:460});
    const svg=fs.readFileSync('/tmp/wintehr_arch.svg','utf8');
    await p.setContent('<!DOCTYPE html><html><body style=margin:0>'+svg+'</body></html>');
    const el=await p.\$('svg');await el.screenshot({path:'docs/architecture.png'});
    await b.close()})();"
"""

W, H = 1300, 460

# Colours
BG    = '#FFFFFF'
SLATE = '#334155'
MUTED = '#64748B'
LIGHT = '#94A3B8'
BORDER= '#CBD5E1'

COL_EXT = ('#F1F5F9', '#94A3B8')
COL_NGX = ('#1E3A8A', '#3B82F6')
COL_PRS = ('#F0FDF4', '#16A34A')
COL_API = ('#FFFBEB', '#D97706')
COL_HAP = ('#FFF7ED', '#EA580C')
COL_PG  = ('#EFF6FF', '#2563EB')
COL_RDS = ('#FFF1F2', '#E11D48')
COL_SYN = ('#FAF5FF', '#7C3AED')

parts = []
def emit(s): parts.append(s)

def R(x, y, w, h, fill, stroke, sw=1.2, rx=7, extra=''):
    emit(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
         f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{extra}/>')

def T(x, y, s, sz=10.5, w='normal', fill=SLATE, anchor='start', extra=''):
    emit(f'<text x="{x}" y="{y}" font-size="{sz}" font-weight="{w}" '
         f'fill="{fill}" text-anchor="{anchor}"{extra}>{s}</text>')

def BOX(x, y, w, h, col, title, bullets=(), footnote=''):
    bg, accent = col
    R(x, y, w, h, bg, accent, sw=1.4, rx=7, extra=' filter="url(#sh)"')
    emit(f'<rect x="{x}" y="{y}" width="{w}" height="24" rx="7" fill="{accent}"/>')
    emit(f'<rect x="{x}" y="{y+12}" width="{w}" height="12" fill="{accent}"/>')
    T(x+w//2, y+16, title, sz=10, w='700', fill='#FFF', anchor='middle')
    for i, b in enumerate(bullets):
        by = y + 34 + i * 14
        emit(f'<circle cx="{x+12}" cy="{by-3}" r="1.8" fill="{accent}"/>')
        T(x+20, by, b, sz=9, fill=SLATE)
    if footnote:
        T(x+w//2, y+h-8, footnote, sz=7.5, fill=LIGHT, anchor='middle')

def CYLINDER(x, y, w, h, col, title):
    bg, accent = col
    ry = 7
    cx_c = x + w // 2
    emit(f'<rect x="{x}" y="{y+ry}" width="{w}" height="{h-ry}" fill="{bg}"/>')
    emit(f'<path d="M{x},{y+ry} L{x},{y+h} a{w//2},{ry} 0 0,0 {w},0 L{x+w},{y+ry}" '
         f'fill="none" stroke="{accent}" stroke-width="1.4"/>')
    emit(f'<ellipse cx="{cx_c}" cy="{y+ry}" rx="{w//2-1}" ry="{ry}" '
         f'fill="{accent}" stroke="{accent}" stroke-width="1.4"/>')
    T(cx_c, y+ry+6, title, sz=9.5, w='700', fill='#FFF', anchor='middle')

def ACTOR_BOX(cx, y, w, h, line1, line2=''):
    R(cx-w//2, y, w, h, COL_EXT[0], COL_EXT[1], sw=1.2, rx=5,
      extra=' stroke-dasharray="5,3"')
    ty = y + (h//2) - (5 if line2 else 0)
    T(cx, ty,      line1, sz=9.5, w='600', fill=SLATE, anchor='middle')
    if line2:
        T(cx, ty+13, line2, sz=8.5, fill=MUTED, anchor='middle')

def BAND_LABEL(label, band_y, band_h):
    """Rotated label in the 42px left margin. Label must fit within band_h px."""
    mid_y = band_y + band_h // 2
    emit(f'<text transform="translate(21,{mid_y}) rotate(-90)" '
         f'font-size="7" font-weight="700" fill="{LIGHT}" '
         f'text-anchor="middle" letter-spacing="1">{label}</text>')

def ARROW(x1, y1, x2, y2, color=MUTED, dashed=False, marker='ah', sw=1.5):
    dash = ' stroke-dasharray="5,3"' if dashed else ''
    emit(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" '
         f'stroke-width="{sw}"{dash} marker-end="url(#{marker})"/>')

def POLY(pts, color=MUTED, dashed=False, marker='ah', sw=1.5):
    dash = ' stroke-dasharray="5,3"' if dashed else ''
    pt_s = ' '.join(f'{px},{py}' for px, py in pts)
    emit(f'<polyline points="{pt_s}" stroke="{color}" stroke-width="{sw}" '
         f'fill="none"{dash} marker-end="url(#{marker})"/>')

# ── Layout ───────────────────────────────────────────────────────────────────────
# Main panel: x=42..898   Side panel: x=940..1290   Gap = 42px
MX, MW = 42, 856
SX, SW = 940, 350

EY, EH =  14,  70    # External Environment
NY, NH =  88,  46    # NGINX / Reverse Proxy
AY, AH = 138, 172    # Application / Integration  (extra height for arrow labels)
PY, PH = 325, 112    # Persistence

# App sub-columns (right edge = MX+MW = 898)
PRW = 158
FAX = MX + PRW + 16         # 216
FAW = 272
HX  = FAX + FAW + 16        # 504
HW  = MW - PRW - FAW - 32   # 394   (HX+HW = 898) ✓

# Persistence sub-columns (right edge = 898)
PGW = 566
RDX = MX + PGW + 12         # 620
RDW = MW - PGW - 12         # 278   (RDX+RDW = 898) ✓

# Derived midpoints
PRS_MX  = MX + PRW // 2     # 121 — centre of React column
FA_MX   = FAX + FAW // 2    # 352 — centre of FastAPI
H_MX    = HX + HW // 2      # 701 — centre of HAPI
HAPI_RX = HX + HW           # 898 — right edge of HAPI
PIPE_CX = SX + SW // 2      # 1115 — centre of side panel

# Arrow connection Y-positions — in the FREE SPACE below bullets, inside app band
# Sub-box bullet 5 ends at ≈ AY+10+34+4*14 = 138+10+34+56 = 238
# Sub-box bottom = AY+10+(AH-16) = 304 — free space: 238..304 = 66px
BY1 = AY + AH - 52   # 258 — REST & WebSockets pair
BY2 = AY + AH - 30   # 280 — FHIR API pair (FastAPI ↔ HAPI)
BY3 = AY + AH - 10   # 300 — FHIR direct (React → HAPI, dashed)

# Side panel
SP_H    = PY + PH - EY   # 423
SYBOX_Y = EY + 24        # 38
SYN_H   = 88
GAP_S   = 40
PIP_Y   = SYBOX_Y + SYN_H + GAP_S   # 166
PIP_H   = 96
LEG_Y   = PIP_Y + PIP_H + 22        # 284
LEG_H   = 96

# ── SVG OPEN ─────────────────────────────────────────────────────────────────────
emit(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs>
  <style>* {{ font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif; }}</style>
  <filter id="sh" x="-3%" y="-3%" width="106%" height="106%">
    <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#0F172A" flood-opacity="0.07"/>
  </filter>
  <marker id="ah"   viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M0 1.5 L8.5 5 L0 8.5z" fill="{MUTED}"/></marker>
  <marker id="ah-d" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M0 1.5 L8.5 5 L0 8.5z" fill="{BORDER}"/></marker>
  <marker id="ah-p" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M0 1.5 L8.5 5 L0 8.5z" fill="{COL_SYN[1]}"/></marker>
  <marker id="ah-g" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M0 1.5 L8.5 5 L0 8.5z" fill="{COL_PG[1]}"/></marker>
</defs>''')

emit(f'<rect width="{W}" height="{H}" fill="{BG}"/>')
T(W//2, 11, 'WintEHR — System Architecture', sz=11, w='600', fill=MUTED, anchor='middle')

# ── LAYER BANDS (drawn first, content renders on top) ────────────────────────────
# Full-width background bands with rotated label in left 42px margin
for (by, bh, label) in [
    (EY, EH, 'EXTERNAL'),
    (NY, NH, 'NGINX'),
    (AY, AH, 'APPLICATION'),
    (PY, PH, 'PERSISTENCE'),
]:
    R(0, by, MX+MW, bh, '#F8FAFC', BORDER, sw=0.7, rx=5)
    BAND_LABEL(label, by, bh)

# ── EXTERNAL ENVIRONMENT ──────────────────────────────────────────────────────────
ACT_W, ACT_H = 192, 44
ACT_Y   = EY + (EH - ACT_H) // 2
ACT1_CX = MX + 168
ACT2_CX = MX + MW - 168

ACTOR_BOX(ACT1_CX, ACT_Y, ACT_W, ACT_H, 'Learners &amp; Clinicians', '(Web Browser)')
ACTOR_BOX(ACT2_CX, ACT_Y, ACT_W, ACT_H, 'SMART on FHIR Apps', '(External Clients)')

# ── NGINX ─────────────────────────────────────────────────────────────────────────
emit(f'<rect x="{MX}" y="{NY}" width="{MW}" height="{NH}" rx="7" '
     f'fill="#1E3A8A" filter="url(#sh)"/>')
T(MX+MW//2, NY+18, 'NGINX Proxy', sz=11.5, w='700', fill='#FFF', anchor='middle')
T(MX+MW//2, NY+33, "Routing  ·  Let's Encrypt TLS  ·  certbot", sz=8.5, fill='#BFDBFE', anchor='middle')

def ROUTE_PILL(cx, label):
    pw = len(label)*5.0 + 12
    emit(f'<rect x="{cx-pw/2}" y="{NY+NH-9}" width="{pw}" height="15" '
         f'rx="4" fill="#1E3A8A" stroke="#60A5FA" stroke-width="0.8"/>')
    T(cx, NY+NH+2, label, sz=7.5, fill='#93C5FD', anchor='middle', w='600')

ROUTE_PILL(PRS_MX, "route: '/'")
ROUTE_PILL(FA_MX,  "route: '/api'  '/ws'")
ROUTE_PILL(H_MX,   "route: '/fhir'")

# ── APPLICATION LAYER ─────────────────────────────────────────────────────────────
# Presentation sub-highlight
R(MX, AY, PRW, AH, COL_PRS[0], COL_PRS[1], sw=0, rx=6)

BOX(MX+5, AY+12, PRW-10, AH-18, (BG, COL_PRS[1]),
    'React Frontend (SPA)',
    ('Clinical Workspace', 'DICOM Viewer', 'FHIR Explorer',
     'CDS Studio', 'Pharmacy'),
    footnote='MUI v5  ·  React 18')

BOX(FAX, AY+10, FAW, AH-16, (BG, COL_API[1]),
    'FastAPI Backend',
    ('Clinical Workflows', 'WebSocket Manager (in-process)',
     'CDS Hooks Services', 'Auth / SMART Auth', 'DICOM API'),
    footnote='Python 3.9  ·  async SQLAlchemy')

BOX(HX, AY+10, HW, AH-16, (BG, COL_HAP[1]),
    'HAPI FHIR  (v8.6.0-1)',
    ('FHIR R4 REST API', 'Resource Validation',
     'ClinicalReasoning / PlanDefinition'),
    footnote='Spring Boot  ·  JPA  ·  JDBC')

# ── PERSISTENCE LAYER ─────────────────────────────────────────────────────────────
PGBOX_Y = PY + 14
PGBOX_H = PH - 22

CYLINDER(MX+4, PGBOX_Y, PGW-4, PGBOX_H, (COL_PG[0], COL_PG[1]), 'PostgreSQL 15')

schemas_L = [('hfj_*',    'HAPI JPA — FHIR resources'),
             ('auth',     'users, sessions, roles'),
             ('cds_hooks','CDS service config')]
schemas_R = [('cds_visual_builder', 'CDS Studio state'),
             ('smart_auth',         'SMART authorization'),
             ('audit',              'audit log')]
LCX = MX + 16
RCX = MX + (PGW - 4) // 2 + 20
for i, (sch, desc) in enumerate(schemas_L):
    oy = PGBOX_Y + 22 + i * 22
    T(LCX, oy,      sch,  sz=8.5, w='700', fill=COL_PG[1])
    T(LCX, oy+12, desc, sz=7.5, fill=MUTED)
for i, (sch, desc) in enumerate(schemas_R):
    oy = PGBOX_Y + 22 + i * 22
    T(RCX, oy,      sch,  sz=8.5, w='700', fill=COL_PG[1])
    T(RCX, oy+12, desc, sz=7.5, fill=MUTED)

CYLINDER(RDX, PGBOX_Y, RDW, PGBOX_H, (COL_RDS[0], COL_RDS[1]), 'Redis 7')
T(RDX+RDW//2, PGBOX_Y+28, 'Session token cache',    sz=9,   fill=COL_RDS[1], anchor='middle')
T(RDX+RDW//2, PGBOX_Y+42, '(limited active use *)', sz=8,   fill=MUTED,      anchor='middle')
T(RDX+RDW//2, PGBOX_Y+56, '256 MB · allkeys-lru',   sz=7.5, fill=LIGHT,      anchor='middle')

# ── SYNTHEA SIDE PANEL ────────────────────────────────────────────────────────────
R(SX, EY, SW, SP_H, COL_SYN[0], COL_SYN[1], sw=1.2, rx=8,
  extra=' stroke-dasharray="5,3"')
T(PIPE_CX, EY+12, 'SYNTHETIC DATA PIPELINE', sz=7.5, w='700', fill=COL_SYN[1], anchor='middle')

BOX(SX+10, SYBOX_Y, SW-20, SYN_H, (BG, COL_SYN[1]),
    'Synthea Engine',
    ('Synthetic patient generation',),
    footnote='Java · v3.3.0')

BOX(SX+10, PIP_Y, SW-20, PIP_H, (BG, '#8B5CF6'),
    'Python Data Pipeline',
    ('FHIR Bundle generation', 'Synthetic DICOM creation'),
    footnote='scripts/  ·  deploy.sh')

R(SX+10, LEG_Y, SW-20, LEG_H, '#F9FAFB', BORDER, rx=6)
T(SX+20, LEG_Y+13, 'Key', sz=9, w='700', fill=SLATE)

def LEG_ITEM(dy, label, dashed=False, bidir=False):
    lw, y0 = 32, LEG_Y + dy
    col  = BORDER if dashed else MUTED
    dash = ' stroke-dasharray="5,3"' if dashed else ''
    emit(f'<line x1="{SX+20}" y1="{y0}" x2="{SX+20+lw}" y2="{y0}" '
         f'stroke="{col}" stroke-width="1.5"{dash} marker-end="url(#ah)"/>')
    if bidir:
        emit(f'<line x1="{SX+20+lw}" y1="{y0+7}" x2="{SX+20}" y2="{y0+7}" '
             f'stroke="{col}" stroke-width="1.5" marker-end="url(#ah)"/>')
    T(SX+20+lw+7, y0+4, label, sz=8, fill=MUTED)

LEG_ITEM(26, 'Synchronous data flow')
LEG_ITEM(44, 'Bidirectional', bidir=True)
LEG_ITEM(65, 'Limited / optional path', dashed=True)
T(SX+14, LEG_Y+LEG_H-14, '* no Python client import in backend', sz=7.5, fill=LIGHT)

# ── ARROWS ────────────────────────────────────────────────────────────────────────

# 1,2 — Actors → NGINX
ARROW(ACT1_CX, ACT_Y+ACT_H, ACT1_CX, NY-1)
T(ACT1_CX+4, (ACT_Y+ACT_H+NY)//2+4, 'HTTPS', sz=7.5, fill=MUTED)

ARROW(ACT2_CX, ACT_Y+ACT_H, ACT2_CX, NY-1)
T(ACT2_CX+4, (ACT_Y+ACT_H+NY)//2+4, 'HTTPS / REST', sz=7.5, fill=MUTED)

# 3,4,5 — NGINX → App columns
ARROW(PRS_MX, NY+NH+5, PRS_MX, AY+12)
ARROW(FA_MX,  NY+NH+5, FA_MX,  AY+10)
ARROW(H_MX,   NY+NH+5, H_MX,   AY+10)

# 6 — React ↔ FastAPI  (bidirectional pair in free space below bullets)
F_RX  = MX + PRW - 5     # 195
FA_LX = FAX               # 216
ARROW(F_RX,   BY1,    FA_LX-2, BY1)
ARROW(FA_LX-2, BY1+9, F_RX,   BY1+9)
T((F_RX+FA_LX)//2, BY1-8, 'REST &amp; WebSockets',
  sz=7.5, w='600', fill=COL_API[1], anchor='middle')

# 7 — FastAPI ↔ HAPI  (bidirectional, FHIR API)
FA_RX   = FAX + FAW       # 488
HAPI_LX = HX              # 504
ARROW(FA_RX,    BY2,    HAPI_LX-2, BY2)
ARROW(HAPI_LX-2, BY2+9, FA_RX,    BY2+9)
T((FA_RX+HAPI_LX)//2, BY2-8, 'FHIR API',
  sz=7.5, w='600', fill=COL_HAP[1], anchor='middle')

# 8 — React → HAPI direct (via nginx /fhir)  — dashed line near sub-box bottoms
REACT_CX = MX + PRW // 2
ARROW(F_RX, BY3, HX+2, BY3, color=COL_PG[1], dashed=True, marker='ah-g')
T((F_RX + HX) // 2, BY3-8, 'FHIR API  (direct via nginx /fhir)',
  sz=7.5, fill=COL_PG[1], anchor='middle', w='600')

# 9 — FastAPI → PostgreSQL
ARROW(FA_MX, AY+AH, FA_MX, PGBOX_Y)
T(FA_MX+4, (AY+AH+PGBOX_Y)//2+4, 'SQL / SQLAlchemy', sz=7.5, fill=MUTED)

# 10 — HAPI → PostgreSQL
ARROW(H_MX, AY+AH, H_MX, PGBOX_Y)
T(H_MX+4, (AY+AH+PGBOX_Y)//2+4, 'JDBC / JPA', sz=7.5, fill=MUTED)

# 11 — FastAPI → Redis (dashed, limited)
ARROW_RY = PY + PH // 2
POLY([(FA_MX+38, AY+AH), (FA_MX+38, ARROW_RY), (RDX-2, ARROW_RY)],
     color=BORDER, dashed=True, marker='ah-d')
T((FA_MX+38+RDX)//2, ARROW_RY-8, 'session cache  (limited)', sz=7.5, fill=COL_RDS[1], anchor='middle')

# 12 — Synthea → Pipeline
ARROW(PIPE_CX, SYBOX_Y+SYN_H, PIPE_CX, PIP_Y-2, color=COL_SYN[1])
# JSON Bundles label between the boxes
MID_S = SYBOX_Y + SYN_H + (PIP_Y - SYBOX_Y - SYN_H) // 2
T(PIPE_CX, MID_S+4, 'JSON Bundles', sz=7.5, fill=COL_SYN[1], anchor='middle', w='600')

# 13 — Pipeline → HAPI  (Load Resources across 42px gap)
PIP_CY = PIP_Y + PIP_H // 2
ARROW(SX-1, PIP_CY, HAPI_RX+2, PIP_CY, color=COL_SYN[1], marker='ah-p')
T((SX+HAPI_RX)//2, PIP_CY-9, 'Load Resources',
  sz=7.5, w='600', fill=COL_SYN[1], anchor='middle')

# ── CLOSE ─────────────────────────────────────────────────────────────────────────
emit('</svg>')

with open('/tmp/wintehr_arch.svg', 'w') as f:
    f.write('\n'.join(parts))

print('Done → /tmp/wintehr_arch.svg')
