# Intégration de l'extraction PDF par IA dans VacciCheck

## Objectif

Remplacer l'extraction de texte naïve (`pdfjs.getTextContent`) par une lecture visuelle par IA (Gemini 2.5 Pro), **tout en conservant intégralement** la logique métier québécoise déjà présente dans le HTML (`parseQuebecCarnet`, `COMMERCIAL_MAP`, `QC_CODE_MAP`, dérivation des doses, détection nom/DDN, etc.).

## Principe

L'IA produit le **même format de sortie que `extractPdfLines` aujourd'hui** : un tableau de lignes (`string[]`) avec `__PAGE_BREAK__` entre les pages. Tout le reste du moteur de VacciCheck continue de fonctionner sans modification.

```
PDF → pdf.js rendu canvas (iframe) → images base64
    → postMessage(parent) → serverFn → Gemini Vision
    → string[] (lignes propres) → postMessage(iframe)
    → parseQuebecCarnet(lines)   [code existant, inchangé]
    → state.vaccineEntries       [code existant, inchangé]
```

## Pourquoi cette approche

- **Préserve 1500 lignes de logique québécoise** déjà éprouvée (mapping antigènes, demi-doses, polio extraits, etc.).
- **Iframe inchangé visuellement** — tu retrouves ton site exact.
- **Seul `extractPdfLines` est remplacé** : c'est lui qui causait les entrées manquantes dans les tableaux denses.

## Architecture technique

### 1. Côté iframe (`public/vaccicheck-app.html`)

Modifier deux endroits seulement :

- **`extractPdfLines(file)`** : rendre chaque page PDF en image base64 via canvas (pdf.js est déjà chargé), puis envoyer un message au parent et attendre la réponse :
  ```js
  async function extractPdfLines(file){
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data:buf}).promise;
    const images = [];
    for(let p=1; p<=pdf.numPages; p++){
      const page = await pdf.getPage(p);
      const vp = page.getViewport({scale: 2});
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({canvasContext: canvas.getContext('2d'), viewport: vp}).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.85));
    }
    // postMessage + Promise resolved par listener
    return await requestAiExtract(images);
  }
  ```
- Ajouter `requestAiExtract(images)` qui poste `{type:'vc:extract', id, images}` à `window.parent` et résout la Promise quand le parent répond `{type:'vc:extract:result', id, lines}`.

### 2. Côté route React (`src/routes/_authenticated/vaccicheck.tsx`)

Ajouter un `useEffect` qui écoute les messages de l'iframe, appelle la server fn `extractCarnetLines` (auth déjà attachée par `attachSupabaseAuth`), et renvoie le résultat dans l'iframe.

### 3. Server function (`src/lib/vaccine-extract.functions.ts`)

Remplacer la fn existante (qui renvoyait un format custom) par `extractCarnetLines({ pageImages })` qui :
- Pour chaque image, appelle Lovable AI Gateway (Gemini 2.5 Pro vision) en parallèle (max 4 simultanés)
- Prompt système : « Reproduis chaque ligne du tableau de vaccination telle quelle, un vaccin par ligne, avec date, antigène/produit, lot, volume, site, notes — sans rien fusionner ni omettre. Pas de Markdown, juste du texte brut. »
- Renvoie `string[]` aplati avec `'__PAGE_BREAK__'` entre les pages
- Persiste dans `vaccine_carnets` (texte brut concaténé) pour QA, comme aujourd'hui — protégé par `requireSupabaseAuth`

### 4. Nettoyage

- Supprimer `src/lib/pdf-render.client.ts` (devenu inutile, le rendu se fait dans l'iframe).
- Désinstaller `pdfjs-dist` côté React (toujours présent dans l'iframe via le bundle inline du HTML).
- Garder les tables `vaccine_carnets` / `vaccine_entries` pour l'historique futur — pas de migration ici.

## Coût attendu par carnet

Carnet typique 4–6 pages → 4–6 appels Gemini 2.5 Pro vision en parallèle → environ **0,02 à 0,05 $ par carnet** sur l'AI balance. Le 1 $ gratuit mensuel couvre donc 20 à 50 carnets sans recharge.

## Hors périmètre

- Pas de modification visuelle de l'app VacciCheck (le HTML reste identique).
- Pas de re-écriture en React de la logique métier.
- Pas de système de cache : chaque upload re-appelle l'IA (à voir plus tard si besoin).

## Critère de succès

Le PDF de 41 entrées qui posait problème extrait désormais **41 entrées** (ou un nombre proche), visibles dans le tableau VacciCheck comme avant — sans changer aucun comportement aval (recommandations, demi-doses, etc.).
