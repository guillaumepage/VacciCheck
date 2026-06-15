import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  filename: z.string().min(1).max(255),
  pageImages: z.array(z.string().min(20).max(8_000_000)).min(1).max(50),
});

export type ExtractLinesResult = {
  lines: string[];
  pageCount: number;
};

const SYSTEM_PROMPT = `Tu lis une page d'un carnet de vaccination québécois (RVQ ou autre).
Retourne UNE LIGNE DE TEXTE BRUT PAR DOSE VACCINALE visible sur la page.

Format de chaque ligne (tokens séparés par espaces, ordre libre mais TOUT inclure) :
  <date>  <antigène/abréviation>  <nom commercial>  <lot>  <volume>  <site>  <notes>

Règles strictes :
- N'invente JAMAIS d'entrée. Ne saute JAMAIS une dose lisible, même partielle.
- Une dose administrée = exactement UNE ligne.
- Date au format AAAA-MM-JJ ou JJ/MM/AAAA tel qu'inscrit (préserve l'original si possible).
- Inclus l'abréviation EXACTE écrite sur le carnet (DCaT, RRO, VPO, VPI, dT, Hib, Pneu-C, Men-C-C, Inf, Var, HA, HB, HAHB, VPH, FJ, etc.).
- Inclus le nom commercial si écrit (Quadracel, Pediacel, Infanrix-hexa, Sabin, VPO, Imovax, Vaxigrip, Menjugate, Gardasil 9, etc.).
- Inclus "lot:" suivi du numéro, et le volume (ex. "0,5 ml" ou "1 co").
- Si la page contient aussi le nom du patient ou la date de naissance, ajoute une ligne dédiée :
    "Nom : <NOM Prénom>"   ou   "Date de naissance : <date>"
- Texte brut UNIQUEMENT. Aucun Markdown, aucun tableau, aucune puce, aucune explication, aucun \`\`\`.
- Une ligne par ligne du carnet. Pas de regroupement, pas de fusion.
- Si la page ne contient aucune dose, retourne une chaîne vide.`;

async function callLovableAI(imageDataUrl: string, apiKey: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Voici la page du carnet :" },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Limite de requêtes IA atteinte. Réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA Lovable épuisés. Ajoutez du AI balance dans Settings → Cloud & AI balance.");
    throw new Error(`Erreur IA (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export const extractCarnetLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<ExtractLinesResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY non configuré");

    const { supabase, userId } = context;

    const pageTexts = await mapConcurrent(data.pageImages, 4, (img) => callLovableAI(img, apiKey));

    // Build a flat lines array compatible with parseQuebecCarnet()
    const lines: string[] = [];
    pageTexts.forEach((text, i) => {
      const pageLines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      lines.push(...pageLines);
      if (i < pageTexts.length - 1) lines.push("__PAGE_BREAK__");
    });

    // Persist raw output for QA (best-effort)
    try {
      await supabase.from("vaccine_carnets").insert({
        user_id: userId,
        source_filename: data.filename,
        raw_markdown: pageTexts.map((t, i) => `### Page ${i + 1}\n\n${t}`).join("\n\n"),
        page_count: data.pageImages.length,
      });
    } catch {
      // non-fatal
    }

    return { lines, pageCount: data.pageImages.length };
  });
