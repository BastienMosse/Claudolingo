import * as vscode from 'vscode';
import type { Snapshot } from './types';
import { getLang, isEnabled, isFocus } from './config';
import { formatTokens, pick } from './format';
import { getMessages } from './messages';
import { buildSnapshot } from './stats/snapshot';

export function registerCommands(context: vscode.ExtensionContext, refresh: () => Snapshot | null) {
  const extPath = context.extensionUri.fsPath;

  context.subscriptions.push(
    vscode.commands.registerCommand('claudolingo.feed', () => {
      refresh();
      vscode.window.showInformationMessage(`🦀 ${pick(getMessages(extPath, getLang(), 'chill'))}`);
    }),

    vscode.commands.registerCommand('claudolingo.status', () => {
      const snap = buildSnapshot();
      if (!snap) {
        vscode.window.showWarningMessage('🦀 Stats Claude introuvables (~/.claude/stats-cache.json)');
        return;
      }
      const tokens = formatTokens(snap.todayTokens);
      const msg = getLang() === 'fr'
        ? `${snap.streak}j de streak · ${tokens} tokens · ${snap.today.messages} messages aujourd'hui`
        : `${snap.streak}d streak · ${tokens} tokens · ${snap.today.messages} messages today`;
      vscode.window.showInformationMessage(`🦀 ${msg}`);
    }),

    vscode.commands.registerCommand('claudolingo.toggleFocus', async () => {
      const on = !isFocus();
      await vscode.workspace.getConfiguration('claudolingo')
        .update('focus', on, vscode.ConfigurationTarget.Global);
      refresh();
      const fr = getLang() === 'fr';
      const msg = on
        ? (fr ? 'Mode focus activé — le crabe te laisse tranquille.' : 'Focus mode on — the crab leaves you alone.')
        : (fr ? 'Mode focus désactivé — le crabe est de retour.' : 'Focus mode off — the crab is back.');
      vscode.window.showInformationMessage(`🦀 ${msg}`);
    }),
  );
}

/** Mood-based popup when the user hasn't prompted in a while. */
export function nag(extPath: string) {
  if (!isEnabled() || isFocus()) return;
  const snap = buildSnapshot();
  if (!snap || snap.mood === 'chill') return;

  const msg = `🦀 ${pick(getMessages(extPath, getLang(), snap.mood))}`;
  if (snap.mood === 'unhinged') {
    vscode.window.showErrorMessage(msg);
  } else if (snap.mood === 'angry') {
    vscode.window.showWarningMessage(msg);
  } else {
    vscode.window.showInformationMessage(msg);
  }
}
