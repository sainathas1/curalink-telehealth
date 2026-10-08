'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  HeartPulse,
  Radio,
  Stethoscope,
  User,
  ShieldCheck,
  Activity,
  Cpu,
  Video,
  ArrowRight,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';

interface LandingHeaderProps {
  onOpenAuth: () => void;
  onLaunchPortal: () => void;
  onToggleDemoMode: () => void;
  isDemoMode: boolean;
  currentUser?: any;
}

export function LandingHeader({
  onOpenAuth,
  onLaunchPortal,
  onToggleDemoMode,
  isDemoMode,
  currentUser,
}: LandingHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pingMs, setPingMs] = useState(18);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Subtle live ping variance
  useEffect(() => {
    const interval = setInterval(() => {
      setPingMs(Math.floor(14 + Math.random() * 8));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-slate-950/85 backdrop-blur-xl border-b border-teal-500/20 shadow-2xl shadow-black/50 py-3'
          : 'bg-transparent border-b border-white/5 py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 via-teal-400 to-emerald-400 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/30 group-hover:scale-105 group-hover:shadow-teal-400/50 transition-all">
              <HeartPulse className="w-5 h-5 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950 animate-ping" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white group-hover:text-teal-300 transition-colors">
                Cura<span className="text-teal-400">Link</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 font-mono">
                3D TELEHEALTH
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide hidden sm:block">
              Real-Time IoT Telemetry & Clinical Care
            </p>
          </div>
        </Link>

        {/* Center Navigation Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
          <a
            href="#biometrics-hud"
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all"
          >
            3D Biometrics HUD
          </a>
          <a
            href="#features"
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all"
          >
            Features
          </a>
          <a
            href="#telehealth-video"
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all"
          >
            HD Video Consult
          </a>
          <a
            href="#iot-hardware"
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all"
          >
            ESP32 Node
          </a>
          <a
            href="#interactive-sandbox"
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-teal-300 hover:text-white hover:bg-teal-500/20 transition-all flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            Live Sandbox
          </a>
        </nav>

        {/* Live Network & Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Live Ping Status Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-teal-500/30 text-xs font-mono text-slate-300 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-teal-300 font-bold">Cloud Live</span>
            <span className="text-[11px] text-slate-500">({pingMs}ms)</span>
          </div>

          {/* Quick Doctor / Patient direct links */}
          <Link
            href="/doctor/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all border border-white/10"
            title="Clinician Ward & EHR Station"
          >
            <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
            <span>Doctor View</span>
          </Link>

          <Link
            href="/patient/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all border border-white/10"
            title="Patient Portal & Vitals"
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>Patient View</span>
          </Link>

          {/* Primary Action Button */}
          {currentUser ? (
            <button
              onClick={onLaunchPortal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Activity className="w-4 h-4" />
              <span>Launch Dashboard</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Sign In / Join</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-slate-950/95 backdrop-blur-2xl border-b border-teal-500/30 px-6 py-6 mt-3 space-y-4">
          <div className="flex flex-col gap-2">
            <a
              href="#biometrics-hud"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              3D Biometrics HUD
            </a>
            <a
              href="#features"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              Features & Technologies
            </a>
            <a
              href="#telehealth-video"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              HD Video Consult
            </a>
            <a
              href="#iot-hardware"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              ESP32 Node & Sensor Stream
            </a>
            <a
              href="#interactive-sandbox"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-teal-300 hover:bg-teal-500/10"
            >
              Live Interactive Sandbox
            </a>
          </div>

          <div className="pt-4 border-t border-white/10 flex flex-col gap-2.5">
            <Link
              href="/doctor/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-center text-xs font-bold flex items-center justify-center gap-2"
            >
              <Stethoscope className="w-4 h-4 text-teal-400" />
              Doctor Clinical Workspace
            </Link>
            <Link
              href="/patient/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-center text-xs font-bold flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4 text-emerald-400" />
              Patient Health Portal
            </Link>
            <Link
              href="/patient/device"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full py-2.5 rounded-xl bg-teal-900/40 text-teal-300 border border-teal-500/30 text-center text-xs font-bold flex items-center justify-center gap-2"
            >
              <Cpu className="w-4 h-4" />
              Web Serial USB Device Sync
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
