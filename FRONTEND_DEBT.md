# Frontend debt

Known UI issues that don't block shipping but should be addressed eventually.
Shippable fixes are tracked here to prevent them being forgotten between
feature batches. Each entry: one line, date-stamped, enough to locate.

## Dev / URL-flagged surfaces

### 2026-04-20 — Lang-toggle button overlaps heading on narrow viewports
Affects the `.lang-toggle-fixed` button at top-right, which is positioned
absolutely and overlays content underneath. Visible on the mock reason-panel
harness (`?mock=training-panel`) and the dev training picker (`?training-dev=1`)
at viewports ≤ ~400 px — heading text is truncated by the EN/FR button.
Dev-only UI behind URL flags; no end-user impact. Fix: shift the lang toggle
into a flow layout or add right-side padding to affected heading containers.
