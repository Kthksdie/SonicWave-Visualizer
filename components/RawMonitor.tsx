
import React, { useEffect, useRef } from 'react';

interface RawMonitorProps {
  source: MediaStream | HTMLAudioElement | null;
}

export const RawMonitor: React.FC<RawMonitorProps> = ({ source }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!source) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    let audioSourceNode: AudioNode;

    if (source instanceof MediaStream) {
      audioSourceNode = audioContext.createMediaStreamSource(source);
      audioSourceNode.connect(analyser);
    } else if (source instanceof HTMLAudioElement) {
      // Note: We don't connect to destination here to avoid double audio, 
      // but we need to be careful with MediaElementSource limitations (only one source node per element).
      // However, since we are creating a separate context for the monitor, this might be tricky 
      // with a single HTMLAudioElement. For streams, it works fine.
      // To keep it simple and robust, we'll only monitor if it's a MediaStream or handle element carefully.
      try {
        audioSourceNode = audioContext.createMediaElementSource(source);
        audioSourceNode.connect(analyser);
        // Do NOT connect to destination, the main visualizer or audio element handles playback.
      } catch (e) {
        // Likely already has a source node from the main visualizer
        return;
      }
    } else {
      return;
    }

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    audioContextRef.current = audioContext;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#4ade80'; // Emerald 400 for oscilloscope look
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.stroke();
    };

    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [source]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Raw In</div>
      <div className="w-16 h-8 bg-slate-900/80 rounded border border-white/5 overflow-hidden flex items-center justify-center relative">
        {!source && <div className="absolute inset-0 flex items-center justify-center opacity-20"><div className="w-full h-[1px] bg-slate-500"></div></div>}
        <canvas ref={canvasRef} width={64} height={32} className="w-full h-full opacity-80" />
      </div>
    </div>
  );
};
