import { useState, useRef, useEffect } from 'react';
import { Plus, Image as ImageIcon, Mic, MicOff, Send, Square, X, Paperclip, Globe, Sparkles, Link2 } from 'lucide-react';
import ModelDropdown from './ModelDropdown';
import type { ModelDef } from './constants';

export default function ChatInputBar({
  input,
  onInput,
  onSend,
  onStop,
  streaming,
  models,
  model,
  onModelChange,
  visionModel,
  speechSupported,
  listening,
  onToggleListening,
  onPickImage,
  image,
  onClearImage,
  placeholder,
}: {
  input: string;
  onInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  models: ModelDef[];
  model: string;
  onModelChange: (v: string) => void;
  visionModel: boolean;
  speechSupported: boolean;
  listening: boolean;
  onToggleListening: () => void;
  onPickImage: (f: File) => void;
  image: string | null;
  onClearImage: () => void;
  placeholder: string;
}) {
  const [plusOpen, setPlusOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) setPlusOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="w-full max-w-2xl">
      {/* Image preview */}
      {image && (
        <div className="mb-2 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--sa-surface)] border border-[var(--sa-border)]">
          <img src={image} alt="Preview" className="w-8 h-8 rounded object-cover" />
          <span className="text-xs text-[var(--sa-text-muted)]">Image attached</span>
          <button onClick={onClearImage} className="sa-icon-btn p-0.5 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="sa-input-bar p-3">
        <textarea
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={3}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-[var(--sa-text)] placeholder-[var(--sa-text-dim)] resize-none focus:outline-none leading-relaxed"
          autoFocus
        />

        <div className="flex items-center justify-between mt-2">
          {/* Left: + menu + model dropdown */}
          <div className="flex items-center gap-1">
            {/* Plus menu */}
            <div ref={plusRef} className="relative">
              <button
                onClick={() => setPlusOpen((v) => !v)}
                className="sa-icon-btn w-8 h-8 flex items-center justify-center"
                title="Add"
              >
                <Plus className={`w-4 h-4 transition-transform ${plusOpen ? 'rotate-45' : ''}`} />
              </button>
              {plusOpen && (
                <div className="sa-plus-menu absolute bottom-full left-0 mb-2 w-56 p-1.5 z-50">
                  <button
                    onClick={() => { fileRef.current?.click(); setPlusOpen(false); }}
                    className="sa-plus-menu-item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs text-[var(--sa-text-muted)]"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    Add files / photos
                  </button>
                  <button
                    onClick={() => { onToggleListening(); setPlusOpen(false); }}
                    className="sa-plus-menu-item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs text-[var(--sa-text-muted)]"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    Voice input
                  </button>
                  <button
                    onClick={() => setPlusOpen(false)}
                    className="sa-plus-menu-item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs text-[var(--sa-text-muted)]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Skills
                  </button>
                  <button
                    onClick={() => setPlusOpen(false)}
                    className="sa-plus-menu-item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs text-[var(--sa-text-muted)]"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Add connector
                  </button>
                  <div className="border-t border-[var(--sa-border)] my-1" />
                  <button
                    onClick={() => setPlusOpen(false)}
                    className="sa-plus-menu-item w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs text-[var(--sa-text-muted)]"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Web search
                  </button>
                </div>
              )}
            </div>

            {/* Model dropdown */}
            <ModelDropdown models={models} value={model} onChange={onModelChange} />
          </div>

          {/* Right: image, mic, send/stop */}
          <div className="flex items-center gap-1">
            {visionModel && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onPickImage(file);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="sa-icon-btn w-8 h-8 flex items-center justify-center"
                  title="Attach an image"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </>
            )}

            {speechSupported && (
              <button
                onClick={onToggleListening}
                className={`sa-icon-btn w-8 h-8 flex items-center justify-center ${listening ? 'text-[var(--sa-accent)]' : ''}`}
                title={listening ? 'Stop voice input' : 'Voice input'}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            {streaming ? (
              <button
                onClick={onStop}
                className="sa-send-btn w-8 h-8 flex items-center justify-center"
                title="Stop generating"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!input.trim() && !image}
                className="sa-send-btn w-8 h-8 flex items-center justify-center"
                title="Send"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
