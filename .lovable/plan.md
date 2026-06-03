## Livrable

`/mnt/documents/test_v27.html` cloné depuis `test_v26.html`. Trois corrections ciblées, rien d'autre.

---

### 1) ETEC : mention présente même en « À considérer »

**Fichier :** `test_v27.html`, fonction `tdBlock(slug)` (≈ lignes 1110‑1125) et `DECISION_TREES['Diarrhée du voyageur']` / `DECISION_TREES['Choléra']`.

Aujourd'hui la phrase *« Efficacité ~ 60 % sur les diarrhées à ETEC (6 à 16 % des diarrhées toutes causes confondues) »* n'apparaît que lorsque le statut Dukoral est **Complet** (≥ 2 doses récentes).

Patch :
- Définir une constante `const ETEC_EFF = "Efficacité ~ 60 % sur les diarrhées à ETEC (6 à 16 % des diarrhées toutes causes confondues sont prévenues par le Dukoral).";`
- L'ajouter à la fin du `txt` de **toutes les branches** retournées par `tdBlock` quand `td==='modéré'` ou `td==='élevé'` (1 dose au dossier, 0 dose, > 5 ans, < 5 ans avec rappel, etc.). Ne pas la mettre dans la branche `faible` (Dukoral non requis).
- Idem dans la branche « À considérer » des arbres de décision Choléra / Diarrhée du voyageur (`DECISION_TREES`) pour cohérence avec la carte Pays.

---

### 2) Ajouter Men-C-C aux antigènes saisissables manuellement

**Fichier :** `test_v27.html`, `VACCINE_PRODUCTS` (lignes 381‑402) + regex carnet (lignes 180‑232).

- Ajouter une entrée distincte :
  ```js
  'Méningocoque C': ['Menjugate','NeisVac-C','Meningitec'],
  ```
  placée juste avant `'Méningocoque ACYW'`. (`ALL_ANTIGENS` est dérivé automatiquement, donc le `<select>` de saisie manuelle l'affichera.)
- Étendre la détection texte du carnet : la règle actuelle `/^men[- ]?c\b/i → 'Méningocoque ACYW'` est incorrecte (Men‑C ≠ ACYW). La remplacer par :
  ```js
  {re:/^men[- ]?c(?![a-z])/i, ant:'Méningocoque C'},
  {re:/menjugate|neisvac|meningitec/i, ant:'Méningocoque C'},
  ```
  et conserver la règle ACYW (`/^men[- ]?(acyw|quad)/i`) pour Menveo/Nimenrix/Menactra (déjà couverte par les regex produit).
- Étendre la décision : ajouter `DECISION_TREES['Méningocoque C'] = DECISION_TREES['Méningocoque'];` et inclure `'Méningocoque C'` dans le `ctx.stats([...])` de l'arbre `'Méningocoque'`.
- `antigenIcon('Méningocoque C')` réutilise l'icône méningocoque existante (aucun nouveau picto).

---

### 3) Volume auto‑rempli lors de l'ajout manuel

**Fichier :** `test_v27.html`, `renderVaccineRows()` (≈ lignes 95‑135) + nouveau helper.

Comportement souhaité : quand l'utilisateur **choisit un antigène** (ou un produit) dans une ligne d'ajout manuel, le champ « Vol (mL) » se remplit automatiquement avec la valeur standard PIQ **si le champ est encore vide**. Si l'utilisateur a déjà tapé une valeur, on n'écrase rien.

Implémentation :

1. Table de valeurs par défaut (mL ou « capsule(s) ») — basée sur PIQ :
   ```js
   const DEFAULT_VOLUME = {
     'Hépatite A':'1', 'Hépatite B':'1', 'Hépatite A+B':'1',
     'DCaT':'0,5', 'ROR':'0,5', 'Varicelle':'0,5',
     'Fièvre jaune':'0,5', 'Typhoïde':'0,5',
     'Méningocoque C':'0,5', 'Méningocoque ACYW':'0,5', 'Méningocoque B':'0,5',
     'Encéphalite japonaise':'0,5', 'Rage':'1',
     'Choléra / DV':'3 (sachet)', 'Mpox':'0,5',
     'Influenza':'0,5', 'COVID-19':'0,3',
     'Encéphalite à tiques':'0,5', 'VPH':'0,5', 'Poliomyélite':'0,5'
   };
   // Surcharges par produit pédiatrique / oral
   const DEFAULT_VOLUME_BY_PRODUCT = {
     'Havrix Junior':'0,5','Avaxim Pédiatrique':'0,5','Twinrix Junior':'0,5',
     'Engerix-B Pédiatrique':'0,5','Recombivax HB Pédiatrique':'0,5','Heplisav-B':'0,5',
     'Vivotif':'1 capsule (×3 doses orales)',
     'Fluad':'0,5','VPO (Sabin)':'2 gouttes (oral)'
   };
   function defaultVolumeFor(entry){
     if(!entry) return '';
     return DEFAULT_VOLUME_BY_PRODUCT[entry.product] || DEFAULT_VOLUME[entry.antigen] || '';
   }
   ```

2. Dans le listener `input` de `renderVaccineRows()`, lorsque `k==='antigen'` ou `k==='product'` :
   ```js
   const cur = (state.vaccineEntries[i].volume||'').trim();
   if(!cur){
     const v = defaultVolumeFor(state.vaccineEntries[i]);
     if(v) state.vaccineEntries[i].volume = v;
   }
   ```
   Puis `deriveHalfDose(...)` + `renderVaccineRows()` (déjà fait).

3. Aucun changement pour les entrées extraites du carnet (le volume y est déjà parsé).

---

### Hors scope

Pas de modification au DB INSPQ, aux autres arbres de décision, à la mise en page, au footer, au routeTree TanStack, ni au reste du moteur. Pas de bun add ni de nouvelle dépendance.

### QA manuelle

1. Pays à TD modéré sans Dukoral au carnet → carte DV affiche « À considérer » **et** la phrase ETEC.
2. Ajouter manuellement « Men‑C » → l'option `Méningocoque C` apparaît dans le select, avec produits Menjugate/NeisVac‑C.
3. Sélectionner « Fièvre jaune » dans une ligne vide → Vol passe à `0,5` automatiquement ; modifier ensuite à `1` → la valeur saisie est conservée si on change le produit après.
4. Sélectionner « Vivotif » comme produit → Vol passe à `1 capsule (×3 doses orales)`.
