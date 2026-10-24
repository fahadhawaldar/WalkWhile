import { COLORS } from '../theme/colors';
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

export function outcomeBadge(walk: HistoryWalk): { label: string; color: string; background: string } {
  if (walk.outcome === 'interrupted') {
    return { label: 'Stopped early', color: COLORS.textSecondary, background: COLORS.surfaceSubtle };
  }
  return walk.returnedOnTime
    ? { label: 'Back on time', color: COLORS.safe, background: '#ECFDF5' }
    : { label: 'Back late', color: '#B45309', background: '#FEF3C7' };
}
