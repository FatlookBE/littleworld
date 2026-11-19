# Transitions progressives du monde

Les trois seuils de dégradation (0,22 / 0,48 / 0,78) possèdent désormais une bande de transition de dix points, centrée sur le seuil. Une interpolation douce fait progresser des zones irrégulières du dessin précédent vers le suivant. Le même masque, ancré dans les coordonnées du monde, est utilisé pour les éléphants, la tortue, les falaises et le sol.

Les couches sont découpées dans des régions complémentaires opaques. Les silhouettes ne sont pas fondues l'une sur l'autre. Les appuis et les échelles restent ceux des dessins existants. Hors transition, une seule couche est peinte. Pendant une transition, deux couches découpées sont peintes ; ce coût supplémentaire est limité aux bandes de transition.

La progression dépend uniquement de l'état de la simulation, en montée comme en récupération. Le rendu ne lisse plus la dégradation selon le nombre d'images affichées : pause, fréquences d'écran différentes et rechargement d'un monde existant gardent le même aspect. Aucun nouveau champ de sauvegarde.

Le mode de réduction des animations utilise directement les quatre états aux seuils existants, sans transition par zones. Si un dessin de la tortue, des éléphants, du sol ou de la falaise n'est pas chargé, le monde reste sur un stade commun disponible.

Vérifications : continuité aux seuils, repli sur les assets chargés, symétrie en récupération, mode réduit, masques complémentaires, régression du rendu figé sur 120 appels et rechargement du renderer.
