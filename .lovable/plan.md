
## Problème actuel

Dans `test.html`, `handlePdfImport()` lit le fichier octet par octet et ne garde que les caractères ASCII imprimables (lignes 57). Les PDF du registre québécois ont leur texte compressé (FlateDecode) — cette méthode ne récupère donc presque rien, et un simple `includes("havrix")` sur du binaire ne détecte au mieux qu'un ou deux noms. C'est pourquoi l'import "ne fonctionne pas".

Le PDF d'exemple (Guillaume Page, 1994-08-09) contient en réalité ~30 doses réparties sur 7 pages, avec des codes du carnet québécois (`HA`, `HB`, `Typh`, `RRO`, `Men-C-C`, `VPO`, `DCT-VPI-Hib`, `DCaT-VPI`, `dcaT`, `Inf`, `COVID-19`, `VPH`) et des noms commerciaux (HAVRIX, RECOMBIVAX, MMR II, VIVOTIF, MENJUGATE, SABIN, COMIRNATY, BOOSTRIX, GARDASIL, etc.).

## Modifications proposées dans `test.html`

### 1. Charger PDF.js depuis un CDN
Ajouter dans `<head>` :
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js"></script>
```
Puis configurer le worker au début du `<script>` :
```js
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";
```

### 2. Étendre `VACCINE_SYNONYMS`
Ajouter les codes/noms du carnet québécois pour chaque maladie déjà mappée, par ex. :
- `hepatiteA` : `"ha"`, `"havrix"`, `"avaxim"`, `"vaqta"`
- `hepatiteB` : `"hb"`, `"recombivax"`, `"engerix"`
- `poliomyelite` : `"vpo"`, `"vpi"`, `"sabin"`, `"dct-vpi-hib"`, `"dcat-vpi"`, `"quadracel"`, `"penta"`
- `typhoide` : `"typh"`, `"vivotif"`, `"typhim"`
- `rougeole` : `"rro"`, `"mmr"`, `"mmr ii"`, `"priorix"`
- `meningocoqueC` : `"men-c-c"`, `"menjugate"`, `"neisvac"`
- (les autres restent inchangés)

### 3. Réécrire `handlePdfImport(file)`
Nouvelle logique :
1. Charger le PDF via `pdfjsLib.getDocument({data})`.
2. Pour chaque page, récupérer `page.getTextContent()` et reconstruire les lignes en regroupant les `items` par coordonnée Y (les tableaux du carnet sont sur plusieurs lignes verticalement alignées).
3. Détecter les blocs de doses : chaque dose commence par un code vaccin reconnu (regex sur l'ensemble des synonymes + dictionnaire des codes québécois), et contient une date au format `YYYY/MM/DD` à proximité.
4. Pour chaque bloc reconnu, créer une entrée :
   ```js
   { name: "<code> – <commercial>", date: "YYYY-MM-DD", ageAt: "<an mois>", immuneStatus: "unknown", doses: "1" }
   ```
   - Une entrée par dose physique (pas une entrée agrégée par maladie). Cela laisse `countDiseaseDoses()` compter correctement.
5. Optionnel : si le PDF contient `Nom :` et `Date de naissance :`, pré-remplir `patientName` et `dob` quand ces champs sont vides.
6. Mettre à jour `pdfStatus` avec le nombre de doses extraites, et la liste des maladies couvertes.
7. En cas d'échec PDF.js, garder un fallback texte simple et signaler clairement l'échec.

### 4. Petits ajustements UI
- Changer le texte du bandeau pour : "Import PDF — extraction automatique des doses (carnet du Québec pris en charge). Vérification clinique requise."
- Afficher dans `pdfStatus` : `"PDF importé : N doses extraites (Hépatite A, Hépatite B, Rougeole, …)."`

## Format de livraison

Je te renverrai le **fichier HTML complet modifié** comme artéfact téléchargeable (`test_v2.html`), prêt à remplacer ton fichier actuel. Toute la logique reste 100 % côté navigateur (aucun backend).

## Hors scope (à confirmer si tu le veux aussi)

- OCR des PDF scannés (image-only) — non couvert; le carnet du Québec est textuel donc PDF.js suffit.
- Ajout des maladies non encore mappées dans `DISEASES` (ex. coqueluche/tétanos/diphtérie, VPH, influenza, COVID-19). Si tu veux que ces vaccins soient aussi listés et comptés, dis-le moi et j'ajouterai les entrées correspondantes dans `DISEASES`, `DISEASE_LABELS`, `COUNTRY_DATA` et `recommendationFromJotform`.
