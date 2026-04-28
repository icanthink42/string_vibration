class AudioEngine {
    constructor(simulation) {
        this.sim = simulation;
        this.audioCtx = null;
        this.processor = null;
        this.gainNode = null;
        this.isPlaying = false;
    }

    start() {
        if (this.isPlaying) return;

        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        const audioSamplePeriod = 1 / this.audioCtx.sampleRate;
        this.stepsPerSample = Math.max(1, Math.round(audioSamplePeriod / this.sim.dt));

        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.value = 0.4;
        this.gainNode.connect(this.audioCtx.destination);

        this.processor = this.audioCtx.createScriptProcessor(512, 0, 1);
        this.processor.onaudioprocess = (e) => this.processAudio(e);
        this.processor.connect(this.gainNode);

        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;

        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        if (this.audioCtx) {
            this.audioCtx.close();
            this.audioCtx = null;
        }

        this.isPlaying = false;
    }

    processAudio(e) {
        const output = e.outputBuffer.getChannelData(0);
        const nx = this.sim.nx;

        for (let i = 0; i < output.length; i++) {
            this.sim.stepN(this.stepsPerSample);

            let sum = 0;
            for (let j = 1; j < nx - 1; j++) {
                sum += this.sim.u[j];
            }
            sum += 0.5 * (this.sim.u[0] + this.sim.u[nx - 1]);

            output[i] = Math.max(-1, Math.min(1, (sum / nx) * 120));
        }
    }

    toggle() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
        return this.isPlaying;
    }
}

class PianoAudioEngine {
    constructor() {
        this.audioCtx = null;
        this.processor = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.stepsPerSample = 1;
    }

    start() {
        if (this.isPlaying) return;

        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Use a reference simulation to calculate steps per sample
        const refSim = new StringSimulation(pianoStringParams);
        const audioSamplePeriod = 1 / this.audioCtx.sampleRate;
        this.stepsPerSample = Math.max(1, Math.round(audioSamplePeriod / refSim.dt));

        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.value = 0.4;
        this.gainNode.connect(this.audioCtx.destination);

        this.processor = this.audioCtx.createScriptProcessor(512, 0, 1);
        this.processor.onaudioprocess = (e) => this.processAudio(e);
        this.processor.connect(this.gainNode);

        this.isPlaying = true;
    }

    stop() {
        if (!this.isPlaying) return;

        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        if (this.audioCtx) {
            this.audioCtx.close();
            this.audioCtx = null;
        }

        this.isPlaying = false;
    }

    processAudio(e) {
        const output = e.outputBuffer.getChannelData(0);
        const strings = getActiveStrings();

        for (let i = 0; i < output.length; i++) {
            let totalSum = 0;
            let stringCount = 0;

            for (const [note, sim] of strings) {
                sim.stepN(this.stepsPerSample);

                const nx = sim.nx;
                let sum = 0;
                for (let j = 1; j < nx - 1; j++) {
                    sum += sim.u[j];
                }
                sum += 0.5 * (sim.u[0] + sim.u[nx - 1]);

                totalSum += (sum / nx) * 120;
                stringCount++;
            }

            // Normalize by number of strings to prevent clipping
            if (stringCount > 0) {
                totalSum /= Math.sqrt(stringCount);
            }

            output[i] = Math.max(-1, Math.min(1, totalSum));
        }
    }

    toggle() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
        return this.isPlaying;
    }
}
