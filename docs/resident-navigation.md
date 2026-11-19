# Déplacements et passages partagés

Les arrêts restent réservés autour des lieux fréquentés. Les habitants intérieurs ne sont pas considérés comme des voisins arrêtés devant leur maison. Les passages de porte sont réservés individuellement.

Les pas de côté vérifient le segment parcouru par échantillons espacés d'au plus 0,04 unité, pour limiter les traversées de coins de bâtiments et de berges humides. Après 24 ticks avec trop peu de progrès, un habitant recherche un détour autour des voisins stationnaires ou bloqués, sans changer sa destination. Les cellules de départ et d'arrivée restent accessibles au calcul de route ; si le détour n'atteint pas la destination, l'ancienne route est conservée.

Les règles souples de croisement et la préférence latérale par identifiant restent utilisées. Une interdiction de proximité stricte empêcherait certains habitants de rejoindre les ressources sur les passages étroits. Une faim urgente peut interrompre un long trajet pour chercher un repas, comme le faisait déjà la soif.

Le compteur d'attente est mis à jour en simulation, borné et compatible avec les sauvegardes existantes. Les tests couvrent croisement, détour, contrôle des coins, arrêts séparés et survie saine pendant les longues simulations.
