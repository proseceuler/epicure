import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SUBJECTS, type FlashcardDeck, type Flashcard, type SubjectKey } from '@/lib/types';
import { Card, PageHeader, Button, Input, Select, EmptyState, Badge } from '@/components/kit';
import { Plus, Trash2, Layers, ChevronLeft, ChevronRight, RotateCcw, Check, X, BookOpen } from 'lucide-react';

type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

const RATING_INTERVALS: Record<ReviewRating, (card: Flashcard) => { interval: number; ease: number }> = {
  again: () => ({ interval: 0, ease: 0 }),
  hard: (card) => ({ interval: Math.max(1, card.interval_days * 0.8), ease: Math.max(1.3, card.ease_factor - 0.15) }),
  good: (card) => ({ interval: card.interval_days === 0 ? 1 : Math.round(card.interval_days * card.ease_factor), ease: card.ease_factor }),
  easy: (card) => ({ interval: card.interval_days === 0 ? 2 : Math.round(card.interval_days * card.ease_factor * 1.3), ease: Math.min(2.5, card.ease_factor + 0.15) }),
};

export default function FlashcardsPage() {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
  const [showAddDeck, setShowAddDeck] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<Flashcard[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // New deck form
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckSubject, setNewDeckSubject] = useState<SubjectKey | ''>('');

  // New card form
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');

  const loadData = useCallback(async () => {
    const [{ data: deckData }, { data: cardData }] = await Promise.all([
      supabase.from('flashcard_decks').select('*').order('name'),
      supabase.from('flashcards').select('*'),
    ]);
    if (deckData) setDecks(deckData as FlashcardDeck[]);
    if (cardData) setCards(cardData as Flashcard[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date().toISOString().split('T')[0];
  const deckCards = (deckId: string) => cards.filter((c) => c.deck_id === deckId);
  const dueCards = (deckId: string) => cards.filter((c) => c.deck_id === deckId && c.due_date <= today);

  const createDeck = async () => {
    if (!newDeckName.trim()) return;
    const { data } = await supabase.from('flashcard_decks').insert({
      name: newDeckName.trim(),
      subject_key: newDeckSubject || null,
    }).select().single();
    if (data) setDecks([...decks, data as FlashcardDeck]);
    setNewDeckName(''); setNewDeckSubject('');
    setShowAddDeck(false);
  };

  const createCard = async () => {
    if (!newCardFront.trim() || !selectedDeck) return;
    const { data } = await supabase.from('flashcards').insert({
      deck_id: selectedDeck.id,
      front: newCardFront.trim(),
      back: newCardBack.trim(),
      interval_days: 0,
      ease_factor: 2.5,
      due_date: today,
      review_count: 0,
    }).select().single();
    if (data) setCards([...cards, data as Flashcard]);
    setNewCardFront(''); setNewCardBack('');
    setShowAddCard(false);
  };

  const deleteDeck = async (id: string) => {
    await supabase.from('flashcards').delete().eq('deck_id', id);
    await supabase.from('flashcard_decks').delete().eq('id', id);
    setDecks(decks.filter((d) => d.id !== id));
    setCards(cards.filter((c) => c.deck_id !== id));
    if (selectedDeck?.id === id) setSelectedDeck(null);
  };

  const deleteCard = async (id: string) => {
    await supabase.from('flashcards').delete().eq('id', id);
    setCards(cards.filter((c) => c.id !== id));
  };

  const startReview = (deck: FlashcardDeck) => {
    const due = dueCards(deck.id);
    if (due.length === 0) return;
    setReviewQueue(due);
    setReviewIndex(0);
    setShowAnswer(false);
    setReviewMode(true);
  };

  const rateCard = async (rating: ReviewRating) => {
    const card = reviewQueue[reviewIndex];
    if (!card) return;
    const { interval, ease } = RATING_INTERVALS[rating](card);
    const newDue = new Date();
    newDue.setDate(newDue.getDate() + Math.ceil(interval));
    const updated = {
      interval_days: Math.ceil(interval),
      ease_factor: ease,
      due_date: newDue.toISOString().split('T')[0],
      review_count: card.review_count + 1,
    };
    await supabase.from('flashcards').update(updated).eq('id', card.id);
    setCards(cards.map((c) => c.id === card.id ? { ...c, ...updated } : c));

    if (reviewIndex + 1 < reviewQueue.length) {
      setReviewIndex(reviewIndex + 1);
      setShowAnswer(false);
    } else {
      setReviewMode(false);
    }
  };

  const totalDue = cards.filter((c) => c.due_date <= today).length;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Layers className="w-8 h-8 text-zinc-300 animate-pulse" /></div>;
  }

  // Review mode
  if (reviewMode && reviewQueue.length > 0) {
    const card = reviewQueue[reviewIndex];
    return (
      <div>
        <PageHeader
          title="Review Session"
          subtitle={`Card ${reviewIndex + 1} of ${reviewQueue.length}`}
          action={<Button variant="ghost" onClick={() => setReviewMode(false)}>Exit Review</Button>}
        />
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 min-h-[300px] flex flex-col items-center justify-center text-center">
            <p className="text-xs text-zinc-400 mb-4">Front</p>
            <p className="text-xl font-medium text-zinc-800 mb-6">{card.front}</p>

            {showAnswer ? (
              <>
                <div className="w-full border-t border-zinc-200/40 pt-6 mb-6">
                  <p className="text-xs text-zinc-400 mb-2">Back</p>
                  <p className="text-lg text-zinc-700">{card.back}</p>
                </div>
                <p className="text-sm text-zinc-500 mb-3">How well did you know this?</p>
                <div className="grid grid-cols-4 gap-2 w-full max-w-md">
                  <button onClick={() => rateCard('again')} className="py-3 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors">
                    Again
                  </button>
                  <button onClick={() => rateCard('hard')} className="py-3 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors">
                    Hard
                  </button>
                  <button onClick={() => rateCard('good')} className="py-3 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors">
                    Good
                  </button>
                  <button onClick={() => rateCard('easy')} className="py-3 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors">
                    Easy
                  </button>
                </div>
              </>
            ) : (
              <Button onClick={() => setShowAnswer(true)} className="px-8 py-3">
                <BookOpen className="w-4 h-4" /> Show Answer
              </Button>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Deck view
  if (selectedDeck) {
    const dCards = deckCards(selectedDeck.id);
    const dDue = dueCards(selectedDeck.id);
    const subject = SUBJECTS.find((s) => s.key === selectedDeck.subject_key);

    return (
      <div>
        <PageHeader
          title={selectedDeck.name}
          subtitle={`${dCards.length} cards · ${dDue.length} due today`}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedDeck(null)}><ChevronLeft className="w-4 h-4" /> Back</Button>
              <Button size="sm" onClick={() => setShowAddCard(true)}><Plus className="w-4 h-4" /> Add Card</Button>
              {dDue.length > 0 && (
                <Button size="sm" onClick={() => startReview(selectedDeck)}>
                  <RotateCcw className="w-4 h-4" /> Review ({dDue.length})
                </Button>
              )}
            </div>
          }
        />

        {dCards.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon={Layers} title="No cards in this deck" subtitle="Add your first flashcard to start studying." />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {dCards.map((card) => {
              const isDue = card.due_date <= today;
              const isOverdue = card.due_date < today;
              return (
                <Card key={card.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-zinc-700 flex-1">{card.front}</p>
                    <button onClick={() => deleteCard(card.id)} className="p-1 rounded-lg hover:bg-red-50 shrink-0">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                  <div className="border-t border-zinc-200/30 pt-2 mt-2">
                    <p className="text-xs text-zinc-500">{card.back}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {isDue ? (
                      <Badge tone="high">Due now</Badge>
                    ) : (
                      <Badge>Next: {new Date(card.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Badge>
                    )}
                    <span className="text-xs text-zinc-400">· {card.review_count} reviews</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add card modal */}
        {showAddCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/30 backdrop-blur-sm" onClick={() => setShowAddCard(false)}>
            <div className="glass glass-shadow-lg rounded-3xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-zinc-800 mb-4">Add Flashcard</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500 mb-1 block">Front (Question)</label>
                  <textarea value={newCardFront} onChange={(e) => setNewCardFront(e.target.value)} className="w-full px-3 py-2 glass-input rounded-xl text-sm text-zinc-700 resize-none h-20" placeholder="What is the question?" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500 mb-1 block">Back (Answer)</label>
                  <textarea value={newCardBack} onChange={(e) => setNewCardBack(e.target.value)} className="w-full px-3 py-2 glass-input rounded-xl text-sm text-zinc-700 resize-none h-20" placeholder="What is the answer?" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={createCard}><Plus className="w-4 h-4" /> Add Card</Button>
                  <Button variant="ghost" onClick={() => setShowAddCard(false)}>Cancel</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Deck list view
  return (
    <div>
      <PageHeader
        title="Flashcards"
        subtitle="Spaced repetition decks for every subject"
        action={
          <div className="flex items-center gap-3">
            {totalDue > 0 && <Badge tone="high">{totalDue} due today</Badge>}
            <Button size="sm" onClick={() => setShowAddDeck(true)}><Plus className="w-4 h-4" /> New Deck</Button>
          </div>
        }
      />

      {decks.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Layers} title="No flashcard decks yet" subtitle="Create a deck per subject and start building your study cards." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => {
            const dCards = deckCards(deck.id);
            const dDue = dueCards(deck.id).length;
            const subject = SUBJECTS.find((s) => s.key === deck.subject_key);
            return (
              <Card key={deck.id} className="p-5" onClick={() => setSelectedDeck(deck)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl glass flex items-center justify-center">
                      <Layers className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-800">{deck.name}</p>
                      {subject && <p className="text-xs text-zinc-400">{subject.shortName}</p>}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteDeck(deck.id); }} className="p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="font-bold text-zinc-700">{dCards.length}</span>
                    <span className="text-zinc-400 ml-1">cards</span>
                  </div>
                  {dDue > 0 && (
                    <div>
                      <span className="font-bold text-amber-600">{dDue}</span>
                      <span className="text-zinc-400 ml-1">due</span>
                    </div>
                  )}
                </div>
                {dDue > 0 && (
                  <Button size="sm" className="w-full mt-3" onClick={() => startReview(deck)}>
                    <RotateCcw className="w-3.5 h-3.5" /> Start Review
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add deck modal */}
      {showAddDeck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/30 backdrop-blur-sm" onClick={() => setShowAddDeck(false)}>
          <div className="glass glass-shadow-lg rounded-3xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-zinc-800 mb-4">New Flashcard Deck</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Deck Name</label>
                <Input value={newDeckName} onChange={setNewDeckName} placeholder="e.g. Math Chapter 3" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 mb-1 block">Subject (optional)</label>
                <Select value={newDeckSubject} onChange={(v) => setNewDeckSubject(v as SubjectKey | '')} options={[{ value: '', label: 'No subject' }, ...SUBJECTS.map((s) => ({ value: s.key, label: s.name }))]} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={createDeck}><Plus className="w-4 h-4" /> Create Deck</Button>
                <Button variant="ghost" onClick={() => setShowAddDeck(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
