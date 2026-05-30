
## Correctifs `test_v7.html` → `test_v8.html`

Toujours un seul fichier HTML autonome, 100 % côté navigateur. Logo VacciCheck (image jointe) intégré en base64.

### 1. Volume (ml) + mention « junior / demi-dose » — réparation
Le code v7 capturait `doseVolume` mais l'affichage de la ligne vaccinale ne l'imprimait pas (oubli dans le template). Correctifs :
- Dans la regex de parsing du carnet québécois, élargir la capture du volume : accepter `0,5 ml`, `0.5 ml`, `1 ml`, `1,0 ml`, `1.0 ml` (la virgule décimale française n'était pas reconnue).
- Ajouter le volume **systématiquement** dans le libellé affiché : `Hépatite A — HAVRIX — 0,5 ml`.
- Règles demi-dose (étiquette ajoutée à droite du volume) :
  - Havrix 0,5 ml → `(junior / demi-dose)`
  - Engerix-B 0,5 ml → `(demi-dose)`
  - Recombivax HB 0,5 ml → `(demi-dose)`
- Si le volume n'est pas trouvé dans le PDF, afficher `— ml non précisé` au lieu de masquer.
- Même affichage dans le résumé imprimé et dans la table d'historique.

### 2. Réorganisation de la mise en page
Passer en grille deux colonnes sur écran ≥ 1100 px :
```text
┌──────────────────────────┬──────────────────────────┐
│  Carnet de vaccination   │  Patient et voyage       │
│  (import PDF)            │  Pays de destination     │
│                          │  Questionnaire clinique  │
├──────────────────────────┴──────────────────────────┤
│  Résultats / Recommandations (pleine largeur)       │
└─────────────────────────────────────────────────────┘
```
- Sur mobile (< 1100 px) : empilement vertical, ordre = Carnet → Patient/voyage → Questionnaire → Résultats.
- Les sections Patient/voyage, Pays, Questionnaire clinique restent visibles dès l'ouverture de la page, plus besoin de scroller après import.

### 3. Ordre des initiales (prénom d'abord)
Corriger `extractInitials()` : actuellement on prend `lastName[0] + firstName[0]` (ordre du PDF québécois `NOM, Prénom`). Inverser → `firstName[0] + ". " + lastName[0] + "."` → `G. P.` pour « Guillaume Page ». S'applique au champ initiales, au résumé imprimé, et au header de la fiche.

### 4. Restaurer les deux sous-groupes de « Eau et alimentation à risque »
La case unique cochable est remplacée par **deux cases distinctes** (l'une OU l'autre suffit à activer la recommandation Hépatite A / Typhoïde / Choléra renforcée) :

- **Sous-groupe A — Conditions sanitaires inadéquates** : « N'aura pas accès à de l'eau potable ET sera en contact étroit avec une population indigente isolée des ressources médicales (coopérants, personnel de la santé, personnel humanitaire en zones sinistrées / camps de réfugiés, etc.) »
- **Sous-groupe B — Mécanismes de défense gastrique amoindris** : « Achlorhydrie, gastrectomie, vagotomie, thérapie continue aux IPP (oméprazole, lansoprazole) ou aux anti-H2 (cimétidine, famotidine, ranitidine) »

Logique : `eauEtAlimentationRisque = sousGroupeA || sousGroupeB`. Le résumé imprimé liste lequel des deux est coché.

### 5. Redesign avec la palette du logo VacciCheck
Palette extraite du logo :
- Bleu principal : `#1E64B8` (V du logo)
- Vert principal : `#39A845` (Check du logo)
- Cyan/teal accent : `#2DBFD4` (seringue)
- Fond : `#F7FAFC` (off-white)
- Texte : `#0F2747` (bleu nuit)

Changements visuels :
- En-tête : bande dégradée `linear-gradient(135deg, #1E64B8 0%, #2DBFD4 50%, #39A845 100%)` avec logo (hauteur 56 px) à gauche et titre **VacciCheck** en blanc.
- Cartes : fond blanc, bordure `1px solid #E3EAF2`, ombre douce, coin arrondi 12 px, titre de carte sur bande bleue claire `#E8F1FB` avec barre verticale verte `#39A845` à gauche.
- Boutons primaires : bleu `#1E64B8`, hover bleu foncé ; boutons secondaires : contour vert `#39A845`.
- Badges de statut vaccinal :
  - À jour → fond vert pâle `#E6F4E8`, texte `#1F7A2A`
  - Rappel requis → fond ambre `#FFF4E0`, texte `#9A5B00`
  - Recommandé → fond bleu pâle `#E8F1FB`, texte `#1E64B8`
  - Non requis → fond gris `#EEF1F4`, texte `#5A6779`
- Tableaux : entêtes bleu `#1E64B8` texte blanc, lignes alternées `#F7FAFC`.
- Polices : Inter (déjà via Google Fonts CDN), titres en `600`, corps `400`.
- Résumé imprimé : même palette, logo en haut à gauche, bande dégradée réduite à 4 mm pour économiser l'encre.

---

Aucune autre fonctionnalité du v7 n'est modifiée (extraction PDF, calcul d'âge, Rage A/B/C, Diarrhée/Choléra séparés, long séjour auto, contact population locale, etc.).

Confirmation : je livre `test_v8.html` dans `/mnt/documents/` ?
