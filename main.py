import matplotlib.pyplot as plt
from matplotlib.widgets import Slider
from matplotlib.animation import FuncAnimation

from vibration import StringSimulation


sim = StringSimulation()

num_harmonics = 6
max_freq = (num_harmonics + 0.5) * sim.fundamental

fig = plt.figure(figsize=(12, 7))
ax = fig.add_axes([0.1, 0.35, 0.8, 0.55])

ax.set_xlim(0, sim.L)
ax.set_ylim(-0.005, 0.005)
ax.set_xlabel('Position (m)')
ax.set_ylabel('Displacement (m)')
ax.set_title('Vibrating String')
ax.axhline(y=0, color='gray', linestyle='--', alpha=0.5)
ax.axvline(x=sim.forcing_x0, color='red', linestyle=':', alpha=0.5, label='Forcing location')
ax.legend(loc='upper right')

line, = ax.plot(sim.x, sim.u, 'b-', lw=2)
freq_text = ax.text(0.02, 0.95, '', transform=ax.transAxes)

slider_ax = fig.add_axes([0.1, 0.15, 0.8, 0.04])
freq_slider = Slider(slider_ax, '', 0, max_freq, valinit=sim.fundamental, color='lightblue')

harmonic_ax = fig.add_axes([0.1, 0.08, 0.8, 0.05])
harmonic_ax.set_xlim(0, max_freq)
harmonic_ax.set_ylim(0, 1)
harmonic_ax.axis('off')

for n in range(1, num_harmonics + 1):
    freq = sim.harmonic(n)
    harmonic_ax.axvline(x=freq, color='red', linestyle='-', lw=2)
    harmonic_ax.text(freq, 0.5, f'  {n}', fontsize=11, color='red',
                     ha='left', va='center', fontweight='bold')

harmonic_ax.text(0, 0.5, 'Harmonics: ', fontsize=10, ha='right', va='center')

freq_label = fig.text(0.5, 0.22, f'Forcing Frequency: {sim.fundamental:.0f} Hz',
                      ha='center', fontsize=11)

max_displacement = 0.001


def update_freq(val):
    sim.forcing_freq = val
    freq_label.set_text(f'Forcing Frequency: {sim.forcing_freq:.0f} Hz')


freq_slider.on_changed(update_freq)


def animate(frame):
    global max_displacement

    sim.step_n(100)

    current_max = sim.max_displacement()
    if current_max > max_displacement:
        max_displacement = current_max
        ax.set_ylim(-1.5 * max_displacement, 1.5 * max_displacement)

    line.set_ydata(sim.u)
    freq_text.set_text(f'f₁ = {sim.fundamental:.1f} Hz')
    return line, freq_text


anim = FuncAnimation(fig, animate, interval=16, blit=False, cache_frame_data=False)

plt.show()
