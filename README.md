# TOKENFALL

Une civilisation miniature persistante qui réagit aux tokens via une pression environnementale **fictive**. Interface française, diorama procédural, 24 habitants nommés. Aucun appel de modèle, image distante, service payant ou identifiant.

## Démarrer

Node 22.12+ ou 24 LTS, npm.

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Ouvrir l’URL Vite, normalement http://127.0.0.1:5173. Garder le même port/origine pour retrouver IndexedDB. `npm run build` produit `dist`, `npm run preview` sert le build ; `npm test` vérifie la simulation et le comptage ; `npm run lint` vérifie le code.

## Observer

- **Jouer la démo**, puis **4×** : 100 lots reproductibles arrivent sur 400 secondes simulées (100 secondes réelles à 4×). Continuer une minute pour observer pénuries et décès ; les interventions et l’état initial changent les histoires.
- Cliquer un habitant ou ouvrir **Habitants & lieux** : besoins, proches, faveurs et souvenirs persistants. Les histoires suivent les ressources et les rencontres, pas une cinématique.
- **Chronique** : récoltes perdues, partage d’eau, disputes, réparations et décès. Le bouton **i** explique la causalité et permet une entraide fictive.
- Glisser ou flèches pour déplacer la caméra ; molette ou boutons pour zoomer ; Espace pour mettre en pause ; Échap pour fermer. Tous les habitants et lieux sont accessibles sans le canvas. Disposition compacte pour une petite fenêtre de navigateur ; aucun mode système toujours au premier plan.
- Sauvegarde locale toutes les cinq secondes et à la mise en arrière-plan. Exporter dans **DÉMO → Données** pour sauvegarder ou avant réinitialisation. Une confirmation protège le reset. Rattrapage hors ligne limité à 300 ticks, sans création d’usage démo.

## Usage réel : import explicite

**DÉMO signifie usage simulé. Aucune lecture automatique de cette conversation Codex.** Le flux officiel `codex exec --json` fournit les compteurs de tours terminés. Pour enregistrer uniquement les métadonnées d’une tâche que vous lancez délibérément :

```sh
codex exec --json "votre propre tâche" | node scripts/usage-only.mjs > usage.json
```

Importer le résultat via **DÉMO → Format → Événements normalisés — JSON**. Ou importer un flux JSONL Codex complet : seuls les compteurs sont conservés. Lancer Codex consomme des tokens ; Tokenfall ne le lance jamais à votre place. La provenance mesurée est déclarée par le producteur, pas authentifiée cryptographiquement ni représentative de tout le compte.

Utiliser une capture complète identique pour les imports répétés. Ne pas concaténer des fragments repris : le flux documenté n’offre pas d’identifiant de tour stable, l’adaptateur utilise thread + ordre. Sans date fournie, la date est inconnue et exclue du total UTC du jour. Voir [les décisions et limites d’intégration](docs/codex-integration.md).

Schéma normalisé :

```json
[
  {
    "id": "identifiant-stable-producteur",
    "session": "ma-session",
    "at": "2026-11-18T10:00:00.000Z",
    "origin": "mon-producteur",
    "provenance": "measured",
    "input": 700,
    "output": 300,
    "cached": 200,
    "reasoning": 100
  }
]
```

Provenance : `demo`, `measured`, `estimated`. Entiers positifs ou nuls. Cache et raisonnement sont inclus dans entrée/sortie, jamais ajoutés une seconde fois. Identité : origine + ID stable. Les événements partiels utilisent des maxima monotones ; doublons et événements en retard n’ajoutent pas le même usage. Imports atomiques, champs de prompt/code supprimés.

## Rejouer et vérifier

`public/demo-replay.json` contient 100 événements explicitement démo pour un budget fictif. Les importer applique l’usage immédiatement ; la démo intégrée les cadence. `npm test` vérifie déterminisme, réserves, seuils, doublons/partiels/retards, parsing Codex, migrations, mémoire sociale, restauration, rattrapage et récupération.

Moteur indépendant de React dans `src/core`, rendu dans `src/world.ts`. Canvas 2D remplace PixiJS pour cette petite scène bornée ; aucune ressource externe. Le décor est procédural ; les personnages utilisent la planche fournie et une planche complémentaire générée. Détails et provenance dans public/assets/README.md.

## Données et limites

Tout reste dans IndexedDB. Effacer les données du site supprime le village ; exporter pour le protéger. La suppression de métadonnées anciennes est explicite (7/30/90 jours) et change les totaux historiques ; réimporter après suppression recompte ces événements. Limites : 20 000 événements, 160 entrées de chronique, 24 souvenirs par personne, 20 résumés de session. Schéma v1 : les versions inconnues sont refusées au lieu de deviner une migration.

La récupération commence après 100 ticks sans usage et augmente avec la coopération. L’entraide ajoute un soulagement fictif ; elle ne compense aucun impact réel. Même un usage très supérieur au budget reste récupérable. Les personnes parties restent dans l’histoire.

Cette tranche jouable comprend partage, faveurs, disputes, réparations, récoltes ratées, décès et squelettes persistants ; elle n’inclut pas audio, économie familiale complète, collisions précises, archives intégrales automatiques ou connexion live au desktop. La pression n’est jamais une estimation scientifique d’eau, d’énergie ou d’émissions.

Pour rejouer un fichier à son rythme d’origine, choisir **Rejouer des événements datés — JSON**. La lecture conserve les intervalles et la provenance, respecte pause/vitesse et reprend après restauration. L’import normalisé ordinaire applique simplement les compteurs immédiatement.

État des dépendances vérifié : `npm audit --omit=dev` ne signale aucune vulnérabilité de production. L’audit complet signale encore un problème de déni de service de `picomatch` dans l’outillage de développement (sans version corrigée proposée dans le registre consulté). Les anciens signalements critiques des outils de test ont été supprimés avec leur mise à jour. Le serveur de développement est lancé sur 127.0.0.1.

## Apocalypse progressive

Les pénuries peuvent provoquer des bagarres visibles. La sécheresse favorise les incendies qui dégradent les bâtiments ; à forte pression, des créatures cornues apparaissent et poursuivent les habitants. Fuites, blessures et perte de confiance accompagnent fumée, braises, cendres, fissures et gravats. Les catastrophes sont sauvegardées, limitées à 12 simultanées, et leurs animations respectent le mouvement réduit.

## Personnages et monde flottant

Quatre apparences stables : le personnage de votre planche et trois créations complémentaires (soigneuse, fermier âgé, artisane). Animations de marche/combat et poses de fatigue, réduction des mouvements conservée. La carte flotte avec roche suspendue, racines, brume et cascade. Les personnages restent inspectables au clavier et par clic. Les nouvelles variantes ont six poses chacune, pas huit directions animées complètes.
