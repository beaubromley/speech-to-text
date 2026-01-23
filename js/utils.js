/**
 * Utility Functions
 * Helper functions for clipboard, export, wake lock, storage, and notifications
 */

const Utils = {
    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} - Success status
     */
    async copyToClipboard(text) {
        if (!text || text.trim().length === 0) {
            return false;
        }

        try {
            // Modern Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }

            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-999999px';
            textarea.style.top = '-999999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                return successful;
            } catch (err) {
                document.body.removeChild(textarea);
                return false;
            }
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            return false;
        }
    },

    /**
     * Export text as a file
     * @param {string} text - Text to export
     * @param {string} filename - Name of the file
     */
    exportAsTextFile(text, filename = 'transcript.txt') {
        if (!text || text.trim().length === 0) {
            return false;
        }

        try {
            // Add timestamp to filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const timestampedFilename = filename.replace('.txt', `_${timestamp}.txt`);

            // Create blob and download
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = timestampedFilename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            return true;
        } catch (error) {
            console.error('Error exporting file:', error);
            return false;
        }
    },

    /**
     * Wake Lock Management
     */
    wakeLock: {
        wakeLockObject: null,

        /**
         * Request wake lock to keep screen on
         */
        async request() {
            if (!('wakeLock' in navigator)) {
                console.log('Wake Lock API not supported');
                return false;
            }

            try {
                this.wakeLockObject = await navigator.wakeLock.request('screen');
                console.log('Wake Lock activated');

                // Re-request wake lock if screen is unlocked
                this.wakeLockObject.addEventListener('release', () => {
                    console.log('Wake Lock released');
                });

                return true;
            } catch (error) {
                console.error('Error requesting wake lock:', error);
                return false;
            }
        },

        /**
         * Release wake lock
         */
        async release() {
            if (this.wakeLockObject) {
                try {
                    await this.wakeLockObject.release();
                    this.wakeLockObject = null;
                    console.log('Wake Lock released manually');
                    return true;
                } catch (error) {
                    console.error('Error releasing wake lock:', error);
                    return false;
                }
            }
            return false;
        },

        /**
         * Check if wake lock is active
         */
        isActive() {
            return this.wakeLockObject !== null && !this.wakeLockObject.released;
        }
    },

    /**
     * LocalStorage Management
     */
    storage: {
        TRANSCRIPT_KEY: 'speech-to-text-transcript',
        MODE_KEY: 'speech-to-text-mode',

        /**
         * Save transcript to localStorage
         * @param {string} text - Transcript text
         */
        saveTranscript(text) {
            try {
                localStorage.setItem(this.TRANSCRIPT_KEY, text);
                return true;
            } catch (error) {
                console.error('Error saving to localStorage:', error);
                return false;
            }
        },

        /**
         * Load transcript from localStorage
         * @returns {string} - Saved transcript or empty string
         */
        loadTranscript() {
            try {
                return localStorage.getItem(this.TRANSCRIPT_KEY) || '';
            } catch (error) {
                console.error('Error loading from localStorage:', error);
                return '';
            }
        },

        /**
         * Clear transcript from localStorage
         */
        clearTranscript() {
            try {
                localStorage.removeItem(this.TRANSCRIPT_KEY);
                return true;
            } catch (error) {
                console.error('Error clearing localStorage:', error);
                return false;
            }
        },

        /**
         * Save mode selection
         * @param {string} mode - Selected mode ('web-speech' or 'whisper')
         */
        saveMode(mode) {
            try {
                localStorage.setItem(this.MODE_KEY, mode);
                return true;
            } catch (error) {
                console.error('Error saving mode:', error);
                return false;
            }
        },

        /**
         * Load saved mode
         * @returns {string} - Saved mode or 'web-speech' as default
         */
        loadMode() {
            try {
                return localStorage.getItem(this.MODE_KEY) || 'web-speech';
            } catch (error) {
                console.error('Error loading mode:', error);
                return 'web-speech';
            }
        }
    },

    /**
     * Toast Notification Management
     */
    toast: {
        /**
         * Show a toast notification
         * @param {string} message - Message to display
         * @param {string} type - Type of toast ('success', 'error', or default)
         * @param {number} duration - Duration in ms (default 3000)
         */
        show(message, type = '', duration = 3000) {
            const toast = document.getElementById('toast');
            const toastMessage = document.getElementById('toast-message');

            if (!toast || !toastMessage) {
                console.error('Toast elements not found');
                return;
            }

            // Set message
            toastMessage.textContent = message;

            // Set type class
            toast.className = 'toast';
            if (type === 'success' || type === 'error') {
                toast.classList.add(type);
            }

            // Show toast
            toast.classList.remove('hidden');

            // Hide after duration
            setTimeout(() => {
                toast.classList.add('hidden');
            }, duration);
        }
    },

    /**
     * Browser Compatibility Checks
     */
    compatibility: {
        /**
         * Check if running on HTTPS
         */
        isSecureContext() {
            return window.isSecureContext;
        },

        /**
         * Check if Web Speech API is supported
         */
        hasWebSpeech() {
            return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        },

        /**
         * Check if WebAssembly is supported
         */
        hasWasm() {
            return typeof WebAssembly !== 'undefined';
        },

        /**
         * Check if running on mobile device
         */
        isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        },

        /**
         * Get browser name
         */
        getBrowser() {
            const ua = navigator.userAgent;
            if (ua.indexOf('Firefox') > -1) return 'Firefox';
            if (ua.indexOf('Chrome') > -1) return 'Chrome';
            if (ua.indexOf('Safari') > -1) return 'Safari';
            if (ua.indexOf('Edge') > -1) return 'Edge';
            return 'Unknown';
        },

        /**
         * Check if browser is recommended
         */
        isRecommendedBrowser() {
            const browser = this.getBrowser();
            return browser === 'Chrome' || browser === 'Edge';
        },

        /**
         * Get compatibility warnings
         * @returns {Array<string>} - Array of warning messages
         */
        getWarnings() {
            const warnings = [];

            if (!this.isSecureContext()) {
                warnings.push('⚠️ This site must be accessed via HTTPS for microphone access.');
            }

            if (!this.hasWebSpeech()) {
                warnings.push('⚠️ Web Speech API is not supported in this browser.');
            }

            if (!this.isRecommendedBrowser() && this.isMobile()) {
                warnings.push('⚠️ For best results on mobile, use Chrome or Edge browser.');
            }

            return warnings;
        }
    },

    /**
     * Format timestamp for display
     * @returns {string} - Formatted timestamp
     */
    getTimestamp() {
        const now = new Date();
        return now.toLocaleString();
    },

    /**
     * Debounce function to limit function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} - Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Scroll element to bottom
     * @param {HTMLElement} element - Element to scroll
     */
    scrollToBottom(element) {
        if (element) {
            element.scrollTop = element.scrollHeight;
        }
    }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}
