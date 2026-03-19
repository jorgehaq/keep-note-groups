import React from 'react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' };
  
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, error: err.message };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-zinc-400 gap-4">
          <p className="text-red-400 font-mono text-sm text-center px-4">Error: {this.state.error}</p>
          <button 
            className="px-4 py-2 bg-zinc-800 rounded-xl border border-zinc-700 hover:bg-zinc-700 transition-colors text-sm font-bold text-zinc-200"
            onClick={() => window.location.reload()}
          >
            Recargar Aplicación
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
