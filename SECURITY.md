# Sécurité du back-office

Le back-office visible actuellement est une **maquette locale**. Il ne contient aucun mot de passe codé en dur, ne transmet pas les identifiants saisis et ne modifie aucune donnée partagée.

## Architecture prévue

- GitHub Pages héberge uniquement les fichiers publics de l’interface.
- Supabase Auth vérifie l’identité du professeur.
- PostgreSQL conserve les cours.
- Les politiques Row Level Security de [`supabase/schema.sql`](supabase/schema.sql) contrôlent chaque lecture et chaque écriture côté serveur.
- Les élèves peuvent lire uniquement les cours dont le statut est `published`.
- Seul un utilisateur authentifié dont le rôle a été attribué manuellement dans la base peut créer, modifier ou supprimer un cours.

## Principes non négociables

1. Ne jamais placer de clé `service_role`, de mot de passe de base de données ou de secret dans ce dépôt ou dans le navigateur.
2. Désactiver l’inscription publique : le compte professeur est créé manuellement.
3. Activer l’authentification multifacteur du compte professeur.
4. Utiliser un mot de passe unique conservé dans un gestionnaire de mots de passe.
5. Garder les politiques RLS actives sur toutes les tables exposées.
6. Tester les refus d’accès avec un utilisateur anonyme et un utilisateur sans rôle professeur avant la mise en production.
7. Ne stocker aucune donnée personnelle d’élève tant que le cadre RGPD de l’établissement n’a pas été validé.

Documentation officielle :

- <https://supabase.com/docs/guides/auth>
- <https://supabase.com/docs/guides/database/postgres/row-level-security>
- <https://supabase.com/docs/guides/database/secure-data>

## Limite actuelle

Les cours de démonstration sont stockés dans `localStorage`. Ils restent dans le navigateur utilisé et ne sont donc pas partagés entre le professeur et les élèves. Ce mode sert uniquement à valider l’ergonomie avant la configuration du projet Supabase.
