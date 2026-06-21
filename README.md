# OliveAnnotate

A Progressive Web App (PWA) for field annotation of olive knot disease (*Pseudomonas savastanoi* pv. *savastanoi*) galls in orchard conditions. Designed to run entirely on-device with no server, no build step, and no internet connection required after the first load.

---

## Overview

OliveAnnotate is a v0 manual annotation tool. Its primary purpose is to generate ground-truth training data and zero-shot evaluation datasets for a future SAM2 (Segment Anything Model 2) segmentation pipeline. Annotators in the field can capture photos, draw bounding boxes or polygons around individual galls, classify each annotation, and export structured JSON + JPEG packages to a computer for downstream model training.

---

## Architecture

### Technology stack

| Concern | Choice | Reason |
|---------|--------|--------|
| Language | Vanilla JavaScript (ES2022, `'use strict'`) | No build step; loads directly in browser |
| UI framework | None — plain HTML + CSS custom properties | Zero dependency surface; works fully offline |
| Storage | IndexedDB via [`idb`](https://github.com/jakearchibald/idb) v8 (CDN) | Large binary blobs + structured JSON in two separate stores |
| ZIP export | [`JSZip`](https://stuk.github.io/jszip/) v3 (CDN) | Client-side ZIP generation; no server needed |
| Offline | Service Worker + Cache Storage API | Cache-first strategy; all assets cached on first load |
| Camera | `MediaDevices.getUserMedia()` | Rear-camera stream; requires HTTPS |
| Drawing | HTML5 Canvas 2D API | Pointer Events API for input; works with finger, stylus, and mouse |
| PWA install | Web App Manifest + Apple PWA meta tags | Home screen install on iOS and Android |
| Export delivery | Web Share API Level 2 (iOS) / anchor download (Android/desktop) | iOS PWA cannot trigger `<a download>`; share sheet used instead |
| IDs | `crypto.randomUUID()` | On-device UUID generation; no server call |

### File structure

```
OliveAnnotate/
├── index.html          # App shell — all four screens in DOM; CDN script tags
├── app.js              # All application logic (~930 lines, no dependencies)
├── styles.css          # CSS custom properties; responsive layout; no preprocessor
├── manifest.json       # PWA manifest — name, icons, display: standalone
├── service-worker.js   # Cache-first SW; caches app shell + CDN resources on install
├── icons/
│   ├── icon-192.svg    # Home screen icon (olive branch + "OA" monogram)
│   └── icon-512.svg    # Splash / high-res icon
└── QA_CHECKLIST.md     # Cross-device test protocol
```

### Data model

IndexedDB database: `olive-annotate-db` (version 1), two object stores:

**`images`** — one record per captured photo (key: `id`)

```json
{
  "id": "<uuid>",
  "session": "COR_2025_06_25_R04",
  "annotator": "J. Smith",
  "captured_at": "2025-06-25T14:32:00.000Z",
  "image_blob_key": "<same uuid>",
  "image_width": 4032,
  "image_height": 3024,
  "image_rating": 3,
  "notes": "Manzanilla, NW scaffold, overcast",
  "annotations": [ ... ],
  "status": "pending | annotated"
}
```

**`blobs`** — one record per captured photo (key: `id`), stores the raw JPEG Blob. Kept separate from `images` so metadata queries never deserialise multi-MB payloads.

**Session identity** is stored in `localStorage` (`oa_annotator`, `oa_session`). Records are filtered by `session` string on read, so multiple field sessions coexist in the same browser without interference.

### Annotation coordinate system

All annotation coordinates are stored in **original image pixel space**, not in canvas display pixels. The conversion factor `displayScale` (a single float) is computed once when the canvas is sized:

```
displayScale = min(containerWidth / imageWidth, containerHeight / imageHeight)
```

Stored bbox: `{ x, y, w, h }` in image pixels.  
Stored polygon: `[[x0,y0], [x1,y1], ...]` in image pixels.

This means exported annotations are device-independent and can be directly overlaid on the original JPEG regardless of screen size.

### Classification schema

Driven by a single `CLASSIFICATION_SCHEMA` array in `app.js`. Adding or removing a field requires editing only that array — the chip UI, validation logic, and JSON output all update automatically.

| Field | Options |
|-------|---------|
| Severity | 0 – Absent, 1 – Scattered, 2 – Moderate, 3 – Substantial, 4 – Extreme |
| Gall Age | Fresh, Aged, Old |
| Location | Trunk, Scaffold, Lateral, Shoot |
| Confidence | Sure, Unsure, Flag Expert |

### Export format

ZIP file named `OliveAnnotate_<sessionId>_<YYYY-MM-DD>.zip`:

```
OliveAnnotate_COR_2025_06_25_R04_2025-06-25.zip
├── session_metadata.json
├── IMG_<uuid>.jpg               # STORE (no re-compression of JPEG)
├── IMG_<uuid>_annotations.json  # DEFLATE level 6
└── ...
```

`session_metadata.json`:
```json
{
  "session": "COR_2025_06_25_R04",
  "annotator": "J. Smith",
  "exported_at": "2025-06-25T18:00:00.000Z",
  "image_count": 12
}
```

Per-image annotation JSON:
```json
{
  "id": "<uuid>",
  "session": "...",
  "annotator": "...",
  "captured_at": "...",
  "image_width": 4032,
  "image_height": 3024,
  "image_rating": 3,
  "notes": "...",
  "annotations": [
    {
      "id": "<uuid>",
      "type": "bbox",
      "coords": { "x": 310, "y": 240, "w": 85, "h": 72 },
      "severity": 2,
      "gall_age": "aged",
      "location": "scaffold",
      "confidence": "sure"
    },
    {
      "id": "<uuid>",
      "type": "polygon",
      "points": [[310,240],[395,241],[390,310],[312,312]],
      "severity": 1,
      "gall_age": "fresh",
      "location": "shoot",
      "confidence": "unsure"
    }
  ]
}
```

---

## Functionality

### Screen flow

```
Setup modal (first launch)
        ↓
[S1] Session Home  ──── + New Image ────→ [S2] Camera Capture
        ↑                                         ↓ (capture / library)
        └──── Confirm ──── [S3b] Review ←── [S3] Annotation Canvas
```

### Session Home (S1)
- Displays a scrollable grid of all images captured in the current session
- Each card shows a thumbnail, capture timestamp, and annotation count
- Progress bar shows how many images have at least one confirmed annotation
- **Export** generates and delivers the ZIP for the entire session
- **⚙ Settings** re-opens the setup modal to change annotator name or switch sessions (entering the same Session ID resumes the existing session)

### Camera Capture (S2)
- Opens rear camera via `getUserMedia`
- **Library** button accepts any image from the device photo library (useful when photos were pre-captured)
- Camera stream is stopped immediately on exit to release hardware

### Annotation Canvas (S3)
- Image is scaled to fit the screen with `displayScale`; canvas dimensions match
- **Bounding box tool** (default): drag to draw; rubber-band preview follows pointer in real time
- **Polygon tool**: tap to place vertices; dashed live-preview line from last vertex to current pointer; snap ring on first vertex when 3+ points are placed; tap first vertex or press **Close** to finalise
- **↩ Undo**: removes the last confirmed annotation, or the last in-progress polygon vertex if a polygon is being drawn
- **Done**: discards any unfinished annotation and opens the Review screen
- Classification panel opens after each annotation is drawn. In landscape the panel overlays from the right; in portrait it overlays from the bottom. The panel is `position: absolute` so it never changes `displayScale` or shifts stored coordinates
- Each **Save** click writes intermediate state to IndexedDB (crash recovery)
- **Reject** discards the pending annotation without saving

### Review Screen (S3b)
- Lists all confirmed annotations as instance cards with cropped thumbnails
- Optional 0–10 image rating (Kluepfel scale for disease severity at the tree level)
- Free-text notes field (cultivar, lighting conditions, canopy position, etc.)
- **Confirm** writes the final authoritative record to IndexedDB and returns to Session Home
- **Back** returns to the annotation canvas without saving review data

---

## Install Instructions

### iOS (iPad / iPhone) — Safari

OliveAnnotate must be served over HTTPS for camera access and service worker registration. Host the files on any static HTTPS server (GitHub Pages, Netlify, local `python3 -m http.server` with a self-signed cert, etc.).

1. Open Safari and navigate to the app URL.
2. Wait for the page to fully load (the service worker caches assets on first visit).
3. Tap the **Share** button (box with arrow).
4. Scroll down and tap **Add to Home Screen**.
5. Edit the name if desired; tap **Add**.
6. The OliveAnnotate icon appears on the home screen.
7. Launch from the home screen icon — the app opens in standalone mode with no Safari browser chrome.

**Notes:**
- Camera access requires HTTPS. A `localhost` origin also works for local development.
- On first capture, iOS will prompt for camera permission. Grant it; it is remembered for the PWA.
- Export uses the native iOS share sheet (Web Share API). The ZIP can be saved to Files, shared via AirDrop, or sent via Mail.
- Safari's IndexedDB storage may be cleared if the device is low on space and the PWA has not been used recently. Export regularly to avoid data loss.

### Android — Chrome

1. Open Chrome and navigate to the app URL.
2. Wait for the page to fully load.
3. Tap the **⋮** menu → **Add to Home Screen** (or accept the install banner if it appears automatically).
4. Tap **Add** on the confirmation dialog.
5. The OliveAnnotate icon appears in the app drawer and on the home screen.
6. Launch from the icon — the app opens in standalone mode.

**Notes:**
- Camera access requires HTTPS or `localhost`.
- On first capture, Android will prompt for camera permission. Grant it.
- Export uses a standard browser download. The ZIP is saved to the device Downloads folder.
- Chrome does not evict IndexedDB storage for installed PWAs without explicit user action. Data is persistent as long as the PWA is installed.

---

## Limitations

### Platform constraints
- **HTTPS required at runtime.** `getUserMedia` (camera) and service workers are blocked on plain HTTP origins. The only exception is `localhost` for local development.
- **No background sync.** All data stays on the capturing device. Moving data to a server or another device requires the manual Export → ZIP flow.
- **iOS storage quota.** Safari may evict PWA storage (IndexedDB + cache) under memory pressure. Apple's Storage API does not allow requesting persistent storage on iOS. Always export before clearing the app or leaving the device idle for extended periods.
- **SVG icons.** App icons are SVG, not PNG. Android Chrome and modern iOS Safari support SVG manifests; however, some older Android launchers may not render the icon correctly. Converting `icon-192.svg` and `icon-512.svg` to PNG is straightforward with any image editor and is recommended for broad deployment.
- **Single-device, single-session.** There is no sync mechanism. Two annotators working on the same session ID from different devices will produce separate, non-merged ZIP exports.

### Annotation constraints
- **Manual annotation only.** v0 has no AI-assisted pre-labelling, no SAM2 integration, and no smart segmentation. Every annotation is drawn by hand.
- **No annotation editing.** Once an annotation is saved, it cannot be moved, resized, or re-classified. The only correction available is Undo (which removes the annotation entirely) followed by redrawing.
- **Bounding boxes are axis-aligned only.** There is no rotated-rectangle tool.
- **Polygons have no vertex dragging.** Vertices are placed by tap only; repositioning requires Undo back to that vertex.
- **No pan/zoom on the annotation canvas.** The image is scaled to fit the screen. On small phones with very high-resolution captures, fine-grained annotation of small galls may be difficult.
- **No per-annotation undo after intermediate saves.** Undo removes annotations in reverse chronological order from the in-memory list; once you navigate away (Done → Confirm), the history is gone.

### Export constraints
- **One export per session, all images.** There is no selective export (e.g. "only annotated images" or a date range filter). The ZIP always contains every image captured under the current session ID.
- **No server upload.** Export produces a local file only. Uploading to a shared drive or S3 bucket requires a separate manual step.

---

## Future Work

The items below are out of scope for v0 but represent the natural next steps toward a production annotation and training pipeline.

### Near-term (v0.x)

- **Pan and zoom on annotation canvas.** Pinch-to-zoom with pointer events so annotators can work at full image resolution on small galls.
- **Annotation editing.** Tap a saved annotation to select it; drag handles to resize (bbox) or drag individual vertices (polygon).
- **Selective export.** Filter by status (`annotated`, `pending`) or date range before generating the ZIP.
- **PNG icons.** Generate `icon-192.png` and `icon-512.png` from the SVG sources for full launcher compatibility.
- **Persistent storage request.** Call `navigator.storage.persist()` on Android to prevent Chrome from evicting IndexedDB data under storage pressure.
- **Back-button / swipe navigation hardening.** Android hardware back button currently does nothing; should map to the contextual back action for the active screen.

### Medium-term (v1)

- **SAM2 pre-segmentation.** Run SAM2 in the browser via ONNX Runtime Web or on a companion server; use the annotator's bounding box as the prompt and auto-generate a polygon mask for review.
- **Inter-annotator agreement UI.** When two annotators annotate the same image independently, show an overlay comparison and IoU scores to help resolve disagreements.
- **Cloud sync.** Optional upload of confirmed records to a shared S3 bucket or Supabase instance so multiple field devices contribute to one dataset.
- **Session merging.** Merge two ZIP exports from different annotators working the same orchard row, deduplicating by image UUID and flagging conflicts.
- **Cultivar and orchard metadata.** Add a structured field (dropdown + free text) to record orchard block, row, tree number, and cultivar at the session level, surfaced in the export JSON.
- **Kluepfel rating guidance.** In-app reference card with photo examples of each 0–10 rating level to improve inter-annotator consistency.

### Long-term (v2+)

- **COCO / YOLO export formats.** Produce annotation files directly in COCO JSON or YOLO `.txt` format alongside (or instead of) the current custom JSON, so datasets can be fed to training pipelines without a conversion step.
- **Active learning queue.** Prioritise images where a model is least confident for human review, surfaced directly in the session home grid.
- **Multi-class support.** Extend the schema to cover related diseases (*Colletotrichum*, *Verticillium*) with configurable class lists per session.
- **Offline model inference.** Run a lightweight MobileNet or EfficientDet entirely in-browser to provide a "suggested" bounding box that the annotator can accept, adjust, or reject.

---

## Development

No build step is required.

```bash
# Serve locally (camera requires HTTPS or localhost)
python3 -m http.server 8080
# Then open http://localhost:8080 in Chrome or Safari
```

For iOS testing on a physical device, the server must be reachable over HTTPS. Use a tunnelling tool (e.g. `ngrok`) or deploy to a static host (GitHub Pages, Netlify).

All application logic is in `app.js`. The classification schema, colour palette, and snap threshold are the only "configuration" values — they live at the top of their respective files and are commented accordingly.

---

## License

See [LICENSE](./LICENSE).
