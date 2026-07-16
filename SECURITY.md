# Sécurité du back-office

## Architecture actuelle

- GitHub Pages héberge uniquement les fichiers publics de l’interface.
- Firebase Authentication vérifie l’identité avec Google.
- Firestore conserve les cours et applique les autorisations côté serveur.
- Seul le compte Google professionnel autorisé, vérifié et connecté avec le fournisseur Google peut lire ou modifier la collection privée `courses`.
- Les cours publiés sont publics et organisés par niveau ; les brouillons et le back-office restent réservés au compte professeur autorisé.
- Un brouillon ne figure jamais dans un espace de classe.
- Les liens réservés à la projection sont retirés de la copie publique du cours avant sa publication.
- Une image n’est lisible par son identifiant non devinable que lorsqu’elle appartient à un cours publié ; la liste des images reste privée.
- Les images sont compressées et conservées dans Firestore : aucun compte de facturation ni Firebase Storage n’est utilisé.

Ces restrictions sont définies dans `firestore.rules`. Elles ne dépendent donc pas d’un bouton masqué ou d’un contrôle réalisé uniquement dans le navigateur.

Sans compte élève, un code transmis à une classe peut être partagé. Le back-office permet de supprimer puis recréer une classe afin de révoquer son ancien code.

## Principes à conserver

1. Ne jamais placer de compte de service, de clé privée ou de secret dans ce dépôt ou dans le navigateur.
2. Activer la validation en deux étapes sur le compte Google professeur.
3. Conserver la protection contre la suppression de la base Firestore.
4. Vérifier les règles Firestore avant chaque changement de structure des données.
5. Ne stocker aucune donnée personnelle d’élève sans validation du cadre RGPD de l’établissement.

La clé d’API Firebase présente dans `firebase-config.js` identifie l’application web : ce n’est pas un secret. La sécurité des données repose sur Firebase Authentication et sur les règles Firestore.

Documentation officielle :

- <https://firebase.google.com/docs/auth>
- <https://firebase.google.com/docs/firestore/security/get-started>
- <https://firebase.google.com/docs/firestore/manage-data/enable-offline>
