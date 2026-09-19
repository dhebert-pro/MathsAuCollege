# Publication automatique

Le site des élèves est publié sur `https://cours-maths-college.web.app` par l'action GitHub « Publier sur Firebase ». Après la configuration initiale ci-dessous, chaque modification envoyée sur la branche `main` est vérifiée puis publiée automatiquement. Une version qui échoue aux vérifications n'est pas mise en ligne.

## Configuration initiale (une seule fois)

1. Dans le projet Google Cloud `maths-au-college-667a8`, créer un compte de service dédié à la publication, par exemple `publication-github`. Dans **IAM**, lui attribuer uniquement les rôles **Firebase Hosting Admin**, **Firebase Rules Admin** et **API Keys Viewer**. Le compte doit être créé dans ce projet, pas dans un autre projet portant un nom similaire.
2. Dans l'onglet **Clés** de ce compte de service, créer une clé JSON. Ne jamais ajouter ce fichier au dépôt, ni l'envoyer dans une conversation.
3. Dans le dépôt GitHub `dhebert-pro/MathsAuCollege`, ouvrir **Settings → Secrets and variables → Actions → New repository secret**. Nommer le secret exactement `FIREBASE_DEPLOY_SERVICE_ACCOUNT` et coller **tout le contenu** du fichier JSON dans la valeur. Supprimer ensuite la copie téléchargée de l'ordinateur si elle n'est plus nécessaire.
4. Envoyer les modifications du projet sur la branche `main`. Ouvrir l'onglet **Actions** du dépôt et vérifier que « Publier sur Firebase » se termine en vert. Le déploiement peut aussi être relancé depuis cet onglet avec **Run workflow**.

Le secret donne le droit de publier : ne pas le partager. Si la clé est perdue ou exposée, la supprimer dans Google Cloud, en créer une autre et remplacer le secret GitHub. Protéger la branche `main` pour éviter qu'une modification non relue soit publiée automatiquement.

## Ce que fait l'action

Elle installe les dépendances depuis `package-lock.json`, lance les contrôles, construit le site dans `dist`, puis publie les règles Firestore et les deux adresses Firebase du site (`main` et `generic`). L'ancienne redirection `maths-6e-4e` ne change pas. La publication GitHub Pages, gérée par une autre action, reste indépendante.

Un enregistrement dans l'éditeur du site ne nécessite pas de publication : seules les modifications du code et des fichiers locaux du projet passent par cette action.
