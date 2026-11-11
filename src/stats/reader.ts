import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { LiveStats, StatsCache } from '../types';
import { todayKey } from '../format';

const claudeDir = path.join(os.homedir(), '.claude');
export const statsCachePath = path.join(claudeDir, 'stats-cache.json');
const projectsDir = path.join(claudeDir, 'projects');

/** Read size per syscall, so a huge transcript never needs one giant buffer. */
const CHUNK_SIZE = 8 * 1024 * 1024;
const NEWLINE = 0x0a;

export function readStatsCache(): StatsCache | null {
  try {
    return JSON.parse(fs.readFileSync(statsCachePath, 'utf-8')) as StatsCache;
  } catch {
    return null;
  }
}

/** What one transcript contributed today, plus where we stopped reading it. */
interface FileState {
  /** Session the transcript belongs to (a subagent's is its parent session). */
  sessionId: string;
  /**
   * Subagent transcripts (`<session>/subagents/*.jsonl`) count towards tokens and
   * tool calls but not messages, exactly like stats-cache.json does.
   */
  isSubagent: boolean;
  /** Byte offset just past the last complete line already parsed. */
  offset: number;
  hasToday: boolean;
  messages: number;
  toolCalls: number;
  tokens: number;
  lastActivityTs: number;
}

// Incremental scan state: transcripts are append-only, so each tick only parses
// the bytes written since the previous one. Reset when the day rolls over.
let scanDay = '';
const files = new Map<string, FileState>();

function newFileState(sessionId: string, isSubagent: boolean): FileState {
  return { sessionId, isSubagent, offset: 0, hasToday: false, messages: 0, toolCalls: 0, tokens: 0, lastActivityTs: 0 };
}

/** One transcript to scan this tick. */
interface Transcript {
  filePath: string;
  sessionId: string;
  isSubagent: boolean;
}

/** Main session transcripts plus their subagents' (`<session>/subagents/agent-*.jsonl`). */
function listTranscripts(): Transcript[] {
  const out: Transcript[] = [];
  let projects: fs.Dirent[];
  try { projects = fs.readdirSync(projectsDir, { withFileTypes: true }); } catch { return out; }

  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const projectDir = path.join(projectsDir, project.name);
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(projectDir, { withFileTypes: true }); } catch { continue; }

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        out.push({ filePath: path.join(projectDir, entry.name), sessionId: entry.name.slice(0, -6), isSubagent: false });
      } else if (entry.isDirectory()) {
        const subDir = path.join(projectDir, entry.name, 'subagents');
        let subs: string[];
        try { subs = fs.readdirSync(subDir); } catch { continue; /* no subagents */ }
        for (const name of subs) {
          if (name.endsWith('.jsonl')) out.push({ filePath: path.join(subDir, name), sessionId: entry.name, isSubagent: true });
        }
      }
    }
  }
  return out;
}

/** Scans today's session transcripts, since stats-cache.json lags behind. */
export function scanLiveToday(): LiveStats {
  const today = todayKey();
  if (today !== scanDay) {
    scanDay = today;
    files.clear();
  }
  // Day keys are UTC (see todayKey): a file untouched since UTC midnight has no line for today.
  const dayStartMs = Date.parse(`${today}T00:00:00Z`);
  const seen = new Set<string>();

  for (const { filePath, sessionId, isSubagent } of listTranscripts()) {
    let stat: fs.Stats;
    try { stat = fs.statSync(filePath); } catch { continue; }
    if (stat.mtimeMs < dayStartMs) continue;

    seen.add(filePath);
    let state = files.get(filePath);
    if (!state || stat.size < state.offset) {
      // New today, or rewritten/truncated: start over.
      state = newFileState(sessionId, isSubagent);
      files.set(filePath, state);
    }
    if (stat.size > state.offset) readNewLines(filePath, stat.size, today, state);
  }

  for (const key of files.keys()) {
    if (!seen.has(key)) files.delete(key);
  }

  const result: LiveStats = { messages: 0, toolCalls: 0, tokens: 0, sessions: 0, lastActivityTs: 0 };
  const sessionIds = new Set<string>();
  for (const st of files.values()) {
    if (!st.hasToday) continue;
    sessionIds.add(st.sessionId);
    result.messages += st.messages;
    result.toolCalls += st.toolCalls;
    result.tokens += st.tokens;
    if (st.lastActivityTs > result.lastActivityTs) result.lastActivityTs = st.lastActivityTs;
  }
  result.sessions = sessionIds.size;
  return result;
}

/**
 * Parses the complete lines between `state.offset` and `size`, then moves the offset
 * past the last newline. A trailing partial line is left for the next tick. Splitting
 * on the newline byte (never inside a UTF-8 sequence) keeps multibyte text intact.
 */
function readNewLines(filePath: string, size: number, today: string, state: FileState): void {
  let fd: number;
  try { fd = fs.openSync(filePath, 'r'); } catch { return; }
  try {
    let pos = state.offset;
    let carry = Buffer.alloc(0);
    while (pos < size) {
      const buf = Buffer.allocUnsafe(Math.min(CHUNK_SIZE, size - pos));
      const n = fs.readSync(fd, buf, 0, buf.length, pos);
      if (n <= 0) break;
      pos += n;

      const data = carry.length ? Buffer.concat([carry, buf.subarray(0, n)]) : buf.subarray(0, n);
      const nl = data.lastIndexOf(NEWLINE);
      if (nl === -1) { carry = data; continue; }
      for (const line of data.toString('utf-8', 0, nl).split('\n')) parseLine(line, today, state);
      carry = Buffer.from(data.subarray(nl + 1));
    }
    state.offset = pos - carry.length;
  } catch {
    /* read failed midway: keep the offset of what was parsed, retry next tick */
  } finally {
    fs.closeSync(fd);
  }
}

/** Adds one transcript line to `state` if it is from today. */
function parseLine(line: string, today: string, state: FileState): void {
  // Cheap pre-filter: most lines of a long-running session are from earlier days.
  if (!line.includes(today)) return;
  let obj: any;
  try { obj = JSON.parse(line); } catch { return; /* malformed line */ }
  if (!obj || typeof obj !== 'object') return;

  const ts = typeof obj.timestamp === 'string' ? obj.timestamp : '';
  if (!ts.startsWith(today)) return;
  state.hasToday = true;

  const tsMs = new Date(ts).getTime();
  if (tsMs > state.lastActivityTs) state.lastActivityTs = tsMs;

  if (!state.isSubagent && (obj.type === 'user' || obj.type === 'assistant')) state.messages++;

  const msg = obj.message;
  if (!msg || typeof msg !== 'object') return;

  if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block && typeof block === 'object' && block.type === 'tool_use') state.toolCalls++;
    }
  }
  const usage = msg.usage;
  if (usage && typeof usage === 'object') {
    state.tokens += (usage.input_tokens ?? 0)
      + (usage.output_tokens ?? 0)
      + (usage.cache_read_input_tokens ?? 0)
      + (usage.cache_creation_input_tokens ?? 0);
  }
}
