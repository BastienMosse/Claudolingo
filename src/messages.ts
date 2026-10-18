import * as fs from 'fs';
import * as path from 'path';
import type { Lang } from './config';

type MessageBook = Record<string, Record<string, string[]>>;

const FALLBACK: MessageBook = {
  fr: { chill: ['Claude est là.'], waiting: ['Prompte un peu.'], impatient: ['Claude attend.'], angry: ['Prompte !'], unhinged: ['PROMPTE.'] },
  en: { chill: ['Claude is here.'], waiting: ['Prompt a little.'], impatient: ['Claude waits.'], angry: ['Prompt!'], unhinged: ['PROMPT.'] },
};

let _messages: MessageBook | null = null;

function loadMessages(extensionPath: string): MessageBook {
  if (!_messages) {
    try {
      _messages = JSON.parse(fs.readFileSync(path.join(extensionPath, 'media', 'messages.json'), 'utf-8'));
    } catch {
      _messages = FALLBACK;
    }
  }
  return _messages!;
}

/** Messages for a mood (or 'billion', 'easteregg'…), falling back to French. */
export function getMessages(extensionPath: string, lang: Lang, key: string): string[] {
  const all = loadMessages(extensionPath);
  return all[lang]?.[key] ?? all.fr?.[key] ?? ['Prompte !'];
}
