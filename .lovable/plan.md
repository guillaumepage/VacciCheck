Livrable : `test_v11.html` dans `/mnt/documents/`, basé sur `test_v10.html`. Tout le reste (palette, sections rétractables, demi-dose HA/HB, base INSPQ 219 pays, pictogrammes, JotForms) est conservé.

## 1. Import PDF restauré (régression v10)

- Reprendre le pipeline v9 :
  - `pdfjsLib.getDocument` + worker inline déjà bundlé
  - extraction page par page avec **regroupement par coordonnée Y** (tolérance 3 pt) et tri X croissant pour préserver les sauts de ligne du carnet
  - garde-fou taille (15 Mo)
- Vérifier en sandbox avec un carnet test que les lignes `Antigène | Produit | Date | Lot | Volume` se reforment correctement avant parsing.

## 2. Mode sombre réintégré

- Bouton 🌙/☀ dans le header (comme v9), persisté en `localStorage` (`vc_theme`).
- Toggle de la classe `dark` sur `<html>` ; variables CSS `--bg`, `--fg`, `--card`, `--border`, `--muted` déclinées en clair/sombre.
- Vérifier que les badges statut, pictogrammes et cartes pays restent lisibles dans les deux modes.

## 3. Rage avec catégories d'exposition (menu déroulant)

- Réintroduire le `<select>` v9 dans le questionnaire clinique :
  - Catégorie I – contact sans lésion cutanée
  - Catégorie II – griffure ou égratignure mineure
  - Catégorie III – morsure transdermique / contact muqueux / chauve-souris
- Branché sur `recommendForDisease('Rage', ...)` : statut `Urgent` pour III, `Recommandé` pour II + zone à risque, `À considérer` pour I + zone à risque, `Non requis` sinon.

## 4. Calculs automatiques (régression v10)

- Réintégrer les helpers v9 :
  - `parseDate()` robuste (DD/MM/YYYY, DD-MM-YYYY, ISO, années à 2 chiffres → +2000, UTC)
  - `computeAge(dob, ref=today)` → âge actuel (champ `Âge`)
  - `computeAgeAtDose(dob, doseDate)` → affiché sur chaque ligne du carnet
  - Liaison bidirectionnelle voyage :
    - changer `dateDepart` + `dateRetour` → recalcule `dureeJours`
    - changer `dateDepart` + `dureeJours` → recalcule `dateRetour`
    - changer `dateRetour` + `dureeJours` → recalcule `dateDepart`
- Listeners `input` sur tous les champs concernés ; un seul flag anti-boucle pour éviter les recalculs croisés.

## 5. Suppression du champ « Lot »

- Retirer la colonne **Lot** du tableau carnet (header + cellules) et du formulaire d'ajout/édition.
- Le parser PDF continue de lire la valeur mais ne la stocke plus dans l'objet `dose` (réduit aussi l'empreinte mémoire et la surface confidentielle).
- Aucune autre colonne touchée (date, antigène, produit, volume, demi-dose, âge à la dose).

## 6. Codes couleurs résultats (badges statut)

Remap dans `statusBadge()` + classes CSS :

| Statut | Couleur fond | Cas |
|---|---|---|
| Vert | `--ok` | Vaccination complète, aucune dose requise |
| Orange | `--warn` | Recommandé / incomplet (dose(s) à donner) |
| Jaune | `--maybe` | À considérer selon contexte |
| Gris | `--muted` | Non requis |

- Ajouter une 5e valeur `Complet` au moteur ; `recommendForDisease()` retourne `Complet` quand le schéma est à jour ET aucune dose de rappel due, sinon `Recommandé`.
- Pictogrammes conservés (✓ vert, ⚠ orange, ⏱ jaune, ⊘ gris) — fonctionnent en N&B.

## 7. Mise en page INSPQ préservée (espacement, puces)

- Dans le parseur INSPQ (`tools/build-inspq-db.mjs` puis rebuild de la base embarquée) :
  - garder les **paragraphes** (split sur `\n\n`) et les **puces** (`•` ou `<li>`) comme tableau d'items, pas comme chaîne aplatie
  - chaque sous-zone (ex. « Région à l'intérieur de la ceinture africaine de la méningite ») devient un sous-titre avec ses propres puces en dessous
- Rendu HTML résultat : `<h4>` pour la sous-zone, `<ul>` avec marge entre `<li>`, ligne vide entre groupes. Visuellement proche de la fiche INSPQ.
- Conservé à l'impression.

## 8. Logique paludisme corrigée

Nouveau mapping dans `recommendForMalaria()` :

| Donnée INSPQ | Statut | Couleur |
|---|---|---|
| Présence dans tout le pays + médication requise | `Recommandé` | Orange |
| Présence dans certaines zones seulement (médication selon itinéraire) | `À considérer` | Jaune |
| Mesures de protection personnelle seulement (pas de médication) | `Non requis` | Gris (mention « mesures anti-moustiques ») |
| Absence de paludisme | `Non requis` | Gris |

- Le texte INSPQ détaillé (zones, espèces, résistance chloroquine/méfloquine) reste affiché sous le badge avec la mise en page §7.
- Cas test Togo doit afficher **Orange / Recommandé — médication pour zone de résistance à la chloroquine**.

## 9. Impression avec couleurs + pictogrammes

- Retirer le `filter: grayscale(1)` global de `@media print`.
- Ajouter `-webkit-print-color-adjust: exact; print-color-adjust: exact;` sur `body`, badges, cartes recommandations → force Chrome/Edge/Firefox à imprimer les fonds colorés.
- Garder les pictogrammes SVG inline (déjà `currentColor`) et la note utilisateur : cocher « Graphiques d'arrière-plan » dans le dialogue d'impression si jamais désactivé.
- Logo VacciCheck reste en couleur sur la page imprimée.

## Hors scope

- Aucun changement à la base INSPQ 219 pays au-delà du re-parsing pour §7.
- Aucun changement aux JotForms intégrés, ni à la liste des groupes cliniques.
- Pas de refonte de la palette ni du layout 2 colonnes.

Confirme pour génération de `test_v11.html`.
