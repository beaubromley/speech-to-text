/**
 * VU Meter - Real-time audio level visualization
 * Uses Web Audio API AnalyserNode for mic input levels
 */

class VUMeter {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.audioContext = null;
        this.analyser = null;
        this.stream = null;
        this.animationId = null;
        this.segments = [];
        this.segmentCount = 16;

        this.buildUI();
    }

    /**
     * Build the LED segment bar
     */
    buildUI() {
        if (!this.container) return;

        const bar = document.createElement('div');
        bar.className = 'vu-bar';

        for (let i = 0; i < this.segmentCount; i++) {
            const seg = document.createElement('div');
            seg.className = 'vu-segment';
            bar.appendChild(seg);
            this.segments.push(seg);
        }

        this.container.appendChild(bar);
    }

    /**
     * Start listening to mic and animating
     */
    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.stream);

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.7;
            source.connect(this.analyser);

            this.animate();
            return true;
        } catch (error) {
            console.error('VU Meter: Could not access microphone', error);
            return false;
        }
    }

    /**
     * Animation loop - read audio level and update segments
     */
    animate() {
        if (!this.analyser) return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        // Calculate average level (0-255)
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Map to segment count (0 to segmentCount)
        const level = Math.round((average / 255) * this.segmentCount);

        // Update segments
        for (let i = 0; i < this.segmentCount; i++) {
            if (i < level) {
                this.segments[i].classList.add('active');
            } else {
                this.segments[i].classList.remove('active');
            }
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Stop listening and clean up
     */
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.analyser = null;

        // Reset all segments
        this.segments.forEach(seg => seg.classList.remove('active'));
    }
}

if (typeof window !== 'undefined') {
    window.VUMeter = VUMeter;
}
