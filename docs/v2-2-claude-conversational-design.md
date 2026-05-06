# Claude conversationnel pour annotation V2.2 — Design

Date du design : 2026-05-05

## Vision

Quand un annotateur fait une annotation "Pas d'accord" avec la Feuille V2.1, 
une conversation s'ouvre inline sous l'annotation avec Claude. Claude joue 
le rôle de "détective socratique", posant des questions précises pour 
révéler le raisonnement implicite de l'annotateur. Si une règle nouvelle 
émerge, l'annotateur la valide d'un mot et elle est ajoutée à sa feuille 
personnelle (copie de la Feuille V2.1 propre à lui). Plus tard, Aaron 
consolide les feuilles personnelles vers la Feuille V2.x officielle.

## Zone 1 — Déclencheur

- Types d'annotation : Pas d'accord seulement
- Timing : Immédiatement après soumission
- Format visuel : Inline en dessous de l'annotation
- Visibilité de la main : Main reste visible pendant la conversation

## Zone 2 — Rôle de Claude

- Archétype : Détective socratique
- Citer la Feuille : Oui, peut citer pour préciser questions
- Citer autres joueurs : Non, jamais (évite pression sociale)
- Citer joueur lui-même : Oui, peut référencer ses annotations passées

## Zone 3 — Sélection de cartes (Phase 3)

- Mécanisme : Tap simple (sélection/désélection)
- Groupes : Une seule sélection (un groupe)
- Reconnaissance patterns : Hybride — code calcule, Claude interprète
- Déclenchement : Suggéré par Claude, optionnel

## Zone 4 — Storage et Feuille personnelle

- Storage conversations : Dans le fichier annotation existant (schemaVersion 4)
- Visibilité : Aaron seul voit tout
- Feuille personnelle (Phase 3) : Une par utilisateur, dans 
  /data/training/<userId>/feuille-personelle.md
- Création (Phase 3) : Copie de la Feuille V2.1 lors de la 1ère session active
- Modification : Claude propose, utilisateur valide d'un mot, ajoute
- Cycle : Aaron consolide via discussion avec Claude → archive → nouvelle 
  copie à la session suivante

## Zone 5 — Coûts et déploiement

- Budget : $50/mois max
- Limites : max_tokens 1024 par tour
- Modèle : claude-sonnet-4-6
- MVP : 3 phases (backend foundation, frontend chat, sélection + feuille personnelle)

## Architecture technique

### Backend (Phase 1)
- Endpoint POST /api/conversation/start (déclenche conversation)
- Endpoint POST /api/conversation/turn (ajoute un tour)
- Endpoint POST /api/conversation/end (clôture la conversation)
- Module claudeService.js (gestion API Anthropic)
- Schema annotations v3 → v4

### Frontend (Phase 2)
- Composant ClaudeConversation.jsx (chat inline)
- Modification ReasonPanel.jsx (ouvre conversation après "Pas d'accord")

### Backend + Frontend (Phase 3)
- Composant CardSelector.jsx (sélection cartes)
- Endpoint POST /api/conversation/select-cards
- Module personalFeuille.js (gestion fichier feuille perso)
- Extension computeSuitFeatures pour analyser une sélection

### Storage
- /data/training/<userId>/<scenario-timestamp>.json étendu (conversations dedans)
- /data/training/<userId>/feuille-personelle.md (Phase 3)
- /data/training/<userId>/feuilles-archivees/<date>.md (Phase 3)
