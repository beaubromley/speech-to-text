/**
 * UI Controller
 * Manages all UI state and updates
 */

class UIController {
    constructor() {
        // Get DOM elements
        this.elements = {
            // Mode selector
            modeWebSpeech: document.getElementById('mode-web-speech'),
            modeTransformers: document.getElementById('mode-transformers'),
            modeWhisperTurbo: document.getElementById('mode-whisper-turbo'),
            modeDescription: document.getElementById('mode-desc-text'),
            modePerformance: document.getElementById('mode-performance'),

            // Mode recommendations
            recWebSpeech: document.getElementById('rec-web-speech'),
            recTransformers: document.getElementById('rec-transformers'),
            recWhisperTurbo: document.getElementById('rec-whisper-turbo'),

            // Status
            statusDot: document.getElementById('status-dot'),
            statusText: document.getElementById('status-text'),

            // Controls
            startBtn: document.getElementById('start-btn'),
            stopBtn: document.getElementById('stop-btn'),
            clearBtn: document.getElementById('clear-btn'),

            // Transcript
            transcriptContainer: document.getElementById('transcript-container'),
            transcriptText: document.getElementById('transcript-text'),
            wordCount: document.getElementById('word-count'),
            togglePreviewBtn: document.getElementById('toggle-preview-btn'),

            // Actions
            copyBtn: document.getElementById('copy-btn'),
            exportBtn: document.getElementById('export-btn'),

            // Modals
            helpBtn: document.getElementById('help-btn'),
            helpModal: document.getElementById('help-modal'),
            closeModal: document.getElementById('close-modal'),
            confirmModal: document.getElementById('confirm-modal'),
            confirmTitle: document.getElementById('confirm-title'),
            confirmMessage: document.getElementById('confirm-message'),
            confirmYes: document.getElementById('confirm-yes'),
            confirmNo: document.getElementById('confirm-no'),

            // Warnings
            compatibilityWarning: document.getElementById('compatibility-warning'),
            compatibilityMessage: document.getElementById('compatibility-message'),

            // Whisper specific
            whisperLoading: document.getElementById('whisper-loading'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),

            // AI Summary
            generateSummaryBtn: document.getElementById('generate-summary-btn'),
            editPromptBtn: document.getElementById('edit-prompt-btn'),
            summaryContainer: document.getElementById('summary-container'),
            summaryText: document.getElementById('summary-text'),
            copySummaryBtn: document.getElementById('copy-summary-btn'),
            exportSummaryBtn: document.getElementById('export-summary-btn'),
            summaryLoading: document.getElementById('summary-loading'),

            // Prompt Modal
            promptModal: document.getElementById('prompt-modal'),
            closePromptModal: document.getElementById('close-prompt-modal'),
            promptTextarea: document.getElementById('prompt-textarea'),
            resetPromptBtn: document.getElementById('reset-prompt-btn'),
            savePromptBtn: document.getElementById('save-prompt-btn')
        };

        this.setupEventListeners();
        this.currentMode = 'web-speech';
        this.isPreviewMode = false;
        this.fullTranscript = { final: '', interim: '' };
    }

    /**
     * Set up event listeners for UI elements
     */
    setupEventListeners() {
        // Help modal
        if (this.elements.helpBtn) {
            this.elements.helpBtn.addEventListener('click', () => this.showHelp());
        }
        if (this.elements.closeModal) {
            this.elements.closeModal.addEventListener('click', () => this.hideHelp());
        }
        if (this.elements.helpModal) {
            this.elements.helpModal.addEventListener('click', (e) => {
                if (e.target === this.elements.helpModal) {
                    this.hideHelp();
                }
            });
        }

        // Preview toggle
        if (this.elements.togglePreviewBtn) {
            this.elements.togglePreviewBtn.addEventListener('click', () => this.togglePreview());
        }

        // Prompt modal
        if (this.elements.closePromptModal) {
            this.elements.closePromptModal.addEventListener('click', () => this.hidePromptModal());
        }
        if (this.elements.promptModal) {
            this.elements.promptModal.addEventListener('click', (e) => {
                if (e.target === this.elements.promptModal) {
                    this.hidePromptModal();
                }
            });
        }
    }

    /**
     * Update status indicator
     * @param {string} status - Status ('ready', 'recording', 'processing', 'stopped')
     */
    updateStatus(status) {
        const statusMap = {
            ready: { text: 'Ready', dotClass: 'ready' },
            recording: { text: 'Recording...', dotClass: 'recording' },
            processing: { text: 'Processing...', dotClass: 'recording' },
            stopped: { text: 'Stopped', dotClass: '' }
        };

        const statusInfo = statusMap[status] || statusMap.ready;

        if (this.elements.statusText) {
            this.elements.statusText.textContent = statusInfo.text;
        }

        if (this.elements.statusDot) {
            this.elements.statusDot.className = 'status-dot';
            if (statusInfo.dotClass) {
                this.elements.statusDot.classList.add(statusInfo.dotClass);
            }
        }
    }

    /**
     * Update recording button states
     * @param {boolean} isRecording - Whether currently recording
     */
    updateRecordingButtons(isRecording) {
        if (this.elements.startBtn) {
            if (isRecording) {
                this.elements.startBtn.classList.add('recording', 'hidden');
                this.elements.startBtn.textContent = 'RECORDING';
            } else {
                this.elements.startBtn.classList.remove('recording', 'hidden');
                this.elements.startBtn.textContent = 'START';
            }
        }

        if (this.elements.stopBtn) {
            if (isRecording) {
                this.elements.stopBtn.classList.remove('hidden');
            } else {
                this.elements.stopBtn.classList.add('hidden');
            }
        }

        if (this.elements.clearBtn) {
            this.elements.clearBtn.disabled = isRecording;
        }
    }

    /**
     * Update transcript display
     * @param {Object} transcript - Object with 'final' and 'interim' text
     */
    updateTranscript(transcript) {
        if (!this.elements.transcriptText) return;

        const finalText = transcript.final || '';
        const interimText = transcript.interim || '';

        // Store full transcript
        this.fullTranscript = { final: finalText, interim: interimText };

        // Update word count
        this.updateWordCount(finalText);

        // Check if empty
        if (finalText.length === 0 && interimText.length === 0) {
            this.elements.transcriptText.innerHTML = 'Your transcription will appear here...';
            this.elements.transcriptText.classList.add('empty');
            return;
        }

        this.elements.transcriptText.classList.remove('empty');

        // Get text to display based on preview mode
        let displayFinalText = finalText;
        if (this.isPreviewMode && finalText) {
            displayFinalText = this.getLastWords(finalText, 20);
        }

        // Build HTML with final text and interim text
        let html = '';
        if (displayFinalText) {
            if (this.isPreviewMode && finalText.split(/\s+/).filter(w => w.length > 0).length > 20) {
                html += `<span class="preview-ellipsis">... </span>`;
            }
            html += `<span>${this.escapeHtml(displayFinalText)}</span>`;
        }
        if (interimText) {
            if (displayFinalText && !displayFinalText.endsWith(' ')) {
                html += ' ';
            }
            html += `<span class="interim-text">${this.escapeHtml(interimText)}</span>`;
        }

        this.elements.transcriptText.innerHTML = html;

        // Auto-scroll to bottom
        Utils.scrollToBottom(this.elements.transcriptContainer);

        // Update action button states
        this.updateActionButtons(finalText.length > 0);
    }

    /**
     * Update action button states
     * @param {boolean} hasText - Whether there is text to copy/export
     */
    updateActionButtons(hasText) {
        if (this.elements.copyBtn) {
            this.elements.copyBtn.disabled = !hasText;
        }
        if (this.elements.exportBtn) {
            this.elements.exportBtn.disabled = !hasText;
        }
    }

    /**
     * Show help modal
     */
    showHelp() {
        if (this.elements.helpModal) {
            this.elements.helpModal.classList.remove('hidden');
        }
    }

    /**
     * Hide help modal
     */
    hideHelp() {
        if (this.elements.helpModal) {
            this.elements.helpModal.classList.add('hidden');
        }
    }

    /**
     * Show confirmation modal
     * @param {string} title - Modal title
     * @param {string} message - Modal message
     * @returns {Promise<boolean>} - User's response
     */
    showConfirmation(title, message) {
        return new Promise((resolve) => {
            if (!this.elements.confirmModal) {
                resolve(false);
                return;
            }

            // Set content
            if (this.elements.confirmTitle) {
                this.elements.confirmTitle.textContent = title;
            }
            if (this.elements.confirmMessage) {
                this.elements.confirmMessage.textContent = message;
            }

            // Show modal
            this.elements.confirmModal.classList.remove('hidden');

            // Handle responses
            const handleYes = () => {
                cleanup();
                resolve(true);
            };

            const handleNo = () => {
                cleanup();
                resolve(false);
            };

            const cleanup = () => {
                this.elements.confirmModal.classList.add('hidden');
                this.elements.confirmYes.removeEventListener('click', handleYes);
                this.elements.confirmNo.removeEventListener('click', handleNo);
            };

            this.elements.confirmYes.addEventListener('click', handleYes);
            this.elements.confirmNo.addEventListener('click', handleNo);
        });
    }

    /**
     * Show compatibility warnings
     * @param {Array<string>} warnings - Array of warning messages
     */
    showCompatibilityWarnings(warnings) {
        if (!this.elements.compatibilityWarning || !this.elements.compatibilityMessage) {
            return;
        }

        if (warnings.length === 0) {
            this.elements.compatibilityWarning.classList.add('hidden');
            return;
        }

        // Join warnings with line breaks
        this.elements.compatibilityMessage.innerHTML = warnings.join('<br>');
        this.elements.compatibilityWarning.classList.remove('hidden');
    }

    /**
     * Update mode selection
     * @param {string} mode - Selected mode ('web-speech', 'transformers', or 'whisper-turbo')
     */
    updateModeSelection(mode) {
        this.currentMode = mode;

        // Update button states
        const modes = {
            'web-speech': this.elements.modeWebSpeech,
            'transformers': this.elements.modeTransformers,
            'whisper-turbo': this.elements.modeWhisperTurbo
        };

        Object.keys(modes).forEach(key => {
            const element = modes[key];
            if (element) {
                if (key === mode) {
                    element.classList.add('active');
                } else {
                    element.classList.remove('active');
                }
            }
        });

        // Update description
        this.updateModeDescription(mode);
    }

    /**
     * Update mode description
     * @param {string} mode - Selected mode
     */
    updateModeDescription(mode) {
        if (!this.elements.modeDescription) return;

        const isMobile = Utils.compatibility.isMobile();

        const descriptions = {
            'web-speech': {
                text: 'Browser speech recognition. Needs internet. Best for real-time transcription.',
                performance: 'Real-time (under 1 second delay)'
            },
            'transformers': {
                text: 'Offline mode with 40MB model download. Better accuracy than Web Speech.',
                performance: isMobile ? 'Slow on mobile (30-50 sec per 10 sec audio)' : 'Decent on laptop (8-15 sec per 10 sec audio)'
            },
            'whisper-turbo': {
                text: 'Offline mode with 40MB model download. Faster than Transformers.',
                performance: isMobile ? 'Still slow on mobile (15-30 sec per 10 sec audio)' : 'Fast on laptop (3-8 sec per 10 sec audio)'
            }
        };

        const modeInfo = descriptions[mode] || descriptions['web-speech'];
        this.elements.modeDescription.textContent = modeInfo.text;

        if (this.elements.modePerformance) {
            this.elements.modePerformance.textContent = modeInfo.performance;
        }
    }

    /**
     * Update device recommendations for each mode
     */
    updateDeviceRecommendations() {
        // Removed icon recommendations - keeping method for compatibility
    }

    /**
     * Show/hide Whisper loading indicator
     * @param {boolean} show - Whether to show the loading indicator
     */
    showWhisperLoading(show) {
        if (this.elements.whisperLoading) {
            if (show) {
                this.elements.whisperLoading.classList.remove('hidden');
            } else {
                this.elements.whisperLoading.classList.add('hidden');
            }
        }
    }

    /**
     * Update Whisper loading progress
     * @param {number} progress - Progress percentage (0-100)
     */
    updateWhisperProgress(progress) {
        const percentage = Math.min(100, Math.max(0, progress));

        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${percentage}%`;
        }

        if (this.elements.progressText) {
            this.elements.progressText.textContent = `${Math.round(percentage)}%`;
        }
    }

    /**
     * Enable/disable all controls
     * @param {boolean} enabled - Whether controls should be enabled
     */
    setControlsEnabled(enabled) {
        const controls = [
            this.elements.startBtn,
            this.elements.stopBtn,
            this.elements.clearBtn,
            this.elements.modeWebSpeech,
            this.elements.modeWhisper
        ];

        controls.forEach(control => {
            if (control) {
                control.disabled = !enabled;
            }
        });
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        Utils.toast.show(message, 'error', 5000);
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        Utils.toast.show(message, 'success', 3000);
    }

    /**
     * Update word count display
     * @param {string} text - Text to count words from
     */
    updateWordCount(text) {
        if (!this.elements.wordCount) return;

        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        const count = words.length;

        this.elements.wordCount.textContent = `${count} word${count !== 1 ? 's' : ''}`;
    }

    /**
     * Get last N words from text
     * @param {string} text - Full text
     * @param {number} n - Number of words to get
     * @returns {string} - Last N words
     */
    getLastWords(text, n) {
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        if (words.length <= n) {
            return text;
        }
        return words.slice(-n).join(' ');
    }

    /**
     * Toggle between preview and full text mode
     */
    togglePreview() {
        this.isPreviewMode = !this.isPreviewMode;

        // Update button appearance
        if (this.elements.togglePreviewBtn) {
            if (this.isPreviewMode) {
                this.elements.togglePreviewBtn.classList.add('active');
                this.elements.togglePreviewBtn.textContent = 'Full Text';
            } else {
                this.elements.togglePreviewBtn.classList.remove('active');
                this.elements.togglePreviewBtn.textContent = 'Preview';
            }
        }

        // Re-render transcript with new mode
        this.updateTranscript(this.fullTranscript);
    }

    /**
     * Show summary loading state
     * @param {boolean} show - Whether to show loading
     */
    showSummaryLoading(show) {
        if (this.elements.summaryLoading) {
            if (show) {
                this.elements.summaryLoading.classList.remove('hidden');
                this.elements.summaryContainer.classList.add('hidden');
            } else {
                this.elements.summaryLoading.classList.add('hidden');
            }
        }

        // Disable buttons while loading
        if (this.elements.generateSummaryBtn) {
            this.elements.generateSummaryBtn.disabled = show;
        }
        if (this.elements.editPromptBtn) {
            this.elements.editPromptBtn.disabled = show;
        }
    }

    /**
     * Update summary display
     * @param {string} summary - Generated summary text
     */
    updateSummary(summary) {
        if (!this.elements.summaryText || !this.elements.summaryContainer) return;

        this.elements.summaryText.textContent = summary;
        this.elements.summaryContainer.classList.remove('hidden');
        this.showSummaryLoading(false);
    }

    /**
     * Show prompt edit modal
     * @param {string} currentPrompt - Current prompt text
     */
    showPromptModal(currentPrompt) {
        if (!this.elements.promptModal || !this.elements.promptTextarea) return;

        this.elements.promptTextarea.value = currentPrompt;
        this.elements.promptModal.classList.remove('hidden');
    }

    /**
     * Hide prompt edit modal
     */
    hidePromptModal() {
        if (this.elements.promptModal) {
            this.elements.promptModal.classList.add('hidden');
        }
    }

    /**
     * Get edited prompt from modal
     * @returns {string} - Edited prompt text
     */
    getEditedPrompt() {
        return this.elements.promptTextarea?.value || '';
    }

    /**
     * Update summary action button states
     * @param {boolean} hasSummary - Whether there is a summary to copy/export
     */
    updateSummaryActionButtons(hasSummary) {
        if (this.elements.copySummaryBtn) {
            this.elements.copySummaryBtn.disabled = !hasSummary;
        }
        if (this.elements.exportSummaryBtn) {
            this.elements.exportSummaryBtn.disabled = !hasSummary;
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.UIController = UIController;
}
