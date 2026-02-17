# Requirements: Mode "Parcours" (Career Path)

## Objectif
Nouveau mode de jeu pour Quizz Arena. Le joueur voit le parcours club d'un footballeur (liste chronologique des clubs) et doit deviner de quel joueur il s'agit en tapant son nom.

## Exigences fonctionnelles

### FR-1: Nouveau mode de jeu "parcours"
- Ajouter `"parcours"` au type `GameMode`
- Visible dans la liste des modes en lobby avec icone et description
- Icone suggeree : `"football"` ou emoji `"\u26BD"`
- Couleur : a definir (differente des modes existants)

### FR-2: Affichage de la question
- Afficher la liste des clubs du joueur dans l'ordre chronologique
- Tous les clubs sont affiches d'un coup (pas de revelation progressive)
- Chaque club affiche sous forme de "chip" ou badge avec le nom du club
- Direction visuelle : timeline verticale ou liste horizontale avec fleches
- Optionnel : afficher les annees de passage dans chaque club

### FR-3: Saisie de la reponse
- Champ texte libre pour taper le nom du joueur
- Validation tolerante :
  - Insensible a la casse (`valbuena` = `Valbuena`)
  - Tolerante aux accents (`m'vila` = `M'Vila`)
  - Accepter les variantes courantes (nom de famille seul, prenom + nom, surnom)
  - Exemples : `"Valbuena"`, `"Mathieu Valbuena"` doivent etre acceptes
- Bouton "Valider" + validation au Enter

### FR-4: Scoring
- Scoring similaire au mode "open" existant :
  - Points de base (100 pts par defaut)
  - Bonus de rapidite (jusqu'a +50% pour les plus rapides)
  - Bonus de serie (streak >= 3)
- Reponse correcte = match avec une des variantes acceptees

### FR-5: Affichage du resultat de manche
- Montrer le nom complet du joueur
- Reutiliser le composant `RoundResult` existant avec adaptation texte
  - Ex: "Le joueur etait :" au lieu de "La bonne reponse etait :"

### FR-6: Banque de questions
- Fichier JSON `data/questions/parcours.json`
- ~100 joueurs provenant des 5 grands championnats europeens
- Niveau de difficulte : joueurs "mid-tier" reconnaissables par les fans de foot mais pas des superstars evidentes
  - BON : Valbuena, M'Vila, Gourcuff, Gameiro, Menez, Nasri, Ben Arfa, Remy, Cabaye, Sagna, etc.
  - MAUVAIS (trop facile) : Zidane, Messi, Ronaldo, Mbappe, Benzema
- Structure par question :
  - `id` : identifiant unique
  - `playerName` : nom complet du joueur (pour l'affichage du resultat)
  - `clubs` : liste ordonnee des clubs (chronologique)
  - `acceptedAnswers` : variantes acceptees pour la validation
  - `difficulty` : easy / medium / hard
  - `nationality` : (optionnel, pour info)

### FR-7: Integration serveur
- Le `GameEngine` doit charger les questions depuis `parcours.json`
- La validation de reponse utilise une comparaison tolerante (normalisation accents + casse)
- La question envoyee au client contient les clubs mais PAS les reponses acceptees

## Exigences non-fonctionnelles

### NFR-1: Compatibilite
- Le mode s'integre dans l'architecture existante sans casser les autres modes
- Memes flux Socket.IO, memes events, meme cycle de jeu

### NFR-2: Mobile-first
- L'affichage des clubs doit etre lisible sur mobile
- Le clavier virtuel ne doit pas masquer les clubs (scroll possible)

### NFR-3: Donnees
- Les parcours des joueurs doivent etre factuellement corrects
- Au moins 3 clubs par joueur pour que ce soit interessant
- Les clubs de formation/jeunesse peuvent etre omis si non pertinents

## User Stories

| # | En tant que... | Je veux... | Pour... |
|---|---|---|---|
| US-1 | Joueur | Voir le parcours club d'un footballeur | Essayer de deviner qui c'est |
| US-2 | Joueur | Taper ma reponse en texte libre | Que ce soit un vrai defi de memoire |
| US-3 | Joueur | Que ma reponse soit acceptee meme sans accents | Ne pas etre penalise par le clavier |
| US-4 | Joueur | Voir qui etait le joueur apres la manche | Apprendre et comparer |
| US-5 | Host | Selectionner le mode "Parcours" dans le lobby | Lancer une partie sur ce mode |

## Decisions prises

1. **Annees dans les clubs** : OUI - Afficher les annees (ex: "OL (2004-2014)")
2. **Indices optionnels** : NON - Pas d'indices supplementaires
3. **Timer** : 30 secondes par question

## Prochaines etapes
- `/sc:design` pour l'architecture technique
- `/sc:implement` pour le developpement
