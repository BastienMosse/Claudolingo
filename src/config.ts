import * as vscode from 'vscode';

export type Lang = 'fr' | 'en';

function cfg() {
  return vscode.workspace.getConfiguration('claudolingo');
}

export function getLang(): Lang {
  return cfg().get<string>('language') === 'en' ? 'en' : 'fr';
}

export function isEnabled(): boolean {
  return cfg().get<boolean>('enabled') ?? true;
}
