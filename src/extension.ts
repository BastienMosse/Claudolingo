import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// --- Types ---

interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

interface StatsCache {
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

interface LiveStats {
  messages: number;
  toolCalls: number;
  tokens: number;
  sessions: number;
  lastActivityTs: number;
}

// --- Mood system ---

const MOODS = ['chill', 'waiting', 'impatient', 'angry', 'unhinged'] as const;
type Mood = typeof MOODS[number];

const MOOD_COLORS: Record<Mood, string> = {
  chill: '#58cc02',
  waiting: '#ffc800',
  impatient: '#ff9600',
  angry: '#ff4b4b',
  unhinged: '#ea2b2b',
};

const MOOD_EMOJIS: Record<Mood, string> = {
  chill: '😊',
  waiting: '🤨',
  impatient: '😤',
  angry: '😡',
  unhinged: '🤬',
};

const FACES: Record<Mood, string> = {
  chill: '$(heart) ',
  waiting: '$(eye) ',
  impatient: '$(warning) ',
  angry: '$(flame) ',
  unhinged: '$(zap) ',
};

let _svgTemplate: string | null = null;
function loadSvgTemplate(extensionPath: string): string {
  if (!_svgTemplate) {
    const p = path.join(extensionPath, 'media', 'serie-en-danger_editable.svg');
    let raw = fs.readFileSync(p, 'utf-8');
    raw = raw.replace(/<\?xml[^?]*\?>/, '');
    raw = raw.replace(/<svg([^>]*)>/, (_m, attrs: string) => {
      const cleaned = attrs.replace(/\s+width="[^"]*"/, '').replace(/\s+height="[^"]*"/, '');
      return `<svg${cleaned}>`;
    });
    _svgTemplate = raw;
  }
  return _svgTemplate;
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let _messages: Record<string, Record<string, string[]>> | null = null;
function loadMessages(extensionPath: string): Record<string, Record<string, string[]>> {
  if (!_messages) {
    try {
      const p = path.join(extensionPath, 'media', 'messages.json');
      _messages = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      _messages = { fr: { chill: ['Claude est là.'], waiting: ['Prompte un peu.'], impatient: ['Claude attend.'], angry: ['Prompte !'], unhinged: ['PROMPTE.'] }, en: { chill: ['Claude is here.'], waiting: ['Prompt a little.'], impatient: ['Claude waits.'], angry: ['Prompt!'], unhinged: ['PROMPT.'] } };
    }
  }
  return _messages!;
}

function splitBubble(msg: string): [string, string] {
  if (msg.length < 22) return [msg, ''];
  const mid = Math.floor(msg.length / 2);
  let sp = msg.lastIndexOf(' ', mid);
  if (sp < 5) sp = msg.indexOf(' ', mid);
  if (sp < 0) return [msg, ''];
  return [msg.slice(0, sp), msg.slice(sp + 1)];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h${mins.toString().padStart(2, '0')}`;
  return `${mins}min`;
}

// --- Stats readers ---

const claudeDir = path.join(os.homedir(), '.claude');
const statsCachePath = path.join(claudeDir, 'stats-cache.json');
const projectsDir = path.join(claudeDir, 'projects');

function readStatsCache(): StatsCache | null {
  try {
    return JSON.parse(fs.readFileSync(statsCachePath, 'utf-8')) as StatsCache;
  } catch {
    return null;
  }
}

function scanLiveToday(): LiveStats {
  const today = todayKey();
  const result: LiveStats = { messages: 0, toolCalls: 0, tokens: 0, sessions: 0, lastActivityTs: 0 };
  const sessionIds = new Set<string>();

  try {
    const projectDirs = fs.readdirSync(projectsDir);
    for (const dir of projectDirs) {
      const fullDir = path.join(projectsDir, dir);
      let stat: fs.Stats;
      try { stat = fs.statSync(fullDir); } catch { continue; }
      if (!stat.isDirectory()) continue;

      const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.jsonl'));
      for (const file of files) {
        const filePath = path.join(fullDir, file);
        const sessionId = file.replace('.jsonl', '');
        let hasToday = false;

        try {
          const content = fs.readFileSync(filePath, 'utf-8');
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
              if (type === 'user' || type === 'assistant') {
                result.messages++;
              }

              const msg = obj.message;
              if (msg && typeof msg === 'object') {
                // Count tool_use blocks
                const content = msg.content;
                if (Array.isArray(content)) {
                  for (const block of content) {
                    if (block && typeof block === 'object' && block.type === 'tool_use') {
                      result.toolCalls++;
                    }
                  }
                }
                // Count tokens
                const usage = msg.usage;
                if (usage && typeof usage === 'object') {
                  result.tokens += (usage.input_tokens ?? 0)
                    + (usage.output_tokens ?? 0)
                    + (usage.cache_read_input_tokens ?? 0)
                    + (usage.cache_creation_input_tokens ?? 0);
                }
              }
            } catch { /* skip malformed lines */ }
          }
        } catch { /* skip unreadable files */ }

        if (hasToday) sessionIds.add(sessionId);
      }
    }
  } catch { /* projects dir unreadable */ }

  result.sessions = sessionIds.size;
  return result;
}

function getStreak(stats: StatsCache, live: LiveStats): number {
  const dates = new Set(stats.dailyActivity.map(d => d.date));
  if (live.messages > 0) dates.add(todayKey());

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (dates.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function getTodayTokens(stats: StatsCache, live: LiveStats): number {
  const today = todayKey();
  const cached = stats.dailyModelTokens.find(d => d.date === today);
  const cachedTotal = cached
    ? Object.values(cached.tokensByModel).reduce((a, b) => a + b, 0)
    : 0;
  return Math.max(cachedTotal, live.tokens);
}

function getTodayActivity(stats: StatsCache, live: LiveStats): { messages: number; sessions: number; toolCalls: number } {
  const today = todayKey();
  const cached = stats.dailyActivity.find(d => d.date === today);
  return {
    messages: Math.max(cached?.messageCount ?? 0, live.messages),
    sessions: Math.max(cached?.sessionCount ?? 0, live.sessions),
    toolCalls: Math.max(cached?.toolCallCount ?? 0, live.toolCalls),
  };
}

function getMood(live: LiveStats): Mood {
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

function getAvgTokens(stats: StatsCache): number {
  const all = stats.dailyModelTokens.map(d =>
    Object.values(d.tokensByModel).reduce((a, b) => a + b, 0)
  );
  return all.length > 0 ? all.reduce((a, b) => a + b, 0) / all.length : 100_000_000;
}

function getTotalTokens(stats: StatsCache): number {
  return Object.values(stats.modelUsage).reduce((sum, m) =>
    sum + m.inputTokens + m.outputTokens + m.cacheReadInputTokens + m.cacheCreationInputTokens, 0);
}

function getPeakHour(stats: StatsCache): string | null {
  if (!stats.hourCounts) return null;
  let maxH = '';
  let maxC = 0;
  for (const [h, c] of Object.entries(stats.hourCounts)) {
    if (c > maxC) { maxC = c; maxH = h; }
  }
  return maxH ? `${maxH}h` : null;
}

function miniChart(stats: StatsCache, live: LiveStats): string {
  const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const last7: number[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = stats.dailyModelTokens.find(e => e.date === key);
    let tokens = entry ? Object.values(entry.tokensByModel).reduce((a, b) => a + b, 0) : 0;
    if (i === 0) tokens = Math.max(tokens, live.tokens);
    last7.push(tokens);
  }
  const max = Math.max(...last7, 1);
  return last7.map(v => bars[Math.min(7, Math.floor((v / max) * 7))]).join('');
}

function dayLabels(): string {
  const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const result: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    result.push(days[d.getDay()]);
  }
  return result.join(' ');
}

// --- Webview panel ---

class CrabPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claudolingo.panel';
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;
  public forceEasterEgg = false;

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
    };
    webviewView.webview.onDidReceiveMessage(msg => {
      if (msg.command === 'refresh') this.update();
    });
    this.update();
  }

  public update() {
    if (!this._view) return;
    const stats = readStatsCache();
    if (!stats) {
      this._view.webview.html = `<!DOCTYPE html><html><body style="padding:16px;color:var(--vscode-foreground);font-family:var(--vscode-font-family);">
        <p>Stats Claude introuvables.</p>
        <p style="opacity:0.6;font-size:12px;">~/.claude/stats-cache.json</p>
      </body></html>`;
      return;
    }

    const live = scanLiveToday();
    const todayTokens = getTodayTokens(stats, live);
    const todayAct = getTodayActivity(stats, live);
    const avgTokens = getAvgTokens(stats);
    const streak = getStreak(stats, live);
    const mood = getMood(live);
    const totalTokens = getTotalTokens(stats);
    const chart = miniChart(stats, live);
    const labels = dayLabels();
    const peakHour = getPeakHour(stats);
    const color = MOOD_COLORS[mood];
    const lang = vscode.workspace.getConfiguration('claudolingo').get<string>('language') ?? 'fr';
    const isFr = lang === 'fr';
    const allMsgs = loadMessages(this._extensionUri.fsPath);
    const isBillion = todayTokens >= 1_000_000_000 || this.forceEasterEgg;
    const moodKey = isBillion ? 'billion' : mood;
    const msgs = allMsgs[lang]?.[moodKey] ?? allMsgs.fr?.[moodKey] ?? ['Prompte !'];
    const msg = pick(msgs);
    const [bubbleLine1, bubbleLine2] = splitBubble(msg);
    const easterEgg = isBillion ? (allMsgs[lang]?.easteregg?.[0] ?? allMsgs.fr?.easteregg?.[0] ?? '') : '';
    const progressPercent = Math.min(100, (todayTokens / avgTokens) * 100);

    const models = Object.keys(stats.modelUsage).map(m => {
      const short = m.replace('claude-', '').replace(/-/g, ' ');
      const u = stats.modelUsage[m];
      const total = u.inputTokens + u.outputTokens + u.cacheReadInputTokens + u.cacheCreationInputTokens;
      return `<div class="model-row"><span class="model-name">${short}</span><span class="model-tokens">${formatTokens(total)}</span></div>`;
    }).join('');

    const streakPercent = Math.min(100, (streak / 30) * 100);
    const fireLevel = streak >= 30 ? 4 : streak >= 14 ? 3 : streak >= 7 ? 2 : streak > 0 ? 1 : 0;
    const fireFilter = fireLevel === 0 ? 'none'
      : fireLevel === 1 ? 'drop-shadow(0 0 6px #ff960066)'
      : fireLevel === 2 ? 'drop-shadow(0 0 10px #ff9600aa) drop-shadow(0 0 5px #ffc80066)'
      : fireLevel === 3 ? 'drop-shadow(0 0 14px #ff6600cc) drop-shadow(0 0 7px #ffc800aa)'
      : 'drop-shadow(0 0 18px #ff4400ee) drop-shadow(0 0 12px #ff9600cc) drop-shadow(0 0 5px #ffee00aa)';

    const streakLabel = `${streak} ${isFr ? 'jours' : 'days'}`;

    const maxLineLen = Math.max(bubbleLine1.length, bubbleLine2.length || 0);
    const maxChars = 18;
    const speechFontSize = maxLineLen <= maxChars ? 57 : Math.max(28, Math.floor(57 * maxChars / maxLineLen));
    const lineGap = speechFontSize * 1.75;
    const bubbleCenterY = 275;
    const line1Y = bubbleLine2 ? Math.round(bubbleCenterY - lineGap / 2) : bubbleCenterY;
    const line2Y = Math.round(bubbleCenterY + lineGap / 2);

    let sceneSvg = loadSvgTemplate(this._extensionUri.fsPath);
    sceneSvg = sceneSvg.replace(
      /(<text\s+id="counter-text"[^>]*>)\s*[^<]*\s*(<\/text>)/,
      `$1${escXml(streakLabel)}$2`,
    );
    sceneSvg = sceneSvg.replace(
      /(<text\s+id="speech-text"[\s\S]*?font-size=")57(")/,
      `$1${speechFontSize}$2`,
    );
    sceneSvg = sceneSvg.replace(
      /(<tspan\s+id="speech-line-1"\s+x="900"\s+y=")225(">)[^<]*/,
      `$1${line1Y}$2${escXml(bubbleLine1)}`,
    );
    sceneSvg = sceneSvg.replace(
      /(<tspan\s+id="speech-line-2"\s+x="900"\s+y=")325(">)[^<]*/,
      `$1${line2Y}$2${escXml(bubbleLine2)}`,
    );

    this._view.webview.html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, sans-serif);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    padding: 8px 6px;
  }
  .scene { border-radius: 8px; overflow: hidden; filter: ${fireFilter}; }
  .scene svg { width: 100%; display: block; }
  .section { margin: 10px 0 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.5; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 6px 0; }
  .stat-card { background: var(--vscode-textBlockQuote-background, #ffffff08); border-radius: 6px; padding: 8px; text-align: center; }
  .stat-value { font-size: 16px; font-weight: 700; color: ${color}; }
  .stat-label { font-size: 10px; opacity: 0.6; margin-top: 2px; }
  .progress-bar { width: 100%; height: 6px; background: var(--vscode-progressBar-background, #333); border-radius: 3px; overflow: hidden; margin: 4px 0; }
  .progress-fill { height: 100%; border-radius: 3px; }
  .progress-label { display: flex; justify-content: space-between; font-size: 10px; opacity: 0.5; }
  .chart-container { background: var(--vscode-textBlockQuote-background, #ffffff08); border-radius: 6px; padding: 8px; margin: 6px 0; text-align: center; }
  .chart { font-size: 18px; letter-spacing: 4px; color: ${color}; font-family: monospace; }
  .chart-labels { font-size: 9px; letter-spacing: 6.5px; opacity: 0.4; margin-top: 2px; font-family: monospace; }
  .chart-title { font-size: 10px; opacity: 0.5; margin-bottom: 4px; }
  .model-row { display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; border-bottom: 1px solid var(--vscode-widget-border, #ffffff10); }
  .model-name { opacity: 0.7; text-transform: capitalize; }
  .model-tokens { font-weight: 600; font-family: var(--vscode-editor-font-family, monospace); }
  .total-row { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; padding: 6px 0 2px; color: ${color}; }
  .info-row { display: flex; justify-content: space-between; font-size: 11px; opacity: 0.6; padding: 2px 0; }
  .refresh-btn { display: block; width: 100%; padding: 6px; margin-top: 10px; border: 1px solid var(--vscode-button-border, #ffffff20); border-radius: 4px; background: transparent; color: var(--vscode-foreground); cursor: pointer; font-size: 11px; font-family: var(--vscode-font-family); opacity: 0.6; }
  .refresh-btn:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
  .easteregg { background: linear-gradient(135deg, #ff960015, #ffc80010); border: 1px solid #ff960030; border-radius: 8px; padding: 12px; margin: 10px 0; font-size: 11px; line-height: 1.6; font-style: italic; opacity: 0.85; white-space: pre-line; }
</style>
</head>
<body>

<div class="scene">
${sceneSvg}
</div>

  ${easterEgg ? `<div class="easteregg">${easterEgg.replace(/\n/g, '<br>')}</div>` : ''}

  <div class="section">${isFr ? "Aujourd'hui" : 'Today'}</div>
  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-value">${formatTokens(todayTokens)}</div>
      <div class="stat-label">tokens</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${todayAct.messages}</div>
      <div class="stat-label">messages</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${todayAct.sessions}</div>
      <div class="stat-label">sessions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${todayAct.toolCalls}</div>
      <div class="stat-label">tool calls</div>
    </div>
  </div>

  <div class="progress-label">
    <span>${isFr ? 'Streak' : 'Streak'}</span>
    <span>${streak} / 30 ${isFr ? 'jours' : 'days'}</span>
  </div>
  <div class="progress-bar"><div id="streak-bar" class="progress-fill" style="width:${streakPercent}%;background:${color};"></div></div>

  <div class="progress-label">
    <span>${isFr ? 'vs moyenne journalière' : 'vs daily average'}</span>
    <span>${Math.round(progressPercent)}%</span>
  </div>
  <div class="progress-bar"><div class="progress-fill" style="width:${progressPercent}%;background:${color};opacity:0.5;"></div></div>

  <div class="section">${isFr ? '7 derniers jours' : 'Last 7 days'}</div>
  <div class="chart-container">
    <div class="chart-title">${isFr ? 'tokens / jour' : 'tokens / day'}</div>
    <div class="chart">${chart}</div>
    <div class="chart-labels">${labels}</div>
  </div>

  <div class="section">${isFr ? 'Modèles' : 'Models'}</div>
  ${models}
  <div class="total-row">
    <span>Total</span>
    <span>${formatTokens(totalTokens)} tokens</span>
  </div>

  <div class="section">Stats</div>
  <div class="info-row">
    <span>${isFr ? 'Sessions totales' : 'Total sessions'}</span>
    <span>${stats.totalSessions}</span>
  </div>
  <div class="info-row">
    <span>${isFr ? 'Messages totaux' : 'Total messages'}</span>
    <span>${stats.totalMessages.toLocaleString()}</span>
  </div>
  ${stats.longestSession ? `<div class="info-row">
    <span>${isFr ? 'Plus longue session' : 'Longest session'}</span>
    <span>${formatDuration(stats.longestSession.duration)} (${stats.longestSession.messageCount} msg)</span>
  </div>` : ''}
  ${peakHour ? `<div class="info-row">
    <span>${isFr ? 'Heure de pointe' : 'Peak hour'}</span>
    <span>${peakHour}</span>
  </div>` : ''}
  ${stats.firstSessionDate ? `<div class="info-row">
    <span>${isFr ? 'Membre depuis' : 'Member since'}</span>
    <span>${new Date(stats.firstSessionDate).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</span>
  </div>` : ''}

  <button class="refresh-btn" onclick="vscode.postMessage({command:'refresh'})">↻ ${isFr ? 'Rafraîchir' : 'Refresh'}</button>

<script>
  const vscode = acquireVsCodeApi();
</script>
</body>
</html>`;
  }
}

// --- Extension ---

export function activate(context: vscode.ExtensionContext) {
  // Status bar — tokens du jour uniquement
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'claudolingo.status';
  statusBar.tooltip = 'Claudolingo — stats Claude Pro';
  context.subscriptions.push(statusBar);

  const panelProvider = new CrabPanelProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CrabPanelProvider.viewType, panelProvider),
  );

  function lang(): string {
    return vscode.workspace.getConfiguration('claudolingo').get<string>('language') ?? 'fr';
  }

  function enabled(): boolean {
    return vscode.workspace.getConfiguration('claudolingo').get<boolean>('enabled') ?? true;
  }

  function updateStatusBar() {
    if (!enabled()) { statusBar.hide(); return; }
    const stats = readStatsCache();
    const live = scanLiveToday();

    if (!stats) {
      statusBar.text = '🦀 --';
      statusBar.show();
      panelProvider.update();
      return;
    }

    const todayTokens = getTodayTokens(stats, live);
    statusBar.text = `🦀 ${formatTokens(todayTokens)} tokens`;
    statusBar.show();
    panelProvider.update();
  }

  function nag() {
    if (!enabled()) return;
    const stats = readStatsCache();
    if (!stats) return;
    const live = scanLiveToday();
    const mood = getMood(live);
    if (mood === 'chill') return;

    const l = lang();
    const allM = loadMessages(context.extensionUri.fsPath);
    const msgs = allM[l]?.[mood] ?? allM.fr?.[mood] ?? ['Prompte !'];
    const msg = pick(msgs);

    if (mood === 'unhinged') {
      vscode.window.showErrorMessage(`🦀 ${msg}`);
    } else if (mood === 'angry') {
      vscode.window.showWarningMessage(`🦀 ${msg}`);
    } else {
      vscode.window.showInformationMessage(`🦀 ${msg}`);
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('claudolingo.feed', () => {
      updateStatusBar();
      const l = lang();
      const allM = loadMessages(context.extensionUri.fsPath);
      const msgs = allM[l]?.chill ?? allM.fr?.chill ?? ['Bien joué !'];
      vscode.window.showInformationMessage(`🦀 ${pick(msgs)}`);
    }),

    vscode.commands.registerCommand('claudolingo.status', () => {
      const stats = readStatsCache();
      if (!stats) {
        vscode.window.showWarningMessage('🦀 Stats Claude introuvables (~/.claude/stats-cache.json)');
        return;
      }
      const live = scanLiveToday();
      const streak = getStreak(stats, live);
      const todayTokens = getTodayTokens(stats, live);
      const todayAct = getTodayActivity(stats, live);
      const l = lang();
      const isFr = l === 'fr';
      const msg = isFr
        ? `${streak}j de streak · ${formatTokens(todayTokens)} tokens · ${todayAct.messages} messages aujourd'hui`
        : `${streak}d streak · ${formatTokens(todayTokens)} tokens · ${todayAct.messages} messages today`;
      vscode.window.showInformationMessage(`🦀 ${msg}`);
    }),

  );

  updateStatusBar();

  const nagInterval = setInterval(nag, 10 * 60_000);
  const uiInterval = setInterval(updateStatusBar, 60_000);
  const firstNag = setTimeout(nag, 30_000);

  context.subscriptions.push({ dispose: () => {
    clearInterval(nagInterval);
    clearInterval(uiInterval);
    clearTimeout(firstNag);
  }});
}

export function deactivate() {}
