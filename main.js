const sim = new StringSimulation();
const numHarmonics = 6;
const maxFreq = (numHarmonics + 0.5) * sim.fundamental;

const visualizer = new StringVisualizer('stringCanvas', sim);
const audioEngine = new AudioEngine(sim);

const freqSlider = document.getElementById('freqSlider');
const freqLabel = document.getElementById('freqLabel');
const sliderTrack = document.getElementById('sliderTrack');
const timescaleSlider = document.getElementById('timescaleSlider');
const timescaleLabel = document.getElementById('timescaleLabel');
const soundToggle = document.getElementById('soundToggle');
const normalModeBtn = document.getElementById('normalMode');
const pianoModeBtn = document.getElementById('pianoMode');
const sliderContainer = document.querySelector('.slider-container');
const pianoContainer = document.getElementById('pianoContainer');
const pianoLabelEl = document.getElementById('pianoLabel');
const pianoKeys = document.querySelectorAll('.piano .key');

let timescale = 0.2;
let currentMode = 'normal';

timescaleSlider.value = -0.7;
freqSlider.max = Math.round(maxFreq);
freqSlider.value = Math.round(sim.fundamental);
freqLabel.textContent = `${Math.round(sim.fundamental)} Hz`;

for (let n = 1; n <= numHarmonics; n++) {
    const freq = sim.harmonic(n);
    const percent = (freq / maxFreq) * 100;

    const marker = document.createElement('div');
    marker.className = 'harmonic-marker';
    marker.style.left = `${percent}%`;
    marker.innerHTML = `<span>${n}</span>`;

    sliderTrack.appendChild(marker);
}

freqSlider.addEventListener('input', (e) => {
    const freq = parseFloat(e.target.value);
    sim.forcingFreq = freq;
    freqLabel.textContent = `${Math.round(freq)} Hz`;
});

timescaleSlider.addEventListener('input', (e) => {
    const logValue = parseFloat(e.target.value);
    timescale = Math.pow(10, logValue);
    if (timescale >= 0.1) {
        timescaleLabel.textContent = `${timescale.toFixed(1)}x`;
    } else if (timescale >= 0.01) {
        timescaleLabel.textContent = `${timescale.toFixed(2)}x`;
    } else {
        timescaleLabel.textContent = `${timescale.toFixed(3)}x`;
    }
});

soundToggle.addEventListener('click', () => {
    let isPlaying;
    if (currentMode === 'piano' && pianoAudioEngine) {
        isPlaying = pianoAudioEngine.toggle();
    } else {
        isPlaying = audioEngine.toggle();
    }
    soundToggle.textContent = isPlaying ? 'Sound On' : 'Sound Off';
    soundToggle.classList.toggle('active', isPlaying);

    if (isPlaying) {
        timescaleSlider.style.display = 'none';
        timescaleLabel.textContent = '1.0x';
    } else {
        timescaleSlider.style.display = '';
        if (timescale >= 0.1) {
            timescaleLabel.textContent = `${timescale.toFixed(1)}x`;
        } else if (timescale >= 0.01) {
            timescaleLabel.textContent = `${timescale.toFixed(2)}x`;
        } else {
            timescaleLabel.textContent = `${timescale.toFixed(3)}x`;
        }
    }
});

function setMode(mode) {
    currentMode = mode;

    if (audioEngine.isPlaying) {
        audioEngine.toggle();
        soundToggle.textContent = 'Sound Off';
        soundToggle.classList.remove('active');
    }
    if (pianoAudioEngine && pianoAudioEngine.isPlaying) {
        pianoAudioEngine.toggle();
        soundToggle.textContent = 'Sound Off';
        soundToggle.classList.remove('active');
    }

    if (mode === 'normal') {
        normalModeBtn.classList.add('active');
        pianoModeBtn.classList.remove('active');
        sliderContainer.style.display = '';
        pianoContainer.style.display = 'none';
        visualizer.setSimulation(sim);
    } else {
        normalModeBtn.classList.remove('active');
        pianoModeBtn.classList.add('active');
        sliderContainer.style.display = 'none';
        pianoContainer.style.display = 'flex';

        if (!pianoSim) {
            initPianoMode(pianoKeys);
        }

        visualizer.setSimulation(pianoSim);
    }
}

normalModeBtn.addEventListener('click', () => setMode('normal'));
pianoModeBtn.addEventListener('click', () => setMode('piano'));

pianoKeys.forEach(key => {
    key.addEventListener('mousedown', () => playNote(key, pianoLabelEl));
    key.addEventListener('mouseup', () => stopNote(key, pianoLabelEl));
    key.addEventListener('mouseleave', () => stopNote(key, pianoLabelEl));

    key.addEventListener('touchstart', (e) => {
        e.preventDefault();
        playNote(key, pianoLabelEl);
    });
    key.addEventListener('touchend', () => stopNote(key, pianoLabelEl));
});

const keyMap = {};
pianoKeys.forEach(key => {
    keyMap[key.dataset.key] = key;
});

document.addEventListener('keydown', (e) => {
    if (currentMode !== 'piano') return;
    const key = keyMap[e.key.toLowerCase()];
    if (key && !e.repeat) {
        playNote(key, pianoLabelEl);
    }
});

document.addEventListener('keyup', (e) => {
    if (currentMode !== 'piano') return;
    const key = keyMap[e.key.toLowerCase()];
    if (key) {
        stopNote(key, pianoLabelEl);
    }
});

function animate() {
    const currentSim = (currentMode === 'piano' && pianoSim) ? pianoSim : sim;
    const currentAudio = (currentMode === 'piano' && pianoAudioEngine) ? pianoAudioEngine : audioEngine;

    if (!currentAudio.isPlaying) {
        const steps = Math.max(1, Math.round(100 * timescale));
        currentSim.stepN(steps);
    }
    visualizer.draw();
    requestAnimationFrame(animate);
}

animate();
