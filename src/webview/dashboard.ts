import type { Snapshot } from '../types';
import type { Strings } from './i18n';
import { MOOD_EMOJIS } from '../mood';
import { escHtml, formatDuration, formatModelName, formatTokens } from '../format';
import { icons } from './icons';

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
