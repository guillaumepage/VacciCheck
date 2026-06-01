# test_v12.html — correctifs ciblés sur v11

Livrable : `/mnt/documents/test_v12.html`. Repart de v11, on ne touche qu'aux 4 points ci-dessous.

## 1. Import PDF du carnet (régression)

Symptômes : une seule entrée importée (au lieu de ~14), initiales et date de naissance perdues.

- Remplacer l'extraction texte actuelle par la version v8/v9 basée sur les **coordonnées** de PDF.js :
  - pour chaque page, `getTextContent()` → grouper les `items` par Y (tolérance 3 pt), trier par X croissant, insérer un double espace quand le gap horizontal > 10 pt, joindre les lignes avec `\n`
  - concaténer toutes les pages, puis parser ligne par ligne (au lieu d'un gros bloc aplati)
- Rétablir les regex v8 pour :
  - **date de naissance** (motifs `Date de naissance`, `DDN`, `Né[e] le`, formats DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
  - **initiales** (motif `Initiales :` / `Init.` sur la même ligne ou la suivante)
  - **lignes de doses** (antigène + produit + date + volume) — la perte des sauts de ligne en v10/v11 fait qu'une seule dose est détectée
- Conserver les garde-fous existants (taille 15 Mo, worker bundlé, CSP `worker-src 'self' blob:`).
- Test sandbox : recharger un carnet de référence et vérifier ≥ 10 doses, DDN et initiales remplies.

## 2. Libellés du sélecteur de thème

- Remplacer les icônes 🌙 / ☀ du bouton header par les textes **« Mode sombre »** (quand on est en clair) et **« Mode clair »** (quand on est en sombre).
- Aucun changement de comportement : toggle classe `dark`, persistance `localStorage vc_theme`.

## 3. Pictogrammes statut + catégories Rage

### Pictogrammes (résultats + impression)
Remplacer les cases à cocher vides actuelles dans `statusBadge()` par de vraies icônes SVG inline (héritent `currentColor`, lisibles en N&B) :

| Statut | Pictogramme |
|---|---|
| Complet | bouclier coché |
| Recommandé | seringue |
| À considérer | point d'exclamation dans triangle |
| Non requis | cercle barré |
| Urgent | sablier / horloge rouge |

Conserver le code couleur de v11. Pictogrammes identiques à l'écran et à l'impression.

### Catégories d'exposition Rage
Remplacer le `<select>` actuel (Cat I/II/III) par les 3 groupes INSPQ demandés :

- **A — Chauves-souris** (visite de grottes / spéléologie, travail à l'étranger comme vétérinaire, animalier, agent de conservation de la faune)
- **B — Mammifères sauvages** (vétérinaire/animalier à l'étranger ; activités extérieures prolongées : cyclisme, randonnée, camping, travail extérieur ou auprès des animaux ; séjour prolongé ou à répétition ; enfants en bas âge)
- **C — Mammifères domestiques, surtout chiens errants** (tout ce qui est dans B + promenades urbaines/villageoises/rurales)

Chaque option affiche un court tooltip / texte d'aide reprenant la définition (au survol ou sous le select). `recommendForDisease('Rage', …)` mis à jour en conséquence : A/B/C + pays à risque → `Recommandé`, sinon `À considérer` ou `Non requis` selon la classification INSPQ.

## 4. Mise en forme INSPQ (Togo : fièvre jaune, méningocoque)

Cause : les blocs INSPQ sont actuellement aplatis en un seul paragraphe, les sous-titres de zone et leurs puces sont mélangés.

- Réécrire `formatInspqHtml(text)` pour qu'elle reconnaisse les patrons suivants :
  - phrases d'en-tête : `Exigence douanière :`, `Recommandation d'immunisation :`, `Vaccin requis …`, `Région à l'intérieur de la ceinture …`, `Région à l'extérieur de la ceinture …`, etc. → chacune sur sa propre ligne (`<p>` ou `<h4>`)
  - phrase se terminant par `:` → traiter comme sous-titre suivi d'un `<ul>` contenant les puces consécutives
  - lignes commençant par `•`, `–`, `-`, `*` → `<li>` dans le `<ul>` du sous-titre courant
  - double saut de ligne `\n\n` → nouveau paragraphe
- Re-parser la base INSPQ embarquée (script `tools/build-inspq-db.mjs` déjà présent) pour conserver les sauts de ligne d'origine entre paragraphes, sous-titres et puces, au lieu de tout coller.
- Résultat attendu — Togo, fièvre jaune :

```text
Vaccin requis pour entrée et/ou présence de la maladie.
Exigence douanière : Certificat exigé de tous les voyageurs âgés de 9 mois ou plus.
Recommandation d'immunisation :
  • Immunisation recommandée pour tous les voyageurs âgés de 9 mois ou plus.
```

- Résultat attendu — Togo, méningocoque :

```text
Région à l'intérieur de la ceinture africaine de la méningite (tiers nord du pays) :
  • Immunisation pour tous durant la saison sèche (novembre à juin).
  • Envisager l'immunisation pour des groupes particuliers en dehors de la saison sèche (juillet à octobre).

Région à l'extérieur de la ceinture africaine de la méningite :
  • Envisager l'immunisation pour des groupes particuliers.
```

- Vérification : ouvrir le résultat Togo dans la sandbox, copier le rendu textuel, comparer aux blocs ci-dessus. Idem à l'impression (les `<ul>` et sauts de paragraphe sont conservés).

## Hors scope (v11 conservée telle quelle)

- Palette de couleurs, sections rétractables, base INSPQ 219 pays (seul le re-parsing pour §4 change la structure, pas le contenu).
- Logique paludisme, demi-dose HA/HB, JotForms intégrés.
- Calculs automatiques d'âge et de durée de voyage (déjà corrigés en v11).

Confirme pour générer `test_v12.html`.