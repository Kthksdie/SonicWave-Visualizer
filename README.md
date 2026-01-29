# SonicWave Visualizer

A high-performance, real-time audio visualization suite built with React, Web Audio API, and HTML5 Canvas. SonicWave transforms audio data into stunning visual patterns using both frequency and time-domain analysis.

## 🚀 Features

- **Dual Audio Sources**: Capture live audio from your microphone or stream directly from a URL (supports CORS-enabled audio links and `.m3u8` streams).
- **Multiple Rendering Modes**:
  - **Waveform**: Classic time-domain oscillation with glow effects.
  - **Spectrum**: Frequency-domain bar chart with peaks.
  - **Radial**: Circular frequency visualization.
  - **Pulse**: Dynamic particle-based amplitude representation.
- **Dynamic Gain Control**: Adjust sensitivity on the fly to match quiet or loud environments.
- **High Performance**: Optimized canvas rendering loop with hardware acceleration via `requestAnimationFrame`.
- **Responsive Design**: Fluid layout that adapts from mobile screens to desktop monitors.

## 🛠️ Tech Stack

- **Framework**: React 19
- **Icons**: Lucide React
- **Styling**: Tailwind CSS
- **Audio Processing**: Web Audio API (AnalyserNode)
- **Visualization**: HTML5 Canvas (2D Context)

## 📦 Installation

To run this project locally, ensure you have [Node.js](https://nodejs.org/) installed.

1.  **Clone the project files** into your local directory.
2.  **Install dependencies**:
    ```bash
    npm install
    ```

## 💻 Development

Start the development server:
```bash
npm run dev
```

## 🏗️ Build

Create a production-ready bundle:
```bash
npm run build
```

## 📖 Usage Instructions

1.  **Start Capture**: Click the "Start Capture" button to initialize the AudioContext.
2.  **Choose Source**:
    - **Microphone**: Default mode. Requires browser permission. Ideal for real-time room visualization.
    - **Stream URL**: Paste a link to an audio file or stream. Note: The server must support CORS (Cross-Origin Resource Sharing) for the visualizer to access the audio data.
3.  **Switch Modes**: Use the navigation bar at the top to toggle between different visualization algorithms.
4.  **Adjust Sensitivity**: Use the slider in the footer to scale the visualization intensity.

## 🔗 Configuration via URL

You can pre-configure and auto-start the visualizer using URL parameters. This is useful for sharing specific setups or integrating with other tools (like OBS).

| Parameter | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `url` | `string` | **Auto-starts** the visualizer with the specified audio/stream URL. | `?url=https://example.com/stream.m3u8` |
| `mic` | `boolean` | If `true`, **auto-starts** the visualizer using the microphone. | `?mic=true` |
| `mode` | `string` | Sets the initial visualization mode. Options: `waveform`, `bars`, `radial`, `particles`. | `?mode=radial` |
| `palette` | `string` | Sets the initial color palette. Options: `indigo`, `emerald`, `rose`, `amber`, `cyan`, `violet`. | `?palette=cyan` |
| `fullscreen` | `boolean` | If `true`, the app loads in fullscreen mode (ideal for OBS browser sources). | `?fullscreen=true` |
| `sensitivity` | `number` | Sets the initial audio sensitivity (0.1 - 5.0). | `?sensitivity=2.5` |

**Example Scenarios:**

- **Start with mic in radial mode:**
  `https://your-app.com/?mic=true&mode=radial`

- **Stream a URL in fullscreen (for OBS):**
  `https://your-app.com/?url=https://stream.url/audio.m3u8&fullscreen=true`

## 🛡️ Permissions

This application requires:
- **Microphone Access**: Only used locally for real-time visualization. Audio data is never recorded or transmitted to any server.

---
*Created with [Gemini](https://gemini.google.com) by [Kthksdie](https://x.com/jasonlee2122).*
