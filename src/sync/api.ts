import type { Leaderboards, LeaderboardEntry, LeaderboardKind } from '../types';

/**
 * Client for the Claudolingo leaderboard API (base + `/api/claudolingo/leaderboard`).
 *
 *   GET  …/leaderboard            -> all-time total, tokens desc
 *   GET  …/leaderboard?daily      -> last day
 *   GET  …/leaderboard?weekly     -> last 7 days
 *   POST …/leaderboard            -> upsert a score (server keeps max per uuid[/date])
 *
 * A player is the stable `uuid`; `pseudo` is only a display label. Posting a
 * score with a `date` feeds the daily/weekly boards; without one it sets the
 * all-time total (post the CUMULATIVE total, not a delta). The two are independent.
 */

const PATH = '/api/claudolingo/leaderboard';
const TIMEOUT_MS = 8000;

/** Query flag per board; all-time has none. */
const QUERY: Record<LeaderboardKind, string> = { alltime: '', daily: '?daily', weekly: '?weekly' };

function endpoint(base: string, query = ''): string {
  return base.replace(/\/+$/, '') + PATH + query;
}

async function request(input: string, init: RequestInit): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } catch {
    // Offline, backend down, or rate-limited: fail quietly, this is opt-in telemetry.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface ScorePost {
  uuid: string;
  pseudo: string;
  tokens: number;
  /** YYYY-MM-DD (UTC day). Omit for the all-time total. */
  date?: string;
}

/** Posts one score. Returns true on a 2xx, false otherwise (never throws). */
export async function postScore(baseUrl: string, score: ScorePost): Promise<boolean> {
  const res = await request(endpoint(baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(score),
  });
  return !!res && res.ok;
}

/** Fetches one board. null = transport failure (vs. [] = genuinely empty). */
async function fetchBoard(baseUrl: string, kind: LeaderboardKind, myUuid: string): Promise<LeaderboardEntry[] | null> {
  const res = await request(endpoint(baseUrl, QUERY[kind]), { method: 'GET', headers: { accept: 'application/json' } });
  if (!res || !res.ok) return null;
  try {
    const raw = await res.json();
    if (!Array.isArray(raw)) return null;
    // The API returns tokens desc with no rank/isMe: derive them here.
    return raw.map((e: any, i: number) => ({
      rank: i + 1,
      pseudo: String(e?.pseudo ?? '?'),
      tokens: Number(e?.tokens ?? 0),
      isMe: e?.uuid === myUuid,
    }));
  } catch {
    return null;
  }
}

/** Fetches the three boards in parallel. null only when every board failed. */
export async function fetchLeaderboards(baseUrl: string, myUuid: string): Promise<Leaderboards | null> {
  const [alltime, daily, weekly] = await Promise.all([
    fetchBoard(baseUrl, 'alltime', myUuid),
    fetchBoard(baseUrl, 'daily', myUuid),
    fetchBoard(baseUrl, 'weekly', myUuid),
  ]);
  if (alltime === null && daily === null && weekly === null) return null;
  return { alltime: alltime ?? [], daily: daily ?? [], weekly: weekly ?? [] };
}
