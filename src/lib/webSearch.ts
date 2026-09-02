import { getTavilyKey } from '@/lib/apiKeys';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  answer?: string;
  results: SearchResult[];
  error?: string;
}

export async function tavilySearch(query: string, maxResults = 5): Promise<SearchResponse> {
  const key = getTavilyKey();
  if (!key) {
    return { query, results: [], error: 'No Tavily API key set. Add one in Settings to enable web search.' };
  }
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        include_answer: true,
        search_depth: 'basic',
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { query, results: [], error: `Search failed (${res.status}) ${detail.slice(0, 200)}` };
    }
    const data = await res.json();
    const results: SearchResult[] = (data.results ?? []).map((r: Record<string, unknown>) => ({
      title: String(r.title ?? 'Untitled'),
      url: String(r.url ?? ''),
      snippet: String(r.content ?? '').slice(0, 400),
    }));
    return { query, answer: data.answer ?? undefined, results };
  } catch (e) {
    return { query, results: [], error: (e as Error).message || 'Search request failed.' };
  }
}
