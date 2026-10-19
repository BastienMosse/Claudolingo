import * as vscode from 'vscode';

export type Lang = 'fr' | 'en';

/** Default Claudolingo backend; overridable via `claudolingo.apiUrl` for dev / self-host. */
export const DEFAULT_API_URL = 'https://sl4sh.dev';

function cfg() {
  return vscode.workspace.getConfiguration('claudolingo');
}

export function getApiUrl(): string {
  const override = cfg().get<string>('apiUrl')?.trim();
  return override || DEFAULT_API_URL;
}

export function getLang(): Lang {
  return cfg().get<string>('language') === 'en' ? 'en' : 'fr';
}

export function isEnabled(): boolean {
  return cfg().get<boolean>('enabled') ?? true;
}

/** Focus mode: hides the token counter and silences every alert. */
export function isFocus(): boolean {
  return cfg().get<boolean>('focus') ?? false;
}
