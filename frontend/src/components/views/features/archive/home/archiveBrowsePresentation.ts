import type { ArchiveBrowseProjection, ArchivePeriodRef } from '../../knowledge/archive';

export type ArchiveBrowseDestination =
  | { type: 'period'; ref: ArchivePeriodRef }
  | { type: 'areas-index' }
  | { type: 'timeline'; defaultPeriod: ArchivePeriodRef }
  | { type: 'custom' };

export interface ArchiveBrowseLinkItem {
  id: string;
  label: string;
  destination: ArchiveBrowseDestination;
}

/** Maps projection.browse fields into Home display order — labels/refs come from projection only. */
export function listArchiveBrowseLinkItems(browse: ArchiveBrowseProjection): ArchiveBrowseLinkItem[] {
  const items: ArchiveBrowseLinkItem[] = [
    {
      id: 'this-month',
      label: browse.thisMonth.label,
      destination: { type: 'period', ref: browse.thisMonth },
    },
    {
      id: 'this-quarter',
      label: browse.thisQuarter.label,
      destination: { type: 'period', ref: browse.thisQuarter },
    },
    {
      id: 'this-year',
      label: browse.thisYear.label,
      destination: { type: 'period', ref: browse.thisYear },
    },
    {
      id: 'all-areas',
      label: browse.allAreas.label,
      destination: { type: 'areas-index' },
    },
    {
      id: 'timeline',
      label: browse.timeline.label,
      destination: {
        type: 'timeline',
        defaultPeriod: browse.timeline.defaultPeriod,
      },
    },
  ];

  if (browse.recentYearsWithMarks) {
    for (const ref of browse.recentYearsWithMarks) {
      items.push({
        id: `recent-year-${ref.year ?? ref.label}`,
        label: ref.label,
        destination: { type: 'period', ref },
      });
    }
  }

  items.push({
    id: 'custom',
    label: browse.custom.label,
    destination: { type: 'custom' },
  });

  return items;
}

/** Period-only browse links for Archive Period branch. */
export function listArchivePeriodBrowseLinks(browse: ArchiveBrowseProjection): ArchiveBrowseLinkItem[] {
  return listArchiveBrowseLinkItems(browse).filter(link => link.destination.type === 'period');
}
