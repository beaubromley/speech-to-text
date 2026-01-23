/**
 * Web Speech API Transcription
 * Implements continuous speech recognition with auto-restart for lectures
 */

class WebSpeechTranscriber {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.shouldRestart = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.restartTimeout = null;
        this.restartDelay = 300; // ms delay before restarting

        // Callbacks
        this.onTranscriptUpdate = null;
        this.onError = null;
        this.onStatusChange = null;

        this.initRecognition();
    }

    /**
     * Check if Web Speech API is supported
     */
    static isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    /**
     * Initialize the Speech Recognition object
     */
    initRecognition() {
        if (!WebSpeechTranscriber.isSupported()) {
            console.error('Web Speech API is not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        // Critical configuration for continuous listening
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        // Set up event handlers
        this.setupEventHandlers();
    }

    /**
     * Set up all recognition event handlers
     */
    setupEventHandlers() {
        if (!this.recognition) return;

        // Handle recognition results
        this.recognition.onresult = (event) => {
            let interim = '';

            // Process all results
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    // Add space if there's already content
                    if (this.finalTranscript.length > 0 && !this.finalTranscript.endsWith(' ')) {
                        this.finalTranscript += ' ';
                    }
                    this.finalTranscript += transcript;
                } else {
                    interim += transcript;
                }
            }

            this.interimTranscript = interim;

            // Notify listeners
            if (this.onTranscriptUpdate) {
                this.onTranscriptUpdate({
                    final: this.finalTranscript,
                    interim: this.interimTranscript
                });
            }
        };

        // Handle recognition end - CRITICAL for continuous listening
        this.recognition.onend = () => {
            console.log('Recognition ended');

            // Clear any pending restart
            if (this.restartTimeout) {
                clearTimeout(this.restartTimeout);
                this.restartTimeout = null;
            }

            // Auto-restart if we're still supposed to be recording
            if (this.shouldRestart && this.isRecording) {
                console.log('Auto-restarting recognition...');
                this.restartTimeout = setTimeout(() => {
                    if (this.isRecording && this.shouldRestart) {
                        try {
                            this.recognition.start();
                        } catch (error) {
                            console.error('Error restarting recognition:', error);
                            // If restart fails, try again after a longer delay
                            if (this.isRecording && this.shouldRestart) {
                                setTimeout(() => {
                                    if (this.isRecording && this.shouldRestart) {
                                        try {
                                            this.recognition.start();
                                        } catch (e) {
                                            this.handleError(e);
                                        }
                                    }
                                }, 1000);
                            }
                        }
                    }
                }, this.restartDelay);
            } else {
                // Actually stopped recording
                this.isRecording = false;
                if (this.onStatusChange) {
                    this.onStatusChange('stopped');
                }
            }
        };

        // Handle errors
        this.recognition.onerror = (event) => {
            console.error('Recognition error:', event.error);

            // Handle specific error types
            switch (event.error) {
                case 'no-speech':
                    // This is normal during pauses - don't treat as error
                    console.log('No speech detected - will auto-restart');
                    break;

                case 'audio-capture':
                    this.handleError('Microphone not accessible. Please check your microphone connection.');
                    this.stop();
                    break;

                case 'not-allowed':
                    this.handleError('Microphone permission denied. Please grant permission and try again.');
                    this.stop();
                    break;

                case 'network':
                    this.handleError('Network error. Web Speech API requires internet connection.');
                    this.stop();
                    break;

                case 'aborted':
                    // Recognition was aborted - usually intentional
                    console.log('Recognition aborted');
                    break;

                default:
                    this.handleError(`Recognition error: ${event.error}`);
            }
        };

        // Handle recognition start
        this.recognition.onstart = () => {
            console.log('Recognition started');
            this.isRecording = true;
            if (this.onStatusChange) {
                this.onStatusChange('recording');
            }
        };
    }

    /**
     * Start recording
     */
    async start() {
        if (!this.recognition) {
            this.handleError('Speech recognition not initialized');
            return false;
        }

        if (this.isRecording) {
            console.log('Already recording');
            return false;
        }

        try {
            // Request microphone permission first
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Stop the test stream

            // Only reset interim transcript (keep final transcript to accumulate)
            this.interimTranscript = '';

            // Enable auto-restart
            this.shouldRestart = true;

            // Start recognition
            this.recognition.start();

            return true;
        } catch (error) {
            console.error('Error starting recognition:', error);
            this.handleError('Failed to access microphone. Please grant permission and try again.');
            return false;
        }
    }

    /**
     * Stop recording
     */
    stop() {
        console.log('Stopping recognition...');

        // Disable auto-restart
        this.shouldRestart = false;

        // Clear any pending restart
        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }

        // Stop recognition
        if (this.recognition && this.isRecording) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('Error stopping recognition:', error);
            }
        }

        this.isRecording = false;

        if (this.onStatusChange) {
            this.onStatusChange('stopped');
        }
    }

    /**
     * Clear the transcript
     */
    clear() {
        this.finalTranscript = '';
        this.interimTranscript = '';

        if (this.onTranscriptUpdate) {
            this.onTranscriptUpdate({
                final: '',
                interim: ''
            });
        }
    }

    /**
     * Get the current transcript
     */
    getTranscript() {
        return this.finalTranscript;
    }

    /**
     * Set transcript (for restoring from storage)
     */
    setTranscript(text) {
        this.finalTranscript = text;
        if (this.onTranscriptUpdate) {
            this.onTranscriptUpdate({
                final: this.finalTranscript,
                interim: this.interimTranscript
            });
        }
    }

    /**
     * Handle errors
     */
    handleError(message) {
        if (this.onError) {
            this.onError(message);
        }
    }

    /**
     * Check if currently recording
     */
    getIsRecording() {
        return this.isRecording;
    }

    /**
     * Clean up
     */
    destroy() {
        this.stop();
        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
        }
        this.recognition = null;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.WebSpeechTranscriber = WebSpeechTranscriber;
}
