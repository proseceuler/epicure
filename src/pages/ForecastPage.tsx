import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SUBJECTS, SUBJECT_MAP, EX_BREAKDOWN, NUM_TERMS, type Assessment, type SubjectKey, type ComponentType, type ExType } from '@/lib/types';
import { computeTermGrade, gradeDescriptor } from '@/lib/gradeUtils';
import { Card, PageHeader, Button, Input, Badge, SubjectBadge, gradeColor } from '@/components/kit';
import { TrendingUp, Plus, Trash2, Lightbulb } from 'lucide-react';

interface ForecastItem {
  id: string;
  component: ComponentType;
  exType?: ExType;
  name: string;
  score: number;
  maxScore: number;
}

export default function ForecastPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectKey>('math');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [items, setItems] = useState<ForecastItem[]>([]);

  const loadAssessments = useCallback(async () => {
    const { data } = await supabase.from('assessments').select('*');
    if (data) setAssessments(data as Assessment[]);
  }, []);

  useEffect(() => { loadAssessments(); }, [loadAssessments]);

  const subject = SUBJECT_MAP[selectedSubject];
  const currentGrade = computeTermGrade(selectedSubject, selectedTerm, assessments);

  const hypotheticalAssessments: Assessment[] = items.map((item) => ({
    id: item.id,
    subject_key: selectedSubject,
    quarter: selectedTerm,
    component: item.component,
    ex_type: item.exType ?? null,
    name: item.name,
    score: item.score,
    max_score: item.maxScore,
  }));

  const allAssessments = [...assessments, ...hypotheticalAssessments];
  const forecastedGrade = computeTermGrade(selectedSubject, selectedTerm, allAssessments);

  const addItem = (component: ComponentType, exType?: ExType) => {
    setItems([...items, {
      id: crypto.randomUUID(),
      component,
      exType,
      name: '',
      score: 0,
      maxScore: 100,
    }]);
  };

  const updateItem = (id: string, field: keyof ForecastItem, value: string | number) => {
    setItems(items.map((i) => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => setItems(items.filter((i) => i.id !== id));

  const COMPONENT_LABELS: Record<ComponentType, string> = { ww: 'Written Works', pt: 'Performance Tasks', ex: 'Examinations' };
  const EX_LABELS: Record<ExType, string> = { st1: 'Summative Test 1', st2: 'Summative Test 2', te: 'Term Examination' };

  const gradeDiff = forecastedGrade !== null && currentGrade !== null ? forecastedGrade - currentGrade : 0;

  return (
    <div>
      <PageHeader
        title="Term Grade Forecaster"
        subtitle="Add hypothetical scores to see how they would affect your term grade"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {SUBJECTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSelectedSubject(s.key)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
              selectedSubject === s.key ? 'bg-zinc-900 text-white border-zinc-900' : 'glass text-zinc-600 border-transparent glass-hover'
            }`}
          >
            {s.shortName}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6">
        {Array.from({ length: NUM_TERMS }, (_, i) => i + 1).map((t) => (
          <button
            key={t}
            onClick={() => setSelectedTerm(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedTerm === t ? 'bg-zinc-900 text-white' : 'glass text-zinc-600 glass-hover'
            }`}
          >
            Term {t}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {(['ww', 'pt', 'ex'] as ComponentType[]).map((comp) => (
            <Card key={comp} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-900 text-white">{comp.toUpperCase()}</span>
                  <span className="font-medium text-zinc-700">{COMPONENT_LABELS[comp]}</span>
                  <span className="text-xs text-zinc-400">({subject.weights[comp]}%)</span>
                </div>
                {comp !== 'ex' ? (
                  <Button size="sm" variant="secondary" onClick={() => addItem(comp)}>
                    <Plus className="w-3.5 h-3.5" /> Add Hypothetical
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    {(Object.keys(EX_LABELS) as ExType[]).map((et) => (
                      <Button key={et} size="sm" variant="secondary" onClick={() => addItem('ex', et)}>
                        <Plus className="w-3.5 h-3.5" /> {EX_LABELS[et]}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {comp === 'ex' ? (
                <div className="space-y-3">
                  {(Object.keys(EX_LABELS) as ExType[]).map((et) => {
                    const exItems = items.filter((i) => i.component === 'ex' && i.exType === et);
                    if (exItems.length === 0) return null;
                    return (
                      <div key={et}>
                        <p className="text-xs text-zinc-500 mb-1.5">{EX_LABELS[et]} ({EX_BREAKDOWN[et]}% of EX)</p>
                        {exItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 mb-1.5">
                            <Input value={item.name} onChange={(v) => updateItem(item.id, 'name', v)} placeholder="Name" className="flex-1" />
                            <Input value={String(item.score)} onChange={(v) => updateItem(item.id, 'score', parseFloat(v) || 0)} type="number" placeholder="Score" className="w-20" />
                            <span className="text-zinc-400">/</span>
                            <Input value={String(item.maxScore)} onChange={(v) => updateItem(item.id, 'maxScore', parseFloat(v) || 0)} type="number" placeholder="Max" className="w-20" />
                            <button onClick={() => removeItem(item.id)} className="text-zinc-300 hover:text-zinc-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                items.filter((i) => i.component === comp).length === 0 ? (
                  <p className="text-sm text-zinc-400">No hypothetical items added.</p>
                ) : (
                  items.filter((i) => i.component === comp).map((item) => (
                    <div key={item.id} className="flex items-center gap-2 mb-1.5">
                      <Input value={item.name} onChange={(v) => updateItem(item.id, 'name', v)} placeholder="Name" className="flex-1" />
                      <Input value={String(item.score)} onChange={(v) => updateItem(item.id, 'score', parseFloat(v) || 0)} type="number" placeholder="Score" className="w-20" />
                      <span className="text-zinc-400">/</span>
                      <Input value={String(item.maxScore)} onChange={(v) => updateItem(item.id, 'maxScore', parseFloat(v) || 0)} type="number" placeholder="Max" className="w-20" />
                      <button onClick={() => removeItem(item.id)} className="text-zinc-300 hover:text-zinc-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))
                )
              )}
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card className="p-6 bg-zinc-900 border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-white" />
              <span className="font-medium text-white">Forecast</span>
            </div>
            <p className="text-sm text-zinc-400 mb-1">Current Grade</p>
            <div className="text-3xl font-bold text-white mb-3">{currentGrade !== null ? currentGrade.toFixed(2) : '—'}</div>
            <p className="text-sm text-zinc-400 mb-1">With Hypothetical Scores</p>
            <div className="text-4xl font-bold text-white mb-2">{forecastedGrade !== null ? forecastedGrade.toFixed(2) : '—'}</div>
            {gradeDiff !== 0 && currentGrade !== null && forecastedGrade !== null && (
              <div className="text-sm font-medium text-zinc-300">
                {gradeDiff > 0 ? '+' : ''}{gradeDiff.toFixed(2)} points
              </div>
            )}
          </Card>

          {forecastedGrade !== null && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-700">Projected Descriptor</span>
              </div>
              <Badge tone={gradeDescriptor(forecastedGrade).tone}>{gradeDescriptor(forecastedGrade).label}</Badge>
              <p className="text-xs text-zinc-500 mt-3">
                Passing grade is 75. Scores you enter here are hypothetical and won't be saved.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
