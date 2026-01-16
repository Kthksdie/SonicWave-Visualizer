
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { WaveformVisualizer, VisualizerMode, ColorPalette } from './components/WaveformVisualizer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RawMonitor } from './components/RawMonitor';
import { 
  Mic, 
  MicOff, 
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
  Minimize,
  Clock,
  Radio,
  Palette,
  Share2,
  Check
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
  const [palette, setPalette] = useState<ColorPalette>('indigo');
  const [pendingFullscreen, setPendingFullscreen] = useState(false);
  const [displayTime, setDisplayTime] = useState('00:00');
  const [copied, setCopied] = useState(false);
  
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<number>(0);

  // 1. Parse URL Parameters on mount safely
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get('url');
      const modeParam = params.get('mode') as VisualizerMode;
      const paletteParam = params.get('palette') as ColorPalette;
      const fullscreenParam = params.get('fullscreen') === 'true';
      const sensitivityParam = params.get('sensitivity');

      if (urlParam) {
        setStreamUrl(urlParam);
        setSourceType('url');
      }
      
      if (modeParam && ['waveform', 'bars', 'radial', 'particles'].includes(modeParam)) {
        setMode(modeParam);
      }

      if (paletteParam && ['indigo', 'emerald', 'rose', 'amber', 'cyan', 'violet'].includes(paletteParam)) {
        setPalette(paletteParam);
      }

      if (fullscreenParam) {
        setPendingFullscreen(true);
      }

      if (sensitivityParam) {
        const s = parseFloat(sensitivityParam);
        if (!isNaN(s)) setSensitivity(s);
      }
    } catch (e) {
      console.debug('URL parameters parsing skipped: History API restricted.');
    }
  }, []);

  // 2. Synchronize State back to URL with Security Guard
  useEffect(() => {
    try {
      if (window.location.protocol.startsWith('blob:')) return;

      const params = new URLSearchParams();
      if (streamUrl && sourceType === 'url') params.set('url', streamUrl);
      if (mode !== 'waveform') params.set('mode', mode);
      if (palette !== 'indigo') params.set('palette', palette);
      if (sensitivity !== 1.0) params.set('sensitivity', sensitivity.toString());
      
      const queryString = params.toString();
      const newRelativePathQuery = window.location.pathname + (queryString ? '?' + queryString : '');
      
      window.history.replaceState(null, '', newRelativePathQuery);
    } catch (e) {
      console.debug('History sync disabled: replaceState restricted.');
    }
  }, [streamUrl, sourceType, mode, palette, sensitivity]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs > 0 ? hrs.toString().padStart(2, '0') + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isActive) {
      sessionStartTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        if (sourceType === 'url' && videoElementRef.current) {
          setDisplayTime(formatTime(videoElementRef.current.currentTime));
        } else {
          const elapsed = (Date.now() - sessionStartTimeRef.current) / 1000;
          setDisplayTime(formatTime(elapsed));
        }
      }, 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setDisplayTime('00:00');
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, sourceType]);

  const requestFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message}`);
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      requestFullscreen();
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, [requestFullscreen]);

  const stopAudio = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoElementRef.current) {
      const video = videoElementRef.current;
      video.pause();
      video.src = "";
      video.load();
      video.onwaiting = null;
      video.onplaying = null;
      video.onstalled = null;
      video.oncanplay = null;
    }
    setIsActive(false);
    setIsLoading(false);
    setIsBuffering(false);
  }, [stream]);

  const setupAudioListeners = (video: HTMLVideoElement) => {
    video.onwaiting = () => setIsBuffering(true);
    video.onplaying = () => setIsBuffering(false);
    video.onstalled = () => setIsBuffering(true);
    video.oncanplay = () => setIsBuffering(false);
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

      const video = videoElementRef.current;
      if (!video) {
        setIsLoading(false);
        return;
      }

      setupAudioListeners(video);
      video.crossOrigin = "anonymous";
      
      const isHls = streamUrl.toLowerCase().includes('.m3u8');

      if (isHls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().then(() => {
            setIsActive(true);
            setIsLoading(false);
          }).catch((err) => {
            if (err.name !== 'AbortError') {
              setError('Playback blocked. Ensure your browser allows autoplay.');
              setIsLoading(false);
            }
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
              case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
              default:
                setError(`Fatal stream error: ${data.details}`);
                stopAudio();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        const playNative = () => {
          video.play().then(() => {
            setIsActive(true);
            setIsLoading(false);
          }).catch(err => {
            if (err.name !== 'AbortError') {
              setError('Autoplay blocked by browser.');
              setIsLoading(false);
            }
          });
        };
        video.addEventListener('loadedmetadata', playNative, { once: true });
      } else {
        try {
          video.src = streamUrl;
          video.play().then(() => {
            setIsActive(true);
            setIsLoading(false);
          }).catch((err) => {
            if (err.name !== 'AbortError') {
              setError('Stream URL failed to load or autoplay was blocked.');
              setIsLoading(false);
            }
          });
        } catch (err) {
          setError('Source error. Ensure the URL is valid.');
          setIsLoading(false);
        }
      }
    }
  }, [sourceType, streamUrl, stopAudio]);

  const toggleAudio = () => {
    if (isActive || isLoading) {
      stopAudio();
    } else {
      if (pendingFullscreen) {
        requestFullscreen();
        setPendingFullscreen(false);
      }
      startAudio();
    }
  };

  const handleShare = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const modes: { id: VisualizerMode; icon: React.ReactNode; label: string }[] = [
    { id: 'waveform', icon: <Waves className="w-4 h-4" />, label: 'Waveform' },
    { id: 'bars', icon: <BarChart3 className="w-4 h-4" />, label: 'Spectrum' },
    { id: 'radial', icon: <CircleDot className="w-4 h-4" />, label: 'Radial' },
    { id: 'particles', icon: <Zap className="w-4 h-4" />, label: 'Pulse' },
  ];

  const palettes: { id: ColorPalette; color: string; label: string }[] = [
    { id: 'indigo', color: 'bg-indigo-500', label: 'Indigo' },
    { id: 'emerald', color: 'bg-emerald-500', label: 'Emerald' },
    { id: 'rose', color: 'bg-rose-500', label: 'Rose' },
    { id: 'amber', color: 'bg-amber-500', label: 'Amber' },
    { id: 'cyan', color: 'bg-cyan-500', label: 'Cyan' },
    { id: 'violet', color: 'bg-violet-500', label: 'Violet' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-between p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      <video 
        ref={videoElementRef} 
        className="hidden" 
        crossOrigin="anonymous" 
        playsInline 
      />

      <header className={`w-full max-w-6xl flex justify-between items-center z-10 transition-opacity duration-300 ${isFullscreen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 shadow-lg shadow-indigo-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 uppercase">
              SonicWave
            </h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Real-time Audio Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {isActive && (
            <div className="hidden lg:block transition-all animate-in fade-in slide-in-from-right-4 duration-500">
              <RawMonitor source={sourceType === 'mic' ? stream : videoElementRef.current} />
            </div>
          )}
          <div className="hidden md:flex items-center gap-2">
            <div className="bg-slate-900/50 p-1 border border-white/5 flex gap-1">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all ${
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

            <button
              onClick={handleShare}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border transition-all duration-300 ${
                copied 
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20' 
                : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copied ? 'Link Copied!' : 'Share Config'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl flex flex-col items-center justify-center relative py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent pointer-events-none"></div>
        
        <div 
          ref={containerRef}
          className={`relative flex justify-center transition-all duration-500 overflow-hidden bg-slate-950 w-full max-w-4xl rounded-none ${isActive ? 'h-64 md:h-96' : 'h-0 opacity-0'} ${isFullscreen ? 'fixed inset-0 z-[100] w-screen h-screen max-w-none border-none' : 'shadow-2xl border border-white/5'}`}
        >
          {isActive && (
            <>
              <ErrorBoundary>
                <WaveformVisualizer 
                  source={sourceType === 'mic' ? stream : videoElementRef.current} 
                  sensitivity={sensitivity} 
                  mode={mode} 
                  palette={palette}
                />
              </ErrorBoundary>

              <div className="absolute top-6 left-6 flex items-center gap-3 bg-slate-900/40 backdrop-blur-md border border-white/10 px-4 py-2 text-white/90 z-[110] shadow-xl pointer-events-none rounded-none">
                {sourceType === 'url' ? <Clock className="w-4 h-4 text-indigo-400" /> : <Radio className="w-4 h-4 text-red-500 animate-pulse" />}
                <span className="text-sm font-mono font-bold tracking-wider tabular-nums">
                  {displayTime}
                </span>
                {sourceType === 'mic' && (
                  <span className="text-[10px] bg-red-500 px-1.5 py-0.5 rounded-none text-white font-black uppercase tracking-tighter ml-1">Live</span>
                )}
              </div>
              
              <button
                onClick={toggleFullscreen}
                className="absolute top-6 right-6 p-3 bg-slate-900/40 hover:bg-indigo-600/60 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-all shadow-xl z-[110] group rounded-none"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5 group-hover:scale-110 transition-transform" />
                ) : (
                  <Maximize className="w-5 h-5 group-hover:scale-110 transition-transform" />
                )}
              </button>

              {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px] transition-all duration-300 z-[105]">
                  <div className="flex flex-col items-center gap-3 bg-slate-900/80 px-6 py-4 border border-white/10 shadow-2xl rounded-none">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest animate-pulse">Buffering</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!isActive && (
          <div className="text-center space-y-8 max-w-xl px-4 z-10">
            <div className="mx-auto w-24 h-24 bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 shadow-2xl relative rounded-none">
              {isLoading ? (
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
              ) : (
                sourceType === 'mic' ? <MicOff className="w-10 h-10 text-slate-600" /> : <Globe className="w-10 h-10 text-slate-600" />
              )}
            </div>
            
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Select Audio Source</h2>
              <div className="flex justify-center gap-4">
                <button 
                  disabled={isLoading}
                  onClick={() => { setSourceType('mic'); setError(null); }}
                  className={`flex items-center gap-2 px-6 py-2 border transition-all rounded-none ${sourceType === 'mic' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 disabled:opacity-50'}`}
                >
                  <Mic className="w-4 h-4" /> Microphone
                </button>
                <button 
                  disabled={isLoading}
                  onClick={() => { setSourceType('url'); setError(null); }}
                  className={`flex items-center gap-2 px-6 py-2 border transition-all rounded-none ${sourceType === 'url' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 disabled:opacity-50'}`}
                >
                  <Globe className="w-4 h-4" /> Stream URL
                </button>
              </div>
            </div>

            {sourceType === 'url' && (
              <div className="relative max-md:max-w-xs mx-auto">
                <input 
                  type="text" 
                  disabled={isLoading}
                  placeholder="Enter .m3u8 or audio URL..."
                  value={streamUrl}
                  onChange={(e) => {
                    setSourceType('url');
                    setStreamUrl(e.target.value);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-none px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all pr-12 disabled:opacity-50"
                />
                <Globe className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
              </div>
            )}

            <p className="text-slate-400 leading-relaxed max-w-sm mx-auto">
              Transform your {sourceType === 'mic' ? 'surroundings' : 'favorite stream'} into stunning real-time visualizations.
            </p>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-none text-red-400 text-sm max-w-md mx-auto">
                {error}
              </div>
            )}
          </div>
        )}

        {isActive && !isFullscreen && (
          <div className="flex flex-col items-center gap-2 animate-pulse mt-8">
            <span className="text-indigo-400 text-sm font-semibold tracking-wider uppercase">
              {sourceType === 'mic' ? 'Microphone Active' : 'Streaming Active'}
            </span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-indigo-400"></div>
              <div className="w-1.5 h-1.5 bg-indigo-400/60"></div>
              <div className="w-1.5 h-1.5 bg-indigo-400/30"></div>
            </div>
          </div>
        )}
      </main>

      <footer className={`w-full max-w-4xl bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 shadow-2xl z-20 mb-4 transition-all duration-300 rounded-none ${isFullscreen ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
              <Palette className="w-3 h-3" /> Color Palette
            </div>
            <div className="flex flex-wrap gap-2">
              {palettes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPalette(p.id)}
                  title={p.label}
                  className={`w-7 h-7 transition-all duration-200 border-2 ${p.color} ${palette === p.id ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
             <button 
              disabled={isLoading && !isActive}
              onClick={toggleAudio}
              className={`
                flex items-center gap-3 px-10 py-3 font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 rounded-none
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

          <div className="space-y-3">
            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span>Sensitivity</span>
              <span className="text-indigo-400 font-mono">{(sensitivity * 100).toFixed(0)}%</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="5" 
              step="0.1" 
              value={sensitivity} 
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-none appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
