import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, PageHeader, Button, Input, Select } from '@/components/kit';
import { Key, Database, Download, Check, Cpu, Smartphone } from 'lucide-react';
import { OPENROUTER_KEY, MW_KEY, MODEL_KEY, TAVILY_KEY, getOpenRouterKey, getMwKey, getTavilyKey, getDefaultModel, saveKey } from '@/lib/apiKeys';

const AI_MODELS = [
  { value: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron 3 Ultra 550B — strongest (free)' },
  { value: 'nvidia/nemotron-3.5-lightning:free', label: 'Nemotron 3.5 Lightning — fastest (free)' },
  { value: 'poolside/laguna-s-2.1:free', label: 'Laguna S 2.1 — great for code (free)' },
  { value: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B — vision (free)' },
  { value: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', label: 'Nemotron Nano Omni — multimodal reasoning (free)' },
];

export default function SettingsPage() {
  const [openRouterKey, setOpenRouterKey] = useState(() => getOpenRouterKey());
  const [mwKey, setMwKey] = useState(() => getMwKey());
  const [tavilyKey, setTavilyKey] = useState(() => getTavilyKey());
  const [defaultModel, setDefaultModel] = useState(() => getDefaultModel() || AI_MODELS[0].value);
  const [saved, setSaved] = useState(false);

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const updateOpenRouter = (v: string) => {
    setOpenRouterKey(v);
    saveKey(OPENROUTER_KEY, v.trim());
  };
  const updateMw = (v: string) => {
    setMwKey(v);
    saveKey(MW_KEY, v.trim());
  };
  const updateTavily = (v: string) => {
    setTavilyKey(v);
    saveKey(TAVILY_KEY, v.trim());
  };
  const updateModel = (v: string) => {
    setDefaultModel(v);
    saveKey(MODEL_KEY, v);
  };

  const exportData = async () => {
    const tables = ['assessments', 'class_hub', 'class_hub_links', 'todos', 'kanban_tasks',
      'pomodoro_sessions', 'pomodoro_settings', 'habits', 'habit_completions',
      'finance_settings', 'finance_transactions', 'finance_goals', 'notes',
      'timetable_entries', 'class_attendance', 'flashcard_decks', 'flashcards',
      'todo_subtasks', 'forecast_scenarios', 'scratchpad', 'whiteboard'];
    const dump: Record<string, unknown> = {};
    for (const table of tables) {
      const { data } = await supabase.from(table).select('*');
      dump[table] = data;
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `epicure-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Settings"
        subtitle="API keys, AI model and your data"
        action={
          <Button variant="secondary" onClick={flash}>
            {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Saved automatically'}
          </Button>
        }
      />

      <div className="space-y-4">
        <InstallTip />

        {/* API Keys */}

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-zinc-400" />
            <h3 className="font-semibold text-zinc-800">API Keys</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-600 mb-1 block">OpenRouter API Key</label>
              <Input type="password" value={openRouterKey} onChange={updateOpenRouter} placeholder="sk-or-v1-..." />
              <p className="text-xs text-zinc-400 mt-1">Used by the Study Assistant. Get a key at openrouter.ai — saved as you type.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-600 mb-1 block">Merriam-Webster Dictionary API Key</label>
              <Input type="password" value={mwKey} onChange={updateMw} placeholder="Your MW Collegiate API key" />
              <p className="text-xs text-zinc-400 mt-1">Used by the dictionary widget — saved as you type.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-600 mb-1 block">Tavily Search API Key</label>
              <Input type="password" value={tavilyKey} onChange={updateTavily} placeholder="tvly-..." />
              <p className="text-xs text-zinc-400 mt-1">
                Enables live web search in Study Assistant and Coding Agent modes. Get a free key at tavily.com — saved as you type.
              </p>
            </div>
          </div>
        </Card>


        {/* AI Model */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-zinc-400" />
            <h3 className="font-semibold text-zinc-800">Study Assistant</h3>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-600 mb-1 block">Default AI Model</label>
            <Select value={defaultModel} onChange={updateModel} options={AI_MODELS} />
          </div>
        </Card>

        {/* Data */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-zinc-400" />
            <h3 className="font-semibold text-zinc-800">Data</h3>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl glass">
            <div>
              <p className="text-sm font-medium text-zinc-700">Export / Backup Data</p>
              <p className="text-xs text-zinc-400">Download all your data as a JSON file</p>
            </div>
            <Button variant="secondary" size="sm" onClick={exportData}>
              <Download className="w-4 h-4" /> Export
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function InstallTip() {
  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
  }, []);

  if (installed) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <Smartphone className="w-5 h-5 text-zinc-400" />
        <h3 className="font-semibold text-zinc-800">Install epicure</h3>
      </div>
      <p className="text-sm text-zinc-500">
        Add epicure to your home screen for a full-screen, app-like experience.
      </p>
      <ul className="mt-3 space-y-1.5 text-xs text-zinc-500">
        <li><span className="text-zinc-700 font-medium">iPhone / iPad:</span> Share → “Add to Home Screen”.</li>
        <li><span className="text-zinc-700 font-medium">Android Chrome:</span> ⋮ menu → “Add to Home screen” / “Install app”.</li>
        <li><span className="text-zinc-700 font-medium">Desktop:</span> install icon in the address bar.</li>
      </ul>
    </Card>
  );
}
