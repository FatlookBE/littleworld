# Animations d’activités — 18 novembre 2026

Outil intégré `image_gen`, référence de style et d’identité : `public/assets/residents-hit.png`. Sorties copiées dans `public/assets/residents-gather.png`, `residents-work.png`, `residents-drink.png`, `residents-eat.png`. Chaque planche : 1536 × 1024, six colonnes de poses × quatre identités. Fond alpha transparent. Les sources restent dans le dossier generated_images de Codex.

## Prompt commun

Create a GAME SPRITE ANIMATION SHEET for existing Tokenfall. Reference supplies FOUR EXACT character identities and painted fantasy style only, not the action. New action: [ACTION]. EXACT GRID SIX COLUMNS and FOUR ROWS, 1536x1024 canvas. Each cell256x256. Row1 goggle brown-haired male orange scarf; row2 brunette braid healer teal coat; row3 old white-bearded farmer straw hat ochre shirt; row4 redhead ponytail female craftsperson cream shirt leather apron. Every row SAME identity doing SIX sequential looping action poses left to right. Consistent anatomy, costumes, three-quarter game camera, crisp ink contours rich painted textures matching reference. Fixed ground baseline y238 within each cell, character standing reference height210px, preserve scale when crouching rather than enlarging. Generous transparent margins, no overlaps between cells, no text, no grid lines, no backdrop, no floor, no shadow haze. Actual articulated sprite poses, NOT rotated or stretched duplicates. True zero-alpha background.

## Actions substituées

- gather: harvesting herbs: upright ready, bend knees and lean down, reach to tiny herb sprig, grasp/pull herb, lift herb toward small basket, straighten ready. Hands and knees really change pose. Small herb/basket included in each appropriate cell.
- work: manual crafting at a tiny waist-high wooden work surface: ready, raise hands/tool, lean forward pressing/working, lower hands, inspect handiwork, return ready. Small wooden tool and work surface included, no giant hammer. Clear articulated arm movements.
- drink: drinking from a small cup: hold cup waist, lift cup chest, bring cup mouth, tilt cup sipping, lower cup chest, lower cup waist. Distinct arm/head poses.
- eat: eating a small bread roll: bread at waist, raise bread, bite, chew with lowered hand, inspect bread, return waist. Distinct articulated arms/head.

## Lecture

Cycles de six poses à cinq poses/seconde simulée, phases décalées par habitant, taille et point d’appui fixes. Marche, coups, combats et détresse restent prioritaires. Les activités commencent à destination avec une pause de 24 à 35 pas simulés minimum après le trajet. Boisson et repas nécessitent des réserves. Les actions sans cycle dédié conservent le rendu existant.
