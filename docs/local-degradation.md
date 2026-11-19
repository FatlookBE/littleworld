# Dégradation locale du village

Chaque emplacement d’arbre (135 emplacements déterministes, dont ceux masqués par le village) et chaque zone de sol (36 zones) possède désormais une santé et une mémoire de brûlure. Ces valeurs sont sauvegardées dans le champ optionnel `localEnvironment`. Les sauvegardes antérieures sont initialisées au premier tick à partir de la végétation et de la fertilité existantes. Les tableaux, tailles et bornes 0–100 sont vérifiés à la restauration.

L’humidité, la réserve d’eau, la distance au ruisseau et une exposition géographique fixe modulent les pertes. Les feux et maladies des cultures affectent les environs. La récupération sous de bonnes conditions est plus lente que la dégradation ; les brûlures persistent et se résorbent lentement. Les saisons influencent déjà l’humidité et la pluie dans la simulation.

Les arbres affaiblis changent de matière, puis utilisent le dessin de l’arbre mort à faible santé ou forte brûlure. Les zones de terre nue sont peintes avec les matériaux existants, sans bordures carrées ; les traces brûlées assombrissent localement le sol. Les plantations utilisent la santé du sol à leur emplacement. Les parcelles de sol décrivent leur aspect local ; la production alimentaire conserve son modèle global actuel.

Les bâtiments conservent leur condition et leurs quatre dessins de dégâts existants. Leur usure varie maintenant avec l’exposition fixe et la santé du sol proche. À faible pression, l’entretien dépend aussi de la santé des occupants vivants. Les dégâts de feu et interventions de réparation existants restent appliqués.

La simulation locale dépend des ticks, sans mise à jour dans le rendu : pause et restauration conservent l’état. La position des arbres, les chemins et les obstacles restent identiques.
