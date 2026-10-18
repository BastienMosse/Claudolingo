import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { LiveStats, StatsCache } from '../types';
import { todayKey } from '../format';

const claudeDir = path.join(os.homedir(), '.claude');
export const statsCachePath = path.join(claudeDir, 'stats-cache.json');
const projectsDir = path.join(claudeDir, 'projects');

export function readStatsCache(): StatsCache | null {
  try {
    return JSON.parse(fs.readFileSync(statsCachePath, 'utf-8')) as StatsCache;
  } catch {
    return null;
  }
}

/** Scans today's session transcripts, since stats-cache.json lags behind. */
export function scanLiveToday(): LiveStats {
  const today = todayKey();
  const result: LiveStats = { messages: 0, toolCalls: 0, tokens: 0, sessions: 0, lastActivityTs: 0 };
  const sessionIds = new Set<string>();

  try {
    for (const dir of fs.readdirSync(projectsDir)) {
      const fullDir = path.join(projectsDir, dir);
      let stat: fs.Stats;
      try { stat = fs.statSync(fullDir); } catch { continue; }
      if (!stat.isDirectory()) continue;

      const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.jsonl'));
      for (const file of files) {
        if (scanSessionFile(path.join(fullDir, file), today, result)) {
          sessionIds.add(file.replace('.jsonl', ''));
        }
      }
    }
  } catch { /* projects dir unreadable */ }

  result.sessions = sessionIds.size;
  return result;
}

/** Adds today's lines of one transcript to `result`. Returns true if the session was active today. */
function scanSessionFile(filePath: string, today: string, result: LiveStats): boolean {
  let hasToday = false;
  let content: string;
  try { content = fs.readFileSync(filePath, 'utf-8'); } catch { return false; }

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      const ts: string = obj.timestamp ?? '';
      if (!ts.startsWith(today)) continue;
      hasToday = true;

      const tsMs = new Date(ts).getTime();
      if (tsMs > result.lastActivityTs) result.lastActivityTs = tsMs;

      const type: string = obj.type ?? '';
      if (type === 'user' || type === 'assistant') result.messages++;

      const msg = obj.message;
      if (!msg || typeof msg !== 'object') continue;

      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block && typeof block === 'object' && block.type === 'tool_use') result.toolCalls++;
        }
      }
      const usage = msg.usage;
      if (usage && typeof usage === 'object') {
        result.tokens += (usage.input_tokens ?? 0)
          + (usage.output_tokens ?? 0)
          + (usage.cache_read_input_tokens ?? 0)
          + (usage.cache_creation_input_tokens ?? 0);
      }
    } catch { /* skip malformed lines */ }
  }
  return hasToday;
}
