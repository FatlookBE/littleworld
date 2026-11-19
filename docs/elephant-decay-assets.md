# Éléphants assortis aux quatre tortues

Les quatre éléphants suivent désormais exactement le stade de la tortue : sain, desséché, volcanique, mort-vivant. Les seuils communs restent 0,22 / 0,48 / 0,78. Pendant le chargement, le groupe utilise le dernier stade antérieur dont les deux espèces sont prêtes. Le décalage temporel des animations individuelles reste conservé.

Assets créés avec l'outil intégré `image_gen` : `public/assets/elephant-withered-cycle.png`, `elephant-ruined-cycle.png`, `elephant-horror-cycle.png`. Chaque planche comporte huit poses, quatre colonnes × deux rangées, en 1536 × 1024. Le stade sain conserve `elephant-cycle.png`.

Références : `elephant-cycle.png` pour les huit poses et appuis ; `turtle-{stage}-hd-0.png` pour les matières et l'état de dégradation.

Prompt commun : « Edit FIRST reference elephant animation sheet; SECOND is MATERIAL/DEGRADATION style only. EXACT 1536x1024 FOUR columns TWO rows, eight original elephant poses. Preserve each pose's foot positions, body size, shoulder supporting height, camera, trunk angle and ear movement. Fixed feet and shoulder mass, all limbs stay inside cells. Keep 8 distinct original poses: neutral, curled trunk, lifted trunk, curled upward, flared ears, relaxed ears, blink, neutral. Highly detailed painted fantasy same crisp ink scale as reference. ZERO alpha everywhere outside elephant silhouettes, no glow/haze/ground shadow/background/checkerboard. Do not include turtles, terrain or text. »

Desséché : « Drought weakened: dead ochre moss, pale gray dusty skin, deep dry cracks, sunken tired eyes, chipped ivory tusks. Living but exhausted, no lava. »

Volcanique : « Charcoal basalt-like cracked hide with molten orange seams on shoulders and flanks, scorched moss absent, dark gray wrinkled trunk and ears still readable, dim yellow eyes, chipped tusks. Match lava turtle. »

Mort-vivant : « Skull-like ivory face with hollow dark eye socket and tiny yellow pupil, jagged broken tusks, exposed dry ribs and leg bones among black necrotic hide, tattered ears, withered but fully intact articulated trunk. Black basalt armor remnants with glowing molten red cracks over back. No wet gore. Distinctly terrifying, match skeletal turtle. »

Contrainte visuelle : reconnaître les mêmes quatre états par la matière et l'anatomie, tout en conservant les repères spatiaux du monde. Dans `WorldFoundation.draw`, toutes les espèces utilisent le même stade, les mêmes coordonnées d'appui et la même échelle qu'avant ; aucune transformation par étirement ajoutée.
