# Notif Sim 🛍️🔔

Simulateur de notifications de boutique en ligne (style Shopify) pour iPhone.
Web app installable (PWA) : pas besoin de Mac, d'Xcode ni de l'App Store.

## Installer sur l'iPhone (iOS 16.4 ou plus)

1. Ouvre l'adresse de l'app dans **Safari**
2. Touche **Partager** → **Sur l'écran d'accueil** → **Ajouter**
3. Ouvre **Notif Sim** depuis l'écran d'accueil
4. Touche **Autoriser les notifications**

> Sur iOS, les notifications ne marchent **que** depuis l'icône de l'écran d'accueil, pas dans un onglet Safari.

## Fonctionnalités

- **Vraies notifications iOS** (bannière, centre de notifications, son système) + pastille sur l'icône
- **Types de notifications** : nouvelle commande, nouveau client, avis, versement, stock faible, record du jour, et tes propres types
- **Textes modifiables** avec variables : `{store}` `{order}` `{amount}` `{items}` `{product}` `{customer}` `{city}`…
- **Modèles FR / EN** en un clic
- **Simulation automatique** : Réaliste (arrivées aléatoires), Régulier, Rafales, Rush 🔥, arrêt après N notifications
- **Montants réalistes** : prix des produits ou fourchette min/max, prix psychologiques, plusieurs devises
- **Stats du jour** : CA, nombre de commandes, panier moyen
- **Son « cha-ching »** synthétisé (4 sons au choix)
- **Écran verrouillé simulé** (onglet *Aperçu*) avec fond d'écran au choix ou ta photo, parfait pour une capture vidéo
- **Mode écran verrouillé** : programme des notifications puis verrouille ton iPhone (nécessite le serveur push, voir plus bas)
- Export / import de la configuration, fonctionne hors-ligne

## Deux modes de fonctionnement

| | Sans serveur (GitHub Pages) | Avec serveur push (Vercel) |
|---|---|---|
| Notifications app ouverte | ✅ | ✅ |
| Écran verrouillé simulé | ✅ | ✅ |
| Notifications **iPhone verrouillé / app fermée** | ❌ | ✅ jusqu'à 60 min, 120 notifs |

iOS met en pause les web apps en arrière-plan : pour recevoir des notifications iPhone verrouillé,
il faut un serveur qui les envoie. Le dossier `api/` en contient un, gratuit sur Vercel.

### Activer le mode écran verrouillé (une seule fois, ~2 min)

```bash
npm install
npm run deploy
```

La 1re fois, Vercel ouvre le navigateur pour te connecter (compte gratuit).
Le script génère les clés de sécurité (dans `.env.local`, jamais publié), les enregistre sur Vercel et déploie.
Ensuite, **installe l'app sur l'iPhone depuis l'adresse Vercel** (ex. `https://notif-sim.vercel.app`) :
le mode écran verrouillé s'active tout seul.

(Alternative : garder la version GitHub Pages et coller l'adresse Vercel dans *Réglages → Serveur push*.)

## Développement local

```bash
npm install
npm run dev     # http://localhost:5173
```

## Fichiers

- `index.html`, `styles.css`, `app.js` : l'app
- `sw.js` : service worker (hors-ligne + réception des push)
- `api/push.js` : serveur push sans état (Vercel Function)
- `server.mjs` : serveur local
- `scripts/` : génération des icônes, des clés VAPID, déploiement Vercel
