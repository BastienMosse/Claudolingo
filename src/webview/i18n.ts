import type { Lang } from '../config';
import type { Mood } from '../mood';

export interface Strings {
  locale: string;
  today: string;
  tokens: string;
  messages: string;
  sessions: string;
  toolCalls: string;
  streak: string;
  days: (n: number) => string;
  daysWord: string;
  vsAverage: string;
  last7: string;
  tokensPerDay: string;
  max: string;
  models: string;
  total: string;
  stats: string;
  totalSessions: string;
  totalMessages: string;
  longestSession: string;
  peakHour: string;
  memberSince: string;
  refresh: string;
  retry: string;
  /** Indexed by Date.getDay() */
  dayInitials: string[];
  moods: Record<Mood, string>;
  /** ago: null = no prompt today, '' = less than a minute */
  lastPrompt: (ago: string | null) => string;
  errorTitle: string;
  errorText: string;
  lostBubbles: string[];
}

const fr: Strings = {
  locale: 'fr-FR',
  today: "Aujourd'hui",
  tokens: 'tokens',
  messages: 'messages',
  sessions: 'sessions',
  toolCalls: 'tool calls',
  streak: 'Streak',
  days: n => `${n} jour${n > 1 ? 's' : ''}`,
  daysWord: 'jours',
  vsAverage: 'vs moyenne journalière',
  last7: '7 derniers jours',
  tokensPerDay: 'tokens / jour',
  max: 'max',
  models: 'Modèles',
  total: 'Total',
  stats: 'Stats',
  totalSessions: 'Sessions totales',
  totalMessages: 'Messages totaux',
  longestSession: 'Plus longue session',
  peakHour: 'Heure de pointe',
  memberSince: 'Membre depuis',
  refresh: 'Rafraîchir',
  retry: 'Réessayer',
  dayInitials: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  moods: { chill: 'Chill', waiting: 'En attente', impatient: 'Impatient', angry: 'Énervé', unhinged: 'Hors de contrôle' },
  lastPrompt: ago => ago === null ? "aucun prompt aujourd'hui" : ago ? `dernier prompt il y a ${ago}` : "dernier prompt à l'instant",
  errorTitle: 'Stats Claude introuvables',
  errorText: "Le crabe a fouillé partout mais il ne trouve pas ton fichier de stats. Lance Claude Code au moins une fois, puis réessaie.",
  lostBubbles: [
    'Euh… elles sont où, tes stats ?',
    "J'ai cherché partout. Rien.",
    'Pas de stats, pas de streak.',
    'Le crabe est perdu. Aide-le.',
  ],
};

const en: Strings = {
  locale: 'en-US',
  today: 'Today',
  tokens: 'tokens',
  messages: 'messages',
  sessions: 'sessions',
  toolCalls: 'tool calls',
  streak: 'Streak',
  days: n => `${n} day${n === 1 ? '' : 's'}`,
  daysWord: 'days',
  vsAverage: 'vs daily average',
  last7: 'Last 7 days',
  tokensPerDay: 'tokens / day',
  max: 'max',
  models: 'Models',
  total: 'Total',
  stats: 'Stats',
  totalSessions: 'Total sessions',
  totalMessages: 'Total messages',
  longestSession: 'Longest session',
  peakHour: 'Peak hour',
  memberSince: 'Member since',
  refresh: 'Refresh',
  retry: 'Try again',
  dayInitials: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  moods: { chill: 'Chill', waiting: 'Waiting', impatient: 'Impatient', angry: 'Angry', unhinged: 'Unhinged' },
  lastPrompt: ago => ago === null ? 'no prompt today' : ago ? `last prompt ${ago} ago` : 'last prompt just now',
  errorTitle: 'Claude stats not found',
  errorText: "The crab looked everywhere but can't find your stats file. Run Claude Code at least once, then try again.",
  lostBubbles: [
    'Uh… where are your stats?',
    'I looked everywhere. Nothing.',
    'No stats, no streak.',
    'The crab is lost. Help him.',
  ],
};

export function strings(lang: Lang): Strings {
  return lang === 'en' ? en : fr;
}
