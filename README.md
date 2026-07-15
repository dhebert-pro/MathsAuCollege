# Maths au collège

Application web de ressources de mathématiques destinée aux élèves de 6e et de 4e.

## Fonctionnement

- L’espace élève est public et affiche uniquement les cours publiés.
- Chaque cours peut être consulté en ligne ou téléchargé en PDF.
- Le back-office professeur permet de créer, modifier, classer, filtrer, publier, dépublier, dupliquer et supprimer les cours.
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
- `course-store.js` et `firebase-source.js` : accès aux cours et à Firebase.
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

Aucun compte élève et aucune donnée personnelle d’élève ne sont prévus. Toute évolution vers un suivi individuel devra être validée au regard du RGPD et des règles de l’établissement.
