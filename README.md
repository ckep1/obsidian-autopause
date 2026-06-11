# AutoPause

AutoPause is a simple Obsidian plugin that automatically pauses playing audio when a new clip is played, with the option to reset to the beginning instead of just pausing. This is to allow for one audio stream maximum without needing to locate the previous playing file. It also includes hotkeys to iterate through audio elements and play/pause from any tab.

## Features

- Automatically pauses playing audio when a new clip is played
- Option to reset to the beginning instead of just pausing
- **Hotkey support for controlling audio clips**
  - Next audio: Play the next audio file in the current tab
  - Previous audio: Play the previous audio file in the current tab
  - **Play/pause toggle: Pause currently playing audio globally, or resume the last paused audio if still available**
- **Option to prevent keyboard focus on audio player elements**
- Works on desktop and mobile across tabs and document types.

## Installation

Add to Obsidian via the Community Plugins Library in settings or:
1. Download the latest release from the [Releases](https://github.com/ckep1/obsidian-autopause/releases) page (manifest.json and main.js)
2. Add these files to a folder called `auto-pause` in the Plugins folder of your Obsidian Vault
3. Reload Obsidian

## Usage

- No interaction is required besides enabling the plugin.
- With an audio clip playing, starting another one will pause or stop the initial playing one depending on the setting.
- **Use hotkeys to control audio playback** (configure in Settings > Hotkeys > AutoPause):
  - "Play next audio" - Cycles to the next audio file in the active tab and plays it
  - "Play previous audio" - Cycles to the previous audio file in the active tab and plays it
  - **"Play/pause audio" - Pauses currently playing audio globally, then resumes the last paused audio if still available (otherwise plays the first available audio)**
- Tested and working with local audio files and the default Obsidian audio embed.

## Settings

- **Reset to beginning**: When enabled, other audio clips will be reset to the beginning instead of just pausing. This is the same as stopping in other audio players.
- **Prevent keyboard focus**: When enabled, audio player elements cannot be focused with the Tab key, preventing keyboard navigation from interfering with shortcuts.

## Hotkeys

The plugin registers three commands that can be assigned hotkeys in Obsidian's hotkey settings:

- **Play next audio**: Cycles through audio files in forward order in the active tab
- **Play previous audio**: Cycles through audio files in reverse order in the active tab
- **Play/pause audio**: Pauses currently playing audio globally or resumes the last paused audio if still available

To assign hotkeys:
1. Go to Settings → Hotkeys
2. Search for "AutoPause" or the specific command names
3. Click the + button to assign your preferred key combination

*Note: Hotkeys are blank by default and need to be manually configured by the user.*
