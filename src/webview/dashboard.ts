import type { LeaderboardEntry, LeaderboardKind, Leaderboards, Snapshot } from '../types';
import type { Strings } from './i18n';
import { MOOD_EMOJIS } from '../mood';
import { escHtml, formatDuration, formatModelName, formatTokens } from '../format';
import { icons } from './icons';

const BOARDS: LeaderboardKind[] = ['alltime', 'daily', 'weekly'];

/** Self-contained animated crab, used as the leaderboard loading indicator. */
function loadingCrab(): string {
  return `<svg class="crab-load" viewBox="0 0 120 92" aria-hidden="true">
  <ellipse class="cl-shadow" cx="60" cy="84" rx="30" ry="6"/>
  <g class="cl-crab">
    <g stroke="#d97f00" stroke-width="4" stroke-linecap="round" fill="none">
      <path d="M42 60 L24 64 M44 66 L28 74 M46 70 L36 84"/>
      <path d="M78 60 L96 64 M76 66 L92 74 M74 70 L84 84"/>
    </g>
    <g class="cl-claw cl-claw-l">
      <path d="M42 52 L26 44" stroke="#d97f00" stroke-width="5" stroke-linecap="round"/>
      <path d="M26 44 q-12 -5 -16 -1 q 2 7 10 7 q -3 7 4 10 q 7 -3 6 -12 z" fill="#ff9600" stroke="#d97f00" stroke-width="2.5" stroke-linejoin="round"/>
    </g>
    <g class="cl-claw cl-claw-r">
      <path d="M78 52 L94 44" stroke="#d97f00" stroke-width="5" stroke-linecap="round"/>
      <path d="M94 44 q12 -5 16 -1 q -2 7 -10 7 q 3 7 -4 10 q -7 -3 -6 -12 z" fill="#ff9600" stroke="#d97f00" stroke-width="2.5" stroke-linejoin="round"/>
    </g>
    <ellipse cx="60" cy="58" rx="26" ry="18" fill="#ff9600" stroke="#d97f00" stroke-width="3"/>
    <line x1="52" y1="44" x2="50" y2="31" stroke="#d97f00" stroke-width="4" stroke-linecap="round"/>
    <line x1="68" y1="44" x2="70" y2="31" stroke="#d97f00" stroke-width="4" stroke-linecap="round"/>
    <g class="cl-eye">
      <circle cx="50" cy="28" r="6.5" fill="#fff" stroke="#d97f00" stroke-width="2"/>
      <circle cx="50" cy="28" r="2.6" fill="#3b2a1a"/>
    </g>
    <g class="cl-eye">
      <circle cx="70" cy="28" r="6.5" fill="#fff" stroke="#d97f00" stroke-width="2"/>
      <circle cx="70" cy="28" r="2.6" fill="#3b2a1a"/>
    </g>
    <path d="M53 63 q7 5 14 0" stroke="#d97f00" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;
}

// Elements with data-count are counted up by main.js, elements with data-target grow to that %.
// data-key identifies them across refreshes so they animate from their previous value.

function counter(key: string, value: number, format: 'tokens' | 'int', locale: string): string {
  const text = format === 'tokens' ? formatTokens(value) : value.toLocaleString(locale);
  return `<span data-key="${key}" data-count="${value}" data-format="${format}">${text}</span>`;
}

function grow(cls: string, key: string, pct: number, i = 0, dim: 'width' | 'height' = 'width', inner = ''): string {
  const v = Math.round(pct * 10) / 10;
  return `<div class="${cls}" data-key="${key}" data-dim="${dim}" data-target="${v}" style="${dim}:${v}%;--i:${i}">${inner}</div>`;
}

function sectionTitle(text: string, i: number): string {
  return `<div class="section-title reveal" style="--i:${i}">${escHtml(text)}</div>`;
}

function moodChip(snap: Snapshot, s: Strings): string {
  const last = snap.live.lastActivityTs;
  const elapsed = Date.now() - last;
  const ago = snap.live.messages > 0 && last > 0 ? (elapsed < 60_000 ? '' : formatDuration(elapsed)) : null;
  return `<div class="mood-chip reveal" style="--i:1">
    <span class="mood-emoji">${MOOD_EMOJIS[snap.mood]}</span>
    <span class="mood-text"><b>${escHtml(s.moods[snap.mood])}</b> · ${escHtml(s.lastPrompt(ago))}</span>
  </div>`;
}

function statCard(icon: string, value: string, label: string, i: number): string {
  return `<div class="stat-card reveal" style="--i:${i}">
    <div class="stat-icon">${icon}</div>
    <div class="stat-body">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${escHtml(label)}</div>
    </div>
  </div>`;
}

function progressCard(snap: Snapshot, s: Strings): string {
  const streakPct = Math.min(100, (snap.streak / 30) * 100);
  const avgPct = Math.min(100, (snap.todayTokens / snap.avgTokens) * 100);
  return `<div class="card reveal" style="--i:7">
    <div class="progress-head">
      <span class="progress-title">${icons.flame}${escHtml(s.streak)}</span>
      <span class="progress-value">${snap.streak} / 30 ${escHtml(s.daysWord)}</span>
    </div>
    <div class="progress">${grow('progress-fill', 'streak', streakPct)}</div>
    <div class="progress-head">
      <span class="progress-title">${icons.target}${escHtml(s.vsAverage)}</span>
      <span class="progress-value">${Math.round((snap.todayTokens / snap.avgTokens) * 100)}%</span>
    </div>
    <div class="progress">${grow('progress-fill alt', 'avg', avgPct, 1)}</div>
  </div>`;
}

function chartCard(snap: Snapshot, s: Strings): string {
  const max = Math.max(...snap.last7.map(d => d.tokens), 1);
  const cols = snap.last7.map((d, i) => {
    const pct = d.tokens > 0 ? Math.max(4, (d.tokens / max) * 100) : 2;
    const tip = `<span class="bar-tip">${formatTokens(d.tokens)}</span>`;
    return `<div class="bar-col${d.isToday ? ' today' : ''}">
      <div class="bar-track">${grow('bar', `bar-${i}`, pct, i, 'height', tip)}</div>
      <span class="bar-label">${s.dayInitials[d.date.getDay()]}</span>
    </div>`;
  }).join('');
  return `<div class="card reveal" style="--i:9">
    <div class="chart-head"><span>${escHtml(s.tokensPerDay)}</span><span>${s.max} ${formatTokens(max)}</span></div>
    <div class="chart">${cols}</div>
  </div>`;
}

function modelsCard(snap: Snapshot, s: Strings): string {
  const total = snap.totalTokens || 1;
  const rows = snap.models.map((m, i) => `<div class="model-row">
      <div class="model-top">
        <span class="model-name">${escHtml(formatModelName(m.id))}</span>
        <span class="model-tokens">${counter(`model-${m.id}`, m.tokens, 'tokens', s.locale)}</span>
      </div>
      <div class="mini-bar">${grow('mini-fill', `model-bar-${m.id}`, Math.max(1.5, (m.tokens / total) * 100), i)}</div>
    </div>`).join('');
  return `<div class="card reveal" style="--i:11">
    ${rows}
    <div class="total-row">
      <span>${escHtml(s.total)}</span>
      <span>${counter('total', snap.totalTokens, 'tokens', s.locale)} tokens</span>
    </div>
  </div>`;
}

function infoRow(label: string, value: string): string {
  return `<div class="info-row"><span>${escHtml(label)}</span><span>${value}</span></div>`;
}

function statsCard(snap: Snapshot, s: Strings): string {
  const st = snap.stats;
  const rows = [
    infoRow(s.totalSessions, counter('total-sessions', st.totalSessions, 'int', s.locale)),
    infoRow(s.totalMessages, counter('total-messages', st.totalMessages, 'int', s.locale)),
  ];
  if (st.longestSession) {
    rows.push(infoRow(s.longestSession, `${formatDuration(st.longestSession.duration)} (${st.longestSession.messageCount} msg)`));
  }
  if (snap.peakHour) rows.push(infoRow(s.peakHour, snap.peakHour));
  if (st.firstSessionDate) {
    const since = new Date(st.firstSessionDate).toLocaleDateString(s.locale, { day: 'numeric', month: 'short' });
    rows.push(infoRow(s.memberSince, escHtml(since)));
  }
  return `<div class="card reveal" style="--i:13">${rows.join('')}</div>`;
}

/** One leaderboard column: ranked rows, or a waiting notice until the backend answers. */
function boardPanel(kind: LeaderboardKind, entries: LeaderboardEntry[], active: boolean, s: Strings): string {
  const body = entries.length
    ? entries.map(e => `<div class="lb-row${e.isMe ? ' me' : ''}">
        <span class="lb-rank">#${e.rank}</span>
        <span class="lb-name">${escHtml(e.pseudo)}</span>
        <span class="lb-tok">${formatTokens(e.tokens)}</span>
      </div>`).join('')
    : `<div class="lb-waiting">${loadingCrab()}<span>${escHtml(s.lbWaiting)}</span></div>`;
  return `<div class="lb-panel${active ? ' active' : ''}" data-board="${kind}">${body}</div>`;
}

/**
 * The opt-in leaderboard card: a pseudo prompt before opting in, then the three
 * boards plus what the user is sharing. Data flows in from the sync service.
 */
export function renderLeaderboard(
  s: Strings,
  pseudo: string | undefined,
  lb: Leaderboards | null,
  shared: { today: number; last7: number; total: number },
): string {
  const title = sectionTitle(s.leaderboard, 14);

  if (!pseudo) {
    return `${title}
<div class="card reveal" style="--i:15">
  <div class="lb-intro">${escHtml(s.lbIntro)}</div>
  <form class="lb-form" data-form="pseudo">
    <input class="lb-input" type="text" maxlength="40" placeholder="${escHtml(s.lbPlaceholder)}" aria-label="${escHtml(s.lbPlaceholder)}">
    <button type="submit" class="lb-save">${escHtml(s.lbJoin)}</button>
  </form>
</div>`;
  }

  const tabs = BOARDS.map((k, i) =>
    `<button class="lb-tab${i === 0 ? ' active' : ''}" data-board="${k}" type="button">${escHtml(s.boards[k])}</button>`,
  ).join('');
  const panels = BOARDS.map((k, i) => boardPanel(k, lb?.[k] ?? [], i === 0, s)).join('');

  return `${title}
<div class="card reveal" style="--i:15">
  <div class="lb-tabs" role="tablist">${tabs}</div>
  <div class="lb-panels">${panels}</div>
  <div class="lb-shared-title">${escHtml(s.lbShared)}</div>
  ${infoRow(s.today, formatTokens(shared.today))}
  ${infoRow(s.last7, formatTokens(shared.last7))}
  ${infoRow(s.total, formatTokens(shared.total))}
  <div class="lb-identity">
    <span>${escHtml(s.lbConnectedAs)} <b>${escHtml(pseudo)}</b></span>
    <button class="lb-edit" data-action="edit-pseudo" type="button">${escHtml(s.lbEdit)}</button>
  </div>
  <form class="lb-form hidden" data-form="pseudo">
    <input class="lb-input" type="text" maxlength="40" placeholder="${escHtml(s.lbPlaceholder)}" value="${escHtml(pseudo)}" aria-label="${escHtml(s.lbPlaceholder)}">
    <button type="submit" class="lb-save">${escHtml(s.lbJoin)}</button>
  </form>
</div>`;
}

export function renderDashboard(snap: Snapshot, s: Strings, easterEgg: string): string {
  return [
    moodChip(snap, s),
    easterEgg ? `<div class="easteregg reveal" style="--i:2">${escHtml(easterEgg).replace(/\n/g, '<br>')}</div>` : '',
    sectionTitle(s.today, 2),
    `<div class="stat-grid">
      ${statCard(icons.bolt, counter('tokens', snap.todayTokens, 'tokens', s.locale), s.tokens, 3)}
      ${statCard(icons.bubble, counter('messages', snap.today.messages, 'int', s.locale), s.messages, 4)}
      ${statCard(icons.layers, counter('sessions', snap.today.sessions, 'int', s.locale), s.sessions, 5)}
      ${statCard(icons.wrench, counter('tools', snap.today.toolCalls, 'int', s.locale), s.toolCalls, 6)}
    </div>`,
    progressCard(snap, s),
    sectionTitle(s.last7, 8),
    chartCard(snap, s),
    sectionTitle(s.models, 10),
    modelsCard(snap, s),
    sectionTitle(s.stats, 12),
    statsCard(snap, s),
  ].join('\n');
}
