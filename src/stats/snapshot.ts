import type { Snapshot } from '../types';
import { getMood } from '../mood';
import { readStatsCache, scanLiveToday } from './reader';
import {
  getAvgTokens, getLast7Days, getModels, getPeakHour,
  getStreak, getTodayActivity, getTodayTokens, getTotalTokens,
} from './compute';

/** Snapshots younger than this are reused by getSnapshot(). */
const MAX_AGE_MS = 30_000;

let cached: { snap: Snapshot | null; at: number } | undefined;

/**
 * Latest snapshot if it is recent enough, otherwise a fresh one. For consumers that
 * don't need to-the-second data (nags, sync, status command, panel first paint).
 */
export function getSnapshot(): Snapshot | null {
  if (cached && Date.now() - cached.at < MAX_AGE_MS) return cached.snap;
  return buildSnapshot();
}

/** Reads everything from disk now (and caches it). Returns null when stats-cache.json is missing. */
export function buildSnapshot(): Snapshot | null {
  const snap = computeSnapshot();
  cached = { snap, at: Date.now() };
  return snap;
}

function computeSnapshot(): Snapshot | null {
  const stats = readStatsCache();
  if (!stats) return null;
  const live = scanLiveToday();
  return {
    stats,
    live,
    todayTokens: getTodayTokens(stats, live),
    today: getTodayActivity(stats, live),
    avgTokens: getAvgTokens(stats),
    totalTokens: getTotalTokens(stats),
    streak: getStreak(stats, live),
    mood: getMood(live),
    last7: getLast7Days(stats, live),
    models: getModels(stats),
    peakHour: getPeakHour(stats),
  };
}
