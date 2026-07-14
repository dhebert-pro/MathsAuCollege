# Maths au collège

Squelette d’une application web destinée aux élèves de 6e et de 4e. Elle est responsive, installable et utilisable hors connexion après une première visite. Les espaces pédagogiques sont volontairement vides : leurs contenus seront définis progressivement.

## Lancer le projet en local

Un petit serveur local est nécessaire pour tester le mode hors connexion :

```powershell
python -m http.server 8000
```

Ouvrir ensuite <http://localhost:8000>.

## Modifier les contenus

- Les textes des pages se trouvent dans `index.html`.
- Les couleurs et la mise en page se trouvent dans `styles.css`.

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

Le projet n’utilise ni base de données ni service payant. Ce premier squelette ne collecte aucune donnée personnelle et ne demande aucun compte aux élèves. Si un suivi individuel est ajouté plus tard, il faudra prévoir une solution compatible avec le RGPD et les règles de l’établissement.
