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
import { Activity, Droplets, Thermometer, Gauge } from 'lucide-react';

interface VitalsChartProps {
  history: VitalHistoryPoint[];
  temperatureUnit?: 'C' | 'F';
}

type MetricType = 'heartRate' | 'spo2' | 'temperature' | 'bloodPressure';

export function VitalsChart({ history, temperatureUnit = 'C' }: VitalsChartProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('heartRate');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Format data for chart display based on temperatureUnit
  const chartData = history.map((pt) => {
    const tempValue =
      temperatureUnit === 'F'
        ? Number(((pt.temperature * 9) / 5 + 32).toFixed(1))
        : Number(pt.temperature.toFixed(1));

    return {
      time: pt.time,
      heartRate: pt.heartRate,
      spo2: pt.spo2,
      temperature: tempValue,
      systolic: pt.systolic,
      diastolic: pt.diastolic,
    };
  });

  const metricConfigs = {
    heartRate: {
      label: 'Heart Rate',
      unit: 'BPM',
      icon: <Activity className="w-4 h-4 text-rose-500" />,
      color: '#0D9488', // teal-600
      secondaryColor: '#10B981', // emerald-500
      domain: [40, 160],
      dataKey: 'heartRate',
      normalRange: 'Normal: 60 - 100 BPM',
    },
    spo2: {
      label: 'Oxygen Saturation',
      unit: '%',
      icon: <Droplets className="w-4 h-4 text-cyan-500" />,
      color: '#0284C7', // sky-600
      secondaryColor: '#38BDF8',
      domain: [85, 100],
      dataKey: 'spo2',
      normalRange: 'Normal: 95 - 100 %',
    },
    temperature: {
      label: 'Body Temperature',
      unit: temperatureUnit === 'F' ? '°F' : '°C',
      icon: <Thermometer className="w-4 h-4 text-amber-500" />,
      color: '#D97706', // amber-600
      secondaryColor: '#F59E0B',
      domain: temperatureUnit === 'F' ? [95, 105] : [35, 41],
      dataKey: 'temperature',
      normalRange: temperatureUnit === 'F' ? 'Normal: 97.0 - 99.1 °F' : 'Normal: 36.1 - 37.3 °C',
    },
    bloodPressure: {
      label: 'Blood Pressure',
      unit: 'mmHg',
      icon: <Gauge className="w-4 h-4 text-indigo-500" />,
      color: '#4F46E5', // indigo-600
      secondaryColor: '#818CF8',
      domain: [50, 180],
      dataKey: 'systolic',
      normalRange: 'Normal: <120/<80 mmHg',
    },
  };

  const activeConfig = metricConfigs[selectedMetric];

  if (!mounted) {
    return (
      <div className="w-full h-72 bg-slate-50/60 rounded-2xl flex items-center justify-center border border-slate-200/80 animate-pulse">
        <span className="text-xs font-semibold text-slate-400">Loading Telemetry Trend...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs transition-all">
      {/* Chart Header & Metric Selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
              {activeConfig.icon}
            </span>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              24-Hour IoT Telemetry Trend
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Continuous streaming sensor telemetry from patient wearable node
          </p>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
          {(Object.keys(metricConfigs) as MetricType[]).map((key) => {
            const isSelected = selectedMetric === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedMetric(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                {metricConfigs[key].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Range Indicator Pill */}
      <div className="flex items-center justify-between py-2.5 text-xs">
        <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/60">
          Target Clinical Range: {activeConfig.normalRange}
        </span>
        <span className="text-[11px] text-slate-400 font-mono">
          Last 24 readings • Auto-refreshed
        </span>
      </div>

      {/* Recharts Area Container or Empty State */}
      {chartData.length === 0 ? (
        <div className="w-full h-64 mt-2 rounded-xl bg-slate-50/50 border border-dashed border-slate-200 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 mb-3">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 mb-1">
            Awaiting Telemetry Data Stream
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mb-3">
            No historical vital readings recorded yet. Once your IoT biosensor node or Firebase telemetry stream begins transmitting, real-time trends will graph here automatically.
          </p>
          <div className="flex items-center gap-2 text-[11px] font-medium text-teal-700 bg-teal-50/80 px-3 py-1 rounded-full border border-teal-200/50">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
            Listening to Firebase Telemetry
          </div>
        </div>
      ) : (
        <div className="w-full h-64 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="vitalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={activeConfig.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={activeConfig.secondaryColor} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="diastolicGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818CF8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#818CF8" stopOpacity={0.0} />
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
              domain={activeConfig.domain}
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
                          <span>{entry.name}:</span>
                          <span className="text-teal-400">
                            {entry.value} {activeConfig.unit}
                          </span>
                        </p>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />

            {selectedMetric === 'bloodPressure' ? (
              <>
                <Area
                  type="monotone"
                  dataKey="systolic"
                  name="Systolic"
                  stroke={activeConfig.color}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#vitalGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="diastolic"
                  name="Diastolic"
                  stroke="#818CF8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#diastolicGradient)"
                />
              </>
            ) : (
              <Area
                type="monotone"
                dataKey={activeConfig.dataKey}
                name={activeConfig.label}
                stroke={activeConfig.color}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#vitalGradient)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
}
