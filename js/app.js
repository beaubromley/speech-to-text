/**
 * Main Application Controller
 * Coordinates between transcribers, UI, and user interactions
 */

class LectureTranscriberApp {
    constructor() {
        this.ui = new UIController();
        this.webSpeechTranscriber = null;
        this.transformersTranscriber = null;
        this.whisperTurboTranscriber = null;
        this.currentMode = 'web-speech';
        this.isRecording = false;

        // Auto-save debounced
        this.autoSave = Utils.debounce((text) => {
            Utils.storage.saveTranscript(text);
        }, 1000);

        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing Speech-to-Text App...');

        // Check browser compatibility
        this.checkCompatibility();

        // Initialize Web Speech transcriber
        if (WebSpeechTranscriber.isSupported()) {
            this.webSpeechTranscriber = new WebSpeechTranscriber();
            this.setupWebSpeechCallbacks();
        }

        // Initialize Transformers.js transcriber
        if (TransformersWhisperTranscriber.isSupported()) {
            this.transformersTranscriber = new TransformersWhisperTranscriber();
            this.setupTransformersCallbacks();
        }

        // Initialize Whisper Turbo transcriber
        if (WhisperTurboTranscriber.isSupported()) {
            this.whisperTurboTranscriber = new WhisperTurboTranscriber();
            this.setupWhisperTurboCallbacks();
        }

        // Update device recommendations
        this.ui.updateDeviceRecommendations();

        // Load saved mode
        const savedMode = Utils.storage.loadMode();
        this.switchMode(savedMode);

        // Restore saved transcript
        this.restoreTranscript();

        // Set up event listeners
        this.setupEventListeners();

        // Show initial status
        this.ui.updateStatus('ready');

        console.log('Initialization complete');
    }

    /**
     * Check browser compatibility and show warnings
     */
    checkCompatibility() {
        const warnings = Utils.compatibility.getWarnings();
        this.ui.showCompatibilityWarnings(warnings);

        // Log compatibility info
        console.log('Browser:', Utils.compatibility.getBrowser());
        console.log('Mobile:', Utils.compatibility.isMobile());
        console.log('Web Speech:', Utils.compatibility.hasWebSpeech());
        console.log('WASM:', Utils.compatibility.hasWasm());
        console.log('Secure Context:', Utils.compatibility.isSecureContext());
    }

    /**
     * Set up Web Speech transcriber callbacks
     */
    setupWebSpeechCallbacks() {
        if (!this.webSpeechTranscriber) return;

        this.webSpeechTranscriber.onTranscriptUpdate = (transcript) => {
            this.ui.updateTranscript(transcript);
            // Auto-save final transcript
            if (transcript.final) {
                this.autoSave(transcript.final);
            }
        };

        this.webSpeechTranscriber.onError = (error) => {
            this.ui.showError(error);
        };

        this.webSpeechTranscriber.onStatusChange = (status) => {
            this.ui.updateStatus(status);
        };
    }

    /**
     * Set up Transformers.js transcriber callbacks
     */
    setupTransformersCallbacks() {
        if (!this.transformersTranscriber) return;

        this.transformersTranscriber.onTranscriptUpdate = (transcript) => {
            this.ui.updateTranscript(transcript);
            // Auto-save final transcript
            if (transcript.final) {
                this.autoSave(transcript.final);
            }
        };

        this.transformersTranscriber.onError = (error) => {
            this.ui.showError(error);
        };

        this.transformersTranscriber.onStatusChange = (status) => {
            this.ui.updateStatus(status);
        };

        this.transformersTranscriber.onProgress = (progress) => {
            this.ui.updateWhisperProgress(progress);
        };

        this.transformersTranscriber.onLoadingChange = (isLoading) => {
            this.ui.showWhisperLoading(isLoading);
        };
    }

    /**
     * Set up Whisper Turbo transcriber callbacks
     */
    setupWhisperTurboCallbacks() {
        if (!this.whisperTurboTranscriber) return;

        this.whisperTurboTranscriber.onTranscriptUpdate = (transcript) => {
            this.ui.updateTranscript(transcript);
            // Auto-save final transcript
            if (transcript.final) {
                this.autoSave(transcript.final);
            }
        };

        this.whisperTurboTranscriber.onError = (error) => {
            this.ui.showError(error);
        };

        this.whisperTurboTranscriber.onStatusChange = (status) => {
            this.ui.updateStatus(status);
        };

        this.whisperTurboTranscriber.onProgress = (progress) => {
            this.ui.updateWhisperProgress(progress);
        };

        this.whisperTurboTranscriber.onLoadingChange = (isLoading) => {
            this.ui.showWhisperLoading(isLoading);
        };
    }

    /**
     * Set up UI event listeners
     */
    setupEventListeners() {
        // Mode selection
        const modeWebSpeechBtn = document.getElementById('mode-web-speech');
        const modeTransformersBtn = document.getElementById('mode-transformers');
        const modeWhisperTurboBtn = document.getElementById('mode-whisper-turbo');

        if (modeWebSpeechBtn) {
            modeWebSpeechBtn.addEventListener('click', () => {
                if (!this.isRecording) {
                    this.switchMode('web-speech');
                }
            });
        }

        if (modeTransformersBtn) {
            modeTransformersBtn.addEventListener('click', () => {
                if (!this.isRecording) {
                    this.switchMode('transformers');
                }
            });
        }

        if (modeWhisperTurboBtn) {
            modeWhisperTurboBtn.addEventListener('click', () => {
                if (!this.isRecording) {
                    this.switchMode('whisper-turbo');
                }
            });
        }

        // Control buttons
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        const clearBtn = document.getElementById('clear-btn');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startRecording());
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopRecording());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearTranscript());
        }

        // Action buttons
        const copyBtn = document.getElementById('copy-btn');
        const exportBtn = document.getElementById('export-btn');

        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyToClipboard());
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportTranscript());
        }

        // Visibility change - re-request wake lock if page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isRecording) {
                Utils.wakeLock.request();
            }
        });
    }

    /**
     * Switch between transcription modes
     * @param {string} mode - Mode to switch to ('web-speech', 'transformers', or 'whisper-turbo')
     */
    switchMode(mode) {
        if (this.isRecording) {
            this.ui.showError('Stop recording before switching modes');
            return;
        }

        this.currentMode = mode;
        this.ui.updateModeSelection(mode);
        Utils.storage.saveMode(mode);

        console.log('Switched to mode:', mode);

        // Show performance warnings
        const isMobile = Utils.compatibility.isMobile();

        if (mode === 'transformers' && isMobile) {
            this.ui.showError('Warning: Transformers mode is slow on mobile. Web Speech is faster for live transcription.');
        } else if (mode === 'whisper-turbo' && isMobile) {
            this.ui.showError('Warning: Whisper Turbo is slow on mobile. Works better on laptop.');
        }
    }

    /**
     * Get current transcriber based on mode
     */
    getCurrentTranscriber() {
        if (this.currentMode === 'web-speech') {
            return this.webSpeechTranscriber;
        } else if (this.currentMode === 'transformers') {
            return this.transformersTranscriber;
        } else if (this.currentMode === 'whisper-turbo') {
            return this.whisperTurboTranscriber;
        }
        return null;
    }

    /**
     * Start recording
     */
    async startRecording() {
        if (this.isRecording) {
            console.log('Already recording');
            return;
        }

        const transcriber = this.getCurrentTranscriber();
        if (!transcriber) {
            this.ui.showError('Transcriber not available for current mode');
            return;
        }

        console.log('Starting recording...');

        // Request wake lock to keep screen on
        await Utils.wakeLock.request();

        // Start transcription
        const success = await transcriber.start();

        if (success) {
            this.isRecording = true;
            this.ui.updateRecordingButtons(true);
            this.ui.updateStatus('recording');
            console.log('Recording started');
        } else {
            this.ui.showError('Failed to start recording. Please check microphone permissions.');
            await Utils.wakeLock.release();
        }
    }

    /**
     * Stop recording
     */
    async stopRecording() {
        if (!this.isRecording) {
            console.log('Not recording');
            return;
        }

        const transcriber = this.getCurrentTranscriber();
        if (transcriber) {
            transcriber.stop();
        }

        this.isRecording = false;
        this.ui.updateRecordingButtons(false);
        this.ui.updateStatus('stopped');

        // Release wake lock
        await Utils.wakeLock.release();

        console.log('Recording stopped');
    }

    /**
     * Clear transcript
     */
    async clearTranscript() {
        if (this.isRecording) {
            this.ui.showError('Stop recording before clearing transcript');
            return;
        }

        // Ask for confirmation
        const confirmed = await this.ui.showConfirmation(
            'Clear Transcript',
            'Are you sure you want to clear the transcript? This cannot be undone.'
        );

        if (!confirmed) {
            return;
        }

        // Clear from transcriber
        const transcriber = this.getCurrentTranscriber();
        if (transcriber && transcriber.clear) {
            transcriber.clear();
        }

        // Clear from storage
        Utils.storage.clearTranscript();

        // Update UI
        this.ui.updateTranscript({ final: '', interim: '' });
        this.ui.showSuccess('Transcript cleared');

        console.log('Transcript cleared');
    }

    /**
     * Copy transcript to clipboard
     */
    async copyToClipboard() {
        const transcriber = this.getCurrentTranscriber();
        if (!transcriber) return;

        const text = transcriber.getTranscript();
        if (!text || text.trim().length === 0) {
            this.ui.showError('No transcript to copy');
            return;
        }

        const success = await Utils.copyToClipboard(text);
        if (success) {
            this.ui.showSuccess('Copied to clipboard!');
        } else {
            this.ui.showError('Failed to copy to clipboard');
        }
    }

    /**
     * Export transcript as text file
     */
    exportTranscript() {
        const transcriber = this.getCurrentTranscriber();
        if (!transcriber) return;

        const text = transcriber.getTranscript();
        if (!text || text.trim().length === 0) {
            this.ui.showError('No transcript to export');
            return;
        }

        const success = Utils.exportAsTextFile(text, 'lecture-transcript.txt');
        if (success) {
            this.ui.showSuccess('Transcript exported!');
        } else {
            this.ui.showError('Failed to export transcript');
        }
    }

    /**
     * Restore transcript from storage
     */
    restoreTranscript() {
        const savedTranscript = Utils.storage.loadTranscript();
        if (savedTranscript && savedTranscript.trim().length > 0) {
            console.log('Restoring saved transcript...');

            const transcriber = this.getCurrentTranscriber();
            if (transcriber && transcriber.setTranscript) {
                transcriber.setTranscript(savedTranscript);
            }

            this.ui.updateTranscript({ final: savedTranscript, interim: '' });
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new LectureTranscriberApp();
    });
} else {
    window.app = new LectureTranscriberApp();
}
