/**
 * Main Application Controller
 * Coordinates between transcribers, UI, and user interactions
 */

class LectureTranscriberApp {
    constructor() {
        this.ui = new UIController();
        this.webSpeechTranscriber = null;
        this.isRecording = false;
        this.geminiAPI = new GeminiAPI();
        this.currentSummary = '';
        this.vuMeter = new VUMeter('vu-meter');
        this.wordCloud = new WordCloud('word-cloud-container');
        this.recordingStartTime = null;

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

        // Restore saved transcript and summary
        this.restoreTranscript();
        this.restoreSummary();

        // Restore auto-summary preference
        this.initAutoSummaryToggle();

        // Initialize theme toggle
        this.initThemeToggle();

        // Set up event listeners
        this.setupEventListeners();

        // Set up transcript edit listener
        this.ui.onTranscriptEdit((newText) => this.handleTranscriptEdit(newText));

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
                // Update word cloud if visible
                const wcSection = document.getElementById('word-cloud-section');
                if (wcSection && !wcSection.classList.contains('hidden')) {
                    this.wordCloud.update(transcript.final);
                }
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
     * Set up UI event listeners
     */
    setupEventListeners() {
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

        // Word cloud toggles
        const showWordcloudBtn = document.getElementById('show-wordcloud-btn');
        const toggleWordcloudBtn = document.getElementById('toggle-wordcloud-btn');
        if (showWordcloudBtn) {
            showWordcloudBtn.addEventListener('click', () => this.toggleWordCloud());
        }
        if (toggleWordcloudBtn) {
            toggleWordcloudBtn.addEventListener('click', () => this.toggleWordCloud());
        }

        // Share button
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.shareTranscript());
        }

        // Mark timestamp button
        const markBtn = document.getElementById('mark-btn');
        if (markBtn) {
            markBtn.addEventListener('click', () => this.insertTimestamp());
        }

        // AI Summary buttons
        const generateSummaryBtn = document.getElementById('generate-summary-btn');
        const editPromptBtn = document.getElementById('edit-prompt-btn');
        const copySummaryBtn = document.getElementById('copy-summary-btn');
        const exportSummaryBtn = document.getElementById('export-summary-btn');
        const resetPromptBtn = document.getElementById('reset-prompt-btn');
        const savePromptBtn = document.getElementById('save-prompt-btn');

        if (generateSummaryBtn) {
            generateSummaryBtn.addEventListener('click', () => this.generateSummary());
        }

        if (editPromptBtn) {
            editPromptBtn.addEventListener('click', () => this.showPromptEditor());
        }

        if (copySummaryBtn) {
            copySummaryBtn.addEventListener('click', () => this.copySummaryToClipboard());
        }

        if (exportSummaryBtn) {
            exportSummaryBtn.addEventListener('click', () => this.exportSummary());
        }

        if (resetPromptBtn) {
            resetPromptBtn.addEventListener('click', () => this.resetPrompt());
        }

        if (savePromptBtn) {
            savePromptBtn.addEventListener('click', () => this.savePromptAndGenerate());
        }

        // Follow-up question
        const followupSendBtn = document.getElementById('followup-send-btn');
        const followupInput = document.getElementById('followup-input');
        if (followupSendBtn) {
            followupSendBtn.addEventListener('click', () => this.sendFollowUp());
        }
        if (followupInput) {
            followupInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.sendFollowUp();
            });
        }

        // Visibility change - re-request wake lock if page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isRecording) {
                Utils.wakeLock.request();
            }
        });
    }

    /**
     * Get current transcriber
     */
    getCurrentTranscriber() {
        return this.webSpeechTranscriber;
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
            // Spin cassette reels
            const reels = document.getElementById('cassette-reels');
            if (reels) reels.classList.add('recording');
            // Start VU meter
            this.vuMeter.start();
            // Track recording start time and show mark button
            this.recordingStartTime = Date.now();
            const markBtn = document.getElementById('mark-btn');
            if (markBtn) markBtn.classList.remove('hidden');
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
        // Stop cassette reels, VU meter, and hide mark button
        const reels = document.getElementById('cassette-reels');
        if (reels) reels.classList.remove('recording');
        this.vuMeter.stop();
        const markBtn = document.getElementById('mark-btn');
        if (markBtn) markBtn.classList.add('hidden');
        this.recordingStartTime = null;

        // Release wake lock
        await Utils.wakeLock.release();

        console.log('Recording stopped');

        // Auto-summarize if enabled
        const autoSummaryCheckbox = document.getElementById('auto-summary-checkbox');
        if (autoSummaryCheckbox && autoSummaryCheckbox.checked) {
            this.generateSummary();
        }
    }

    /**
     * Insert a timestamp marker into the transcript
     */
    insertTimestamp() {
        if (!this.isRecording || !this.recordingStartTime) return;

        const elapsed = Date.now() - this.recordingStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const timestamp = `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}]`;

        const transcriber = this.getCurrentTranscriber();
        if (transcriber && transcriber.finalTranscript !== undefined) {
            if (transcriber.finalTranscript.length > 0 && !transcriber.finalTranscript.endsWith(' ')) {
                transcriber.finalTranscript += ' ';
            }
            transcriber.finalTranscript += timestamp + ' ';
            this.ui.updateTranscript({ final: transcriber.finalTranscript, interim: transcriber.interimTranscript || '' });
            this.autoSave(transcriber.finalTranscript);
        }

        this.ui.showSuccess(`Marked at ${timestamp}`);
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
            'Clear All',
            'Are you sure you want to clear the transcript, summary, and reset the prompt? This cannot be undone.'
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
        Utils.storage.clearSummary();

        // Update UI
        this.ui.updateTranscript({ final: '', interim: '' });

        // Clear AI summary
        this.currentSummary = '';
        if (this.ui.elements.summaryContainer) {
            this.ui.elements.summaryContainer.classList.add('hidden');
        }
        this.ui.updateSummaryActionButtons(false);

        // Reset prompt to default
        this.geminiAPI.resetPrompt();

        // Clear follow-up thread
        this.hideFollowUpSection();

        this.ui.showSuccess('All cleared and reset');

        console.log('Transcript, summary, and prompt cleared');
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
     * Share transcript using Web Share API or clipboard fallback
     */
    async shareTranscript() {
        const transcriber = this.getCurrentTranscriber();
        if (!transcriber) return;

        const text = transcriber.getTranscript();
        if (!text || text.trim().length === 0) {
            this.ui.showError('No transcript to share');
            return;
        }

        // Build share content
        let shareText = text;
        if (this.currentSummary) {
            shareText = `--- SUMMARY ---\n${this.currentSummary}\n\n--- TRANSCRIPT ---\n${text}`;
        }

        // Try Web Share API (mobile-friendly)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Speech-to-Text Transcript',
                    text: shareText
                });
                this.ui.showSuccess('Shared!');
                return;
            } catch (error) {
                if (error.name === 'AbortError') return; // User cancelled
                console.error('Share failed:', error);
            }
        }

        // Fallback: copy to clipboard
        const success = await Utils.copyToClipboard(shareText);
        if (success) {
            this.ui.showSuccess('Copied to clipboard for sharing!');
        } else {
            this.ui.showError('Failed to share');
        }
    }

    /**
     * Toggle word cloud visibility and update it
     */
    toggleWordCloud() {
        const section = document.getElementById('word-cloud-section');
        if (!section) return;

        const isHidden = section.classList.toggle('hidden');
        if (!isHidden) {
            const transcriber = this.getCurrentTranscriber();
            const text = transcriber ? transcriber.getTranscript() : '';
            this.wordCloud.update(text);
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

    /**
     * Initialize auto-summary toggle from saved preference
     */
    initAutoSummaryToggle() {
        const checkbox = document.getElementById('auto-summary-checkbox');
        if (!checkbox) return;

        checkbox.checked = Utils.storage.loadAutoSummary();
        checkbox.addEventListener('change', () => {
            Utils.storage.saveAutoSummary(checkbox.checked);
        });
    }

    /**
     * Restore summary from storage
     */
    restoreSummary() {
        const savedSummary = Utils.storage.loadSummary();
        if (savedSummary && savedSummary.trim().length > 0) {
            console.log('Restoring saved summary...');
            this.currentSummary = savedSummary;
            this.ui.updateSummary(savedSummary);
            this.ui.updateSummaryActionButtons(true);
            this.showFollowUpSection();
        }
    }

    /**
     * Show the follow-up questions section
     */
    showFollowUpSection() {
        const section = document.getElementById('followup-section');
        if (section) section.classList.remove('hidden');
    }

    /**
     * Hide the follow-up questions section
     */
    hideFollowUpSection() {
        const section = document.getElementById('followup-section');
        if (section) section.classList.add('hidden');
        const thread = document.getElementById('followup-thread');
        if (thread) thread.innerHTML = '';
    }

    /**
     * Send a follow-up question
     */
    async sendFollowUp() {
        const input = document.getElementById('followup-input');
        const thread = document.getElementById('followup-thread');
        if (!input || !thread) return;

        const question = input.value.trim();
        if (!question) return;

        const transcriber = this.getCurrentTranscriber();
        const transcript = transcriber ? transcriber.getTranscript() : '';

        if (!this.currentSummary) {
            this.ui.showError('Generate a summary first');
            return;
        }

        // Show user message
        const userMsg = document.createElement('div');
        userMsg.className = 'followup-msg user';
        userMsg.textContent = question;
        thread.appendChild(userMsg);
        input.value = '';

        // Show loading
        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'followup-msg ai';
        loadingMsg.textContent = 'Thinking...';
        thread.appendChild(loadingMsg);
        thread.scrollTop = thread.scrollHeight;

        try {
            const response = await this.geminiAPI.askFollowUp(transcript, this.currentSummary, question);
            if (typeof marked !== 'undefined') {
                loadingMsg.innerHTML = marked.parse(response);
            } else {
                loadingMsg.textContent = response;
            }
        } catch (error) {
            loadingMsg.textContent = `Error: ${error.message}`;
            loadingMsg.style.color = '#ff5548';
        }

        thread.scrollTop = thread.scrollHeight;
    }

    /**
     * Generate AI summary from transcript
     */
    async generateSummary() {
        if (!this.geminiAPI.isConfigured()) {
            this.ui.showError('Gemini API key not configured. Please check js/config.js');
            return;
        }

        const transcriber = this.getCurrentTranscriber();
        if (!transcriber) return;

        const transcript = transcriber.getTranscript();
        if (!transcript || transcript.trim().length === 0) {
            this.ui.showError('No transcript available to summarize');
            return;
        }

        // Validate transcript
        const validation = this.geminiAPI.validateTranscript(transcript);
        if (!validation.valid) {
            this.ui.showError(validation.message);
            return;
        }

        console.log('Generating AI summary...');
        this.ui.showSummaryLoading(true);

        try {
            const summary = await this.geminiAPI.generateSummary(transcript);
            this.currentSummary = summary;
            Utils.storage.saveSummary(summary);
            this.ui.updateSummary(summary);
            this.ui.updateSummaryActionButtons(true);
            this.ui.showSuccess('Summary generated successfully!');
            this.showFollowUpSection();
            console.log('Summary generated');
        } catch (error) {
            console.error('Summary generation failed:', error);
            this.ui.showSummaryLoading(false);
            this.ui.showError(`Failed to generate summary: ${error.message}`);
        }
    }

    /**
     * Show prompt editor modal
     */
    showPromptEditor() {
        const currentPrompt = this.geminiAPI.getCurrentPrompt();
        this.ui.showPromptModal(currentPrompt);
    }

    /**
     * Reset prompt to default
     */
    resetPrompt() {
        this.geminiAPI.resetPrompt();
        const defaultPrompt = this.geminiAPI.getDefaultPrompt();
        this.ui.showPromptModal(defaultPrompt);
        this.ui.showSuccess('Prompt reset to default');
    }

    /**
     * Save edited prompt and generate summary
     */
    async savePromptAndGenerate() {
        const editedPrompt = this.ui.getEditedPrompt();

        if (!editedPrompt || editedPrompt.trim().length === 0) {
            this.ui.showError('Prompt cannot be empty');
            return;
        }

        if (!editedPrompt.includes('{TRANSCRIPT}')) {
            this.ui.showError('Prompt must include {TRANSCRIPT} placeholder');
            return;
        }

        try {
            this.geminiAPI.setCustomPrompt(editedPrompt);
            this.ui.hidePromptModal();
            this.ui.showSuccess('Prompt saved!');

            // Generate summary with new prompt
            await this.generateSummary();
        } catch (error) {
            this.ui.showError(error.message);
        }
    }

    /**
     * Copy summary to clipboard
     */
    async copySummaryToClipboard() {
        if (!this.currentSummary || this.currentSummary.trim().length === 0) {
            this.ui.showError('No summary to copy');
            return;
        }

        const success = await Utils.copyToClipboard(this.currentSummary);
        if (success) {
            this.ui.showSuccess('Summary copied to clipboard!');
        } else {
            this.ui.showError('Failed to copy summary');
        }
    }

    /**
     * Export summary as text file
     */
    exportSummary() {
        if (!this.currentSummary || this.currentSummary.trim().length === 0) {
            this.ui.showError('No summary to export');
            return;
        }

        const success = Utils.exportAsTextFile(this.currentSummary, 'transcript-summary.txt');
        if (success) {
            this.ui.showSuccess('Summary exported!');
        } else {
            this.ui.showError('Failed to export summary');
        }
    }

    /**
     * Initialize theme toggle from saved preference
     */
    initThemeToggle() {
        const savedTheme = Utils.storage.loadTheme();
        this.applyTheme(savedTheme);

        const toggleBtn = document.getElementById('theme-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleTheme());
        }
    }

    /**
     * Toggle between talkboy and pro themes
     */
    toggleTheme() {
        const current = document.body.getAttribute('data-theme');
        const newTheme = current === 'pro' ? 'talkboy' : 'pro';
        this.applyTheme(newTheme);
        Utils.storage.saveTheme(newTheme);
    }

    /**
     * Apply a theme to the page
     * @param {string} theme - 'talkboy' or 'pro'
     */
    applyTheme(theme) {
        if (theme === 'pro') {
            document.body.setAttribute('data-theme', 'pro');
        } else {
            document.body.removeAttribute('data-theme');
        }

        // Update meta theme-color for mobile browser chrome
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === 'pro' ? '#ffffff' : '#a8acb0');
        }
    }

    /**
     * Handle transcript editing
     * @param {string} newText - Edited transcript text
     */
    handleTranscriptEdit(newText) {
        const transcriber = this.getCurrentTranscriber();
        if (!transcriber) return;

        // Update the transcriber's internal state directly without triggering UI update
        // This prevents the feedback loop that causes duplication issues
        if (transcriber.finalTranscript !== undefined) {
            transcriber.finalTranscript = newText;
        }

        // Save to storage
        this.autoSave(newText);

        // Update word count
        this.ui.updateWordCount(newText);

        console.log('Transcript edited and saved');
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
