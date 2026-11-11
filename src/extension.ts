import * as vscode from 'vscode';
import * as path from 'path';
import type { Snapshot } from './types';
import { isEnabled, isFocus } from './config';
import { StatusBar } from './statusBar';
import { nag, registerCommands } from './commands';
import { buildSnapshot, getSnapshot } from './stats/snapshot';
import { watchCopilot } from './copilot';
import { CrabPanelProvider } from './webview/provider';
import { setPseudo } from './sync/identity';
import { SyncService } from './sync/sync';
import { Coordinator } from './coordinator';

const FIRST_REFRESH_DELAY_MS = 1500;
/** At most one nag per period across all windows, shown in the focused one. */
const NAG_PERIOD_MS = 10 * 60_000;
/** How often each window checks whether the current nag slot is still free. */
const NAG_CHECK_MS = 60_000;

export function activate(context: vscode.ExtensionContext) {
  const statusBar = new StatusBar();
  // globalStorageUri is the same folder for every window: used to elect who nags / pushes.
  const coordinator = new Coordinator(path.join(context.globalStorageUri.fsPath, 'locks'));

  // Opt-in leaderboard sync: pushes usage totals and pulls the leaderboards back.
  const sync = new SyncService(
    context,
    () => getSnapshot(),
    lb => panel.setLeaderboards(lb),
    coordinator,
    () => panel.visible,
  );

  const panel = new CrabPanelProvider(context.extensionUri, context, {
    onRefresh: () => onManualRefresh(),
    onSetPseudo: async (pseudo: string) => {
      await setPseudo(context, pseudo);
      onManualRefresh();
    },
    onVisible: () => void sync.pullIfMissing(),
  });

  context.subscriptions.push(
    statusBar,
    sync,
    vscode.window.registerWebviewViewProvider(CrabPanelProvider.viewType, panel),
  );

  /** Reads stats once and pushes them to the status bar and the panel. */
  function refresh(): Snapshot | null {
    // Focus mode keeps the panel alive but hides the status-bar counter.
    const showStatus = isEnabled() && !isFocus();
    if (!showStatus) statusBar.hide();
    if (!showStatus && !panel.visible) return null;

    const snap = buildSnapshot();
    if (showStatus) statusBar.update(snap);
    panel.update(snap);
    return snap;
  }

  /** Refresh triggered by the user (panel button): also kicks a leaderboard sync. */
  function onManualRefresh(): void {
    refresh();
    void sync.syncNow();
  }

  registerCommands(context, refresh);
  watchCopilot(context);

  // The first scan reads every transcript touched today (can be hundreds of MB):
  // keep it out of activate() and show a placeholder meanwhile.
  if (isEnabled() && !isFocus()) statusBar.update(null);
  const firstRefresh = setTimeout(() => {
    refresh();
    sync.start();
  }, FIRST_REFRESH_DELAY_MS);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('claudolingo')) refresh();
    }),
  );

  // Nags go to the window the user is looking at, once per slot for all windows
  // (previously each open window popped its own every 10 minutes).
  const extPath = context.extensionUri.fsPath;
  const maybeNag = () => {
    if (vscode.window.state.focused && coordinator.claim('nag', NAG_PERIOD_MS)) nag(extPath);
  };
  const nagInterval = setInterval(maybeNag, NAG_CHECK_MS);
  const uiInterval = setInterval(refresh, 60_000);
  const firstNag = setTimeout(maybeNag, 30_000);

  context.subscriptions.push({ dispose: () => {
    clearInterval(nagInterval);
    clearInterval(uiInterval);
    clearTimeout(firstNag);
    clearTimeout(firstRefresh);
  }});
}

export function deactivate() {}
