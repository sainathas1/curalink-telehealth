'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  sectionName?: string;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Safe UI Boundary caught runtime exception:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[240px] p-6 sm:p-8 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col items-center justify-center text-center my-4 animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3 shadow-xs">
            <AlertCircle className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 mb-1.5">
            Safe UI Recovery
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            {this.props.fallbackTitle || 'Display Section Paused'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-5 leading-relaxed">
            {this.props.fallbackMessage ||
              'A temporary view condition occurred. Your clinical data and session remain safely stored in Firestore.'}
          </p>
          <div className="flex items-center gap-2.5">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Section</span>
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer"
            >
              Reload View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
