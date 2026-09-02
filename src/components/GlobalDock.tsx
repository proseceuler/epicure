import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { usePomodoro } from '@/context/PomodoroContext';
import { supabase } from '@/lib/supabase';
import type { PageId } from '@/components/AppLayout';
import ScientificCalculator from '@/components/ScientificCalculator';
import DictionaryWidget from '@/components/DictionaryWidget';
import QuickImportModal from '@/components/QuickImportModal';
import CodsworthPanel from '@/components/CodsworthPanel';
import {
  Calculator, BookOpen, Plus, Timer, Play, Pause, Square,
  GripHorizontal, X, StickyNote, Bot, Sparkles,
} from 'lucide-react';

type DockTab = 'main' | 'pomodoro' | 'calculator' | 'dictionary' | 'quicktask' | 'quicknote';

const TASKS_PAGES: PageId[] = ['todos', 'kanban', 'calendar', 'notes'];

export default function GlobalDock({ navigate, page }: { navigate: (p: PageId) => void; page: PageId }) {
  const pomodoro = usePomodoro();
  const [open, setOpen] = useState(false);
  const [codsworthOpen, setCodsworthOpen] = useState(false);
  const onTasksPage = TASKS_PAGES.includes(page);
  const [codsworthVisible, setCodsworthVisible] = useState(onTasksPage);
  const [codsworthLeaving, setCodsworthLeaving] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>('main');
  const [calcDetached, setCalcDetached] = useState(false);
  const [dictDetached, setDictDetached] = useState(false);
  const [quickTask, setQuickTask] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (onTasksPage) {
      setCodsworthLeaving(false);
      setCodsworthVisible(true);
    } else {
      setCodsworthOpen(false);
      setCodsworthLeaving(true);
      timer = setTimeout(() => {
        setCodsworthVisible(false);
        setCodsworthLeaving(false);
      }, 320);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [onTasksPage]);

  const minutes = Math.floor(pomodoro.timeLeft / 60);
  const seconds = pomodoro.timeLeft % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const openTab = (tab: DockTab) => {
    setOpen(true);
    setActiveTab(tab);
    if (tab === 'pomodoro') pomodoro.setDockOpen(true);
    else if (activeTab === 'pomodoro' && pomodoro.isRunning) pomodoro.floatAway();
  };

  const closeTab = () => {
    if (activeTab === 'pomodoro' && pomodoro.isRunning) pomodoro.floatAway();
    setActiveTab('main');
    pomodoro.setDockOpen(false);
  };

  const addQuickTask = async () => {
    if (!quickTask.trim()) return;
    await supabase.from('todos').insert({ title: quickTask.trim(), priority: 'not_urgent_important' });
    setQuickTask('');
    setActiveTab('main');
    navigate('todos');
  };

  const addQuickNote = async () => {
    if (!quickNote.trim()) return;
    const title = quickNote.trim().split('\n')[0].slice(0, 60);
    await supabase.from('notes').insert({
      title: title || 'Untitled',
      content: quickNote.trim(),
      folder: 'Quick Capture',
      tags: ['sticky'],
      pinned: true,
    });
    setQuickNote('');
    setActiveTab('main');
    try {
      sessionStorage.setItem('epicure-open-folder', 'Quick Capture');
    } catch {
      /* ignore */
    }
    navigate('notes');
  };

  return (
    <>
      <QuickImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      {pomodoro.isFloating && pomodoro.isRunning && <FloatingPomodoro />}

      {activeTab === 'calculator' && calcDetached && (
        <ScientificCalculator
          detached
          onDetach={() => setCalcDetached(true)}
          onSnapBack={() => setCalcDetached(false)}
          onClose={() => {
            setCalcDetached(false);
            setActiveTab('main');
          }}
        />
      )}

      {activeTab === 'dictionary' && dictDetached && (
        <DictionaryWidget
          detached
          onDetach={() => setDictDetached(true)}
          onSnapBack={() => setDictDetached(false)}
          onClose={() => {
            setDictDetached(false);
            setActiveTab('main');
          }}
        />
      )}

      {codsworthVisible && codsworthOpen && (
        <CodsworthPanel page={page} onClose={() => setCodsworthOpen(false)} />
      )}

      <div className="fixed bottom-4 right-4 z-50">
        <div className="flex flex-row items-end gap-2">
          <AnimatePresence>
          {open && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="glass glass-shadow-lg flex items-center gap-1 rounded-2xl px-2 py-2"
            >
              {activeTab === 'main' && (
                <>
                  <DockButton icon={Calculator} label="Calculator" onClick={() => openTab('calculator')} />
                  <DockButton icon={BookOpen} label="Dictionary" onClick={() => openTab('dictionary')} />
                  <DockButton icon={StickyNote} label="Sticky Note" onClick={() => openTab('quicknote')} />
                  <DockButton icon={Plus} label="Quick Task" onClick={() => openTab('quicktask')} />
                  <div className="mx-0.5 h-8 w-px bg-zinc-300/40" />
                  <DockButton
                    icon={Bot}
                    label="Ask AI"
                    onClick={() => {
                      setOpen(false);
                      navigate('assistant');
                    }}
                  />
                  <DockButton
                    icon={Sparkles}
                    label="Import"
                    onClick={() => {
                      setOpen(false);
                      setImportOpen(true);
                    }}
                  />
                  <div className="mx-0.5 h-8 w-px bg-zinc-300/40" />
                  <DockButton
                    icon={Timer}
                    label="Focus"
                    onClick={() => openTab('pomodoro')}
                    active={pomodoro.isRunning}
                    badge={pomodoro.isRunning ? timeStr : undefined}
                  />
                </>
              )}

              {activeTab === 'pomodoro' && (
                <div className="flex min-w-[280px] items-center gap-2 px-2 py-1">
                  <div className="flex items-center gap-2">
                    {pomodoro.isRunning ? (
                      <button
                        type="button"
                        onClick={pomodoro.pause}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white transition-all hover:bg-zinc-800"
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={pomodoro.start}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white transition-all hover:bg-zinc-800"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={pomodoro.reset}
                      className="glass glass-hover flex h-9 w-9 items-center justify-center rounded-xl text-zinc-600"
                    >
                      <Square className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-2xl font-bold tabular-nums text-zinc-900">{timeStr}</div>
                    <div className="text-[10px] capitalize text-zinc-400">
                      {pomodoro.sessionType.replace('_', ' ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeTab}
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-200/50"
                  >
                    <X className="h-4 w-4 text-zinc-500" />
                  </button>
                </div>
              )}

              {activeTab === 'calculator' && !calcDetached && (
                <div className="relative">
                  <ScientificCalculator
                    detached={false}
                    onDetach={() => setCalcDetached(true)}
                    onSnapBack={() => setCalcDetached(false)}
                    onClose={closeTab}
                  />
                </div>
              )}

              {activeTab === 'dictionary' && !dictDetached && (
                <div className="relative">
                  <DictionaryWidget
                    detached={false}
                    onDetach={() => setDictDetached(true)}
                    onSnapBack={() => setDictDetached(false)}
                    onClose={closeTab}
                  />
                </div>
              )}

              {activeTab === 'quicktask' && (
                <div className="flex min-w-[300px] items-center gap-2 px-2 py-1">
                  <Plus className="h-5 w-5 shrink-0 text-zinc-400" />
                  <input
                    value={quickTask}
                    onChange={(e) => setQuickTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addQuickTask()}
                    placeholder="Quick add task..."
                    className="min-w-[120px] flex-1 bg-transparent text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={addQuickTask}
                    className="shrink-0 rounded-lg bg-zinc-900 px-2 py-1 text-xs font-medium text-white"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={closeTab}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-zinc-200/50"
                  >
                    <X className="h-4 w-4 text-zinc-500" />
                  </button>
                </div>
              )}

              {activeTab === 'quicknote' && (
                <div className="flex min-w-[300px] items-center gap-2 px-2 py-1">
                  <StickyNote className="h-5 w-5 shrink-0 text-amber-500" />
                  <input
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addQuickNote()}
                    placeholder="Sticky note..."
                    className="min-w-[120px] flex-1 bg-transparent text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={addQuickNote}
                    className="shrink-0 rounded-lg bg-zinc-900 px-2 py-1 text-xs font-medium text-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={closeTab}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-zinc-200/50"
                  >
                    <X className="h-4 w-4 text-zinc-500" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
          </AnimatePresence>

          <div className="flex flex-col-reverse items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={() => {
                if (open) {
                  if (activeTab === 'pomodoro' && pomodoro.isRunning) pomodoro.floatAway();
                  setActiveTab('main');
                  pomodoro.setDockOpen(false);
                  setOpen(false);
                } else {
                  setOpen(true);
                  setActiveTab('main');
                }
              }}
              aria-label={open ? 'Close tools' : 'Open tools'}
              className={
                open
                  ? 'relative flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-transform active:scale-95'
                  : 'relative flex h-14 w-14 items-center justify-center rounded-full glass glass-shadow-lg text-zinc-800 transition-transform active:scale-95'
              }
            >
              <Plus className={`h-6 w-6 transition-transform duration-200 ${open ? 'rotate-45' : ''}`} />
              {pomodoro.isRunning && !open && (
                <span className="absolute -right-1 -top-1 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
                  {timeStr}
                </span>
              )}
            </motion.button>

            {codsworthVisible && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                key="codsworth-fab"
                type="button"
                onClick={() => setCodsworthOpen((v) => !v)}
                aria-label={codsworthOpen ? 'Close Codsworth' : 'Open Codsworth'}
                className={
                  (codsworthOpen
                    ? 'relative flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-transform active:scale-95'
                    : 'relative flex h-14 w-14 items-center justify-center rounded-full glass glass-shadow-lg text-zinc-800 transition-transform active:scale-95') +
                  (codsworthLeaving ? ' codsworth-split-out' : ' codsworth-split-in')
                }
                title="Codsworth — drag the panel header to move it"
              >
                <Bot className="h-5 w-5" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DockButton({
  icon: Icon,
  label,
  onClick,
  active,
  badge,
}: {
  icon: typeof Calculator;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      whileHover={{ y: -2 }}
      type="button"
      onClick={onClick}
      className={`flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all ${
        active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-200/50'
      }`}
      title={label}
    >
      <Icon className="h-5 w-5" />
      {badge ? (
        <span className="text-[10px] font-bold tabular-nums">{badge}</span>
      ) : (
        <span className="text-[10px] font-medium">{label}</span>
      )}
    </motion.button>
  );
}

function FloatingPomodoro() {
  const pomodoro = usePomodoro();
  const [pos, setPos] = useState({ x: window.innerWidth - 220, y: 80 });
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const minutes = Math.floor(pomodoro.timeLeft / 60);
  const seconds = pomodoro.timeLeft % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      setPos({ x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y });
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onDragStart = (e: React.MouseEvent) => {
    draggingRef.current = true;
    offsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  return (
    <div
      className="fixed z-[60] overflow-hidden rounded-2xl glass-dark glass-shadow-lg"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="flex cursor-move items-center gap-2 px-3 py-2"
        onMouseDown={onDragStart}
        onClick={() => {
          if (!draggingRef.current) pomodoro.snapBack();
        }}
      >
        <GripHorizontal className="h-4 w-4 text-zinc-500" />
        <div className="flex items-center gap-2">
          {pomodoro.isRunning ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pomodoro.pause();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pomodoro.start();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              pomodoro.reset();
              pomodoro.snapBack();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
          >
            <Square className="h-3 w-3" />
          </button>
        </div>
        <span className="text-lg font-bold tabular-nums text-white">{timeStr}</span>
      </div>
    </div>
  );
}
