import { useState, useEffect, type ReactNode } from 'react';
import { SUBJECTS, NUM_TERMS } from '@/lib/types';
import GlobalDock from '@/components/GlobalDock';
import {
  LayoutDashboard, Calculator, FolderTree, SquareCheck as CheckSquare, Calendar,
  Timer, BarChart3, CalendarHeart, StickyNote, Wallet, Menu, X,
  Layers, Bot, Settings as SettingsIcon,
} from 'lucide-react';

export type PageId =
  | 'dashboard' | 'grades' | 'forecast' | 'classhub'
  | 'assistant' | 'todos' | 'kanban' | 'calendar' | 'notes'
  | 'pomodoro' | 'analytics'
  | 'habits' | 'finance' | 'flashcards'
  | 'settings';

interface NavItem {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 'grades', label: 'Grade Calculator', icon: Calculator, group: 'Academic' },
  { id: 'forecast', label: 'Grade Forecaster', icon: BarChart3, group: 'Academic' },
  { id: 'classhub', label: 'Class Hub', icon: FolderTree, group: 'Academic' },
  { id: 'assistant', label: 'Study Assistant', icon: Bot, group: 'Academic' },
  { id: 'todos', label: 'To-Do List', icon: CheckSquare, group: 'Tasks' },
  { id: 'kanban', label: 'Kanban Board', icon: LayoutDashboard, group: 'Tasks' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, group: 'Tasks' },
  { id: 'notes', label: 'Notes & Board', icon: StickyNote, group: 'Tasks' },
  { id: 'pomodoro', label: 'Focus Timer', icon: Timer, group: 'Focus' },
  { id: 'analytics', label: 'Focus Analytics', icon: BarChart3, group: 'Focus' },
  { id: 'habits', label: 'Habit Tracker', icon: CalendarHeart, group: 'Personal' },
  { id: 'finance', label: 'Baon Tracker', icon: Wallet, group: 'Personal' },
  { id: 'flashcards', label: 'Flashcards', icon: Layers, group: 'Personal' },
];

const GROUPS = ['Overview', 'Academic', 'Tasks', 'Focus', 'Personal'];

export function usePageState(): [PageId, (p: PageId) => void] {
  const [page, setPage] = useState<PageId>(() => {
    const hash = window.location.hash.slice(1) as PageId;
    return NAV_ITEMS.some((n) => n.id === hash) ? hash : 'dashboard';
  });

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1) as PageId;
      if (NAV_ITEMS.some((n) => n.id === hash)) setPage(hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (p: PageId) => {
    window.location.hash = p;
    setPage(p);
  };

  return [page, navigate];
}

export default function AppLayout({ page, navigate, children }: { page: PageId; navigate: (p: PageId) => void; children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentLabel = NAV_ITEMS.find((n) => n.id === page)?.label ?? 'Dashboard';
  const isAssistant = page === 'assistant';

  useEffect(() => {
    document.title = `${currentLabel} — epicure`;
  }, [currentLabel]);

  return (
    /* Fixed full-viewport shell — no document scrollbar */
    <div className="relative flex h-screen overflow-hidden bg-zinc-100">
      {/* Ambient liquid-glass blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-zinc-300/25 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-zinc-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-white/40 blur-3xl" />
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-zinc-900/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed bottom-4 left-4 top-4 z-40 w-60 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-[280px] lg:translate-x-0'
        }`}
      >
        <div className="glass-dark glass-shadow-lg flex h-full flex-col overflow-hidden rounded-3xl">
          <div className="flex h-16 shrink-0 items-center gap-3 px-5">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white/10">
              <img
                src="https://cdn-icons-png.flaticon.com/512/3582/3582676.png"
                alt="epicure"
                className="h-5 w-5 invert"
              />
            </div>
            <span className="text-lg font-bold text-white">epicure</span>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3">
            {GROUPS.map((group) => (
              <div key={group} className="mb-3">
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{group}</p>
                {NAV_ITEMS.filter((n) => n.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = page === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        navigate(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                        active ? 'bg-white/15 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="shrink-0 border-t border-white/5 p-3">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                G
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-200">Grade 10</p>
                <p className="text-xs text-zinc-500">
                  {SUBJECTS.length} subjects · {NUM_TERMS} terms
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('settings')}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  page === 'settings' ? 'bg-white/15 text-white' : 'text-zinc-500 hover:bg-white/10 hover:text-white'
                }`}
                title="Settings"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main workspace column */}
      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden lg:pl-[17rem]">
        {/* Mobile header */}
        <header className="z-20 shrink-0 px-3 pt-4 lg:hidden">
          <div className="glass glass-shadow flex h-10 items-center justify-between rounded-xl px-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded-lg p-1.5 hover:bg-zinc-200/50"
                title="Toggle sidebar"
              >
                {sidebarOpen ? <X className="h-4 w-4 text-zinc-700" /> : <Menu className="h-4 w-4 text-zinc-700" />}
              </button>
              <h1 className="truncate text-sm font-semibold text-zinc-800">{currentLabel}</h1>
            </div>
          </div>
        </header>

        {/* Page content — scrolls unless assistant (assistant manages its own panes) */}
        <main
          className={
            isAssistant
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-20 pt-4 lg:px-6'
              : 'min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4 lg:px-6'
          }
        >
          {children}
        </main>
      </div>

      <GlobalDock navigate={navigate} page={page} />
    </div>
  );
}
