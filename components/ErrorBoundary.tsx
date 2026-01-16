
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Visualizer Uncaught Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900/40 backdrop-blur-xl border border-red-500/20 p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="p-4 bg-red-500/10 ring-1 ring-red-500/20 shadow-2xl shadow-red-500/10">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight uppercase">Visualizer Encountered an Issue</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
              The rendering engine hit an unexpected error. This usually happens when the audio source is interrupted or browser resources are constrained.
            </p>
          </div>
          <button 
            onClick={this.handleReset}
            className="flex items-center gap-3 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold transition-all hover:scale-105 active:scale-95 border border-white/5 shadow-xl rounded-none"
          >
            <RefreshCcw className="w-4 h-4" />
            Restart Visualizer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
