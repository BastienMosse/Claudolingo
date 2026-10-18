import * as fs from 'fs';
import * as path from 'path';

/**
 * The scene is split into one SVG file per element (media/scene/*.svg).
 * Every part shares the same 800x450 viewBox, so they stack without offsets.
 */
export type ScenePart = 'sky' | 'sign' | 'bubble' | 'owl' | 'bush' | 'crab';

export const DASHBOARD_PARTS: ScenePart[] = ['sky', 'sign', 'bubble', 'owl', 'bush', 'crab'];
export const ERROR_PARTS: ScenePart[] = ['sky', 'bubble', 'crab'];

/** Streak bar geometry inside sign.svg */
const BAR_X = 70;
const BAR_WIDTH = 230;

const _parts = new Map<ScenePart, string>();

function loadPart(extensionPath: string, name: ScenePart): string {
  let part = _parts.get(name);
  if (part === undefined) {
    const raw = fs.readFileSync(path.join(extensionPath, 'media', 'scene', `${name}.svg`), 'utf-8');
    // Keep only what's inside the root <svg>
    part = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    _parts.set(name, part);
  }
  return part;
}

/** Values are inserted as-is: escape them before. */
export function renderScene(extensionPath: string, parts: ScenePart[], vars: Record<string, string | number>): string {
  const inner = parts
    .map(p => loadPart(extensionPath, p))
    .join('\n')
    .replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String(vars[key] ?? ''));
  return `<svg class="scene-svg" viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

export function streakBar(streak: number) {
  const ratio = Math.min(1, streak / 30);
  const width = streak > 0 ? Math.max(20, Math.round(ratio * BAR_WIDTH)) : 0;
  return {
    barW: width,
    barHlW: Math.max(0, width - 16),
    crackX: BAR_X + width,
    full: streak >= 30,
  };
}
