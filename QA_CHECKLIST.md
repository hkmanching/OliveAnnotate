# OliveAnnotate — Cross-Device QA Checklist

**App version:** v0 (Phase 7 complete)  
**Devices under test:** iPad mini 2021 (iOS Safari PWA) · Samsung Galaxy S7 (Android Chrome PWA)  
**Legend:** `[ ]` not tested · `[P]` pass · `[F]` fail · `[N/A]` not applicable

---

## 1. First-Launch & Setup Modal

### 1.1 Welcome modal appears on fresh install
**What to test:** Clear app storage (Settings → Safari/Chrome → Clear Data), then open the app.  
**Expected:** Setup modal appears with "Annotator name" and "Session ID" fields; button reads **Start Session**.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 1.2 Start Session creates session and dismisses modal
**What to test:** Fill in both fields, tap **Start Session**.  
**Expected:** Modal dismisses; header shows session ID; home grid is empty with olive emoji empty state.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 1.3 Settings button re-opens modal with existing values
**What to test:** From home screen, tap ⚙ (settings) button.  
**Expected:** Modal reopens with previously entered values pre-filled; button reads **Update Session**.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 1.4 Changing session ID creates a new session context
**What to test:** Open settings, change Session ID to a new string, tap **Update Session**, then add an image.  
**Expected:** New session ID appears in header; previously captured images from prior session are NOT shown (they remain in DB keyed to old session).

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 1.5 Re-entering original session ID resumes session
**What to test:** Open settings, re-enter original Session ID, tap **Update Session**.  
**Expected:** Prior images reappear in the home grid; progress counter reflects their annotation status.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## 2. PWA Installation

### 2.1 iOS Safari — Add to Home Screen
**What to test:** Open URL in Safari. Tap Share → Add to Home Screen → Add.  
**Expected:** Icon appears on home screen with "OliveAnnotate" label; icon uses olive-branch artwork (not a screenshot).

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |

### 2.2 iOS PWA launch — standalone (no browser chrome)
**What to test:** Launch from home screen icon.  
**Expected:** App opens full-screen with no Safari address bar or tab bar; status bar is transparent/dark.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |

### 2.3 Android Chrome — Install banner / manual install
**What to test:** Open URL in Chrome. Tap ⋮ → Add to Home Screen, or accept install banner if it appears.  
**Expected:** Icon appears on home screen with "OliveAnnotate" label.

| Device | Result | Notes |
|--------|--------|-------|
| Galaxy S7 | [ ] | |

### 2.4 Android PWA launch — standalone
**What to test:** Launch from home screen icon.  
**Expected:** App opens without Chrome browser chrome; theme-color amber bar visible in task switcher.

| Device | Result | Notes |
|--------|--------|-------|
| Galaxy S7 | [ ] | |

### 2.5 Safe-area insets — notch / home indicator clearance
**What to test:** On iPhone-class device or notched Android, check all four edges.  
**Expected:** No UI element is clipped by notch, status bar, or home indicator gesture area.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## 3. Offline Operation

### 3.1 Service worker installs on first load
**What to test:** Open app in browser (not PWA), open DevTools → Application → Service Workers.  
**Expected:** `service-worker.js` status shows **activated and running**; no registration errors in console.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 3.2 App shell loads offline (hard reload after WiFi off)
**What to test:** Load app while online, then turn off WiFi/data. Reload the page (or relaunch PWA).  
**Expected:** App loads fully — home screen, no network errors. CDN libraries (idb, JSZip) served from cache.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 3.3 Capture and annotate image while offline
**What to test:** With WiFi off, capture a new image, draw a bounding box, classify, confirm.  
**Expected:** Full annotation flow completes without errors; data persists in IndexedDB.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 3.4 Export while offline
**What to test:** With WiFi off, tap Export on home screen.  
**Expected:** ZIP file generates and share/download sheet appears (export uses only local data — no network needed).

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## 4. Camera Capture

### 4.1 Camera permission prompt
**What to test:** Tap **+ New Image** on first use.  
**Expected:** OS permission dialog appears asking for camera access. Granting permission shows live viewfinder.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 4.2 Live viewfinder fills screen (rear camera)
**What to test:** Open camera screen.  
**Expected:** Rear camera stream fills the screen edge-to-edge with `object-fit: cover`; no black bars; portrait and landscape both work.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 4.3 Capture button takes photo and advances to annotation
**What to test:** Tap the large white capture button.  
**Expected:** Shutter fires; app transitions to annotation canvas with captured image displayed.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 4.4 Library button picks image from photo library
**What to test:** Tap **Library** button; pick a saved photo.  
**Expected:** Chosen image appears in annotation canvas.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 4.5 Back button exits camera without saving
**What to test:** Open camera, then tap **← Back** without taking a photo.  
**Expected:** Returns to session home; no new image card is added.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 4.6 Camera stream stops on exit
**What to test:** After tapping Back from camera screen, check that camera LED is off (device indicator) and track is stopped.  
**Expected:** Camera hardware is released; no ongoing battery drain from open stream.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## 5. Annotation Canvas — Bounding Box

### 5.1 Canvas scales to fit image (portrait image, landscape device)
**What to test:** Capture a portrait-orientation photo; rotate device to landscape.  
**Expected:** Image fits within canvas with letterboxing; no overflow or clipping; canvas dimensions match image aspect ratio.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 5.2 Bbox tool is active by default
**What to test:** Open annotation screen (Bbox button should appear highlighted).  
**Expected:** `#tool-bbox` has `.active` class and `aria-pressed="true"`; cursor shows crosshair.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 5.3 Draw bounding box — finger (portrait)
**What to test:** In portrait orientation, drag finger diagonally across the image.  
**Expected:** Orange rectangle drawn in real time; rubber-band preview follows pointer; no accidental page scroll.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 5.4 Draw bounding box — finger (landscape)
**What to test:** Same as 5.3 in landscape orientation.  
**Expected:** Rectangle draws correctly; classification panel NOT visible until drag is released.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 5.5 Draw bounding box — Apple Pencil
**What to test:** Use Apple Pencil to draw a bounding box.  
**Expected:** Pencil input recognised as pointer; box draws without triggering any finger gesture.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | N/A on Galaxy S7 |

### 5.6 Classification panel opens after bbox is drawn
**What to test:** Complete a drag; release pointer.  
**Expected:** Classification panel slides in (from right in landscape, from bottom in portrait); four chip groups visible (Severity, Gall Age, Location, Confidence).

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 5.7 Minimum-size bbox is rejected
**What to test:** Tap without dragging (or drag only 1–2 px).  
**Expected:** No annotation is created; classification panel does NOT open; no error toast.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## 6. Annotation Canvas — Polygon

### 6.1 Switch to Polygon tool
**What to test:** Tap **Polygon** button in toolbar.  
**Expected:** `#tool-poly` becomes active; `#tool-close-poly` button appears; `#tool-bbox` deselected.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 6.2 Place polygon vertices — finger
**What to test:** Tap three or more distinct points on the image.  
**Expected:** Each tap places a vertex (dot); edges drawn between consecutive vertices; live dashed line from last vertex to current finger position.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 6.3 Place polygon vertices — Apple Pencil
**What to test:** Tap vertices with Apple Pencil.  
**Expected:** Same vertex placement behaviour as finger; no stylus-specific artifacts.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | N/A on Galaxy S7 |

### 6.4 Snap ring visible on first vertex (3+ points placed)
**What to test:** Place 3 or more vertices; hover/hold finger near the first vertex.  
**Expected:** Dashed snap ring (radius 22 px) appears around the first vertex to indicate close-polygon zone.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 6.5 Tap first vertex to close polygon
**What to test:** With 3+ vertices placed, tap inside the snap ring of the first vertex.  
**Expected:** Polygon closes; filled semi-transparent shape shown; classification panel opens.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 6.6 Close Poly button closes polygon
**What to test:** With 3+ vertices placed, tap **Close** button in toolbar.  
**Expected:** Polygon closes and classification panel opens (same as snapping).

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 6.7 Cannot close polygon with fewer than 3 vertices
**What to test:** Place 1 or 2 vertices, then tap **Close**.  
**Expected:** Nothing happens (polygon not finalized); no error state or crash.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 6.8 Undo removes last polygon vertex
**What to test:** Place several polygon vertices, then tap **↩ Undo**.  
**Expected:** Last vertex is removed; polygon preview updates; live line reattaches to the new last vertex.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 6.9 Switching away from polygon tool clears in-progress polygon
**What to test:** Place 2 polygon vertices, then tap **Bbox** tool button.  
**Expected:** In-progress polygon vertices cleared; canvas redraws with no partial polygon; Close button hides.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## 7. Classification Panel

### 7.1 Portrait layout — panel slides up from bottom
**What to test:** Draw a bbox/polygon in portrait mode; watch panel animation.  
**Expected:** Panel slides in from the bottom; canvas image fully visible above panel; panel scrollable if content overflows.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 7.2 Landscape layout — panel slides in from right
**What to test:** Draw a bbox/polygon in landscape mode.  
**Expected:** Panel slides in from the right side; image still fully visible on the left; canvas dimensions unchanged (panel is overlay, not flex sibling).

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 7.3 All four chip groups rendered
**What to test:** Open classification panel and inspect.  
**Expected:** Groups in order: Severity (5 options), Gall Age (3), Location (4), Confidence (3). Labels match spec.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 7.4 Chip selection — single select per group
**What to test:** Tap different chips within a group.  
**Expected:** Only one chip can be selected per group; previously selected chip deselects; selected chip shows amber fill.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 7.5 Save blocked if required field missing
**What to test:** Select chips in 3 out of 4 groups; tap **Save**.  
**Expected:** Toast shows "Select: <missing group name>"; annotation NOT saved; panel stays open.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 7.6 Save with all fields selected
**What to test:** Select one chip in each group; tap **Save**.  
**Expected:** Panel closes; annotation appears on canvas with label (e.g. "1"); chip selections reset for next annotation.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 7.7 Reject annotation
**What to test:** Draw an annotation, open classification panel, tap **Reject**.  
**Expected:** Panel closes; annotation NOT added to canvas; no record saved; canvas returns to ready state.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## 8. Undo and Multi-Annotation Flow

### 8.1 Undo removes last confirmed bbox annotation
**What to test:** Save two bbox annotations; tap **↩ Undo**.  
**Expected:** Most recent annotation is removed from canvas; annotation count decrements.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 8.2 Undo removes last confirmed polygon annotation
**What to test:** Save two polygon annotations; tap **↩ Undo**.  
**Expected:** Most recent polygon removed from canvas.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 8.3 Undo when classification panel is open discards pending annotation
**What to test:** Draw a bbox (panel opens); tap **↩ Undo**.  
**Expected:** Panel closes; pending annotation discarded; canvas reverts to state before the draw.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 8.4 Multiple annotations of mixed types coexist
**What to test:** Add one bbox and one polygon to the same image, save both.  
**Expected:** Both shapes visible on canvas simultaneously with correct labels; colours consistent.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 8.5 Crash-recovery — annotation survives forced app close
**What to test:** Save one annotation (but do NOT tap Done). Force-quit the app. Reopen and navigate back to the same image.  
**Expected:** Saved annotation is present (intermediate write to IndexedDB after each Save click preserves data).

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## 9. Done / Review Screen

### 9.1 Done button advances to Review screen
**What to test:** After saving at least one annotation, tap **Done**.  
**Expected:** Review screen appears showing a list of annotation instance cards; canvas is no longer visible.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 9.2 Instance list shows correct annotation count
**What to test:** Check the instance list count against how many annotations were saved.  
**Expected:** One card per confirmed annotation; no duplicates or missing entries.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 9.3 Instance card shows shape type, severity label, and thumbnail
**What to test:** Inspect each instance card.  
**Expected:** Card shows annotation type (Bbox/Polygon), severity label, and a cropped thumbnail of the annotated region. If crop is too small to render, placeholder `?` tile shown instead.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 9.4 Rating strip — tap to select rating
**What to test:** Tap a number on the 0–10 Kluepfel scale strip.  
**Expected:** Tapped number highlights (amber fill); previous selection deselects; only one rating selected at a time.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 9.5 Rating is optional — Confirm works with no rating selected
**What to test:** Leave rating unselected; fill in notes; tap **Confirm**.  
**Expected:** Record saves with `image_rating: null`; returns to session home; card marked annotated.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 9.6 Notes field — free text entry
**What to test:** Tap notes textarea; type text (e.g. "Manzanilla, overcast").  
**Expected:** Keyboard opens; text entry works normally; no auto-correct mangles field content. (Note: `autocorrect="off"` is not set on the textarea — verify if auto-correct causes problems.)

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 9.7 Back button returns to annotation canvas
**What to test:** From Review screen, tap **← Back** or **Back** button.  
**Expected:** Returns to annotation canvas; in-progress annotation state preserved (annotations on canvas still visible).

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 9.8 Confirm saves record and returns to Session Home
**What to test:** Select a rating, enter notes, tap **Confirm**.  
**Expected:** Returns to session home; image card shows thumbnail; status indicator is "annotated" (green/filled).

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 9.9 Undo-all then Done — status reverts to pending
**What to test:** Save annotations, undo all of them, tap **Done**, tap **Confirm**.  
**Expected:** Image card status is "pending" (not "annotated") because zero annotations were confirmed.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## 10. Session Home

### 10.1 Image grid populates after confirm
**What to test:** Complete the full capture → annotate → confirm flow.  
**Expected:** Image card appears in grid with thumbnail, timestamp, and annotation count badge.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 10.2 Progress bar and counter update
**What to test:** Add multiple images; annotate some, leave others pending.  
**Expected:** "N of M annotated" text updates; progress bar fill reflects correct percentage.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 10.3 Tap image card reopens annotation canvas
**What to test:** Tap an existing image card in the grid.  
**Expected:** Annotation screen opens with that image; previously saved annotations rendered on canvas.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 10.4 Empty state visible when no images captured
**What to test:** Start a brand-new session; check home screen.  
**Expected:** Olive emoji empty state shown ("No images yet…"); grid is empty; progress counter reads "0 of 0 annotated".

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 10.5 ObjectURL memory management — thumbnails revoke on re-render
**What to test:** Navigate home → capture → home multiple times (5+ times). Monitor memory in browser DevTools if possible.  
**Expected:** No runaway memory growth from un-revoked ObjectURLs.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## 11. Export

### 11.1 Export button triggers ZIP generation
**What to test:** With at least one annotated image, tap **Export** on home screen.  
**Expected:** Brief loading state (toast or disabled button); ZIP file generated; share/download sheet appears.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 11.2 iOS — share sheet appears (Web Share API)
**What to test:** Tap Export on iOS PWA.  
**Expected:** Native iOS share sheet appears with the `.zip` file attached; can be saved to Files app or shared via AirDrop/Mail.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | N/A on Android |

### 11.3 Android — file download triggers
**What to test:** Tap Export on Android.  
**Expected:** Browser download notification appears; `.zip` file saved to Downloads folder with correct filename (e.g. `OliveAnnotate_<session>_<date>.zip`).

| Device | Result | Notes |
|--------|--------|-------|
| Galaxy S7 | [ ] | N/A on iOS |

### 11.4 ZIP contains session_metadata.json
**What to test:** Open exported ZIP; inspect `session_metadata.json`.  
**Expected:** JSON with `session`, `annotator`, `exported_at`, and `image_count` fields. Values match session settings.

| Device | Result | Notes |
|--------|--------|-------|
| (desktop unzip) | [ ] | |

### 11.5 ZIP contains JPEG per image
**What to test:** Open ZIP; check for `IMG_<uuid>.jpg` files.  
**Expected:** One JPEG per captured image; file readable and not corrupt; compression is STORE (no re-compression of already-compressed JPEG).

| Device | Result | Notes |
|--------|--------|-------|
| (desktop unzip) | [ ] | |

### 11.6 ZIP contains annotation JSON per image
**What to test:** Open ZIP; check for `IMG_<uuid>_annotations.json` files.  
**Expected:** One JSON per image; fields: `id`, `session`, `annotator`, `captured_at`, `image_width`, `image_height`, `image_rating`, `notes`, `annotations` array.

| Device | Result | Notes |
|--------|--------|-------|
| (desktop unzip) | [ ] | |

### 11.7 Annotation JSON structure — bbox entry
**What to test:** Inspect an annotation entry of type `bbox` in the JSON.  
**Expected:**
```json
{
  "id": "<uuid>",
  "type": "bbox",
  "coords": { "x": <int>, "y": <int>, "w": <int>, "h": <int> },
  "severity": <0–4>,
  "gall_age": "fresh|aged|old",
  "location": "trunk|scaffold|lateral|shoot",
  "confidence": "sure|unsure|flag_expert"
}
```

| Device | Result | Notes |
|--------|--------|-------|
| (desktop unzip) | [ ] | |

### 11.8 Annotation JSON structure — polygon entry
**What to test:** Inspect an annotation entry of type `polygon`.  
**Expected:**
```json
{
  "id": "<uuid>",
  "type": "polygon",
  "points": [[x0,y0],[x1,y1],...],
  "severity": <0–4>,
  "gall_age": "...",
  "location": "...",
  "confidence": "..."
}
```

| Device | Result | Notes |
|--------|--------|-------|
| (desktop unzip) | [ ] | |

### 11.9 Export with zero images shows informative message
**What to test:** Tap Export when session has no captured images.  
**Expected:** Toast or alert tells user there is nothing to export; no empty ZIP generated.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## 12. Coordinate Accuracy

### 12.1 Bbox coordinates are in original image pixel space
**What to test:** Using a test image with known features (e.g. a gall at pixel [320, 240] in a 1920×1080 image), draw a bbox tightly around it. Export and inspect JSON `coords`.  
**Expected:** `x`, `y`, `w`, `h` values correspond to original image pixels, NOT canvas display pixels. Verify by: `coords.x / image_width ≈ 0.167`, `coords.y / image_height ≈ 0.222` for the example above.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 12.2 Polygon points are in original image pixel space
**What to test:** Same test image; draw a polygon around a known region; export.  
**Expected:** Each `[x, y]` in `points` maps to original image pixel space. Cross-check by overlaying the annotation JSON on the JPEG using a Python script or image viewer.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 12.3 Coordinates are consistent between portrait and landscape
**What to test:** Draw a bbox in portrait orientation; export. Rotate device to landscape, reopen the image, draw a bbox over the same region; export. Compare JSON coords.  
**Expected:** Both `coords` objects should be nearly identical (within ±2 px rounding) since coordinates are stored in image space regardless of display orientation.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 12.4 Opening classification panel does not shift coordinates
**What to test:** Draw a bbox; note the rubber-band rectangle position relative to image features. After panel opens, verify the saved annotation (on canvas after Save) aligns with original features.  
**Expected:** Annotation aligns correctly — the panel is an absolute overlay so `displayScale` is not recalculated when it opens.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## 13. Edge Cases and Regression

### 13.1 Very large image (12 MP+ camera) — canvas renders without crash
**What to test:** Capture a full-resolution photo from rear camera.  
**Expected:** App handles large ImageBitmap without memory crash; canvas scales correctly; no console errors.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 13.2 Device rotation mid-annotation redraws canvas correctly
**What to test:** Begin drawing a bbox; rotate device mid-drag. Release pointer.  
**Expected:** Canvas resizes to new orientation; any previously confirmed annotations redraw at correct positions.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 13.3 Many images in session — home grid scrolls
**What to test:** Capture 20+ images in one session.  
**Expected:** Home grid scrolls smoothly; progress bar and counter update correctly for all images.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 13.4 Toast notifications are readable
**What to test:** Trigger a toast (e.g. incomplete classification, successful export).  
**Expected:** Toast appears at top/bottom of screen; text is readable; disappears after ~2.5 s; does not block UI interaction.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

### 13.5 No console errors on normal flow
**What to test:** Run through a full session (capture → annotate → review → confirm → export) with browser DevTools console open.  
**Expected:** Zero errors (warnings acceptable); no unhandled promise rejections.

| Device | Result | Notes |
|--------|--------|-------|
| iPad mini 2021 | [ ] | |
| Galaxy S7 | [ ] | |

---

## Sign-Off

| Tester | Date | iOS result | Android result |
|--------|------|-----------|----------------|
| | | | |

**Known issues at sign-off:**

- 

---

*Generated for OliveAnnotate v0 — Phase 8 QA Checklist*
