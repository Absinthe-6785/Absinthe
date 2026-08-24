export function isRoutinePresetMenuOutsideTarget(
  container: HTMLElement | null,
  target: EventTarget | null,
): boolean {
  if (!container || !target || typeof (target as { nodeType?: unknown }).nodeType !== 'number') return true;
  return !container.contains(target as Node);
}
