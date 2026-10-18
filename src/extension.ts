import * as vscode from 'vscode';
import type { Snapshot } from './types';
import { isEnabled } from './config';
import { StatusBar } from './statusBar';
import { nag, registerCommands } from './commands';
import { buildSnapshot } from './stats/snapshot';
import { watchCopilot } from './copilot';
import { CrabPanelProvider } from './webview/provider';

export function activate(context: vscode.ExtensionContext) {
  const statusBar = new StatusBar();
  const panel = new CrabPanelProvider(context.extensionUri, () => refresh());
  context.subscriptions.push(
    statusBar,
    vscode.window.registerWebviewViewProvider(CrabPanelProvider.viewType, panel),
  );

  /** Reads stats once and pushes them to the status bar and the panel. */
  function refresh(): Snapshot | null {
    const enabled = isEnabled();
    if (!enabled) statusBar.hide();
    if (!enabled && !panel.visible) return null;

    const snap = buildSnapshot();
    if (enabled) statusBar.update(snap);
    panel.update(snap);
    return snap;
  }

  registerCommands(context, refresh);
  watchCopilot(context);
  refresh();

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
