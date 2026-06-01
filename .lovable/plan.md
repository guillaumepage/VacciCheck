# test_v13.html — 3 correctifs ciblés sur v12

Livrable : `/mnt/documents/test_v13.html`. On repart de v12, on touche seulement aux 3 points ci-dessous. Tout le reste (logique paludisme, demi-doses HA/HB, dark mode, calculs d'âge / durée, catégories Rage A/B/C, formatage INSPQ) reste tel quel.

## 1. Importation PDF du carnet RVQ (régression)

**Cause confirmée** sur le PDF fourni (`PAGE, GUILLAUME` — 31 entrées sur 7 pages) : la fonction `parseQuebecCarnet()` actuelle parse **ligne par ligne** et exige que **l'antigène ET la date** apparaissent sur la même ligne. Or, dans le carnet du Registre de vaccination du Québec, chaque ligne du tableau est éclatée verticalement :

```
COVID-19                ← antigène (col 1, ligne 1)
COMIRNATY (PFIZER-BIONTECH)  ← produit (col 1, ligne 2)
COVID-19                ← maladie (col 2)
2021/04/12              ← date (col 3, ligne 1)
(26 ans)                ← âge (col 3, ligne 2)
0,30 ml                 ← volume (col 4)
Intramusculaire         ← voie (col 4)
LOUISE BELANGER         ← professionnel (col 5)
…
```

L'antigène et la date sont **toujours** sur des lignes différentes → seule la première rangée par hasard alignée peut être détectée, d'où le « 1 seule entrée » observé. La DDN et le nom sont aussi sur des lignes séparées de leur étiquette (« Date de naissance : » suivi de `1994/08/09`).

### Correctif — passer à un parseur par **blocs** (groupes Y)

Remplacer la boucle ligne-par-ligne par un parseur 2 passes :

**Passe A — extraction structurée par page** (`extractPdfLines` → `extractPdfRows`)
- Pour chaque page : `getTextContent()` → grouper les items par Y (tolérance 3 pt), trier par X croissant, joindre avec un séparateur tabulation.
- Conserver une `meta` par ligne : `{ y, x_min, text }`. On garde aussi `\n` entre lignes pour la rétro-compatibilité avec la détection de nom/DDN.

**Passe B — détection des rangées vaccinales**
- Ancre : une ligne dont le **premier token** correspond à un code antigène RVQ connu (`COVID-19`, `dcaT`, `DCaT-VPI`, `DCT-Hib`, `DCT-VPI-Hib`, `DT-Hib`, `HA`, `HB`, `HAHB`, `Inf`, `Men-C-C`, `Men-C-ACYW`, `Men-B`, `RRO`, `RRO-Var`, `Var`, `Pneu-C`, `Pneu-P`, `Rot`, `Typh`, `VPH`, `VPO`, `VPI`, `Zona`, `Rage`, `EJ`, `ET`, `FJ`, `Chol`, …) ou un produit commercial connu (réutiliser `COMMERCIAL_MAP`).
- Pour chaque ancre, **lire les 8 lignes suivantes de la même page** :
  - 1ʳᵉ date `YYYY/MM/DD` → `date` de l'entrée (rejeter si == DDN ou hors `[1970, today+1]`)
  - 1ʳᵉ valeur `\d+[,.]\d+\s*ml` ou `\d+,\d+\s*co` → `volume`
  - voie d'administration (`Intramusculaire`, `Sous-cutané`, `Orale`, `Inconnu`) → `voie` (optionnel, juste pour exclure de la zone de la rangée suivante)
- Émettre une entrée `{antigen, product, date, volume, halfDose:false, ageAt:'', lot:''}` par ancre. Si plusieurs codes antigènes sont rencontrés dans la fenêtre, prendre le premier comme ancre et continuer après la date trouvée.
- Garde-fou : si la ligne suivante est aussi un code antigène RVQ (rangée vide), on ferme la rangée courante immédiatement.

**Nom et date de naissance**
- Conserver les regex actuelles mais autoriser que la valeur soit sur la **ligne suivante** :
  - `Nom :` seul → lire la ligne suivante (`PAGE, GUILLAUME` → `Guillaume Page`).
  - `Date de naissance :` seul → lire la ligne suivante (`1994/08/09`).
- `toInitials()` inchangé.

**Critère d'acceptation** : sur `f8713fee-…-3.pdf` (carnet PAGE, GUILLAUME), l'import doit produire **31 entrées** (10 COVID-19, 1 dcaT, 1 DCaT-VPI, 4 DCT-Hib/PENTA, 1 HA, 3 HB, 11 Inf, 1 Men-C-C, 2 RRO, 1 Typh, 2 VPH, 2 VPO — total = 31), avec `patientName = "G. P."` et `dob = "1994-08-09"`.

## 2. Pictogramme « Recommandé »

Aujourd'hui : `statusBadge('Recommandé')` utilise `ICONS.syringeBadge` (seringue). Demande : **même bouclier que « Complet »** mais avec un **point d'exclamation** au centre au lieu du crochet `✓`. Le bouclier coché reste pour « Complet ».

Ajouter une nouvelle icône `ICONS.shieldExclam` dans le bloc `ICONS = {…}` (lignes 323-334), de la même forme que `ICONS.check` (path `M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z`) mais avec un « ! » blanc au lieu du crochet :

```js
shieldExclam: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z"/><path d="M12 8v5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1.2" fill="#fff"/></svg>'
```

Puis :
- `statusBadge('Recommandé')` (ligne 337) → utiliser `ICONS.shieldExclam` au lieu de `ICONS.syringeBadge`.
- `svgFor()` (ligne 953-959) pour le rapport imprimable : `'Recommandé'` → `ICONS.shieldExclam` au lieu de `ICONS.check` (corrige aussi un bug : v12 affichait le crochet pour « Recommandé » à l'impression).
- Les autres statuts (Complet → `check`, À considérer → `warn`, Non requis → `ban`, Urgent → `hourglass`) restent identiques.

## 3. Mesures préventives dans le rapport imprimable

`renderPrintArea()` (lignes 924-952) génère la table des maladies par pays mais **n'inclut pas** le bloc `c.r` (« Autres mesures préventives » : arthropodes, eau/aliments, environnement, santé sexuelle, sécurité). À l'écran (lignes 911-916), ce bloc est déjà rendu.

Ajouter, juste après la boucle des maladies, dans `renderPrintArea` (avant le `</…>` de fin de pays) :

```js
if(c.r && Object.keys(c.r).length){
  h+=`<h3 style="font-size:10pt;margin:.6rem 0 .25rem;color:#0a4d8a">Autres mesures préventives</h3>`;
  Object.entries(c.r).forEach(([k,v])=>{
    h+=`<div class="pr r-non"><div class="pri">${ICONS.warn}</div><div class="prc"><strong>${esc(k)}</strong>${formatInspqHtml(v)}</div></div>`;
  });
}
```

Aucune modification CSS nécessaire (`.pr`, `.pri`, `.prc`, `.r-non` existent déjà dans `@media print`).

**Vérification** : ouvrir l'aperçu d'impression Togo → la section « Autres mesures préventives » apparaît sous la liste des maladies, avec les sous-titres « Risques liés aux arthropodes », « Risques environnementaux », « Santé sexuelle en voyage », etc.

## Hors scope

- Toute autre modification de la logique de recommandation, du formatage INSPQ, du dark mode, des catégories Rage, etc.
- Refonte du parser de date / d'âge — uniquement la fenêtre de scan est élargie.

Confirme pour générer `test_v13.html`.
