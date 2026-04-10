class StringSimulation {
    constructor(options = {}) {
        this.L = options.length || 0.65;
        this.tension = options.tension || 100.0;
        this.linearDensity = options.linearDensity || 0.001;
        this.c = Math.sqrt(this.tension / this.linearDensity);
        this.damping = options.damping || 20.0;

        this.nx = options.nx || 300;
        this.dx = this.L / (this.nx - 1);
        this.dt = 0.4 * this.dx / this.c;

        this.x = new Float64Array(this.nx);
        for (let i = 0; i < this.nx; i++) {
            this.x[i] = (i / (this.nx - 1)) * this.L;
        }

        this.u = new Float64Array(this.nx);
        this.uPrev = new Float64Array(this.nx);

        this.r = Math.pow(this.c * this.dt / this.dx, 2);
        this.t = 0;

        this.forcingX0 = 0.5 * this.L;
        this.forcingWidth = 0.03 * this.L;
        this.forcingAmplitude = 30.0;
        this.forcingFreq = this.fundamental;
    }

    get fundamental() {
        return this.c / (2 * this.L);
    }

    harmonic(n) {
        return n * this.fundamental;
    }

    forcingFunction() {
        const f = new Float64Array(this.nx);
        const temporal = Math.sin(2 * Math.PI * this.forcingFreq * this.t);

        for (let i = 0; i < this.nx; i++) {
            const spatial = Math.exp(-Math.pow((this.x[i] - this.forcingX0) / this.forcingWidth, 2));
            f[i] = this.forcingAmplitude * spatial * temporal;
        }

        return f;
    }

    step() {
        const f = this.forcingFunction();
        const uNext = new Float64Array(this.nx);

        for (let i = 1; i < this.nx - 1; i++) {
            uNext[i] = (2 * (1 - this.r) * this.u[i]
                + this.r * (this.u[i + 1] + this.u[i - 1])
                - (1 - this.damping * this.dt) * this.uPrev[i]
                + this.dt * this.dt * f[i] / this.linearDensity)
                / (1 + this.damping * this.dt);
        }

        this.uPrev.set(this.u);
        this.u.set(uNext);
        this.t += this.dt;
    }

    stepN(n) {
        for (let i = 0; i < n; i++) {
            this.step();
        }
    }

    maxDisplacement() {
        let max = 0;
        for (let i = 0; i < this.nx; i++) {
            const abs = Math.abs(this.u[i]);
            if (abs > max) max = abs;
        }
        return max;
    }
}

class StringVisualizer {
    constructor(canvasId, simulation) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.sim = simulation;
        this.maxDisplacement = 0.001;
        this.isDragging = false;
        this.padding = 60;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
        this.canvas.addEventListener('mouseup', () => this.onPointerUp());
        this.canvas.addEventListener('mouseleave', () => this.onPointerUp());

        this.canvas.addEventListener('touchstart', (e) => this.onPointerDown(e.touches[0]));
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.onPointerMove(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', () => this.onPointerUp());
    }

    setSimulation(simulation) {
        this.sim = simulation;
        this.maxDisplacement = 0.001;  // Reset scale for new simulation
    }

    onPointerDown(e) {
        this.isDragging = true;
        this.updateForcingPosition(e);
    }

    onPointerMove(e) {
        if (this.isDragging) {
            this.updateForcingPosition(e);
        }
    }

    onPointerUp() {
        this.isDragging = false;
    }

    updateForcingPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const plotWidth = this.width - this.padding * 2;
        const normalizedX = (x - this.padding) / plotWidth;
        const clampedX = Math.max(0.05, Math.min(0.95, normalizedX));
        this.sim.forcingX0 = clampedX * this.sim.L;
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;

        this.ctx.scale(dpr, dpr);

        this.width = window.innerWidth;
        this.height = window.innerHeight;
    }

    draw() {
        const ctx = this.ctx;

        ctx.clearRect(0, 0, this.width, this.height);

        const currentMax = this.sim.maxDisplacement();
        if (currentMax > this.maxDisplacement) {
            this.maxDisplacement = currentMax;
        }

        const plotWidth = this.width - this.padding * 2;
        const yScale = (this.height * 0.3) / this.maxDisplacement;
        const xScale = plotWidth / this.sim.L;
        const yCenter = this.height / 2;

        // Build node/antinode positions for harmonics 1-6
        const markers = [];
        const ordinal = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];

        for (let n = 1; n <= 6; n++) {
            // Nodes at k/n (skip endpoints 0 and 1)
            for (let k = 1; k < n; k++) {
                markers.push({ pos: k / n, type: 'node', harmonic: n });
            }
            // Antinodes at (2k-1)/(2n)
            for (let k = 1; k <= n; k++) {
                markers.push({ pos: (2 * k - 1) / (2 * n), type: 'antinode', harmonic: n });
            }
        }

        const forcingNormalized = this.sim.forcingX0 / this.sim.L;
        const fadeDistance = 0.08;

        // Group markers by position (within tolerance)
        const groups = [];
        const tolerance = 0.001;

        for (const marker of markers) {
            const distance = Math.abs(forcingNormalized - marker.pos);
            const opacity = Math.max(0, 1 - distance / fadeDistance) * 0.6;
            if (opacity > 0.01) {
                // Find existing group at this position
                let group = groups.find(g => Math.abs(g.pos - marker.pos) < tolerance);
                if (!group) {
                    group = { pos: marker.pos, items: [], opacity, distance };
                    groups.push(group);
                }
                group.items.push({ type: marker.type, harmonic: marker.harmonic });
            }
        }

        // Sort groups by distance - closest first
        groups.sort((a, b) => a.distance - b.distance);

        // Track occupied text regions to prevent overlap
        const occupiedRegions = [];
        const textWidth = 120;

        for (const group of groups) {
            const x = this.padding + group.pos * this.sim.L * xScale;

            // Draw line for all visible groups
            ctx.strokeStyle = `rgba(255, 255, 255, ${group.opacity})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
            ctx.setLineDash([]);

            // Check if text would overlap with existing labels
            const textLeft = x - textWidth / 2;
            const textRight = x + textWidth / 2;
            const overlaps = occupiedRegions.some(r => !(textRight < r.left || textLeft > r.right));

            if (!overlaps) {
                // Mark this region as occupied
                occupiedRegions.push({ left: textLeft, right: textRight });

                // Draw stacked labels
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';

                let yOffset = 18;
                for (const item of group.items) {
                    const color = item.type === 'node' ? '100, 200, 255' : '255, 180, 100';
                    ctx.fillStyle = `rgba(${color}, ${group.opacity})`;
                    ctx.fillText(`${item.type} - ${ordinal[item.harmonic]}`, x, yOffset);
                    yOffset += 14;
                }
            }
        }

        // Draw forcing position indicator
        const forcingX = this.padding + this.sim.forcingX0 * xScale;
        const forcingIdx = Math.floor((this.sim.forcingX0 / this.sim.L) * (this.sim.nx - 1));
        const forcingY = yCenter - this.sim.u[forcingIdx] * yScale;

        ctx.strokeStyle = 'rgba(233, 69, 96, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(forcingX, 0);
        ctx.lineTo(forcingX, this.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw string
        ctx.strokeStyle = '#4da8da';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        for (let i = 0; i < this.sim.nx; i++) {
            const x = this.padding + this.sim.x[i] * xScale;
            const y = yCenter - this.sim.u[i] * yScale;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();

        // Draw fixed endpoints
        ctx.fillStyle = '#4da8da';
        ctx.beginPath();
        ctx.arc(this.padding, yCenter - this.sim.u[0] * yScale, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.padding + plotWidth, yCenter - this.sim.u[this.sim.nx - 1] * yScale, 6, 0, Math.PI * 2);
        ctx.fill();

        // Draw forcing point
        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.arc(forcingX, forcingY, this.isDragging ? 10 : 8, 0, Math.PI * 2);
        ctx.fill();
    }
}

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

            // Integrate over the whole string (trapezoidal rule)
            let sum = 0;
            for (let j = 1; j < nx - 1; j++) {
                sum += this.sim.u[j];
            }
            // Add half of endpoints (they're always 0 for fixed boundary, but for correctness)
            sum += 0.5 * (this.sim.u[0] + this.sim.u[nx - 1]);

            // Normalize by number of points and scale for audio
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

let timescale = 0.2;
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

    // Hide timescale slider when sound is on (runs at 1.0x for audio)
    if (isPlaying) {
        timescaleSlider.style.display = 'none';
        timescaleLabel.textContent = '1.0x';
    } else {
        timescaleSlider.style.display = '';
        // Restore the label to match current slider value
        if (timescale >= 0.1) {
            timescaleLabel.textContent = `${timescale.toFixed(1)}x`;
        } else if (timescale >= 0.01) {
            timescaleLabel.textContent = `${timescale.toFixed(2)}x`;
        } else {
            timescaleLabel.textContent = `${timescale.toFixed(3)}x`;
        }
    }
});

// Mode switching
const normalModeBtn = document.getElementById('normalMode');
const pianoModeBtn = document.getElementById('pianoMode');
const sliderContainer = document.querySelector('.slider-container');
const pianoContainer = document.getElementById('pianoContainer');
const pianoLabel = document.getElementById('pianoLabel');
const pianoKeys = document.querySelectorAll('.piano .key');

let currentMode = 'normal';

// Piano mode uses a lower fundamental so harmonics can map to notes
// With tension=4, density=0.01: c=20 m/s, f1 = 20/(2*0.65) ≈ 15.38 Hz
const pianoStringParams = {
    tension: 4.0,
    linearDensity: 0.01,
    damping: 5.0  // Lower damping so harmonics ring longer
};

// Piano simulation instance (created when entering piano mode)
let pianoSim = null;
let pianoAudioEngine = null;

// Calculate frequency for a note using equal temperament (A4 = 440 Hz)
function noteToFrequency(note) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = note.match(/^([A-G]#?)(\d)$/);
    if (!match) return 440;

    const [, name, octaveStr] = match;
    const octave = parseInt(octaveStr);
    const semitone = noteNames.indexOf(name);

    // A4 is the 49th key on a piano (if C0 is key 1)
    // Semitones from A4 = (octave - 4) * 12 + (semitone - 9)
    const semitonesFromA4 = (octave - 4) * 12 + (semitone - 9);

    return 440 * Math.pow(2, semitonesFromA4 / 12);
}

// Calculate which harmonic best matches each note frequency
function calculateNoteHarmonics(fundamental) {
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
            // Antinode position: first antinode at L/(2n), normalized to 0-1
            antinodePos: 1 / (2 * n)
        };
    });

    return harmonics;
}

let noteHarmonics = {};

function setMode(mode) {
    currentMode = mode;

    // Stop any playing audio
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

        // Create piano simulation if needed
        if (!pianoSim) {
            pianoSim = new StringSimulation(pianoStringParams);
            pianoSim.forcingFreq = 0;  // Start silent until a key is pressed
            pianoAudioEngine = new AudioEngine(pianoSim);
            noteHarmonics = calculateNoteHarmonics(pianoSim.fundamental);

            // Update piano key data attributes with actual harmonic info
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

        visualizer.setSimulation(pianoSim);
    }
}

normalModeBtn.addEventListener('click', () => setMode('normal'));
pianoModeBtn.addEventListener('click', () => setMode('piano'));

// Base harmonic for scaling (C4 uses ~17th harmonic)
const baseHarmonic = 17;
const baseAmplitude = 30;
const baseWidth = 0.03;  // Base forcing width as fraction of L

// Piano key handling - now uses harmonics!
function playNote(key) {
    const note = key.dataset.note;
    const info = noteHarmonics[note];

    if (!info || !pianoSim) return;

    // Set forcing position to antinode of this harmonic
    pianoSim.forcingX0 = info.antinodePos * pianoSim.L;

    // Set forcing frequency to the harmonic frequency
    pianoSim.forcingFreq = info.actualFreq;

    pianoSim.forcingWidth = (baseWidth * baseHarmonic / info.harmonic) * pianoSim.L;
    pianoSim.forcingAmplitude = baseAmplitude * Math.pow(info.harmonic / baseHarmonic, 2);

    pianoLabel.textContent = `${note} (n=${info.harmonic}) - ${info.actualFreq.toFixed(1)} Hz`;
    key.classList.add('active');
}

function stopNote(key) {
    key.classList.remove('active');
    // Stop forcing when key is released
    if (pianoSim) {
        pianoSim.forcingFreq = 0;
        pianoLabel.textContent = 'Press a key';
    }
}

// Mouse/touch events for piano keys
pianoKeys.forEach(key => {
    key.addEventListener('mousedown', () => playNote(key));
    key.addEventListener('mouseup', () => stopNote(key));
    key.addEventListener('mouseleave', () => stopNote(key));

    key.addEventListener('touchstart', (e) => {
        e.preventDefault();
        playNote(key);
    });
    key.addEventListener('touchend', () => stopNote(key));
});

// Keyboard input for piano
const keyMap = {};
pianoKeys.forEach(key => {
    keyMap[key.dataset.key] = key;
});

document.addEventListener('keydown', (e) => {
    if (currentMode !== 'piano') return;
    const key = keyMap[e.key.toLowerCase()];
    if (key && !e.repeat) {
        playNote(key);
    }
});

document.addEventListener('keyup', (e) => {
    if (currentMode !== 'piano') return;
    const key = keyMap[e.key.toLowerCase()];
    if (key) {
        stopNote(key);
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
