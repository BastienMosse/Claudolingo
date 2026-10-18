import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { Lang } from '../config';

/** HTML shell shared by the dashboard and the error page. */
export function renderPage(webview: vscode.Webview, extensionUri: vscode.Uri, lang: Lang, body: string, state: unknown): string {
  const nonce = crypto.randomBytes(16).toString('base64');
  const asset = (...p: string[]) => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', ...p));
  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `img-src ${webview.cspSource} data:`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');
  const json = JSON.stringify(state).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${asset('webview', 'style.css')}">
<link rel="stylesheet" href="${asset('webview', 'scene.css')}">
</head>
<body>
${body}
<script type="application/json" id="state">${json}</script>
<script nonce="${nonce}" src="${asset('webview', 'main.js')}"></script>
</body>
</html>`;
}
