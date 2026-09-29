# AutoCoach — Supabase + Stripe

Application statique avec comptes Supabase, sauvegardes cloud et abonnement Stripe Checkout.

## Important

Ne mets jamais `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` ou `SUPABASE_SERVICE_ROLE_KEY` dans `index.html`. Elles doivent rester dans les secrets Supabase.

## Installation

1. Crée un projet sur Supabase.
2. Dans SQL Editor, exécute `supabase/schema.sql`.
3. Dans Stripe, crée le produit `AutoCoach Pro` et un prix récurrent mensuel.
4. Déploie les deux fonctions Edge :

```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

5. Configure les secrets :

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_PRICE_ID=price_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

6. Dans Stripe, ajoute le webhook :

`https://TON_PROJET.supabase.co/functions/v1/stripe-webhook`

Événements à sélectionner :
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

7. Dans `index.html`, remplace :
- `__SUPABASE_URL__` par l’URL Supabase
- `__SUPABASE_ANON_KEY__` par la clé publique `anon`

La clé `anon` peut être dans le frontend. Les clés secrètes ne le peuvent pas.

## Test local

Le mode test Stripe utilise des cartes de test, par exemple `4242 4242 4242 4242`, une date future et n’importe quel CVC.

## Déploiement

Tu peux publier `index.html` sur Netlify, Vercel ou GitHub Pages. Les Edge Functions restent hébergées sur Supabase.

## Fonctionnement

- Supabase Auth gère les comptes.
- Supabase PostgreSQL stocke les profils et garages.
- Stripe Checkout gère l’abonnement.
- Le webhook Stripe met à jour `profiles.is_premium`.
- Les politiques RLS empêchent un utilisateur de lire les garages d’un autre.

Le catalogue inclus dans cette première version est un catalogue de démonstration. Vérifie les caractéristiques, millésimes et données constructeur avant une utilisation commerciale.
