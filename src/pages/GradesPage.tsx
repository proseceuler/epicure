import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
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
import { Calculator, Plus, Trash2, ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';

const COMPONENT_LABELS: Record<ComponentType, string> = { ww: 'Written Works', pt: 'Performance Tasks', ex: 'Examinations' };
const COMPONENT_SHORT: Record<ComponentType, string> = { ww: 'WW', pt: 'PT', ex: 'EX' };
const EX_LABELS: Record<ExType, string> = { st1: 'Summative Test 1', st2: 'Summative Test 2', te: 'Term Examination' };

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

export default function GradesPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<SubjectKey>('math');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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

  const toggleExpand = (key: string) => setExpanded({ ...expanded, [key]: !expanded[key] });

  const renderComponentSection = (component: ComponentType) => {
    const items = subjectAssessments.filter((a) => a.component === component);
    const pct = componentPercentage(subjectAssessments, component);
    const key = component;
    const weight = subject.weights[component];

    return (
      <Card key={key} className="overflow-hidden">
        <button
          onClick={() => toggleExpand(key)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            {expanded[key] ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-900 text-white">{COMPONENT_SHORT[component]}</span>
              <span className="font-medium text-zinc-700">{COMPONENT_LABELS[component]}</span>
              <span className="text-xs text-zinc-400">({weight}% weight)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500">{items.length} items</span>
            <span className={`text-sm font-bold ${pct >= 75 ? 'text-zinc-900' : 'text-zinc-400'}`}>
              {items.length > 0 ? `${pct.toFixed(1)}%` : '\u2014'}
            </span>
          </div>
        </button>

        {expanded[key] && (
          <div className="border-t border-zinc-200/40">
            {items.length === 0 && component !== 'ex' && (
              <p className="px-4 py-3 text-sm text-zinc-400">No {COMPONENT_LABELS[component].toLowerCase()} added yet.</p>
            )}

            {component === 'ex' ? (
              <div className="divide-y divide-zinc-200/30">
                {(Object.keys(EX_LABELS) as ExType[]).map((exType) => {
                  const exItems = items.filter((a) => a.ex_type === exType);
                  const exPct = exComponentPercentage(subjectAssessments, exType);
                  const exKey = `ex-${exType}`;
                  return (
                    <div key={exType} className="px-4">
                      <button
                        onClick={() => toggleExpand(exKey)}
                        className="w-full flex items-center justify-between py-3 hover:bg-white/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {expanded[exKey] ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                          <span className="text-sm font-medium text-zinc-600">{EX_LABELS[exType]}</span>
                          <span className="text-xs text-zinc-400">({EX_BREAKDOWN[exType]}% of EX)</span>
                        </div>
                        <span className={`text-sm font-semibold ${exPct >= 75 ? 'text-zinc-900' : exItems.length > 0 ? 'text-zinc-400' : 'text-zinc-300'}`}>
                          {exItems.length > 0 ? `${exPct.toFixed(1)}%` : '\u2014'}
                        </span>
                      </button>
                      {expanded[exKey] && (
                        <div className="pb-3">
                          {exItems.map((a) => (
                            <div key={a.id} className="flex items-center gap-3 py-1.5 text-sm group">
                              <span className="flex-1 text-zinc-600">{a.name}</span>
                              <span className="text-zinc-500">{a.score}/{a.max_score}</span>
                              <span className="text-zinc-400 w-12 text-right">{((a.score / a.max_score) * 100).toFixed(1)}%</span>
                              <button onClick={() => deleteAssessment(a.id)} className="text-zinc-300 hover:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {adding?.component === 'ex' && adding?.exType === exType ? (
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Input value={newName} onChange={setNewName} placeholder="Test name" className="flex-1 min-w-[120px]" />
                              <Input value={newScore} onChange={setNewScore} placeholder="Score" type="number" className="w-20" />
                              <Input value={newMax} onChange={setNewMax} placeholder="Max" type="number" className="w-20" />
                              <Button size="sm" onClick={() => addAssessment('ex', exType)}>Add</Button>
                              <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAdding({ component: 'ex', exType }); setNewName(''); setNewScore(''); setNewMax(''); }}
                              className="flex items-center gap-1 text-xs text-zinc-700 hover:text-zinc-900 mt-2 font-medium"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add {EX_LABELS[exType]}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 pb-3">
                {items.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 py-1.5 text-sm group">
                    <span className="flex-1 text-zinc-600">{a.name}</span>
                    <span className="text-zinc-500">{a.score}/{a.max_score}</span>
                    <span className="text-zinc-400 w-12 text-right">{((a.score / a.max_score) * 100).toFixed(1)}%</span>
                    <button onClick={() => deleteAssessment(a.id)} className="text-zinc-300 hover:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {adding?.component === component && !adding.exType ? (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Input value={newName} onChange={setNewName} placeholder="Assessment name" className="flex-1 min-w-[120px]" />
                    <Input value={newScore} onChange={setNewScore} placeholder="Score" type="number" className="w-20" />
                    <Input value={newMax} onChange={setNewMax} placeholder="Max" type="number" className="w-20" />
                    <Button size="sm" onClick={() => addAssessment(component)}>Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAdding({ component }); setNewName(''); setNewScore(''); setNewMax(''); }}
                    className="flex items-center gap-1 text-xs text-zinc-700 hover:text-zinc-900 mt-2 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add {COMPONENT_LABELS[component].replace(/s$/, '')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

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

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {SUBJECTS.map((s) => {
          const active = selectedSubject === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSelectedSubject(s.key)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                active
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-600 ring-1 ring-zinc-200/90 hover:bg-zinc-50'
              }`}
            >
              {s.shortName}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mb-5">
        {Array.from({ length: NUM_TERMS }, (_, i) => i + 1).map((t) => (
          <button
            key={t}
            onClick={() => setSelectedTerm(t)}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              selectedTerm === t
                ? 'bg-zinc-900 text-white'
                : 'bg-white text-zinc-600 ring-1 ring-zinc-200/90 hover:bg-zinc-50'
            }`}
          >
            Term {t}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-4 mb-5 items-start">
        <div className="lg:col-span-5 space-y-3">
          <Card className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">Final \u00b7 {subject.shortName}</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className={`text-2xl font-semibold tabular-nums leading-none ${gradeColor(finalGrade)}`}>
                    {finalGrade !== null ? finalGrade.toFixed(1) : '\u2014'}
                  </span>
                  {finalDescriptor && <Badge tone={finalDescriptor.tone}>{finalDescriptor.label}</Badge>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <TermSpark values={series} />
                <div className="flex gap-2 text-[10px] text-zinc-400 tabular-nums">
                  {series.map((g, i) => (
                    <span key={i}>T{i + 1} {g != null ? g.toFixed(0) : '\u2014'}</span>
                  ))}
                </div>
              </div>
            </div>
            {descriptor && termGrade != null && (
              <p className="text-[11px] text-zinc-400 mt-2">
                Term {selectedTerm}: <span className={`font-medium ${gradeColor(termGrade)}`}>{termGrade.toFixed(1)}</span>
                <span className="text-zinc-300"> \u00b7 {descriptor.label}</span>
              </p>
            )}
          </Card>

          <Card className="px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-400 mb-2">All subjects</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {termGrades.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSelectedSubject(s.key)}
                  className={`flex items-center justify-between gap-2 text-left rounded-lg px-1 -mx-1 py-0.5 hover:bg-zinc-100/70 ${
                    s.key === selectedSubject ? 'bg-zinc-100/80' : ''
                  }`}
                >
                  <span className="text-[12px] text-zinc-600 truncate">{s.shortName}</span>
                  <span className={`text-[12px] font-semibold tabular-nums ${gradeColor(s.term)}`}>
                    {s.term != null ? s.term.toFixed(0) : '\u2014'}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-7 grid sm:grid-cols-2 gap-3">
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
                    onClick={() => setSelectedSubject(s.key)}
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
                  >
                    {s.shortName} {s.term?.toFixed(0)}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="space-y-3">
        {(['ww', 'pt', 'ex'] as ComponentType[]).map(renderComponentSection)}
      </div>
    </div>
  );
}
