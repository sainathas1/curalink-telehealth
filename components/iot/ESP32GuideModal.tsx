'use client';

import React, { useState } from 'react';
import {
  X,
  Cpu,
  Copy,
  Check,
  Code2,
  Terminal,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ESP32GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
}

export function ESP32GuideModal({
  isOpen,
  onClose,
  patientId = 'patient_sarah_jenkins_01',
}: ESP32GuideModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const esp32CodeSnippet = `// ========================================================
// CuraLink Telehealth - ESP32 IoT Biomedical Node Firmware
// Sensors: MAX30102 (PPG / Heart Rate & SpO2) + DS18B20 (Temp)
// ========================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include "MAX30105.h"
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Firestore / Realtime Database Telemetry Endpoint
const char* telemetryEndpoint = "https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/telemetry/${patientId}";

#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);
MAX30105 particleSensor;

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi connected to CuraLink Cloud!");

  Wire.begin(21, 22); // SDA = GPIO21, SCL = GPIO22
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 not detected!");
  }
  particleSensor.setup();
  tempSensor.begin();
}

void loop() {
  tempSensor.requestTemperatures();
  float bodyTemp = tempSensor.getTempCByIndex(0);
  
  // Real PPG sampling algorithms calculate HR & SpO2
  int heartRate = 76; // e.g. beatAvg from PPG
  float spo2 = 98.4;

  // Build JSON Payload matching CuraLink schema
  StaticJsonDocument<256> doc;
  JsonObject fields = doc.createNestedObject("fields");
  fields["patientId"]["stringValue"] = "${patientId}";
  fields["deviceId"]["stringValue"] = "ESP32-HARDWARE-FEED-01";
  fields["heartRate"]["integerValue"] = heartRate;
  fields["spo2"]["doubleValue"] = spo2;
  fields["temperature"]["doubleValue"] = bodyTemp;
  fields["sensorConnected"]["booleanValue"] = true;

  String jsonString;
  serializeJson(doc, jsonString);

  HTTPClient http;
  http.begin(telemetryEndpoint);
  http.addHeader("Content-Type", "application/json");
  int httpResponseCode = http.PATCH(jsonString);
  Serial.printf("Telemetry transmission code: %d\\n", httpResponseCode);
  http.end();

  delay(2000); // Push telemetry every 2 seconds
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(esp32CodeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200 text-xs">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">ESP32 / ESP8266 Hardware Hook Guide</h3>
              <p className="text-xs text-slate-400">Stream physical biomedical telemetry into CuraLink</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Architecture Overview */}
          <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-100 flex items-start gap-3">
            <Layers className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-teal-900">Biomedical IoT Architecture</h4>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                CuraLink connects to microcontrollers via standard Firestore or Realtime Database paths (<code>/telemetry/{patientId}</code>). The web application establishes real-time websocket listeners (<code>onSnapshot</code>) with millisecond-grade UI updates and alarm triggers.
              </p>
            </div>
          </div>

          {/* Wiring Pinout: Mobile Cards with Rounded Corners */}
          <div>
            <h4 className="font-bold text-slate-900 uppercase tracking-wider mb-2 text-xs">
              Recommended Hardware Pinout
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">MAX30102 PPG</span>
                  <span className="text-[10px] font-mono font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
                    GPIO 21 / 22
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">Pin: SDA / SCL</div>
                <p className="text-[11px] text-slate-600">I2C Heart Rate & Pulse Oximetry</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">DS18B20 Temp</span>
                  <span className="text-[10px] font-mono font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
                    GPIO 4 (4.7kΩ)
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">Pin: DATA (1-Wire)</div>
                <p className="text-[11px] text-slate-600">1-Wire Body Temperature Probe</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">Power Supply</span>
                  <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                    3.3V / GND
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">Pin: VCC / GND</div>
                <p className="text-[11px] text-slate-600">Regulated 3.3V power rails</p>
              </div>
            </div>
          </div>

          {/* C++ Code Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Code2 className="w-4 h-4 text-teal-600" />
                <span>Arduino C++ Firmware (ESP32)</span>
              </span>
              <button
                onClick={handleCopy}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
              <code>{esp32CodeSnippet}</code>
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-slate-500 text-[11px]">
            Target Patient: <strong className="font-mono text-slate-800">{patientId}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
