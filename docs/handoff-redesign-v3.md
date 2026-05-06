# Frontend Redesign V3 — Brief

Document complémentaire pour démarrer une discussion Claude.ai dédiée au
redesign frontend. Pour le contexte technique complet, voir `CLAUDE.md`
(index) et `CONTEXT.md` (deep dive) dans le même repo.

## Setup git

Le redesign est sur une branche dédiée :
- **Branche** : `redesign-frontend-v3`
- **Worktree path** : `C:/Users/Aaron/Projects/coinche-game-redesign/`
- **Branched from** : `main` (commit `06701e3` au moment de la création)

La prod tourne sur main, intouchable. Tout le travail redesign vit dans
le worktree séparé.

Pour faire tourner les 2 versions en parallèle :
- Prod : `cd coinche-game/frontend && npm run dev` (port 5173)
- Redesign : `cd coinche-game-redesign/frontend && npm run dev -- --port 5174`

## Objectif

Refonte visuelle complète du frontend dans un style **club de jeu privé
premium / 1920s casino français**. La mécanique métier reste identique
(voir CONTEXT.md). C'est purement un travail UI/UX.

## Direction visuelle

**Référence d'inspiration** (image partagée séparément) :
- Vert sombre profond table casino + accents or/laiton + crème/parchemin
- Tagline "COINCHE — DEPUIS 1921" donne le côté patrimonial
- Photos/avatars de joueurs dans des cadres ronds
- Cartes design classique français
- Bottom nav pour fonctions secondaires (chat, paramètres, astuces)
- Layout table de jeu réelle ovale, pas tableau de bord

C'est une **inspiration**, pas une copie pixel-perfect. Explorer des
variantes est OK.

## Décisions confirmées

1. **Avatars** : générés via IA (ChatGPT image ou autre tool de génération
   visuelle), pas de photos réelles, pas de bots robots. Cohérence visuelle
   + zéro problème de droits.

2. **Cartes** : classiques françaises **R/D/V** (Roi/Dame/Valet), pas
   K/Q/J anglo-saxonnes. Cohérent avec un produit français.

3. **Mode Delfino** : feature existante (toggle taille cartes S/M/L,
   persisté en localStorage). À conserver — peut-être renommer ou rendre
   plus discret dans le redesign.

4. **Stack** : reste React + Vite + CSS plain (pas de migration Tailwind
   ou shadcn pour l'instant — le style premium artisan ne se prête pas
   bien aux frameworks utilitaires génériques).

## Périmètre

Le redesign touche le **frontend visible** :
- Lobby (création/jonction de room)
- Game table (la partie en cours)
- Round summary (fin de manche)
- Header / navigation
- Hand display, bidding panel, trick display
- Animations (shuffle, deal, trick)

Le redesign **ne touche pas** :
- Mode entraînement V2.2 (CardSelector, ClaudeConversation, etc.) — sauf
  pour cohérence visuelle
- Backend (sauf si un changement UI nécessite une modif d'API)
- Système conversationnel Claude (claudeService.js, glossaire, few-shot)

## Comment démarrer la nouvelle conversation Claude.ai

Phrase d'opening suggérée :

> "Je veux refaire le frontend de mon app Coinche dans un style premium
> club français 1920s. Documents joints :
> - `CLAUDE.md` (index du projet)
> - `CONTEXT.md` (deep dive technique)
> - `docs/handoff-redesign-v3.md` (brief redesign — ce document)
> - Image de référence visuelle
> 
> On travaille sur worktree `coinche-game-redesign` (branche
> `redesign-frontend-v3`). Par où on commence ? Je pense qu'un bon
> point de départ serait soit la palette+typo, soit le composant
> le plus visible (la table de jeu)."