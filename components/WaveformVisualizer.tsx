
import React, { useEffect, useRef } from 'react';

export type VisualizerMode = 'waveform' | 'bars' | 'radial' | 'particles';
export type ColorPalette = 'indigo' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet';

interface WaveformVisualizerProps {
  source: MediaStream | HTMLAudioElement | HTMLVideoElement | null;
  sensitivity: number;
  mode: VisualizerMode;
  palette: ColorPalette;
}

// Global state to ensure we only ever have one context and source node per element
const audioState = {
  context: null as AudioContext | null,
  sourceNodes: new Map<any, AudioNode>(),
};

const PALETTE_COLORS: Record<ColorPalette, { primary: string; secondary: string; glow: string; rgba: (a: number) => string }> = {
  indigo: { primary: '#6366f1', secondary: '#818cf8', glow: 'rgba(99, 102, 241, 0.5)', rgba: (a) => `rgba(99, 102, 241, ${a})` },
  emerald: { primary: '#10b981', secondary: '#34d399', glow: 'rgba(16, 185, 129, 0.5)', rgba: (a) => `rgba(16, 185, 129, ${a})` },
  rose: { primary: '#f43f5e', secondary: '#fb7185', glow: 'rgba(244, 63, 94, 0.5)', rgba: (a) => `rgba(244, 63, 94, ${a})` },
  amber: { primary: '#f59e0b', secondary: '#fbbf24', glow: 'rgba(245, 158, 11, 0.5)', rgba: (a) => `rgba(245, 158, 11, ${a})` },
  cyan: { primary: '#06b6d4', secondary: '#22d3ee', glow: 'rgba(6, 182, 212, 0.5)', rgba: (a) => `rgba(6, 182, 212, ${a})` },
  violet: { primary: '#8b5cf6', secondary: '#a78bfa', glow: 'rgba(139, 92, 246, 0.5)', rgba: (a) => `rgba(139, 92, 246, ${a})` },
};

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ source, sensitivity, mode, palette }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!source) return;

    // Initialize AudioContext only once
    if (!audioState.context) {
      audioState.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const ctx_audio = audioState.context;
    const analyser = ctx_audio.createAnalyser();
    analyser.fftSize = 512;
    
    let sourceNode: AudioNode | null = null;

    try {
      if (source instanceof MediaStream) {
        // MediaStreamSourceNodes can be recreated safely
        sourceNode = ctx_audio.createMediaStreamSource(source);
      } else {
        // MediaElementSourceNodes MUST be cached/singleton per element
        if (audioState.sourceNodes.has(source)) {
          sourceNode = audioState.sourceNodes.get(source)!;
        } else {
          sourceNode = ctx_audio.createMediaElementSource(source);
          audioState.sourceNodes.set(source, sourceNode);
          // Only connect to destination ONCE for media elements to prevent volume issues/echo
          sourceNode.connect(ctx_audio.destination);
        }
      }
      
      if (sourceNode) {
        sourceNode.connect(analyser);
      }
    } catch (err) {
      console.warn("WaveformVisualizer: Connection failed", err);
      // Even if connection fails, we want to allow the cleanup logic to run
    }
    
    const bufferLength = analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx_canvas = canvas.getContext('2d', { alpha: false });
    if (!ctx_canvas) return;

    const colors = PALETTE_COLORS[palette];

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      
      if (ctx_audio.state === 'suspended') {
        ctx_audio.resume().catch(() => {});
      }

      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      const width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
      const height = canvas.height = canvas.clientHeight * window.devicePixelRatio;
      if (width === 0 || height === 0) return;

      const centerY = height / 2;
      const centerX = width / 2;

      ctx_canvas.fillStyle = '#020617';
      ctx_canvas.fillRect(0, 0, width, height);

      // Render video background if available
      if (source instanceof HTMLVideoElement && source.readyState >= 2) {
        const vW = source.videoWidth;
        const vH = source.videoHeight;
        const vAspect = vW / vH;
        const cAspect = width / height;

        let sx, sy, sW, sH;
        if (vAspect > cAspect) {
          sH = vH; sW = vH * cAspect;
          sx = (vW - sW) / 2; sy = 0;
        } else {
          sW = vW; sH = vW / cAspect;
          sx = 0; sy = (vH - sH) / 2;
        }

        ctx_canvas.drawImage(source, sx, sy, sW, sH, 0, 0, width, height);
        ctx_canvas.fillStyle = 'rgba(2, 6, 23, 0.45)';
        ctx_canvas.fillRect(0, 0, width, height);
      }
      
      ctx_canvas.lineCap = 'round';
      ctx_canvas.lineJoin = 'round';

      if (mode === 'waveform') {
        ctx_canvas.lineWidth = 3;
        const gradient = ctx_canvas.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, colors.rgba(0));
        gradient.addColorStop(0.5, colors.primary);
        gradient.addColorStop(1, colors.rgba(0));
        
        ctx_canvas.strokeStyle = gradient;
        ctx_canvas.shadowBlur = 15;
        ctx_canvas.shadowColor = colors.glow;

        ctx_canvas.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = centerY + (v - 1) * sensitivity * (height / 2);
          if (i === 0) ctx_canvas.moveTo(x, y);
          else ctx_canvas.lineTo(x, y);
          x += sliceWidth;
        }
        ctx_canvas.stroke();
        ctx_canvas.shadowBlur = 0;

      } else if (mode === 'bars') {
        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (freqData[i] / 255) * height * 0.8 * sensitivity;
          ctx_canvas.fillStyle = colors.rgba(0.2 + (freqData[i] / 255) * 0.8);
          ctx_canvas.fillRect(x, height - barHeight, barWidth - 2, barHeight);
          ctx_canvas.fillStyle = colors.secondary;
          ctx_canvas.fillRect(x, height - barHeight - 4, barWidth - 2, 2);
          x += barWidth + 1;
        }
      } else if (mode === 'radial') {
        const radius = Math.min(width, height) / 4;
        ctx_canvas.lineWidth = 2.5;
        ctx_canvas.strokeStyle = colors.primary;
        ctx_canvas.shadowBlur = 12;
        ctx_canvas.shadowColor = colors.glow;

        ctx_canvas.beginPath();
        for (let i = 0; i < bufferLength; i++) {
          const amplitude = (freqData[i] / 255.0) * 120 * sensitivity;
          const angle = (i / bufferLength) * Math.PI * 2;
          const x = centerX + Math.cos(angle) * (radius + amplitude);
          const y = centerY + Math.sin(angle) * (radius + amplitude);
          if (i === 0) ctx_canvas.moveTo(x, y);
          else ctx_canvas.lineTo(x, y);
        }
        ctx_canvas.closePath();
        ctx_canvas.stroke();
        ctx_canvas.shadowBlur = 0;
      } else if (mode === 'particles') {
        const count = 48;
        const step = Math.floor(bufferLength / count);
        for (let i = 0; i < count; i++) {
          const index = i * step;
          const val = freqData[index] / 255.0;
          const size = val * 80 * sensitivity;
          const alpha = 0.2 + val * 0.8;
          ctx_canvas.fillStyle = colors.rgba(alpha);
          const angle = (i / count) * Math.PI * 2;
          const dist = (height / 3.5) + (timeData[index] / 255) * 30;
          const x = centerX + Math.cos(angle) * dist;
          const y = centerY + Math.sin(angle) * dist;
          ctx_canvas.beginPath();
          ctx_canvas.arc(x, y, Math.max(2, size / 2), 0, Math.PI * 2);
          ctx_canvas.fill();
        }
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (sourceNode && analyser) {
        try {
          sourceNode.disconnect(analyser);
        } catch (e) {
          // Ignore disconnection errors
        }
      }
      analyser.disconnect();
    };
  }, [source, sensitivity, mode, palette]);

  return (
    <div className="w-full h-full relative">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block rounded-xl overflow-hidden"
      />
    </div>
  );
};
