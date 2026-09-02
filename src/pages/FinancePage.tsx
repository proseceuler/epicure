import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  type FinanceSettings, type FinanceTransaction, type FinanceGoal,
  type ExpenseCategory, EXPENSE_CATEGORIES,
} from '@/lib/types';
import { Card, PageHeader, Button, Input, Select, EmptyState } from '@/components/kit';
import { Wallet, Plus, Trash2, Target, TrendingDown, PiggyBank, ArrowRight, TrendingUp } from 'lucide-react';

export default function FinancePage() {
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [goals, setGoals] = useState<FinanceGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: 'food' as ExpenseCategory, amount: '', description: '' });
  const [goalForm, setGoalForm] = useState({ name: '', target: '' });
  const [allowanceInput, setAllowanceInput] = useState('');
  const [periodInput, setPeriodInput] = useState<'weekly' | 'monthly'>('weekly');

  const loadData = useCallback(async () => {
    const [{ data: sData }, { data: tData }, { data: gData }] = await Promise.all([
      supabase.from('finance_settings').select('*').maybeSingle(),
      supabase.from('finance_transactions').select('*').order('transaction_date', { ascending: false }),
      supabase.from('finance_goals').select('*').order('created_at', { ascending: true }),
    ]);
    if (sData) {
      setSettings(sData as FinanceSettings);
      setAllowanceInput(String(sData.allowance_amount));
      setPeriodInput(sData.allowance_period);
    }
    if (tData) setTransactions(tData as FinanceTransaction[]);
    if (gData) setGoals(gData as FinanceGoal[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveAllowance = async () => {
    const amount = parseFloat(allowanceInput) || 0;
    if (settings) {
      const { data } = await supabase.from('finance_settings').update({
        allowance_amount: amount, allowance_period: periodInput, updated_at: new Date().toISOString(),
      }).eq('id', settings.id).select().single();
      if (data) setSettings(data as FinanceSettings);
    } else {
      const { data } = await supabase.from('finance_settings').insert({
        allowance_amount: amount, allowance_period: periodInput,
      }).select().single();
      if (data) setSettings(data as FinanceSettings);
    }
  };

  const addExpense = async () => {
    const amount = parseFloat(expenseForm.amount);
    if (isNaN(amount) || amount <= 0) return;
    const { data } = await supabase.from('finance_transactions').insert({
      category: expenseForm.category, amount, description: expenseForm.description.trim(),
    }).select().single();
    if (data) {
      setTransactions([data as FinanceTransaction, ...transactions]);
      setExpenseForm({ category: 'food', amount: '', description: '' });
      setShowAddExpense(false);
    }
  };

  const deleteExpense = async (id: string) => {
    await supabase.from('finance_transactions').delete().eq('id', id);
    setTransactions(transactions.filter((t) => t.id !== id));
  };

  const addGoal = async () => {
    const target = parseFloat(goalForm.target);
    if (!goalForm.name.trim() || isNaN(target) || target <= 0) return;
    const { data } = await supabase.from('finance_goals').insert({
      name: goalForm.name.trim(), target_amount: target, saved_amount: 0,
    }).select().single();
    if (data) {
      setGoals([...goals, data as FinanceGoal]);
      setGoalForm({ name: '', target: '' });
      setShowAddGoal(false);
    }
  };

  const deleteGoal = async (id: string) => {
    await supabase.from('finance_goals').delete().eq('id', id);
    setGoals(goals.filter((g) => g.id !== id));
  };

  const transferLeftover = async (goalId: string) => {
    if (!settings || totalSpent >= settings.allowance_amount) return;
    const leftover = settings.allowance_amount - totalSpent;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const newSaved = Math.min(goal.saved_amount + leftover, goal.target_amount);
    await supabase.from('finance_goals').update({ saved_amount: newSaved }).eq('id', goalId);
    setGoals(goals.map((g) => g.id === goalId ? { ...g, saved_amount: newSaved } : g));
  };

  const totalSpent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const remaining = settings ? Number(settings.allowance_amount) - totalSpent : 0;

  const today = new Date();
  const periodStart = settings ? new Date(settings.period_start_date) : today;
  const periodEnd = settings?.allowance_period === 'weekly'
    ? new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    : new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, periodStart.getDate());

  const remainingDays = Math.max(1, Math.ceil((periodEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const schoolDaysLeft = settings
    ? Math.max(1, Math.ceil(remainingDays * settings.school_days_per_week / 7))
    : 1;
  const dailySafeSpend = remaining > 0 ? remaining / schoolDaysLeft : 0;

  const categoryTotals = EXPENSE_CATEGORIES.map((cat) => ({
    ...cat,
    total: transactions.filter((t) => t.category === cat.key).reduce((sum, t) => sum + Number(t.amount), 0),
  }));

  // 14-day spending trend
  const spendingTrend = useMemo(() => {
    const days: { date: string; total: number; label: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const total = transactions
        .filter((t) => t.transaction_date === dStr)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      days.push({ date: dStr, total, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
    }
    return days;
  }, [transactions]);

  const maxDailySpend = Math.max(...spendingTrend.map((d) => d.total), 1);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Wallet className="w-8 h-8 text-zinc-300 animate-pulse" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Baon Tracker"
        subtitle="Student allowance manager · Track spending · Save for goals"
        action={<Button onClick={() => setShowAddExpense(!showAddExpense)}><Plus className="w-4 h-4" /> Add Expense</Button>}
      />

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Allowance — light card, dark text for readability */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-zinc-800">Allowance (Baon)</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Amount</label>
              <div className="flex gap-2">
                <Input value={allowanceInput} onChange={setAllowanceInput} type="number" placeholder="0" className="flex-1" />
                <Select
                  value={periodInput}
                  onChange={(v) => setPeriodInput(v as 'weekly' | 'monthly')}
                  options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }]}
                  className="w-28"
                />
              </div>
            </div>
            <Button onClick={saveAllowance} size="sm" className="w-full">Save Allowance</Button>
          </div>

          <div className="mt-6 pt-6 border-t border-zinc-200/40">
            <p className="text-xs font-medium text-zinc-500 mb-1">Daily Safe-to-Spend</p>
            <div className="text-4xl font-bold text-zinc-900">
              ₱{dailySafeSpend.toFixed(2)}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              ₱{remaining.toFixed(2)} left · {schoolDaysLeft} school days remaining
            </p>
          </div>
        </Card>

        {/* Spending breakdown */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-zinc-700" />
            </div>
            <span className="font-semibold text-zinc-800">Spending Breakdown</span>
          </div>
          <div className="space-y-3">
            {categoryTotals.map((cat) => {
              const pct = totalSpent > 0 ? (cat.total / totalSpent) * 100 : 0;
              return (
                <div key={cat.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-600">{cat.emoji} {cat.label}</span>
                    <span className="text-sm font-semibold text-zinc-800">₱{cat.total.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-zinc-200/50 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-900 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-200/40 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700">Total Spent</span>
            <span className="text-lg font-bold text-zinc-900">₱{totalSpent.toFixed(2)}</span>
          </div>
        </Card>

        {/* Savings Goals */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center">
                <PiggyBank className="w-5 h-5 text-zinc-700" />
              </div>
              <span className="font-semibold text-zinc-800">Savings Goals</span>
            </div>
            <button onClick={() => setShowAddGoal(!showAddGoal)} className="text-zinc-400 hover:text-zinc-700">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showAddGoal && (
            <div className="space-y-2 mb-3 pb-3 border-b border-zinc-200/40">
              <Input value={goalForm.name} onChange={(v) => setGoalForm({ ...goalForm, name: v })} placeholder="Goal name (e.g. Keyboard)" />
              <Input value={goalForm.target} onChange={(v) => setGoalForm({ ...goalForm, target: v })} type="number" placeholder="Target amount" />
              <Button onClick={addGoal} size="sm" className="w-full">Add Goal</Button>
            </div>
          )}

          {goals.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">No savings goals yet.</p>
          ) : (
            <div className="space-y-3">
              {goals.map((goal) => {
                const pct = goal.target_amount > 0 ? Math.min((goal.saved_amount / goal.target_amount) * 100, 100) : 0;
                return (
                  <div key={goal.id} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-700">{goal.name}</span>
                      </div>
                      <button onClick={() => deleteGoal(goal.id)} className="text-zinc-300 hover:text-zinc-600 opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>₱{goal.saved_amount.toFixed(2)}</span>
                      <span>₱{goal.target_amount.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-zinc-200/50 rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-zinc-900 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    {remaining > 0 && (
                      <button
                        onClick={() => transferLeftover(goal.id)}
                        className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 font-medium"
                      >
                        <ArrowRight className="w-3 h-3" /> Transfer leftover (₱{remaining.toFixed(2)})
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* 14-day spending trend */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-zinc-600" />
          <h3 className="font-semibold text-zinc-800">14-Day Spending Trend</h3>
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {spendingTrend.map((d) => {
            const h = (d.total / maxDailySpend) * 100;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[9px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  ₱{d.total.toFixed(0)}
                </span>
                <div
                  className={`w-full rounded-t transition-all ${d.total > 0 ? 'bg-zinc-700' : 'bg-zinc-200/50'}`}
                  style={{ height: `${Math.max(h, 2)}%`, minHeight: '2px' }}
                />
                <span className="text-[8px] text-zinc-400 whitespace-nowrap">{d.label.split(' ')[1]}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {showAddExpense && (
        <Card className="p-4 mb-6">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Category</label>
              <Select
                value={expenseForm.category}
                onChange={(v) => setExpenseForm({ ...expenseForm, category: v as ExpenseCategory })}
                options={EXPENSE_CATEGORIES.map((c) => ({ value: c.key, label: `${c.emoji} ${c.label}` }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Amount (₱)</label>
              <Input value={expenseForm.amount} onChange={(v) => setExpenseForm({ ...expenseForm, amount: v })} type="number" placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Description</label>
              <Input value={expenseForm.description} onChange={(v) => setExpenseForm({ ...expenseForm, description: v })} placeholder="Optional note" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={addExpense} size="sm">Add Expense</Button>
            <Button onClick={() => setShowAddExpense(false)} variant="ghost" size="sm">Cancel</Button>
          </div>
        </Card>
      )}

      {transactions.length === 0 ? (
        <EmptyState icon={Wallet} title="No expenses logged" subtitle="Add your first expense to start tracking your baon." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-zinc-200/40">
            {transactions.map((t) => {
              const cat = EXPENSE_CATEGORIES.find((c) => c.key === t.category);
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-white/30 transition-colors">
                  <span className="text-xl">{cat?.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-700">{t.description || cat?.label}</p>
                    <p className="text-xs text-zinc-400">{cat?.label} · {new Date(t.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <span className="text-sm font-bold text-zinc-900">₱{Number(t.amount).toFixed(2)}</span>
                  <button onClick={() => deleteExpense(t.id)} className="text-zinc-300 hover:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
