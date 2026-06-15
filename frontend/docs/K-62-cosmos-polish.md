# K-62 — Cosmos Polish

Preserves K-60 interaction model: single-click preview, double-click open.

## Changes

| Area | Improvement |
|------|-------------|
| Preview close | X button, backdrop dismiss, Escape (K-61) |
| Keyboard nav | Arrow keys cycle nodes; hint shown in toolbar when preview open |
| Selected visibility | Viewport pans to center previewed node |
| Zoom readability | Existing zoom controls; pan keeps node in view |
| Cluster clarity | Galaxy labels show `(nodeCount)` when cluster has 2+ nodes |

## Not changed

- Graph engine / force simulation
- Click model (preview vs open)
- HUD layout

## Evaluation: cluster indicators

Lightweight note-count suffix on galaxy labels adopted — improves clarity at medium zoom without new UI chrome.

Full cluster density heatmaps deferred to K-63.
