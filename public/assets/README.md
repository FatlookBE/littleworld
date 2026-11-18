# Resident atlas

residents-atlas.png: original image supplied by the user for integration into Tokenfall. Copied without modification from the attachment. No third-party asset source or license has been asserted. Source dimensions 1536×1024 RGBA. Frame rectangles and foot anchors are declared in src/sprites.ts; rendering crops at runtime, preserves transparency and leaves the original artwork intact.

The supplied sheet depicts one main character. Three generated character identities now complement it in residents-variants.png; inhabitants have stable appearance assignments while retaining their individual names, jobs, needs, relationships and histories. The available walk/combat sequences face sideways; leftward movement is mirrored, standing poses provide eight views. These are not invented eight-direction walk sequences. Additional character sheets can be mapped separately later.


## Generated companion atlas

residents-variants.png: generated with the built-in image_gen tool, then edited with that tool to obtain genuine transparent background (browser pixel check confirms alpha 0 at corner and cell gap). 1536×1024, 6 columns × 3 rows. Healer, elder farmer, artisan. Idle, two walk poses, two fight poses, tired stance. Runtime alpha bounds align feet and normalize size; these are deliberately short cycles, not full eight-direction animation sets.

Generation prompt: Create a production game sprite atlas, transparent background, 1536x1024 landscape. Reference the user's original detailed hand-painted outlined fantasy steampunk character sheet for art style only. THREE different residents: row 1 female healer in muted teal coat dark braided hair with satchel, row 2 elderly bearded farmer in ochre clothes with leather vest, row 3 red-haired female artisan in brown leather apron and goggles. Strict uniform grid, 6 columns × 3 rows, isolated full bodies with feet at 90% cell height. Columns idle facing right; walk left foot forward; walk right foot forward; fists raised; punching; tired slumped standing. Identical scale, empty margins, no labels, text, shadows or grid. Warm textured leather and cloth, dark outlines, semi-realistic adult proportions.

Transparency edit prompt: Remove the entire brown background with genuine transparent alpha; preserve all 18 characters, positions, sizes, colors and poses in the 1536×1024 grid. Remove all background around and between bodies. No shadows, objects or text.

## Décor peint et bâtiments dégradés — 18 novembre 2026

Créés avec l’outil intégré `image_gen`, fond alpha transparent, en prenant les personnages comme référence de style.
- `environment-atlas.png` : grille 4 × 3, maisons (chaumière, guilde, marché, dispensaire), chêne, sapin, arbre mort, puits, deux poses de démon, feu et roche suspendue. Prompt : « Production game environment sprite atlas, SAME hand-painted ink-outlined detailed fantasy illustration style as character sprites; elevated three-quarter view, weathered textured materials, warm brown/ochre/sage colors, dark finely painted outlines; isolated assets, transparent alpha, no labels. »
- `buildings-damaged.png` : quatre bâtiments × trois dégradations. Prompt : « Companion degradation sprite atlas, SAME four building designs and camera; row1 moderately damaged missing shingles/cracks/torn canopy; row2 severely damaged partial collapsed roofs/blackened stone/broken windows/rubble; row3 ruined low remains, doorway and roof beams; same footprint width, transparent, no fire or smoke. »

Les sources générées restent conservées sous `.codex/generated_images`. Le découpage alpha est calculé une seule fois au chargement. La deuxième planche utilise les bandes verticales 0–352, 352–730, 730–1024 pour éviter les débris des cases voisines. L’état du bâtiment commande les variantes : >70 intact ; >40 abîmé ; >15 très endommagé ; sinon ruine. Les animations utilisent l’horloge du renderer et s’arrêtent avec le mouvement réduit.

## Cycles animés — 18 novembre 2026

`residents-walk.png` : 8 poses successives pour chacune des 3 nouvelles identités (24 dessins). Génération `image_gen` guidée par `residents-variants.png` : contact, appui, passage, jambe levée, puis pas opposé ; même caméra, costumes et taille. Nettoyage de transparence demandé séparément. Le personnage original conserve ses 8 poses fournies.

`flames-cycle.png` : 12 dessins successifs d’un feu, générés avec `image_gen` d’après la flamme du décor : langues de feu qui se séparent, se recourbent, deviennent des braises, fumée renouvelée ; boucle avec base fixe. La taille de rendu ne change pas pendant le cycle. Les feux ont des phases décalées.

Les animations suivent le temps simulé : pause et vitesse appliquées à la marche comme au feu. Les positions sont interpolées entre les pas de simulation sans changer les données sauvegardées. Le mouvement réduit fige les séquences. Les cellules sont ancrées aux pieds/base et conservent une échelle commune pour éviter les variations de taille entre dessins.

## Monde porté, sol et combats — 18 novembre 2026

Assets créés avec `image_gen`, copiés dans ce dossier :
- `world-carrier.png` : monde porté par quatre éléphants sur une tortue cosmique, inspiré du Disque-monde de Terry Pratchett. Prompt : « one continuous painted world slab, four monumental elephants on an ancient cosmic sea turtle, detailed ink-outlined warm fantasy style, empty diamond land top, continuous stratified stone rim, transparent background ». Référence de style : atlas environnement du projet. Le sol est une couche interactive indépendante. Le socle est animé par déformation locale douce du maillage : trompes, respiration, nageoires ; le bord du terrain reste fixe.
- `terrain-materials.png` : quatre matériaux opaques (mousse/herbe olive dorée, terre sèche, pavés médiévaux, eau turquoise), prompt « seamless overhead painted terrain materials, 2×2 atlas, no objects or perspective, match mossy stone world reference ». Sol continu, rivière et chemins courbes, végétation asséchée selon la simulation.
- `monster-cycle.png` : 8 poses de marche et 8 poses d’attaque du démon original, prompt « sequential walk contact/down/passing/up, opposite step, then brace/wind-up/lunge/impact/recovery; fixed scale and camera; 4×4 transparent atlas ».
- `residents-hit.png` : 4 réactions pour chacune des 4 identités, prompt « flinch, recoil, stumble, recover; exact original costumes and faces; non-graphic; 4×4 transparent atlas ».

## Décès et restes persistants — 18 novembre 2026

`residents-remains.png` créé avec `image_gen` d’après les quatre identités de `residents-hit.png`. Prompt : « four identities × four chronological stages: collapsing, lying still, weathered clothing with skull and bony hands, fully prone skeleton in recognizable clothing scraps; detailed warm painted fantasy; transparent alpha; no blood, no wounds, no floor or labels ». Planche 4 × 4, ancrage au sol et échelle constante par identité. Les restes conservent les couleurs/vêtements reconnaissables de chaque personnage.

## Porteurs en sprites, ponts et points d’eau — 18 novembre 2026

`elephant-cycle.png` et `turtle-cycle.png` : deux planches 4 × 2 créées avec `image_gen` d’après `world-carrier.png`. Prompts : « eight distinct authored frames; fixed body scale and back/shell position; elephant trunk curling/raising, ears flapping, blink; turtle sequential swimming flipper stroke and blink; warm detailed painted fantasy; transparent zero alpha, no slab or other creatures ». Nettoyage alpha séparé de la tortue pour retirer le fond et la grille. Chaque porteur joue des séquences irrégulières indépendantes à échelle fixe ; aucune déformation de maillage ni pulsation par scale.

`world-slab.png` : plateau rocheux séparé, prompt « isolated empty isometric diamond slab, continuous layered mossy stone, no animals or objects, transparent ». `waterworks.png` : grille 4 × 3 (pont, puits, réserve, mare ; états intacts, abîmés/asséchés, ruinés/vides), prompt « same warm painted fantasy style, isometric camera, no background; three consistent degradation stages ». Découpe ajustée aux marges réelles des colonnes.

## Nage continue de la tortue — 18 novembre 2026

`turtle-swim.png` : nouvelle planche 4 × 4 créée avec `image_gen` d’après `turtle-cycle.png`. Prompt : « sixteen consecutive frames of one seamless continuous swim, fixed shell crown/body scale, incremental articulated flipper downstroke and recovery, no idle or blink interruption; same painted cosmic turtle; zero-alpha background ». Les huit poses actives du cycle sont lues à six poses/seconde (les huit poses quasi immobiles de la seconde moitié de planche sont exclues), boucle continue de 1,33 seconde simulée ; échelle fixe agrandie et couronne de carapace ancrée. L’ancienne planche reste conservée comme source, mais n’est plus utilisée pour la nage.

## Tortue haute définition — 18 novembre 2026

`turtle-detail-0.png` à `turtle-detail-3.png` : quatre planches transparentes de 1536 × 1024, deux poses par planche, générées avec `image_gen` en prenant les huit poses actives de `turtle-swim.png` comme référence. Prompt : « high resolution detail restoration; extract two specified poses, preserve flipper silhouette, camera, anatomy and shell outline; individually delineated shell plates, engraved seams, sharp scales, amber iris, moss tufts; no blur, airbrush or depth of field; true alpha ». Chaque cellule dispose désormais de 768 pixels de largeur contre environ 314 auparavant.

Le chargement recale chaque couronne et largeur de carapace sur les mêmes appuis. Les huit poses gardent la boucle continue existante ; les anciennes textures servent de repli tant que les quatre planches ne sont pas prêtes. Comparaison : `output/playwright/turtle-detail-comparison.png` ; huit appuis/poses : `output/playwright/turtle-detail-poses.png`.

## Actions des habitants — 18 novembre 2026

`residents-gather.png`, `residents-work.png`, `residents-drink.png`, `residents-eat.png` : quatre planches transparentes 1536 × 1024, six poses × quatre identités, générées avec l’outil intégré `image_gen` d’après `residents-hit.png`. Prompts complets et règles de lecture : `docs/resident-action-assets.md`. Six poses/séquence, cinq poses/seconde simulée, déclenchement à destination, priorité marche/combat/coups et ressources vérifiées.

Les planches `elephant-decayed.png` et `turtle-decayed.png` ont été générées avec ImageGen à partir des cycles de poses des porteurs. La planche `void-fauna.png` contient une méduse à bois et une baleine cosmique, générées dans le même style peint.
