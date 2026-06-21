## V40 — Plan d'action

### 1. Correctifs immédiats (V40 du HTML)

**Marges d'impression**
- Remplacer `@page { margin: 0 }` par `@page { margin: 12mm 12mm 12mm 12mm }` dans le bloc `@media print` de `public/vaccicheck-app.html`.
- Retirer le padding compensatoire ajouté à `#printArea` en V39 (devenait inutile et créait du vide).
- Conserver la suppression des en-têtes/pieds générés par le navigateur (la marge `@page` reste compatible — l'absence d'en-tête/pied vient des réglages d'impression du navigateur, pas du CSS ; on ajoutera une note explicite à l'utilisateur dans le dialogue d'impression : décocher « En-têtes et pieds de page »).

**Logo officiel partout**
- Réencoder le logo joint (`generated-image.png`) en base64 à 256×256.
- Remplacer la balise `<img>` du `.logo` du topbar.
- Vérifier que `buildPrintHTML` (rapport imprimable) lit bien ce même `<img>` — sinon injecter directement la même data-URL dans le header du rapport pour garantir l'affichage.

Livrable : `public/vaccicheck-app.html` mis à jour + copie `public/test_v40.html` téléchargeable.

---

### 2. Données INSPQ toujours à jour

**Réponse courte : non, pas automatiquement, mais on a deux options.**

L'INSPQ ne publie pas d'API publique pour `sante-voyage/guide/pays`. Les options possibles :

**Option A — Statu quo (recommandé pour l'instant)**
- Les recommandations par pays restent figées dans le HTML, mises à jour manuellement quand l'INSPQ change ses fiches.
- Avantage : zéro coût, zéro dépendance réseau, fonctionne hors-ligne.
- Inconvénient : nécessite une révision périodique (ex. trimestrielle).

**Option B — Scraper côté serveur avec cache**
- Créer un cron (1×/semaine) qui scrape les pages INSPQ par pays, stocke le résultat dans Lovable Cloud, et l'expose à l'app via une server function.
- Avantage : données fraîches automatiquement.
- Inconvénients : (1) risque légal/éthique de scraping sans accord INSPQ, (2) leur HTML peut changer et casser le parser, (3) ajoute backend + maintenance.

**Décision demandée plus tard.** Pour V40 on reste sur Option A.

---

### 3. Checkproofing PIQ (vérification des recommandations)

Tu fourniras des cas cliniques fictifs ; pour chaque cas je :
1. Lis la fiche PIQ pertinente (URLs ci-dessous archivées comme référence).
2. Simule le cas dans VacciCheck.
3. Compare la recommandation générée vs la recommandation PIQ attendue.
4. Liste les écarts et propose les correctifs au moteur.

**Liste de référence enregistrée en mémoire projet** (`mem://references/piq-vaccins`) : Tétanos, FJ, HA, HB, HAHB, Influenza, Mpox, Polio, Rage, RRO, Choléra/ECET, EJ, Chikungunya, Typhoïde (I & O), Méningocoque (B, ACWY, C).

**Format proposé pour chaque round de checkproofing** :
> Cas : âge, sexe, statut vaccinal, condition médicale, destination, durée, type de séjour.
> → Je rapporte : ce que VacciCheck recommande, ce que le PIQ recommande, écarts, fix proposé.

---

### Détails techniques

**Fichier modifié** : `public/vaccicheck-app.html` (sections `@media print` et `.logo`).
**Fichier créé** : `public/test_v40.html` (copie téléchargeable).
**Mémoire** : `mem://references/piq-vaccins` (liste d'URLs PIQ).

### Questions avant build
1. Pour le point 2 (INSPQ), tu confirmes qu'on reste sur **Option A** (mise à jour manuelle) pour l'instant ?
2. Pour le point 3, tu veux commencer par **quel vaccin** en premier ? (ex. Hépatite A, Tétanos, Fièvre jaune) — je préparerai 2-3 cas fictifs couvrant les zones grises et tu valideras les attendus avant que je lance la vérification.
