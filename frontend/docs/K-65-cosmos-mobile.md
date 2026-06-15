# K-65 Cosmos Mobile Polish

## Changes (`NoteGraphView` with `compactChrome`)

### Search width

- Search input uses `width: 100%` with flex `1 1 96px`, max 180px
- Toolbar wraps on narrow viewports (`flexWrap: wrap`)

### Filter chips

- On `compactChrome`, relationship filter renders as horizontal chip buttons (44px min height)
- Desktop retains `<select>` dropdown

### Node selection visibility

- Active node rings enlarged on compact: outer r+12 / inner r+8 with higher stroke opacity

### Preview panel (`CosmosGraphPreviewPanel`)

- Sheet layout: safe-area bottom padding
- Content padding increased (`10px 16px 16px`)

### i18n

- `graphFolderFallback` replaces hardcoded `폴더 N` in folder legend

## Unchanged

- Network vs Cosmos mode toggle
- Isolated node filter
- Enter/Escape preview keyboard model
- `layout="sheet"` on mobile vs `rail` on desktop

## Optional (deferred)

- Cluster note counts when zoomed out — not implemented; clarity gain uncertain at current zoom levels

## Verification

- [ ] Search field usable on narrow graph view
- [ ] Filter chips tappable without opening native select
- [ ] Selected node ring visible on phone
- [ ] Preview sheet clears safe area on notched devices
