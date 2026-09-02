import { useState, useEffect, useRef, useCallback } from 'react';
import { usePomodoro } from '@/context/PomodoroContext';
import { supabase } from '@/lib/supabase';
import { SUBJECTS, type PomodoroSettings, type SubjectKey } from '@/lib/types';
import { Card, PageHeader, Button, Select } from '@/components/kit';
import { Play, Pause, RotateCcw, Settings, Volume2, VolumeX, Coffee, Brain } from 'lucide-react';

type SessionType = 'focus' | 'short_break' | 'long_break';

export default function PomodoroPage() {
  const pomo = usePomodoro();
  const [selectedSubject, setSelectedSubject] = useState<SubjectKey | ''>('math');
  const [showSettings, setShowSettings] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [soundType, setSoundType] = useState<'rain' | 'white' | 'lofi'>('rain');
  const audioContextRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);

  const stopSound = useCallback(() => {
    if (noiseNodeRef.current) { noiseNodeRef.current.disconnect(); noiseNodeRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
  }, []);

  const startSound = useCallback((type: 'rain' | 'white' | 'lofi') => {
    stopSound();
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    if (type === 'white') {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer; noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 1000;
      const gain = ctx.createGain(); gain.gain.value = 0.08;
      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(); noiseNodeRef.current = noise;
    } else if (type === 'rain') {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i]; output[i] *= 3.5;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer; noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 0.5;
      const gain = ctx.createGain(); gain.gain.value = 0.15;
      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(); noiseNodeRef.current = noise;
    } else {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.96 * b1 + white * 0.05;
        b2 = 0.90 * b2 + white * 0.05;
        output[i] = (b0 + b1 + b2) * 0.3;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer; noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 500;
      const gain = ctx.createGain(); gain.gain.value = 0.1;
      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start();
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = 110;
      const oscGain = ctx.createGain(); oscGain.gain.value = 0.02;
      osc.connect(oscGain).connect(ctx.destination);
      osc.start(); noiseNodeRef.current = ctx.destination;
    }
  }, [stopSound]);

  useEffect(() => {
    if (soundOn) startSound(soundType);
    else stopSound();
    return () => stopSound();
  }, [soundOn, soundType, startSound, stopSound]);

  const saveSettings = async (newSettings: Partial<PomodoroSettings>) => {
    if (!pomo.settings) return;
    await supabase.from('pomodoro_settings').update(newSettings).eq('id', pomo.settings.id);
  };

  const minutes = Math.floor(pomo.timeLeft / 60);
  const seconds = pomo.timeLeft % 60;
  const totalTime = pomo.getDuration(pomo.sessionType);
  const progress = totalTime > 0 ? ((totalTime - pomo.timeLeft) / totalTime) * 100 : 0;

  const sessionConfig = {
    focus: { label: 'Focus', icon: Brain },
    short_break: { label: 'Short Break', icon: Coffee },
    long_break: { label: 'Long Break', icon: Coffee },
  } as const;

  const currentConfig = sessionConfig[pomo.sessionType];
  const Icon = currentConfig.icon;
  const circumference = 2 * Math.PI * 120;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div>
      <PageHeader
        title="Focus Timer"
        subtitle="Structure your study sessions with the Pomodoro Technique"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSoundOn(!soundOn)}>
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {soundOn ? 'Sound On' : 'Sound Off'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowSettings(!showSettings)}>
              <Settings className="w-4 h-4" /> Settings
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div className="lg:col-span-2">
          <Card className="p-8 flex flex-col items-center">
            <div className="flex gap-2 mb-8 p-1 glass rounded-xl">
              {(Object.keys(sessionConfig) as SessionType[]).map((type) => {
                const cfg = sessionConfig[type];
                const SIcon = cfg.icon;
                return (
                  <button
                    key={type}
                    onClick={() => pomo.switchType(type)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      pomo.sessionType === type ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    <SIcon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-72 h-72 mb-8">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 280 280">
                <circle cx="140" cy="140" r="120" fill="none" stroke="currentColor" className="text-zinc-200" strokeWidth="12" />
                <circle
                  cx="140" cy="140" r="120" fill="none" stroke="currentColor"
                  className="text-zinc-900"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Icon className="w-8 h-8 text-zinc-900 mb-2" />
                <div className="text-5xl font-bold text-zinc-800 tabular-nums">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </div>
                <p className="text-sm text-zinc-400 mt-1">{currentConfig.label}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <Button onClick={() => pomo.isRunning ? pomo.pause() : pomo.start()} className="px-8">
                {pomo.isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {pomo.isRunning ? 'Pause' : 'Start'}
              </Button>
              <Button variant="secondary" onClick={pomo.reset}>
                <RotateCcw className="w-4 h-4" /> Reset
              </Button>
            </div>

            <div className="w-full max-w-xs">
              <label className="text-xs font-medium text-zinc-500 mb-1 block text-center">Studying for</label>
              <Select
                value={selectedSubject}
                onChange={(v) => setSelectedSubject(v as SubjectKey)}
                options={[{ value: '', label: 'General Study' }, ...SUBJECTS.map((s) => ({ value: s.key, label: s.name }))]}
              />
            </div>

            <div className="flex items-center gap-4 mt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-800">{pomo.completedFocus}</div>
                <div className="text-xs text-zinc-400">Focus Sessions</div>
              </div>
              <div className="w-px h-8 bg-zinc-200" />
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-800">{pomo.completedFocus * (pomo.settings?.focus_duration ?? 25)}</div>
                <div className="text-xs text-zinc-400">Minutes Focused</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-zinc-800 mb-3 flex items-center gap-2">
              <Volume2 className="w-4 h-4" /> Ambient Sounds
            </h3>
            <div className="space-y-2">
              {([
                { id: 'rain', label: 'Rain Sounds', desc: 'Calming rain' },
                { id: 'white', label: 'White Noise', desc: 'Block distractions' },
                { id: 'lofi', label: 'Lo-fi Ambient', desc: 'Low-frequency hum' },
              ] as const).map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSoundType(s.id); setSoundOn(true); }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    soundOn && soundType === s.id
                      ? 'border-zinc-800 bg-zinc-100/60'
                      : 'glass border-transparent glass-hover'
                  }`}
                >
                  <p className="text-sm font-medium text-zinc-700">{s.label}</p>
                  <p className="text-xs text-zinc-400">{s.desc}</p>
                </button>
              ))}
            </div>
          </Card>

          {showSettings && pomo.settings && (
            <Card className="p-5">
              <h3 className="font-semibold text-zinc-800 mb-3">Timer Settings</h3>
              <div className="space-y-3">
                {[
                  { key: 'focus_duration', label: 'Focus Duration (min)', min: 1, max: 120, def: 25 },
                  { key: 'short_break_duration', label: 'Short Break (min)', min: 1, max: 60, def: 5 },
                  { key: 'long_break_duration', label: 'Long Break (min)', min: 1, max: 60, def: 15 },
                  { key: 'sessions_before_long_break', label: 'Sessions Before Long Break', min: 1, max: 10, def: 4 },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">{field.label}</label>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      value={(pomo.settings as PomodoroSettings)[field.key as keyof PomodoroSettings] as number}
                      onChange={(e) => saveSettings({ [field.key]: parseInt(e.target.value) || field.def } as Partial<PomodoroSettings>)}
                      className="w-full px-3 py-2 glass-input rounded-xl text-sm"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
