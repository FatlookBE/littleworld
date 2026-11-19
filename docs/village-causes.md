# Comprendre les conséquences dans le village

Le bouton **Comprendre** de la jauge de pression ouvre le panneau **Comprendre le village**. Il expose jusqu’à quatre mécanismes qui correspondent à l’état présent : incendies actifs, puits abîmé, réserve d’eau sous pression, humidité/fertilité des sols, récoltes freinées, garde-manger faible, hiver ou précipitations. Un état ordinaire dispose d’une explication sobre. Le panneau conserve les explications de la fiction et l’action d’entraide existantes.

Les fiches d’habitants et de bâtiments ajoutent chacune jusqu’à trois explications contextuelles. Les habitants distinguent un coup récent, la privation qui affecte actuellement la santé, la malnutrition durable et sa récupération, la recherche d’eau ou le repos intérieur. La fiche d’un défunt n’invente pas sa cause de décès. Les bâtiments distinguent feu au même emplacement, ruine, usure, entretien et rôle du puits/de la réserve/des champs.

Ces textes décrivent des mécanismes observables dans la simulation, pas une attribution historique certaine. Ils ne prétendent pas que le niveau d’eau commun pilote directement la fertilité globale : celle-ci suit l’humidité, tandis que l’eau et la proximité du ruisseau influencent aussi la santé locale des sols. La fiche des champs précise que leur aspect local et leurs brûlures ne constituent pas un second compteur de production alimentaire. La santé se dégrade sous privation lorsque la faim dépasse 90 ou la soif 85 ; la malnutrition augmente au-delà de 65 de faim et récupère lentement en dessous de 35.

Aucun nouveau journal, compteur, état sauvegardé ni effet moteur. Les fonctions d’explication sont pures, et les listes ne sont pas des zones live : elles n’annoncent pas une nouvelle fois le texte à chaque tick.

## Contraintes d’interface et vérification

- Proximité : le mécanisme accompagne les indicateurs qu’il explique, dans les fiches existantes.
- Charge cognitive : quatre explications au maximum pour le village, trois pour une personne ou un lieu ; pas de nouvelle couche sur la carte.
- Signification et accès : le bouton de pression possède un libellé texte et un nom accessible incluant la pression, un état développé et une hauteur minimale de 44 px. Les titres et listes se lisent sans dépendre de la couleur.
- État calme : une explication ordinaire remplace les diagnostics inutiles ; aucune urgence non observée n’est inventée.

Vérifications ciblées : pression avec sol encore fertile versus sol sec, feu proche versus feu distant/éteint, malnutrition passée versus privation actuelle, entretien autorisé versus forte pression, absence de mutation de la simulation. Build et lint réussis. Contrôle visuel navigateur non réalisé par cet agent.
