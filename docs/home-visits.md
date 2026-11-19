# Visites des maisons et portes

Chaque habitant vivant peut rejoindre sa maison pour se reposer, notamment la nuit ou lorsqu'il manque d'énergie ; des retours occasionnels sont aussi répartis dans la journée. Il approche le seuil praticable, ouvre la porte, entre, referme, reste un moment à l'intérieur, puis effectue le passage inverse. Un délai avant la visite suivante évite les allers-retours incessants.

Une maison ne peut avoir qu'un passage actif à la fois. Plusieurs occupants peuvent se reposer à l'intérieur ; un occupant attend la fin du passage précédent avant de sortir. Les portes reprennent le battant peint dans le dessin intact ou endommagé et pivotent sur leur charnière. Les personnages sont progressivement occultés par le seuil au passage. Les maisons en ruine ne sont plus visitées.

Les occupants intérieurs sont cachés et exclus des cibles des créatures, interactions sociales extérieures et calculs d'encombrement. Ils continuent à avoir faim et soif. Ils ressortent en cas de besoins urgents, incendie proche ou ruine. Un décès annule la visite et laisse les restes visibles devant la maison. Les maisons et occupants restent inspectables par les panneaux.

L'état de visite et les horaires sont sauvegardés, avec compatibilité des anciennes sauvegardes. Une sauvegarde présentant deux passages actifs par porte est rejetée. Les phases dépendent des ticks ; la réduction des animations conserve des poses de porte simples.

Vérifications : cycle complet, passage partagé, évacuation, protection des occupants, décès, restauration, refus des passages concurrents et simulation normale de 2400 ticks où les 24 habitants entrent puis ressortent.
