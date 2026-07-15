# Maths au collège

Application web destinée aux élèves de 6e et de 4e, avec un espace élève et une maquette de back-office professeur. Elle est responsive, installable et utilisable hors connexion après une première visite.

## État du projet

- L’espace élève affiche uniquement les cours publiés et permet leur export en PDF.
- La maquette professeur permet de créer, modifier, classer, filtrer, publier, dépublier, dupliquer et supprimer des cours.
- Les données actuelles sont fictives et conservées uniquement dans le navigateur (`localStorage`).
- La connexion affichée ne transmet aucun identifiant tant que Supabase n’est pas configuré.
- Le schéma sécurisé prévu se trouve dans `supabase/schema.sql` et les décisions de sécurité sont détaillées dans `SECURITY.md`.

## Lancer le projet en local

Un petit serveur local est nécessaire pour tester le mode hors connexion :

```powershell
python -m http.server 8000
```

Ouvrir ensuite <http://localhost:8000>.

## Modifier les contenus

- Les textes des pages se trouvent dans `index.html`.
- Les couleurs et la mise en page se trouvent dans `styles.css`.
- Le back-office se trouve dans `professeur.html`, `professeur.css` et `professeur.js`.
- Les données fictives se trouvent dans `course-store.js`.

## Publier gratuitement avec GitHub Pages

1. Créer un dépôt vide sur [GitHub](https://github.com/new), sans ajouter de README.
2. Dans ce dossier, relier le dépôt puis envoyer le code :

   ```powershell
   git remote add origin https://github.com/VOTRE-COMPTE/maths-au-college.git
   git push -u origin main
   ```

3. Sur GitHub, ouvrir **Settings > Pages**, puis choisir **GitHub Actions** dans **Source**.
4. Relancer si nécessaire l’action **Déployer sur GitHub Pages** dans l’onglet **Actions**.

L’adresse publique prendra la forme `https://VOTRE-COMPTE.github.io/maths-au-college/`.

## Choix techniques

GitHub Pages continue d’héberger gratuitement l’interface publique. La future base Supabase apportera l’authentification et les règles d’autorisation côté serveur ; son forfait gratuit suffit pour la phase de prototype mais peut mettre un projet en pause après une semaine d’inactivité. Aucun compte élève ni aucune donnée personnelle d’élève ne sont prévus à ce stade. Toute évolution vers un suivi individuel devra être validée au regard du RGPD et des règles de l’établissement.
