import type { LiveStats } from './types';

export const MOODS = ['chill', 'waiting', 'impatient', 'angry', 'unhinged'] as const;
export type Mood = typeof MOODS[number];

export const MOOD_EMOJIS: Record<Mood, string> = {
  chill: '😊',
  waiting: '🤨',
  impatient: '😤',
  angry: '😡',
  unhinged: '🤬',
};

export function getMood(live: LiveStats): Mood {
  const now = Date.now();
  if (live.messages === 0) {
    const hour = new Date().getHours();
    if (hour < 10) return 'waiting';
    if (hour < 14) return 'impatient';
    if (hour < 18) return 'angry';
    return 'unhinged';
  }
  if (live.lastActivityTs === 0) return 'waiting';
  const minsSinceLast = (now - live.lastActivityTs) / 60_000;
  if (minsSinceLast < 5) return 'chill';
  if (minsSinceLast < 30) return 'waiting';
  if (minsSinceLast < 90) return 'impatient';
  if (minsSinceLast < 180) return 'angry';
  return 'unhinged';
}
