# Base football et modes de carrière

La source de vérité d’exécution est `data/football.db`. Le dépôt conserve sa
version compressée `data/football.db.gz` afin de rester sous la limite de taille
de GitHub ; elle est restaurée automatiquement avant les tests, le build et le
serveur de développement.

Le schéma normalise joueurs, alias, pays sportifs, clubs, sélections, passages,
compétitions, saisons et statistiques. Les vues `v_player_club_totals` et
`v_player_career_totals` calculent les totaux sans additionner deux fois une
statistique saisonnière et un snapshot.

## Actualiser gratuitement toute la base

```bash
npm run football:refresh
```

Cette commande :

1. reconstruit le noyau local et les cas de référence ;
2. télécharge ou réutilise le cache des sources ouvertes ;
3. importe profils, clubs, sélections et performances ;
4. agrège les statistiques par club, compétition et saison ;
5. contrôle la couverture ;
6. génère l’archive distribuable `data/football.db.gz`.

La base générée contient actuellement plus de 18 000 joueurs passés par la
Premier League, la Liga, la Serie A, la Bundesliga ou la Ligue 1, plus de
500 000 lignes statistiques et plus de 150 000 connexions.

## Sources ouvertes

- [`dcaribou/transfermarkt-datasets`](https://github.com/dcaribou/transfermarkt-datasets),
  CC0, mise à jour hebdomadaire : profils, clubs, compétitions, matchs et
  apparitions depuis 2012 ;
- [`salimt/football-datasets`](https://github.com/salimt/football-datasets) :
  profils et performances historiques agrégées ;
- Wikidata et `data/football/core-players.json` pour les alias et cas contrôlés.

Les fichiers bruts sont placés dans `.cache/football-open`. Ils ne sont ni
versionnés ni embarqués dans l’image Docker. Les deux datasets principaux
partagent l’identifiant Transfermarkt, ce qui évite les rapprochements par nom.

API-Football reste un enrichissement facultatif :

```bash
API_FOOTBALL_KEY=... npm run football:sync-api -- --league=39 --season=2025
npm run football:check
npm run football:pack
```

## Séparer couverture et jouabilité

Tous les profils sont conservés, mais `game_eligible` exige une notoriété
minimale et au moins une apparition senior confirmée. Un simple transfert ou
une présence dans un effectif ne peut donc pas créer une question.

La notoriété est calculée à partir des apparitions dans les cinq grands
championnats, des sélections et de la valeur maximale disponible. La difficulté
combine ensuite notoriété du joueur, notoriété des deux indices et nombre de
réponses possibles.

Au runtime, le serveur ne matérialise pas les 150 000 questions pour chaque
salon. SQLite fournit un échantillon borné respectant les formats demandés ;
l’algorithme applique ensuite difficulté, historique du salon, diversité des
indices et diversité des réponses.

## Mode Carrière mystère

Le mode `mysterycareer` construit ses manches directement depuis les
apparitions senior de la base, sans banque JSON séparée. Il conserve les
joueurs ayant entre 3 et 12 clubs exploitables et ignore les équipes de jeunes
ou réserves.

Au début de la manche, seul le premier club chronologique est envoyé. Le serveur
révèle ensuite un club supplémentaire toutes les trois secondes : les indices
futurs et l’identité du joueur ne sont donc pas présents dans le navigateur.
Chaque joueur dispose de trois essais. Le barème commence à 100 points et ajoute
20 points par club encore masqué, dans la limite de 250 points.

Les difficultés utilisent la notoriété calculée du joueur :

- facile : score de notoriété d’au moins 82 ;
- moyen : score compris entre 65 et 81 ;
- expert : score inférieur à 65 parmi les joueurs éligibles.

Un historique des 200 derniers joueurs mystères du salon évite les répétitions,
y compris après une revanche. La révélation de fin affiche le joueur, son pays
sportif et toute sa chronologie.

## Mode Club manquant

Le mode `missingclub` affiche le joueur et sa carrière chronologique, mais
remplace un club intermédiaire par un emplacement vide. Le premier et le dernier
club restent toujours visibles afin de donner du contexte des deux côtés.

Le club caché doit compter au moins trois apparitions enregistrées. Son nom, ses
alias, ses statistiques et son identifiant sont retirés de la question envoyée
au navigateur ; seules ses années restent visibles. La réponse est validée avec
les alias du club et une tolérance typographique.

Une bonne réponse rapporte de 100 à 150 points selon la vitesse. Les difficultés
croisent notoriété du joueur et du club caché. Une même carrière ne peut pas
revenir deux fois dans un segment, même avec un autre club masqué, et les 200
derniers joueurs sont mémorisés pour les revanches.

## Règles de qualité

`npm run football:check` échoue notamment si :

- la base contient moins de 10 000 joueurs ou 100 000 lignes statistiques ;
- un des cinq grands championnats est absent ;
- moins de 95 % des joueurs ont une date de naissance ;
- une clé étrangère est cassée ;
- une question est sans réponse ou de type pays/pays ;
- une statistique est négative ;
- un joueur jouable n’a aucun alias.

Le contrôle vérifie aussi :

- Manchester United ↔ Real Madrid : Cristiano Ronaldo ;
- Manchester United ↔ Allemagne : Bastian Schweinsteiger ;
- L ↔ M : Lionel Messi.

## Exploitation dans d’autres jeux

`server/football-db.ts` expose le catalogue de connexions, les candidats de
Carrière mystère et Club manquant, un résumé de couverture et la fiche d’un
joueur avec ses totaux par club. Le même modèle peut alimenter :

- un classement par apparitions, buts ou passes ;
- un club manquant dans une carrière ;
- un duel statistique ;
- un jeu de génération ou d’anniversaire ;
- des contraintes croisées par pays, club, initiales ou période.
