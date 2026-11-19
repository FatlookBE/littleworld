# Couche terrestre : quatre stades

Les falaises et la surface suivent les quatre états des porteurs. `WorldFoundation.activeStage` fournit au terrain le stade affiché, après vérification du chargement de la tortue, des éléphants et de la falaise. Le terrain garde un repli antérieur si ses textures ne sont pas encore disponibles. Les transformations géométriques des falaises sont conservées : raccord central, pente du bord et appuis inchangés.

Les matériaux de surface restent répartis en quatre zones : sol, terre nue/lit du ruisseau, pavés, eau. La rivière conserve sa mécanique d'assèchement. Au stade volcanique et final, la couverture neigeuse est atténuée pour laisser apparaître la croûte brûlante ; les plantations dessinées ne restent plus vertes.

## Sources

Six images éditées avec l'outil intégré `image_gen`. Références : `world-slab.png` et `terrain-materials.png`.

Destinations : `public/assets/world-slab-{withered,ruined,horror}.png` (1536 × 1024, alpha transparent) et `public/assets/terrain-{withered,ruined,horror}.png` (1254 × 1254, opaque, grille 2 × 2).

## Prompts

Falaises : « Edit terrain slab. Preserve exact source silhouette, diamond corners, top rim slopes, center front corner x768 y670, bottom point and continuous strata layout, cliff thickness, root positions, isometric camera. Change only material/degradation, NEVER geometry. Detailed painted fantasy crisp textures matching game sprites. Top surface matches cliffs. Empty terrain no buildings/animals. Zero-alpha outside slab, no backdrop/glow/shadow/haze. Continuous seamless left/right faces join at center. »

Matériaux : « Edit terrain material atlas. Opaque square, exact 2x2 grid of square seamless material textures with no borders, no perspective. Upper left ground replacing grass, upper right bare soil/riverbed, lower left walkable cobblestone path, lower right subdued teal-gray water not lava. Land materials match slab, fine small-scale painted textures. Crisp strokes, no blur, no objects/skulls/text/labels, paths distinct from ground. Restrained fissures, avoid huge repeating landmarks. Each quadrant independently tileable. »

Desséché : « Dusty pale gray-ochre rock, dead straw-colored moss, dry brittle roots, chipped strata, branching dry fissures. No green, no lava. »

Volcanique : « Scorched charcoal basalt, branching orange molten fissures, burned black roots, ash, no living green moss. Keep orange restrained to thin cracks. »

Final : « Shattered black basalt with bone-white mineral seams and fossil-like root remnants, deep red ember-filled cavities, crumbling dead crust, broad broken plates. No grass, no living roots. Ominous ashen desolation, restrained ember glow. »

Contrainte visuelle : rendre l'état du monde lisible dans la matière et les fissures, en conservant chemins, rivière et géométrie du village. Les mêmes quatre seuils pilotent porteurs, falaises et surface.
