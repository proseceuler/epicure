import { useEffect, useMemo, useRef, useState } from 'react';
import { MODEL_KEY, getDefaultModel, getOpenRouterKey, getTavilyKey, saveKey } from '@/lib/apiKeys';
import Markdown from '@/components/Markdown';
import { DATA_TOOLS, SEARCH_TOOL, runTool, type ToolDef } from '@/lib/aiTools';
import type { SearchResponse } from '@/lib/webSearch';
import { usePomodoro } from '@/context/PomodoroContext';
import type { SubjectKey } from '@/lib/types';
import { Bot, Key, Globe, ExternalLink, Check, Wrench, Trash2, History, ChevronDown, Library } from 'lucide-react';
import { getSources, buildSourcesPrompt, type Source } from '@/lib/sources';
import SourcesPanel from '@/components/assistant/SourcesPanel';
import {
  MODES, FREE_MODELS, TOOL_PROMPT, SEARCH_PROMPT, SEARCH_MODES,
  type ModeId, type SubModeId,
} from '@/components/assistant/constants';
import DynamicHeadline from '@/components/assistant/DynamicHeadline';
import ModeSelector from '@/components/assistant/ModeSelector';
import ChatInputBar from '@/components/assistant/ChatInputBar';
import QuintilianAiCheck from '@/components/assistant/QuintilianAiCheck';

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  image?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  actions?: { name: string; ok: boolean }[];
  searches?: SearchResponse[];
  usedSources?: { title: string }[];
}

const HISTORY_KEY = 'epicure-ai-history';

export default function StudyAssistantPage() {
  const pomodoro = usePomodoro();
  const [mode, setMode] = useState<ModeId>('study');
  const [subMode, setSubMode] = useState<SubModeId>('qa');
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    } catch {
      return {};
    }
  });
  const [model, setModel] = useState(() => {
    const stored = getDefaultModel();
    return FREE_MODELS.some((m) => m.value === stored) ? stored : FREE_MODELS[0].value;
  });
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState('');
  const [error, setError] = useState('');
  const [webSearchOn, setWebSearchOn] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourcesTick, setSourcesTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(Boolean(SR));
  }, []);

  const toggleListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    let base = '';
    recognition.onstart = () => {
      base = input ? input.trimEnd() + ' ' : '';
      setError('');
      setListening(true);
    };
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setInput(base + transcript);
    };
    recognition.onerror = (event: any) => {
      setError(
        event.error === 'not-allowed'
          ? 'Microphone access was blocked. Allow it in your browser settings.'
          : 'Voice input stopped unexpectedly.',
      );
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const [apiKey, setApiKey] = useState(() => getOpenRouterKey());
  const [tavilyKey, setTavilyKey] = useState(() => getTavilyKey());

  useEffect(() => {
    const sync = () => {
      setApiKey(getOpenRouterKey());
      setTavilyKey(getTavilyKey());
    };
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const activeMode = MODES.find((m) => m.id === mode)!;
  const messages = histories[mode] ?? [];
  const visibleMessages = messages.filter((m) => m.role !== 'tool');
  const visionModel = FREE_MODELS.find((m) => m.value === model)?.vision ?? false;
  const searchAllowed = SEARCH_MODES.includes(mode);
  const searchActive = searchAllowed && webSearchOn && Boolean(tavilyKey);
  const sources: Source[] = useMemo(() => getSources(mode), [mode, sourcesTick]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(histories));
  }, [histories]);

  useEffect(() => {
    saveKey(MODEL_KEY, model);
  }, [model]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!visionModel) setImage(null);
  }, [visionModel]);

  const setMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) =>
    setHistories((prev) => ({ ...prev, [mode]: updater(prev[mode] ?? []) }));

  const pickImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setToolStatus('');
  };

  const toApiMessage = (m: ChatMessage): Record<string, unknown> => {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.tool_call_id, name: m.name, content: m.content };
    }
    if (m.role === 'assistant' && m.tool_calls?.length) {
      return { role: 'assistant', content: m.content || null, tool_calls: m.tool_calls };
    }
    if (m.image) {
      return {
        role: m.role,
        content: [
          { type: 'text', text: m.content || 'Describe and help with this image.' },
          { type: 'image_url', image_url: { url: m.image } },
        ],
      };
    }
    return { role: m.role, content: m.content };
  };

  const handleMode = (m: ModeId) => {
    setMode(m);
    const def = MODES.find((x) => x.id === m)!;
    setInput(def.starter);
  };

  const clearChat = () => {
    setHistories((prev) => ({ ...prev, [mode]: [] }));
  };

  const modesWithHistory = MODES.filter((m) => (histories[m.id] ?? []).filter((msg) => msg.role !== 'tool').length > 0);

  const send = async () => {
    const text = input.trim();
    if ((!text && !image) || streaming) return;
    if (!apiKey) {
      setError('Add your OpenRouter API key in Settings first.');
      return;
    }
    setError('');

    const userMessage: ChatMessage = { role: 'user', content: text, ...(image ? { image } : {}) };
    let history: ChatMessage[] = [...messages, userMessage];
    setMessages(() => [...history, { role: 'assistant', content: '' }]);
    setInput('');
    setImage(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const tools: ToolDef[] = [...DATA_TOOLS, ...(searchActive ? [SEARCH_TOOL] : [])];
    const subModeSystem = activeMode.subModes && subMode ? activeMode.subModes.find((s) => s.id === subMode)?.system ?? '' : '';
    const system =
      activeMode.system +
      (subModeSystem ? '\n\n' + subModeSystem : '') +
      TOOL_PROMPT +
      (searchActive ? SEARCH_PROMPT : '') +
      buildSourcesPrompt(sources) +
      `\n\nToday's date is ${new Date().toLocaleDateString('en-CA')}.`;
    const usedSources = sources.length ? sources.map((s) => ({ title: s.title })) : undefined;

    try {
      for (let round = 0; round < 5; round++) {
        const payload = {
          model,
          stream: true,
          tools,
          tool_choice: 'auto',
          messages: [{ role: 'system', content: system }, ...history.map(toApiMessage)],
        };

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => '');
          throw new Error(detail?.slice(0, 300) || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let content = '';
        const calls: ToolCall[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta;
              if (delta?.content) {
                content += delta.content;
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = { ...next[next.length - 1], role: 'assistant', content };
                  return next;
                });
              }
              for (const tc of delta?.tool_calls ?? []) {
                const idx = tc.index ?? 0;
                calls[idx] ??= { id: tc.id ?? `call_${idx}`, type: 'function', function: { name: '', arguments: '' } };
                if (tc.id) calls[idx].id = tc.id;
                if (tc.function?.name) calls[idx].function.name += tc.function.name;
                if (tc.function?.arguments) calls[idx].function.arguments += tc.function.arguments;
              }
            } catch {
              /* ignore malformed keep-alive chunks */
            }
          }
        }

        const pending = calls.filter(Boolean);
        if (!pending.length) {
          history = [...history, { role: 'assistant', content, ...(usedSources ? { usedSources } : {}) }];
          setMessages(() => history);
          break;
        }

        const assistantMsg: ChatMessage = { role: 'assistant', content, tool_calls: pending };
        const toolMsgs: ChatMessage[] = [];
        const actions: { name: string; ok: boolean }[] = [];
        const searches: SearchResponse[] = [];

        for (const call of pending) {
          setToolStatus(call.function.name.replace(/_/g, ' '));
          let args: Record<string, unknown> = {};
          try {
            args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          } catch {
            args = {};
          }
          const result = await runTool(call.function.name, args, {
            startFocus: (subject) => {
              pomodoro.setSessionContext((subject as SubjectKey) ?? null, null);
              pomodoro.switchType('focus');
              pomodoro.start();
              pomodoro.setDockOpen(true);
            },
            onSearch: (r) => searches.push(r),
          });
          const ok = !(result && typeof result === 'object' && (result as any).ok === false);
          actions.push({ name: call.function.name, ok });
          toolMsgs.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(result).slice(0, 8000),
          });
        }
        setToolStatus('');

        assistantMsg.actions = actions;
        if (searches.length) assistantMsg.searches = searches;
        history = [...history, assistantMsg, ...toolMsgs];
        setMessages(() => [...history, { role: 'assistant', content: '' }]);
      }
    } catch (e) {
      const err = e as Error;
      if (err.name !== 'AbortError') {
        setError(err.message || 'Something went wrong talking to OpenRouter.');
        setMessages((prev) => {
          const next = [...prev];
          if (!next[next.length - 1]?.content && !next[next.length - 1]?.tool_calls) next.pop();
          return next;
        });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setToolStatus('');
    }
  };

  const searchLabel = searchActive ? 'Web search on' : tavilyKey ? 'Web search off' : 'Web search — no key';

  return (
    <div className="sa-glass flex h-full min-h-0 flex-col overflow-hidden">

      {!apiKey && (
        <div className="mx-4 mb-2 flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--sa-surface)] border border-[var(--sa-border)]">
          <Key className="w-4 h-4 text-[var(--sa-text-dim)] mt-0.5 shrink-0" />
          <p className="text-xs text-[var(--sa-text-muted)]">
            No OpenRouter API key found. Open <span className="font-medium text-[var(--sa-text)]">Settings</span> and paste your key to start chatting. All models listed here are free tiers.
          </p>
        </div>
      )}

      {visibleMessages.length === 0 ? (
        /* ===== Idle / empty state ===== */
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 relative">
          <button
            type="button"
            onClick={() => setSourcesOpen(true)}
            className={`absolute top-3 right-4 sa-pill ${sources.length ? 'sa-pill-active' : ''}`}
            style={{ padding: '0.3125rem 0.625rem', fontSize: '0.6875rem' }}
          >
            <Library className="w-3 h-3" />
            Sources{sources.length ? ` (${sources.length})` : ''}
          </button>
          {/* Centered icon */}
          <div className="w-11 h-11 rounded-2xl bg-[var(--sa-surface)] border border-[var(--sa-border)] flex items-center justify-center mb-4">
            <Bot className="w-5 h-5 text-[var(--sa-text)]" />
          </div>

          {/* Dynamic headline */}
          <DynamicHeadline mode={mode} />

          {/* Input bar + modes — kept tight so no long scroll to reach the box */}
          <div className="mt-5 w-full flex flex-col items-center gap-3">
            <ChatInputBar
              input={input}
              onInput={setInput}
              onSend={send}
              onStop={stop}
              streaming={streaming}
              models={FREE_MODELS}
              model={model}
              onModelChange={setModel}
              visionModel={visionModel}
              speechSupported={speechSupported}
              listening={listening}
              onToggleListening={toggleListening}
              onPickImage={pickImage}
              image={image}
              onClearImage={() => setImage(null)}
              placeholder="How can I help you today?"
              showWeissSources={mode === 'research'}
            />

            {/* Mode pills + web search */}
            <ModeSelector
              mode={mode}
              subMode={subMode}
              onMode={handleMode}
              onSubMode={setSubMode}
              searchActive={searchActive}
              searchAllowed={searchAllowed}
              searchLabel={searchLabel}
              onToggleSearch={() => setWebSearchOn((v) => !v)}
            />

            {mode === 'writing' && <QuintilianAiCheck text={input} />}
          </div>

          {error && <p className="mt-4 text-xs text-rose-500">{error}</p>}
        </div>
      ) : (
        /* ===== Active conversation — Claude layout: top + input fixed, only messages scroll ===== */
        <div className="flex flex-1 flex-col min-h-0 max-w-3xl w-full mx-auto px-4">
          {/* Header — Claude-style: agent identity + a compact mode switcher, minimal icon actions */}
          <div className="shrink-0 flex items-center justify-between pt-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setModeMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 -ml-1.5 hover:bg-[var(--sa-surface-hover)] transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-[var(--sa-surface)] border border-[var(--sa-border)] flex items-center justify-center shrink-0">
                  <Bot className="w-3 h-3 text-[var(--sa-text)]" />
                </span>
                <span className="text-sm font-medium text-[var(--sa-text)]">{activeMode.agentName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--sa-text-dim)]" />
              </button>
              {modeMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-60 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-surface)] shadow-lg z-20 overflow-hidden">
                  {MODES.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setMode(m.id);
                          setModeMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--sa-surface-hover)] ${
                          m.id === mode ? 'text-[var(--sa-text)]' : 'text-[var(--sa-text-muted)]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex flex-col leading-tight">
                          <span className="text-xs font-medium">{m.agentName}</span>
                          <span className="text-[10px] text-[var(--sa-text-dim)]">{m.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setSourcesOpen(true)}
                className={`sa-icon-btn relative w-8 h-8 flex items-center justify-center ${sources.length ? 'text-[var(--sa-accent)]' : ''}`}
                title="Sources"
              >
                <Library className="w-4 h-4" />
                {sources.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-[var(--sa-text)] text-[9px] font-semibold leading-none text-[var(--sa-accent-text)]">
                    {sources.length}
                  </span>
                )}
              </button>
              {searchAllowed && (
                <button
                  type="button"
                  onClick={() => setWebSearchOn((v) => !v)}
                  className={`sa-icon-btn w-8 h-8 flex items-center justify-center ${searchActive ? 'text-[var(--sa-accent)]' : ''}`}
                  title={searchLabel}
                >
                  <Globe className="w-4 h-4" />
                </button>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="sa-icon-btn w-8 h-8 flex items-center justify-center"
                  title="Chat history"
                >
                  <History className="w-4 h-4" />
                </button>
                {historyOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-surface)] shadow-lg z-20 overflow-hidden">
                    {modesWithHistory.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs text-[var(--sa-text-dim)]">No conversations yet.</p>
                    ) : (
                      modesWithHistory.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setMode(m.id);
                            setHistoryOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[var(--sa-surface-hover)] ${
                            m.id === mode ? 'text-[var(--sa-text)] font-medium' : 'text-[var(--sa-text-muted)]'
                          }`}
                        >
                          {m.agentName}
                          <span className="text-[10px] text-[var(--sa-text-dim)]">
                            {(histories[m.id] ?? []).filter((msg) => msg.role !== 'tool').length}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={clearChat}
                className="sa-icon-btn w-8 h-8 flex items-center justify-center"
                title="Clear this chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub-mode chips only — shown compact, inline, no full mode selector during chat */}
          {activeMode.hasSubMode && activeMode.subModes && (
            <div className="shrink-0 flex gap-1.5 pt-2">
              {activeMode.subModes.map((s) => {
                const Icon = s.icon;
                const active = subMode === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSubMode(s.id)}
                    className={`sa-pill ${active ? 'sa-pill-active' : ''}`}
                    style={{ padding: '0.3125rem 0.625rem', fontSize: '0.6875rem' }}
                  >
                    <Icon className="w-3 h-3" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Scrollable conversation only — plain prose for assistant, soft bubble for user */}
          <div ref={scrollRef} className="sa-chat-scroll flex-1 overflow-y-auto pt-4 pb-2 space-y-6 min-h-0">
            {visibleMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={
                    m.role === 'user'
                      ? 'sa-chat-bubble-user max-w-[75%] rounded-3xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap'
                      : 'sa-chat-bubble-assistant w-full min-w-0 text-[15px] leading-[1.7]'
                  }
                >
                  {m.image && (
                    <img src={m.image} alt="Uploaded attachment" className="rounded-xl mb-2 max-h-56 object-contain" />
                  )}

                  {m.actions?.length ? (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {m.actions.map((a, ai) => (
                        <span
                          key={ai}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--sa-surface)] text-[var(--sa-text-muted)]"
                        >
                          {a.name === 'web_search' ? <Globe className="w-3 h-3" /> : a.ok ? <Check className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                          {a.name.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {m.role === 'assistant' && m.usedSources?.length ? (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {m.usedSources.map((s, si) => (
                        <span
                          key={si}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--sa-surface)] text-[var(--sa-text-muted)]"
                          title={s.title}
                        >
                          <Library className="w-3 h-3" />
                          {s.title}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {m.searches?.map((s, si) => (
                    <div key={si} className="rounded-xl p-3 mb-2 space-y-2 bg-[var(--sa-surface)] border border-[var(--sa-border)]">
                      <p className="text-[11px] font-semibold text-[var(--sa-text-muted)] flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Sources for "{s.query}"
                      </p>
                      {s.error && <p className="text-[11px] text-rose-500">{s.error}</p>}
                      {s.results.map((r, ri) => (
                        <a
                          key={ri}
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg px-2 py-1.5 hover:bg-[var(--sa-surface-hover)] transition-colors"
                        >
                          <p className="text-xs font-medium text-[var(--sa-text)] flex items-center gap-1">
                            {r.title}
                            <ExternalLink className="w-3 h-3 text-[var(--sa-text-dim)]" />
                          </p>
                          <p className="text-[11px] text-[var(--sa-text-dim)] line-clamp-2">{r.snippet}</p>
                        </a>
                      ))}
                    </div>
                  ))}

                  {m.role === 'assistant' ? (
                    m.content ? (
                      <Markdown content={m.content} />
                    ) : streaming && i === visibleMessages.length - 1 ? (
                      <span className="text-[var(--sa-text-dim)]">{toolStatus ? `Running ${toolStatus}…` : 'Thinking…'}</span>
                    ) : null
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="px-1 pb-2 text-xs text-rose-500">{error}</p>}

          {/* Composer — fixed at bottom, no divider line */}
          <div className="shrink-0 pt-2 pb-3">
            {mode === 'writing' && <QuintilianAiCheck text={input} />}
            <ChatInputBar
              input={input}
              onInput={setInput}
              onSend={send}
              onStop={stop}
              streaming={streaming}
              models={FREE_MODELS}
              model={model}
              onModelChange={setModel}
              visionModel={visionModel}
              speechSupported={speechSupported}
              listening={listening}
              onToggleListening={toggleListening}
              onPickImage={pickImage}
              image={image}
              onClearImage={() => setImage(null)}
              placeholder={listening ? 'Listening… speak now' : `Ask ${activeMode.agentName}… (Enter to send, Shift+Enter for new line)`}
              showWeissSources={mode === 'research'}
            />
          </div>
        </div>
      )}

      {sourcesOpen && (
        <SourcesPanel
          mode={mode}
          sources={sources}
          onChange={() => setSourcesTick((t) => t + 1)}
          onClose={() => setSourcesOpen(false)}
        />
      )}
    </div>
  );
}
