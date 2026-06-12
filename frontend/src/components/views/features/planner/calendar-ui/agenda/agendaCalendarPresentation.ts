import type {
  PlannerAgendaItem,
  PlannerAgendaItemKind,
  PlannerAgendaViewPayload,
} from '../../calendar';
import { formatPlannerCountdownLabel } from '../../calendar/plannerCalendarPresentation';

export interface AgendaDaySection {
  dateKey: string;
  items: readonly PlannerAgendaItem[];
}

const EVENT_KINDS: readonly PlannerAgendaItemKind[] = ['all-day-event', 'timed-event'];
const MILESTONE_KIND: PlannerAgendaItemKind = 'milestone';
const SCHEDULE_KIND: PlannerAgendaItemKind = 'schedule-block';
const TODO_KIND: PlannerAgendaItemKind = 'todo';

export function agendaHasContent(agenda: PlannerAgendaViewPayload): boolean {
  return agenda.countdownSection.length > 0 || agenda.dayGroups.length > 0;
}

export function buildAgendaDaySections(
  dayGroups: readonly PlannerAgendaViewPayload['dayGroups'],
  kinds: readonly PlannerAgendaItemKind[],
): AgendaDaySection[] {
  return dayGroups
    .map(group => ({
      dateKey: group.dateKey,
      items: group.items.filter(item => kinds.includes(item.kind)),
    }))
    .filter(section => section.items.length > 0);
}

export function buildAgendaEventSections(
  dayGroups: readonly PlannerAgendaViewPayload['dayGroups'],
): AgendaDaySection[] {
  return dayGroups
    .map(group => ({
      dateKey: group.dateKey,
      items: group.items.filter(item =>
        EVENT_KINDS.includes(item.kind) || item.kind === MILESTONE_KIND,
      ),
    }))
    .filter(section => section.items.length > 0);
}

export function buildAgendaScheduleSections(
  dayGroups: readonly PlannerAgendaViewPayload['dayGroups'],
): AgendaDaySection[] {
  return buildAgendaDaySections(dayGroups, [SCHEDULE_KIND]);
}

export function buildAgendaTodoSections(
  dayGroups: readonly PlannerAgendaViewPayload['dayGroups'],
): AgendaDaySection[] {
  return buildAgendaDaySections(dayGroups, [TODO_KIND]);
}

export function resolveAgendaNoteId(item: PlannerAgendaItem): string | null {
  if (item.sourceRef.type === 'note') return item.sourceRef.id;
  if (item.kind === 'countdown' && item.sourceRef.type === 'note-event') return item.sourceRef.id;
  return null;
}

export function formatAgendaCountdownLabel(
  item: PlannerAgendaItem,
  locale: 'en' | 'ko' | 'ja',
): string {
  const daysUntil = item.meta.daysUntil;
  if (typeof daysUntil !== 'number') return item.title;
  return formatPlannerCountdownLabel(daysUntil, locale);
}

export function formatAgendaEventTimeLabel(item: PlannerAgendaItem): string {
  if (item.kind === 'all-day-event') return 'All day';
  if (item.kind === 'milestone') return 'Milestone';
  return item.meta.startTime ?? '';
}

export function formatAgendaScheduleTimeLabel(item: PlannerAgendaItem): string {
  const start = item.meta.startTime ?? '';
  const end = item.meta.endTime ?? '';
  if (start && end) return `${start}–${end}`;
  return start || end;
}

export function isAgendaMilestone(item: PlannerAgendaItem): boolean {
  return item.kind === MILESTONE_KIND;
}

export function isAgendaEventKind(item: PlannerAgendaItem): boolean {
  return EVENT_KINDS.includes(item.kind);
}
