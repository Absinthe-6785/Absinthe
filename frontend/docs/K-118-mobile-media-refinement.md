# K-118 Mobile & Rich Media Refinement

## Summary

K-118 polishes mobile UX and rich media interactions: fullscreen image gallery, file/embed preview cards, mobile editor touch targets, and cleaner clipboard labels.

## Before / After

### Images

| Before | After |
|--------|-------|
| Inline only, resize handle | Click → fullscreen viewer |
| No gallery | Arrow / swipe between consecutive images |
| — | Zoom, copy, save |

### Links & files

| Before | After |
|--------|-------|
| Raw `https://…` in paragraphs | Preview cards: YouTube, PDF, Audio, Video, Website |
| Basic audio URL field | Filename, duration, 44px play button |
| Long URLs visible | Collapsed URL line under title |

### Mobile editor

| Before | After |
|--------|-------|
| 24px toolbar buttons | 44px touch targets on ≤768px |
| 32px block handles | 40px on coarse pointers |
| Possible horizontal overflow | `overflow-x: hidden` on editor root |

## Mobile matrix

| Width | Notes | Planner | Health | Archive |
|-------|-------|---------|--------|---------|
| 320 | New Note top bar, embed cards stack | Sticky + New event | Nav scroll | Single column |
| 375 | Image viewer swipe | Section nav | — | Collapsed browse |
| 768 | Toolbar 44px | — | — | — |
| 1440 | Hover image controls | Desktop layout | — | max-w-3xl |

## Media interaction matrix

| Type | Read | Edit | Clipboard plain |
|------|------|------|-----------------|
| Image | Fullscreen gallery | Click to preview | `Image` / caption |
| PDF URL | Preview card + Open | Card + URL field | `document.pdf` |
| Audio block | Play + duration | URL form | `lecture.mp3` |
| Video URL | Thumbnail + play | Card + URL | `clip.mp4` |
| YouTube | Embedded iframe | Preview card | `YouTube` |
| Web link | Favicon + host | Card + URL | hostname |

## QA checklist

### Images (A)

- [ ] Click image → fullscreen viewer
- [ ] Arrow keys / buttons navigate consecutive images
- [ ] Zoom +/- and pinch on mobile
- [ ] Swipe left/right between images when not zoomed
- [ ] Copy and Save work
- [ ] Esc closes viewer

### Files (B)

- [ ] Lone `.pdf` URL → PDF card with Open
- [ ] Audio block shows duration after load
- [ ] Lone `.mp4` URL → thumbnail + play

### Embeds (C)

- [ ] YouTube URL embeds in read mode
- [ ] Long web URLs show favicon + host, not full URL
- [ ] Code blocks retain copy button

### Mobile editor (D)

- [ ] Block handles easier to tap on phone
- [ ] Image ⋯ menu 44px
- [ ] Toolbar buttons 44px on mobile

### Layouts (E)

- [ ] No double scrollbars on Notes / Archive
- [ ] No clipped embed cards at 320px

### Clipboard (F)

- [ ] Ctrl+C on image → image/png + plain label
- [ ] Ctrl+C on embed paragraph → plain hostname/filename

## Audits

```powershell
npm test -- k118
```

| Audit | File |
|-------|------|
| Image | `k118ImageAudit.ts` |
| Gallery | `k118GalleryAudit.ts` |
| File | `k118FileAudit.ts` |
| Embed | `k118EmbedAudit.ts` |
| Mobile editor | `k118MobileEditorAudit.ts` |
| Mobile layout | `k118MobileLayoutAudit.ts` |
| Clipboard | `k118ClipboardAudit.ts` |
| Preview | `k118PreviewAudit.ts` |

## Constraints

No schema, storage, IndexedDB, knowledge-engine, or Cosmos changes.
