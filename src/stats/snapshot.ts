import type { Snapshot } from '../types';
import { getMood } from '../mood';
import { readStatsCache, scanLiveToday } from './reader';
import {
  getAvgTokens, getLast7Days, getModels, getPeakHour,
  getStreak, getTodayActivity, getTodayTokens, getTotalTokens,
} from './compute';

/** Reads everything from disk once. Returns null when stats-cache.json is missing. */
export function buildSnapshot(): Snapshot | null {
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
