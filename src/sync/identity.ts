import * as vscode from 'vscode';
import * as crypto from 'crypto';

// The pseudo is what other players see; the clientId is the stable, private
// identity we send with every sync so the backend can tell machines apart and
// a pseudo can't be hijacked just by typing it on another install.
const CLIENT_ID_KEY = 'claudolingo.clientId';
const PSEUDO_KEY = 'claudolingo.pseudo';

export const PSEUDO_MAX_LENGTH = 40;

/** Returns the stable per-install id, generating and persisting one the first time. */
export function getClientId(ctx: vscode.ExtensionContext): string {
  let id = ctx.globalState.get<string>(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    void ctx.globalState.update(CLIENT_ID_KEY, id);
  }
  return id;
}

/** The chosen pseudo, or undefined when the user hasn't opted in yet. */
export function getPseudo(ctx: vscode.ExtensionContext): string | undefined {
  const raw = ctx.globalState.get<string>(PSEUDO_KEY);
  return raw && raw.trim() ? raw.trim() : undefined;
}

/**
 * Stores the pseudo (opting the user in) or clears it when given an empty
 * string. Returns the sanitized value actually kept.
 */
export async function setPseudo(ctx: vscode.ExtensionContext, raw: string): Promise<string | undefined> {
  const clean = sanitizePseudo(raw);
  await ctx.globalState.update(PSEUDO_KEY, clean ?? '');
  return clean;
}

/** Trims, strips control characters and clamps length. undefined when nothing is left. */
export function sanitizePseudo(raw: string): string | undefined {
  // eslint-disable-next-line no-control-regex
  const clean = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, PSEUDO_MAX_LENGTH);
  return clean || undefined;
}
