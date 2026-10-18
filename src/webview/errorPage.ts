import type { Strings } from './i18n';
import { escHtml, pick } from '../format';
import { ERROR_PARTS, renderScene } from './scene';
import type { SceneState } from './provider';

/** Shown when ~/.claude/stats-cache.json can't be read: the crab is lost. */
export function renderErrorBody(extensionPath: string, s: Strings): { body: string; scene: SceneState } {
  const bubble = pick(s.lostBubbles);
  const scene: SceneState = {
    mood: 'lost',
    fire: 0,
    full: false,
    streakLabel: '',
    barW: 0,
    barHlW: 0,
    crackX: 0,
    bubble,
    messages: s.lostBubbles,
  };
  const svg = renderScene(extensionPath, ERROR_PARTS, { BUBBLE: escHtml(bubble) });

  const body = `<div id="app" class="error-page">
  <div class="scene-wrap reveal" data-fire="0">
    <div class="scene" id="scene" data-mood="lost">${svg}</div>
  </div>
  <div class="card error-card reveal" style="--i:1">
    <div class="error-title">${escHtml(s.errorTitle)}</div>
    <p>${escHtml(s.errorText)}</p>
    <code>~/.claude/stats-cache.json</code>
  </div>
  <button class="btn reveal" style="--i:2" data-action="refresh"><span class="btn-icon">↻</span>${escHtml(s.retry)}</button>
</div>`;

  return { body, scene };
}
