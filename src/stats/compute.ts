import type { DayPoint, LiveStats, ModelRow, ModelUsage, StatsCache, TodayActivity } from '../types';
import { dateKey, todayKey } from '../format';

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function usageTotal(u: ModelUsage): number {
  return u.inputTokens + u.outputTokens + u.cacheReadInputTokens + u.cacheCreationInputTokens;
}

function daysAgo(i: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - i);
  return d;
}

export function getStreak(stats: StatsCache, live: LiveStats): number {
  const dates = new Set(stats.dailyActivity.map(d => d.date));
  if (live.messages > 0) dates.add(todayKey());

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (dates.has(dateKey(daysAgo(i)))) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

export function getTodayTokens(stats: StatsCache, live: LiveStats): number {
  const cached = stats.dailyModelTokens.find(d => d.date === todayKey());
  const cachedTotal = cached ? sum(Object.values(cached.tokensByModel)) : 0;
  return Math.max(cachedTotal, live.tokens);
}

export function getTodayActivity(stats: StatsCache, live: LiveStats): TodayActivity {
  const cached = stats.dailyActivity.find(d => d.date === todayKey());
  return {
    messages: Math.max(cached?.messageCount ?? 0, live.messages),
    sessions: Math.max(cached?.sessionCount ?? 0, live.sessions),
    toolCalls: Math.max(cached?.toolCallCount ?? 0, live.toolCalls),
  };
}

export function getAvgTokens(stats: StatsCache): number {
  const all = stats.dailyModelTokens.map(d => sum(Object.values(d.tokensByModel)));
  return all.length > 0 ? sum(all) / all.length : 100_000_000;
}

export function getTotalTokens(stats: StatsCache): number {
  return sum(Object.values(stats.modelUsage).map(usageTotal));
}

export function getModels(stats: StatsCache): ModelRow[] {
  return Object.entries(stats.modelUsage)
    .map(([id, u]) => ({ id, tokens: usageTotal(u) }))
    .sort((a, b) => b.tokens - a.tokens);
}

export function getPeakHour(stats: StatsCache): string | null {
  if (!stats.hourCounts) return null;
  let maxH = '';
  let maxC = 0;
  for (const [h, c] of Object.entries(stats.hourCounts)) {
    if (c > maxC) { maxC = c; maxH = h; }
  }
  return maxH ? `${maxH}h` : null;
}

export function getLast7Days(stats: StatsCache, live: LiveStats): DayPoint[] {
  const days: DayPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = daysAgo(i);
    const entry = stats.dailyModelTokens.find(e => e.date === dateKey(date));
    let tokens = entry ? sum(Object.values(entry.tokensByModel)) : 0;
    if (i === 0) tokens = Math.max(tokens, live.tokens);
    days.push({ date, tokens, isToday: i === 0 });
  }
  return days;
}
