
# test_v15.html — 4 correctifs sur v14

Livrable : `/mnt/documents/test_v15.html`. Base = `test_v14.html`. On garde toute la logique existante (importation PDF, dark mode, INSPQ, Dukoral, paludisme, Rage A/B/C).

## 1. Sous-titres Méningocoque (regroupement correct des puces)

Aujourd'hui, après le sous-titre « Région à l'intérieur de la ceinture africaine de la méningite (tiers nord du pays) : », les deux puces *« Immunisation pour tous durant la saison sèche… »* et *« Envisager l'immunisation pour des groupes particuliers en dehors de la saison sèche… »* ne se retrouvent pas dans la `<ul>` ouverte par ce sous-titre — elles tombent dans la `<ul>` suivante (sous « Région à l'extérieur… »), et la 3e puce remonte aussi.

Cause : `formatInspqHtml()` ouvre une nouvelle `<ul>` à chaque sous-titre via `closeUl()`, mais `splitSentences` ne sépare pas correctement les phrases entre les deux régions. Les puces appartiennent toutes au texte qui suit le 1er sous-titre tant que le 2e sous-titre n'a pas été émis.

Correctif :
- Renforcer `splitSentences` pour couper aussi sur `.\s+(?=Région à l['']?(intérieur|extérieur))` afin de bien isoler les 2 régions comme phrases séparées.
- Dans la passe « pre-bullet » (lignes 1078-1092), quand on détecte un sous-titre (`endsColon`), on **vide d'abord les puces déjà accumulées sous le sous-titre courant** puis on ouvre le nouveau sous-titre. Concrètement : avant d'émettre `{type:'h'}`, fermer la liste en cours, et faire en sorte que les `{type:'li'}` qui suivent ce `h` (jusqu'au prochain `h`) soient rendus sous lui.
- À l'étape de rendu, on garantit l'ordre `<p class="sub-heading">…</p><ul>…</ul>` strictement (déjà presque le cas — vérifier que `openUl()` ne se déclenche pas avant le sous-titre).

Critère d'acceptation Togo / Méningocoque :
```
Région à l'intérieur de la ceinture africaine de la méningite (tiers nord du pays) :
 • Immunisation pour tous durant la saison sèche (novembre à juin).
 • Envisager l'immunisation pour des groupes particuliers en dehors de la saison sèche (juillet à octobre).
Région à l'extérieur de la ceinture africaine de la méningite :
 • Envisager l'immunisation pour des groupes particuliers.
```

## 2. Crochet manquant dans le pictogramme bouclier « Complet »

Cause v14 : `ICONS.check` a un `<path>` interne avec `fill="none"` + `stroke="#fff"`. Sur le badge vert `.badge.ok` (fond vert, `color:#fff`), le bouclier extérieur est blanc (`currentColor=#fff`), et le crochet est aussi blanc → invisible.

Correctif : aligner sur le motif des autres pictogrammes — corps blanc (`currentColor`), crochet dessiné en sombre opacité 0.75 pour rester lisible sur n'importe quelle pastille :
```js
check: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z"/><path d="M8.5 12l2.5 2.5L16 9.5" fill="none" stroke="#1a1a1a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/></svg>'
```

## 3. Recommandations posologiques basées sur les 4 jotforms

Les 4 PDF Jotform extraits définissent, pour chaque vaccin, un arbre de décision : entrées = (pays/zone, âge, statut immunitaire, antécédents vaccinaux), sortie = recommandation textuelle précise (nombre de doses, intervalles, rappels, produits).

### Vaccins couverts (et formulaire source)

| Vaccin | Formulaire | Entrées clés (ID jotform) |
|---|---|---|
| Hépatite B | Partie 1 | Prévalence pays (#263), Catégorie patient (#264), Âge (#182), Doses reçues (#183/191/196/210), Âge 1e dose, Statut immunitaire, Schéma accéléré |
| Hépatite A | Partie 1 | Prévalence (#233), Âge (#232), Doses (#236/240), Antécédent (#247), Âge 1e dose (#250), Statut immunitaire |
| Choléra (oral) | Partie 2 | Risque pays (#4), Âge (#5), Accès eau (#6), Antécédent (#7), Délai dernière dose (#8) |
| Diarrhée voyageur (Dukoral, déjà partiellement présent) | Partie 2 | Risque (#27), Âge (#28), Antécédent (#31), Délai (#33) — utiliser la logique du formulaire au lieu du seuil simple actuel |
| Rage | Partie 2 | Catégorie A/B/C (#42), Antécédent (#46), Statut immunitaire (#49) |
| Poliomyélite | Partie 2 | Risque pays (#85), Âge (#86), Doses (#88/92), Délai (#97) |
| Typhoïde | Partie 2 | Âge (#108), Risque pays (#109), Type voyage/patient (#130), Doses (#110), Délai (#111/#119) |
| Mpox | Partie 3 | Risque pays (#12), Catégorie (#15), Doses (#16) |
| Chikungunya | Partie 3 | Risque (#24), Âge (#27), Antécédent (#29) |
| Fièvre jaune | Partie 3 | Âge (#34), Risque (#36), Antécédent (#39), Catégorie spéciale (#41) |
| Encéphalite japonaise | Partie 3 | Âge (#49), Risque (#51), Période transmission (#53), Milieu rural (#55), Durée (#58), Primovaccination (#59/#60/#75/#62) |
| Tétanos (DCaT/dT) | Partie 3 | Âge (#3), Doses (#4/#84), Dernière dose après 4 ans (#5), Après 10 ans (#7/#90), Après 40 ans (#9), Plus de 5 ans (#8) |
| Rougeole (RRO) | Partie 4 | Année naissance (#3), Doses (#5), Âge 1e dose (#9), Âge actuel (#14/#18) |
| Méningocoque | Partie 4 | Zone à risque (#26), Ceinture africaine (#27), Saison sèche (#29), Groupe particulier (#64), Âge (#30), Doses (#31), Âge 1e dose (#35/#40/#54), ≥1 dose après 1 an (#45), Délai (#42/#66/#49), ≥1 dose après 10 ans (#58) |
| Encéphalite à tiques | Partie 4 (suite) | (extraire des questions restantes) |

### Architecture proposée

Créer un module `DECISION_TREES` (objet JS, ~600-900 lignes) avec une entrée par vaccin :
```js
DECISION_TREES['Hépatite B'] = {
  // Entrées calculées à partir de l'état UI existant (pays, âge, durée, profil)
  // + nouvelles entrées exposées dans les questionnaires cliniques :
  inputs: ['prevalence_hb', 'categorie_patient', 'age_groupe', 'doses_recues',
           'age_1e_dose', 'statut_immun', 'dose_hb_junior', 'double_dose'],
  decide(ctx){
    // Reproduit exactement la logique conditionnelle du jotform partie 1
    // Retourne { posologie: "…", note?: "…", complet?: true }
  }
};
```

`recompute()` et `renderPrintArea()` appellent `DECISION_TREES[name].decide(ctx)` après avoir établi la recommandation pays (à considérer / pour tous / non requis). Le texte posologique s'affiche dans un encadré « **Posologie suggérée :** … » sous la recommandation pays.

### Nouveaux champs UI à ajouter (section « Questionnaire clinique »)

Pour ne pas surcharger l'écran, les champs sont conditionnels : un champ n'apparaît que si une recommandation est active pour le vaccin correspondant. Champs ajoutés (dérivés des jotforms) :
- **Statut immunitaire** : immunocompétence / immunosuppression (1 menu, sert HepA/HepB/Rage/FJ).
- **Catégorie de patient Hépatite B** (#264) : 5 cases à cocher (risque PIQ, long séjour, travailleur étranger, tourisme médical, voyage adoption).
- **Catégorie Mpox** (#15) : 3 cases à cocher (contacts sexuels locaux, contacts étroits prolongés, soignant).
- **Catégorie Fièvre jaune spéciale** (#41) : 4 cases (VIH 1e dose, 3e trimestre grossesse, immunosuppr 1e rappel, dose fractionnée).
- **Catégorie Typhoïde** (#130) : 5 cases.
- **Catégorie Méningocoque >30 ans** (#64) : 3 options.
- **Activités EJ** : milieu rural, durée >1 mois (déjà partiellement).

### Nouveaux champs « Registre vaccinal » (par vaccin)

Pour chaque vaccin actif, un mini-formulaire (visible seulement si une recommandation existe) :
- Nombre de doses reçues
- Âge à la 1e dose (le cas échéant)
- Délai depuis la dernière dose
- Schémas spéciaux (HB double-dose, HA demi-dose pédiatrique, polio injectable/oral, etc.)

Le carnet importé via PDF pré-remplit ces champs : on map `VACCINE_PRODUCTS` (déjà présent) → vaccin canonique, on compte les doses et on calcule âge à la 1e dose / délai depuis la dernière dose à partir des dates extraites et de la DDN.

## 4. Section Tétanos

Ajout d'un bloc spécifique (toujours affiché, indépendant des pays) basé sur le formulaire partie 3 :

- **Entrées** :
  - Âge (#3 — 7 catégories : 6 sem-4 mois, 4 mois-1 an, 1-3 ans, 4-<10 ans, 10-17 ans, 18-49 ans, ≥50 ans)
  - Nombre de doses reçues (#4 : <3, ≥3 ; #84 : ≤3, >3)
  - Dernière dose après 4 ans ? (#5)
  - Au moins 1 dose après 4 ans ? (#6)
  - Dernière dose après 10 ans ? (#7) / Au moins 1 dose après 10 ans ? (#90)
  - Au moins 1 dose après 40 ans ? (#9)
  - >5 ans depuis la dernière dose ? (#8)

- **Sortie** : statut (Complet / Recommandé / À considérer) + posologie textuelle (ex : « 1 dose de rappel dT à donner avant le départ ; prochaine dose de rappel à 50 ans » ; « primovaccination DCaT 3 doses à 2-4-6 mois » ; etc.).

- **Affichage** : nouvelle carte « Tétanos / Coqueluche / Diphtérie » dans le dashboard et le rapport imprimable, pictogramme bouclier + statut. Texte structuré avec sous-titres si plusieurs scénarios (ex : enfant non vacciné vs adulte).

## Implémentation (technique)

1. **Étape A — correctifs visuels (rapides) :** items 1 et 2 (modifier `formatInspqHtml` + `splitSentences` + `ICONS.check`). ~50 lignes touchées.
2. **Étape B — moteur de décision :** créer `DECISION_TREES` (objet JS pur, testable). Encoder les 15 arbres en se basant **strictement** sur les questions et conditions des jotforms (chaque branche du jotform = une condition `if`). ~700 lignes.
3. **Étape C — UI :** ajouter dans la section « Questionnaire clinique » les nouveaux champs conditionnels, et un nouveau panneau « Registre vaccinal détaillé » qui se remplit auto depuis le PDF importé et reste éditable.
4. **Étape D — Tétanos :** carte dédiée comme décrit ci-dessus.
5. **Étape E — QA :** test sur 3 scénarios : (a) enfant 2 ans Togo, (b) adulte 35 ans Inde long séjour, (c) adulte 60 ans Brésil court séjour. Vérifier que les posologies correspondent à ce que produirait le jotform manuel.

## Hors scope

- Pas de changement à l'importation PDF du carnet (préservée).
- Pas de modification du dark mode ni du bouton d'impression.
- Pas de tableau récapitulatif global (peut être ajouté plus tard).

## Confirmation

Cette implémentation est volumineuse (étape B+C+D : ~1500-2000 lignes JS+HTML). Confirme pour que je génère `test_v15.html` complet. Si tu préfères livrer en 2 temps :
- **v15a** : items 1, 2, 4 (Tétanos seul) — léger.
- **v15b** : item 3 (décisions complètes pour les 14 autres vaccins) — gros morceau.

Indique-moi laquelle des deux approches tu préfères.
