# Amaigrissement des habitants

Les assets sont créés avec l’outil intégré `image_gen` et copiés dans `public/assets/residents-gaunt-walk.png`, `residents-gaunt-gather.png`, `residents-gaunt-work.png`, `residents-gaunt-drink.png`, `residents-gaunt-eat.png`. Les sources restent dans generated_images de Codex.

## Prompt de marche

Tokenfall game sprites, exact same four identities/costumes and detailed painted fantasy style. Depict prolonged starvation: clearly thin bony arms and legs, hollow cheeks, tired sunken eyes, narrow torso inside oversized loose clothing, slightly stooped posture. Fully clothed non-graphic living people, not skeletons, no wounds. Keep identifiable faces hats hair and accessories. True transparent alpha background, no haze, no ground, no text or grid. Fixed scale, no stretching. Create 1536x1024 sheet EIGHT columns FOUR rows. Row1 goggle male orange scarf; row2 brunette healer teal coat; row3 old white-beard strawhat farmer; row4 redhead craftswoman. Eight consecutive slow walking poses contact, down, passing, up, opposite contact, down, passing, up. Pose0 also natural standing support, no running. Each cell192x256 groundline238, standing height210, all poses same feet-ground. Actual articulated legs/arms. Reference is identities only, do not repeat hurt poses.

Référence : `residents-hit.png`.

## Prompt d’activité final

Edit this fantasy village game sprite sheet to show the same FOUR ADULT fictional villagers after a period of food scarcity in the game's story. This is a non-graphic depiction of hardship, not intentional self-harm, dieting, or an ideal body. Keep everybody fully clothed and alive. Give them visibly slimmer arms, narrower bodies, tired hollow cheeks, looser clothing and stooped posture; preserve recognisable identities, all costumes and accessories. Preserve EXACT original SIX columns FOUR rows 1536x1024, six original action poses and props per row, foot baseline and original scale. Painted fantasy sprite style. Actions must remain original: [gather/work/drink/eat]. Transparent zero-alpha background with no haze, no extra objects, no text. No wounds or exposed bones.

Références respectives : `residents-gather.png`, `residents-work.png`, `residents-drink.png`, `residents-eat.png`. Une première génération d’activité rejetée par le filtre n’est pas utilisée.

## Simulation

L’indicateur `malnutrition` s’accumule après une faim prolongée (>65) et diminue lentement lorsque l’habitant est nourri (<35). Teinte progressivement fatiguée ; silhouette amaigrie à55. La récupération ne survient pas instantanément au premier repas. Valeur persistée, bornée0–100 ; sauvegardes anciennes compatibles avec absence du champ. Les morts conservent leur dernière valeur et utilisent les restes existants.
