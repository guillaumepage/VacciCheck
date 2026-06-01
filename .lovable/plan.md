# test_v17.html — Posologies 100 % Jotform + correctifs v16

## Architecture confirmée

- **Déclenchement d'un vaccin** = règles INSPQ par pays (conservées).
- **Posologie / nb de doses / intervalles / rappels** = uniquement les arbres décisionnels des 4 Jotforms. Aucun raccourci PIQ/INSPQ.

## Livrable

`/mnt/documents/test_v17.html` — base `test_v16.html`.

---

## 1. Réécriture stricte des 14 arbres `DECISION_TREES`

Encoder **branche-par-branche** les questions des Jotforms (chaque `if` du Jotform = un `if` du code, libellés FR repris textuellement).

| Vaccin | Jotform | Questions (IDs) |
|---|---|---|
| Hépatite A | P1 | #232, #233, #236, #240, #247, #250 |
| Hépatite B | P1 | #182, #183, #191, #196, #210, #263, #264 |
| Choléra | P2 | #4, #5, #6, #7, #8 |
| Dukoral (diarrhée voyageur) | P2 | #27, #28, #31, #33 |
| Rage | P2 | #42, #46, #49 |
| Poliomyélite | P2 | #85, #86, #88, #92, #97 |
| Typhoïde | P2 | #108, #109, #110, #111, #119, #130 |
| Mpox | P3 | #12, #15, #16 |
| Chikungunya | P3 | #24, #27, #29 |
| Fièvre jaune | P3 | #34, #36, #39, #41 |
| Encéphalite japonaise | P3 | #49, #51, #53, #55, #58, #59, #60, #62, #75 |
| Tétanos (DCaT/dT) | P3 | #3, #4, #5, #6, #7, #8, #9, #84, #90 |
| Rougeole (ROR) | P4 | #3, #5, #9, #14, #18 |
| Méningocoque | P4 | #26, #27, #29, #30, #31, #35, #40, #42, #45, #49, #54, #58, #64, #66 |

Sortie : `{ posologie, complet, urgent?, notes? }` rendue dans l'encadré « Posologie suggérée ».

## 2. Champs UI manquants exigés par les Jotforms

Conditionnels (visibles seulement si reco INSPQ active) :
- Statut immunitaire (immunocompétent / immunosupprimé) → HépA, HépB, Rage, FJ, EJ, Méningo
- HépB : 5 catégories patient (#264)
- Mpox : 3 catégories (#15)
- FJ : 4 catégories spéciales (#41)
- Typhoïde : 5 catégories voyageur (#130)
- Méningo : groupes particuliers >30 ans (#64)
- EJ : milieu rural (#55), durée >1 mois (#58), période transmission (#53)

## 3. Registre vaccinal détaillé (auto + éditable)

Pour chaque vaccin déclenché : nb doses, âge à la 1re dose, délai depuis dernière dose, drapeaux « après 1/4/10/40 ans ». Pré-rempli via PDF importé (mapping `VACCINE_PRODUCTS` existant), éditable manuellement.

## 4. Tétanos — réécriture stricte Jotform P3

Suppression de toute inspiration PIQ. Arbre #3→#84→#5→#6→#7→#8→#9→#90 uniquement. Pas de coqueluche/diphtérie séparée. Pré-rempli depuis le carnet.

## 5. Correctifs v16 (issues signalées)

**5a. Chikungunya absent des résultats**
Diagnostiquer pourquoi la carte n'apparaît pas dans `recompute()` / `renderPrintArea()` (probablement non listé dans l'itération des vaccins INSPQ ou nom canonique mal mappé). Corriger pour qu'il se rende exactement comme les autres vaccins dès que le pays le déclenche.

**5b. Posologie Choléra et Dukoral manquante**
La posologie n'est pas rendue lorsque le statut est *Recommandé* ou *À considérer* pour ces deux vaccins. Vérifier les noms canoniques (`'Choléra'` vs `'Dukoral'` vs `'Diarrhée du voyageur'`), ajouter les alias dans `DECISION_TREES`, et confirmer que `posologyFor()` est bien appelé pour ces deux entrées (deux indications distinctes : choléra et diarrhée du voyageur).

**5c. Carte Tétanos intégrée à la liste principale**
Au lieu d'un bloc séparé, l'insérer dans la même grille que les autres vaccins (dashboard + zone d'impression), toujours affichée (pays-indépendante), position cohérente (en tête ou en fin de liste).

## 6. QA — 3 scénarios

1. Enfant 2 ans, Togo, immunocompétent, carnet vide.
2. Adulte 35 ans, Inde long séjour, 1 dose HépB ado.
3. Adulte 60 ans, Brésil court séjour, asplénie, DCaT à 45 ans.

Comparer chaque sortie posologique avec ce que produirait le Jotform manuel.

## Hors scope

- Import PDF, dark mode, impression, listes INSPQ pays : inchangés.
- Pas de coqueluche/diphtérie séparées.

## Volume estimé

~1 500-1 800 lignes JS (arbres + UI conditionnelle + registre + correctifs).
