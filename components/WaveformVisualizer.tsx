
import React, { useEffect, useRef } from 'react';

export type VisualizerMode = 'waveform' | 'bars' | 'radial' | 'particles';

interface WaveformVisualizerProps {
  source: MediaStream | HTMLAudioElement | null;
  sensitivity: number;
  mode: VisualizerMode;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ source, sensitivity, mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!source) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({});
    const analyser = audioContext.createAnalyser();
    
    let audioSourceNode: AudioNode;

    if (source instanceof MediaStream) {
      audioSourceNode = audioContext.createMediaStreamSource(source);
      audioSourceNode.connect(analyser);
    } else if (source instanceof HTMLAudioElement) {
      audioSourceNode = audioContext.createMediaElementSource(source);
      audioSourceNode.connect(analyser);
      analyser.connect(audioContext.destination);
    } else {
      return;
    }
    
    analyser.fftSize = 512;
    const bufferLength = analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);
    
    audioContextRef.current = audioContext;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      
      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      // Dynamically calculate dimensions based on client size and device pixel ratio for sharp rendering
      const width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
      const height = canvas.height = canvas.clientHeight * window.devicePixelRatio;
      const centerY = height / 2;
      const centerX = width / 2;

      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (mode === 'waveform') {
        ctx.lineWidth = 3;
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.1)');
        gradient.addColorStop(0.5, 'rgba(99, 102, 241, 1)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.1)');
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

        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = centerY - (v - 1) * sensitivity * (height / 4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();

      } else if (mode === 'bars') {
        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;
        ctx.shadowBlur = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (freqData[i] / 255) * height * 0.8 * sensitivity;
          const r = 99;
          const g = 102;
          const b = 241;
          
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.1 + (freqData[i] / 255)})`;
          ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
          
          ctx.fillStyle = '#818cf8';
          ctx.fillRect(x, height - barHeight - 4, barWidth - 2, 2);
          
          x += barWidth + 1;
        }
      } else if (mode === 'radial') {
        const radius = Math.min(width, height) / 4;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#6366f1';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(99, 102, 241, 0.4)';

        ctx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
          const amplitude = (freqData[i] / 255.0) * 100 * sensitivity;
          const angle = (i / bufferLength) * Math.PI * 2;
          const x = centerX + Math.cos(angle) * (radius + amplitude);
          const y = centerY + Math.sin(angle) * (radius + amplitude);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.shadowBlur = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const amplitude = (v - 1) * 50 * sensitivity;
          const angle = (i / bufferLength) * Math.PI * 2;
          const x = centerX + Math.cos(angle) * (radius * 0.6 + amplitude);
          const y = centerY + Math.sin(angle) * (radius * 0.6 + amplitude);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

      } else if (mode === 'particles') {
        const count = 32;
        const step = Math.floor(bufferLength / count);
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#6366f1';
        
        for (let i = 0; i < count; i++) {
          const index = i * step;
          const val = freqData[index] / 255.0;
          const size = val * 60 * sensitivity;
          const alpha = 0.1 + val * 0.9;
          
          ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`;
          const angle = (i / count) * Math.PI * 2;
          const dist = (height / 4) + (timeData[index] / 255) * 20;
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
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [source, sensitivity, mode]);

  return (
    <div className="w-full h-full relative group">
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-indigo-500/40 rounded-tl-xl transition-all group-hover:w-12 group-hover:h-12 pointer-events-none z-10"></div>
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-indigo-500/40 rounded-tr-xl transition-all group-hover:w-12 group-hover:h-12 pointer-events-none z-10"></div>
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-indigo-500/40 rounded-bl-xl transition-all group-hover:w-12 group-hover:h-12 pointer-events-none z-10"></div>
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-indigo-500/40 rounded-br-xl transition-all group-hover:w-12 group-hover:h-12 pointer-events-none z-10"></div>
      
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block rounded-xl overflow-hidden"
      />
    </div>
  );
};
