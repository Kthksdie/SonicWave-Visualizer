
import React, { useEffect, useRef } from 'react';

export type VisualizerMode = 'waveform' | 'bars' | 'radial' | 'particles';

interface WaveformVisualizerProps {
  source: MediaStream | HTMLAudioElement | HTMLVideoElement | null;
  sensitivity: number;
  mode: VisualizerMode;
}

// Global cache to prevent re-connecting MediaElements to new nodes (browser limitation)
const nodeCache = new Map<any, AudioNode>();
let globalAudioContext: AudioContext | null = null;

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ source, sensitivity, mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!source) return;

    if (!globalAudioContext) {
      globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const audioContext = globalAudioContext;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyserRef.current = analyser;
    
    let sourceNode: AudioNode;

    try {
      if (source instanceof MediaStream) {
        // MediaStream can be connected multiple times
        sourceNode = audioContext.createMediaStreamSource(source);
        sourceNode.connect(analyser);
      } else if (source instanceof HTMLAudioElement || source instanceof HTMLVideoElement) {
        // MediaElements can only be connected ONCE. Check cache.
        if (nodeCache.has(source)) {
          sourceNode = nodeCache.get(source)!;
        } else {
          sourceNode = audioContext.createMediaElementSource(source);
          nodeCache.set(source, sourceNode);
        }
        sourceNode.connect(analyser);
        analyser.connect(audioContext.destination);
      }
    } catch (err) {
      console.warn("WaveformVisualizer: WebAudio connection error", err);
    }
    
    const bufferLength = analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      
      // Ensure AudioContext is running (browsers often suspend them)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      const width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
      const height = canvas.height = canvas.clientHeight * window.devicePixelRatio;
      const centerY = height / 2;
      const centerX = width / 2;

      // 1. Base Background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      // 2. Video Background
      if (source instanceof HTMLVideoElement && source.readyState >= 2) {
        const vW = source.videoWidth;
        const vH = source.videoHeight;
        const vAspect = vW / vH;
        const cAspect = width / height;

        let sx, sy, sW, sH;
        if (vAspect > cAspect) {
          sH = vH;
          sW = vH * cAspect;
          sx = (vW - sW) / 2;
          sy = 0;
        } else {
          sW = vW;
          sH = vW / cAspect;
          sx = 0;
          sy = (vH - sH) / 2;
        }

        ctx.drawImage(source, sx, sy, sW, sH, 0, 0, width, height);
        ctx.fillStyle = 'rgba(2, 6, 23, 0.45)'; // Darken video for visualization contrast
        ctx.fillRect(0, 0, width, height);
      }
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 3. Render Mode
      if (mode === 'waveform') {
        ctx.lineWidth = 3;
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0)');
        gradient.addColorStop(0.5, 'rgba(99, 102, 241, 1)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        
        ctx.strokeStyle = gradient;
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';

        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = centerY + (v - 1) * sensitivity * (height / 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

      } else if (mode === 'bars') {
        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (freqData[i] / 255) * height * 0.8 * sensitivity;
          ctx.fillStyle = `rgba(99, 102, 241, ${0.2 + (freqData[i] / 255) * 0.8})`;
          ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
          ctx.fillStyle = '#818cf8';
          ctx.fillRect(x, height - barHeight - 4, barWidth - 2, 2);
          x += barWidth + 1;
        }
      } else if (mode === 'radial') {
        const radius = Math.min(width, height) / 4;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#6366f1';
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(99, 102, 241, 0.6)';

        ctx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
          const amplitude = (freqData[i] / 255.0) * 120 * sensitivity;
          const angle = (i / bufferLength) * Math.PI * 2;
          const x = centerX + Math.cos(angle) * (radius + amplitude);
          const y = centerY + Math.sin(angle) * (radius + amplitude);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (mode === 'particles') {
        const count = 48;
        const step = Math.floor(bufferLength / count);
        for (let i = 0; i < count; i++) {
          const index = i * step;
          const val = freqData[index] / 255.0;
          const size = val * 80 * sensitivity;
          const alpha = 0.2 + val * 0.8;
          ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`;
          const angle = (i / count) * Math.PI * 2;
          const dist = (height / 3.5) + (timeData[index] / 255) * 30;
          const x = centerX + Math.cos(angle) * dist;
          const y = centerY + Math.sin(angle) * dist;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(2, size / 2), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      analyser.disconnect();
    };
  }, [source, sensitivity, mode]);

  return (
    <div className="w-full h-full relative">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block rounded-xl overflow-hidden"
      />
    </div>
  );
};
