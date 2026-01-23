/**
 * Transformers.js Whisper Implementation
 * Uses Hugging Face Transformers.js for offline speech recognition
 * Best for: Desktop, offline transcription, post-processing
 * Performance: 3-5x slower than real-time on mobile, 0.8-1.5x on laptop
 */

class TransformersWhisperTranscriber {
    constructor() {
        this.audioProcessor = null;
        this.pipeline = null;
        this.isRecording = false;
        this.isProcessing = false;
        this.modelLoaded = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.processingQueue = [];
        this.currentModel = 'Xenova/whisper-tiny.en';

        // Callbacks
        this.onTranscriptUpdate = null;
        this.onError = null;
        this.onStatusChange = null;
        this.onProgress = null;
        this.onLoadingChange = null;
    }

    /**
     * Check if Transformers.js is supported
     */
    static isSupported() {
        return typeof window !== 'undefined';
    }

    /**
     * Load the Whisper model
     * @param {string} modelName - Model to load ('tiny', 'base', 'small')
     */
    async loadModel(modelName = 'tiny') {
        if (this.modelLoaded) {
            console.log('Model already loaded');
            return true;
        }

        try {
            // Map model names
            const modelMap = {
                'tiny': 'Xenova/whisper-tiny.en',
                'base': 'Xenova/whisper-base.en',
                'small': 'Xenova/whisper-small.en'
            };

            this.currentModel = modelMap[modelName] || modelMap['tiny'];

            console.log('Loading Transformers.js Whisper model:', this.currentModel);

            if (this.onLoadingChange) {
                this.onLoadingChange(true);
            }

            // Dynamically import transformers.js
            if (!window.transformers) {
                const script = document.createElement('script');
                script.type = 'module';
                script.textContent = `
                    import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
                    window.createTransformersPipeline = pipeline;
                `;
                document.head.appendChild(script);

                // Wait for script to load
                await new Promise((resolve) => {
                    const checkInterval = setInterval(() => {
                        if (window.createTransformersPipeline) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 100);
                });
            }

            // Create the pipeline with progress callback
            this.pipeline = await window.createTransformersPipeline('automatic-speech-recognition', this.currentModel, {
                progress_callback: (progress) => {
                    if (progress.status === 'progress' && this.onProgress) {
                        const percentage = (progress.loaded / progress.total) * 100;
                        this.onProgress(percentage);
                    }
                }
            });

            this.modelLoaded = true;

            if (this.onLoadingChange) {
                this.onLoadingChange(false);
            }

            console.log('Model loaded successfully');
            return true;

        } catch (error) {
            console.error('Error loading model:', error);
            if (this.onError) {
                this.onError('Failed to load Whisper model. Please check your internet connection and try again.');
            }
            if (this.onLoadingChange) {
                this.onLoadingChange(false);
            }
            return false;
        }
    }

    /**
     * Start recording and transcription
     */
    async start() {
        if (this.isRecording) {
            console.log('Already recording');
            return false;
        }

        // Load model if not loaded
        if (!this.modelLoaded) {
            const loaded = await this.loadModel('tiny');
            if (!loaded) {
                return false;
            }
        }

        // Create audio processor
        if (!this.audioProcessor) {
            this.audioProcessor = new AudioProcessor();
            this.setupAudioProcessorCallbacks();
        }

        // Start recording with 30-second chunks
        const success = await this.audioProcessor.startRecording(30000);

        if (success) {
            this.isRecording = true;
            if (this.onStatusChange) {
                this.onStatusChange('recording');
            }
            return true;
        }

        return false;
    }

    /**
     * Set up audio processor callbacks
     */
    setupAudioProcessorCallbacks() {
        if (!this.audioProcessor) return;

        this.audioProcessor.onChunkReady = async (pcmData) => {
            console.log('Audio chunk ready for processing, size:', pcmData.length);

            // Add to queue
            this.processingQueue.push(pcmData);

            // Process queue if not already processing
            if (!this.isProcessing) {
                this.processQueue();
            }
        };

        this.audioProcessor.onError = (error) => {
            if (this.onError) {
                this.onError(error);
            }
        };

        this.audioProcessor.onStatusChange = (status) => {
            // Forward status changes
            if (status === 'stopped' && !this.isProcessing) {
                if (this.onStatusChange) {
                    this.onStatusChange('stopped');
                }
            }
        };
    }

    /**
     * Process the queue of audio chunks
     */
    async processQueue() {
        if (this.processingQueue.length === 0) {
            this.isProcessing = false;
            if (!this.isRecording && this.onStatusChange) {
                this.onStatusChange('stopped');
            }
            return;
        }

        this.isProcessing = true;

        if (this.onStatusChange) {
            this.onStatusChange('processing');
        }

        const pcmData = this.processingQueue.shift();

        try {
            // Transcribe with Transformers.js
            console.log('Transcribing audio chunk...');
            const startTime = Date.now();

            const result = await this.pipeline(pcmData, {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: false
            });

            const elapsedTime = (Date.now() - startTime) / 1000;
            const audioLength = pcmData.length / 16000;
            const rtf = elapsedTime / audioLength; // Real-time factor
            console.log(`Transcription complete in ${elapsedTime.toFixed(2)}s (RTF: ${rtf.toFixed(2)}x)`);

            // Add to final transcript
            const transcribedText = result.text.trim();
            if (transcribedText) {
                if (this.finalTranscript.length > 0 && !this.finalTranscript.endsWith(' ')) {
                    this.finalTranscript += ' ';
                }
                this.finalTranscript += transcribedText;

                // Update UI
                if (this.onTranscriptUpdate) {
                    this.onTranscriptUpdate({
                        final: this.finalTranscript,
                        interim: this.processingQueue.length > 0 ? '(Processing next chunk...)' : ''
                    });
                }
            }

        } catch (error) {
            console.error('Error transcribing audio:', error);
            if (this.onError) {
                this.onError('Error transcribing audio chunk');
            }
        }

        // Process next chunk
        await this.processQueue();
    }

    /**
     * Stop recording
     */
    stop() {
        console.log('Stopping Transformers.js recording...');

        this.isRecording = false;

        if (this.audioProcessor) {
            this.audioProcessor.stopRecording();
        }

        // Status will be updated when queue is empty
        if (!this.isProcessing && this.onStatusChange) {
            this.onStatusChange('stopped');
        }
    }

    /**
     * Clear transcript
     */
    clear() {
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.processingQueue = [];

        if (this.onTranscriptUpdate) {
            this.onTranscriptUpdate({
                final: '',
                interim: ''
            });
        }
    }

    /**
     * Get current transcript
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
     * Check if currently recording
     */
    getIsRecording() {
        return this.isRecording;
    }

    /**
     * Get model information
     */
    getModelInfo() {
        const modelSizes = {
            'Xenova/whisper-tiny.en': '39 MB',
            'Xenova/whisper-base.en': '74 MB',
            'Xenova/whisper-small.en': '244 MB'
        };

        return {
            name: this.currentModel,
            size: modelSizes[this.currentModel] || 'Unknown',
            loaded: this.modelLoaded
        };
    }

    /**
     * Clean up
     */
    destroy() {
        this.stop();

        if (this.audioProcessor) {
            this.audioProcessor.destroy();
            this.audioProcessor = null;
        }

        this.pipeline = null;
        this.modelLoaded = false;
        this.processingQueue = [];
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.TransformersWhisperTranscriber = TransformersWhisperTranscriber;
}
