import * as vscode from 'vscode';
import type { Snapshot } from './types';
import { formatTokens } from './format';

/** Today's tokens only, bottom-left. */
export class StatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

  constructor() {
    this.item.command = 'claudolingo.status';
    this.item.tooltip = 'Claudolingo — stats Claude Pro';
  }

  update(snap: Snapshot | null) {
    this.item.text = snap ? `🦀 ${formatTokens(snap.todayTokens)} tokens` : '🦀 --';
    this.item.show();
  }

  hide() {
    this.item.hide();
  }

  dispose() {
    this.item.dispose();
  }
}
