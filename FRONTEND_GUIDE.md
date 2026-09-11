# 🌊 Sonar Object Detection — Frontend Development Guide

> **Purpose**: Complete reference for building the React 18 + TypeScript + Vite + Tailwind CSS frontend for the Side-Scan Sonar Object Detection System. Treat this as the single source of truth for design decisions, component structure, API contracts, and UX patterns.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Repository Structure](#3-repository-structure)
4. [Design System](#4-design-system)
5. [Component Architecture](#5-component-architecture)
6. [User Inputs](#6-user-inputs)
7. [API Contract](#7-api-contract)
8. [Frontend Outputs & UI Panels](#8-frontend-outputs--ui-panels)
9. [Export Formats](#9-export-formats)
10. [Design Guidelines — Non-AI-Looking UI](#10-design-guidelines--non-ai-looking-ui)
11. [Coding Standards](#11-coding-standards)
12. [Accessibility & UX](#12-accessibility--ux)
13. [Offline / Air-Gapped Constraints](#13-offline--air-gapped-constraints)
14. [Development Workflow](#14-development-workflow)

---

## 1. Project Overview

**What it does**: An offline, browser-based mission interface for maritime sonar operators. Analysts upload a side-scan sonar waterfall image (and optionally a navigation CSV), tune processing parameters, trigger the backend pipeline, and receive a rich set of detection overlays, KPI cards, per-target inspection data, and one-click GeoJSON / CSV exports.

**Who uses it**: Marine surveyors, EOD (Explosive Ordnance Disposal) divers, salvage teams, environmental compliance officers.

**Deployment context**: 100% offline / air-gapped. No fonts from Google CDN, no icon sprites from external hosts, no analytics, no telemetry. Everything ships locally.

---

## 2. Technology Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | React | 18.x | SPA, no SSR |
| Language | TypeScript | 5.x | Strict mode enabled |
| Build Tool | Vite | 5.x | ESM, fast HMR |
| Styling | Tailwind CSS | 3.x | + custom Vanilla CSS for canvas overlays |
| Icons | Lucide React | latest | `lucide-react` — bundled offline |
| HTTP Client | Native `fetch` | — | Points to `http://localhost:8000` |
| State Mgmt | React Context + `useReducer` | — | No Redux; keep it lean |
| Canvas | Native HTML5 Canvas API | — | Sonar waterfall rendering & overlays |
| Fonts | Self-hosted (Inter, JetBrains Mono) | — | Bundled in `/public/fonts/` |

### Why no external dependencies for fonts/icons?
The deployment is air-gapped. All assets **must** be co-located with the built application. Use `@fontsource/inter` and `@fontsource/jetbrains-mono` npm packages so Vite bundles them.

---

## 3. Repository Structure

```
frontend/
├── public/
│   └── fonts/                    # Self-hosted Inter + JetBrains Mono
├── src/
│   ├── api/
│   │   └── sonarApi.ts           # All fetch() calls to FastAPI backend
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      # Root shell: sidebar + main content area
│   │   │   ├── Sidebar.tsx       # Mission controls sidebar
│   │   │   └── TopBar.tsx        # Session name, status badge, theme toggle
│   │   ├── upload/
│   │   │   ├── SonarDropzone.tsx # Drag-and-drop sonar image uploader
│   │   │   └── NavCsvUploader.tsx# Optional nav telemetry CSV uploader
│   │   ├── controls/
│   │   │   ├── ProcessingPanel.tsx   # Toggles + confidence slider
│   │   │   └── RunButton.tsx         # Trigger analysis
│   │   ├── canvas/
│   │   │   ├── WaterfallCanvas.tsx   # Dual pan/zoom sonar canvas
│   │   │   ├── OverlayRenderer.ts    # Canvas overlay draw functions
│   │   │   └── CanvasControls.tsx    # Zoom, pan, reset controls
│   │   ├── dashboard/
│   │   │   ├── KpiCard.tsx           # Individual KPI stat card
│   │   │   └── KpiStrip.tsx          # Row of 4 KPI cards
│   │   ├── inspector/
│   │   │   ├── TargetDrawer.tsx      # Slide-in inspector drawer
│   │   │   ├── TargetCard.tsx        # Per-detection card in list
│   │   │   └── ThumbnailViewer.tsx   # Cropped acoustic thumbnail
│   │   └── export/
│   │       └── ExportPanel.tsx       # GeoJSON + CSV download buttons
│   ├── hooks/
│   │   ├── useCanvasInteraction.ts   # Pan + zoom logic
│   │   ├── useAnalysis.ts            # Analysis state machine
│   │   └── useExport.ts              # Export generation logic
│   ├── store/
│   │   ├── AppContext.tsx            # Global context provider
│   │   └── appReducer.ts            # State transitions
│   ├── types/
│   │   └── sonar.ts                 # All TypeScript interfaces
│   ├── utils/
│   │   ├── colorScale.ts            # Confidence -> color mapping
│   │   ├── geomath.ts               # Coordinate projection helpers
│   │   └── formatters.ts            # Number + unit formatters
│   ├── styles/
│   │   ├── globals.css              # CSS custom properties + resets
│   │   ├── canvas.css               # Canvas-specific styles
│   │   └── animations.css           # Keyframe animations
│   ├── App.tsx
│   └── main.tsx
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
└── FRONTEND_GUIDE.md               # You are here
```

---

## 4. Design System

### 4.1 Color Palette — Oceanographic Dark Theme

The theme evokes deep-sea sonar displays: dark steel-blue backgrounds, cyan accent glows, amber warnings, and red-critical alerts.

```css
/* globals.css — CSS Custom Properties */
:root {
  /* Backgrounds */
  --color-bg-void:      #050c14;   /* Deepest background — near black-navy */
  --color-bg-depth:     #080f1a;   /* Main app background */
  --color-bg-surface:   #0d1929;   /* Panel/card surface */
  --color-bg-elevated:  #112238;   /* Raised elements, drawers */
  --color-bg-overlay:   #162d48;   /* Hover states, input backgrounds */

  /* Primary Accent — Sonar Cyan */
  --color-cyan-dim:     #0e4f6e;
  --color-cyan-mid:     #0ea5c8;
  --color-cyan-bright:  #22d3ee;
  --color-cyan-glow:    #67e8f9;

  /* Secondary Accent — Bioluminescent Green */
  --color-green-dim:    #0a3d2b;
  --color-green-mid:    #10b981;
  --color-green-bright: #34d399;

  /* Warning — Amber */
  --color-amber-mid:    #f59e0b;
  --color-amber-bright: #fbbf24;

  /* Critical — Red */
  --color-red-mid:      #ef4444;
  --color-red-bright:   #f87171;

  /* Text */
  --color-text-primary:   #e2eaf4;   /* Main readable text */
  --color-text-secondary: #7a9abf;   /* Labels, meta info */
  --color-text-muted:     #3d5a7a;   /* Disabled, placeholder */
  --color-text-inverse:   #050c14;   /* Text on bright surfaces */

  /* Borders */
  --color-border-subtle:  #112847;
  --color-border-default: #1a3a5c;
  --color-border-focus:   #0ea5c8;

  /* Hazard Risk Colors */
  --color-risk-low:      #34d399;   /* Green */
  --color-risk-medium:   #fbbf24;   /* Amber */
  --color-risk-high:     #f87171;   /* Red */
  --color-risk-critical: #ff3b3b;   /* Bright red with glow */

  /* Shadow Evidence Colors */
  --color-evidence-supporting: #22d3ee;  /* Cyan */
  --color-evidence-neutral:    #7a9abf;  /* Muted blue */
  --color-evidence-absent:     #3d5a7a;  /* Dark muted */

  /* Spacing Scale */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;

  /* Border Radius */
  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  12px;
  --radius-xl:  16px;
  --radius-full: 9999px;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Transitions */
  --transition-fast:   100ms ease;
  --transition-base:   200ms ease;
  --transition-slow:   350ms ease;
  --transition-spring: 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 4.2 Tailwind Config Extension

```ts
// tailwind.config.ts
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void:    '#050c14',
        depth:   '#080f1a',
        surface: '#0d1929',
        elevated:'#112238',
        overlay: '#162d48',
        cyan: {
          dim:    '#0e4f6e',
          mid:    '#0ea5c8',
          bright: '#22d3ee',
          glow:   '#67e8f9',
        },
        risk: {
          low:      '#34d399',
          medium:   '#fbbf24',
          high:     '#f87171',
          critical: '#ff3b3b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'cyan-glow':    '0 0 16px rgba(14, 165, 200, 0.35)',
        'cyan-glow-lg': '0 0 32px rgba(14, 165, 200, 0.5)',
        'panel':        '0 4px 24px rgba(5, 12, 20, 0.8)',
        'card':         '0 2px 12px rgba(5, 12, 20, 0.6)',
      },
      animation: {
        'pulse-cyan':     'pulse-cyan 2s ease-in-out infinite',
        'scan-line':      'scan-line 3s linear infinite',
        'fade-in':        'fadeIn 0.25s ease',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      },
    },
  },
};
```

### 4.3 Typography Scale

| Role | Size | Weight | Font | Usage |
|---|---|---|---|---|
| `display` | 28px / 1.75rem | 700 | Inter | Page titles |
| `heading` | 20px / 1.25rem | 600 | Inter | Section headings |
| `subheading` | 14px / 0.875rem | 600 | Inter | Panel labels |
| `body` | 14px / 0.875rem | 400 | Inter | General text |
| `small` | 12px / 0.75rem | 400 | Inter | Meta, captions |
| `kpi` | 36px / 2.25rem | 700 | Inter | KPI numbers |
| `mono` | 13px / 0.8125rem | 400 | JetBrains Mono | Coordinates, values |

### 4.4 Iconography

Use **Lucide React** exclusively. Import only what you use (tree-shakeable):

```tsx
import { Upload, ScanLine, Target, Download, ChevronRight } from 'lucide-react';
```

Never use `import * from 'lucide-react'`.

Preferred icon sizes: `16px` (inline), `20px` (buttons), `24px` (section headers).

---

## 5. Component Architecture

### 5.1 App State Shape

```ts
// src/types/sonar.ts

export type HazardRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TargetClass = 'crab_pot' | 'submarine_pipeline' | 'shipwreck' | 'ghost_net' | 'mine_cylinder';
export type ShadowEvidence = 'SUPPORTING' | 'NEUTRAL' | 'ABSENT';
export type AnalysisStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

export interface GeoCoordinate {
  lat: number;
  lon: number;
}

export interface LocalOffset {
  x_m: number;
  y_m: number;
}

export interface Detection {
  id: string;
  target_class: TargetClass;
  confidence: number;               // 0.0 to 1.0
  shadow_evidence: ShadowEvidence;
  dimensions: {
    length_m: number;
    width_m: number;
    area_m2: number;
    relief_height_m: number;
  };
  geolocation: GeoCoordinate | null;
  local_offset: LocalOffset | null;
  hazard_risk: HazardRisk;
  bounding_box: [number, number, number, number]; // [x, y, w, h] in image pixels
  mask_contour: Array<[number, number]>;           // polygon points in image pixels
  thumbnail_base64: string;                        // JPEG/PNG base64 crop
}

export interface AnalysisResult {
  raw_image_url: string;        // URL or base64 of raw waterfall
  enhanced_image_url: string;   // URL or base64 of enhanced waterfall
  detections: Detection[];
  kpis: {
    total_surveys: number;
    total_detections: number;
    verified_3d_objects: number;
    critical_hazards: number;
  };
  processing_meta: {
    slant_range_corrected: boolean;
    clahe_applied: boolean;
    nadir_excised: boolean;
    confidence_threshold: number;
    processing_time_ms: number;
  };
}

export interface ProcessingParams {
  slant_range_correction: boolean;
  clahe_equalization: boolean;
  nadir_excision: boolean;
  confidence_threshold: number;   // 0.05 to 0.95
}

export interface AppState {
  sonarFile: File | null;
  navCsvFile: File | null;
  params: ProcessingParams;
  status: AnalysisStatus;
  result: AnalysisResult | null;
  selectedDetectionId: string | null;
  error: string | null;
}
```

### 5.2 Context & Reducer Pattern

```ts
// src/store/appReducer.ts
type Action =
  | { type: 'SET_SONAR_FILE'; payload: File }
  | { type: 'SET_NAV_FILE'; payload: File | null }
  | { type: 'SET_PARAMS'; payload: Partial<ProcessingParams> }
  | { type: 'SET_STATUS'; payload: AnalysisStatus }
  | { type: 'SET_RESULT'; payload: AnalysisResult }
  | { type: 'SELECT_DETECTION'; payload: string | null }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'RESET' };
```

---

## 6. User Inputs

### 6.1 Sonar File Upload

- **Accepted MIME / extensions**: `.png`, `.jpg`, `.jpeg`, `.tiff`, `.pbm`
- **UX**: Drag-and-drop zone with dashed border that pulses cyan on drag-over. Shows file name, size, and a sonar preview thumbnail once loaded.
- **Validation**: Client-side extension check + size guard (warn > 200 MB).
- **Component**: `SonarDropzone`

### 6.2 Navigation Telemetry CSV (Optional)

Expected CSV columns (order-independent, header row required):

| Column | Type | Description |
|---|---|---|
| `timestamp` | string | UTC ISO 8601 or Unix epoch seconds |
| `latitude` | float | WGS84 decimal degrees |
| `longitude` | float | WGS84 decimal degrees |
| `altitude_m` | float | Towfish altitude above seabed (meters) |
| `heading_deg` | float | True heading 0 to 360 degrees |
| `speed_knots` | float | Ground speed |

- **UX**: Secondary dropzone, clearly labelled "Optional — Navigation Telemetry".
- **Validation**: Parse headers client-side; show a warning badge if expected columns are missing.
- **Component**: `NavCsvUploader`

### 6.3 Processing Parameters

| Control | Type | Default | Range | Component |
|---|---|---|---|---|
| Slant-Range Correction | Toggle switch | `true` | — | `ProcessingPanel` |
| CLAHE Equalization | Toggle switch | `true` | — | `ProcessingPanel` |
| Nadir Excision | Toggle switch | `false` | — | `ProcessingPanel` |
| Confidence Threshold | Slider | `0.25` | 0.05 – 0.95, step 0.01 | `ProcessingPanel` |

**Confidence Threshold Slider**:
- Show numeric readout next to slider (e.g., `0.25`)
- Color-code the track fill: green below 0.4, amber 0.4–0.7, red above 0.7 (high threshold = fewer but more certain detections).

---

## 7. API Contract

All requests go to `http://localhost:8000`. Define a typed API layer in `src/api/sonarApi.ts`.

### 7.1 POST `/analyze`

**Request**: `multipart/form-data`

| Field | Type | Required |
|---|---|---|
| `sonar_image` | File | Yes |
| `nav_csv` | File | No |
| `slant_range_correction` | string `"true"/"false"` | Yes |
| `clahe_equalization` | string `"true"/"false"` | Yes |
| `nadir_excision` | string `"true"/"false"` | Yes |
| `confidence_threshold` | string (float) | Yes |

**Response** `200 OK`: JSON matching the `AnalysisResult` TypeScript interface.

**Error Response** `4xx/5xx`:
```json
{ "detail": "Human-readable error message" }
```

### 7.2 GET `/health`

Simple health-check. Ping on app load to show backend connectivity status in `TopBar`.

**Response** `200 OK`:
```json
{ "status": "ok", "version": "1.0.0" }
```

### 7.3 API Client Implementation Pattern

```ts
// src/api/sonarApi.ts
const BASE = 'http://localhost:8000';

export async function analyzeImage(
  sonarFile: File,
  navFile: File | null,
  params: ProcessingParams
): Promise<AnalysisResult> {
  const form = new FormData();
  form.append('sonar_image', sonarFile);
  if (navFile) form.append('nav_csv', navFile);
  form.append('slant_range_correction', String(params.slant_range_correction));
  form.append('clahe_equalization', String(params.clahe_equalization));
  form.append('nadir_excision', String(params.nadir_excision));
  form.append('confidence_threshold', String(params.confidence_threshold));

  const res = await fetch(`${BASE}/analyze`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<AnalysisResult>;
}

export async function checkHealth(): Promise<{ status: string; version: string }> {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error('Backend offline');
  return res.json();
}
```

---

## 8. Frontend Outputs & UI Panels

### 8.1 Dual Waterfall Sonar Canvas

Two side-by-side (or toggle-switchable) canvas panels:
- **Left**: Raw Backscatter — unprocessed sonar image.
- **Right**: Enhanced Sonar Swath — CLAHE-enhanced, slant-corrected, nadir-excised.

**Canvas Overlays** (drawn on enhanced panel):
- **Segmentation Mask Contours**: Cyan polygon outlines (`rgba(34, 211, 238, 0.7)`, 1.5px stroke).
- **Bounding Boxes**: Color-coded by `hazard_risk` (green / amber / red / critical-red).
- **Acoustic Shadow Regions**: Semi-transparent dark fill (`rgba(0,0,0,0.45)`) overlaid on shadow polygons.
- **Nadir Line**: Vertical dashed white line at image center (`rgba(255,255,255,0.4)`, 2px).
- **Detection Labels**: Small text boxes showing detection ID + confidence% above each bounding box.

**Interactions**:
- Mouse wheel zoom (centered on cursor).
- Click + drag to pan.
- Double-click a bounding box opens `TargetDrawer` for that detection.
- "Reset View" button returns to fit-to-screen.

**Component**: `WaterfallCanvas` + `OverlayRenderer` utility.

### 8.2 Operations Dashboard KPIs

Four `KpiCard` components in a horizontal strip:

| KPI | Icon | Color Accent |
|---|---|---|
| Total Surveys Processed | `BarChart2` | Cyan |
| Total Detections Count | `Crosshair` | Cyan |
| Verified 3D Objects | `Box` | Green |
| Critical Hazards | `AlertTriangle` | Red |

KPI cards should use a large numeric display (`2.25rem`, bold) with a smaller label below and a subtle glowing border for the critical hazards card when count > 0.

### 8.3 Target Inspector Drawer

Slide-in from the right side (320px width on desktop). Triggered by clicking any detection card or double-clicking a canvas bounding box.

**Drawer Sections**:

#### Acoustic Thumbnail
- Cropped image from `thumbnail_base64`.
- Shows highlight zone + shadow zone with labeled annotation lines.

#### Target Classification
- Class badge: pill-shaped, color-coded per class:
  - `crab_pot` → teal
  - `ghost_gear` → amber
  - `mine_cylinder` → red
  - `debris_anomaly` → muted purple

#### Confidence Meter
- Horizontal progress bar, color interpolated from green to amber to red.
- Numeric readout: `"72.4%"`.

#### Acoustic Shadow Evidence
- `SUPPORTING` — cyan badge with `ShieldCheck` icon.
- `NEUTRAL` — amber badge with `Minus` icon.
- `ABSENT` — muted badge with `ShieldOff` icon.

#### Physical Dimensions Table
```
Length:        3.4 m
Width:         1.2 m
Area:          4.08 m²
Relief Height: 0.6 m
```

#### Geolocation
- If GPS available: `"12.3456° N, 98.7654° E"` (monospace font).
- If no GPS: `"Local Offset: X = +12.4 m, Y = -3.8 m"`.

#### Hazard Risk Badge
- Full-width pill badge with glow effect matching risk color.

### 8.4 Target List Panel

Scrollable vertical list of all detections. Each `TargetCard` shows:
- Target class icon + class name.
- Confidence bar (mini).
- Hazard risk badge.
- Clicking highlights on canvas + opens drawer.

---

## 9. Export Formats

### 9.1 RFC 7946 GeoJSON Export

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[lon1,lat1],[lon2,lat2]]]
      },
      "properties": {
        "id": "det_001",
        "target_class": "mine_cylinder",
        "confidence": 0.87,
        "hazard_risk": "CRITICAL",
        "shadow_evidence": "SUPPORTING",
        "length_m": 3.4,
        "width_m": 1.2,
        "area_m2": 4.08,
        "relief_height_m": 0.6,
        "latitude": 12.3456,
        "longitude": 98.7654
      }
    }
  ]
}
```
- Filename: `sonar_detections_<timestamp>.geojson`
- Trigger: `useExport` hook generates Blob → `URL.createObjectURL` → anchor click.

### 9.2 CSV Target Catalog

Headers:
```
id,target_class,confidence_pct,hazard_risk,shadow_evidence,length_m,width_m,area_m2,relief_height_m,latitude,longitude,local_x_m,local_y_m
```
- Filename: `sonar_catalog_<timestamp>.csv`
- UTF-8, comma-separated, no BOM.

---

## 10. Design Guidelines — Non-AI-Looking UI

> These rules exist to prevent the interface from looking like a generic ChatGPT-styled chat UI or cookie-cutter dashboard. Every design decision should feel **purpose-built for maritime sonar analysis**.

### 10.1 Typography Rules

- **Use optical sizing**: headings should have tighter letter-spacing (`-0.02em`), body text slightly relaxed (`0.01em`).
- **Never use default browser fonts**. Inter must load first; JetBrains Mono for all numeric/coordinate data.
- **Avoid centered body text**. Left-aligned data panels feel professional and purposeful.
- **Numeric data gets monospace**: coordinates, confidence percentages, physical dimensions — always `font-mono`.

### 10.2 Spacing & Density

- This is an **information-dense operator interface**, not a marketing page. Aim for moderate density like professional GIS/EDA tools.
- Card internal padding: `16px` (not the huge 32px of landing pages).
- Section gaps: `24px`.
- Use visual hierarchy via **size + color + weight**, not excessive padding.

### 10.3 Color Discipline

- Stick to the defined palette. No random brand colors.
- **Accents are scarce**: Cyan glow should only appear on primary interactive elements and active detections. Not everywhere.
- **Text hierarchy**: 3 levels max — primary `#e2eaf4`, secondary `#7a9abf`, muted `#3d5a7a`.
- **No pure white** (`#ffffff`) anywhere. Use `--color-text-primary` instead.
- **No pure black**. Darkest surface is `--color-bg-void: #050c14`.

### 10.4 Component Design Rules

- **No generic shadows**: Use directional `box-shadow` with opacity that matches the color theme.
- **No card carousels or hero sections**: This is a mission-critical tool, not a SaaS landing page.
- **Borders should be subtle**: 1px, low-opacity. Use `--color-border-subtle` for non-interactive borders, `--color-border-default` for interactive ones.
- **Toggle switches** should feel mechanical — slightly heavier knob, defined track. Reference: macOS system preferences style.
- **Sliders** should have a filled track + thumb with a subtle glow on focus.

### 10.5 Animation Principles

- **Purpose over decoration**: Every animation must serve a functional purpose (loading state, state transition, focus feedback).
- **Duration guide**:
  - Hover state changes: `100–150ms`
  - Panel transitions / drawer slides: `250–350ms`
  - Loading skeletons: `1.5s` loop
  - Never exceed `500ms` for any UI transition.
- **Easing**: Use `cubic-bezier(0.4, 0, 0.2, 1)` (material standard) for panels. Spring easing for the inspector drawer.
- **No looping decorative animations** on static content.

### 10.6 Sonar Canvas — Make It Feel Real

- The canvas is the **centerpiece** of the UI. Give it the most visual weight.
- Add a subtle CRT-style scanline overlay at very low opacity (0.04).
- Use a thin phosphor grid overlay (`#10b981` at `opacity: 0.05`) to suggest a real sonar display.
- Crosshair cursor on the canvas.
- Detection highlight on hover (bounding box border brightens, shadow glow appears).

### 10.7 What to Avoid

| Avoid | Do Instead |
|---|---|
| Card grids with rainbow colors | Consistent dark theme with purposeful accent colors |
| Centered hero text with gradient backgrounds | Left-aligned data panels, utility-first layout |
| Glassmorphism on everything | Glassmorphism only on the inspector drawer overlay |
| Icon-only buttons with no labels | Icon + label on primary actions |
| Loading spinners (generic) | Scanline animation on the canvas area, skeleton loaders on data |
| Tooltips with `title` attribute | Custom styled tooltip components |
| Alert dialogs for errors | Inline error states with clear recovery actions |
| Rounded corners everywhere (24px+) | Consistent 8px radius; only pills for badges |
| Auto-play animations on page load | Animations triggered by user action or data arrival |

---

## 11. Coding Standards

### 11.1 TypeScript

- Enable `"strict": true` in `tsconfig.json`.
- No `any` types. Use `unknown` + type guards where type is uncertain.
- All API response shapes must have corresponding TypeScript interfaces in `src/types/sonar.ts`.
- Props interfaces: named `{ComponentName}Props`, defined inline or in same file.

### 11.2 React Patterns

- **Functional components only**. No class components.
- **Custom hooks** for any logic exceeding ~30 lines. Keep components declarative.
- **`useCallback` / `useMemo`** on canvas drawing functions and expensive computations.
- **No `useEffect` for derived state**. Compute from existing state inline.
- Key prop on lists: use stable IDs (`detection.id`), never array indices.

### 11.3 File Naming

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase | `TargetDrawer.tsx` |
| Hooks | camelCase, `use` prefix | `useCanvasInteraction.ts` |
| Utilities | camelCase | `colorScale.ts` |
| Types | camelCase | `sonar.ts` |
| CSS | kebab-case | `canvas.css` |

### 11.4 Import Order

```ts
// 1. React / external libraries
import React, { useState, useCallback } from 'react';
import { Target } from 'lucide-react';

// 2. Internal components
import { KpiCard } from '../dashboard/KpiCard';

// 3. Hooks + utils
import { useAnalysis } from '../../hooks/useAnalysis';

// 4. Types
import type { Detection, HazardRisk } from '../../types/sonar';

// 5. CSS
import './TargetDrawer.css';
```

---

## 12. Accessibility & UX

- **Color alone must not convey information**: Risk badges include text labels, not just color.
- **Focus rings**: visible on all interactive elements. Use `outline: 2px solid var(--color-cyan-mid)` with `outline-offset: 2px`.
- **Keyboard navigation**: Drawer opens/closes with `Escape`. Canvas interactions degrade gracefully without mouse (zoom buttons provided).
- **ARIA labels** on icon-only buttons (`aria-label="Export GeoJSON"`).
- **`role="status"` and `aria-live="polite"`** on the analysis status message so screen readers announce completion.
- **Minimum tap target**: 44x44px for all interactive elements.
- **`prefers-reduced-motion`**: All keyframe animations must be wrapped in `@media (prefers-reduced-motion: no-preference)`.

---

## 13. Offline / Air-Gapped Constraints

| Constraint | Implementation |
|---|---|
| No Google Fonts CDN | Use `@fontsource/inter` + `@fontsource/jetbrains-mono` npm packages |
| No external icon CDN | `lucide-react` bundled via npm |
| No analytics | Zero analytics scripts |
| No CDN scripts | All dependencies in `node_modules`, bundled by Vite |
| No external image URLs | All images are either uploaded by user or returned as base64 from backend |
| No map tiles | If a map is needed, use offline GeoJSON rendering (no Mapbox/Leaflet tile CDN) |

**Vite config must**:
- Output a fully self-contained `dist/` folder.
- Configure `base: './'` for relative asset paths (important if served from a subdirectory).

---

## 14. Development Workflow

### Initial Setup

```bash
# In the frontend/ directory
npm create vite@latest . -- --template react-ts
npm install
npm install tailwindcss @tailwindcss/forms postcss autoprefixer
npm install lucide-react
npm install @fontsource/inter @fontsource/jetbrains-mono
npx tailwindcss init -p
```

### Dev Server

```bash
npm run dev
# Vite HMR at http://localhost:5173
# FastAPI backend must be at http://localhost:8000
```

### Build

```bash
npm run build
# Output: dist/ — fully self-contained, no CDN dependencies
```

### Type Checking

```bash
npx tsc --noEmit
```

### Key Vite Configuration

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
```

---

## Quick Reference Checklist

Before opening a PR or handing off, verify:

- [ ] All fonts load from `@fontsource` packages — no Google Fonts URLs.
- [ ] `lucide-react` imports are named, not wildcard.
- [ ] TypeScript strict mode — zero `any` types.
- [ ] API base URL is `http://localhost:8000` (not hardcoded elsewhere).
- [ ] Canvas overlays use defined color constants, not magic hex values.
- [ ] All interactive elements have focus rings.
- [ ] Risk badges include text labels, not just color.
- [ ] No `console.log` in production code paths.
- [ ] Export filenames include timestamp.
- [ ] `vite.config.ts` has `base: './'` set.
- [ ] Design matches Oceanographic Dark Theme — no bright white, no generic blue.
- [ ] All animations respect `prefers-reduced-motion` media query.

---

*Last updated: 2026-09-10 | Sonar Object Detection System — Frontend v1.0*
