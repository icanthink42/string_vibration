import numpy as np


class StringSimulation:
    def __init__(self, length=0.65, tension=100.0, linear_density=0.001,
                 damping=20.0, nx=300):
        self.L = length
        self.tension = tension
        self.linear_density = linear_density
        self.c = np.sqrt(tension / linear_density)
        self.damping = damping

        self.nx = nx
        self.dx = self.L / (self.nx - 1)
        self.dt = 0.4 * self.dx / self.c

        self.x = np.linspace(0, self.L, self.nx)
        self.u = np.zeros(self.nx)
        self.u_prev = np.zeros(self.nx)

        self.r = (self.c * self.dt / self.dx) ** 2
        self.t = 0

        self.forcing_x0 = 0.5 * self.L
        self.forcing_width = 0.03 * self.L
        self.forcing_amplitude = 30.0
        self.forcing_freq = self.fundamental

    @property
    def fundamental(self):
        return self.c / (2 * self.L)

    def harmonic(self, n):
        return n * self.fundamental

    def forcing_function(self):
        spatial = np.exp(-((self.x - self.forcing_x0) / self.forcing_width) ** 2)
        temporal = np.sin(2 * np.pi * self.forcing_freq * self.t)
        return self.forcing_amplitude * spatial * temporal

    def step(self):
        f = self.forcing_function()

        u_next = np.zeros(self.nx)
        u_next[1:-1] = (2 * (1 - self.r) * self.u[1:-1]
                        + self.r * (self.u[2:] + self.u[:-2])
                        - (1 - self.damping * self.dt) * self.u_prev[1:-1]
                        + self.dt**2 * f[1:-1] / self.linear_density)
        u_next[1:-1] /= (1 + self.damping * self.dt)

        self.u_prev = self.u.copy()
        self.u = u_next
        self.t += self.dt

    def step_n(self, n):
        for _ in range(n):
            self.step()

    def max_displacement(self):
        return np.max(np.abs(self.u))

    def reset(self):
        self.u = np.zeros(self.nx)
        self.u_prev = np.zeros(self.nx)
        self.t = 0
