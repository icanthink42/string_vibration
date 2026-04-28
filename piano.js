const pianoStringParams = {
    tension: 4.0,
    linearDensity: 0.01,
    damping: 5.0
};

const baseHarmonic = 17;
const baseAmplitude = 30;
const baseWidth = 0.03;

let pianoAudioEngine = null;
let noteHarmonics = {};
let activeStrings = new Map(); // Map of note -> StringSimulation
let templateSim = null; // Template simulation for getting fundamental frequency

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

    if (!info || !templateSim) return;

    // Don't create duplicate string if note is already playing
    if (activeStrings.has(note)) return;

    // Create a new string simulation for this note
    const stringSim = new StringSimulation(pianoStringParams);
    stringSim.forcingX0 = info.antinodePos * stringSim.L;
    stringSim.forcingFreq = info.actualFreq;
    stringSim.forcingWidth = (baseWidth * baseHarmonic / info.harmonic) * stringSim.L;
    stringSim.forcingAmplitude = baseAmplitude * Math.pow(info.harmonic / baseHarmonic, 2);

    activeStrings.set(note, stringSim);

    updatePianoLabel(pianoLabel);
    key.classList.add('active');
}

function stopNote(key, pianoLabel) {
    const note = key.dataset.note;
    key.classList.remove('active');

    if (activeStrings.has(note)) {
        activeStrings.delete(note);
    }

    updatePianoLabel(pianoLabel);
}

function updatePianoLabel(pianoLabel) {
    const activeNotes = Array.from(activeStrings.keys());
    if (activeNotes.length === 0) {
        pianoLabel.textContent = 'Press a key';
    } else if (activeNotes.length === 1) {
        const note = activeNotes[0];
        const info = noteHarmonics[note];
        pianoLabel.textContent = `${note} (n=${info.harmonic}) - ${info.actualFreq.toFixed(1)} Hz`;
    } else {
        pianoLabel.textContent = activeNotes.join(' + ');
    }
}

function getActiveStrings() {
    return activeStrings;
}

function initPianoMode(pianoKeys) {
    templateSim = new StringSimulation(pianoStringParams);
    templateSim.forcingFreq = 0;
    pianoAudioEngine = new PianoAudioEngine();
    noteHarmonics = calculateNoteHarmonics(templateSim.fundamental, pianoKeys);

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
