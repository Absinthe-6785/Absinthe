# K-41 Empty Vault Audit

**Branch:** `k41-cosmos-onboarding`

---

## Scenarios

### No notes (`no-notes`)

| Surface | Before K-41 | After K-41 |
|---------|-------------|------------|
| Cosmos graph | Generic “begins here” copy | “Welcome to your Cosmos” + **Create Note** CTA |
| Discover panel | Generic empty | “No discoveries yet” |
| Dashboard | Standard widgets | **Start your Cosmos** 4-step guide + tour |

### Notes, no links (`no-links`)

| Surface | Before K-41 | After K-41 |
|---------|-------------|------------|
| Cosmos graph | Shown for ≤2 nodes only | Shown for **any** unlinked vault |
| Copy | Generic tiers hint | “Not connected yet” + **Learn about linking** |
| Discover | Generic empty | Hint about wiki links / relations |
| Insights | Empty suggestions | Existing hint retained |

### Linked, no discoveries (`linked-healthy`)

| Surface | Before K-41 | After K-41 |
|---------|-------------|------------|
| Discover panel | “No discoveries yet” | **“Great job — network is healthy”** |
| Cosmos graph | Normal visualization | No overlay |

### First discovery (`has-discoveries`)

| Surface | Behavior |
|---------|----------|
| Discover panel | **First Discovery Found** banner (dismissible, local only) |
| Dashboard card | Discovery counts (unchanged) |

---

## Gaps (K-42)

- Empty Actions panel guidance when no actions available
- Per-note “link this note” inline hint in editor (not implemented)

---

## Validation

- [ ] Empty vault → Create Note CTA works
- [ ] 2 unlinked notes → Learn about linking opens Links panel
- [ ] Linked vault, no discoveries → healthy Discover message
- [ ] First discovery → banner shows once, dismiss persists
