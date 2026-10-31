# Journal des décisions VLV

Ce fichier garde la trace des décisions validées, pour pouvoir reprendre le projet sans perdre la cohérence.

## Produit et périmètre

- D1 : prestataire de paiement Mobile Money = pawaPay (agrégateur). Validé.
- D2 : la V1 est développée sans connexion à l'API de paiement. L'interface de paiement est préparée, l'adaptateur pawaPay sera ajouté à l'obtention de l'accès. Validé.
- D5 : le web seul en V1, avec une API prête pour la future application mobile. Validé.
- D9 : commission VLV de 10 % sur chaque location. Validé. Mode de calcul (déduite du prix partenaire ou ajoutée au prix client) à confirmer avant le module réservation.
- D10 : villes de lancement = Brazzaville et Pointe-Noire, avec leurs arrondissements. Validé.
- D11 : les comptes partenaires sont créés par VLV (pas d'inscription libre). Aucun document en V1. Validé.
- D12 : support par WhatsApp et téléphone, sans intégration en V1. Validé.
- Catégorie « Kavaki » = tricycle (keke). Ses attributs seront validés au module catalogue.
- Le filtre « 4x4/SUV » est un type de carrosserie sous la catégorie Voitures.
- Seul le badge « Partenaires certifiés » est conservé sur les pages publiques.
- En mode Louer, la recherche comporte une période et ne montre que les véhicules libres. En mode Acheter, il n'y a pas de dates.

## Technique

- D4 : stack TypeScript, Next.js, NestJS, PostgreSQL, monorepo. Validé.
- D6 : couleur d'accent lime, proche de #C6FF00, à préciser avec le design system. Validé.
- D17 : gestionnaire de paquets = npm (workspaces) avec Turborepo 2.x. pnpm a été abandonné après un conflit d'installation. Validé.
- TypeScript est fixé en 6.0 : typescript-eslint ne supporte pas encore TypeScript 7. ESLint est fixé en 9.
- Les montants sont des entiers en XAF. Aucun nombre à virgule pour l'argent.
- Les dates techniques sont stockées en UTC. Le fuseau métier est Africa/Brazzaville.

## Dépôt

- D18 : dépôt GitHub privé `sergendzodzouo-design/vlv`. Validé.

## Retenues par défaut, à reconfirmer avant les modules concernés

- D7 : tant que le paiement est hors ligne, toute réservation passe par la confirmation du partenaire. La confirmation automatique s'active avec pawaPay.
- D13 : les annonces des vendeurs particuliers sont créées et gérées par un opérateur VLV.
- D16 : mot de passe temporaire pour les partenaires, avec une adresse e-mail obligatoire pour chacun.

## En attente

- D3' : Supabase (authentification, base, stockage) ou alternative. À trancher avant le lot 4.
- D14 : hébergement de l'API et budget de production.
- D15 : politique d'annulation, de retard, de dommages et de litige.
- Rôle juridique de VLV et flux d'argent (qui encaisse, qui reverse les partenaires, caution).

## Base de données

- D3' : Supabase (authentification, base PostgreSQL, stockage des photos). Validé. Accès direct par API désactivé, connexion par Session pooler.
- D19 : migrations en fichiers SQL numérotés (dossier `database/migrations`) appliqués par `scripts/migrate.mjs`. Sans retour arrière automatique : on corrige par une nouvelle migration. Une migration appliquée ne se modifie jamais.
- Statuts en `text` avec contrainte `check`, plutôt qu'en types énumérés, pour faire évoluer les listes sans migration lourde.
- Row Level Security activée sur toutes les tables, sans règle d'accès : tout passe par l'API VLV.
- Valeurs par défaut retenues pour le schéma : marques et modèles en tables, plaque d'immatriculation privée et facultative, commission stockée par organisation (10 % par défaut).

## Dette technique suivie

- `npm audit` signale 11 vulnérabilités modérées, toutes issues de `minimatch` via ESLint et typescript-eslint (outils de développement uniquement). Ne pas utiliser `npm audit fix --force`, qui installerait ESLint 4. À réexaminer avant la mise en production.
- Les scripts de base de données ne vérifient pas le certificat SSL (développement uniquement). À durcir avant la production.
- Le contrôle automatique GitHub est en attente dans `docs/ci-workflow.yml`. Il demande une autorisation `workflow` sur le jeton d'accès.
