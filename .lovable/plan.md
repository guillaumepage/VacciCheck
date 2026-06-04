## Livrable

`test_v28.html` cloné depuis `test_v27.html`. Révision des arbres de décision (`DECISION_TREES`) pour aligner avec l'algorithme fourni par ta collègue. Pour chaque point, j'indique le statut (✅ déjà OK / ⚠️ à corriger / ❌ manquant).

---

### 1) Rougeole — ✅ déjà OK, ⚠️ wording « complet/incomplet »
**Existant :** `'Rougeole'(ctx)` (l.1599‑1617) couvre : né <1970 immun, 2 doses dont ≥1 après 12 mois → complet, 6‑11 mois dose précoce qui ne compte pas, ≥1970 non immun → 2 doses ≥4 sem.

**À ajouter :** préfixer explicitement `<strong>Complet :</strong>` quand 2 doses valides et `<strong>Incomplet :</strong>` quand série partielle, pour cohérence avec la convention du Jotform.

---

### 2) Choléra (vaccination) — ✅ déjà OK
`DECISION_TREES['Choléra']` (l.1684‑1700) gère 2 doses (3 si 2‑5 ans), rappel q2 ans, >5 ans → recommencer. Rien à changer côté posologie.

**À ajouter (point #8 du doc) :** logique de catégorisation `non requis / à envisager` selon contexte INSPQ + groupes (cf. point 8 ci‑dessous).

---

### 3) Poliomyélite — ⚠️ à enrichir
**Existant :** `'Poliomyélite'(ctx)` (l.1524‑1541) parle de « voyageur en zone à risque » sans distinguer les 4 niveaux d'exigence du PIQ.

**Patch :** lire `ctx.inspqText` (texte INSPQ du pays) et détecter :
- `/polio.*sauvage|type 1|type 3|exigence d'entrée/i` → **rappel exigé** (4 sem ≤ délai ≤ 12 mois avant départ) pour adultes >10 ans depuis dernière dose
- `/polio.*vaccinal.*type 2|cVDPV2/i` → **rappel recommandé** (même fenêtre)
- `/eaux usées|détection.*environnement/i` → **rappel recommandé pour travailleurs eaux usées / contacts eau libre près des villes concernées**
- Sinon (`/éliminée/i`) → **aucun rappel adulte requis**

Conserver la logique pédiatrique existante (primovaccination DCaT-VPI 2-4-6 mois + rappels). Préfixer `Complet / Incomplet` selon `s.count`.

---

### 4) Typhoïde — rappels ✅ déjà OK
Distinction Typhim (3 ans) vs Vivotif (7 ans) déjà gérée (l.1548‑1552). Rien à changer.

---

### 5) MPOX — ⚠️ à enrichir
**Existant :** `'Mpox'(ctx)` (l.1516‑1521) — schéma 2 doses + 0/28 j seulement, sans catégorisation contextuelle.

**Patch :** lire `ctx.inspqText` et catégoriser :
- `/risque.*sexuel|principalement.*sexuel/i` (transmission sexuelle uniquement) → **Mesures de protection personnelles** (lien INSPQ) ; mentionner mesures additionnelles si pays d'Afrique. Vaccination uniquement si groupe d'indications PIQ.
- `/présence|active|épidémie|éclosion/i` → **vaccination à envisager / recommandée** pour : activités sexuelles avec partenaires locaux, contacts prolongés étroits (même toit), travailleurs santé en soins directs.
- Statut **Complet** si 2 doses ; **Incomplet** si 1 dose ; ajouter mention **rappel q 2 ans pour travailleurs de laboratoire à haut risque d'exposition à un orthopoxvirus réplicatif** quand applicable (case à cocher existante `rg.labo` si disponible, sinon note explicative).

---

### 6) Encéphalite japonaise — ⚠️ à enrichir
**Existant :** `'Encéphalite japonaise'(ctx)` (l.1576‑1586) → posologie seulement, rappel générique ≥1 an.

**Patch :** introduire la **catégorisation** (cohérente avec le Jotform) :
- Pays sans EJ → **Non requis** + commentaire « vaccin indiqué si séjour >1 mois en milieu rural en période de transmission ».
- Pays avec EJ + court séjour urbain → **Non requis** + commentaire des cas où il aurait été recommandé.
- Pays avec EJ + <1 mois rural + facteur de risque (éclosion / destination incertaine / activités à risque) → **À envisager** + commentaire des contextes.
- Pays avec EJ + ≥1 mois rural en période de transmission → **Recommandé** + commentaire du motif.
- Rappels : **12 mois après primovaccination** ; **10 ans après** si exposition persiste (remplace le « ≥ 1 an » actuel).

Source du contexte : nouveaux champs UI `q_ej_milieu` (rural/urbain), `q_ej_duree` (jours/mois), `q_ej_periode` (transmission oui/non), ou — si on ne veut pas toucher l'UI — questions inférées depuis `ctx.inspqText` + `daysToDep`. **Question pour toi : créer 3 nouveaux contrôles UI dans la section EJ, ou se contenter d'une heuristique texte ?**

---

### 7) Typhoïde — catégorisation ⚠️ à ajouter
**Existant :** posologie OK, mais aucune logique « recommandé / à envisager / non requis » selon contexte.

**Patch :** lire `ctx.inspqText` + groupes de risque (existants : `rg.immuno`, `rg.asplenie`, `rg.gastrique` — ajouter ce dernier s'il manque) :
- `/risque.*transmission.*élevé/i` + Asie du Sud → **Recommandé pour tous**.
- `/risque.*intermédiaire|faible|indéterminé/i` + voyageur dans un groupe particulier (long séjour, hors circuits, VFR, contacts étroits, complications [enfants/aspléniques/immunosupprimés], défenses gastriques amoindries [IPP, anti‑H2, gastrectomie, achlorhydrie, vagotomie]) → **À envisager** + commentaire du contexte.
- Complexe hôtelier tout-inclus + risque faible/intermédiaire/indéterminé → **Non requis** + commentaire.
- Si nouvelle dose requise (dépassement délai) : afficher la dose précédente + barème de validité + recommandation de revaccination.

**Question : as‑tu déjà des cases UI pour « complexe tout-inclus », « VFR », « hors circuits », « long séjour », « défenses gastriques amoindries » ? Sinon, je les ajoute à la section Patient.**

---

### 8) Choléra — catégorisation ⚠️ à ajouter
**Patch :** dans `DECISION_TREES['Choléra']`, avant la branche posologique, ajouter :
- Si pays sans présence choléra → **Non requis**.
- Si présence + voyageur ≥2 ans + (pas d'accès eau potable ET contact étroit population indigente : coopérants, personnel santé, humanitaire en zones sinistrées/camps réfugiés) **OU** défenses gastriques amoindries → **À envisager**.
- Sinon → **Non requis** (commentaire).
- Délai dépassé → dose précédente + validité + recommandation.

**Question : ajouter case UI « coopérant / humanitaire / personnel santé en zone sinistrée » ? Et case « défenses gastriques amoindries » (réutilisable pour typhoïde) ?**

---

### 9) Chikungunya — ⚠️ correction âge
**Existant :** ligne 1593 bloque <18 ans (« Ixchiq non homologué chez les mineurs »).

**Patch :** changer le seuil à **12 ans** (récent élargissement Santé Canada). Conserver l'évaluation bénéfice/risque ≥65 ans.

---

### 10) Méningocoque — ⚠️ à enrichir
**Existant :** `'Méningocoque'(ctx)` (l.1620‑1640) détecte vaguement « ceinture africaine » et mentionne Bexsero/Trumenba.

**Patch :**
- **Saison sèche (novembre→juin)** dans ceinture → **Recommandé pour tous**.
- **Saison humide (juillet→octobre)** dans ceinture OU hors ceinture → **À envisager** selon groupes : <30 ans peu importe durée, ≥30 ans avec contacts étroits/prolongés (hébergement, transports, soins santé, réfugiés, voyage d'aventure) ou long séjour (≥3 semaines).
- **Exception explicite :** safaris courts (Kenya/Tanzanie) → pas d'indication par défaut.
- **Autres régions :** envisager si épidémie/éclosion/hausse inhabituelle d'un sérogroupe vaccinal dans les 6 mois précédents.
- **Hadj / Umrah / travail saisonnier Arabie saoudite → EXIGÉ** (mention certificat).
- **Choix vaccin :** Men‑C seul ou ACYW interchangeables pour primo ; **Menjugate nécessite une dose supplémentaire** ; pour primovaccination à compléter, **préférer ACYW** (protection plus complète).
- Mois courant déterminé via `new Date().getMonth()` pour le contexte saison sèche/humide.
- Statut **Complet / Incomplet** + commentaire des contextes.

---

### Hors scope

Pas de modification au DB INSPQ, à la mise en page, au footer, au routeTree, au moteur d'import carnet, ni au tableau `DEFAULT_VOLUME_BY_PRODUCT`. Pas de nouvelles dépendances.

### QA manuelle

1. Pays avec polio sauvage (Afghanistan, Pakistan) → Polio affiche « rappel exigé 4 sem ≤ délai ≤ 12 mois ».
2. Pays mpox transmission sexuelle (la plupart Amérique/Europe) → Mpox affiche « mesures protection personnelle » + condition vaccination groupe PIQ.
3. Pays Afrique mpox actif (RDC) → Mpox affiche « vaccination recommandée pour activités sexuelles / contacts étroits / soignants ».
4. Pays EJ + séjour rural >1 mois en saison → EJ « Recommandé ».
5. Pays EJ + séjour urbain court → EJ « Non requis » + commentaire des cas indiqués.
6. Inde tout-inclus + 0 facteur risque → Typhoïde « Non requis ».
7. Inde + long séjour VFR → Typhoïde « Recommandé » (Asie du Sud risque élevé).
8. Bangladesh + coopérant santé + pas d'accès eau potable → Choléra « À envisager ».
9. Chikungunya patient 14 ans → posologie Ixchiq accessible (et non plus blocage <18).
10. Arabie saoudite + Hadj → Méningocoque « Exigé » + mention certificat.
11. Burkina Faso en janvier → Méningocoque « Recommandé pour tous (saison sèche) ».
12. Burkina Faso en août → Méningocoque « À envisager » selon âge/durée.

---

### Questions ouvertes avant build

A. **Encéphalite japonaise :** créer 3 contrôles UI (milieu, durée, période) ou heuristique pure depuis le texte INSPQ ?
B. **Typhoïde / Choléra :** ajouter des cases UI pour les groupes spécifiques (tout-inclus, VFR, coopérant/humanitaire, défenses gastriques amoindries), ou se baser uniquement sur les groupes de risque déjà existants ?
C. **Mpox travailleurs de laboratoire :** ajouter une case UI dédiée, ou se contenter d'une note conditionnelle dans le texte de sortie ?

Réponds A/B/C (ou « tu décides » pour que je tranche au plus simple) et je passe en mode build.
