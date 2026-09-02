import { createFileRoute } from "@tanstack/react-router";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const Route = createFileRoute("/api/public/dictionary")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const word = (url.searchParams.get("word") || "").trim().toLowerCase();
        const key = request.headers.get("x-mw-key") || "";

        if (!word) return json({ error: "Missing word." }, 400);
        if (!key) return json({ error: "No Merriam-Webster API key set. Add one in Settings." }, 400);

        try {
          const res = await fetch(
            `https://dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${encodeURIComponent(key)}`,
          );
          const text = await res.text();
          if (!res.ok) {
            return json({ error: `Dictionary service error (${res.status}). Check your API key.` }, 200);
          }
          try {
            return json({ data: JSON.parse(text) });
          } catch {
            const detail = text.trim().slice(0, 120);
            return json(
              {
                error: detail
                  ? `Dictionary service: ${detail}. Check your API key in Settings.`
                  : "Dictionary service returned an invalid response.",
              },
              200,
            );
          }
        } catch {
          return json({ error: "Could not reach the dictionary service." }, 200);
        }
      },
    },
  },
});
