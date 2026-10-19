import type { Mood } from './mood';

// --- Raw data from ~/.claude ---

export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface StatsCache {
  lastComputedDate?: string;
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, ModelUsage>;
  totalSessions: number;
  totalMessages: number;
  longestSession?: { duration: number; messageCount: number };
  firstSessionDate?: string;
  hourCounts?: Record<string, number>;
}

export interface LiveStats {
  messages: number;
  toolCalls: number;
  tokens: number;
  sessions: number;
  lastActivityTs: number;
}

// --- Computed ---

export interface TodayActivity {
  messages: number;
  sessions: number;
  toolCalls: number;
}

export interface DayPoint {
  date: Date;
  tokens: number;
  isToday: boolean;
}

export interface ModelRow {
  id: string;
  tokens: number;
}

// --- Leaderboard (opt-in sync) ---

export type LeaderboardKind = 'alltime' | 'daily' | 'weekly';

export interface LeaderboardEntry {
  rank: number;
  pseudo: string;
  tokens: number;
  /** Set by the backend for the row that belongs to this install. */
  isMe?: boolean;
}

export interface Leaderboards {
  alltime: LeaderboardEntry[];
  daily: LeaderboardEntry[];
  weekly: LeaderboardEntry[];
  /** This install's rank in each board, when known. */
  myRank?: Partial<Record<LeaderboardKind, number>>;
}

/** Everything the UI needs, computed once per refresh tick. */
export interface Snapshot {
  stats: StatsCache;
  live: LiveStats;
  todayTokens: number;
  today: TodayActivity;
  avgTokens: number;
  totalTokens: number;
  streak: number;
  mood: Mood;
  last7: DayPoint[];
  models: ModelRow[];
  peakHour: string | null;
}
