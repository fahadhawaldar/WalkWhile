import { Palette } from '../theme';
import { HistoryWalk } from './walkHistory';

/** "Today, 2:15 PM", "Yesterday, 9:00 AM" or "Sat 24 Oct, 2:15 PM". */
export function formatWalkDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  const day = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}

export function outcomeBadge(walk: HistoryWalk, colors: Palette): { label: string; color: string; background: string } {
  if (walk.outcome === 'interrupted') {
    return { label: 'Ended early', color: colors.inkSecondary, background: colors.surfaceMuted };
  }
  return walk.returnedOnTime
    ? { label: 'On time', color: colors.mintInk, background: colors.mintSoft }
    : { label: 'Late', color: colors.warning, background: colors.warningSoft };
}
