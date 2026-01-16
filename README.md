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

## 🛡️ Permissions

This application requires:
- **Microphone Access**: Only used locally for real-time visualization. Audio data is never recorded or transmitted to any server.

---
*Created with ❤️ by a Senior Frontend Engineer.*
