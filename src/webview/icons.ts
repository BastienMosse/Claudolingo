// Flat, Duolingo-like icons for the stat cards.

const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const icons = {
  bolt: svg('<path d="M13.5 2 4.5 13.5h6.5L10 22l9.5-12H13l.5-8z" fill="#ffc800" stroke="#ff9600" stroke-width="1.6" stroke-linejoin="round"/>'),
  bubble: svg('<path d="M3.5 6A3 3 0 0 1 6.5 3h11a3 3 0 0 1 3 3v7.5a3 3 0 0 1-3 3H12l-4.5 4v-4h-1a3 3 0 0 1-3-3z" fill="#1cb0f6"/><circle cx="8.5" cy="9.8" r="1.4" fill="#fff"/><circle cx="12" cy="9.8" r="1.4" fill="#fff"/><circle cx="15.5" cy="9.8" r="1.4" fill="#fff"/>'),
  layers: svg('<path d="m12 3 9.5 4.8L12 12.6 2.5 7.8z" fill="#ce82ff"/><path d="m2.5 12 9.5 4.8 9.5-4.8M2.5 16.2 12 21l9.5-4.8" fill="none" stroke="#a568cc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  wrench: svg('<path d="M20.6 6.7a5 5 0 0 1-6.4 6.2l-7 7a2.1 2.1 0 0 1-3-3l7-7a5 5 0 0 1 6.2-6.4l-3 3 .5 2.6 2.6.5z" fill="#ff4b4b"/>'),
  flame: svg('<path d="M12 22c-4.4 0-7-2.9-7-6.6 0-3.4 2.2-5 3.6-7.7.4 1.6 1.3 2.6 2.4 2.9C11 7 12.6 4.4 15 2c.3 3 4 6.4 4 12.2 0 4-2.8 7.8-7 7.8z" fill="#ff9600"/><path d="M12 20c-2 0-3.3-1.3-3.3-3.1 0-1.8 1.4-2.9 3.3-5.1 1.9 2.2 3.3 3.3 3.3 5.1C15.3 18.7 14 20 12 20z" fill="#ffc800"/>'),
  target: svg('<circle cx="12" cy="12" r="9.5" fill="#ff4b4b"/><circle cx="12" cy="12" r="6.3" fill="#fff"/><circle cx="12" cy="12" r="3.2" fill="#ff4b4b"/>'),
};
