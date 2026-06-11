
# Plan : Authentification, profils utilisateurs et rôles administratifs

## Vue d'ensemble

Mise en place d'un système de connexion complet sur le site, avec gestion de profil, deux comptes administrateurs prédéfinis, et fondations pour un futur abonnement payant.

## 1. Activation de Lovable Cloud

Lovable Cloud sera activé pour fournir la base de données, l'authentification et l'envoi des courriels de réinitialisation. Aucun compte externe n'est requis.

## 2. Page d'authentification `/auth`

Design soigné et professionnel, cohérent avec le reste du site (palette médicale propre, formulaires épurés, états de chargement, messages d'erreur clairs en français). Elle comprend trois onglets/vues :

- **Connexion** : courriel + mot de passe
- **Création de compte** : courriel, mot de passe, prénom, nom (le profil détaillé se complète ensuite)
- **Mot de passe oublié** : champ courriel → envoie un lien de réinitialisation

Une page `/reset-password` permettra à l'usager de définir un nouveau mot de passe après avoir cliqué sur le lien reçu par courriel.

## 3. Protection de l'application

Tout l'outil de recommandations vaccinales sera placé derrière la connexion. Un usager non connecté sera redirigé vers `/auth`. Après connexion, il est ramené à la page demandée.

## 4. Page de gestion du profil `/profil`

L'usager peut consulter et modifier :
- Nom complet (prénom, nom)
- Profession (menu : MD, Pharm, Inf, IPS, autre)
- Numéro de licence professionnelle
- Téléphone
- Établissement / organisation
- Courriel (lecture seule ; changement via flux dédié)
- Bouton "Changer mon mot de passe"

## 5. Rôles et comptes administrateurs

Deux administrateurs préconfigurés :
- `guillaume.page09@gmail.com` — Guillaume Pagé — mot de passe initial `admin`
- `noemie.duval@hotmail.com` — Noémie Duval — mot de passe initial `admin`

Une bannière sur leur première connexion les invitera fortement à changer ce mot de passe (le mot de passe `admin` étant très faible, ceci est essentiel).

## 6. Console administrateur `/admin`

Visible uniquement pour les administrateurs (lien dans le menu). Permet :
- Lister tous les usagers (nom, courriel, profession, licence, établissement, date d'inscription, dernière connexion)
- Recherche / filtre
- Voir le détail d'un profil usager
- **Réinitialiser le mot de passe** d'un usager : déclenche l'envoi d'un courriel de réinitialisation à cet usager. L'administrateur ne voit jamais le mot de passe (ni l'ancien, ni le nouveau).
- Activer / désactiver un compte
- Promouvoir un autre usager au rôle administrateur (optionnel, mais utile)

## 7. Sécurité

- Mots de passe hachés par le système d'authentification (jamais accessibles, même aux admins)
- Rôles stockés dans une table séparée `user_roles` avec une fonction sécurisée `has_role()` — empêche l'élévation de privilèges
- Politiques RLS strictes : un usager ne voit que son propre profil ; les admins voient tous les profils ; personne (ni admin ni usager) ne peut lire de hash de mot de passe
- Activation de la vérification "mot de passe compromis" (Have I Been Pwned)
- Validation des entrées (Zod) côté client et serveur

## 8. Préparation à l'abonnement payant (planification seulement)

Aucun code de paiement n'est ajouté maintenant, mais le schéma de données prévoit déjà le terrain :
- Champ `subscription_status` sur le profil (`free`, `active`, `past_due`, `canceled`)
- Champ `subscription_plan` (null pour l'instant)
- Champ `subscription_renews_at`

Quand vous serez prêt à activer les paiements, l'approche recommandée sera **Stripe via l'intégration Lovable** (aucune clé API requise) :
- Création de produits/plans (mensuel, annuel)
- Page `/abonnement` avec checkout
- Webhook qui met à jour automatiquement `subscription_status`
- Protection des fonctionnalités premium par une vérification du statut
Ceci sera fait dans une demande ultérieure.

## Détails techniques

- Auth : Lovable Cloud (Supabase sous le capot) avec `email/password`
- Tables : `profiles` (liée à `auth.users` via FK cascade), `user_roles` (enum `app_role` = `admin` | `user`)
- Trigger DB : création automatique d'une ligne `profiles` à l'inscription
- Comptes admin créés via migration de données (utilisateurs + rôles)
- Courriel : utilise le système d'authentification intégré de Lovable Cloud pour les liens de réinitialisation (pas besoin de configurer un domaine email pour cette étape)
- Routes protégées via le layout `_authenticated` géré par l'intégration
- Sous-route `_authenticated/_admin` avec vérification du rôle pour la console admin

## Fichiers principaux à créer

```text
src/routes/auth.tsx                          # Connexion / inscription / mot de passe oublié
src/routes/reset-password.tsx                # Définir nouveau mot de passe
src/routes/_authenticated/profil.tsx         # Gestion du profil
src/routes/_authenticated/_admin/admin.tsx   # Console administrateur (liste usagers)
src/routes/_authenticated/_admin/route.tsx   # Gate de rôle admin
src/lib/profile.functions.ts                 # Server fns lecture/écriture profil
src/lib/admin.functions.ts                   # Server fns admin (liste users, reset pwd)
+ migrations DB pour profiles, user_roles, has_role, RLS, trigger, comptes admin
```
