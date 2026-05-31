## Correctifs `test_v8.html` → `test_v9.html`

Toujours un seul fichier HTML autonome, 100 % côté navigateur, aucune dépendance externe sauf les CDN déjà utilisés.

### 1. Champ volume (ml) séparé du nom du vaccin
Actuellement la ligne affichée concatène le produit, le volume et la mention dose dans une seule chaîne (« Hépatite A — HAVRIX — 0,5 ml (junior / demi-dose) »).

Correctif :
- Séparer dans le modèle de données : `{ antigene, produit, volumeMl, doseLabel, date, ageReception, lot }`.
- Affichage en colonnes distinctes dans la table d'historique vaccinal :
  `Antigène | Produit | Volume | Dose | Date | Âge | Lot`
  - Colonne **Volume** : `0,5 ml` ou `— ` si absent
  - Colonne **Dose** : badge `Demi-dose` / `Junior` / `Standard` (déduit automatiquement comme en v8)
- Le résumé imprimé liste aussi le volume dans une colonne propre, plus dans le nom.
- Aucun changement à la logique d'extraction PDF — uniquement séparation des champs déjà capturés.

### 2. Cases à cocher dans le questionnaire clinique
Conversion des menus déroulants binaires/multi-options indépendantes vers des cases à cocher :

| Champ actuel | Nouveau format |
|---|---|
| Long séjour (déjà coché) | reste case à cocher |
| Contact avec population locale (Aucun / Occasionnel / Étroit) | **garde le select** (3 options exclusives) |
| Eau et alimentation à risque (2 sous-groupes) | déjà cases à cocher en v8 |
| Grossesse / allaitement | cases à cocher (séparées) |
| Immunosuppression | case à cocher |
| Travailleur de la santé | case à cocher |
| Activités à risque rage (spéléologie, contact animaux…) | cases à cocher (multi-choix) |
| Saison de transmission (encéphalite japonaise, méningite) | **garde le select** (exclusif) |
| Type de séjour (urbain / rural / mixte) | **garde le select** (exclusif) |

Règle générale : binaire ou multi-sélection → case à cocher ; choix exclusif parmi 3+ options → select conservé.

### 3. Recalcul automatique des recommandations
Bug actuel : `renderResults()` n'est appelé qu'au clic sur « Calculer », ou au changement de pays/dates. Les checkboxes et selects du questionnaire clinique ne déclenchent rien.

Correctif :
- Attacher un listener global `change` + `input` sur le formulaire complet (`#mainForm`) qui appelle `renderResults()` (avec debounce 150 ms).
- Suppression du bouton « Calculer » manuel ou le garder en secours.
- Le recalcul s'applique aussi après import PDF (déjà le cas).

### 4. Section « Carnet de vaccination » rétractable
- Envelopper la carte « Carnet de vaccination » dans un `<details>` natif HTML, ouvert par défaut.
- `<summary>` cliquable affiche : `Carnet de vaccination ▾ (12 entrées importées)` avec compteur dynamique.
- Après un import réussi, repli automatique de la section pour libérer de l'espace ; l'utilisateur peut la rouvrir d'un clic.
- Style cohérent avec la palette VacciCheck (bande bleu pâle, chevron vert).

### 5. Confidentialité — audit et durcissement
État actuel : tout est côté navigateur, aucune requête réseau, aucun backend. Mais le nom complet du patient reste en mémoire JS pendant la session et risque d'être enregistré ailleurs.

Correctifs :
- **Aucun stockage persistant** : suppression de tout appel `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` (vérifier qu'il n'y en a aucun ; ajouter commentaire interdiction).
- **Nom complet jamais conservé** : après extraction, on extrait immédiatement les initiales puis on **écrase** la variable `fullName` (`fullName = null`). Seules les initiales restent en mémoire.
- **Date de naissance** : conservée uniquement pour le calcul d'âge ; jamais affichée à l'écran ni dans le résumé imprimé (seul l'âge calculé apparaît).
- **Numéro d'assurance maladie / NAM** : si présent dans le PDF, ne jamais l'extraire (regex de blocage explicite, jeté avant stockage).
- **Impression / export** : le résumé imprimé affiche les initiales + l'âge, jamais le nom ou la DDN.
- **Aucune requête réseau sortante** : ajout d'un meta CSP strict
  `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: blob:; connect-src 'none'; form-action 'none'">`
  ce qui bloque toute exfiltration accidentelle (fetch, XHR, formulaire). Les CDN polices/PDF.js sont déjà inlinés ou autorisés via `script-src`.
- **Vidage explicite** : bouton « Effacer la session » qui réinitialise tous les champs + recharge la page (`location.reload()`).
- **Avertissement visible** en bas de page : « Toutes les données restent dans votre navigateur. Aucune information n'est envoyée à un serveur. »

---

Aucune autre fonctionnalité du v8 n'est modifiée (palette VacciCheck, layout 2 colonnes, initiales prénom-nom, sous-groupes eau/alimentation, etc.).

Livraison : `test_v9.html` dans `/mnt/documents/`. Confirmer pour implémentation.
