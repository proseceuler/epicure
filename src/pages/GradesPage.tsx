import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SUBJECTS, SUBJECT_MAP, EX_BREAKDOWN, NUM_TERMS, type Assessment, type SubjectKey, type ComponentType, type ExType } from '@/lib/types';
import { computeTermGrade, computeFinalGrade, gradeDescriptor, gradeTone, componentPercentage, exComponentPercentage } from '@/lib/gradeUtils';
import { Card, PageHeader, Button, Input, Select, Badge, EmptyState, SubjectBadge, gradeColor } from '@/components/kit';
import { Calculator, Plus, Trash2, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';

const COMPONENT_LABELS: Record<ComponentType, string> = { ww: 'Written Works', pt: 'Performance Tasks', ex: 'Examinations' };
const COMPONENT_SHORT: Record<ComponentType, string> = { ww: 'WW', pt: 'PT', ex: 'EX' };
const EX_LABELS: Record<ExType, string> = { st1: 'Summative Test 1', st2: 'Summative Test 2', te: 'Term Examination' };

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
              {items.length > 0 ? `${pct.toFixed(1)}%` : '—'}
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
                          {exItems.length > 0 ? `${exPct.toFixed(1)}%` : '—'}
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
        title="Grade Calculator"
        subtitle={`DepEd KS3 · WW ${subject.weights.ww}% · PT ${subject.weights.pt}% · EX ${subject.weights.ex}% (ST1 30% / ST2 30% / TE 40% of EX)`}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {SUBJECTS.map((s) => {
          const active = selectedSubject === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSelectedSubject(s.key)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                active
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                  : 'glass text-zinc-600 border-transparent glass-hover'
              }`}
            >
              {s.shortName}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mb-6">
        {Array.from({ length: NUM_TERMS }, (_, i) => i + 1).map((t) => (
          <button
            key={t}
            onClick={() => setSelectedTerm(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedTerm === t
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'glass text-zinc-600 glass-hover'
            }`}
          >
            Term {t}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-6 bg-zinc-900 border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-5 h-5 text-white" />
              <span className="font-medium text-white">{subject.name}</span>
            </div>
            <p className="text-sm text-zinc-400 mb-4">Term {selectedTerm} Grade</p>
            <div className="text-5xl font-bold text-white">
              {termGrade !== null ? termGrade.toFixed(2) : '—'}
            </div>
            {descriptor && (
              <div className="mt-3">
                <span className="inline-block px-2.5 py-1 rounded-md bg-white/10 text-xs font-medium text-white">
                  {descriptor.label}
                </span>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-sm text-zinc-500 mb-1">Final Grade (avg of terms)</p>
            <div className="flex items-baseline gap-3">
              <span className={`text-3xl font-bold ${gradeColor(finalGrade)}`}>
                {finalGrade !== null ? finalGrade.toFixed(2) : '—'}
              </span>
              {finalDescriptor && <Badge tone={finalDescriptor.tone}>{finalDescriptor.label}</Badge>}
            </div>
            <div className="mt-4 space-y-2">
              {Array.from({ length: NUM_TERMS }, (_, i) => i + 1).map((t) => {
                const tg = computeTermGrade(selectedSubject, t, assessments);
                return (
                  <div key={t} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">T{t}</span>
                    <span className={`font-semibold ${gradeColor(tg)}`}>
                      {tg !== null ? tg.toFixed(2) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-medium text-zinc-700 mb-3">All Subjects Overview</p>
            <div className="space-y-2">
              {SUBJECTS.map((s) => {
                const fg = computeFinalGrade(s.key, assessments);
                return (
                  <div key={s.key} className="flex items-center justify-between text-sm">
                    <button
                      onClick={() => setSelectedSubject(s.key)}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <SubjectBadge shortName={s.shortName} />
                    </button>
                    <span className={`font-semibold ${gradeColor(fg)}`}>
                      {fg !== null ? fg.toFixed(2) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {(['ww', 'pt', 'ex'] as ComponentType[]).map(renderComponentSection)}
        </div>
      </div>
    </div>
  );
}
