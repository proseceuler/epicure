import { useState, useEffect } from 'react';
import { getHeadline, type ModeId } from './constants';

export default function DynamicHeadline({ mode }: { mode: ModeId }) {
  const [text, setText] = useState(() => getHeadline(mode));
  const [fading, setFading] = useState(false);
  const [displayMode, setDisplayMode] = useState(mode);

  useEffect(() => {
    if (mode === displayMode) return;
    setFading(true);
    const t = setTimeout(() => {
      setText(getHeadline(mode));
      setDisplayMode(mode);
      setFading(false);
    }, 180);
    return () => clearTimeout(t);
  }, [mode, displayMode]);

  const fontClass = MODES_FONT[displayMode] ?? 'sa-font-default';

  return (
    <h2
      className={`sa-headline-transition sa-font-default text-2xl sm:text-3xl text-center ${fontClass} ${
        fading ? 'sa-headline-fade-out' : 'sa-headline-fade-in'
      }`}
      style={{ fontWeight: 600, letterSpacing: '-0.02em' }}
    >
      {text}
    </h2>
  );
}

const MODES_FONT: Record<ModeId, string> = {
  study: 'sa-font-rounded',
  coding: 'sa-font-mono',
  math: 'sa-font-default',
  flashcards: 'sa-font-rounded',
  writing: 'sa-font-serif',
  summarize: 'sa-font-serif',
  research: 'sa-font-editorial',
};
