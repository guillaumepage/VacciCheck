## Objectif

Livrer `/mnt/documents/test_v21.html` (base v20) avec :
1. Arbres décisionnels Hépatite A et B fidèles aux Jotforms (en particulier toutes les branches d'immunosuppression, double dose selon l'âge, dosage anti-HBs).
2. Renommage d'un libellé du questionnaire clinique.

---

## 1. Refonte Hépatite A (Jotform P1 — questions #232, #233, #236, #240, #247, #250)

Branches encodées dans `DECISION_TREES['Hépatite A']`, lues dans cet ordre :

- **#232 Statut immunitaire** (`q_immuno` + dérivés VIH/greffe/biologique) → immunocompétent vs immunosupprimé.
- **#233 Doses au dossier** (via `ctx.stats(['Hépatite A','Hépatite A+B'])`) → 0, 1, ≥2.
- **#236 Âge à la 1re dose** (registre `VACCINE_PRODUCTS`) → si <1 an, dose ne compte pas.
- **#240 Délai depuis la dernière dose** → si <6 mois, attendre ; sinon administrer 2e dose.
- **#247 Présence d'une hépatopathie chronique** (`q_hepatique`) → vaccination prioritaire + envisager sérologie post-vaccinale.
- **#250 Immunosupprimé** → schéma 2 doses standard MAIS contrôle anti-HAV IgG 1-2 mois après la 2e dose (cible séroconversion). Considérer une 3e dose si non-répondeur. Pour ≥40 ans immunosupprimé OU hépatopathie sévère : envisager Ig IM 0,02 mL/kg en complément de la 1re dose si départ <2 semaines.

Sortie : posologie + notes contextuelles + bannière "anti-corps à doser" quand pertinent.

## 2. Refonte Hépatite B (Jotform P1 — questions #182, #183, #191, #196, #210, #263, #264)

Branches dans `DECISION_TREES['Hépatite B']` :

- **#263/#264 Catégorie patient** : ajouter un sélecteur conditionnel `q_hepb_categorie` (5 choix Jotform) : (a) Adulte immunocompétent, (b) Nourrisson/enfant <20 ans, (c) Immunosupprimé non dialysé, (d) Hémodialysé / insuffisance rénale chronique, (e) Pré-greffe / post-greffe.
- **#182 Doses au dossier** (`ctx.stats(['Hépatite B','Hépatite A+B'])`).
- **#183 Anti-HBs antérieur connu** : nouveau champ `q_antiHBs` (UI/L ou "inconnu") → si ≥10 UI/L documenté, considéré protégé (sauf hémodialysé : cible ≥10 annuelle).
- **#191 Schéma utilisé** : standard 0-1-6 vs accéléré 0-7-21+12mois vs Heplisav-B 0-1 mois.
- **#196 Âge à la 1re dose / âge actuel** : <20 ans → dose pédiatrique (0,5 mL) ; ≥20 ans → dose adulte (1 mL).
- **#210 Délai depuis dernière dose** : si série interrompue, reprendre là où arrêtée (pas de redémarrage).
- **#264 Double dose** :
  - Immunosupprimé non dialysé → **double dose** (40 µg) à 0-1-2-6 mois + dosage anti-HBs 1-2 mois après la dernière dose, cible ≥10 UI/L.
  - Hémodialysé / IRC → Engerix-B 40 µg (2×20 µg) ou Recombivax HB 40 µg (1 mL formulation dialyse) à 0-1-2-6 mois + dosage annuel anti-HBs, rappel si <10 UI/L.
  - Pré-greffe : double dose accélérée 0-1-2-6 mois, anti-HBs 1-2 mois post-série.
  - Non-répondeur (anti-HBs <10 après série complète) : 2e série de 3 doses (double dose si immunosupprimé), re-dosage 1-2 mois après.

Sortie : posologie + bannière "Anti-HBs à doser 1-2 mois après la dernière dose (cible ≥10 UI/L)" quand applicable.

## 3. UI conditionnelle (section "Posologie suggérée" ou bloc dédié)

- Lorsque Hépatite B est déclenchée : afficher le sélecteur `q_hepb_categorie` + champ `q_antiHBs` (input numérique optionnel, placeholder "UI/L"). Pré-rempli "Adulte immunocompétent" par défaut, ou "Immunosupprimé non dialysé" si `q_immuno` coché.
- Lorsque Hépatite A est déclenchée et `q_immuno` OU `q_hepatique` coché : afficher case "Considérer Ig IM si départ <14 j" + rappel anti-HAV IgG post-vaccinal.
- Recalcul via `recompute()` à chaque changement.

## 4. Renommage questionnaire clinique (ligne 259)

Avant :
```html
<input type="checkbox" id="q_enfants_locaux"/> Contact rapproché avec enfants locaux
```
Après :
```html
<input type="checkbox" id="q_enfants_locaux"/> Contact avec la population locale
```
(ID inchangé pour ne pas casser les références JS — seul le libellé visible change.)

## 5. QA

Scénarios à dérouler manuellement et comparer à la sortie Jotform :
1. Adulte 40 ans immunocompétent, Hépatite B 0 dose → 0-1-6 standard, pas de dosage.
2. Adulte 35 ans VIH+ CD4 bas (immunosupprimé), Hépatite B 0 dose → **double dose 40 µg 0-1-2-6** + anti-HBs 1-2 mois post.
3. Adulte 60 ans hémodialysé, Hépatite B 2 doses au dossier → compléter 0-1-2-6 en formulation dialyse + dosage annuel.
4. Adulte 50 ans hépatopathie chronique, Hépatite A 0 dose, départ dans 10 j → 1re dose Havrix + envisager Ig + dosage anti-HAV.
5. Adulte 30 ans, anti-HBs antérieur 35 UI/L → considérer protégé, aucun rappel.

## Technique

- Modifier `DECISION_TREES['Hépatite A']` et `['Hépatite B']` dans `/mnt/documents/test_v20.html` → sauver sous `test_v21.html`.
- Ajouter les inputs conditionnels `q_hepb_categorie` (select) et `q_antiHBs` (input number) dans la section questionnaire, masqués par défaut, révélés via `display:none` toggle dans `renderPrintArea()` / `recompute()`.
- Étendre `buildCtx()` pour exposer `ctx.hepb = { categorie, antiHBs }`.
- Vérifier la lecture : générer le HTML, ouvrir dans un headless browser et capturer la zone "Posologie suggérée" pour les 5 scénarios. Corriger jusqu'à conformité avec les Jotforms.

## Hors scope

- Carnet vaccinal, urgence/délai, autres vaccins, impression, design : inchangés.
