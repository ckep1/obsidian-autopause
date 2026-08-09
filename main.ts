import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface AudioPausePluginSettings {
	resetToBeginning: boolean;
	preventKeyboardFocus: boolean;
}

interface ExtendedAudioElement extends HTMLAudioElement {
	_focusHandler?: (event: FocusEvent) => void;
	_clickHandler?: (event: MouseEvent) => void;
}

const DEFAULT_SETTINGS: AudioPausePluginSettings = {
	resetToBeginning: false,
	preventKeyboardFocus: false
}

export default class AudioPausePlugin extends Plugin {
	settings: AudioPausePluginSettings;
	private audioElements: HTMLAudioElement[] = [];
	private currentAudioIndex = -1;
	private lastPausedAudio: HTMLAudioElement | null = null;
	private trackedDocuments = new WeakSet<Document>();

	async onload() {
		await this.loadSettings();

		this.getAllDocuments().forEach(doc => this.trackDocument(doc));

		this.registerEvent(this.app.workspace.on('window-open', (workspaceWindow) => {
			this.trackDocument(workspaceWindow.doc);
			this.applyFocusPreventionToAll();
		}));

		this.applyFocusPreventionToAll();

		this.registerEvent(this.app.workspace.on('layout-change', () => {
			if (this.settings.preventKeyboardFocus) {
				activeWindow.setTimeout(() => this.applyFocusPreventionToAll(), 100);
			}
		}));

		this.addCommand({
			id: 'next-audio',
			name: 'Play next audio',
			callback: () => {
				this.playNextAudio();
			}
		});

		this.addCommand({
			id: 'previous-audio',
			name: 'Play previous audio',
			callback: () => {
				this.playPreviousAudio();
			}
		});

		this.addCommand({
			id: 'toggle-audio',
			name: 'Play/pause audio',
			callback: () => {
				this.toggleAudio();
			}
		});

		this.addSettingTab(new AudioPauseSettingTab(this.app, this));
	}

	private trackDocument(doc: Document) {
		if (this.trackedDocuments.has(doc)) {
			return;
		}
		this.trackedDocuments.add(doc);

		this.registerDomEvent(doc, 'play', (evt: Event) => {
			const target = this.asAudioElement(evt.target);
			if (target) {
				this.pauseOtherAudio(target);
				this.updateAudioElements();
				this.currentAudioIndex = this.audioElements.indexOf(target);
				this.lastPausedAudio = null;
				this.applyFocusPrevention(target);
			}
		}, true);

		this.registerDomEvent(doc, 'pause', (evt: Event) => {
			const target = this.asAudioElement(evt.target);
			if (target) {
				this.lastPausedAudio = target;
			}
		}, true);
	}

	private asAudioElement(target: EventTarget | null): HTMLAudioElement | null {
		const node = target as Node | null;
		return node && node.instanceOf(HTMLAudioElement) ? node : null;
	}

	private getAllDocuments(): Document[] {
		const documents = new Set<Document>([this.app.workspace.containerEl.doc]);
		this.app.workspace.iterateAllLeaves(leaf => documents.add(leaf.view.containerEl.doc));
		return Array.from(documents);
	}

	private getAllAudioElements(): HTMLAudioElement[] {
		const audioElements: HTMLAudioElement[] = [];
		this.getAllDocuments().forEach(doc => {
			audioElements.push(...Array.from(doc.querySelectorAll('audio')));
		});
		return audioElements;
	}

	onunload() {
		const allAudioElements = this.getAllAudioElements();
		allAudioElements.forEach(audio => {
			const originalSetting = this.settings.preventKeyboardFocus;
			this.settings.preventKeyboardFocus = false;
			this.applyFocusPrevention(audio);
			this.settings.preventKeyboardFocus = originalSetting;
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.applyFocusPreventionToAll();
	}

	private pauseOtherAudio(currentAudio: HTMLAudioElement) {
		const allAudioElements = this.getAllAudioElements();
		allAudioElements.forEach(audio => {
			if (audio !== currentAudio && !audio.paused) {
				audio.pause();
				if (this.settings.resetToBeginning) {
					audio.currentTime = 0;
				}
			}
		});
	}

	private playNextAudio() {
		this.updateAudioElements();

		if (this.audioElements.length === 0) {
			return;
		}

		let currentPlayingIndex = this.findCurrentlyPlayingAudio();

		if (currentPlayingIndex === -1) {
			if (this.lastPausedAudio && this.audioElements.includes(this.lastPausedAudio)) {
				currentPlayingIndex = this.audioElements.indexOf(this.lastPausedAudio);
			} else {
				currentPlayingIndex = -1;
			}
		}

		this.currentAudioIndex = (currentPlayingIndex + 1) % this.audioElements.length;
		this.pauseAllAudio();

		const nextAudio = this.audioElements[this.currentAudioIndex];
		if (nextAudio) {
			void nextAudio.play();
		}
	}

	private playPreviousAudio() {
		this.updateAudioElements();

		if (this.audioElements.length === 0) {
			return;
		}

		let currentPlayingIndex = this.findCurrentlyPlayingAudio();

		if (currentPlayingIndex === -1) {
			if (this.lastPausedAudio && this.audioElements.includes(this.lastPausedAudio)) {
				currentPlayingIndex = this.audioElements.indexOf(this.lastPausedAudio);
			} else {
				currentPlayingIndex = this.audioElements.length;
			}
		}

		this.currentAudioIndex = currentPlayingIndex <= 0
			? this.audioElements.length - 1
			: currentPlayingIndex - 1;

		this.pauseAllAudio();

		const previousAudio = this.audioElements[this.currentAudioIndex];
		if (previousAudio) {
			void previousAudio.play();
		}
	}

	private updateAudioElements() {
		const allAudioElements = this.getAllAudioElements();
		const activeTabContent = this.getActiveTabContent();

		if (activeTabContent) {
			this.audioElements = allAudioElements.filter(audio =>
				activeTabContent.contains(audio)
			);
		} else {
			this.audioElements = allAudioElements;
		}

		if (this.currentAudioIndex >= this.audioElements.length) {
			this.currentAudioIndex = -1;
		}
	}

	private getActiveTabContent(): Element | null {
		const activeLeaf = this.app.workspace.getMostRecentLeaf();
		if (activeLeaf && activeLeaf.view && activeLeaf.view.containerEl) {
			return activeLeaf.view.containerEl;
		}
		for (const doc of this.getAllDocuments()) {
			const activeContent = doc.querySelector('.workspace-leaf.mod-active .view-content');
			if (activeContent) {
				return activeContent;
			}
		}
		return null;
	}

	private findCurrentlyPlayingAudio(): number {
		for (let i = 0; i < this.audioElements.length; i++) {
			if (!this.audioElements[i].paused) {
				return i;
			}
		}
		return -1;
	}

	private toggleAudio() {
		this.updateGlobalAudioElements();
		const currentlyPlayingAudio = this.findGloballyPlayingAudio();

		if (currentlyPlayingAudio) {
			currentlyPlayingAudio.pause();
			this.lastPausedAudio = currentlyPlayingAudio;
			this.currentAudioIndex = this.audioElements.indexOf(currentlyPlayingAudio);
		} else if (this.lastPausedAudio && this.lastPausedAudio.isConnected) {
			this.updateGlobalAudioElements();
			if (this.audioElements.includes(this.lastPausedAudio)) {
				void this.lastPausedAudio.play();
				this.currentAudioIndex = this.audioElements.indexOf(this.lastPausedAudio);
			} else {
				this.playFirstAvailableGlobalAudio();
			}
		} else {
			this.playFirstAvailableGlobalAudio();
		}
	}

	private updateGlobalAudioElements() {
		this.audioElements = this.getAllAudioElements();

		if (this.currentAudioIndex >= this.audioElements.length) {
			this.currentAudioIndex = -1;
		}
	}

	private findGloballyPlayingAudio(): HTMLAudioElement | null {
		const allAudioElements = this.getAllAudioElements();
		for (const audio of allAudioElements) {
			if (!audio.paused) {
				return audio;
			}
		}
		return null;
	}

	private playFirstAvailableGlobalAudio() {
		this.updateGlobalAudioElements();
		if (this.audioElements.length > 0) {
			void this.audioElements[0].play();
			this.currentAudioIndex = 0;
			this.lastPausedAudio = null;
		}
	}

	private pauseAllAudio() {
		const allAudioElements = this.getAllAudioElements();
		allAudioElements.forEach(audio => {
			if (!audio.paused) {
				audio.pause();
				if (this.settings.resetToBeginning) {
					audio.currentTime = 0;
				}
			}
		});
	}

	private applyFocusPrevention(audio: HTMLAudioElement) {
		const extendedAudio = audio as ExtendedAudioElement;
		
		if (this.settings.preventKeyboardFocus) {
			if (extendedAudio._focusHandler) {
				const oldFocusHandler = extendedAudio._focusHandler;
				audio.removeEventListener('focus', oldFocusHandler, true);
				audio.removeEventListener('focusin', oldFocusHandler, true);
				const allChildren = audio.querySelectorAll('*');
				allChildren.forEach(child => {
					if (child.instanceOf(HTMLElement)) {
						child.removeEventListener('focus', oldFocusHandler, true);
						child.removeEventListener('focusin', oldFocusHandler, true);
					}
				});
			}
			if (extendedAudio._clickHandler) {
				audio.removeEventListener('click', extendedAudio._clickHandler, true);
			}

			audio.tabIndex = -1;
			
			// Prevent focus on all interactive elements within the audio
			const interactiveElements = audio.querySelectorAll('button, input, [tabindex], [role="button"]');
			interactiveElements.forEach(element => {
				if (element.instanceOf(HTMLElement)) {
					element.tabIndex = -1;
				}
			});

			// Add focus event listeners to prevent focus entirely
			const focusHandler = (event: FocusEvent) => {
				event.preventDefault();
				event.stopPropagation();
				(event.target as HTMLElement)?.blur();
			};

			// Store the handler so we can remove it later
			extendedAudio._focusHandler = focusHandler;

			// Prevent focus on the audio element and all its children
			audio.addEventListener('focus', focusHandler, true);
			audio.addEventListener('focusin', focusHandler, true);
			
			// Also prevent focus on all child elements
			const allChildren = audio.querySelectorAll('*');
			allChildren.forEach(child => {
				if (child.instanceOf(HTMLElement)) {
					child.addEventListener('focus', focusHandler, true);
					child.addEventListener('focusin', focusHandler, true);
				}
			});

			// Prevent mouse click from causing focus
			const clickHandler = (event: MouseEvent) => {
				// Allow the click to work but prevent focus
				audio.win.setTimeout(() => {
					const target = event.target as HTMLElement;
					if (target && typeof target.blur === 'function') {
						target.blur();
					}
					// Also blur the audio element itself
					if (typeof audio.blur === 'function') {
						audio.blur();
					}
				}, 0);
			};

			extendedAudio._clickHandler = clickHandler;
			audio.addEventListener('click', clickHandler, true);

		} else {
			// Remove focus prevention
			audio.removeAttribute('tabindex');
			
			// Restore normal tabindex for controls
			const controls = audio.querySelectorAll('button, input, [tabindex="-1"]');
			controls.forEach(control => {
				if (control.instanceOf(HTMLElement)) {
					control.removeAttribute('tabindex');
				}
			});

			// Remove event listeners if they exist
			if (extendedAudio._focusHandler) {
				const focusHandler = extendedAudio._focusHandler;
				audio.removeEventListener('focus', focusHandler, true);
				audio.removeEventListener('focusin', focusHandler, true);
				
				const allChildren = audio.querySelectorAll('*');
				allChildren.forEach(child => {
					if (child.instanceOf(HTMLElement)) {
						child.removeEventListener('focus', focusHandler, true);
						child.removeEventListener('focusin', focusHandler, true);
					}
				});

				delete extendedAudio._focusHandler;
			}

			if (extendedAudio._clickHandler) {
				audio.removeEventListener('click', extendedAudio._clickHandler, true);
				delete extendedAudio._clickHandler;
			}
		}
	}

	private applyFocusPreventionToAll() {
		const allAudioElements = this.getAllAudioElements();
		allAudioElements.forEach(audio => {
			this.applyFocusPrevention(audio);
		});
	}
}

class AudioPauseSettingTab extends PluginSettingTab {
	plugin: AudioPausePlugin;

	constructor(app: App, plugin: AudioPausePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Reset to beginning')
			.setDesc('When enabled, other audio clips will be reset to the beginning instead of just pausing.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.resetToBeginning)
				.onChange(async (value) => {
					this.plugin.settings.resetToBeginning = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Prevent keyboard focus')
			.setDesc('When enabled, audio player elements cannot be focused with the Tab key, preventing keyboard navigation interference.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.preventKeyboardFocus)
				.onChange(async (value) => {
					this.plugin.settings.preventKeyboardFocus = value;
					await this.plugin.saveSettings();
				}));
	}
}
