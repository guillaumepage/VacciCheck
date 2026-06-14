import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  filename: z.string().min(1).max(255),
  pageImages: z.array(z.string().min(20).max(8_000_000)).min(1).max(50),
  expectedEntries: z.number().int().min(0).max(500).optional(),
});

export type VaccineEntry = {
  given_at: string | null;
  vaccine_generic: string | null;
  commercial_name: string | null;
  lot: string | null;
  site: string | null;
  dose: string | null;
  notes: string | null;
  page_number: number;
};

export type ExtractResult = {
  carnetId: string;
  entries: VaccineEntry[];
  rawMarkdown: string;
  pageCount: number;
};

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans la lecture de carnets de vaccination québécois.
Tu reçois l'image d'une page d'un carnet. Retourne UNIQUEMENT un tableau Markdown
avec exactement ces colonnes, dans cet ordre :

| Date | Vaccin (nom générique) | Nom commercial | Lot | Site | Dose | Notes |

Règles strictes :
- N'invente JAMAIS d'entrée. Ne saute JAMAIS une ligne lisible.
- Une ligne du tableau = une dose administrée.
- Format de date : JJ/MM/AAAA. Si ambigu, mets "?".
- "Vaccin (nom générique)" = abréviation/générique inscrit sur le carnet (ex. DCaT, RRO, VPO, dT, Hib, Pneu-C, Men-C-C, Inf, VPI).
- "Nom commercial" = marque écrite sur la ligne ou dans la colonne adjacente
  (ex. Sabin, VPO, Quadracel, D25CT5 ACT-HIB, Arepanrix H1N1, Vaxigrip, Pediacel, Infanrix-hexa, Prevnar, Menjugate).
  Si le nom commercial n'est pas explicitement écrit, mets "" (chaîne vide), pas "?".
- Si une cellule est illisible ou absente, mets "?" (ou "" pour Nom commercial).
- Pas de texte avant ou après le tableau. Pas d'explication. Pas de bloc \`\`\`.
- Inclus la ligne d'en-tête et la ligne de séparation Markdown (---).
- Si la page ne contient aucune entrée vaccinale, retourne uniquement l'en-tête et la séparation, sans lignes de données.`;

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
    if (res.status === 402) throw new Error("Crédits IA Lovable épuisés. Ajoutez des crédits dans Settings → Usage.");
    throw new Error(`Erreur IA (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

// Concurrency limiter
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

function normalizeDate(s: string): string | null {
  const t = s.trim();
  if (!t || t === "?" || t === "-") return null;
  // JJ/MM/AAAA
  let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = Number(y) > 30 ? `19${y}` : `20${y}`;
    return `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // AAAA-MM-JJ
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

function parseMarkdownTable(md: string, pageNumber: number): VaccineEntry[] {
  const lines = md.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("|") && l.endsWith("|"));
  const entries: VaccineEntry[] = [];
  for (const line of lines) {
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 7) continue;
    // Skip header / separator rows
    const joined = cells.join(" ").toLowerCase();
    if (/^[-:\s|]+$/.test(line.replace(/\|/g, ""))) continue;
    if (joined.includes("date") && joined.includes("vaccin")) continue;
    const [date, generic, commercial, lot, site, dose, notes] = cells;
    if (!date && !generic) continue;
    entries.push({
      given_at: normalizeDate(date),
      vaccine_generic: generic && generic !== "?" ? generic : null,
      commercial_name: commercial && commercial !== "?" ? commercial : null,
      lot: lot && lot !== "?" ? lot : null,
      site: site && site !== "?" ? site : null,
      dose: dose && dose !== "?" ? dose : null,
      notes: notes && notes !== "?" ? notes : null,
      page_number: pageNumber,
    });
  }
  return entries;
}

// Business rules: backfill commercial names known from Québec historical context.
function applyCommercialRules(entries: VaccineEntry[]): VaccineEntry[] {
  return entries.map((e) => {
    if (!e.commercial_name && e.given_at && e.vaccine_generic) {
      const year = Number(e.given_at.slice(0, 4));
      const g = e.vaccine_generic.toUpperCase().replace(/\s+/g, "");
      // DCaT 1994-1995 → D25CT5 ACT-HIB
      if (g.includes("DCAT") && year >= 1994 && year <= 1995) {
        return { ...e, commercial_name: "D25CT5 ACT-HIB" };
      }
    }
    return e;
  });
}

export const extractVaccinationCarnet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }): Promise<ExtractResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY non configuré");

    const { supabase, userId } = context;

    // Call AI Gateway in parallel (4 at a time)
    const markdowns = await mapConcurrent(data.pageImages, 4, (img) => callLovableAI(img, apiKey));

    const rawMarkdown = markdowns
      .map((md, i) => `### Page ${i + 1}\n\n${md}`)
      .join("\n\n");

    // Parse + apply rules
    let entries: VaccineEntry[] = [];
    markdowns.forEach((md, i) => {
      entries = entries.concat(parseMarkdownTable(md, i + 1));
    });
    entries = applyCommercialRules(entries);

    // Persist
    const { data: carnet, error: cErr } = await supabase
      .from("vaccine_carnets")
      .insert({
        user_id: userId,
        source_filename: data.filename,
        raw_markdown: rawMarkdown,
        page_count: data.pageImages.length,
        expected_entries: data.expectedEntries ?? null,
      })
      .select("id")
      .single();
    if (cErr || !carnet) throw new Error(`Échec de l'enregistrement du carnet: ${cErr?.message}`);

    if (entries.length > 0) {
      const rows = entries.map((e) => ({ ...e, user_id: userId, carnet_id: carnet.id }));
      const { error: eErr } = await supabase.from("vaccine_entries").insert(rows);
      if (eErr) throw new Error(`Échec de l'enregistrement des entrées: ${eErr.message}`);
    }

    return {
      carnetId: carnet.id,
      entries,
      rawMarkdown,
      pageCount: data.pageImages.length,
    };
  });
