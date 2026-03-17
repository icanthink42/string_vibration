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

const sim = new StringSimulation();
const numHarmonics = 6;
const maxFreq = (numHarmonics + 0.5) * sim.fundamental;

const visualizer = new StringVisualizer('stringCanvas', sim);

const freqSlider = document.getElementById('freqSlider');
const freqLabel = document.getElementById('freqLabel');
const sliderTrack = document.getElementById('sliderTrack');
const timescaleSlider = document.getElementById('timescaleSlider');
const timescaleLabel = document.getElementById('timescaleLabel');

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

function animate() {
    const steps = Math.max(1, Math.round(100 * timescale));
    sim.stepN(steps);
    visualizer.draw();
    requestAnimationFrame(animate);
}

animate();
