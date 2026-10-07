# Claudolingo

A Duolingo-inspired VS Code extension that tracks your Claude Code usage with a passive-aggressive crab mascot.

## What it does

Claudolingo lives in your Activity Bar and watches your Claude Pro token usage in real time. The crab has opinions about your prompting habits — and it's not afraid to share them.

- **Streak counter** — tracks consecutive days of Claude usage, displayed on the crab scene
- **Mood system** — the crab's mood changes based on how recently you've used Claude:
  - **Chill** (< 5 min ago) — the crab is happy
  - **Waiting** (< 30 min) — getting restless
  - **Impatient** (< 1h30) — tapping claws
  - **Angry** (< 3h) — offended
  - **Unhinged** (3h+) — chaos mode
- **Live stats** — tokens, messages, sessions, and tool calls for today
- **7-day activity chart** — sparkline of your daily token usage
- **Model breakdown** — token usage per Claude model
- **Fire glow** — the crab scene glows brighter as your streak grows (7d, 14d, 30d thresholds)
- **Nag notifications** — mood-based popup reminders when you haven't prompted in a while
- **Easter egg** — hit 1 billion tokens in a single day and something special happens

## How it works

Claudolingo reads your local Claude Code stats.  
No data leaves your machine.  
The extension is fully offline.

## Installation

### From `.vsix` (recommended)

```bash
cd Claudolingo
npm install
npm run build
npm run package
```

This generates a `claudolingo-0.1.0.vsix` file. Install it with:

```bash
code --install-extension claudolingo-0.1.0.vsix
```

Then restart VS Code. The crab icon appears in the Activity Bar.

> **Note:** You need `@vscode/vsce` to package. Install it once with `npm install -g @vscode/vsce`.

### Development mode

Press `F5` in VS Code to launch the Extension Development Host with live reloading.

## Commands

| Command | Description |
|---------|-------------|
| `Claudolingo : j'ai utilisé Claude !` | Refresh stats and get a positive message |
| `Claudolingo : voir mon streak` | Show streak, tokens, and messages in a notification |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `claudolingo.language` | `fr` | Message language (`fr` or `en`) |
| `claudolingo.enabled` | `true` | Enable/disable the extension |
| `claudolingo.reminderIntervalMinutes` | `45` | Minutes before the crab starts nagging |