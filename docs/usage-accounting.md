# Comptage quotidien et sélection de l'activité

Le pont local fournit `/usage?format=2` : événements normalisés, sessions Codex dont l'historique est complet, nombre d'historiques incomplets. `/usage` conserve une réponse sous forme de tableau pour compatibilité. Le lecteur sélectionne les fichiers modifiés récemment (trois jours par défaut) ; il conserve l'historique complet des fichiers Codex retenus pour pouvoir remplacer sans perte leur ancien cumul. Claude reste filtré sur la fenêtre de trois jours.

Les hausses de `total_token_usage` sont regroupées par date UTC du relevé `token_count`. Identifiant stable par source, session et jour. Une remise à zéro commence un nouveau segment ; son premier cumul n'est entièrement attribuable que si le dernier usage déclaré lui correspond, ou si une base zéro explicite a été observée. Sinon seuls les derniers tokens attestés et les deltas ultérieurs sont datés ; la session est marquée incomplète. Un relevé sans compteurs principaux valides ne modifie pas la base de calcul.

La migration remplace un ancien cumul seulement avec un historique complet, validé et au moins égal aux anciens totaux. Elle ne consomme pas une seconde fois le répit du village pour l'historique déjà connu. Un ancien cumul incomplet est conservé, sans lui ajouter les nouvelles lignes quotidiennes partielles. Les compteurs absents ou historiques tronqués ne permettent pas de reconstituer un passé exact ; l'interface le signale.

## Filtres

Dans Synchro & données, Projet puis Conversation déterminent l'activité qui influence les compteurs, le budget adaptatif et la pression. Tous les événements restent enregistrés. Les nouvelles consommations hors sélection ne réduisent pas le répit. Choisir un autre projet réinitialise le choix de conversation. La sélection persiste dans les sauvegardes ; les sauvegardes antérieures restent compatibles.

Le projet provient du répertoire de travail déclaré dans les métadonnées. Une conversation est identifiée par source et identifiant de session ; aucun titre ni contenu de conversation n'est exposé. Les données sans projet restent accessibles sous Projet non renseigné. Une conversation explicitement sélectionnée est aussi prise en compte dans le scénario à budget fixe de session.

Les filtres ne rembobinent pas les événements déjà survenus dans le village. Les jours demeurent en UTC, comme les compteurs existants.
