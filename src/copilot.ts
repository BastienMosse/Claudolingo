import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getLang, isEnabled, isFocus } from './config';
import { pick } from './format';
import { getMessages } from './messages';

const COOLDOWN_MS = 10 * 60_000;

// e.g. "ccreq:f2e9f57b.copilotmd | success | gpt-5.6-luna | 1707ms | [panel/editAgent]"
const REQUEST_LINE = /ccreq:\w+\.copilotmd \| success \| [^|]+ \| \d+ms \| \[([^\]]+)\]/;

/** Chat messages and Next Edit Suggestions; side requests (titles, progress…) are ignored. */
function isUserFacing(origin: string): boolean {
  return origin.startsWith('panel/') || origin === 'XtabProvider' || origin.startsWith('nes.');
}

/**
 * Tails Copilot Chat's log (undocumented format, same window as us) and
 * shames the user when it sees a request, at most once per cooldown.
 */
export function watchCopilot(context: vscode.ExtensionContext) {
  const extPath = context.extensionUri.fsPath;
  const file = path.join(context.logUri.fsPath, '..', 'GitHub.copilot-chat', 'GitHub Copilot Chat.log');
  let offset = fs.existsSync(file) ? fs.statSync(file).size : 0;
  let partial = '';
  let lastShamed = 0;

  function readNewLines(curr: fs.Stats): string[] {
    if (curr.size < offset) offset = 0;
    if (curr.size === offset) return [];

    const chunk = Buffer.alloc(curr.size - offset);
    const fd = fs.openSync(file, 'r');
    try {
      fs.readSync(fd, chunk, 0, chunk.length, offset);
    } finally {
      fs.closeSync(fd);
    }
    offset = curr.size;

    const lines = (partial + chunk.toString('utf-8')).split('\n');
    partial = lines.pop() ?? '';
    return lines;
  }

  function onChange(curr: fs.Stats) {
    let lines: string[];
    try {
      lines = readNewLines(curr);
    } catch {
      return;
    }

    const used = lines.some(line => {
      const m = REQUEST_LINE.exec(line);
      return m !== null && isUserFacing(m[1]);
    });
    if (!used || !isEnabled() || isFocus() || Date.now() - lastShamed < COOLDOWN_MS) return;

    lastShamed = Date.now();
    vscode.window.showWarningMessage(`🦀 ${pick(getMessages(extPath, getLang(), 'copilot'))}`);
  }

  // Polling rather than fs.watch: the file may not exist yet if Copilot activates after us.
  fs.watchFile(file, { interval: 1000 }, onChange);
  context.subscriptions.push({ dispose: () => fs.unwatchFile(file, onChange) });
}
