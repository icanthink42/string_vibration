class StringVisualizer {
    constructor(canvasId, simulation) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.sim = simulation;
        this.multiSimMode = false;
        this.getActiveStrings = null;
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
        this.multiSimMode = false;
        this.getActiveStrings = null;
        this.maxDisplacement = 0.001;
    }

    setMultiSimMode(getActiveStringsFn) {
        this.multiSimMode = true;
        this.getActiveStrings = getActiveStringsFn;
        this.maxDisplacement = 0.001;
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

        // Multi-sim mode: draw each string separately in a vertical stack
        if (this.multiSimMode && this.getActiveStrings) {
            const strings = this.getActiveStrings();
            if (strings.size === 0) {
                return; // Don't draw anything if no strings are active
            }

            this.drawMultipleStrings(ctx, strings);
            return;
        }

        // Single sim mode (normal mode)
        this.drawSingleString(ctx);
    }

    drawMultipleStrings(ctx, strings) {
        const stringArray = Array.from(strings.entries());
        const numStrings = stringArray.length;
        const plotWidth = this.width - this.padding * 2;

        // Calculate vertical spacing
        const totalHeight = this.height - 200; // Leave room for UI
        const stringHeight = Math.min(150, totalHeight / numStrings);
        const startY = (this.height - (numStrings * stringHeight)) / 2;

        // Update max displacement across all strings
        for (const [note, sim] of stringArray) {
            const currentMax = sim.maxDisplacement();
            if (currentMax > this.maxDisplacement) {
                this.maxDisplacement = currentMax;
            }
        }

        const yScale = (stringHeight * 0.4) / this.maxDisplacement;

        // Draw each string
        stringArray.forEach(([note, sim], index) => {
            const yCenter = startY + (index + 0.5) * stringHeight;
            const xScale = plotWidth / sim.L;

            // Draw note label
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#888';
            ctx.textAlign = 'left';
            ctx.fillText(note, 10, yCenter + 5);

            // Draw the string
            ctx.strokeStyle = '#4da8da';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            for (let i = 0; i < sim.nx; i++) {
                const x = this.padding + sim.x[i] * xScale;
                const y = yCenter - sim.u[i] * yScale;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();

            // Draw end points
            ctx.fillStyle = '#4da8da';
            ctx.beginPath();
            ctx.arc(this.padding, yCenter - sim.u[0] * yScale, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.padding + plotWidth, yCenter - sim.u[sim.nx - 1] * yScale, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawSingleString(ctx) {
        const currentMax = this.sim.maxDisplacement();
        if (currentMax > this.maxDisplacement) {
            this.maxDisplacement = currentMax;
        }

        const plotWidth = this.width - this.padding * 2;
        const yScale = (this.height * 0.3) / this.maxDisplacement;
        const xScale = plotWidth / this.sim.L;
        const yCenter = this.height / 2;

        const markers = [];
        const ordinal = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];

        for (let n = 1; n <= 6; n++) {
            for (let k = 1; k < n; k++) {
                markers.push({ pos: k / n, type: 'node', harmonic: n });
            }
            for (let k = 1; k <= n; k++) {
                markers.push({ pos: (2 * k - 1) / (2 * n), type: 'antinode', harmonic: n });
            }
        }

        const forcingNormalized = this.sim.forcingX0 / this.sim.L;
        const fadeDistance = 0.08;

        const groups = [];
        const tolerance = 0.001;

        for (const marker of markers) {
            const distance = Math.abs(forcingNormalized - marker.pos);
            const opacity = Math.max(0, 1 - distance / fadeDistance) * 0.6;
            if (opacity > 0.01) {
                let group = groups.find(g => Math.abs(g.pos - marker.pos) < tolerance);
                if (!group) {
                    group = { pos: marker.pos, items: [], opacity, distance };
                    groups.push(group);
                }
                group.items.push({ type: marker.type, harmonic: marker.harmonic });
            }
        }

        groups.sort((a, b) => a.distance - b.distance);

        const occupiedRegions = [];
        const textWidth = 120;

        for (const group of groups) {
            const x = this.padding + group.pos * this.sim.L * xScale;

            ctx.strokeStyle = `rgba(255, 255, 255, ${group.opacity})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
            ctx.setLineDash([]);

            const textLeft = x - textWidth / 2;
            const textRight = x + textWidth / 2;
            const overlaps = occupiedRegions.some(r => !(textRight < r.left || textLeft > r.right));

            if (!overlaps) {
                occupiedRegions.push({ left: textLeft, right: textRight });

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

        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.arc(forcingX, forcingY, this.isDragging ? 10 : 8, 0, Math.PI * 2);
        ctx.fill();

        // Draw the string
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

        // Draw end points
        ctx.fillStyle = '#4da8da';
        ctx.beginPath();
        ctx.arc(this.padding, yCenter - this.sim.u[0] * yScale, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.padding + plotWidth, yCenter - this.sim.u[this.sim.nx - 1] * yScale, 6, 0, Math.PI * 2);
        ctx.fill();
    }
}
