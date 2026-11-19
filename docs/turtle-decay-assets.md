# Quatre stades de dégradation de la tortue

La tortue évolue selon l'indice existant de dégradation du monde (pression, pénuries, décès) : saine avant 0,22 ; desséchée de 0,22 à 0,48 ; volcanique de 0,48 à 0,78 ; morte-vivante à partir de 0,78. Les seuils sont testés. Aucun nouveau champ de sauvegarde.

Chaque stade possède huit poses, en quatre planches de 1536 × 1024, avec deux cellules de 768 × 1024. La carapace reste issue de la première pose et fixe sous les éléphants ; seule l'anatomie sous son bord suit la nage. Les nouveaux stades utilisent leurs propres yeux. Une planche encore en chargement entraîne un repli vers le stade antérieur disponible.

## Assets générés

Outil intégré `image_gen`, sans CLI. Destinations : `public/assets/turtle-withered-hd-0.png` à `-3.png` et `public/assets/turtle-horror-hd-0.png` à `-3.png`. Les stades sain et volcanique existants sont conservés.

Référence de pose : `turtle-detail-N.png`. Pour les paires 1 à 3, la paire 0 du nouveau stade sert aussi de référence de matière, visage et identité.

Prompt commun : « Edit game sprite sheet. Preserve EXACT two poses in two 768x1024 cells on 1536x1024, original shell crown and rim position/outline, body size, camera and flipper angles. Sharp full-resolution painted fantasy detailed individual scales. All pixels outside turtle silhouette MUST be zero-alpha transparent; remove source glow/background, NO shadows/haze/gradient/checkerboard. Do not shift anatomy or change shell supporting dome. »

Desséchée : « Intermediate drought decay: dead dry ochre moss, pale dusty gray skin, deep wrinkles, visibly chipped shell plates and branching dry cracks. Tired sunken amber eye, intact but worn beak, no lava yet. »

Morte-vivante : « FINAL APOCALYPTIC UNDEAD turtle: terrifying skull-like gaunt face, hollow black eye sockets with tiny cold yellow pupil, jagged broken beak open in grimace, exposed ivory jaw and patches of dry bone on neck and flippers, black necrotic scales, ragged fin edges. Shell is shattered charcoal basalt with missing plate chunks, deep glowing molten-red fissures and ash. Disturbing decrepit ancient monster, no wet blood. Much more horrifying than ordinary lava turtle. »

Paires suivantes : « FIRST reference is exact POSES/layout target. SECOND is exact character MATERIAL/face/design reference. Repaint FIRST into identical second-reference appearance. Keep FIRST both distinct swimming flipper angles, shell crown/rim silhouette, head location, scale/camera. Do not copy second-reference flipper poses. »

Contrainte UX : rendre la dégradation reconnaissable par la forme et la matière, pas seulement la couleur, tout en conservant les repères spatiaux du monde. Vérification : quatre silhouettes/matières distinctes dans `WorldFoundation.draw`, animation fixe en échelle et carapace ancrée dans `TurtleDetail.draw`.
