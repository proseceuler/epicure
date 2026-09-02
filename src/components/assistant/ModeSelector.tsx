import { MODES, type ModeId, type SubModeId } from './constants';

export default function ModeSelector({
  mode,
  subMode,
  onMode,
  onSubMode,
  searchActive,
  searchAllowed,
  searchLabel,
  onToggleSearch,
}: {
  mode: ModeId;
  subMode: SubModeId | null;
  onMode: (m: ModeId) => void;
  onSubMode: (s: SubModeId) => void;
  searchActive: boolean;
  searchAllowed: boolean;
  searchLabel: string;
  onToggleSearch: () => void;
}) {
  const activeDef = MODES.find((m) => m.id === mode)!;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Mode pills */}
      <div className="flex flex-wrap gap-2 justify-center">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              onClick={() => onMode(m.id)}
              className={`sa-pill ${active ? 'sa-pill-active' : ''}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Sub-mode chips for Coding Agent (Dahl → Turing) */}
      {activeDef.hasSubMode && activeDef.subModes && (
        <div className="flex gap-1.5">
          {activeDef.subModes.map((s) => {
            const Icon = s.icon;
            const active = subMode === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSubMode(s.id)}
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

      {/* Web search toggle — visually distinct */}
      {searchAllowed && (
        <button
          onClick={onToggleSearch}
          className={`sa-search-pill ${searchActive ? 'sa-search-pill-active' : ''}`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          {searchLabel}
        </button>
      )}
    </div>
  );
}
