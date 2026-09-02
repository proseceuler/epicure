import { getSaplingKey } from './apiKeys';

export interface AiDetectionResult {
  score: number; // 0-1, likelihood the text is AI-generated
  sentenceScores?: { sentence: string; score: number }[];
}

const SAPLING_ENDPOINT = 'https://api.sapling.ai/api/v1/aidetect';

/**
 * Sends text to Sapling's AI Detector API. Requires a Sapling key
 * configured in Settings — throws a clear error if missing so the UI
 * can prompt the user rather than fail silently.
 */
export async function detectAiContent(text: string): Promise<AiDetectionResult> {
  const key = getSaplingKey();
  if (!key) {
    throw new Error('Sapling requires an API key — add it in Settings to use the AI detector.');
  }
  if (!text.trim()) {
    throw new Error('Nothing to check — paste or write some text first.');
  }

  const res = await fetch(SAPLING_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, text, sent_scores: true }),
  });

  if (!res.ok) {
    throw new Error(`Sapling request failed (${res.status})`);
  }

  const data = await res.json();
  return {
    score: typeof data.score === 'number' ? data.score : 0,
    sentenceScores: Array.isArray(data.sentence_scores)
      ? data.sentence_scores.map((s: any) => ({ sentence: s.sentence, score: s.score }))
      : undefined,
  };
}

export function verdictLabel(score: number): string {
  if (score >= 0.8) return 'Likely AI-generated';
  if (score >= 0.5) return 'Possibly AI-generated';
  if (score >= 0.2) return 'Likely human-written, some AI-like phrasing';
  return 'Likely human-written';
}
