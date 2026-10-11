'use client';

import React, { useState, useEffect } from 'react';
import { VitalHistoryPoint } from '../../lib/types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Activity, Heart } from 'lucide-react';

interface VitalsChartProps {
  history: VitalHistoryPoint[];
}

export function VitalsChart({ history }: VitalsChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Format data for Heart Rate chart display
  const chartData = (history || [])
    .filter((pt) => typeof pt?.heartRate === 'number' && pt.heartRate > 0)
    .map((pt) => ({
      time: pt?.time || '',
      heartRate: pt?.heartRate ?? 0,
    }));

  if (!mounted) {
    return (
      <div className="w-full h-72 bg-slate-50/60 rounded-2xl flex items-center justify-center border border-slate-200/80 animate-pulse">
        <span className="text-xs font-semibold text-slate-400">Loading Cardiac Telemetry Trend...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs transition-all">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
              <Activity className="w-4 h-4 text-rose-500" />
            </span>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Cardiac Telemetry & Heart Rate Trend
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Continuous streaming biometric telemetry from AD8232 ECG sensor
          </p>
        </div>

        {/* Live Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold self-start sm:self-auto">
          <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-600 animate-pulse" />
          <span>Heart Rate (BPM)</span>
        </div>
      </div>

      {/* Target Range Indicator Pill */}
      <div className="flex items-center justify-between py-2.5 text-xs">
        <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/60">
          Target Clinical Range: Normal: 60 - 100 BPM
        </span>
        <span className="text-[11px] text-slate-400 font-mono">
          Continuous Stream • Auto-refreshed
        </span>
      </div>

      {/* Recharts Area Container or Empty State */}
      {chartData.length === 0 ? (
        <div className="w-full h-64 mt-2 rounded-xl bg-slate-50/50 border border-dashed border-slate-200 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 mb-3">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 mb-1">
            No telemetry records found
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mb-3">
            No historical heart rate readings recorded yet. Once your ECG sensor or telemetry stream begins transmitting, real-time trends will graph here automatically.
          </p>
          <div className="flex items-center gap-2 text-[11px] font-medium text-teal-700 bg-teal-50/80 px-3 py-1 rounded-full border border-teal-200/50">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
            Listening to Live ECG Telemetry
          </div>
        </div>
      ) : (
        <div className="w-full h-64 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="vitalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D9488" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />

              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                dy={8}
              />

              <YAxis
                domain={[40, 160]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                dx={-4}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700 font-sans">
                        <p className="text-[11px] text-slate-400 font-mono">{label}</p>
                        {payload.map((entry, index) => (
                          <p key={index} className="font-bold flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span>Heart Rate:</span>
                            <span className="text-teal-400">
                              {entry.value} BPM
                            </span>
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey="heartRate"
                name="Heart Rate"
                stroke="#0D9488"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#vitalGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

