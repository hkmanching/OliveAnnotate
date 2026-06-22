# OliveAnnotate

A Progressive Web App (PWA) for field annotation of olive knot disease (*Pseudomonas savastanoi* pv. *savastanoi*) galls in orchard conditions. Designed to run entirely on-device with no server, no build step, and no internet connection required after the first load.

---

## Overview

OliveAnnotate is a manual annotation tool. Its primary purpose is to generate ground-truth training data and zero-shot evaluation datasets for a future SAM2 (Segment Anything Model 2) segmentation pipeline. Annotators in the field can capture photos, draw bounding boxes or polygons around individual galls, classify each annotation, record structured image-level metadata, and export packaged JSON + JPEG files to a computer for downstream model training.

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
├── index.html          # App shell — all four screens in DOM; CDN script tags; modals
├── app.js              # All application logic (~1,580 lines, no dependencies)
├── styles.css          # CSS custom properties; responsive layout; no preprocessor
├── manifest.json       # PWA manifest — name, icons, display: standalone
├── service-worker.js   # Cache-first SW; caches app shell + CDN resources on install
├── icons/
│   ├── icon-192.png    # Home screen icon (olive branch + "OA" monogram)
│   ├── icon-512.png    # Splash / high-res icon
│   ├── icon-192.svg    # SVG source
│   └── icon-512.svg    # SVG source
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
  "device_ua": "Mozilla/5.0 ...",

  "disease": "present",
  "cultivar": "Manzanilla",
  "cultivar_susceptibility": "high",
  "kluepfal_rating": 3,
  "camera_height": "1.5 m",
  "camera_distance": "0.5 m",
  "camera_angle": "45°",
  "gall_distribution": "75_175cm",
  "bark_texture": "rough",
  "image_lighting": "overcast",
  "notes": "NW-facing scaffold, partial shade",

  "annotations": [ ... ],
  "status": "pending | annotated"
}
```

**`blobs`** — one record per captured photo (key: `id`), stores the raw JPEG Blob. Kept separate from `images` so metadata queries never deserialise multi-MB payloads.

**Session identity** is stored in `localStorage`:

| Key | Description |
|-----|-------------|
| `oa_annotator` | Annotator name |
| `oa_session` | Active session ID |
| `oa_location` | Optional field location (e.g. "Corning, CA — Block 4") |
| `oa_sessions_registry` | JSON map of all known sessions → `{ annotator, location }`, used to populate the startup session picker |
| `oa_last_camera_height` | Most recently confirmed camera height; pre-fills the next image in the same session |
| `oa_last_camera_distance` | Most recently confirmed camera distance; pre-fills the next image in the same session |

Records are filtered by the `session` string on read, so multiple field sessions coexist in the same browser without interference.

### Annotation coordinate system

All annotation coordinates are stored in **original image pixel space**, not in canvas display pixels. The conversion factor `displayScale` (a single float) is computed once when the canvas is sized:

```
displayScale = min(containerWidth / imageWidth, containerHeight / imageHeight)
```

Stored bbox: `{ x, y, w, h }` in image pixels.  
Stored polygon: `[[x0,y0], [x1,y1], ...]` in image pixels.

This means exported annotations are device-independent and can be directly overlaid on the original JPEG regardless of screen size.

### Annotation classification schema

Driven by the `CLASSIFICATION_SCHEMA` array in `app.js`. Adding or removing a field requires editing only that array — the chip UI, validation logic, and JSON output all update automatically.

| Field | Type | Required | Options |
|-------|------|----------|---------|
| Type (`annotation_type`) | single-select | **yes** | Gall, Shadow, Scar, Pruning Callus, Bark, Other |
| Gall Stage (`gall_stage`) | single-select | no | Fresh, Aged, Old |
| Gall Texture (`gall_texture`) | **multi-select** | no | Cracking, Rugose, Smooth |
| Location on Tree (`location_on_tree`) | single-select | no | Trunk, Branch Union, Branch Base, Scaffold, Shoot |
| Lighting (`lighting`) | single-select | no | Sun-Exposed, Shaded |

`gall_texture` is stored as a JSON array (e.g. `["cracking", "rugose"]`). All other classification fields are strings or `null`.

`annotation_type` is named differently from the annotation's drawing `type` field (`"bbox"` or `"polygon"`) to avoid collision in the same JSON object.

### Image-level metadata schema

Collected on the Review screen after annotation. Driven by `IMAGE_METADATA_SCHEMA` in `app.js`; the form is fully schema-driven — the same pattern as the classification panel.

| Field | Input type | Required | Options / format |
|-------|-----------|----------|-----------------|
| Disease (`disease`) | chips | **yes** | Present, Absent |
| Cultivar (`cultivar`) | text | no | free text |
| Cultivar Susceptibility (`cultivar_susceptibility`) | chips | no | High, Moderate, Low |
| Kluepfal Rating (`kluepfal_rating`) | chips | no | 0 – 9 |
| Camera Height (`camera_height`) | text | no | free text; auto-filled from previous image in session |
| Camera Distance (`camera_distance`) | text | no | free text; auto-filled from previous image in session |
| Camera Angle (`camera_angle`) | text | no | free text |
| Gall Distribution (`gall_distribution`) | chips | no | <75 cm, 75–175 cm, >175 cm |
| Bark Texture (`bark_texture`) | chips | no | Smooth, Rough, Other |
| Lighting (`image_lighting`) | chips | no | Overcast, Sunny, Intermittent |
| Notes (`notes`) | textarea | no | free text |

The Confirm button is blocked until Disease is selected. Camera Height and Camera Distance values are written to `localStorage` on Confirm and pre-filled automatically for the next image in the same session; they are cleared when switching to a different session.

`image_lighting` is named differently from the annotation-level `lighting` field to avoid ambiguity in the exported JSON.

### Export format

ZIP file named `<sessionId>_annotations.zip`:

```
COR_2025_06_25_R04_annotations.zip
├── session_metadata.json
├── IMG_<uuid>.jpg               # STORE compression (no JPEG re-encoding)
├── IMG_<uuid>_annotations.json  # DEFLATE level 6
└── ...
```

`session_metadata.json`:
```json
{
  "session": "COR_2025_06_25_R04",
  "annotator": "J. Smith",
  "location": "Corning, CA — Block 4",
  "exported_at": "2025-06-25T18:00:00.000Z",
  "image_count": 12,
  "annotated_count": 10
}
```

`location` is omitted when blank. `annotated_count` counts images whose status is `"annotated"`.

Per-image annotation JSON (full image record as stored in IndexedDB):
```json
{
  "id": "<uuid>",
  "session": "COR_2025_06_25_R04",
  "annotator": "J. Smith",
  "captured_at": "2025-06-25T14:32:00.000Z",
  "image_width": 4032,
  "image_height": 3024,
  "disease": "present",
  "cultivar": "Manzanilla",
  "cultivar_susceptibility": "high",
  "kluepfal_rating": 3,
  "camera_height": "1.5 m",
  "camera_distance": "0.5 m",
  "camera_angle": null,
  "gall_distribution": "75_175cm",
  "bark_texture": "rough",
  "image_lighting": "overcast",
  "notes": null,
  "annotations": [
    {
      "id": "<uuid>",
      "type": "bbox",
      "coords": { "x": 310, "y": 240, "w": 85, "h": 72 },
      "annotation_type": "gall",
      "gall_stage": "aged",
      "gall_texture": ["cracking", "rugose"],
      "location_on_tree": "scaffold",
      "lighting": "sun_exposed"
    },
    {
      "id": "<uuid>",
      "type": "polygon",
      "points": [[310,240],[395,241],[390,310],[312,312]],
      "annotation_type": "gall",
      "gall_stage": "fresh",
      "gall_texture": [],
      "location_on_tree": "shoot",
      "lighting": null
    }
  ],
  "status": "annotated"
}
```

---

## Functionality

### Screen flow

```
Startup modal (session picker or new-session form)
        ↓
[S1] Session Home  ──── + New Image ────→ [S2] Camera Capture
        ↑                                         ↓ (capture / library)
        └──── Confirm ──── [S3b] Review ←── [S3] Annotation Canvas
```

### Startup / session picker

On first launch the app shows a blank new-session form. On subsequent launches, if no session is active, the app shows a **"Welcome Back"** picker listing all previous sessions stored on the device. Each row shows the session ID, annotator name, location, and image count. Tapping a row resumes that session immediately (one tap, no re-typing). A **+ Create New Session** button drops into the blank form.

### Session Home (S1)

- Scrollable grid of all images captured in the current session
- Each card shows a thumbnail, status badge (pending / annotated), and annotation count
- Progress bar tracks confirmed vs. total images
- **+ New Image** — opens camera capture
- **Export** — generates and delivers the ZIP for the entire session
- **New Session** — opens the new-session form (keeps annotator name, clears session ID and location)
- **Edit Session** — opens the session form pre-filled with current values
- **All Sessions** — opens a modal listing every session stored on the device (by session ID, with image count and Active badge); each entry has a **Delete** button that removes all images and annotations for that session after confirmation; deleting the active session clears the active state and prompts for a new one
- **⚙** — placeholder button (disabled; reserved for future settings)

### Camera Capture (S2)

- Opens rear camera via `getUserMedia`
- **Library** button accepts any image from the device photo library
- Camera stream is stopped immediately on exit to release hardware
- On Android devices with multiple cameras, a camera selector dropdown is shown

### Annotation Canvas (S3)

- Image scaled to fit the screen with `displayScale`; canvas dimensions match
- **Bounding box tool** (default): drag to draw; rubber-band preview follows pointer in real time
- **Polygon tool**: tap to place vertices; dashed live-preview line from last vertex to current pointer; snap ring on first vertex when 3+ points are placed; tap first vertex or press **Close** to finalise
- **↩ Undo**: if classification panel is open, discards the pending annotation; if a polygon is in progress, removes the last vertex; otherwise removes the last confirmed annotation
- **Done**: discards any unfinished annotation and opens the Review screen
- **Classification panel** opens after each annotation is drawn; overlays from the right (landscape) or bottom (portrait) without affecting `displayScale` or stored coordinates
- **Save** writes intermediate state to IndexedDB (crash recovery); blocked until the required Type field is selected
- **Reject** discards the pending annotation without saving

### Review Screen (S3b)

- Lists all confirmed annotations as instance cards with cropped thumbnails, drawing type, and classification summary
- Each instance card has a **✕** delete button to remove that annotation
- **Image metadata form** collects structured data about the whole image (see schema above); Disease is required, all other fields optional; Confirm is blocked until Disease is selected
- Camera Height and Camera Distance are pre-filled from the previously confirmed image in the same session
- **Confirm** writes the final authoritative record (annotations + metadata) to IndexedDB and returns to Session Home
- **Back** returns to the annotation canvas without saving review-screen data

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
- **Single-device, single-session.** There is no sync mechanism. Two annotators working on the same session ID from different devices will produce separate, non-merged ZIP exports.

### Annotation constraints
- **Manual annotation only.** No AI-assisted pre-labelling, no SAM2 integration, and no smart segmentation. Every annotation is drawn by hand.
- **No annotation editing.** Once an annotation is saved it cannot be moved, resized, or re-classified. The only correction available is deleting the annotation on the Review screen and redrawing it.
- **Bounding boxes are axis-aligned only.** There is no rotated-rectangle tool.
- **Polygons have no vertex dragging.** Vertices are placed by tap only; repositioning requires Undo back to that vertex.
- **No pan/zoom on the annotation canvas.** The image is scaled to fit the screen. On small phones with very high-resolution captures, fine-grained annotation of small galls may be difficult.

### Export constraints
- **One export per session, all images.** There is no selective export (e.g. "only annotated images" or a date range filter). The ZIP always contains every image captured under the current session ID.
- **No server upload.** Export produces a local file only. Uploading to a shared drive or S3 bucket requires a separate manual step.

---

## Future Work

### Near-term

- **Pan and zoom on annotation canvas.** Pinch-to-zoom with pointer events so annotators can work at full image resolution on small galls.
- **Annotation editing.** Tap a saved annotation to select it; drag handles to resize (bbox) or drag individual vertices (polygon).
- **Selective export.** Filter by status (`annotated`, `pending`) or date range before generating the ZIP.
- **Persistent storage request.** Call `navigator.storage.persist()` on Android to prevent Chrome from evicting IndexedDB data under storage pressure.
- **Back-button / swipe navigation hardening.** Android hardware back button currently does nothing; should map to the contextual back action for the active screen.
- **Settings screen.** The ⚙ placeholder button on the session home is reserved for app-level settings (e.g. snap radius, default tool, export options).

### Medium-term

- **SAM2 pre-segmentation.** Run SAM2 in the browser via ONNX Runtime Web or on a companion server; use the annotator's bounding box as the prompt and auto-generate a polygon mask for review.
- **Inter-annotator agreement UI.** When two annotators annotate the same image independently, show an overlay comparison and IoU scores to help resolve disagreements.
- **Cloud sync.** Optional upload of confirmed records to a shared S3 bucket or Supabase instance so multiple field devices contribute to one dataset.
- **Session merging.** Merge two ZIP exports from different annotators working the same orchard row, deduplicating by image UUID and flagging conflicts.
- **Kluepfal rating reference card.** In-app photo examples of each 0–9 rating level to improve inter-annotator consistency.

### Long-term

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

All application logic is in `app.js`. The two schema arrays (`CLASSIFICATION_SCHEMA` and `IMAGE_METADATA_SCHEMA`), the colour palette (`styles.css` `:root`), and the polygon snap threshold (`SNAP_RADIUS`) are the main configuration points — they are commented and grouped at the top of their respective sections.

---

## License

See [LICENSE](./LICENSE).
