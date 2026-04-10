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
