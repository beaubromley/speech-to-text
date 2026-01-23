/**
 * Whisper Turbo Implementation
 * High-performance Whisper transcription using optimized WASM
 * Best for: Laptop, near real-time transcription, offline use
 * Performance: 0.3-0.8x real-time on laptop, 1.5-3x on mobile
 */

class WhisperTurboTranscriber {
    constructor() {
        this.worker = null;
        this.audioProcessor = null;
        this.isRecording = false;
        this.isProcessing = false;
        this.modelLoaded = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.processingQueue = [];
        this.currentModel = 'tiny';

        // Callbacks
        this.onTranscriptUpdate = null;
        this.onError = null;
        this.onStatusChange = null;
        this.onProgress = null;
        this.onLoadingChange = null;

        this.initWorker();
    }

    /**
     * Check if Whisper Turbo is supported
     */
    static isSupported() {
        return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
    }

    /**
     * Initialize the Web Worker
     */
    initWorker() {
        try {
            this.worker = new Worker('js/whisper-turbo-worker.js');
            this.setupWorkerListeners();
        } catch (error) {
            console.error('Error creating worker:', error);
        }
    }

    /**
     * Set up worker message listeners
     */
    setupWorkerListeners() {
        if (!this.worker) return;

        this.worker.addEventListener('message', (event) => {
            const { type, data } = event.data;

            switch (type) {
                case 'loading':
                    if (this.onProgress) {
                        this.onProgress(data.progress);
                    }
                    console.log(data.status);
                    break;

                case 'loaded':
                    this.modelLoaded = true;
                    if (this.onLoadingChange) {
                        this.onLoadingChange(false);
                    }
                    console.log('Whisper Turbo model loaded');
                    break;

                case 'processing':
                    console.log(data.status);
                    break;

                case 'result':
                    this.handleTranscriptionResult(data);
                    break;

                case 'error':
                    console.error('Worker error:', data.message);
                    if (this.onError) {
                        this.onError(data.message);
                    }
                    this.isProcessing = false;
                    this.processQueue();
                    break;

                case 'unloaded':
                    this.modelLoaded = false;
                    console.log('Model unloaded');
                    break;

                default:
                    console.warn('Unknown worker message type:', type);
            }
        });

        this.worker.addEventListener('error', (error) => {
            console.error('Worker error:', error);
            if (this.onError) {
                this.onError('Worker error: ' + error.message);
            }
        });
    }

    /**
     * Load the Whisper model
     * @param {string} modelSize - Model size ('tiny', 'base', 'small')
     */
    async loadModel(modelSize = 'tiny') {
        if (this.modelLoaded) {
            console.log('Model already loaded');
            return true;
        }

        if (!this.worker) {
            if (this.onError) {
                this.onError('Worker not initialized');
            }
            return false;
        }

        this.currentModel = modelSize;

        // Model URLs (placeholder - would need to be hosted or downloaded)
        const modelUrls = {
            'tiny': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
            'base': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
            'small': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin'
        };

        const modelUrl = modelUrls[modelSize] || modelUrls['tiny'];

        console.log('Loading Whisper Turbo model:', modelSize);

        if (this.onLoadingChange) {
            this.onLoadingChange(true);
        }

        // Send load message to worker
        this.worker.postMessage({
            type: 'load',
            data: { modelUrl }
        });

        // Return promise that resolves when model is loaded
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this.modelLoaded) {
                    clearInterval(checkInterval);
                    resolve(true);
                }
            }, 100);

            // Timeout after 5 minutes
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!this.modelLoaded) {
                    if (this.onError) {
                        this.onError('Model loading timeout');
                    }
                    resolve(false);
                }
            }, 300000);
        });
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
            if (this.onError) {
                this.onError('Please wait for the model to load before starting...');
            }

            const loaded = await this.loadModel(this.currentModel);
            if (!loaded) {
                return false;
            }
        }

        // Create audio processor
        if (!this.audioProcessor) {
            this.audioProcessor = new AudioProcessor();
            this.setupAudioProcessorCallbacks();
        }

        // Start recording with 30-second chunks (optimized for Whisper Turbo)
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
            console.log('Audio chunk ready for Whisper Turbo, size:', pcmData.length);

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

        // Send to worker for transcription
        console.log('Sending audio to Whisper Turbo worker...');
        const startTime = Date.now();

        // Store start time for RTF calculation
        this.lastProcessingStartTime = startTime;
        this.lastAudioLength = pcmData.length / 16000;

        this.worker.postMessage({
            type: 'transcribe',
            data: { audio: pcmData }
        });

        // Note: processQueue will be called again when result is received
    }

    /**
     * Handle transcription result from worker
     */
    handleTranscriptionResult(result) {
        const elapsedTime = (Date.now() - this.lastProcessingStartTime) / 1000;
        const rtf = elapsedTime / this.lastAudioLength;
        console.log(`Whisper Turbo transcription complete in ${elapsedTime.toFixed(2)}s (RTF: ${rtf.toFixed(2)}x)`);

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

        // Process next chunk
        this.processQueue();
    }

    /**
     * Stop recording
     */
    stop() {
        console.log('Stopping Whisper Turbo recording...');

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
            'tiny': '39 MB',
            'base': '74 MB',
            'small': '244 MB'
        };

        return {
            name: `Whisper Turbo ${this.currentModel}`,
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

        if (this.worker) {
            this.worker.postMessage({ type: 'unload' });
            this.worker.terminate();
            this.worker = null;
        }

        this.modelLoaded = false;
        this.processingQueue = [];
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.WhisperTurboTranscriber = WhisperTurboTranscriber;
}
