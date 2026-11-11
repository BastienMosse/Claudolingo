import * as vscode from 'vscode';
import type { Leaderboards, Snapshot } from '../types';
import { getApiUrl } from '../config';
import type { Coordinator } from '../coordinator';
import { dateKey } from '../format';
import { getClientId, getPseudo } from './identity';
import { fetchLeaderboards, postScore, type ScorePost } from './api';

const SYNC_INTERVAL_MS = 15 * 60_000;
const MAX_TOKENS = 1e15; // API cap

/**
 * Orchestrates the opt-in leaderboard sync: posts this player's cumulative total
 * plus one dated score per active day (so the daily/weekly boards add up), then
 * pulls the boards back. Does nothing until the user has set a pseudo.
 *
 * With several VS Code windows open, only one pushes per interval (they all read
 * the same ~/.claude data); the others just pull the boards when their panel is shown.
 */
export class SyncService {
  private timer?: ReturnType<typeof setInterval>;
  private inFlight = false;
  /** Separate from inFlight so a pull never makes a claimed push slot skip its push. */
  private pulling = false;
  private leaderboards: Leaderboards | null = null;

  constructor(
    private readonly ctx: vscode.ExtensionContext,
    private readonly getSnapshot: () => Snapshot | null,
    private readonly onLeaderboards: (lb: Leaderboards | null) => void,
    private readonly coordinator: Coordinator,
    private readonly isPanelVisible: () => boolean,
  ) {}

  /** True once the user has opted in by choosing a pseudo. */
  get enabled(): boolean {
    return !!getPseudo(this.ctx);
  }

  get current(): Leaderboards | null {
    return this.leaderboards;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), SYNC_INTERVAL_MS);
    void this.tick();
  }

  /** Scheduled cycle: push if this window won the slot, else pull only if someone is looking. */
  private async tick(): Promise<void> {
    if (!this.enabled) return;
    if (this.coordinator.claim('sync', SYNC_INTERVAL_MS)) await this.syncNow();
    else if (this.isPanelVisible()) await this.pull();
  }

  /** Fetches the boards if this window has none yet (e.g. its panel was just opened). */
  async pullIfMissing(): Promise<void> {
    if (!this.leaderboards) await this.pull();
  }

  /** Fetches the boards without pushing anything. */
  private async pull(): Promise<void> {
    if (!this.enabled || this.pulling) return;
    this.pulling = true;
    try {
      this.publish(await fetchLeaderboards(getApiUrl(), getClientId(this.ctx)));
    } finally {
      this.pulling = false;
    }
  }

  private publish(lb: Leaderboards | null): void {
    if (!lb) return;
    this.leaderboards = lb;
    this.onLeaderboards(lb);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One push + pull cycle, unconditionally (manual refresh). No-ops when not opted in. */
  async syncNow(): Promise<void> {
    const pseudo = getPseudo(this.ctx);
    if (!pseudo || this.inFlight) return;
    const snap = this.getSnapshot();
    if (!snap) return;

    this.inFlight = true;
    try {
      const baseUrl = getApiUrl();
      const uuid = getClientId(this.ctx);

      // All scores are independent and the server keeps the max, so order doesn't matter.
      await Promise.all(this.buildScores(snap, uuid, pseudo).map(s => postScore(baseUrl, s)));

      this.publish(await fetchLeaderboards(baseUrl, uuid));
    } finally {
      this.inFlight = false;
    }
  }

  /** The cumulative all-time total plus one dated score per day that had activity. */
  private buildScores(snap: Snapshot, uuid: string, pseudo: string): ScorePost[] {
    const scores: ScorePost[] = [{ uuid, pseudo, tokens: clamp(snap.totalTokens) }];
    for (const d of snap.last7) {
      if (d.tokens > 0) scores.push({ uuid, pseudo, tokens: clamp(d.tokens), date: dateKey(d.date) });
    }
    return scores;
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(MAX_TOKENS, Math.round(n)));
}
