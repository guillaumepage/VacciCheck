## Objectif

Livrer `/mnt/documents/test_v22.html` (copie de v21) avec 4 corrections ciblées. Aucun autre changement.

---

## 1. Hépatite B — 3 doses normales chez un immunosupprimé

**Fichier :** `test_v22.html`, `DECISION_TREES['Hépatite B']` (≈ lignes 1228-1265).

**Problème actuel :** quand `cat==='immuno'` et `s.count===3`, la branche `s.count>0` calcule `remaining = max(0, 4-3) = 1` et affiche « 1 dose restante à 0-1-2-6 mois (double dose) » — incohérent puisque les 3 doses reçues étaient des doses simples.

**Correction :** ajouter, AVANT le bloc `if(s.count>0)`, une branche spécifique :

```js
// 3+ doses standard reçues chez un patient désormais immunosupprimé / IRC / greffe
if(s.count>=3 && (cat==='immuno' || cat==='dialyse' || cat==='greffe')){
  return `<strong>${s.count} dose(s) standard au dossier — schéma normalement complet chez l'immunocompétent.</strong><br>
  <strong>⚠ Statut immunosupprimé :</strong> ces doses auraient idéalement dû être administrées en <em>double dose (40 µg) à 0-1-2-6 mois</em>. Étant donné qu'elles ont été reçues en dose standard, <strong>monitorer le taux d'anti-HBs</strong> ; selon le résultat (cible ≥ 10 UI/L), administrer une ou plusieurs doses supplémentaires (double dose). Chez l'hémodialysé : dosage <strong>annuel</strong>.`;
}
```

(La règle « ≥ 4 doses chez immuno/greffe » existante reste en aval.)

---

## 2. Fièvre jaune — badge « Complet » lorsqu'au moins 1 dose au carnet

**Fichier :** `test_v22.html`, branche `if(disease==='Fièvre jaune')` dans `determineStatus` (≈ lignes 1071-1085).

**Problème :** le moteur `DECISION_TREES['Fièvre jaune']` (texte « Protection à vie ») se déclenche bien, mais le badge `status` reste `Recommandé` + `urgent:true` car `determineStatus` ne consulte jamais le carnet pour la fièvre jaune.

**Correction :** en tout début de la branche `if(disease==='Fièvre jaune')`, ajouter :

```js
const yfDoses = isDoseCountFor('Fièvre jaune');
if(yfDoses>=1 && !(rg.immuno||rg.grossesse)){
  return {status:'Complet',
          msg:'1 dose ou plus au carnet — protection à vie (OMS 2016). Certificat international valide à vie.',
          urgent:false};
}
```

(Pour `rg.immuno`/`rg.grossesse`, le flux existant continue de s'appliquer — un rappel peut être indiqué après 10 ans.)

---

## 3. Saisie manuelle de volume (ex. « 0.5 » ou « 0,5 ») — la page remonte en haut

**Fichier :** `test_v22.html`, `renderVaccineRows()` (≈ lignes 615-622).

**Cause :** sur chaque frappe dans l'input « Vol (ml) », le listener `input` exécute `renderVaccineRows()` — la table entière est recréée via `innerHTML`, l'input perd le focus, le scroll saute en haut. Le listener global `document.body 'input'` déclenche aussi `recompute()` en parallèle.

**Correction :**

1. Dans la boucle des inputs (ligne 615), distinguer `input` et `change` pour le champ `volume` :

```js
el.addEventListener('input', ev=>{
  const k = el.dataset.k;
  if(el.type==='checkbox') state.vaccineEntries[i][k]=el.checked;
  else if(el.tagName==='SELECT' && k==='product'){ if(el.value) state.vaccineEntries[i][k]=el.value; }
  else state.vaccineEntries[i][k]=el.value;
  // NE PAS re-rendre la table pendant la frappe sur volume :
  if(k==='antigen'){ deriveHalfDose(state.vaccineEntries[i]); renderVaccineRows(); }
  // volume : recompute uniquement, sans renderVaccineRows
});
el.addEventListener('change', ev=>{
  const k = el.dataset.k;
  if(k==='volume'){ deriveHalfDose(state.vaccineEntries[i]); renderVaccineRows(); recompute(); }
});
```

2. Conserver l'`addEventListener('input')` global ligne 1829 (debounce 150 ms) qui recalcule la posologie sans toucher au DOM de la table.

Effet : l'utilisateur peut taper « 0,5 » sans interruption ; le badge « demi/junior » s'actualise au blur, et la posologie suit (recompute n'affecte que le rendu pays + résumé).

---

## 4. Hépatite A — préciser dose complète vs demi-dose dans la recommandation

**Fichier :** `test_v22.html`, `DECISION_TREES['Hépatite A']` (≈ lignes 1180-1215).

**Problème :** quand on recommande de compléter (1 dose au dossier), le texte ne précise pas s'il faut une dose adulte (1 mL) ou pédiatrique (0,5 mL) — ni s'il faut s'aligner sur ce qui a déjà été reçu.

**Correction :** dans la branche `effectiveCount===1` (et également `effectiveCount>=2` pour cohérence), choisir le libellé du produit en fonction de :
- `age` actuel (<18 → pédiatrique, ≥18 → adulte) ;
- `s.halfDoses` / `s.fullDoses` (déjà exposés par `vaccineStats`) ;
- `immuno` (un patient immunosupprimé doit recevoir des doses **complètes** même s'il a <18 ans → cas particulier mentionné).

Patch (1 dose au dossier) :

```js
if(effectiveCount===1){
  const since = s.yearsSinceLast;
  const wasHalf = s.halfDoses>0 && s.fullDoses===0;
  let doseLbl;
  if(immuno){
    doseLbl = 'dose <strong>complète</strong> (1 mL — Havrix 1440 / Avaxim / Vaqta), même si la 1re dose était pédiatrique : l\'immunosuppression justifie la dose adulte';
  } else if(age!=null && age<18){
    doseLbl = wasHalf
      ? 'demi-dose pédiatrique (0,5 mL — Havrix Junior / Avaxim Pédiatrique), pour s\'aligner sur la 1re dose'
      : 'dose pédiatrique (0,5 mL) si <18 ans, sinon dose adulte (1 mL)';
  } else {
    doseLbl = wasHalf
      ? '<strong>dose complète adulte (1 mL)</strong> — patient désormais ≥ 18 ans ; ne pas refaire de demi-dose'
      : 'dose complète adulte (1 mL — Havrix 1440 / Avaxim / Vaqta)';
  }
  let txt = (since!=null && since<6/12)
    ? `<strong>1 dose reçue il y a ${since.toFixed(1)} an.</strong> Administrer la 2e dose ≥ 6 mois après la 1re — ${doseLbl}.`
    : `<strong>1 dose reçue.</strong> Administrer la 2e dose maintenant (intervalle ≥ 6 mois respecté) — ${doseLbl}.`;
  if(immuno) txt += ` <br><strong>⚠ Immunosupprimé :</strong> doser <em>anti-HAV IgG</em> 1-2 mois après la 2e dose.`;
  if(hepato) txt += ` <br><strong>Hépatopathie chronique :</strong> vaccination prioritaire ; envisager sérologie post-vaccinale.`;
  return txt;
}
```

Pour `effectiveCount>=2` (Complet), ajouter un rappel si `wasHalf && age>=18` : « Les 2 doses étaient pédiatriques (0,5 mL) et le patient est désormais adulte — considérer une dose adulte de rappel selon le contexte d'exposition. » (Note discrète, status reste « Complet ».)

---

## 5. QA manuelle (5 scénarios)

1. Adulte 40 ans, **immunosupprimé**, Hép B 3 doses standard → texte « monitorer anti-HBs, doses supplémentaires en double dose au besoin » (corr. #1).
2. Adulte 35 ans, 1 dose Stamaril ajoutée manuellement, pays « Recommandé pour tous » → badge **Complet** (corr. #2).
3. Saisir « 0,5 » dans Vol (ml) lettre par lettre → la page **ne bouge pas**, focus conservé (corr. #3).
4. Adulte 25 ans, 1 dose Havrix Junior (0,5 mL) au dossier → posologie : « 2e dose en **dose complète adulte (1 mL)** » (corr. #4).
5. Adulte 30 ans **immunosupprimé**, 1 dose Havrix Junior → 2e dose en **dose complète (1 mL)** + dosage anti-HAV IgG (corr. #4 + branche immuno).

---

## Hors scope

Aucun changement aux autres vaccins, à la base INSPQ, au questionnaire clinique, à l'impression, au design ou au routeTree TanStack. Pas de refonte de l'event-binding global au-delà du listener décrit en #3.
