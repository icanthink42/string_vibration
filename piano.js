const pianoStringParams = {
    tension: 4.0,
    linearDensity: 0.01,
    damping: 5.0,
    nx: 300
};

const baseHarmonic = 17;
const baseAmplitude = 30;
const baseWidth = 0.03;

let pianoSim = null;
let noteHarmonics = {};
let tensionTuning = false;
const baseTension = pianoStringParams.tension;

let pianoSynth = null;
let isSynthPlaying = false;

function noteToFrequency(note) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = note.match(/^([A-G]#?)(\d)$/);
    if (!match) return 440;

    const [, name, octaveStr] = match;
    const octave = parseInt(octaveStr);
    const semitone = noteNames.indexOf(name);
    const semitonesFromA4 = (octave - 4) * 12 + (semitone - 9);

    return 440 * Math.pow(2, semitonesFromA4 / 12);
}

function calculateNoteHarmonics(fundamental, pianoKeys) {
    const harmonics = {};

    pianoKeys.forEach(key => {
        const note = key.dataset.note;
        const freq = noteToFrequency(note);
        const n = Math.round(freq / fundamental);
        const actualFreq = n * fundamental;

        harmonics[note] = {
            harmonic: n,
            targetFreq: freq,
            actualFreq: actualFreq,
            antinodePos: 1 / (2 * n)
        };
    });

    return harmonics;
}

function playNote(key, pianoLabel) {
    const note = key.dataset.note;
    const info = noteHarmonics[note];

    if (!info || !pianoSim) return;

    let playFreq = info.actualFreq;

    if (tensionTuning) {
        // Calculate tension needed for exact equal temperament
        // T = μ * (2L * f_target / n)²
        const requiredTension = pianoSim.linearDensity *
            Math.pow(2 * pianoSim.L * info.targetFreq / info.harmonic, 2);
        pianoSim.setTension(requiredTension);
        playFreq = info.targetFreq;
    } else {
        pianoSim.setTension(baseTension);
    }

    pianoSim.forcingX0 = info.antinodePos * pianoSim.L;
    pianoSim.forcingFreq = playFreq;
    pianoSim.forcingWidth = (baseWidth * baseHarmonic / info.harmonic) * pianoSim.L;
    pianoSim.forcingAmplitude = baseAmplitude * Math.pow(info.harmonic / baseHarmonic, 2);

    // Let simulation establish vibration
    pianoSim.stepN(500);

    // Analyze string vibration to get frequency and waveform
    const { frequency, waveform } = analyzeStringVibration(pianoSim, 1000);

    // Stop previous synth if playing
    if (pianoSynth && isSynthPlaying) {
        pianoSynth.triggerRelease();
        pianoSynth.dispose();
    }

    // Create new synth with waveform from physical model
    Tone.start();
    pianoSynth = createCustomOscillator(waveform, frequency);
    pianoSynth.triggerAttack(frequency);
    isSynthPlaying = true;

    if (tensionTuning) {
        pianoLabel.textContent = `${note} (n=${info.harmonic}) - ${frequency.toFixed(1)} Hz [tuned]`;
    } else {
        pianoLabel.textContent = `${note} (n=${info.harmonic}) - ${frequency.toFixed(1)} Hz`;
    }
    key.classList.add('active');
}

function stopNote(key, pianoLabel) {
    key.classList.remove('active');
    if (pianoSim) {
        pianoSim.forcingFreq = 0;
        pianoLabel.textContent = 'Press a key';
    }
    if (pianoSynth && isSynthPlaying) {
        pianoSynth.triggerRelease();
        isSynthPlaying = false;
    }
}

function initPianoMode(pianoKeys) {
    pianoSim = new StringSimulation(pianoStringParams);
    pianoSim.forcingFreq = 0;
    noteHarmonics = calculateNoteHarmonics(pianoSim.fundamental, pianoKeys);

    pianoKeys.forEach(key => {
        const note = key.dataset.note;
        if (noteHarmonics[note]) {
            const info = noteHarmonics[note];
            key.dataset.harmonic = info.harmonic;
            key.dataset.actualFreq = info.actualFreq;
            key.dataset.antinodePos = info.antinodePos;
        }
    });
}

// Detect frequency and extract waveform from string vibration
function analyzeStringVibration(sim, sampleCount = 2000) {
    const buffer = [];
    const nx = sim.nx;

    // Collect samples
    for (let i = 0; i < sampleCount; i++) {
        sim.step();
        let sum = 0;
        for (let j = 1; j < nx - 1; j++) {
            sum += sim.u[j];
        }
        buffer.push(sum);
    }

    // Autocorrelation to find period
    const minLag = Math.floor(sampleCount / 50);
    const maxLag = Math.floor(sampleCount / 2);

    let bestLag = minLag;
    let bestCorr = -Infinity;

    for (let lag = minLag; lag < maxLag; lag++) {
        let corr = 0;
        for (let i = 0; i < sampleCount - lag; i++) {
            corr += buffer[i] * buffer[i + lag];
        }
        if (corr > bestCorr) {
            bestCorr = corr;
            bestLag = lag;
        }
    }

    // Extract one period of the waveform (from the latter half for stability)
    const startIdx = Math.floor(sampleCount / 2);
    const waveform = buffer.slice(startIdx, startIdx + bestLag);

    // Normalize waveform to [-1, 1]
    let maxAbs = 0;
    for (let i = 0; i < waveform.length; i++) {
        maxAbs = Math.max(maxAbs, Math.abs(waveform[i]));
    }
    if (maxAbs > 0) {
        for (let i = 0; i < waveform.length; i++) {
            waveform[i] /= maxAbs;
        }
    }

    const frequency = 1 / (bestLag * sim.dt);
    return { frequency, waveform };
}

// Create custom oscillator from waveform samples
function createCustomOscillator(waveform, frequency) {
    // Resample waveform to power of 2 for FFT
    const fftSize = 2048;
    const resampled = new Float32Array(fftSize);

    for (let i = 0; i < fftSize; i++) {
        const srcIdx = (i / fftSize) * waveform.length;
        const idx0 = Math.floor(srcIdx);
        const idx1 = Math.min(idx0 + 1, waveform.length - 1);
        const frac = srcIdx - idx0;
        resampled[i] = waveform[idx0] * (1 - frac) + waveform[idx1] * frac;
    }

    // Compute FFT to get partials (simplified DFT for harmonics)
    const numPartials = 32;
    const partials = [];

    for (let k = 1; k <= numPartials; k++) {
        let real = 0, imag = 0;
        for (let n = 0; n < fftSize; n++) {
            const angle = (2 * Math.PI * k * n) / fftSize;
            real += resampled[n] * Math.cos(angle);
            imag -= resampled[n] * Math.sin(angle);
        }
        const magnitude = Math.sqrt(real * real + imag * imag) / fftSize;
        partials.push(magnitude);
    }

    // Normalize partials
    const maxPartial = Math.max(...partials);
    if (maxPartial > 0) {
        for (let i = 0; i < partials.length; i++) {
            partials[i] /= maxPartial;
        }
    }

    return new Tone.Synth({
        oscillator: {
            type: 'custom',
            partials: partials
        },
        envelope: {
            attack: 0.005,
            decay: 0.3,
            sustain: 0.4,
            release: 0.8
        }
    }).toDestination();
}

function setTensionTuning(enabled) {
    tensionTuning = enabled;
    if (!enabled && pianoSim) {
        pianoSim.setTension(baseTension);
    }
}
