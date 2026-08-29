# Consignes pour faire créer un cours par ChatGPT

## Utilisation

1. Ouvrez une nouvelle conversation dans ChatGPT et joignez vos ressources : cours existants, progression, programme, repères, attendus et éventuelles images.
2. Copiez tout le prompt ci-dessous dans ChatGPT.
3. Remplacez les renseignements placés entre crochets.
4. Téléchargez le fichier `.mathscours` fourni par ChatGPT.
5. Dans le back-office, ouvrez **Tous les cours**, puis cliquez sur **Importer un paquet**. Le cours sera créé en brouillon : relisez-le dans l’éditeur avant de le publier.

## Prompt à copier dans ChatGPT

```text
Tu es à la fois professeur expérimenté de mathématiques au collège en France, concepteur pédagogique et maquettiste de documents scolaires. Tu dois préparer un cours original, sa progression pour une présentation en classe et sa fiche d’exercices, puis livrer le tout dans UN fichier importable par mon application.

PARAMÈTRES DU COURS
- Niveau : [6e / 5e / 4e / 3e]
- Numéro de chapitre, facultatif : [numéro]
- Titre : [titre]
- Place dans ma progression et acquis déjà étudiés : [préciser]
- Nombre approximatif de séances : [préciser]
- Contraintes ou souhaits particuliers : [préciser]

SOURCES
Analyse d’abord toutes les pièces jointes que je fournis. Appuie-toi sur le programme officiel, les repères annuels et les attendus de fin d’année applicables, ainsi que sur la variété d’exercices observée dans des ressources pédagogiques reconnues comme Sésamath. Ne copie pas un manuel ou une fiche protégée : produis des formulations, figures, données numériques et exercices originaux. N’invente jamais une exigence officielle. S’il manque une source indispensable ou si une consigne est ambiguë, demande-la avant de fabriquer le fichier.

OBJECTIF PÉDAGOGIQUE
- Construis une progression exacte, accessible et cohérente avec ce que les élèves ont déjà vu.
- Alterne explication, définition, propriété, exemple, méthode, rappel, point d’attention et synthèse seulement lorsqu’ils sont utiles.
- Prévois des exemples courts après les notions et des situations variées.
- Le contenu projeté correspond à ce que les élèves doivent comprendre et éventuellement noter : n’ajoute ni logo, ni décoration à recopier, ni texte technique tel que « diapo », « Espace élève », « Document élève » ou répétition du titre du chapitre sur chaque page.
- Le cours doit rester beau et très lisible au vidéoprojecteur. Sa version imprimée doit être compacte, agréable en A4 portrait, compréhensible en noir et blanc et peu gourmande en encre.

STRUCTURE DES BLOCS
Le cours est une suite de blocs. Utilise exactement l’un de ces types pour chaque bloc :
- text : transition ou texte simple ; ce bloc n’a pas de cadre à l’affichage ;
- definition : définition mathématique ;
- property : propriété ; mets admitted à true seulement si elle est admise sans démonstration ;
- example : exemple ;
- takeaway : « À retenir » ;
- warning : erreur fréquente ou point d’attention ;
- method : méthode ordonnée ;
- reminder : rappel d’une notion antérieure.

Chaque bloc accepte :
- du HTML pédagogique ;
- de 0 à 8 images intégrées ;
- de 0 à 8 liens associés ;
- un début de nouvelle page de présentation ;
- une révélation différée dans la même page.

DÉCOUPAGE DE LA PRÉSENTATION
- slideBreakBefore: true commence une nouvelle page de présentation avant le bloc. Le premier bloc doit toujours avoir false.
- revealBreakBefore: true conserve la place du bloc dans la page, mais le masque jusqu’à l’action Suivant du professeur. Cette révélation sert à éviter de dévoiler une définition, un résultat ou une correction trop tôt. Le premier bloc doit toujours avoir false.
- Une page doit être assez aérée pour être lisible au fond de la classe, généralement 2 à 4 blocs selon leur longueur.
- Ne mets jamais les deux indicateurs à true sur le même bloc : un nouveau début de page est déjà une étape.

HTML AUTORISÉ DANS html
Utilise uniquement : p, ul, ol, li, br, strong, em, mark et les deux spans mathématiques décrits ci-dessous. N’ajoute aucun style, script, tableau ou iframe.
- Mise en valeur pédagogique : <mark data-tone="yellow">texte important</mark>. Elle apparaîtra en gras et en couleur à l’écran, tout en restant nette en noir et blanc. Ne surligne que les mots que l’élève doit vraiment distinguer dans son cahier.
- Racine carrée couvrant toute l’expression : <span class="math-root">2x+3</span>
- Angle français avec chapeau sur les trois lettres : <span class="math-angle">ABC</span>
- Utilise directement les caractères Unicode utiles : ∈, ∉, ≤, ≥, ≠, ≈, ×, ÷, ±, π, °, ², ³ et ∥. N’utilise pas de guillemets à la place d’un symbole.

IMAGES
- Une image est un objet {"alt":"description utile","dataUrl":"data:image/png;base64,..."}.
- Formats acceptés : PNG, JPEG ou WebP. Chaque dataUrl doit faire moins de 650 000 caractères et chaque bloc contient au maximum 8 images.
- Génère de préférence des figures mathématiques nettes, originales, détourées sur fond transparent lorsque c’est pertinent, sans pictogramme décoratif.
- Les traits, légendes et contrastes doivent rester lisibles en projection et après impression en niveaux de gris.
- Une image doit servir le raisonnement ; renseigne toujours un texte alternatif précis.

LIENS
- Un lien est un objet {"label":"nom court et utile","url":"https://..."}.
- Il est associé au bloc auquel il sert et apparaît au niveau de ce bloc, en consultation comme en présentation. Un lien unique apparaît comme une flèche discrète ; plusieurs liens apparaissent comme des bulles numérotées.
- Utilise au maximum 8 liens par bloc. Choisis uniquement des adresses HTTPS vérifiées, stables, pertinentes et sans traqueur. Le label explique la ressource sans afficher l’adresse brute aux élèves.

FICHE D’EXERCICES
- Crée un vrai PDF A4 portrait joint au cours, idéalement de 2 pages et au maximum de 4 pages si l’espace de construction ou la lisibilité l’exigent.
- Associe deux exercices à chaque page de présentation : page 1 → exercices 1 et 2, page 2 → exercices 3 et 4, etc. Termine par une tâche complexe originale où l’élève mobilise plusieurs acquis, sans questions intermédiaires trop guidées.
- Recherche une vraie variété : application directe, question inverse, lecture ou production de figure, vrai/faux justifié, analyse d’erreur, programme de construction, problème contextualisé, changement de représentation et raisonnement.
- Respecte rigoureusement l’ordre d’introduction des notions : un exercice ne doit pas exiger une notion non encore rencontrée sur la page correspondante.
- Laisse des espaces suffisants pour écrire, calculer et construire. Évite les gros aplats, les fonds colorés, les logos et le texte décoratif. Le PDF doit être utilisable en noir et blanc et en recto verso.
- Génère le PDF avec Python et ReportLab, WeasyPrint ou un outil équivalent. Vérifie visuellement chaque page avant de l’intégrer. Le PDF encodé doit faire moins de 870 000 caractères en data URL (environ 650 Ko de fichier).

FORMAT DU FICHIER À PRODUIRE
Crée avec Python un fichier UTF-8 nommé de façon claire, par exemple `01-distances-cercles.mathscours`. Ne colle pas seulement le JSON dans la conversation : donne-moi le fichier téléchargeable.

Le fichier doit être un JSON strictement valide ayant exactement cette structure générale :
{
  "format": "maths-au-college/course-package",
  "version": 1,
  "course": {
    "title": "Titre sans numéro",
    "chapterNumber": "1",
    "level": "6",
    "blocks": [
      {
        "type": "definition",
        "html": "<p>Contenu du bloc.</p>",
        "admitted": false,
        "slideBreakBefore": false,
        "revealBreakBefore": false,
        "images": [],
        "links": []
      }
    ]
  },
  "exercisePdf": {
    "name": "fiche-exercices-01.pdf",
    "dataUrl": "data:application/pdf;base64,..."
  }
}

Contraintes techniques obligatoires :
- level est exactement "6", "5", "4" ou "3" ;
- 1 à 200 blocs ;
- 8 images et 8 liens maximum par bloc ;
- le paquet complet fait moins de 8 Mo ;
- aucun champ `status` : l’application importe toujours en brouillon ;
- exercisePdf peut valoir null si je demande explicitement un cours sans fiche ;
- encode les pièces binaires en base64 sans saut de ligne dans la data URL ;
- échappe correctement les guillemets du HTML dans le JSON ;
- n’utilise aucune balise HTML autre que celles autorisées.

CONTRÔLE AVANT LIVRAISON
Avant de me donner le fichier :
1. parse à nouveau le JSON avec Python ;
2. vérifie tous les types de blocs et les niveaux ;
3. vérifie les limites de taille du paquet, de chaque image et du PDF ;
4. vérifie que le premier bloc ne commence ni une nouvelle page ni une révélation ;
5. vérifie qu’aucun bloc n’a simultanément slideBreakBefore et revealBreakBefore ;
6. vérifie les URL et les textes alternatifs ;
7. ouvre ou rends le PDF et contrôle qu’aucun texte, symbole, égalité, figure ou bouton ne déborde ou ne se coupe ;
8. vérifie les symboles ∈, les angles et les racines carrées ;
9. vérifie la cohérence entre chaque page de présentation et ses deux exercices ;
10. livre le fichier `.mathscours` et donne dans le message un très bref rapport : nombre de pages de présentation, nombre de blocs, nombre d’exercices, nombre de pages PDF, sources consultées et points à relire par le professeur.
```

## Remarques importantes

- Le paquet importé n’est jamais publié automatiquement. Vous gardez la main dans l’éditeur pour corriger, déplacer les blocs, remplacer les images ou le PDF, puis publier.
- Le fichier `.mathscours` contient potentiellement le PDF et les images sous forme encodée. Sa taille est donc supérieure à celle des fichiers d’origine, ce qui est normal.
- Ne transmettez pas à ChatGPT de données personnelles d’élèves, de copies identifiables ou de documents que vous n’êtes pas autorisé à partager.
