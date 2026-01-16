
import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../audioEngine';

interface RawMonitorProps {
  source: MediaStream | HTMLAudioElement | HTMLVideoElement | null;
}

export const RawMonitor: React.FC<RawMonitorProps> = ({ source }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!source) return;

    const ctx_audio = audioEngine.getContext();
    const analyser = ctx_audio.createAnalyser();
    let audioSourceNode: AudioNode;

    try {
      audioSourceNode = audioEngine.getOrCreateSourceNode(source);
      audioSourceNode.connect(analyser);
    } catch (e) {
      console.warn('RawMonitor: Source connection failed', e);
      return;
    }

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx_canvas = canvas.getContext('2d');
    if (!ctx_canvas) return;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      ctx_canvas.clearRect(0, 0, width, height);
      ctx_canvas.lineWidth = 1.5;
      ctx_canvas.strokeStyle = '#4ade80'; // Emerald 400
      ctx_canvas.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) ctx_canvas.moveTo(x, y);
        else ctx_canvas.lineTo(x, y);
        x += sliceWidth;
      }

      ctx_canvas.stroke();
    };

    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioSourceNode && analyser) {
        try {
          audioSourceNode.disconnect(analyser);
        } catch(e) { /* ignore */ }
      }
      analyser.disconnect();
    };
  }, [source]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Raw In</div>
      <div className="w-16 h-8 bg-slate-900/80 border border-white/5 overflow-hidden flex items-center justify-center relative rounded-none">
        {!source && <div className="absolute inset-0 flex items-center justify-center opacity-20"><div className="w-full h-[1px] bg-slate-500"></div></div>}
        <canvas ref={canvasRef} width={64} height={32} className="w-full h-full opacity-80" />
      </div>
    </div>
  );
};
