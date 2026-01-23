/**
 * Audio Processing Pipeline
 * Shared module for recording, chunking, and processing audio
 * Used by both Transformers.js and Whisper-turbo implementations
 */

class AudioProcessor {
    constructor() {
        this.mediaRecorder = null;
        this.audioContext = null;
        this.stream = null;
        this.isRecording = false;
        this.chunks = [];
        this.chunkDuration = 30000; // 30 seconds default
        this.chunkTimer = null;

        // Callbacks
        this.onChunkReady = null;
        this.onError = null;
        this.onStatusChange = null;
    }

    /**
     * Start recording audio
     * @param {number} chunkDuration - Duration of each chunk in milliseconds
     */
    async startRecording(chunkDuration = 30000) {
        if (this.isRecording) {
            console.log('Already recording');
            return false;
        }

        this.chunkDuration = chunkDuration;

        try {
            // Request microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            // Set up MediaRecorder
            const options = { mimeType: this.getSupportedMimeType() };
            this.mediaRecorder = new MediaRecorder(this.stream, options);

            this.chunks = [];

            // Handle data available
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.chunks.push(event.data);
                }
            };

            // Handle stop event - process the chunk
            this.mediaRecorder.onstop = async () => {
                if (this.chunks.length > 0) {
                    const audioBlob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType });
                    this.chunks = [];

                    // Convert to PCM and send for processing
                    try {
                        const pcmData = await this.convertBlobToPCM(audioBlob);
                        if (this.onChunkReady) {
                            this.onChunkReady(pcmData);
                        }
                    } catch (error) {
                        console.error('Error processing audio chunk:', error);
                        if (this.onError) {
                            this.onError('Error processing audio chunk');
                        }
                    }
                }

                // Restart for next chunk if still recording
                if (this.isRecording) {
                    this.mediaRecorder.start();
                    this.scheduleChunkStop();
                }
            };

            // Start recording
            this.mediaRecorder.start();
            this.isRecording = true;

            // Schedule chunk stop
            this.scheduleChunkStop();

            if (this.onStatusChange) {
                this.onStatusChange('recording');
            }

            console.log('Audio recording started');
            return true;

        } catch (error) {
            console.error('Error starting recording:', error);
            if (this.onError) {
                this.onError('Failed to access microphone. Please grant permission and try again.');
            }
            return false;
        }
    }

    /**
     * Stop recording
     */
    stopRecording() {
        console.log('Stopping audio recording...');

        this.isRecording = false;

        // Clear chunk timer
        if (this.chunkTimer) {
            clearTimeout(this.chunkTimer);
            this.chunkTimer = null;
        }

        // Stop media recorder
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        // Stop all tracks
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.onStatusChange) {
            this.onStatusChange('stopped');
        }
    }

    /**
     * Schedule stopping the current chunk
     */
    scheduleChunkStop() {
        if (this.chunkTimer) {
            clearTimeout(this.chunkTimer);
        }

        this.chunkTimer = setTimeout(() => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
        }, this.chunkDuration);
    }

    /**
     * Convert audio blob to 16kHz mono PCM Float32Array
     * Required format for Whisper models
     */
    async convertBlobToPCM(blob) {
        try {
            // Create audio context if needed
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: 16000
                });
            }

            // Convert blob to array buffer
            const arrayBuffer = await blob.arrayBuffer();

            // Decode audio data
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            // Get mono channel data (already 16kHz from context)
            let channelData;
            if (audioBuffer.numberOfChannels === 1) {
                channelData = audioBuffer.getChannelData(0);
            } else {
                // Mix down to mono if stereo
                const left = audioBuffer.getChannelData(0);
                const right = audioBuffer.getChannelData(1);
                channelData = new Float32Array(left.length);
                for (let i = 0; i < left.length; i++) {
                    channelData[i] = (left[i] + right[i]) / 2;
                }
            }

            // Resample to 16kHz if needed
            if (audioBuffer.sampleRate !== 16000) {
                channelData = this.resample(channelData, audioBuffer.sampleRate, 16000);
            }

            return channelData;

        } catch (error) {
            console.error('Error converting audio to PCM:', error);
            throw error;
        }
    }

    /**
     * Resample audio to target sample rate
     */
    resample(audioData, fromSampleRate, toSampleRate) {
        if (fromSampleRate === toSampleRate) {
            return audioData;
        }

        const sampleRateRatio = fromSampleRate / toSampleRate;
        const newLength = Math.round(audioData.length / sampleRateRatio);
        const result = new Float32Array(newLength);

        let offsetResult = 0;
        let offsetBuffer = 0;

        while (offsetResult < result.length) {
            const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);

            let accum = 0;
            let count = 0;

            for (let i = offsetBuffer; i < nextOffsetBuffer && i < audioData.length; i++) {
                accum += audioData[i];
                count++;
            }

            result[offsetResult] = accum / count;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }

        return result;
    }

    /**
     * Get supported MIME type for MediaRecorder
     */
    getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/mp4',
            'audio/wav'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log('Using MIME type:', type);
                return type;
            }
        }

        console.warn('No supported MIME type found, using default');
        return '';
    }

    /**
     * Get audio duration from blob
     */
    async getAudioDuration(blob) {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            return audioBuffer.duration;
        } catch (error) {
            console.error('Error getting audio duration:', error);
            return 0;
        }
    }

    /**
     * Check if currently recording
     */
    getIsRecording() {
        return this.isRecording;
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stopRecording();

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.chunks = [];
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.AudioProcessor = AudioProcessor;
}
