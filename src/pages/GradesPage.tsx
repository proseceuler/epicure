import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { SUBJECTS, SUBJECT_MAP, EX_BREAKDOWN, NUM_TERMS, type Assessment, type SubjectKey, type ComponentType, type ExType } from '@/lib/types';
import {
  computeTermGrade,
  computeFinalGrade,
  gradeDescriptor,
  componentPercentage,
  exComponentPercentage,
  neededOnRemaining,
  termSeries,
  PASSING,
  DEFAULT_TARGET,
} from '@/lib/gradeUtils';
import { Card, PageHeader, Button, Input, Badge, gradeColor } from '@/components/kit';
import { Calculator, Plus, Trash2, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';

const COMPONENT_LABELS: Record<ComponentType, string> = { ww: 'Written Works', pt: 'Performance Tasks', ex: 'Examinations' };
const COMPONENT_SHORT: Record<ComponentType, string> = { ww: 'WW', pt: 'PT', ex: 'EX' };
const EX_LABELS: Record<ExType, string> = { st1: 'Summative Test 1', st2: 'Summative Test 2', te: 'Term Examination' };
const EX_ORDER: ExType[] = ['st1', 'st2', 'te'];

const PILL = 'px-3 py-1.5 rounded-xl text-sm font-medium transition-all';
const PILL_ON = 'bg-zinc-900 text-white';
const PILL_OFF = 'glass text-zinc-600 glass-hover';

function TermSpark({ values, className = '' }: { values: (number | null)[]; className?: string }) {
  const nums = values.map((v) => (v == null ? null : v));
  const known = nums.filter((v): v is number => v != null);
  if (known.length === 0) {
    return <span className={`text-[11px] text-zinc-300 ${className}`}>no terms yet</span>;
  }
  const min = Math.min(70, ...known);
  const max = Math.max(100, ...known);
  const w = 72;
  const h = 22;
  const pts = nums.map((v, i) => {
    const x = (i / Math.max(1, nums.length - 1)) * (w - 4) + 2;
    const y = v == null ? null : h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
    return { x, y };
  });
  const drawn = pts.filter((p): p is { x: number; y: number } => p.y != null);
  const d = drawn.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = drawn[drawn.length - 1];
  const first = drawn[0];
  const up = last && first ? last.y <= first.y : true;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`overflow-visible ${className}`} width={w} height={h} aria-hidden>
      <motion.path
        d={d}
        fill="none"
        stroke={up ? '#18181b' : '#71717a'}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      {pts.map((p, i) =>
        p.y == null ? null : (
          <circle key={i} cx={p.x} cy={p.y} r="1.8" fill="#18181b" />
        ),
      )}
    </svg>
  );
}

function AddForm({
  name, score, max, onName, onScore, onMax, onAdd, onCancel, namePlaceholder,
}: {
  name: string; score: string; max: string;
  onName: (v: string) => void; onScore: (v: string) => void; onMax: (v: string) => void;
  onAdd: () => void; onCancel: () => void; namePlaceholder: string;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-2 pt-2">
        <Input value={name} onChange={onName} placeholder={namePlaceholder} className="rounded-2xl" />
        <Input value={score} onChange={onScore} placeholder="Score" type="number" className="rounded-2xl" />
        <Input value={max} onChange={onMax} placeholder="Max" type="number" className="rounded-2xl" />
        <div className="flex items-center gap-2 pt-0.5">
          <Button size="sm" onClick={onAdd}>Add</Button>
          <button type="button" onClick={onCancel} className="px-2 py-1 text-sm text-zinc-500 hover:text-zinc-800">
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function AddTrigger({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      whileHover={{ x: 2 }}
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900"
    >
      <Plus className="w-3.5 h-3.5" />
      Add
    </motion.button>
  );
}

export default function GradesPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<SubjectKey>('math');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [adding, setAdding] = useState<{ component: ComponentType; exType?: ExType } | null>(null);
  const [newName, setNewName] = useState('');
  const [newScore, setNewScore] = useState('');
  const [newMax, setNewMax] = useState('');

  const loadAssessments = useCallback(async () => {
    const { data, error } = await supabase.from('assessments').select('*').order('created_at', { ascending: true });
    if (!error && data) setAssessments(data as Assessment[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAssessments(); }, [loadAssessments]);

  const subjectAssessments = assessments.filter(
    (a) => a.subject_key === selectedSubject && a.quarter === selectedTerm
  );

  const termGrade = computeTermGrade(selectedSubject, selectedTerm, assessments);
  const finalGrade = computeFinalGrade(selectedSubject, assessments);
  const subject = SUBJECT_MAP[selectedSubject];
  const series = termSeries(selectedSubject, assessments);
  const need = neededOnRemaining(selectedSubject, selectedTerm, assessments, DEFAULT_TARGET);

  const termGrades = useMemo(() => {
    return SUBJECTS.map((s) => ({
      ...s,
      term: computeTermGrade(s.key, selectedTerm, assessments),
      series: termSeries(s.key, assessments),
      final: computeFinalGrade(s.key, assessments),
    }));
  }, [assessments, selectedTerm]);

  const ranked = termGrades.filter((s) => s.term != null) as Array<(typeof termGrades)[number] & { term: number }>;
  const highest = ranked.length ? ranked.reduce((a, b) => (a.term >= b.term ? a : b)) : null;
  const lowest = ranked.length ? ranked.reduce((a, b) => (a.term <= b.term ? a : b)) : null;
  const atRisk = termGrades.filter((s) => s.term != null && s.term < PASSING);

  const openAdd = (component: ComponentType, exType?: ExType) => {
    setAdding({ component, exType });
    setNewName('');
    setNewScore('');
    setNewMax('');
  };

  const addAssessment = async (component: ComponentType, exType?: ExType) => {
    if (!newName.trim() || !newScore || !newMax) return;
    const score = parseFloat(newScore);
    const maxScore = parseFloat(newMax);
    if (isNaN(score) || isNaN(maxScore) || maxScore <= 0) return;

    const { data } = await supabase
      .from('assessments')
      .insert({
        subject_key: selectedSubject,
        quarter: selectedTerm,
        component,
        ex_type: exType ?? null,
        name: newName.trim(),
        score,
        max_score: maxScore,
      })
      .select()
      .single();

    if (data) setAssessments([...assessments, data as Assessment]);
    setNewName(''); setNewScore(''); setNewMax(''); setAdding(null);
  };

  const deleteAssessment = async (id: string) => {
    await supabase.from('assessments').delete().eq('id', id);
    setAssessments(assessments.filter((a) => a.id !== id));
  };

  const renderItems = (items: Assessment[]) =>
    items.map((a) => (
      <div key={a.id} className="flex items-center gap-3 py-1 text-sm group">
        <span className="flex-1 min-w-0 truncate text-zinc-600">{a.name}</span>
        <span className="text-zinc-500 tabular-nums shrink-0">{a.score}/{a.max_score}</span>
        <span className="text-zinc-400 w-11 text-right tabular-nums shrink-0">{((a.score / a.max_score) * 100).toFixed(0)}%</span>
        <button
          type="button"
          onClick={() => deleteAssessment(a.id)}
          className="text-zinc-300 hover:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    ));

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Calculator className="w-8 h-8 text-zinc-300 animate-pulse" /></div>;
  }

  const descriptor = termGrade !== null ? gradeDescriptor(termGrade) : null;
  const finalDescriptor = finalGrade !== null ? gradeDescriptor(finalGrade) : null;

  return (
    <div>
      <PageHeader
        title="Grades"
        subtitle={`WW ${subject.weights.ww}% \u00b7 PT ${subject.weights.pt}% \u00b7 EX ${subject.weights.ex}%`}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {SUBJECTS.map((s) => {
          const active = selectedSubject === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSelectedSubject(s.key)}
              className={`${PILL} ${active ? PILL_ON : PILL_OFF}`}
            >
              {s.shortName}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {Array.from({ length: NUM_TERMS }, (_, i) => i + 1).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSelectedTerm(t)}
            className={`${PILL} ${selectedTerm === t ? PILL_ON : PILL_OFF}`}
          >
            Term {t}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-4 space-y-3">
          <Card className="px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-zinc-400">Final \u00b7 {subject.shortName}</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-xl font-semibold tabular-nums leading-none ${gradeColor(finalGrade)}`}>
                    {finalGrade !== null ? finalGrade.toFixed(1) : '\u2014'}
                  </span>
                  {finalDescriptor && <Badge tone={finalDescriptor.tone}>{finalDescriptor.label}</Badge>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <TermSpark values={series} />
                <div className="flex gap-1.5 text-[10px] text-zinc-400 tabular-nums">
                  {series.map((g, i) => (
                    <span key={i}>T{i + 1} {g != null ? g.toFixed(0) : '\u2014'}</span>
                  ))}
                </div>
              </div>
            </div>
            {descriptor && termGrade != null && (
              <p className="text-[11px] text-zinc-400 mt-1.5">
                Term {selectedTerm}: <span className={`font-medium ${gradeColor(termGrade)}`}>{termGrade.toFixed(1)}</span>
                <span className="text-zinc-300"> \u00b7 {descriptor.label}</span>
              </p>
            )}
          </Card>

          <Card className="px-3.5 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1.5">All subjects</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {termGrades.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelectedSubject(s.key)}
                  className={`flex items-center justify-between gap-2 text-left rounded-lg px-1 -mx-1 py-px hover:bg-zinc-100/70 ${
                    s.key === selectedSubject ? 'bg-zinc-100/80' : ''
                  }`}
                >
                  <span className="text-[11px] text-zinc-600 truncate">{s.shortName}</span>
                  <span className={`text-[11px] font-semibold tabular-nums ${gradeColor(s.term)}`}>
                    {s.term != null ? s.term.toFixed(0) : '\u2014'}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            {(['ww', 'pt', 'ex'] as ComponentType[]).map((component, idx) => {
              const items = subjectAssessments.filter((a) => a.component === component);
              const pct = componentPercentage(subjectAssessments, component);
              const weight = subject.weights[component];
              const isAddingHere = adding?.component === component && !adding.exType;
              return (
                <div key={component} className={idx > 0 ? 'border-t border-zinc-200/50' : ''}>
                  <div className="flex items-center gap-2 px-3.5 py-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-900 text-white">
                      {COMPONENT_SHORT[component]}
                    </span>
                    <span className="text-[13px] font-medium text-zinc-700">{COMPONENT_LABELS[component]}</span>
                    <span className="text-[11px] text-zinc-400">{weight}% weight</span>
                    <span className="ml-auto text-[11px] text-zinc-400 tabular-nums">
                      {items.length} item{items.length === 1 ? '' : 's'}
                    </span>
                    {items.length > 0 && (
                      <span className={`text-[12px] font-semibold tabular-nums ${pct >= 75 ? 'text-zinc-900' : 'text-zinc-400'}`}>
                        {pct.toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {component === 'ex' ? (
                    <div className="px-3 pb-2.5 space-y-1.5">
                      {EX_ORDER.map((exType) => {
                        const exItems = items.filter((a) => a.ex_type === exType);
                        const exPct = exComponentPercentage(subjectAssessments, exType);
                        const isAddingEx = adding?.component === 'ex' && adding.exType === exType;
                        return (
                          <div key={exType} className="rounded-xl bg-zinc-50/80 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-medium text-zinc-600">
                                {EX_LABELS[exType]}
                                <span className="ml-1 font-normal text-zinc-400">{EX_BREAKDOWN[exType]}% of EX</span>
                              </span>
                              <span className="ml-auto text-[12px] font-semibold text-zinc-400 tabular-nums">
                                {exItems.length > 0 ? `${exPct.toFixed(0)}%` : '\u2014'}
                              </span>
                            </div>
                            {exItems.length > 0 && <div className="mt-1">{renderItems(exItems)}</div>}
                            <AnimatePresence initial={false} mode="wait">
                              {isAddingEx ? (
                                <AddForm
                                  key="form"
                                  name={newName}
                                  score={newScore}
                                  max={newMax}
                                  onName={setNewName}
                                  onScore={setNewScore}
                                  onMax={setNewMax}
                                  onAdd={() => addAssessment('ex', exType)}
                                  onCancel={() => setAdding(null)}
                                  namePlaceholder="Name"
                                />
                              ) : (
                                <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1">
                                  <AddTrigger onClick={() => openAdd('ex', exType)} />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-3.5 pb-2.5">
                      {items.length > 0 && <div className="mb-1">{renderItems(items)}</div>}
                      <AnimatePresence initial={false} mode="wait">
                        {isAddingHere ? (
                          <AddForm
                            key="form"
                            name={newName}
                            score={newScore}
                            max={newMax}
                            onName={setNewName}
                            onScore={setNewScore}
                            onMax={setNewMax}
                            onAdd={() => addAssessment(component)}
                            onCancel={() => setAdding(null)}
                            namePlaceholder="Name"
                          />
                        ) : (
                          <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <AddTrigger onClick={() => openAdd(component)} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </div>

        <div className="lg:col-span-8 grid sm:grid-cols-2 gap-3">
          <Card className="px-4 py-3 sm:col-span-2">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">To hit {DEFAULT_TARGET}</p>
            <p className="mt-1 text-sm font-medium text-zinc-800 leading-snug">{need.message}</p>
            {need.needed != null && need.possible && !need.alreadyMet && (
              <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">
                {need.needed}
                <span className="ml-1.5 text-sm font-medium text-zinc-400">on {need.on}</span>
              </p>
            )}
          </Card>

          <Card className="px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">This term</p>
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Highest
                </span>
                <span className="text-[12px] font-semibold text-zinc-800">
                  {highest ? `${highest.shortName} \u00b7 ${highest.term.toFixed(1)}` : '\u2014'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                  <ArrowDownRight className="w-3.5 h-3.5" /> Lowest
                </span>
                <span className="text-[12px] font-semibold text-zinc-800">
                  {lowest ? `${lowest.shortName} \u00b7 ${lowest.term.toFixed(1)}` : '\u2014'}
                </span>
              </div>
            </div>
          </Card>

          <Card className="px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> At risk
              <span className="ml-auto font-semibold text-zinc-700">{atRisk.length}</span>
            </p>
            {atRisk.length === 0 ? (
              <p className="mt-2 text-[12px] text-zinc-500">None below {PASSING} this term.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {atRisk.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSelectedSubject(s.key)}
                    className={`${PILL} ${PILL_OFF} !py-1 !text-[11px]`}
                  >
                    {s.shortName} {s.term?.toFixed(0)}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
