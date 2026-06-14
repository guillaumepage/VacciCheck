
# Extraction PDF de carnet de vaccination via Vision LLM

## Objectif

Remplacer (ou (re)bâtir) l'extraction PDF de VacciCheck par un pipeline qui rend chaque page PDF en image, demande à un LLM multimodal de retourner un **tableau Markdown structuré** du carnet, puis parse ce Markdown en entrées vaccinales. Objectif : zéro entrée manquante et noms commerciaux toujours capturés (Sabin/VPO, Quadracel, D25CT5 ACT-HIB, Arepanrix H1N1, Vaxigrip, etc.).

## Pourquoi cette approche

- L'extraction texte directe (pdf-parse/pdfplumber) regroupe mal les lignes des tableaux denses → entrées et colonnes "Nom commercial" sautées.
- Un LLM vision lit la mise en page comme un humain, ne perd pas les lignes serrées et reconnaît les noms commerciaux écrits en petit ou en marge.
- Markdown intermédiaire = format déterministe, facile à parser et à inspecter pour debug.

## Architecture

```text
Client (upload PDF)
   └─► serverFn extractVaccinationCarnet (createServerFn, requireSupabaseAuth)
         ├─ pdf → images (1 par page) via pdfjs-dist (rendu canvas en mémoire)
         ├─ Pour chaque page : appel Lovable AI Gateway
         │     model: google/gemini-2.5-pro (vision, qualité tableaux)
         │     prompt: "Retourne UNIQUEMENT un tableau Markdown avec colonnes :
         │              Date | Vaccin (nom générique) | Nom commercial | Lot | Site | Dose | Notes"
         │     input: image_url base64 de la page
         ├─ Concatène les Markdown de toutes les pages
         ├─ Parse le Markdown (split lignes |, normalise dates, dédoublonne en-têtes répétés)
         ├─ Post-traitement règles métier (ex: DCaT 1994-1995 → D25CT5 ACT-HIB si manquant)
         └─ Retourne { entries: VaccineEntry[], rawMarkdown: string }
   ◄── UI affiche tableau éditable + bouton "Voir Markdown brut" pour QA
```

## Détails techniques

### Rendu PDF → images
- Lib : `pdfjs-dist` (compatible Cloudflare Worker via build legacy/ESM). Rendu à 200 DPI pour lisibilité.
- Si `pdfjs-dist` pose problème dans le Worker, fallback : faire le rendu **côté client** (le navigateur a déjà `pdfjs-dist`), envoyer les images base64 au serverFn. Préférable d'ailleurs : économise la RAM du Worker et évite les limites de taille.

**Décision recommandée : rendu côté client, parsing IA côté serveur.**

### Appel Lovable AI Gateway
- Endpoint : `https://ai.gateway.lovable.dev/v1/chat/completions`
- Header : `Lovable-API-Key: ${process.env.LOVABLE_API_KEY}` (jamais exposé au client)
- Modèle : `google/gemini-2.5-pro` (meilleur sur tableaux + multilingue FR). Option économique : `google/gemini-3-flash-preview`.
- Message multimodal avec `{type:"image_url", image_url:{url:"data:image/png;base64,..."}}`
- Prompt système strict : "Tu reçois la page d'un carnet de vaccination québécois. Retourne UNIQUEMENT un tableau Markdown sans texte additionnel. N'invente jamais une entrée. Si une cellule est illisible, mets `?`."
- Parallélisation : pages en parallèle avec `Promise.all` (limite à 4 en concurrence pour éviter 429).

### Parsing du Markdown
- Regex sur lignes commençant/finissant par `|`
- Normalisation date : multi-formats (`12/10/1994`, `1994-10-12`, `12 oct 1994`)
- Mapping nom générique → nom commercial avec règles métier (table `vaccine_commercial_rules` en DB pour évolutivité).

### Schéma DB (nouveau)
```sql
create table public.vaccine_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  carnet_id uuid not null,
  given_at date,
  vaccine_generic text,
  commercial_name text,
  lot text,
  site text,
  dose text,
  notes text,
  created_at timestamptz default now()
);
-- + GRANT + RLS (user_id = auth.uid())

create table public.vaccine_carnets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  source_filename text,
  raw_markdown text,
  page_count int,
  created_at timestamptz default now()
);
-- + GRANT + RLS
```

### Fichiers à créer
- `src/lib/pdf-render.client.ts` — rendu pdfjs côté navigateur, retourne `string[]` de data URLs
- `src/lib/vaccine-extract.functions.ts` — serverFn `extractVaccinationCarnet({ pageImages: string[] })`
- `src/lib/vaccine-rules.server.ts` — règles métier de mapping commercial
- `src/routes/_authenticated/vaccicheck.tsx` — page upload + résultats + Markdown brut (QA)
- Migration Supabase pour les 2 tables ci-dessus

## QA et garde-fous

- Affichage côté UI du Markdown brut retourné par l'IA (panneau dépliable) pour que tu puisses vérifier visuellement.
- Compteur "X entrées extraites" vs nombre que tu attendais (champ d'entrée optionnel pour signaler les écarts).
- Tests sur le PDF problématique (41 entrées attendues). Objectif : ≥ 40/41 sans intervention manuelle.

## Coût et performance

- ~2-5 secondes par page avec Gemini 2.5 Pro, ~0.5-1 s avec Flash.
- Coût : facturé sur crédits Lovable AI (visible dans Settings → Usage).
- Pas de clé externe à fournir : Lovable AI Gateway est déjà configuré.

## Hors scope (pour plus tard)

- OCR de PDF scannés purs (l'approche vision fonctionne déjà dessus, donc pas de travail supplémentaire).
- Comparaison automatique avec calendrier vaccinal québécois (étape suivante, après extraction fiable).

