# TOKENFALL

Une civilisation miniature persistante qui réagit aux tokens via une pression environnementale **fictive**. Interface française, diorama procédural, 24 habitants nommés. Aucun appel de modèle, image distante, service payant ou identifiant.

## Démarrer

Node 22.12+ ou 24 LTS, npm.

```sh
npm install
npm start
```

Ouvrir **http://localhost:5174/**. `npm start` lance l’application (5174) et le pont de compteurs Codex/Claude Code (5175). **Ctrl+C arrête les deux services.** Si un port est occupé, le démarrage s’arrête avec une explication, sans changer de port ni arrêter un processus existant. Arrêtez les anciennes commandes avant de relancer.

Le pont lit les compteurs et métadonnées de projet dans les journaux locaux ; aucune conversation n’est envoyée à un service distant. Pour l’application seule : `npm run dev`. Pour le pont seul : `npm run bridge`. Les ports sont fixes par défaut.

Garder la même adresse (notamment `localhost` ou `127.0.0.1`) pour retrouver la sauvegarde IndexedDB ; ces deux origines ont des sauvegardes distinctes. `npm run build` produit `dist`, `npm run preview` sert le build ; `npm test` vérifie la simulation et le comptage ; `npm run lint` vérifie le code.

## Observer

- **Jouer la démo** ouvre un village neuf à vitesse normale. Il reçoit un lot de tokens fictifs toutes les quatre secondes de simulation, pendant 100 lots. Le village continue ensuite sa vie. **Mon village** ramène à la sauvegarde locale.
- Cliquer un habitant ou ouvrir **Habitants & lieux** : besoins, proches, faveurs et souvenirs persistants. Les histoires suivent les ressources et les rencontres, pas une cinématique.
- **Chronique** : récoltes perdues, partage d’eau, disputes, réparations et décès. Certains récits se dévoilent en plusieurs temps ; leur issue dépend de l’eau, des réserves et de l’entraide du village. Leurs indices apparaissent dans le décor ; la Chronique permet de rejoindre le lieu d’un événement en cours. Le bouton **i** explique la causalité et permet une entraide fictive.
- Glisser ou flèches pour déplacer la caméra ; molette ou boutons pour zoomer ; Espace pour mettre en pause ; Échap pour fermer. Tous les habitants et lieux sont accessibles sans le canvas. Disposition compacte pour une petite fenêtre de navigateur ; aucun mode système toujours au premier plan.
- Sauvegarde locale toutes les cinq secondes et à la mise en arrière-plan. Exporter dans **Synchro & données** pour sauvegarder ou avant réinitialisation. Une confirmation protège le reset. Rattrapage hors ligne limité à 300 ticks, sans création d’usage démo.

## Usage réel : import explicite

**DÉMO signifie usage simulé.** Avec `npm start`, le pont local lit les compteurs des sessions Codex et Claude Code. Pour fonctionner uniquement par import manuel, utilisez `npm run dev` sans lancer le pont. Le flux officiel `codex exec --json` fournit les compteurs de tours terminés. Pour enregistrer uniquement les métadonnées d’une tâche que vous lancez délibérément :

```sh
codex exec --json "votre propre tâche" | node scripts/usage-only.mjs > usage.json
```

Importer le résultat via **Synchro & données → Format → Événements normalisés — JSON**. Ou importer un flux JSONL Codex complet : seuls les compteurs sont conservés. Lancer Codex consomme des tokens ; Tokenfall ne le lance jamais à votre place. La provenance mesurée est déclarée par le producteur, pas authentifiée cryptographiquement ni représentative de tout le compte.

Utiliser une capture complète identique pour les imports répétés. Ne pas concaténer des fragments repris : le flux documenté n’offre pas d’identifiant de tour stable, l’adaptateur utilise thread + ordre. Sans date fournie, la date est inconnue et exclue du total UTC du jour. Voir [les décisions et limites d’intégration](docs/codex-integration.md).

### Synchronisation automatique (Claude Code + Codex)

```sh
npm start
```

L’application et le pont sont démarrés ensemble. **Synchro & données** affiche l’état de connexion, la dernière réussite et un bouton **Actualiser**. Le suivi reprend automatiquement quinze secondes après chaque tentative ; une tentative est limitée à huit secondes.

Le budget adaptatif vaut deux fois la moyenne des sept derniers jours renseignés avant aujourd’hui, cache connu exclu. Le pont lit les fichiers Claude Code et Codex modifiés récemment (trois jours par défaut), conserve l’historique Codex nécessaire à la migration et expose les compteurs ainsi que le projet déclaré. Les conversations ne sont pas envoyées à un service distant. Les historiques incomplets sont signalés. Le pont écoute uniquement sur la boucle locale et accepte les origines locales.

Pour lancer les services séparément : `npm run bridge` et `npm run dev`. Pour modifier la fenêtre de lecture du pont seul : `node scripts/usage-server.mjs 5175 7`. Gardez le port 5175 attendu par l’application.

### Claude Code (et ADE)

Claude Code, et donc les chats ADE qui s’appuient sur lui, écrit chaque session dans `~/.claude/projects/<projet>/<session>.jsonl`. Importer ce fichier via **Synchro & données → Format → Claude Code / ADE — transcript JSONL** : seuls l’identifiant du message, la session, l’horodatage et les compteurs de tokens sont lus ; le contenu des conversations est ignoré et jamais conservé. Ré-importer le même fichier (même après de nouveaux messages) ne compte pas deux fois. Import toujours explicite, jamais automatique.

**Directement depuis ADE** : ADE tient un registre par tour pour Claude et Codex (`ade usage turns`). Exporter les sept derniers jours, puis importer le fichier en **Événements normalisés — JSON** :

```sh
node scripts/ade-usage.mjs 7 > usage.json
```

Seuls identifiant de tour, session, heure, fournisseur et compteurs sont copiés (ni chemins, ni e-mail, ni modèle, ni coûts). Relancer le script puis ré-importer ne compte pas deux fois les mêmes tours. Dépend de la CLI `ade` installée.

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
