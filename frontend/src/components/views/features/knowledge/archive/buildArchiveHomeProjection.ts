import {
  DEFAULT_ARCHIVE_HOME_OPTIONS,
  type ArchiveHomeEmptyFlags,
  type ArchiveHomeProjection,
  type ArchiveHomeProjectionInput,
} from './archiveHomeModels';
import { buildArchiveAreaPills } from './buildArchiveAreaPills';
import { buildArchiveBrowseLinks } from './buildArchiveBrowseLinks';
import { buildArchiveMarkCalendarProjection } from './buildArchiveMarkCalendar';
import { buildArchiveRecentMilestones } from './buildArchiveRecentMilestones';
import { buildArchiveYouAreHere } from './buildArchiveYouAreHere';

function buildArchiveEmptyFlags(
  hasAnyMarks: boolean,
  recentMilestoneCount: number,
  areaPillCount: number,
): ArchiveHomeEmptyFlags {
  const noMarks = !hasAnyMarks;
  const noMilestones = recentMilestoneCount === 0;
  const noAreas = areaPillCount === 0;
  return {
    noMarks,
    noMilestones,
    noAreas,
    isEmpty: noMarks && noMilestones && noAreas,
  };
}

/**
 * Pure aggregation for Archive Home.
 * No scores, streaks, or evaluative fields.
 */
export function buildArchiveHomeProjection(
  input: ArchiveHomeProjectionInput,
): ArchiveHomeProjection {
  const options = input.options ?? {};
  const calendarYears = options.calendarYears ?? DEFAULT_ARCHIVE_HOME_OPTIONS.calendarYears;
  const recentMilestoneLimit = options.recentMilestoneLimit ?? DEFAULT_ARCHIVE_HOME_OPTIONS.recentMilestoneLimit;
  const areaLookbackMonths = options.areaLookbackMonths ?? DEFAULT_ARCHIVE_HOME_OPTIONS.areaLookbackMonths;
  const areaPillLimit = options.areaPillLimit ?? DEFAULT_ARCHIVE_HOME_OPTIONS.areaPillLimit;
  const locale = options.locale;
  const domainMarks = input.domainMarks ?? [];

  const markCalendar = buildArchiveMarkCalendarProjection(
    input.notes,
    domainMarks,
    { now: input.now, calendarYears, locale },
  );

  const youAreHere = buildArchiveYouAreHere(input.now, locale);

  const recentMilestones = buildArchiveRecentMilestones(input.notes, {
    limit: recentMilestoneLimit,
    now: input.now,
  });

  const areaPills = buildArchiveAreaPills(input.notes, {
    now: input.now,
    lookbackMonths: areaLookbackMonths,
    limit: areaPillLimit,
  });

  const browse = buildArchiveBrowseLinks(input.now, markCalendar, locale);

  const empty = buildArchiveEmptyFlags(
    markCalendar.hasAnyMarks,
    recentMilestones.length,
    areaPills.length,
  );

  return {
    frame: {
      title: '아카이브',
      subtitle: '돌아보며 남는 것들.',
      generatedAt: input.now.toISOString(),
    },
    youAreHere,
    markCalendar,
    recentMilestones,
    areaPills,
    browse,
    empty,
  };
}
