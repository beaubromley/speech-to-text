/**
 * Sherpa-ONNX WASM Speech Transcriber
 * Local speech recognition using sherpa-onnx running in the browser via WebAssembly.
 * ~191MB model download on first use (cached by browser after).
 *
 * Ported from bball-stats/web/lib/sherpa.ts
 */

const SHERPA_CDN =
    'https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-en/resolve/main';

/**
 * Load a script tag dynamically (deduped)
 */
function loadSherpaScript(url) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = url;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load: ${url}`));
        document.head.appendChild(s);
    });
}

/**
 * Downsample a Float32Array from one sample rate to another
 */
function downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
    if (inputSampleRate === outputSampleRate) return buffer;
    const ratio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
        let accum = 0, count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i]; count++;
        }
        result[offsetResult] = accum / count;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

class SherpaTranscriber {
    constructor() {
        // State
        this.isRecording = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.engineLoaded = false;

        // Sherpa engine references
        this.engine = null;       // { recognizer, module, createStream }
        this.recognizerStream = null;

        // Audio pipeline references
        this.audioContext = null;
        this.scriptProcessor = null;
        this.micStream = null;
        this.displayStream = null;
        this.micSource = null;
        this.displaySource = null;

        // Configuration
        this.audioSourceMode = 'mic'; // 'mic', 'system', 'both'
        this.hotwords = '';           // newline-separated "word :weight" entries
        this.hotwordsScore = 3.5;     // global boost strength for hotwords
        this.lastHotwords = null;     // track changes to know when to recreate recognizer
        this.lastHotwordsScore = null;
        this.sampleRate = 16000;
        this.finalizeInterval = null; // periodic finalization timer
        this.finalizeIntervalMs = 3000; // finalize interim text every 3s

        // Callbacks
        this.onTranscriptUpdate = null;
        this.onError = null;
        this.onStatusChange = null;
        this.onLoadingChange = null;
        this.onLoadingStatus = null;
    }

    /**
     * Check if Sherpa-ONNX is supported in this browser
     */
    static isSupported() {
        return typeof WebAssembly !== 'undefined' && window.isSecureContext;
    }

    /**
     * Convert ALL CAPS sherpa output to sentence case
     */
    _toSentenceCase(text) {
        if (!text) return text;
        // Lowercase everything, then capitalize first char
        return text.toLowerCase().replace(/^\w/, c => c.toUpperCase());
    }

    /**
     * Set hotwords string (format: "keyword :5.0\nkeyword2 :5.0")
     */
    setHotwords(hotwordsString) {
        this.hotwords = hotwordsString;
    }

    /**
     * Set hotwords boost score
     * @param {number} score - 0 to 10
     */
    setHotwordsScore(score) {
        this.hotwordsScore = score;
    }

    /**
     * Set audio source mode
     * @param {string} mode - 'mic', 'system', or 'both'
     */
    setAudioSourceMode(mode) {
        this.audioSourceMode = mode;
    }

    /**
     * Load the sherpa-onnx WASM engine
     */
    async loadEngine() {
        const hotwordsChanged = this.hotwords !== this.lastHotwords || this.hotwordsScore !== this.lastHotwordsScore;
        console.log('[Sherpa] loadEngine called, hotwordsChanged:', hotwordsChanged,
            'cachedEngine:', !!window._sherpaEngine, 'cachedModule:', !!window._sherpaModule);

        // If engine is cached and hotwords haven't changed, reuse it
        if (window._sherpaEngine && !hotwordsChanged) {
            this.engine = window._sherpaEngine;
            this.engineLoaded = true;
            console.log('[Sherpa] Using cached engine');
            if (this.onLoadingStatus) this.onLoadingStatus('Sherpa-ONNX ready (cached)');
            return;
        }

        // If module is cached but hotwords changed, just recreate the recognizer
        if (window._sherpaModule && hotwordsChanged) {
            console.log('[Sherpa] Recreating recognizer with new hotwords');
            console.log('[Sherpa] hotwords:', JSON.stringify(this.hotwords), 'score:', this.hotwordsScore);
            if (this.onLoadingStatus) this.onLoadingStatus('Updating recognizer with new keywords...');
            try {
                this.engine = this._createRecognizerFromModule(window._sherpaModule);
            } catch (e) {
                const msg = e.message || e.name || (typeof e === 'string' ? e : JSON.stringify(e, Object.getOwnPropertyNames(e)));
                console.error('[Sherpa] _createRecognizerFromModule failed:', msg, 'stack:', e.stack || 'none');
                throw e;
            }
            window._sherpaEngine = this.engine;
            this.lastHotwords = this.hotwords;
            this.lastHotwordsScore = this.hotwordsScore;
            this.engineLoaded = true;
            if (this.onLoadingStatus) this.onLoadingStatus('Sherpa-ONNX ready');
            return;
        }

        // Full load from CDN
        console.log('[Sherpa] Full load from CDN starting...');
        if (this.onLoadingChange) this.onLoadingChange(true);
        if (this.onLoadingStatus) this.onLoadingStatus('Loading Sherpa-ONNX (~191MB first time, cached after)...');

        try {
            // Load the JS API wrapper first
            console.log('[Sherpa] Loading sherpa-onnx-asr.js...');
            await loadSherpaScript(`${SHERPA_CDN}/sherpa-onnx-asr.js`);
            console.log('[Sherpa] sherpa-onnx-asr.js loaded. createOnlineRecognizer:', typeof window.createOnlineRecognizer);

            const module = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Sherpa init timeout (5 min)')), 300000);

                window.Module = {
                    locateFile: (path) => {
                        const url = `${SHERPA_CDN}/${path}`;
                        console.log('[Sherpa] locateFile:', path);
                        return url;
                    },
                    onRuntimeInitialized: () => {
                        clearTimeout(timeout);
                        console.log('[Sherpa] WASM runtime initialized');
                        try {
                            if (this.onLoadingStatus) this.onLoadingStatus('Model loaded, creating recognizer...');
                            resolve(window.Module);
                        } catch (err) {
                            reject(err);
                        }
                    },
                    setStatus: (status) => {
                        if (status) {
                            console.log('[Sherpa] Module status:', status);
                            if (this.onLoadingStatus) this.onLoadingStatus(status);
                        }
                    }
                };

                console.log('[Sherpa] Loading sherpa-onnx-wasm-main-asr.js...');
                loadSherpaScript(`${SHERPA_CDN}/sherpa-onnx-wasm-main-asr.js`).catch(reject);
            });

            // Cache the module
            window._sherpaModule = module;
            console.log('[Sherpa] Module cached, creating recognizer...');

            // Create the recognizer
            this.engine = this._createRecognizerFromModule(module);
            window._sherpaEngine = this.engine;
            this.lastHotwords = this.hotwords;
            this.lastHotwordsScore = this.hotwordsScore;
            this.engineLoaded = true;

            console.log('[Sherpa] Engine ready');
            if (this.onLoadingStatus) this.onLoadingStatus('Sherpa-ONNX ready');
        } catch (err) {
            console.error('[Sherpa] loadEngine failed:', err);
            if (this.onError) this.onError(`Failed to load Sherpa-ONNX: ${err.message}`);
            throw err;
        } finally {
            if (this.onLoadingChange) this.onLoadingChange(false);
        }
    }

    /**
     * Create a recognizer from a loaded WASM module
     */
    _createRecognizerFromModule(module) {
        // Write hotwords file if provided
        let hotwordsPath = '';
        if (this.hotwords) {
            try {
                const FS = module.FS || window.FS;
                if (FS && FS.writeFile) {
                    FS.writeFile('./hotwords.txt', new TextEncoder().encode(this.hotwords));
                    hotwordsPath = './hotwords.txt';
                } else if (module.FS_createDataFile) {
                    const arr = Array.from(new TextEncoder().encode(this.hotwords));
                    try { module.FS_unlink('/hotwords.txt'); } catch (e) { /* may not exist */ }
                    module.FS_createDataFile('/', 'hotwords.txt', arr, true, true);
                    hotwordsPath = './hotwords.txt';
                }
            } catch (e) {
                console.warn('Could not write hotwords file:', e);
            }
        }

        const config = {
            featConfig: { sampleRate: 16000, featureDim: 80 },
            modelConfig: {
                transducer: { encoder: './encoder.onnx', decoder: './decoder.onnx', joiner: './joiner.onnx' },
                paraformer: { encoder: '', decoder: '' },
                zipformer2Ctc: { model: '' },
                nemoCtc: { model: '' },
                toneCtc: { model: '' },
                tokens: './tokens.txt',
                numThreads: 1,
                provider: 'cpu',
                debug: 0,
                modelType: '',
                modelingUnit: '',
                bpeVocab: '',
                tokensBuf: '',
                tokensBufSize: 0,
            },
            decodingMethod: hotwordsPath ? 'modified_beam_search' : 'greedy_search',
            maxActivePaths: 4,
            enableEndpoint: 1,
            rule1MinTrailingSilence: 2.4,
            rule2MinTrailingSilence: 1.2,
            rule3MinUtteranceLength: 20,
            hotwordsFile: hotwordsPath,
            hotwordsScore: this.hotwordsScore,
            hotwordsBuf: '',
            hotwordsBufSize: 0,
            ctcFstDecoderConfig: { graph: '', maxActive: 3000 },
            ruleFsts: '',
            ruleFars: '',
            blankPenalty: 0,
            hr: { lexicon: '', ruleFsts: '' },
        };

        const recognizer = window.createOnlineRecognizer(module, config);
        return {
            recognizer,
            module,
            createStream: () => recognizer.createStream(),
        };
    }

    /**
     * Start recording and transcribing
     * @returns {Promise<boolean>} success
     */
    async start() {
        if (this.isRecording || this._starting) return false;
        this._starting = true;

        try {
            // Load engine if needed (or if hotwords changed)
            console.log('[Sherpa] start() called, loading engine...');
            await this.loadEngine();
            console.log('[Sherpa] Engine loaded, creating stream...');

            // Create a new recognizer stream
            this.recognizerStream = this.engine.createStream();
            console.log('[Sherpa] Stream created, getting audio...');

            // Get audio stream(s)
            const audioConstraints = {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            };

            if (this.audioSourceMode === 'mic' || this.audioSourceMode === 'both') {
                console.log('[Sherpa] Requesting mic via getUserMedia...');
                this.micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
                console.log('[Sherpa] Mic stream obtained');
            }

            if (this.audioSourceMode === 'system' || this.audioSourceMode === 'both') {
                try {
                    console.log('[Sherpa] Requesting system audio via getDisplayMedia...');
                    this.displayStream = await navigator.mediaDevices.getDisplayMedia({
                        audio: true,
                        video: true, // Chrome requires video
                    });
                    // Stop video tracks immediately — we only need audio
                    this.displayStream.getVideoTracks().forEach(track => track.stop());
                    console.log('[Sherpa] Display stream audio tracks:', this.displayStream.getAudioTracks().length);

                    if (this.displayStream.getAudioTracks().length === 0) {
                        throw new Error('No audio track. When sharing, select a Chrome TAB (not window) or select "Entire Screen" and check "Share system audio".');
                    }
                } catch (err) {
                    console.error('[Sherpa] System audio failed:', err.name, err.message);
                    // Clean up mic stream if we got one
                    if (this.micStream) {
                        this.micStream.getTracks().forEach(t => t.stop());
                        this.micStream = null;
                    }
                    if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
                        if (this.onError) this.onError('Screen sharing was cancelled.');
                    } else {
                        if (this.onError) this.onError(err.message);
                    }
                    this._starting = false;
                    return false;
                }
            }

            // Create AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.sampleRate });
            const actualRate = this.audioContext.sampleRate;
            console.log('[Sherpa] AudioContext requested sampleRate:', this.sampleRate, 'actual:', actualRate);

            // Create ScriptProcessor
            this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

            // Connect sources
            if (this.micStream) {
                this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
                this.micSource.connect(this.scriptProcessor);
            }
            if (this.displayStream) {
                this.displaySource = this.audioContext.createMediaStreamSource(this.displayStream);
                this.displaySource.connect(this.scriptProcessor);
            }

            this.scriptProcessor.connect(this.audioContext.destination);

            // Process audio
            this.scriptProcessor.onaudioprocess = (e) => {
                if (!this.isRecording || !this.recognizerStream || !this.engine) return;

                const recognizer = this.engine.recognizer;
                const stream = this.recognizerStream;

                let samples = new Float32Array(e.inputBuffer.getChannelData(0));
                if (actualRate !== 16000) {
                    samples = downsampleBuffer(samples, actualRate, 16000);
                }

                stream.acceptWaveform(16000, samples);

                while (recognizer.isReady(stream)) {
                    recognizer.decode(stream);
                }

                // Get interim result
                const result = recognizer.getResult(stream).text.trim();
                if (result) {
                    this.interimTranscript = (result);
                    if (this.onTranscriptUpdate) {
                        this.onTranscriptUpdate({
                            final: this.finalTranscript,
                            interim: this.interimTranscript,
                        });
                    }
                }

                // Check for endpoint (silence detected = finalize)
                if (recognizer.isEndpoint(stream)) {
                    const finalText = (recognizer.getResult(stream).text.trim());
                    if (finalText) {
                        if (this.finalTranscript.length > 0) {
                            this.finalTranscript += ' ';
                        }
                        this.finalTranscript += finalText;
                        this.interimTranscript = '';

                        if (this.onTranscriptUpdate) {
                            this.onTranscriptUpdate({
                                final: this.finalTranscript,
                                interim: '',
                            });
                        }
                    }
                    recognizer.reset(stream);
                }
            };

            this.isRecording = true;
            this._starting = false;
            if (this.onStatusChange) this.onStatusChange('recording');

            // Periodic finalization — move interim to final every N seconds
            this.finalizeInterval = setInterval(() => {
                if (!this.isRecording || !this.recognizerStream || !this.engine) return;

                const text = (this.engine.recognizer.getResult(this.recognizerStream).text.trim());
                if (text) {
                    if (this.finalTranscript.length > 0) {
                        this.finalTranscript += ' ';
                    }
                    this.finalTranscript += text;
                    this.interimTranscript = '';

                    // Reset the stream to start fresh
                    this.engine.recognizer.reset(this.recognizerStream);

                    if (this.onTranscriptUpdate) {
                        this.onTranscriptUpdate({
                            final: this.finalTranscript,
                            interim: '',
                        });
                    }
                }
            }, this.finalizeIntervalMs);

            return true;

        } catch (err) {
            const errMsg = err.message || err.name || (typeof err === 'string' ? err : JSON.stringify(err, Object.getOwnPropertyNames(err)));
            console.error('[Sherpa] start error:', errMsg, 'stack:', err.stack || 'none');
            if (this.onError) this.onError(`Failed to start: ${errMsg}`);
            this._cleanupAudio();
            this._starting = false;
            return false;
        }
    }

    /**
     * Stop recording
     */
    stop() {
        if (!this.isRecording) return;

        this.isRecording = false;

        // Clear periodic finalization
        if (this.finalizeInterval) {
            clearInterval(this.finalizeInterval);
            this.finalizeInterval = null;
        }

        // Finalize any remaining text
        if (this.recognizerStream && this.engine) {
            const finalText = (this.engine.recognizer.getResult(this.recognizerStream).text.trim());
            if (finalText) {
                if (this.finalTranscript.length > 0) {
                    this.finalTranscript += ' ';
                }
                this.finalTranscript += finalText;
                this.interimTranscript = '';

                if (this.onTranscriptUpdate) {
                    this.onTranscriptUpdate({
                        final: this.finalTranscript,
                        interim: '',
                    });
                }
            }
        }

        this._cleanupAudio();

        if (this.onStatusChange) this.onStatusChange('stopped');
    }

    /**
     * Clean up audio resources
     */
    _cleanupAudio() {
        if (this.scriptProcessor) {
            this.scriptProcessor.onaudioprocess = null;
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }

        if (this.micSource) {
            this.micSource.disconnect();
            this.micSource = null;
        }
        if (this.displaySource) {
            this.displaySource.disconnect();
            this.displaySource = null;
        }

        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }
        if (this.displayStream) {
            this.displayStream.getTracks().forEach(t => t.stop());
            this.displayStream = null;
        }

        if (this.audioContext) {
            this.audioContext.close().catch(() => {});
            this.audioContext = null;
        }

        if (this.recognizerStream) {
            try { this.recognizerStream.free(); } catch (e) { /* ok */ }
            this.recognizerStream = null;
        }
    }

    /**
     * Get the active audio MediaStream (for VU meter, etc.)
     * @returns {MediaStream|null}
     */
    getActiveStream() {
        return this.micStream || this.displayStream || null;
    }

    /**
     * Clear transcript
     */
    clear() {
        this.finalTranscript = '';
        this.interimTranscript = '';
    }

    /**
     * Get the final transcript
     * @returns {string}
     */
    getTranscript() {
        return this.finalTranscript;
    }

    /**
     * Restore transcript from storage
     * @param {string} text
     */
    setTranscript(text) {
        this.finalTranscript = text;
    }

    /**
     * Check if currently recording
     * @returns {boolean}
     */
    getIsRecording() {
        return this.isRecording;
    }

    /**
     * Destroy and clean up everything
     */
    destroy() {
        this.stop();
        this.engine = null;
        this.engineLoaded = false;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.SherpaTranscriber = SherpaTranscriber;
}
