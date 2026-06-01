Livrable : `test_v10.html` dans `/mnt/documents/` (fichier autonome, 100 % côté navigateur, palette VacciCheck conservée).

## 1. Demi-dose limitée à Hépatite A et B + auto-détection

- La case `Demi-dose / junior` n'apparaît plus que sur les lignes dont l'antigène est `Hépatite A`, `Hépatite B` ou `Hépatite A+B` (Havrix, Vaqta, Engerix-B, Recombivax HB, Twinrix). Les autres vaccins n'ont plus de case dose du tout (colonne masquée).
- Lors de l'import PDF et de la saisie manuelle, si `volumeMl === 0.5` ET antigène ∈ {HA, HB, HA+B}, la case est automatiquement cochée. Si l'utilisateur change le volume à 1,0 ml, la case se décoche.
- Le badge dose affiché passe à `Demi-dose` / `Pédiatrique` automatiquement selon le produit (Havrix Junior, Engerix-B Pédiatrique, Recombivax HB Pédiatrique).
- Aucun autre vaccin (DCaT, ROR, fièvre jaune, etc.) ne génère plus de mention demi-dose, même si extrait avec 0,5 ml.

## 2. Résumé imprimable : logo + pictogrammes N&B

- Header d'impression : logo VacciCheck (inline base64) à gauche, titre + date à droite, ligne de séparation noire. Visible en N&B (logo converti en silhouette noire via filtre CSS `filter: grayscale(1) contrast(1.5)` pour l'impression).
- Pictogrammes statut (badge en début de chaque recommandation), pensés pour rester lisibles en monochrome :
  - ✅ encadré plein noir → `Recommandé / requis`
  - ⚠ triangle hachuré → `À considérer selon contexte`
  - ⛔ cercle barré → `Non requis / contre-indiqué`
  - ⏱ sablier → `Urgent — délai court`
- Pictogrammes par antigène (SVG inline noir) à côté du nom du vaccin :
  - 💉 seringue → vaccins injectables
  - 💧 goutte → vaccins oraux (typhoïde Vivotif, choléra Dukoral)
  - 🦟 moustique → prophylaxie antipaludique / mesures vectorielles
  - 🐕 patte → rage / exposition animale
  - 🍽 assiette → conseils eau & alimentation
- Bloc CSS `@media print` revu : fond blanc forcé, couleurs converties en niveaux de gris, bordures noires 1 pt, pictogrammes SVG `fill="#000"`. Test : impression sans couleurs reste 100 % lisible.

## 3. Logique JotForms intégrée

Extraction des 4 formulaires JotForm (partie 1 à 4) pour reproduire dans le questionnaire clinique :

- **Partie 1 — Données démographiques & voyage** : âge, dates, durée, type de séjour, hébergement, activités. Conditions de saut existantes (ex : grossesse → questions obstétricales, < 18 ans → champs pédiatriques) reproduites en JS via listeners `change`.
- **Partie 2 — Antécédents médicaux** : ajout des groupes manquants détectés :
  - Asplénie / hyposplénie (anatomique ou fonctionnelle, drépanocytose)
  - Maladie hépatique chronique
  - Maladie rénale chronique / dialyse
  - VIH avec stratification CD4 (> ou < 200)
  - Greffe d'organe solide / cellules souches
  - Traitement biologique (anti-TNF, anti-CD20, JAK inh.)
  - Diabète insulinodépendant
- **Partie 3 — Comportements et expositions** : ajout :
  - Travail humanitaire / camps de réfugiés
  - Contact rapproché avec enfants locaux
  - Plongée / spéléologie / contact chauves-souris
  - Rapports sexuels non protégés prévus
  - Tatouage / piercing / soins dentaires sur place
- **Partie 4 — Vaccins déjà reçus** : déjà couvert par le carnet ; ajout d'une case « Doute sur le statut vaccinal antérieur » qui déclenche la recommandation de sérologie HA/HB.

Chaque règle JotForm (`if Q12 = Oui then show Q15`) est traduite en règle JS dans un objet `clinicalRules[]`. Toutes ces conditions déclenchent `recompute()` (déjà branché en v9).

## 4. Base de recommandations INSPQ — tous les pays

Couverture exhaustive de la liste pays INSPQ (≈ 215 fiches `/sante-voyage/guide/pays/<slug>`).

### Pipeline d'extraction (exécuté côté serveur via le sandbox, pas dans le navigateur)

1. Récupérer l'index `https://www.inspq.qc.ca/sante-voyage/guide/pays` → liste complète des slugs.
2. Pour chaque slug : `firecrawl scrape` format `markdown` (batch via `startBatchScrape` pour limiter le coût et paginer). Connecteur Firecrawl à activer si pas déjà fait.
3. Parser chaque fiche pour extraire :
   - Vaccins recommandés (Hépatite A, B, typhoïde, fièvre jaune obligatoire/recommandée, encéphalite japonaise, rage, méningite ACYW, choléra, ROR/DCaT à jour)
   - Paludisme (zones, espèces, chloroquinosensibilité, prophylaxie recommandée)
   - Risques alimentaires / hydriques, dengue, zika, chikungunya
   - Exigences d'entrée (fièvre jaune obligatoire, etc.)
   - Saison de transmission (encéphalite japonaise, méningite)
4. Normalisation dans un objet JSON `countryRecommendations[ISO3]` embarqué dans `test_v10.html`.
5. Logique du moteur : croise pays + questionnaire clinique + carnet pour produire la liste finale avec statut (`recommandé`, `à considérer`, `non requis`, `urgent`).

### Sécurité du scraping

- Aucun PII envoyé à Firecrawl, seulement URLs publiques INSPQ.
- Données INSPQ intégrées localement → site reste 100 % offline une fois généré.

### Maintenance

- Script `tools/build-inspq-db.mjs` (généré dans le sandbox) conservé pour rafraîchir la base à la demande.
- Footer du site : `Base INSPQ mise à jour le YYYY-MM-DD`.

## Hors scope

- Aucun changement à la palette, au layout 2 colonnes, à la section rétractable, à la CSP ou à la gestion confidentialité v9.
- Aucune refonte du parser PDF (déjà OK en v9).

Confirme pour exécution. La phase 4 (scraping INSPQ complet) prendra plusieurs minutes ; je la lancerai en parallèle des phases 1–3.