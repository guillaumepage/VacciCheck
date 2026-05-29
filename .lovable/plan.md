## Correctifs à appliquer dans `test_v6.html` → livré comme `test_v7.html`

Tout reste 100 % côté navigateur, un seul fichier HTML. Le logo joint est intégré en base64 dans le fichier (aucune dépendance externe).

### 1. Confidentialité — initiales du patient après import PDF
Quand un nom est extrait du PDF, le champ « Nom » n'est plus pré-rempli avec le nom complet. À la place :
- Stocker le nom complet uniquement en mémoire (variable JS, jamais affichée).
- Pré-remplir le champ « Nom » avec les **initiales** uniquement (ex. « Guillaume Page » → `G. P.`).
- Sur le résumé imprimé : afficher seulement les initiales également.

### 2. Long séjour automatique si durée > 1 mois
Dans `syncTravel()` (et au changement de `departureDate` / `returnDate` / `tripDuration`) : si durée calculée > 30 jours, cocher automatiquement l'option « Long séjour ». L'utilisateur peut toujours la décocher manuellement.

### 3. Volume (ml) et demi-dose dans l'extraction PDF
- Étendre `extractPdfLines` / `parseQuebecCarnet` pour capturer le volume (`0.5 ml`, `1.0 ml`, `1 ml`) présent sur la ligne de dose du carnet québécois.
- Règles demi-dose :
  - **Havrix 0.5 ml** → marquer « Junior / demi-dose »
  - **Engerix-B 0.5 ml** et **Recombivax HB 0.5 ml** → marquer « demi-dose »
- Affichage dans la ligne vaccinale : `Hépatite A (HA – HAVRIX – 0.5 ml — junior/demi-dose)`.
- Champ `doseVolume` ajouté à chaque entrée pour usage ultérieur.

### 4. Section « Contact avec la population locale » dans le questionnaire clinique
Ajouter une nouvelle section (mêmes intitulés que JotForm MSSS) avec choix :
- Aucun / très limité (hôtels, visites touristiques)
- Occasionnel (marchés, transports en commun)
- Étroit et prolongé (famille, bénévolat, travail humanitaire, soins, écoles)

Cette valeur influence ensuite Hépatite A, Hépatite B, Méningocoque, Rage et Tuberculose dans `recommendationFromJotform`.

### 5. Séparer « Diarrhée du voyageur » et « Choléra »
- Conserver un seul vaccin sous-jacent (Dukoral) mais deux lignes distinctes dans la table des recommandations.
- Logique :
  - **Diarrhée du voyageur** : rappel **tous les 3 mois** si exposition continue.
  - **Choléra** : rappel **tous les 2 ans** (adulte) / **6 mois** (enfant 2-5 ans), seulement si zone endémique + contact étroit + accès limité à eau potable.
- Statut et texte de rappel calculés indépendamment à partir des réponses cliniques.

### 6. Rage — descriptifs des groupes A / B / C
Ajouter dans la section Rage du questionnaire un sélecteur **Groupe d'exposition** avec descriptifs complets (textes intégraux fournis par l'utilisateur) :
- **Groupe A** : Chauves-souris (spéléologie, vétérinaire à l'étranger, …)
- **Groupe B** : Mammifères sauvages (vétérinaire, activités extérieures, séjour prolongé, jeunes enfants, …)
- **Groupe C** : Mammifères domestiques + tout B + promenades en ville/village/campagne

Le groupe sélectionné influence le statut Rage (A/B → Recommandée, C → Recommandée si séjour prolongé ou enfant).

### 7. Renommage de la catégorie « Accès à l'eau potable restreint / achlorhydrie »
**Question pour l'utilisateur ci-dessous** — j'ai besoin du nouveau libellé exact.

### 8. Âge à la réception — calcul exact
Réécrire `ageRe` parsing : au lieu de prendre le texte `(X an Y mois)` du PDF (souvent absent ou approximatif), calculer dynamiquement à partir de `dob` (date de naissance du patient) et de la date de la dose :
```
ageAt = floor((doseDate - dob)/year) ans + mois résiduels
```
Format affiché : `4 ans 7 mois` (ou `8 mois` si < 1 an). Recalculé automatiquement si `dob` est modifié après import.

### 9. Renommer le site « VacciCheck » + logo
- Changer `<title>` et l'en-tête H1 visible en **VacciCheck**.
- Intégrer le logo (image fournie) en base64 dans le HTML, affiché à gauche du titre (hauteur ~48 px), et également en haut du résumé imprimé.

### 10. Déplacer la carte « Carnet de vaccination » avant « Patient et voyage »
Réordonner les `<section>` dans le HTML : Carnet de vaccination (import PDF) devient la **première carte**, puisqu'elle pré-remplit nom, DOB et doses.

---

## Question avant implémentation

Pour le point 7, comment veux-tu renommer « Accès à l'eau potable restreint / achlorhydrie » ? Trois propositions possibles :
1. **Risque alimentaire et hydrique élevé**
2. **Eau et alimentation à risque**
3. **Conditions sanitaires limitées (eau / nourriture)**

Réponds avec ton choix (ou ton propre libellé) et je livre `test_v7.html`.
