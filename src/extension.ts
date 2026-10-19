import * as vscode from 'vscode';
import type { Snapshot } from './types';
import { isEnabled, isFocus } from './config';
import { StatusBar } from './statusBar';
import { nag, registerCommands } from './commands';
import { buildSnapshot } from './stats/snapshot';
import { watchCopilot } from './copilot';
import { CrabPanelProvider } from './webview/provider';
import { setPseudo } from './sync/identity';
import { SyncService } from './sync/sync';

export function activate(context: vscode.ExtensionContext) {
  const statusBar = new StatusBar();

  // Opt-in leaderboard sync: pushes usage totals and pulls the leaderboards back.
  const sync = new SyncService(context, () => buildSnapshot(), lb => panel.setLeaderboards(lb));

  const panel = new CrabPanelProvider(context.extensionUri, context, {
    onRefresh: () => onManualRefresh(),
    onSetPseudo: async (pseudo: string) => {
      await setPseudo(context, pseudo);
      onManualRefresh();
    },
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
  refresh();
  sync.start();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('claudolingo')) refresh();
    }),
  );

  const extPath = context.extensionUri.fsPath;
  const nagInterval = setInterval(() => nag(extPath), 10 * 60_000);
  const uiInterval = setInterval(refresh, 60_000);
  const firstNag = setTimeout(() => nag(extPath), 30_000);

  context.subscriptions.push({ dispose: () => {
    clearInterval(nagInterval);
    clearInterval(uiInterval);
    clearTimeout(firstNag);
  }});
}

export function deactivate() {}
