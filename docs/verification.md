# Vérification de livraison — 18 novembre 2026

Agent indépendant : **9/10** pour le périmètre jouable documenté, après trois passes (première : 7,8/10). L’agent disposait du brief utilisateur, pas d’une présentation de l’implémentation. Les problèmes relevés ont été corrigés : temps passé aux destinations, changement du jour UTC, validation des sauvegardes, trajets avec obstacles, replay daté, habitants isolés et arrêt des replays à la nouvelle session.

## Contrôles automatisés

- `npm test` : 21 tests verts.
- `npm run build` : TypeScript et production Vite réussis.
- `npm run lint` : aucun avertissement.
- Tests : équilibre sans usage (5 000 ticks), déterminisme, six paliers de démo, besoins, navigation, migration et mémoire sociale ; partiels/doublons/retards, catégories inclusives, dates/sessions, import Codex ; sauvegarde/restauration, corruption, rattrapage hors ligne, récupération même au-delà du budget, replays datés et nouvelle session.
- `npm audit --omit=dev` : aucune vulnérabilité de production. Audit complet : signalements Picomatch transitifs dans l’outillage, documentés dans README. Pas de rétrogradation automatique vers des outils anciens pour masquer ces signalements.

## Navigateur réel (Playwright)

- Bureau 1280×800 et fenêtre compacte 390×844 inspectés visuellement.
- Réinitialisation via confirmation, lancement de démo à 4× et inspection de Gérard réussis.
- Dégradation, pénurie et départs observés en suivant réellement la démo dans le navigateur.
- Import d’une fixture JSONL mesurée, réimport du même fichier : le premier ajoute 1 événement, le second 0, compteurs inchangés.
- Après autosave puis rechargement complet, mêmes compteurs de provenance et fiche de Gérard accessibles.
- Captures locales dans `output/playwright/` (ignorées par Git) : tokenfall-first.png, tokenfall-compact.png, tokenfall-inspector.png, tokenfall-verified.png.

Les chiffres de la fixture mesurée sont synthétiques et servent uniquement au test d’import ; ils ne constituent pas une mesure de cette conversation. La provenance du producteur n’est pas authentifiée. Les fonctionnalités absentes du brief sont listées explicitement dans codex-integration.md.

## Refonte médiévale détaillée

Direction demandée : ambiance La Quatrième Prophétie, textures plus riches et personnages plus lisibles, sans copier les graphismes historiques. Terrain avec détail procédural fixe, herbes/pavés, façades pierre et bois, bardeaux, feuillage organique, silhouettes adultes articulées et portraits harmonisés. Interface charbon/laiton/parchemin. Cadrage initial conserve une marge autour du terrain ; zoom et inspections restent disponibles. Effets de bagarre et détresse recalés sur les nouvelles silhouettes. Build/lint et 25 tests vérifiés.

## Atlas utilisateur, nouveaux personnages et monde flottant

Planche utilisateur copiée sans modification dans `public/assets/residents-atlas.png`, avec cadres et points d’appui explicites pour poses non uniformes. Deux montages de contrôle ont servi à retirer les fragments voisins des poses échange/fatigue/blessure. `public/assets/residents-variants.png` ajoute trois personnages et six poses chacun ; alpha vérifié en navigateur. Portraits et apparences stables partagent ces ressources. Documentation des prompts et provenance dans `public/assets/README.md`.

27 tests passent, build et lint réussis. Tests spécifiques : limites atlas, ancrages, priorité combat, poses détresse et arrêt des animations en mouvement réduit. Vérification visuelle navigateur du rendu composite : roche suspendue, racines, brume, cascade et quatre identités. Les images de test superposent un monde sain au canvas sans remplacer la sauvegarde ; le HUD présent sur ces captures peut donc montrer le vrai village sous-jacent.

### Décor peint et dégradation des bâtiments — 18 novembre 2026

Maisons, puits, arbres vivants/morts, démons, feu et roche suspendue remplacés par sprites peints cohérents avec les habitants. Les quatre familles bâties possèdent trois variantes dégradées, directement liées à `condition`. Aucun changement de sauvegarde ni de simulation. Repli procédural conservé si les images sont indisponibles. Les nouvelles zones de sélection couvrent les bâtiments jusqu’au toit et suivent la hauteur des ruines.

Contrôles : build TypeScript/Vite, oxlint, 27 tests existants passent. Captures navigateur de scènes de contrôle saine et apocalyptique (`output/playwright/painted-environment.png`, `painted-apocalypse.png`) sans modifier la sauvegarde ; transparence alpha et découpes contrôlées. Ces captures sont des scènes de vérification isolées, pas un enregistrement de partie.

### Cycles de flammes et marche — 18 novembre 2026

12 états de feu à taille fixe remplacent la pulsation par scale. Chaque nouvelle identité possède 8 poses de marche, l’original conserve ses 8 poses. Alignement des pieds et échelle constante par identité ; la planche de marche a été nettoyée via image_gen pour retirer le fond translucide, puis frontière de découpe ajustée afin d’exclure les pieds voisins. Les coordonnées rendues sont interpolées entre les ticks sans toucher à la simulation. Horloge unique tick + accumulateur : pause, accélération et mouvement réduit cohérents.

Vérification indépendante finale : **9/10**, 30 tests + build + lint réussis. Contrôle navigateur de chaque pose, des 12 états de feu, du mode réduit et des ancres. Aucun blocage ; quelques pixels isolés ne se voient qu’à fort agrandissement.

### Monde cosmique, sol et combats — 18 novembre 2026

Socle continu éléphants/tortue, fond étoilé, cadrage d’ensemble tenant compte du HUD. Déformation locale du socle à 24 Hz en cache, terrain épinglé ; pause et mouvement réduit figent l’horloge. Sol texturé continu, berges/chemins courbes et assèchement conservé. Replis de rendu conservés pendant chargement ou échec d’image.

Monstres : 8 poses de marche, 8 d’attaque ; préparation avant impact au tick +4, portée d’impact 1,8, 3 points de dégâts, une seule victime et un seul impact, récupération jusqu’au tick +8 et intervalle minimum de 12 ticks. La victime peut esquiver en sortant de portée. Les 4 identités ont 4 poses de réaction, également déclenchées pendant les bagarres. Champs optionnels de combat validés en restauration, sauvegardes existantes compatibles.

Vérification indépendante finale **9/10**. **32 tests**, build et lint réussis. Scènes de contrôle et découpes inspectées en navigateur ; tests ciblés d’impact unique après préparation, esquive, sauvegarde et rejet des timestamps futurs. Capture isolée saine : `output/playwright/cosmic-painted-final.png` ; écran réel : `output/playwright/cosmic-ui-final.png`. Le zoom permet de passer de la vue du monde entier au suivi des habitants.

### Mort sur place et squelettes persistants — 18 novembre 2026

Les départs sont remplacés par le décès lorsque la santé atteint zéro, y compris au tick d’un coup fatal. Le personnage cesse ses activités, garde ses coordonnées et son histoire, et ne consomme plus. Aucun rétablissement ou entraide ne le ressuscite. Quatre stades visuels : effondrement (<5 ticks), corps (<90 ticks), transformation (<210 ticks), squelette permanent. À 1×, le squelette apparaît après 42 secondes simulées ; pause et sauvegarde conservent la progression. Les restes restent sélectionnables ; inspecteur et liste affichent le décès, et le compteur ne compte que les vivants.

Compatibilité v1 : anciens départs convertis en décès à la position enregistrée. Les souvenirs historiques restent inchangés, y compris leurs anciennes mentions de départ. Dates de décès, santé nulle et absence de trajet validées à la restauration.

Vérification indépendante : **9/10**, **36 tests**, build et lint réussis. Contrôle navigateur de l’atlas et de la sélection/inspection. Tests ciblés : immobilité, arrêt des besoins, pas de résurrection, progression des restes, sauvegarde, migration, dates invalides et coup fatal. Capture des stades : `output/playwright/remains-stages.png`.

### Sprites du socle, exploration et usure visible — 18 novembre 2026

L’ancienne déformation du socle est supprimée. Deux atlas de huit poses animent séparément tortue et éléphants ; séquences irrégulières déterministes par porteur, ancrages et échelles constants, pause et mouvement réduit conservés. Plateau rocheux indépendant. Ponts, puits, réserve et mares peints avec trois variantes d’état/eau.

Trois ponts partagent les coordonnées de navigation et de rendu. Destinations de promenade/travail aux quatre bords, sur les deux rives et en forêt. Points d’eau répartis, pauses pour provisions lors des déplacements lointains ; la vie sans pression reste viable. Le texte de l’action distingue puits et autres points d’eau.

Usure accélérée proportionnellement à la pression au-dessus de 20 %, avec variations par bâtiment : sous forte pression continue, les sprites passent intact → abîmé → très endommagé → ruine en quelques minutes simulées. Réparation lente au calme. Les dégâts suivent les vraies conditions persistées.

Vérification indépendante **9/10**. **40 tests**, build et lint réussis. Contrôles navigateur des poses et proportions ; tests de visites effectives aux quatre bords, trois traversées, tous les stades de dégradation et animations indépendantes. Capture : `output/playwright/sprite-carriers-final.png`.

### Raccord des falaises et nage continue — 18 novembre 2026

Suppression du découpage horizontal du socle qui appliquait deux facteurs verticaux et cassait les strates. Chaque face est désormais dessinée d’un seul tenant avec une transformation affine raccordée à l’arête centrale et au bord du terrain. Contrôle indépendant de cette correction :9/10.

Tortue agrandie, nouvelle planche de16poses dont les huit poses actives sont sélectionnées en boucle constante à6poses/seconde simulée, sans attente entre les séquences. Les éléphants conservent leurs gestes indépendants. Pause et mouvement réduit gardent l’horloge figée. Test dédié couvrant deux cycles complets,41tests réussis ; build/lint réussis. Capture de contrôle isolée : `output/playwright/turtle-continuous.png`.

Revue animation : première passe8,7/10 car les huit dernières poses générées étaient trop proches et créaient un temps quasi immobile. Correction : sélection des huit poses actives0–7, boucle régulière6fps sans attente. **Revue indépendante finale9/10**,41tests/build/lint verts, échelle/ancrage constants et raccord de falaise conservé.

### Répartition des habitants et appuis des éléphants — 18 novembre 2026

Les destinations ordinaires réservent des cellules praticables distinctes autour du lieu demandé, en tenant compte des positions et destinations des autres vivants. Évitement local souple par petits écarts : les croisements restent possibles afin de ne pas bloquer les ponts et passages étroits. Aucun déplacement des morts. Les points d’arrêt, besoins et trajets restent dans les données de simulation, pas seulement dans le rendu.

Les quatre éléphants sont répartis plus largement et agrandis à échelle constante pour rapprocher leurs dos du dessous de la roche. Pieds avant conservés sur la carapace ; pieds arrière réajustés. Les animations et les raccords de falaise sont conservés. Gros plan de contrôle : `output/playwright/elephant-contact-final.png`.

44 tests passent, build/lint passent. Tests ciblés :24 réservations distinctes autour d’un même lieu, croisement de deux piétons sans blocage, contrôle prolongé des groupes à l’arrêt, survie et exploration conservées.

Revue indépendante finale de cette passe : **9/10**. Répartition des habitants validée sur une scène isolée ; les deux éléphants arrière ont été rapprochés et abaissés avec taille compensée après une première réserve sur leurs pieds. Dernier gros plan : dos en contact avec la roche et quatre appuis cohérents sur la carapace, y compris pendant les gestes.44tests réussis, build/lint confirmés après ajustement.

### Netteté de la tortue — 18 novembre 2026

Remplacement des petites cellules de nage par quatre planches détaillées à deux poses chacune (768 pixels de largeur par cellule). Recalage de la couronne et de la largeur de carapace pour conserver les appuis existants ; repli sur l’ancien atlas pendant le chargement. Boucle continue de huit poses conservée. Comparaison avant/après et planche des huit appuis contrôlées dans le navigateur.

Revue indépendante : **9/10**. Netteté, continuité de nage, appuis des éléphants et raccord de falaise validés ; de légères variations de dessin subsistent entre poses. **44 tests, build et lint réussis.** Captures : `output/playwright/turtle-detail-comparison.png`, `output/playwright/turtle-detail-poses.png`.

### Profondeur des quatre porteurs — 18 novembre 2026

Nouvelle correction après retour utilisateur : les deux paires ne partagent plus presque le même plan. Porteurs arrière écartés, avant rapprochés et plus bas sur la carapace. La paire avant est dessinée après le plateau pour que les dos masquent son bord inférieur, au lieu de laisser la pointe rocheuse descendre devant eux. Taille fixe ajustée pour maintenir le contact supérieur et les pieds sur la carapace.

Première revue : 8,5/10, contact central encore peu convaincant. Après correction de profondeur : **9/10** indépendant. Contrôles de huit instants de mouvement, build et lint réussis. Captures : `output/playwright/carrier-position-final.png`, `output/playwright/carrier-position-motion.png`.

### Ruisseau asséché et cascade — 18 novembre 2026

Largeur du ruisseau et navigation désormais liées aux réserves d’eau effectives, avec berges de largeur fixe, sédiment peint et fissures découverts progressivement. À zéro : aucune eau ni cascade, lit traversable. Les points d’eau conservent leurs variantes existantes selon les réserves. La récupération reste possible lorsque la pression retombe.

Cascade allongée (310–460 unités à plein débit), nappes texturées avec le matériau peint existant, écume et projections suivant le temps simulé. Texture et nappes s’effacent vers le bas. Débit, largeur, hauteur et opacité décroissent avec l’eau restante. Réduction des mouvements conservée.

Revue indépendante itérée : 8,5/10 (aspect trop lisse), 8,7/10 (texture coupée), puis **9/10** après texture et fondu. **46 tests, build et lint réussis**, dont traversée du lit sec/remise en eau et épuisement complet sous consommation soutenue sur 4500 pas simulés. Captures isolées : `output/playwright/water-100.png`, `water-35.png`, `water-0.png`.

### Carapace porteuse stable — 18 novembre 2026

Le recalage seul ne compensait pas les différences de dessin de carapace entre poses. La surface porteuse utilise maintenant la première pose fixe, découpée suivant le bord de la carapace ; tête et nageoires continuent les huit poses sous ce bord. Le sprite de repli reste fixe pendant le chargement.

Contrôle navigateur des huit poses : aucune variation de pixels dans la zone supérieure mesurée (canvas900×700, rendu500, lignes0–219), tandis que la zone animée change sur chaque pose. Mesure réalisée avec willReadFrequently pour éviter les écarts d’arrondi lors du basculement GPU/CPU. Gros plan : `output/playwright/turtle-stable-close.png`. Revue indépendante **9/10**, aucun raccord gênant relevé ; **46 tests, build et lint réussis**.

### Porteurs derrière la terre — 18 novembre 2026

Suite à la direction explicite de l’utilisateur, les quatre éléphants sont maintenant dessinés avant la roche. Épaules plus hautes et positions rapprochées : le rebord masque les dos pour que la terre semble reposer dessus. Pieds conservés sur le dôme fixe de la carapace, animations conservées. Contrôle de huit instants : `output/playwright/elephants-under-land-motion.png` ; gros plan : `output/playwright/elephants-under-land.png`. Revue indépendante **9/10** ; build et lint réussis.

### Activités des habitants — 18 novembre 2026

Quatre cycles dessinés (cueillette, travail manuel, boisson, repas), six poses par identité pour les quatre personnages. Les séquences se jouent à destination, avec pause effective après les trajets longs. Déplacements, bagarres, coups et détresse restent prioritaires ; eau et nourriture conditionnent les gestes correspondants. Les actions sans cycle dédié conservent le rendu existant. Échelle et appuis fixes ; horloge simulée et mouvement réduit conservés.

Revue indépendante **9/10**, **50 tests, build et lint réussis**. Contrôles : marges transparentes, découpes, quatre identités, six poses, cueillette accroupie sans agrandissement. Captures : `output/playwright/gather-poses.png`, `output/playwright/resident-activities.png`. Provenance et prompts complets : `docs/resident-action-assets.md`.

### Rivière et cascade retravaillées — 18 novembre 2026

Nouveau module `src/water.ts`, rendu seul : aucune modification de simulation ni de sauvegarde. Le niveau affiché suit la réserve en continu (lissage sur l'horloge simulée, gelé en pause, instantané en mouvement réduit) ; les remontées d'entraide montent aussi progressivement. La rivière a un lit à profondeur variable : en baissant, elle se resserre puis se fragmente en flaques dans les creux avant de disparaître. Les berges découvertes restent humides puis sèchent en une dizaine de secondes simulées. Surface animée vers l'aval (deux couches de texture, lignes de courant accélérant vers le bord, reflets), langue lisse et ourlet clair au bord de la chute.

Cascade composée hors écran avec un masque doux : départ couleur rivière, eau blanche plus bas, filets animés, bords effilochés, pied irrégulier, embruns, voiles de brume et roche mouillée derrière. Sous ~45 % du débit, le rideau se déchire en filets, puis en gouttes qui perlent au bord quand la réserve est presque vide. Puits, réserve et mares passent d'un état à l'autre en fondu au lieu de basculer à 55 % et 18 %. La largeur visible ne dépasse jamais le chenal de navigation.

57 tests (dont 4 nouveaux pour l'eau), build et lint réussis. Rendu ~8 ms par image dans le navigateur.

### Nuit, chaîne de seaux et pluie — 18 novembre 2026

Correction : l'éclairage suivait un cycle de 600 ticks alors que l'horloge affichée et les habitants vivent sur 288 ticks par jour ; il faisait jour à minuit. `src/daylight.ts` donne la lumière à partir de l'heure réelle : aube 5–8 h, crépuscule doré 18–21 h 30, nuit bleutée plus marquée. La nuit, maisons habitées éclairées (lueur vacillante, éteinte si abandonnée ou ruinée), lanterne pour les habitants en chemin, incendies plus visibles. Le bandeau affiche une lune la nuit.

Nouvelle mécanique : jusqu'à trois voisins valides (santé > 40, moral > 20, soif < 85, à moins de 9 cases) forment une chaîne de seaux. Chaque seau raccourcit le feu mais coûte de l'eau à la réserve ; sans eau (≤ 2 %), ils regardent brûler et repartent. Feu maîtrisé : chronique d'espoir, coopération +3, liens renforcés entre sauveteurs. Les pompiers ne fuient plus les flammes ; animation de travail, gerbes d'eau en arc et vapeur. Champ de sauvegarde optionnel `doused` validé (feu uniquement). Pluie : ronds d'impact sur la rivière.

62 tests (5 nouveaux), build et lint réussis. Captures : `output/playwright/night-bucket-line.png`, `night-bucket-line-close.png`, `rain-ripples.png`.

### Saisons et propagation du feu — 18 novembre 2026

Saisons dérivées de l'horloge (`src/core/seasons.ts`, aucun nouveau champ de sauvegarde) : quatre jours chacune, l'année commence au printemps. Printemps plus pluvieux ; été plus d'évaporation, une seule averse par cycle, feux plus probables ; automne meilleures récoltes ; hiver récoltes réduites, neige au lieu de pluie, feux rares. Les bonus de récolte disparaissent avec la pression (une sécheresse ruine aussi la belle saison). Chaque changement de saison est annoncé dans la chronique et affiché dans le bandeau.

Rendu : feuillus dorés puis nus, conifères inchangés ; feuilles qui tombent ; neige au sol, sur les chemins et le champ, qui s'installe et fond progressivement ; glace sur les berges ; flocons. La pluie et la neige comptent toutes deux comme temps humide (eau, feux).

Feu : un incendie laissé brûler par temps sec peut gagner un toit voisin (jamais sous la pluie ou la neige). Un feu sur la halle, la boulangerie ou les champs détruit des vivres. Les habitants ne vont plus boire aux mares de la rivière quand elle est presque à sec.

Équilibrage : supprimer la pluie d'été tuait tout le village dans la démo ; une averse estivale est conservée. La démo de référence atteint toujours toutes les étapes et la pénurie. 69 tests (7 nouveaux), build et lint réussis. Captures : `output/playwright/season-autumn.png`, `season-winter.png`.

### Habitants faméliques et tortue dégradée HD — 18 novembre 2026

Intégration des planches de travail, boisson et repas manquantes ; nouvelles réactions aux coups et poses de combat amaigries. Les découpes respectent les marges réelles. La progression nutritionnelle existante et la compatibilité des sauvegardes sont conservées.

La tortue volcanique utilise quatre nouvelles planches 1536 × 1024 (huit poses), sans filtre de netteté artificielle. Comparaison à taille réelle et cycle inspectés : tête lisible, écailles détaillées, carapace fixe pour les appuis.

Validation : 83 tests dans 20 fichiers, build et lint réussis. Les tests supplémentaires contrôlent la présence et la taille des assets, le choix des animations amaigries pendant repas/combat/coups et le mode de réduction des animations. Preuves : `output/playwright/nutrition-progression.png`, `gaunt-reactions.png`, `ruined-turtle-hd-comparison.png`, `ruined-turtle-hd-poses.png`.

Contrôle indépendant : la planche de combat dédiée présentait un fond semi-transparent, confirmé dans le navigateur. Deux essais de détourage génératif n'ont pas corrigé l'alpha ; cette planche a été retirée. Le combat des habitants amaigris utilise désormais les quatre poses propres de recul et de rétablissement de la planche de réactions. Après ce changement : 83 tests, build et lint réussis à nouveau.

Note finale de l'agent indépendant : **9/10**. Cohérence de l'amaigrissement et de ses actions confirmée, fond de combat éliminé, tortue HD lisible et carapace stable. Limite assumée : combat famélique défensif, sans nouveau cycle de frappes.

### Quatre stades de tortue — 18 novembre 2026

Ajout du stade desséché et du stade final mort-vivant : seize nouvelles poses HD, en huit planches 1536 × 1024. Seuils de dégradation : 0,22 / 0,48 / 0,78. Repli vers un stade antérieur chargé, sans modifier les sauvegardes. Carapace fixe et nage conservées.

84 tests, build et lint réussis. Vérification indépendante : **9/10**, distinction des quatre stades, transparence, huit poses par stade, appuis et raccord de la tête osseuse validés. Comparaison : `output/playwright/turtle-four-stages-review.png`. Prompts et références : `docs/turtle-decay-assets.md`.

### Éléphants assortis aux quatre tortues — 18 novembre 2026

Trois nouvelles planches de huit poses : desséché, volcanique, mort-vivant. Stade commun à la tortue et aux quatre éléphants, repli de chargement commun, animations individuelles et appuis conservés. 84 tests, build et lint réussis. Agent indépendant : **9/10**, styles synchronisés, gestes et marges transparentes propres. Comparaison : `output/playwright/carriers-four-stages-review.png`. Provenance et prompts : `docs/elephant-decay-assets.md`.

### Couche terrestre assortie aux porteurs — 19 novembre 2026

Six nouveaux assets : falaises et matériaux de surface aux stades desséché, volcanique et dévasté. Le stade affiché de la fondation pilote le sol, les chemins et le lit de rivière. Géométrie des raccords et appuis conservée ; chargement avec repli vers les textures disponibles. Prompts et provenance : `docs/earth-decay-assets.md`.

85 tests réussis, build et lint validés. Vérification indépendante : **9/10**. Raccords isométriques continus, marges transparentes, appuis conservés et chemins perceptibles au stade final. Comparaison : `output/playwright/world-four-stages-review.png`.

### Comptage quotidien et filtres — 19 novembre 2026

Points 1 et 2 de la feuille de route : deltas Codex regroupés par jour UTC, migration des cumuls complets sans doublon/pénalité historique, conservation et signalement des historiques incomplets, filtre projet/conversation appliqué aux compteurs/budget/pression. Sélection conservée en sauvegarde, sans supprimer les événements exclus. Mode session fixe compatible avec une conversation externe sélectionnée.

99 tests / 22 fichiers, build et lint réussis. Agent indépendant : **9/10** après corrections des relevés partiels et cumuls hérités. Validation finale de code/tests ; navigateur local indisponible, aucune validation visuelle revendiquée pour cette passe. Pont redémarré sur 5175 : réponse v2 vérifiée sans afficher de contenu de session (350 relevés, 21 sessions migrables, 7 historiques incomplets au contrôle).

Prochain point : clarifier les compteurs. Entrées/sorties de maisons et animations des portes inscrites après les animations d'actions dans `docs/roadmap.md`.

### Lisibilité des compteurs — 19 novembre 2026

Point 3 : compteur du jour UTC hors cache séparé du budget du jeu ; historique brut cache compris clairement nommé ; explication des catégories actives, du budget adaptatif et de sa référence fixe ; couverture partielle des sous-catégories signalée. Budget affiché recalculé même en pause, fenêtre de pression du scénario fixe explicitée.

Build et lint réussis. Revue indépendante finale : **9/10** sur code et libellés ; pas de contrôle visuel navigateur disponible sur cette passe. Aucun changement moteur ; suite de 99 tests validée au point précédent.
