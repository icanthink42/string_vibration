const pianoStringParams = {
    tension: 4.0,
    linearDensity: 0.01,
    damping: 5.0
};

const baseHarmonic = 17;
const baseAmplitude = 30;
const baseWidth = 0.03;

let pianoSim = null;
let pianoAudioEngine = null;
let noteHarmonics = {};

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

    pianoSim.forcingX0 = info.antinodePos * pianoSim.L;
    pianoSim.forcingFreq = info.actualFreq;
    pianoSim.forcingWidth = (baseWidth * baseHarmonic / info.harmonic) * pianoSim.L;
    pianoSim.forcingAmplitude = baseAmplitude * Math.pow(info.harmonic / baseHarmonic, 2);

    pianoLabel.textContent = `${note} (n=${info.harmonic}) - ${info.actualFreq.toFixed(1)} Hz`;
    key.classList.add('active');
}

function stopNote(key, pianoLabel) {
    key.classList.remove('active');
    if (pianoSim) {
        pianoSim.forcingFreq = 0;
        pianoLabel.textContent = 'Press a key';
    }
}

function initPianoMode(pianoKeys) {
    pianoSim = new StringSimulation(pianoStringParams);
    pianoSim.forcingFreq = 0;
    pianoAudioEngine = new AudioEngine(pianoSim);
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
