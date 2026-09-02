import {
  GraduationCap, Code as Code2, PenLine, Sigma,
  FileText, Layers, BookOpen, FlaskConical,
} from 'lucide-react';

export type ModeId =
  | 'study' | 'coding' | 'math' | 'flashcards'
  | 'writing' | 'summarize' | 'research';

export type SubModeId = 'qa' | 'testing';

export interface ModeDef {
  id: ModeId;
  label: string;
  agentName: string;
  icon: typeof GraduationCap;
  system: string;
  starter: string;
  fontClass: string;
  headlines: Record<string, string[]>;
  hasSubMode?: boolean;
  subModes?: { id: SubModeId; label: string; icon: typeof GraduationCap; system: string }[];
}

export interface ModelDef {
  value: string;
  label: string;
  description: string;
  vision: boolean;
}

export const FREE_MODELS: ModelDef[] = [
  { value: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron 3 Ultra 550B', description: 'Strongest reasoning across all modes', vision: false },
  { value: 'nvidia/nemotron-3.5-lightning:free', label: 'Nemotron 3.5 Lightning', description: 'Fastest responses, great for quick Q&A', vision: false },
  { value: 'poolside/laguna-s-2.1:free', label: 'Laguna S 2.1', description: 'Optimized for code generation', vision: false },
  { value: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B', description: 'Vision-capable, good for images', vision: true },
  { value: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', label: 'Nemotron Nano Omni', description: 'Multimodal reasoning with vision', vision: true },
];

export const TOOL_PROMPT =
  '\n\nYou are connected to the student\'s own epicure app and can use tools to read and change their data (tasks, notes, calendar, flashcards, grades, habits, focus timer, baon/expenses). Prefer reading real data with the get_* tools before answering questions about "my" tasks, grades, schedule or spending. When the student asks you to add, log, schedule or start something, actually call the matching tool instead of only describing it, then confirm what you did in one short line. Dates must be YYYY-MM-DD.';

export const SEARCH_PROMPT =
  ' You also have web_search. Call it whenever the answer depends on current, factual or external information you are unsure about, then cite the sources you used by title.';

function timeHeadlines(): Record<string, string[]> {
  return {
    morning: ['Good morning. What shall we think through?', 'Morning! What are we exploring today?', 'Let\'s start the day right. What\'s on your mind?'],
    afternoon: ['Good afternoon. What shall we think through?', 'What are we working on this afternoon?', 'Let\'s dive in. What needs attention?'],
    evening: ['Good evening. What shall we think through?', 'Evening session — what are we studying?', 'What\'s on your mind tonight?'],
    night: ['Burning the midnight oil? What shall we think through?', 'Late night thinking. What are we solving?', 'Can\'t sleep? What\'s on your mind?'],
  };
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

export function getHeadline(mode: ModeId): string {
  const tod = getTimeOfDay();
  const def = MODES.find((m) => m.id === mode)!;
  const variants = def.headlines[tod] ?? def.headlines['afternoon'];
  return pick(variants);
}

export const MODES: ModeDef[] = [
  {
    id: 'study',
    label: 'Study Assistant',
    agentName: 'Arrodes',
    icon: GraduationCap,
    fontClass: 'sa-font-rounded',
    system:
      'You are a patient Grade 10 study tutor. Explain concepts clearly with simple language, short paragraphs and concrete examples from the student\'s subjects (Math, Science, English, Filipino, Araling Panlipunan, MAPEH, TLE, ESP). Ask a short clarifying question when the request is vague. Use markdown-style headings and bullet lists. Never just give an answer to graded work without explaining the reasoning.',
    starter: 'Explain the law of conservation of energy with a real-life example.',
    headlines: {
      morning: ['Good morning. What shall we learn today?', 'Morning! Ready to explore something new?', 'What topic is on your mind this morning?'],
      afternoon: ['What shall we learn today?', 'Ready to dive into a topic?', 'What are we studying this afternoon?'],
      evening: ['Evening study session. What shall we learn?', 'What topic are we exploring tonight?'],
      night: ['Late night studying? What shall we learn?', 'What\'s on your mind tonight?'],
    },
  },
  {
    id: 'coding',
    label: 'Coding Agent',
    agentName: 'Dahl',
    icon: Code2,
    fontClass: 'sa-font-mono',
    system:
      'You are a precise senior software engineer helping a Grade 10 student. Give working, runnable code in fenced code blocks with the language tag, then a short explanation of the key lines. When debugging, first state the likely cause, then the fix. Prefer small, readable solutions over clever ones. Mention edge cases briefly.',
    starter: 'Write a Python program that checks if a number is prime and explain it.',
    hasSubMode: true,
    subModes: [
      { id: 'qa', label: 'Q&A', icon: BookOpen, system: 'Answer coding questions clearly with short code examples.' },
      { id: 'testing', label: 'Code Testing', icon: FlaskConical, system: 'Write test cases and run through edge cases for the given code.' },
    ],
    headlines: {
      morning: ['Good morning. What are we building today?', 'Morning. What code can I help with?', 'What are we coding this morning?'],
      afternoon: ['What are we building today?', 'What code can I help with?', 'What are we coding this afternoon?'],
      evening: ['Evening coding session. What are we building?', 'What code are we working on tonight?'],
      night: ['Late night debugging? What are we building?', 'What code is on your mind tonight?'],
    },
  },
  {
    id: 'math',
    label: 'Math Solver',
    agentName: 'Gauss',
    icon: Sigma,
    fontClass: 'sa-font-default',
    system:
      'You are a meticulous math tutor. Solve problems step by step, numbering every step and stating the rule or formula used. Show the final answer clearly on its own line as **Answer:** ... Then add one short "Why this works" note. Use plain-text math notation that is easy to read.',
    starter: 'Solve step by step: 2x² - 5x - 3 = 0',
    headlines: {
      morning: ['Good morning. What are we solving?', 'Morning! What problem needs solving?', 'What are we calculating this morning?'],
      afternoon: ['What are we solving?', 'What problem needs solving?', 'What are we calculating this afternoon?'],
      evening: ['Evening math session. What are we solving?', 'What problem is on your mind tonight?'],
      night: ['Late night math? What are we solving?', 'What problem needs solving tonight?'],
    },
  },
  {
    id: 'flashcards',
    label: 'Flashcards & Quizzer',
    agentName: 'Mimir',
    icon: Layers,
    fontClass: 'sa-font-rounded',
    system:
      'You generate study flashcards. Output ONLY a numbered list where each item is formatted exactly as:\nQ: <question>\nA: <answer>\nMake 10 cards unless the user asks for a different number. Questions must be short and specific; answers must be one or two sentences. No intro or closing text. If the student asks you to save them, call add_flashcard for each card instead.',
    starter: 'Make flashcards about the parts of the cell.',
    headlines: {
      morning: ['Good morning. Ready to quiz yourself?', 'Morning! What are we memorizing?', 'What topic shall we turn into flashcards?'],
      afternoon: ['Ready to quiz yourself?', 'What are we memorizing?', 'What topic shall we turn into flashcards?'],
      evening: ['Evening review. Ready to quiz yourself?', 'What shall we turn into flashcards tonight?'],
      night: ['Late night review? Ready to quiz yourself?', 'What topic shall we turn into flashcards?'],
    },
  },
  {
    id: 'writing',
    label: 'Writing Helper',
    agentName: 'Quintilian',
    icon: PenLine,
    fontClass: 'sa-font-serif',
    system:
      'You are a supportive writing coach. Improve clarity, grammar, structure and tone while keeping the student\'s own voice. When rewriting, show the improved version first, then a short bullet list of what you changed and why. Never write an entire graded essay from scratch without offering an outline and guidance first.',
    starter: 'Improve this paragraph and tell me what you changed: ',
    headlines: {
      morning: ['Good morning. What shall we write today?', 'Morning! What needs refining?', 'What are we writing this morning?'],
      afternoon: ['What shall we write today?', 'What needs refining?', 'What are we writing this afternoon?'],
      evening: ['Evening writing session. What shall we write?', 'What needs refining tonight?'],
      night: ['Late night writing? What shall we write?', 'What needs refining tonight?'],
    },
  },
  {
    id: 'summarize',
    label: 'Summarizer',
    agentName: 'Sancho',
    icon: FileText,
    fontClass: 'sa-font-serif',
    system:
      'You are a summarizing expert for students. Produce: a one-sentence TL;DR, then 5-8 bullet key points, then a short "Terms to remember" list with quick definitions. Keep every bullet under 20 words. Preserve numbers, dates and names exactly.',
    starter: 'Summarize these notes:\n\n',
    headlines: {
      morning: ['Good morning. What should I condense?', 'Morning! What needs summarizing?', 'What are we condensing this morning?'],
      afternoon: ['What should I condense?', 'What needs summarizing?', 'What are we condensing this afternoon?'],
      evening: ['Evening. What should I condense?', 'What needs summarizing tonight?'],
      night: ['Late night reading? What should I condense?', 'What needs summarizing tonight?'],
    },
  },
  {
    id: 'research',
    label: 'Research & Citations',
    agentName: 'Weiss',
    icon: BookOpen,
    fontClass: 'sa-font-editorial',
    system:
      'You are a research assistant for a Grade 10 student. Find relevant, credible sources using web_search when needed. Present findings with proper citations (author, title, URL, date accessed). Distinguish between primary and secondary sources. Suggest search terms when the student is unsure where to start.',
    starter: 'Help me research the causes of the Philippine Revolution.',
    headlines: {
      morning: ['Good morning. What are we researching today?', 'Morning! What topic needs sources?', 'What are we investigating this morning?'],
      afternoon: ['What are we researching today?', 'What topic needs sources?', 'What are we investigating this afternoon?'],
      evening: ['Evening research. What are we investigating?', 'What topic needs sources tonight?'],
      night: ['Late night research? What are we investigating?', 'What topic needs sources?'],
    },
  },
];

export const SEARCH_MODES: ModeId[] = ['study', 'coding', 'research'];
