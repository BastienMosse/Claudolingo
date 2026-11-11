import * as fs from 'fs';
import * as path from 'path';

/**
 * Cross-window coordination. Every VS Code window runs its own copy of the extension,
 * so work that must happen once per machine (nag popups, leaderboard pushes) claims a
 * slot of wall-clock time by atomically creating a file in the global storage
 * directory, which all windows share. Exclusive create ('wx') lets exactly one win.
 */
export class Coordinator {
  constructor(private readonly dir: string) {}

  /**
   * True for exactly one caller, across all windows, per `periodMs` slot.
   * If the lock directory is unusable, every caller wins (the pre-coordination behaviour).
   */
  claim(task: string, periodMs: number): boolean {
    const slot = Math.floor(Date.now() / periodMs);
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.closeSync(fs.openSync(path.join(this.dir, `${task}-${slot}`), 'wx'));
    } catch (e) {
      return (e as NodeJS.ErrnoException).code !== 'EEXIST';
    }
    this.prune(task, slot);
    return true;
  }

  /**
   * Removes this task's locks older than the previous slot. The previous one is kept so
   * a window that computed its slot just before the boundary (then got descheduled)
   * still finds the lock and doesn't win that slot a second time.
   */
  private prune(task: string, slot: number): void {
    const prefix = `${task}-`;
    let names: string[];
    try { names = fs.readdirSync(this.dir); } catch { return; }
    for (const name of names) {
      if (!name.startsWith(prefix)) continue;
      const n = Number(name.slice(prefix.length));
      if (Number.isInteger(n) && n < slot - 1) {
        try { fs.unlinkSync(path.join(this.dir, name)); } catch { /* another window got it */ }
      }
    }
  }
}
