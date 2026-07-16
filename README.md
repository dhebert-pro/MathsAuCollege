# Maths au collège

Application web de ressources de mathématiques destinée aux élèves de 6e et de 4e.

## Fonctionnement

- Chaque classe possède un code d’accès aléatoire et ne voit que les cours qui lui sont attribués.
- Chaque cours est présenté écran par écran, avec des révélations progressives possibles au sein d’un même écran.
- Le PDF A4 portrait ignore le découpage de projection et resserre les blocs pour limiter le nombre de pages et la consommation d’encre.
- Le back-office compose les cours avec des blocs séquentiels : texte, définition, propriété, exemple, « À retenir », attention, méthode et rappel.
- Les blocs acceptent une mise en valeur cohérente, les images, les révélations et les changements de diapositive.
- Les cours sont triés automatiquement par numéro de chapitre puis par nom ; des flèches permettent de personnaliser ce classement.
- La publication et la dépublication utilisent des boutons explicites.
- Les liens utiles à la projection restent dans la version privée professeur et sont absents de l’espace élève et du PDF.
- L’accès professeur passe par Google et n’est accordé qu’au compte autorisé par les règles Firestore.
- GitHub Pages héberge gratuitement l’interface et Firebase conserve les cours.
- Le cache du navigateur permet de retrouver les contenus déjà chargés en cas de coupure temporaire.

## Lancer le projet en local

Installer les dépendances puis générer le fichier Firebase utilisé par le navigateur :

```powershell
npm install
npm run build:firebase
python -m http.server 8000
```

Ouvrir ensuite <http://localhost:8000>.

## Fichiers principaux

- `index.html`, `styles.css` et `app.js` : espace élève.
- `professeur.html`, `professeur.css` et `professeur.js` : back-office.
- `presentation.html`, `presentation.css` et `presentation.js` : présentation du cours.
- `course-content.js` : format commun des cours et assainissement du texte enrichi.
- `course-store.js` et `firebase-source.js` : accès aux cours, aux images et à Firebase.
- `pdf-export.js` : génération des PDF.
- `firestore.rules` : autorisations appliquées côté serveur.
- `SECURITY.md` : principes de sécurité du projet.

## Déploiement

L’envoi sur la branche `main` déclenche le déploiement GitHub Pages. Avant un envoi, exécuter :

```powershell
npm run build:firebase
npm run check
```

Application publique : <https://dhebert-pro.github.io/MathsAuCollege/>

## Données personnelles

Aucun compte élève et aucune donnée personnelle d’élève ne sont prévus. Les images sont compressées puis stockées dans des documents Firestore dédiés afin de rester compatible avec le forfait Spark, sans Firebase Storage. Toute évolution vers un suivi individuel devra être validée au regard du RGPD et des règles de l’établissement.
