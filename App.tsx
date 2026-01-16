
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { WaveformVisualizer, VisualizerMode } from './components/WaveformVisualizer';
import { RawMonitor } from './components/RawMonitor';
import { 
  Mic, 
  MicOff, 
  Settings, 
  Activity, 
  BarChart3, 
  Waves, 
  CircleDot, 
  Zap, 
  Globe, 
  Play, 
  Square, 
  Loader2, 
  Maximize, 
  Minimize 
} from 'lucide-react';
import Hls from 'hls.js';

type SourceType = 'mic' | 'url';

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>('mic');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState(1.0);
  const [mode, setMode] = useState<VisualizerMode>('waveform');
  
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronize fullscreen state with browser events (e.g. Esc key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = "";
      // Remove listeners
      audioElementRef.current.onwaiting = null;
      audioElementRef.current.onplaying = null;
      audioElementRef.current.onstalled = null;
    }
    setIsActive(false);
    setIsLoading(false);
    setIsBuffering(false);
  }, [stream]);

  const setupAudioListeners = (audio: HTMLAudioElement) => {
    audio.onwaiting = () => setIsBuffering(true);
    audio.onplaying = () => setIsBuffering(false);
    audio.onstalled = () => setIsBuffering(true);
    audio.oncanplay = () => setIsBuffering(false);
  };

  const startAudio = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    
    if (sourceType === 'mic') {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        setStream(audioStream);
        setIsActive(true);
        setIsLoading(false);
      } catch (err) {
        setError('Microphone access denied or not available.');
        setIsLoading(false);
        console.error('Error accessing microphone:', err);
      }
    } else {
      if (!streamUrl) {
        setError('Please enter a valid stream URL.');
        setIsLoading(false);
        return;
      }

      const audio = audioElementRef.current;
      if (!audio) {
        setIsLoading(false);
        return;
      }

      setupAudioListeners(audio);
      const isHls = streamUrl.toLowerCase().includes('.m3u8');

      if (isHls && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(audio);
        hlsRef.current = hls;
        
        hls.on(Hls.Events.MANIFEST_PARSED, async () => {
          try {
            audio.crossOrigin = "anonymous";
            await audio.play();
            setIsActive(true);
            setIsLoading(false);
          } catch (e) {
            setError('Playback blocked. Click start again.');
            setIsLoading(false);
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setError(`Stream error: ${data.type}`);
            stopAudio();
          }
        });
      } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        audio.src = streamUrl;
        audio.crossOrigin = "anonymous";
        audio.addEventListener('loadedmetadata', async () => {
          try {
            await audio.play();
            setIsActive(true);
            setIsLoading(false);
          } catch (e) {
            setError('Playback blocked by browser.');
            setIsLoading(false);
          }
        }, { once: true });
      } else {
        // Regular audio URL
        try {
          audio.src = streamUrl;
          audio.crossOrigin = "anonymous";
          await audio.play();
          setIsActive(true);
          setIsLoading(false);
        } catch (err) {
          setError('Format not supported or CORS error. Ensure the URL is valid.');
          setIsLoading(false);
          console.error('Error playing stream:', err);
        }
      }
    }
  }, [sourceType, streamUrl, stopAudio]);

  const toggleAudio = () => {
    if (isActive || isLoading) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  const modes: { id: VisualizerMode; icon: React.ReactNode; label: string }[] = [
    { id: 'waveform', icon: <Waves className="w-4 h-4" />, label: 'Waveform' },
    { id: 'bars', icon: <BarChart3 className="w-4 h-4" />, label: 'Spectrum' },
    { id: 'radial', icon: <CircleDot className="w-4 h-4" />, label: 'Radial' },
    { id: 'particles', icon: <Zap className="w-4 h-4" />, label: 'Pulse' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-between p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      <audio ref={audioElementRef} className="hidden" />

      <header className={`w-full max-w-6xl flex justify-between items-center z-10 transition-opacity duration-300 ${isFullscreen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              SonicWave
            </h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Real-time Audio Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4">
            {isActive && (
              <div className="px-3 border-r border-white/10">
                <RawMonitor source={sourceType === 'mic' ? stream : null} />
              </div>
            )}
            
            <div className="bg-slate-900/50 p-1 rounded-xl border border-white/5">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    mode === m.id 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl flex flex-col items-center justify-center relative py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent pointer-events-none"></div>
        
        {isActive ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-8 relative">
            <div 
              ref={containerRef}
              className={`relative flex justify-center transition-all duration-500 rounded-xl overflow-hidden bg-slate-950 ${isFullscreen ? 'fixed inset-0 z-[100] w-screen h-screen' : 'w-full max-w-4xl h-64 md:h-96 shadow-2xl border border-white/5'}`}
            >
              <WaveformVisualizer 
                source={sourceType === 'mic' ? stream : audioElementRef.current} 
                sensitivity={sensitivity} 
                mode={mode} 
              />
              
              {/* Fullscreen Toggle Overlay */}
              <button
                onClick={toggleFullscreen}
                className="absolute top-6 right-6 p-3 bg-slate-900/40 hover:bg-indigo-600/60 backdrop-blur-md border border-white/10 rounded-full text-white/70 hover:text-white transition-all shadow-xl z-[110] group"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5 group-hover:scale-110 transition-transform" />
                ) : (
                  <Maximize className="w-5 h-5 group-hover:scale-110 transition-transform" />
                )}
              </button>

              {/* Buffering Indicator */}
              {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] rounded-xl transition-all duration-300 z-[105]">
                  <div className="flex flex-col items-center gap-3 bg-slate-900/80 px-6 py-4 rounded-2xl border border-white/10 shadow-2xl">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest animate-pulse">Buffering</span>
                  </div>
                </div>
              )}
            </div>
            
            {!isFullscreen && (
              <div className="flex flex-col items-center gap-2 animate-pulse">
                <span className="text-indigo-400 text-sm font-semibold tracking-wider uppercase">
                  {sourceType === 'mic' ? 'Microphone Active' : 'Streaming Active'}
                </span>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400/60 rounded-full"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-400/30 rounded-full"></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-8 max-w-xl px-4 z-10">
            <div className="mx-auto w-24 h-24 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 shadow-2xl relative">
              {isLoading ? (
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
              ) : (
                sourceType === 'mic' ? <MicOff className="w-10 h-10 text-slate-600" /> : <Globe className="w-10 h-10 text-slate-600" />
              )}
            </div>
            
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white tracking-tight">Select Audio Source</h2>
              <div className="flex justify-center gap-4">
                <button 
                  disabled={isLoading}
                  onClick={() => { setSourceType('mic'); setError(null); }}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl border transition-all ${sourceType === 'mic' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 disabled:opacity-50'}`}
                >
                  <Mic className="w-4 h-4" /> Microphone
                </button>
                <button 
                  disabled={isLoading}
                  onClick={() => { setSourceType('url'); setError(null); }}
                  className={`flex items-center gap-2 px-6 py-2 rounded-xl border transition-all ${sourceType === 'url' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 disabled:opacity-50'}`}
                >
                  <Globe className="w-4 h-4" /> Stream URL
                </button>
              </div>
            </div>

            {sourceType === 'url' && (
              <div className="relative max-w-md mx-auto">
                <input 
                  type="text" 
                  disabled={isLoading}
                  placeholder="Enter .m3u8 or audio URL..."
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all pr-12 disabled:opacity-50"
                />
                <Globe className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
              </div>
            )}

            <p className="text-slate-400 leading-relaxed max-w-sm mx-auto">
              Transform your {sourceType === 'mic' ? 'surroundings' : 'favorite stream'} into stunning real-time visualizations.
            </p>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm max-w-md mx-auto">
                {error}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className={`w-full max-w-xl bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl z-20 mb-4 transition-all duration-300 ${isFullscreen ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 w-full space-y-2">
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span>Dynamic Gain</span>
              <span>{(sensitivity * 100).toFixed(0)}%</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="5" 
              step="0.1" 
              value={sensitivity} 
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <button 
            disabled={isLoading && !isActive}
            onClick={toggleAudio}
            className={`
              flex items-center gap-3 px-8 py-3 rounded-full font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50
              ${isActive 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'}
            `}
          >
            {isActive ? (
              <>
                <Square className="w-5 h-5 fill-current" />
                Stop
              </>
            ) : isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                Start
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};

// Fix for index.tsx: Export the component as default
export default App;
