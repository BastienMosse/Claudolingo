import * as vscode from 'vscode';
import type { Leaderboards, Snapshot } from '../types';
import type { Mood } from '../mood';
import { getLang } from '../config';
import { escHtml, pick } from '../format';
import { getMessages } from '../messages';
import { getPseudo } from '../sync/identity';
import { buildSnapshot } from '../stats/snapshot';
import { strings } from './i18n';
import { renderPage } from './page';
import { renderDashboard, renderLeaderboard } from './dashboard';
import { renderErrorBody } from './errorPage';
import { DASHBOARD_PARTS, renderScene, streakBar } from './scene';

/** Callbacks the panel fires back to the extension host. */
export interface PanelCallbacks {
  onRefresh: () => void;
  onSetPseudo: (pseudo: string) => void;
}

/** What main.js needs to drive the scene; also sent on every refresh. */
export interface SceneState {
  mood: Mood | 'lost';
  fire: number;
  full: boolean;
  streakLabel: string;
  barW: number;
  barHlW: number;
  crackX: number;
  bubble: string;
  /** Pool the crab picks from when clicked */
  messages: string[];
}

function fireLevel(streak: number): number {
  return streak >= 30 ? 4 : streak >= 14 ? 3 : streak >= 7 ? 2 : streak > 0 ? 1 : 0;
}

export class CrabPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claudolingo.panel';
  public forceEasterEgg = false;

  private view?: vscode.WebviewView;
  /** undefined = never read yet, null = stats missing */
  private snapshot?: Snapshot | null;
  private page?: 'dashboard' | 'error';
  /** The bubble keeps its message until the mood changes or the crab is clicked. */
  private bubble?: { key: string; text: string };
  /** Latest leaderboards from the sync service; null until a successful fetch. */
  private leaderboards: Leaderboards | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext,
    private readonly callbacks: PanelCallbacks,
  ) {}

  /** Called by the sync service after a successful fetch; re-renders the board in place. */
  public setLeaderboards(lb: Leaderboards | null) {
    this.leaderboards = lb;
    if (this.snapshot) this.update(this.snapshot);
  }

  get visible(): boolean {
    return !!this.view?.visible;
  }

  public resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    view.webview.onDidReceiveMessage(msg => {
      if (msg?.command === 'refresh') this.callbacks.onRefresh();
      else if (msg?.command === 'setPseudo' && typeof msg.pseudo === 'string') this.callbacks.onSetPseudo(msg.pseudo);
    });
    // Hidden webviews lose their DOM: re-render with fresh data when shown again.
    view.onDidChangeVisibility(() => {
      if (view.visible) this.render();
    });
    view.onDidDispose(() => {
      this.view = undefined;
      this.page = undefined;
    });
    if (this.snapshot === undefined) this.snapshot = buildSnapshot();
    this.render();
  }

  /** Pushes new data without reloading the page, so animations keep running. */
  public update(snap: Snapshot | null) {
    this.snapshot = snap;
    if (!this.view?.visible) return;

    if (!snap) {
      if (this.page === 'error') void this.view.webview.postMessage({ type: 'still-missing' });
      else this.render();
      return;
    }
    if (this.page !== 'dashboard') {
      this.render();
      return;
    }
    const { scene, dashboard } = this.buildDashboard(snap);
    void this.view.webview.postMessage({ type: 'update', scene, dashboard });
  }

  private render() {
    if (!this.view) return;
    const lang = getLang();
    const webview = this.view.webview;
    const snap = this.snapshot ?? null;
    const extPath = this.extensionUri.fsPath;

    if (!snap) {
      const { body, scene } = renderErrorBody(extPath, strings(lang));
      this.page = 'error';
      webview.html = renderPage(webview, this.extensionUri, lang, body, { lang, page: 'error', scene });
      return;
    }

    const { scene, dashboard, billion } = this.buildDashboard(snap);
    const svg = renderScene(extPath, DASHBOARD_PARTS, {
      STREAK_LABEL: escHtml(scene.streakLabel),
      BAR_W: scene.barW,
      BAR_HL_W: scene.barHlW,
      CRACK_X: scene.crackX,
      BUBBLE: escHtml(scene.bubble),
    });
    const body = `<div id="app"${billion ? ' data-billion="1"' : ''}>
  <div class="scene-wrap reveal" data-fire="${scene.fire}">
    <div class="scene" id="scene" data-mood="${scene.mood}" data-full="${scene.full ? 1 : 0}">${svg}</div>
  </div>
  <div id="dashboard">${dashboard}</div>
  <button class="btn reveal" style="--i:14" data-action="refresh"><span class="btn-icon">↻</span>${escHtml(strings(lang).refresh)}</button>
</div>`;
    this.page = 'dashboard';
    webview.html = renderPage(webview, this.extensionUri, lang, body, { lang, page: 'dashboard', scene });
  }

  private buildDashboard(snap: Snapshot): { scene: SceneState; dashboard: string; billion: boolean } {
    const lang = getLang();
    const s = strings(lang);
    const extPath = this.extensionUri.fsPath;
    const billion = snap.todayTokens >= 1_000_000_000 || this.forceEasterEgg;
    const moodKey = billion ? 'billion' : snap.mood;
    const messages = getMessages(extPath, lang, moodKey);

    const bubbleKey = `${lang}:${moodKey}`;
    if (this.bubble?.key !== bubbleKey) this.bubble = { key: bubbleKey, text: pick(messages) };

    const scene: SceneState = {
      mood: billion ? 'chill' : snap.mood,
      fire: fireLevel(snap.streak),
      streakLabel: s.days(snap.streak),
      ...streakBar(snap.streak),
      bubble: this.bubble.text,
      messages,
    };
    const easterEgg = billion ? (getMessages(extPath, lang, 'easteregg')[0] ?? '') : '';
    const last7 = snap.last7.reduce((a, d) => a + d.tokens, 0);
    const leaderboard = renderLeaderboard(s, getPseudo(this.context), this.leaderboards, {
      today: snap.todayTokens,
      last7,
      total: snap.totalTokens,
    });
    return { scene, dashboard: renderDashboard(snap, s, easterEgg) + leaderboard, billion };
  }
}
