import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        message = `${parsed.error}${parsed.path ? ` (${parsed.operationType} on ${parsed.path})` : ''}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-8">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-zinc-600 leading-relaxed mb-6 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reload application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
