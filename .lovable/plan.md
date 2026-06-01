
# test_v14.html — 5 correctifs ciblés sur v13

Livrable : `/mnt/documents/test_v14.html`. On garde tout le reste (logique paludisme, importation PDF, dark mode, pictogrammes par maladie, formatage INSPQ).

## 1. Supprimer les dédoublements de champs

**Long séjour** — il existe à la fois la case `#q_long_sejour` (ligne 252) ET la liste `#travelType` (ligne 233 : « Court séjour / Long séjour »). On garde uniquement le menu déroulant `#travelType` qui pilote déjà `rg.longSejour` via `travelType.value==='long'` (ligne 867). 

Actions :
- Supprimer la case `q_long_sejour` à la ligne 252.
- Supprimer le préfill `document.getElementById('q_long_sejour').checked=true;` ligne 413.
- `clinicalRiskGroups()` ligne 867 → `longSejour: travelType.value==='long'` (retirer la référence `q_long_sejour.checked`).

**Exposition rage** — les cases `#q_speleo` (« Spéléologie / contact chauves-souris ») et `#q_animaux` (« Contact prévu avec animaux ») doublonnent le menu déroulant `#q_rage_exposure` (groupes A/B/C INSPQ). On garde uniquement le menu déroulant.

Actions :
- Supprimer les deux `<label class="cb">` lignes 264-265.
- Retirer `speleo:` et `animaux:` (lignes 859-860) de `clinicalRiskGroups()`.
- `recommendForDisease('Rage', …)` ligne 941 → remplacer `rg.speleo||rg.animaux||rg.enfants||(rg.longSejour&&riskZone)||rg.humanitaire` par `rg.enfants||(rg.longSejour&&riskZone)||rg.humanitaire` (la sélection A/B/C couvre déjà les cas spéléo/animaux explicites au-dessus dans la même fonction).

## 2. Pictogrammes « tout blanc » dans les résultats

Cause : dans `ICONS.shieldExclam` et `ICONS.warn`, le corps du bouclier/triangle utilise `fill="currentColor"`. À l'intérieur d'un `.badge.warn` (`color:#fff`) ou `.badge.maybe` (`color:#fff`), `currentColor` vaut blanc → tout le pictogramme (corps + « ! ») devient blanc sur fond orange/jaune et le « ! » blanc se confond avec le corps blanc.

Correctif : forcer les marques internes (`!` du bouclier, `!` du triangle, point) à utiliser une couleur sombre opaque qui contraste sur n'importe quelle pastille colorée.

```js
shieldExclam: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z"/><path d="M12 8v5" stroke="#1a1a1a" stroke-width="2.6" stroke-linecap="round" opacity=".75"/><circle cx="12" cy="16.5" r="1.3" fill="#1a1a1a" opacity=".75"/></svg>',
warn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2z"/><path d="M12 10v5M12 18v.5" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round" opacity=".75"/></svg>',
```

Même retouche pour `ICONS.check` afin que le crochet reste lisible sur la pastille verte (le vert `#1F7A2A` + crochet blanc passe encore, mais on aligne pour cohérence sur fond imprimable clair) :

```js
check: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z"/><path d="M8.5 12l2.5 2.5L16 9.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
```
(inchangé sauf léger épaississement — la pastille verte garde un bon contraste blanc).

## 3. Mise en page Méningocoque / Paludisme / Rage (impression + écran)

La fonction `formatInspqHtml()` (lignes 1055-1121) reçoit du texte brut séparé par `•`. Pour les trois maladies montrées en capture, les sous-régions (« Région à l'intérieur de la ceinture africaine de la méningite (tiers nord du pays) : », « Région à l'extérieur de la ceinture africaine de la méningite : ») et les sous-puces (« Vaccination préexposition : … », « Prophylaxie postexposition : … », « Disponibilité des produits immunisants dans le pays : … ») doivent apparaître **comme sous-titres en gras** suivis de leur(s) puce(s) indentée(s), pas comme une longue liste plate.

Cause : `formatInspqHtml` n'identifie un sous-titre que pour la phrase finissant par `:`. Quand une puce commence par « Vaccination préexposition : envisager… », tout part dans un seul `<li>` plat. De plus, le passage par `splitSentences` casse mal les puces qui mêlent label + valeur sur la même ligne.

Correctif ciblé (réécriture du parsing par bullet, sans toucher au reste) :

1. Reconnaître un **label en début de puce** : `^([^:]{2,80})\s*:\s*(.+)$` (sans `:` au milieu) → générer une puce avec `<strong>Label :</strong> reste`.
2. Si la portion `reste` contient ensuite une nouvelle énumération séparée par ` • `, ne pas la re-fragmenter (elle est déjà côté DB sous forme de puces filles — les bullets de niveau 2 du DB INSPQ étant déjà séparés au niveau 1, on les laisse simplement en `<li>` séparés sous le même sous-titre).
3. Détecter en plus comme **sous-titre dur** (`{type:'h'}`) une phrase qui matche `/^Région .* :$/i` ou `/^Disponibilité des produits immunisants/i` ou `/^Vaccination préexposition\s*:$/i` etc. — règle générique : phrase ≤120 caractères finissant par `:` ET dont la portion suivante (puce ou phrase) commence par une majuscule/`Immunisation`/`Envisager`.

Implémentation pratique :
- Remplacer la passe « Bullet segments » lignes 1093-1108 par :
  ```js
  for(let k=1;k<segs.length;k++){
    const seg = segs[k];
    // Détecter "Label : contenu" en début de puce
    const m = seg.match(/^([^:•]{2,90})\s*:\s*(.+)$/);
    if(m){
      blocks.push({type:'li', html:'<strong>'+esc(m[1].trim())+' :</strong> '+esc(m[2].trim())});
    } else if(/\s*:\s*$/.test(seg)){
      blocks.push({type:'h', text:seg.replace(/\s*:\s*$/,' :')});
    } else {
      blocks.push({type:'li', text:seg});
    }
  }
  ```
- Étendre la passe de rendu ligne 1115 pour gérer `b.html` (pré-formé, pas d'`esc()`) : `if(b.html){ openUl(); html+='<li>'+b.html+'</li>'; } else if(b.type==='li'){ … }`.
- Pour les sous-titres « Région à l'intérieur… » et « Région à l'extérieur… », la passe pré-bullet (lignes 1078-1092) les détecte déjà via `endsColon` → OK une fois que `splitSentences` les isole. Renforcer `splitSentences` en autorisant la séparation aussi sur `.\s+(?=Région )` pour que les deux régions deviennent deux phrases distinctes.

Critère d'acceptation (Togo) :
- **Méningocoque** : deux sous-titres « Région à l'intérieur de la ceinture… (tiers nord du pays) : » et « Région à l'extérieur de la ceinture… : », chacun suivi d'une `<ul>` avec ses puces (« Immunisation pour tous durant la saison sèche (novembre à juin). », etc.).
- **Rage** : trois puces avec label gras (« **Vaccination préexposition :** envisager… », « **Prophylaxie postexposition :** selon… », « **Disponibilité des produits immunisants dans le pays :** Vaccin : … - RIg : … »).
- **Paludisme** : phrase d'intro inchangée, puce « **Prophylaxie :** médication pour zone de résistance à la chloroquine. » avec label en gras.

## 4. Ajouter section « Diarrhée du voyageur » (Dukoral)

Nouvelle maladie virtuelle ajoutée à la sortie de `recompute()` après les maladies du DB, basée uniquement sur la liste des pays sélectionnés (le DB INSPQ ne contient pas cette catégorie).

Ajouter en haut du script (avant `recommendForDisease`) :

```js
const TD_HIGH = new Set(['bangladesh','bhoutan','myanmar','brunei','cambodge','chine','inde','indonesie','laos','macao','malaisie','nepal','philippines','sri-lanka','taiwan','thailande','timor-oriental','viet-nam',
  // Moyen-Orient
  'arabie-saoudite','bahrein','egypte','emirats-arabes-unis','iran','iraq','israel','jordanie','koweit','liban','oman','qatar','syrie','yemen',
  // Afrique (toute l'Afrique sauf Afrique du Sud → "modéré")
  'afrique-du-sud-EXCLU', // placeholder
  // + Mexique, Haïti, République dominicaine, Amérique centrale + Amérique du sud
  'mexique','haiti','republique-dominicaine','belize','costa-rica','salvador','guatemala','honduras','nicaragua','panama',
  'argentine','bolivie','bresil','chili','colombie','equateur','guyana','guyane-francaise','paraguay','perou','suriname','uruguay','venezuela'
]);
const TD_LOW = new Set(['canada','etats-unis','australie','nouvelle-zelande','japon','singapour','norvege','suede','finlande','danemark','islande','irlande','royaume-uni','pays-bas','belgique','luxembourg','allemagne','france','suisse','autriche']);
// Modéré = Europe de l'Est + Afrique du Sud + Caraïbes (par défaut, sauf si présent dans HIGH/LOW)
const TD_MOD = new Set(['afrique-du-sud','pologne','tchequie','slovaquie','hongrie','roumanie','bulgarie','moldavie','ukraine','bielorussie','russie','estonie','lettonie','lituanie','serbie','croatie','bosnie-herzegovine','macedoine','montenegro','albanie','grece','slovenie',
  // Caraïbes (la plupart des îles)
  'antigua-et-barbuda','bahamas','barbade','cuba','dominique','grenade','jamaique','saint-kitts-et-nevis','saint-vincent-et-les-grenadines','sainte-lucie','trinite-et-tobago','iles-vierges-americaines','iles-vierges-britanniques','iles-caimans','iles-turques-et-caiques','aruba','antilles-neerlandaises','guadeloupe','martinique','porto-rico','saint-martin']);

// Toutes les nations africaines restantes → HIGH (ajout dynamique : on traite "afrique" via slug list lue de COUNTRIES)
const AFRICA_SLUGS = ['algerie','angola','benin','botswana','burkina-faso','burundi','cameroun','cap-vert','comores','congo-brazzaville','congo-republique-democratique','cote-d-ivoire','djibouti','egypte','erythree','eswatini','swaziland','ethiopie','gabon','gambie','ghana','guinee-conakry','guinee-bissau','guinee-equatoriale','kenya','lesotho','liberia','libye','madagascar','malawi','mali','maroc','ile-maurice','mauritanie','mayotte','mozambique','namibie','niger','nigeria','ouganda','republique-centrafricaine','rwanda','sao-tome-et-principe','senegal','sierra-leone','somalie','soudan','soudan-du-sud','tanzanie','tchad','togo','tunisie','zambie','zimbabwe','ile-de-la-reunion','sainte-helene','sahara-occidental'];
AFRICA_SLUGS.forEach(s=>{ if(s!=='afrique-du-sud') TD_HIGH.add(s); });

function tdRisk(slug){
  if(TD_LOW.has(slug)) return 'faible';
  if(TD_MOD.has(slug)) return 'modéré';
  if(TD_HIGH.has(slug)) return 'élevé';
  return null; // pas listé → ne pas afficher
}
```

Affichage : à la fin de chaque pays dans `recompute()` (juste avant `Autres mesures préventives`, lignes 996-1002) ET dans `renderPrintArea()` (avant ligne 1035), insérer :

```js
const td = tdRisk(slug);
if(td){
  const status = td==='élevé' ? 'À considérer' : (td==='modéré' ? 'À considérer' : 'Non requis');
  const cls2 = td==='faible' ? 'rec-non' : 'rec-considerer';
  const txt = td==='faible'
    ? 'Risque faible (Canada, États-Unis, Australie, Nouvelle-Zélande, Japon, Europe du Nord et de l\'Ouest). Dukoral non requis d\'office; mesures alimentaires habituelles.'
    : td==='modéré'
      ? 'Risque modéré (8 à 15 %). Dukoral à considérer si le patient le désire — surtout en cas d\'antécédent de diarrhée du voyageur ou de séjour prolongé.'
      : 'Risque élevé (15 à 70 %). Dukoral à considérer si le patient le désire. Renforcer mesures hygiéno-diététiques (eau embouteillée, aliments bien cuits).';
  html += `<div class="rec ${cls2}"><div class="rec-icon">${ICONS.drop}</div><div class="rec-body"><h4>Diarrhée du voyageur ${statusBadge(status)}</h4><div>${formatInspqHtml(txt)}</div></div></div>`;
}
```
Idem pour le bloc impression avec la classe `pr r-con` / `r-non`.

## Hors scope

Tout le reste (importation PDF, calculs d'âge/durée, dark mode, catégories Rage A/B/C, logique paludisme, base INSPQ) reste tel quel.

Confirme pour générer `test_v14.html`.
