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
- attribue une importance de 1 à 10. Un exercice type ou indispensable doit avoir une importance élevée et pourra être sélectionné plus souvent ;
- prévois assez de modèles pour que des interrogations de 10 à 45 minutes soient variées ;
- ne fournis ni solution, ni réponse, ni barème dans le fichier : ce fichier sera partiellement accessible aux élèves.

## Exercices paramétrables

Le texte d'un exercice peut contenir des variables sous la forme `{{nom}}`. Chaque variable doit être définie dans `variables`.

Trois types sont autorisés :

1. `choice` : tirage parmi une liste de nombres ou de textes.
2. `range` : tirage dans un intervalle avec un pas et, éventuellement, des valeurs exclues.
3. `tuple` : tirage d'un jeu de valeurs liées. Utilise ce type lorsque plusieurs nombres doivent rester cohérents entre eux, par exemple les trois longueurs d'un triangle ou les données et le résultat d'un calcul.

Les valeurs doivent produire un énoncé mathématiquement correct dans tous les cas. Évite les tirages pouvant provoquer une division par zéro, une construction impossible ou une ambiguïté.

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
      "content": "Calculer {{a}} + {{b}} en détaillant les étapes.",
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
- `importance` est un entier de 1 à 10.
- `answerLines` est un entier de 0 à 20.
- Chaque `id` est unique, stable, court et composé de lettres non accentuées, chiffres, tirets ou underscores.
- Chaque variable utilisée dans `{{...}}` est définie dans `variables`.
- Pour un `range`, `min`, `max` et `step` sont des nombres ; `exclude` est facultatif.
- Pour un `choice`, `values` contient de 1 à 100 valeurs.
- Pour un `tuple`, `values` contient de 1 à 100 objets ayant tous les mêmes clés.
- Le texte peut contenir des retours à la ligne, mais pas de HTML.
- Utilise les symboles mathématiques Unicode usuels quand ils sont adaptés : `∈`, `∉`, `≤`, `≥`, `≠`, `×`, `÷`, `∥`, `⊥`.
- Vérifie mentalement chaque combinaison de valeurs avant de rendre le fichier.

Avant de produire le fichier, analyse le découpage du cours page par page. Si le fichier `.mathscours` manque ou ne correspond pas au chapitre demandé, demande-moi de le joindre au lieu d'inventer son contenu.
