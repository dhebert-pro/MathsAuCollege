# Consigne pour ChatGPT - banque d'exercices aléatoires

## Ce que je vais te fournir

Je vais joindre à cette conversation un fichier `.mathscours` exporté depuis mon application. Il contient le cours exact, son niveau, son numéro de chapitre et son découpage en pages.

Quand je te demanderai par exemple « Génère les exercices du chapitre 2 », utilise le fichier `.mathscours` correspondant et respecte strictement les consignes ci-dessous.

## Ta mission

Crée une banque riche et variée d'exercices d'évaluation portant uniquement sur le cours fourni :

- couvre toutes les pages du cours ;
- rattache chaque exercice à la ou aux pages réellement nécessaires pour le résoudre ;
- propose plusieurs types d'exercices par notion : application directe, question de vocabulaire, calcul, construction, raisonnement, problème court et prise d'initiative quand le cours s'y prête ;
- adapte précisément la difficulté au niveau de la classe ;
- n'introduis aucune notion qui n'a pas encore été présentée dans les pages indiquées ;
- estime honnêtement la durée de chaque exercice pour un élève moyen, lecture et rédaction comprises ;
- attribue une importance réellement nivelée de 0 à 10 : `10` est réservé à un exercice type absolument incontournable ; `8` ou `9` correspond à une notion fondamentale ; `5` à `7` à un entraînement utile ; `1` à `4` à un point secondaire ; `0` à un approfondissement destiné aux élèves qui souhaitent aller plus loin. N’utilise pas presque toujours les notes les plus hautes ;
- attribue à chaque exercice un identifiant stable : l’application remplace automatiquement un exercice existant lorsqu’un nouvel import contient exactement le même `id` ;
- renseigne les compétences réellement mobilisées, parmi les six compétences mathématiques, dans cet ordre : `Chercher`, `Représenter`, `Modéliser`, `Raisonner`, `Calculer`, `Communiquer` ;
- lorsqu’un dessin est plus clair qu’une description pour un collégien, fournis une figure vectorielle plutôt qu’un long texte ;
- lorsqu’un exercice d’automatisation s’y prête, utilise une série de plusieurs questions similaires (par exemple six divisions différentes) plutôt que de créer six exercices séparés ;
- dans une série, toutes les questions générées doivent avoir des valeurs différentes. Fournis un réservoir de possibilités très supérieur au nombre de questions demandé ;
- les paramètres aléatoires doivent offrir énormément de combinaisons valides. Privilégie de larges intervalles ou au moins plusieurs dizaines de jeux cohérents ; ne te contente jamais de quatre ou cinq possibilités sauf impossibilité mathématique justifiée ;
- marque avec `"separateSheet": true` les exercices à effectuer sur une copie séparée et bien présentée, notamment les raisonnements longs, les problèmes demandant beaucoup de rédaction et les tracés ou constructions nécessitant une grande surface ;
- prévois assez de modèles pour que des interrogations de 10 à 45 minutes soient variées ;
- ne fournis ni solution, ni réponse, ni barème dans le fichier : ce fichier sera partiellement accessible aux élèves.

## Exercices paramétrables

Le texte d'un exercice peut contenir des variables sous la forme `{{nom}}`. Chaque variable doit être définie dans `variables`.

Trois types sont autorisés :

1. `choice` : tirage parmi une liste de nombres ou de textes.
2. `range` : tirage dans un intervalle avec un pas et, éventuellement, des valeurs exclues.
3. `tuple` : tirage d'un jeu de valeurs liées. Utilise ce type lorsque plusieurs nombres doivent rester cohérents entre eux, par exemple les trois longueurs d'un triangle ou les données et le résultat d'un calcul.

Les valeurs doivent produire un énoncé mathématiquement correct dans tous les cas. Évite les tirages pouvant provoquer une division par zéro, une construction impossible ou une ambiguïté.

## Fractions mathématiques

Une fraction doit toujours être affichée avec une barre horizontale. N’écris pas `3/5` lorsqu’il s’agit d’une fraction mathématique.

Utilise exactement la notation `[[frac:numérateur|dénominateur]]` dans `content` ou dans un modèle de question répétée :

- `[[frac:3|5]]` affiche trois cinquièmes sous forme de fraction ;
- `[[frac:{{a}}|{{b}}]]` affiche une fraction dont le numérateur et le dénominateur sont tirés aléatoirement.

## Séries de questions similaires

Le champ facultatif `repeat` demande à l’application de tirer indépendamment plusieurs questions à partir du même modèle :

```json
"repeat": {
  "count": 6,
  "template": "{{dividend}} ÷ {{divisor}} = …",
  "variables": {
    "data": {
      "type": "tuple",
      "values": [
        { "dividend": 42, "divisor": 6 },
        { "dividend": 56, "divisor": 7 },
        { "dividend": 72, "divisor": 8 }
      ]
    }
  }
}
```

`count` est compris entre 2 et 12. Chaque ligne effectue un nouveau tirage. Les variables de `repeat.variables` sont propres à la série.
Toutes les lignes d’une même série doivent être différentes. Le nombre de combinaisons possibles doit être largement supérieur à `count` : vise au minimum cinq fois plus de possibilités, et de préférence plusieurs dizaines ou centaines.

## Figures vectorielles

Le champ facultatif `figures` contient au maximum deux dessins. Une figure possède `width`, `height` et des `elements`. Le champ `description` est facultatif : utilise-le uniquement lorsqu’une courte légende apporte réellement une information utile, sinon omets-le.

Les éléments autorisés sont :

- `point` avec `x`, `y` et éventuellement `label` ;
- `segment` avec `x1`, `y1`, `x2`, `y2` et éventuellement `label` ;
- `circle` avec `cx`, `cy`, `r` et éventuellement `label` ;
- `polygon` avec `points`, tableau de couples `[x, y]`, et éventuellement `label` ;
- `text` avec `x`, `y` et `text`.

Chaque élément peut recevoir `"dashed": true`. Les libellés peuvent utiliser les variables principales de l’exercice. Les coordonnées doivent rester comprises entre 0 et 1000 et dans les dimensions annoncées. Ne fournis jamais d’image en base64 ni de SVG ou HTML brut.

## Format du fichier à rendre

Rends un unique fichier texte JSON avec l'extension `.mathseval`. Ne place aucun commentaire ni balise Markdown dans le fichier.

Structure obligatoire :

```json
{
  "format": "maths-au-college/assessment-bank",
  "version": 1,
  "course": {
    "id": "recopier exactement course.id du fichier .mathscours",
    "level": "6",
    "chapterNumber": "2",
    "title": "recopier exactement le titre du cours",
    "slideCount": 5
  },
  "exercises": [
    {
      "id": "ch2-addition-01",
      "title": "Calculer une somme",
      "pages": [1],
      "durationMinutes": 3,
      "importance": 9,
      "competencies": ["Calculer", "Communiquer"],
      "content": "Calculer [[frac:{{a}}|{{b}}]] + 2 en détaillant les étapes.",
      "variables": {
        "a": { "type": "range", "min": 12, "max": 80, "step": 1, "exclude": [] },
        "b": { "type": "choice", "values": [7, 9, 15, 25] }
      },
      "answerLines": 4
    },
    {
      "id": "ch2-triangle-01",
      "title": "Étudier un triangle",
      "pages": [2, 3],
      "durationMinutes": 6,
      "importance": 7,
      "competencies": ["Représenter", "Raisonner", "Communiquer"],
      "separateSheet": true,
      "content": "On considère un triangle dont les côtés mesurent {{a}} cm, {{b}} cm et {{c}} cm. Répondre à la question demandée en justifiant.",
      "variables": {
        "dimensions": {
          "type": "tuple",
          "values": [
            { "a": 3, "b": 4, "c": 5 },
            { "a": 5, "b": 5, "c": 8 },
            { "a": 6, "b": 7, "c": 9 }
          ]
        }
      },
      "figures": [
        {
          "width": 500,
          "height": 260,
          "description": "Triangle ABC",
          "elements": [
            { "type": "polygon", "points": [[70, 210], [250, 35], [440, 210]] },
            { "type": "point", "x": 70, "y": 210, "label": "A" },
            { "type": "point", "x": 250, "y": 35, "label": "B" },
            { "type": "point", "x": 440, "y": 210, "label": "C" }
          ]
        }
      ],
      "answerLines": 7
    }
  ]
}
```

## Règles techniques obligatoires

- `course.level` vaut uniquement `6`, `5`, `4` ou `3`.
- `course.slideCount` doit être repris du fichier `.mathscours`.
- `pages` contient des entiers compris entre 1 et `course.slideCount`.
- `durationMinutes` est un entier de 1 à 30.
- `importance` est un entier de 0 à 10, selon l’échelle pédagogique décrite plus haut.
- `competencies` est un tableau contenant uniquement les compétences réellement mobilisées, dans l’ordre `Chercher`, `Représenter`, `Modéliser`, `Raisonner`, `Calculer`, `Communiquer`.
- `separateSheet` est un booléen facultatif. Mets-le à `true` lorsque l’exercice doit être réalisé sur une copie séparée et bien présentée, en particulier pour un tracé, une construction ou une réponse longue. Dans ce cas, mets `answerLines` à `0`.
- `answerLines` est un entier de 0 à 20 et doit représenter honnêtement la place nécessaire à l’élève : `0` si la réponse est directement entourée, cochée, portée sur une figure ou rédigée sur une copie séparée ; `1` pour un nombre, un mot ou une phrase très courte ; `2` à `4` pour quelques calculs ; `5` à `8` pour une justification ou un raisonnement rédigé ; davantage uniquement pour une résolution réellement longue. Pour une série de questions dont chaque réponse est écrite directement après la question, utilise `0`. Ne réserve pas mécaniquement le même nombre de lignes à tous les exercices.
- Chaque `id` est unique, stable, court et composé de lettres non accentuées, chiffres, tirets ou underscores.
- Pour corriger ou faire évoluer un exercice déjà présent, conserve exactement son `id`. Pour ajouter un exercice réellement différent, crée un nouvel `id`.
- Chaque variable utilisée dans `{{...}}` est définie dans `variables`.
- Pour un `range`, `min`, `max` et `step` sont des nombres ; `exclude` est facultatif.
- Pour un `choice`, `values` contient de 1 à 100 valeurs.
- Pour un `tuple`, `values` contient de 1 à 100 objets ayant tous les mêmes clés.
- Le texte peut contenir des retours à la ligne, mais pas de HTML.
- Toutes les fractions destinées à être lues comme des fractions utilisent `[[frac:numérateur|dénominateur]]` et jamais une écriture avec `/`.
- Utilise les symboles mathématiques Unicode usuels quand ils sont adaptés : `∈`, `∉`, `≤`, `≥`, `≠`, `×`, `÷`, `∥`, `⊥`.
- Vérifie mentalement chaque combinaison de valeurs avant de rendre le fichier.

Avant de produire le fichier, analyse le découpage du cours page par page. Si le fichier `.mathscours` manque ou ne correspond pas au chapitre demandé, demande-moi de le joindre au lieu d'inventer son contenu.
