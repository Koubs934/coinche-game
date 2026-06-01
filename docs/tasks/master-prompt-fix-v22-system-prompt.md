# Master prompt — Fix the V2.2 conversational system prompt (`claudeService.js`)

## Contexte

Tu travailles sur l'app **coinche-game** (CLAUDE.md à la racine). Deux audits ont été faits sur 15 conversations Claude V2.2 entre Sacha et le bot conversationnel V2.2 :

1. **Audit V2.1 (déjà existant)** : `docs/audits/sacha-v22-conversations-2026-05-07.md` (à lire) — focus sur les hallucinations de règles V2.1 (29% de taux d'hallucination, 9 sur 31 affirmations factuelles).
2. **Audit complémentaire** (le présent prompt) — 14 catégories de problèmes au-delà des hallucinations.

Le but : modifier `backend/src/services/claudeService.js` (fonction `buildSystemPrompt` + `formatCardSelectionSection`) pour fixer les 14 axes ci-dessous, et ajouter un test de régression.

---

## Lecture préalable obligatoire (lis dans cet ordre)

1. `backend/src/services/claudeService.js` — fichier cible
2. `docs/la-feuille-v2.md` — la convention V2.1/V2.2 référencée
3. `docs/audits/sacha-v22-conversations-2026-05-07.md` — audit V2.1 (si présent)
4. `docs/audits/sacha-v22-conversations-raw-2026-05-07.md` — corpus brut (si présent)
5. `CLAUDE.md` — index projet, commandes
6. Cherche les tests existants sur claudeService : `find backend -name "*.test.js" | xargs grep -l claudeService`

Ne commence PAS à modifier avant d'avoir lu les fichiers ci-dessus. Si certains sont absents, signale-le et continue avec ceux que tu trouves.

---

## Vue d'ensemble des 14 modifications

| # | Mod | Catégorie auditée | Position dans `buildSystemPrompt` |
|---|---|---|---|
| 1 | RÈGLES FONDAMENTALES DE COINCHE | A. Règles fondamentales | Avant le glossaire |
| 2 | Renforcer block `rule-silent` | B + I. Hallucinations + contradiction intra-message | Dans la variable `contexte` |
| 3 | GUARD CAPOT | B. Hallucinations capot | Après le glossaire |
| 4 | Garde "≥2 As" pour 80 | B + C. Hallucination + inversion | Dans le glossaire |
| 5 | Garde no-baseline-arithmetic | B. Hallucinations | Dans le glossaire |
| 6 | Garde bicolore (strictement 2 couleurs) | B. Hallucinations | Modifier la définition existante |
| 7 | Vocabulaire strict (pisser, pli vs main, etc.) | F + G. Évaluation cartes + vocabulaire | À la fin du glossaire |
| 8 | Pré-vérification cellule Feuille | C. Inversion logique | Début de PATTERN |
| 9 | Diversifier les questions d'ouverture | M. Premier message peu engageant | Dans PATTERN |
| 10 | Prioriser le critère principal violé | N. Non-priorisation | Dans PATTERN |
| 11 | Anti-formalisation (rôle pas formaliseur) | D. Sortie de rôle | Dans LIMITES STRICTES |
| 12 | Posture sceptique | E + K. Validations creuses + prémisses | Dans TON |
| 13 | Précision reformulations | J. Reformulations imprécises | Dans TON |
| 14 | Sélection vs main réelle | L. Inadéquation pattern/main | Dans `formatCardSelectionSection` |

---

## Modifications détaillées

### Mod 1 — `RÈGLES FONDAMENTALES DE COINCHE`

**Position** : insérer juste avant `GLOSSAIRE DE LA CONVENTION` dans le template du system prompt.

**Insérer** :

```
RÈGLES FONDAMENTALES DE COINCHE (NE JAMAIS VIOLER)

- Jeu de 32 cartes, 8 cartes par couleur, 8 atouts au total dans une donne.
- Rang à l'atout : J > 9 > A > 10 > K > Q > 8 > 7
  Le Valet d'atout est la carte LA PLUS FORTE du jeu, supérieure à
  l'As d'atout. Le 9 d'atout est la 2ème plus forte.
- Rang hors atout : A > 10 > K > Q > J > 9 > 8 > 7
- Points trump : J=20, 9=14, A=11, 10=10, K=4, Q=3, 8=0, 7=0
- Points hors atout : A=11, 10=10, K=4, Q=3, J=2, 9=0, 8=0, 7=0
- Total points par donne : 152 + 10 (dix-de-der) = 162.
- Capot = 500 points (jamais 250). 8 plis pour le contractant.
- Belote = K+Q d'atout joués par le même joueur, +20 chacun.

Avant toute affirmation arithmétique sur les cartes restantes ou le
rang d'une carte : VÉRIFIE ces règles. Si tu n'es pas certain, ne
fais pas l'affirmation.

```

### Mod 2 — Renforcer le block `rule-silent`

**Position** : remplacer la branche `caseType === 'rule-silent'` de la variable `contexte`.

**Remplacement complet** :

```js
const contexte = caseType === 'rule-silent'
    ? `L'utilisateur s'appelle ${userName}. Il vient de faire une annotation
sur un cas que la Feuille V2.1 ne couvre pas explicitement. Il a fait
un choix et le justifie — son raisonnement va aider à compléter la
Feuille.

IMPORTANT — RÈGLE-SILENT, PAS DE FABRICATION
La Feuille V2.1 ne contient PAS de règle pour ce cas. N'invente JAMAIS
une règle V2.1 qui n'existe pas pour cadrer ta question.

EXEMPLES DE FABRICATIONS À NE JAMAIS PRODUIRE
(toutes observées dans des conversations précédentes) :
- "pièce 3ème = 110 de base, +10 pour l'As d'atout" (formule inventée — V2.1 est une lookup table, pas un additive)
- "le capot nécessite une domination quasi-totale" (capot non formalisé en V2)
- "il en faut 4 As pour le capot" (aucun seuil n'existe)
- "ouverture 80 promet exactement 2 As" (la Feuille dit "au moins 2")
- "+10 par As ext en ouverture" (cette règle existe en RÉPONSE 100/110, pas en ouverture)
- "120 bicolore = 4+/4+" (la règle est "strictement 2 couleurs", n'importe quelle distribution)

NE PROPOSE PAS DE FORMULE EN RULE-SILENT
Pose une question OUVERTE sans suggérer de formule arithmétique :
- ✅ "C'est quoi ta logique pour arriver à 120 ?"
- ❌ "C'est quoi ta logique : pièce 3ème = 110 de base, +10 pour l'As ?"
Le second pattern oriente l'utilisateur vers une fausse règle qu'il
pourrait ratifier par paresse.

Dans ce cas rule-silent, dis explicitement à l'utilisateur que la
Feuille ne couvre pas son cas, et discute son raisonnement à lui (sa
note, sa sélection de cartes) sans citer de règle. Le pattern en 3
étapes (cite la règle / explique pourquoi / demande l'écart) NE
S'APPLIQUE PAS ici — il n'y a pas de règle à citer.`
    : `L'utilisateur s'appelle ${userName}. Il vient de faire une annotation
"Pas d'accord" — il a annoncé une valeur différente de ce que la Feuille
V2.1 prescrit, et il défend explicitement son choix.`;
```

### Mod 3 — `GUARD CAPOT`

**Position** : nouvelle section juste après le glossaire, avant `PATTERN POUR TA PREMIÈRE QUESTION`.

**Insérer** :

```
GUARD CAPOT (règle absolue)

Le capot N'EST PAS formalisé en V2. La seule heuristique documentée
est "compter ses perdantes en tenant compte des plis que le partenaire
est censé faire selon son annonce".

Tu ne dois JAMAIS produire :
- Un seuil d'As pour annoncer capot ("il en faut 4")
- Un critère de domination ("nécessite domination quasi-totale", "As ext solides")
- Une valeur de points fausse pour le capot (le capot vaut 500 pts, jamais 250)

Si l'utilisateur annonce capot, demande-lui :
- ses perdantes (combien, dans quelles couleurs)
- ce qu'il attend du partenaire selon son ouverture
- s'il compte sur la partance ou non

Sans jamais asserter de règle.

```

### Mod 4 — Garde 80 = "au moins 2 As"

**Position** : dans le glossaire, en complément de la définition existante.

**Ajouter à la fin du glossaire (avant les `Pisser`/`Solide`/`Exploration`)** :

```
- **Ouverture 80** : "≥2 As + petit jeu". JAMAIS "exactement 2 As".
  Une main avec 3 As peut ouvrir 80 si petit jeu est satisfait. Si
  petit jeu N'EST PAS satisfait, la main passe — quel que soit le
  nombre d'As (2, 3, ou 4). Le critère petit jeu est la condition
  PRINCIPALE, pas le compte d'As.
```

### Mod 5 — Garde no-baseline-arithmetic

**Position** : dans le glossaire, en bloc séparé avant `Pisser`.

**Insérer** :

```
- **V2.1 EST UNE LOOKUP TABLE, PAS UNE FORMULE**
  Les paliers V2.1 (90, 100, 110, 120, 130, 140) sont fixés par la
  table. NE construis PAS de formules "base + bonus" pour V2.1 :
    ❌ "pièce 3ème = 110 de base, +10 pour l'As d'atout"
    ❌ "maître + 1 As ext = 110, donc +10 par As supplémentaire"
  La SEULE formule additive de la Feuille est V2.2 ADC pour la
  re-relance après ouverture + relance partenaire :
    re-relance = relance_partenaire + (As_signalables × 10)
  Et elle ne s'applique QUE dans ce cas spécifique.
```

### Mod 6 — Garde bicolore

**Position** : remplacer la définition existante de Bicolore dans le glossaire.

**Remplacer** :

```
- **Bicolore** : main avec seulement 2 couleurs occupées (4+ atouts
  + 4+ d'une autre couleur).
  - 120 bicolore = bicolore + maître à l'atout.
```

**Par** :

```
- **Bicolore** : main avec cartes réparties dans **strictement 2
  couleurs** (atout + 1 seule autre couleur). Toute distribution dans
  ces 2 couleurs est valide : 4+4, 5+3, 6+2, 7+1. NE dis JAMAIS "4+/4+"
  comme s'il y avait une exigence de répartition spécifique.
  - 120 bicolore = bicolore + maître à l'atout.
```

### Mod 7 — Vocabulaire métier strict

**Position** : à la fin du glossaire, en sous-section dédiée.

**Insérer** :

```
GLOSSAIRE — RÈGLE D'USAGE STRICT

- "pisser" UNIQUEMENT pour : jouer un petit atout faible quand on NE
  PEUT PAS surcouper (un adversaire a posé un atout plus haut, et toi
  tu n'as que des atouts plus petits). Ne dis pas "le partenaire pisse"
  s'il fournit juste des petits atouts à une entame atout — c'est juste
  fournir.
- "pièce" UNIQUEMENT pour J ou 9 de l'atout du contrat (jamais une
  carte d'une autre couleur).
- "maître à l'atout" UNIQUEMENT pour J + 9 + A de la couleur d'atout.
  Si la main a plus, dis "maître + N atouts" ou "5 atouts incluant le
  maître", JAMAIS "5 atouts maître".
- Distingue toujours "pli" (tour de 4 cartes) et "main" (les 8 cartes
  du joueur, ou la maîtrise du jeu). Perdre un pli ≠ perdre la main.
- **Apport hors atout** : seuls les **As extérieurs** sont un apport
  solide pour annoncer. Un K ou Q hors atout sans la Dame/Roi associé
  ni longue derrière ne "fait pas de poids" pour annoncer. Ne suggère
  JAMAIS qu'un K ou Q hors atout aurait dû être compté.
- Distingue **"ouverture"** (1ère annonce de la donne) de **"réponse"**
  (annonce du partenaire après l'ouverture). Les règles diffèrent —
  notamment "+10 par As ext" existe en RÉPONSE sur 100/110, pas en
  OUVERTURE.

```

### Mod 8 — Pré-vérification de la cellule Feuille

**Position** : tout début de la section `PATTERN POUR TA PREMIÈRE QUESTION`.

**Insérer en tête de section** :

```
AVANT TON PREMIER MESSAGE — VÉRIFICATION DE LA CELLULE
Quand tu vas citer la Feuille V2.1, RELIS la cellule exacte de la
table avant d'écrire. Distingue particulièrement :
- "au moins N As" vs "exactement N As" (la Feuille dit "au moins")
- "ouverture" vs "réponse" (les +10 par As sont en RÉPONSE seulement)
- "pièce 2nde" (V ou 9 + 1 atout) vs "pièce 3ème" (V ou 9 + 2 atouts)

Si l'utilisateur reformule la règle dans ses propres mots, NE LUI DIS
PAS qu'il diverge tant que tu n'as pas re-vérifié la cellule. Régression
historique : Sacha a redit "80 = au moins 2 As" et le bot a répondu
"C'est une divergence directe avec la Feuille" — alors que Sacha citait
la Feuille mot pour mot.

```

### Mod 9 — Diversification des questions d'ouverture

**Position** : dans la section `PATTERN POUR TA PREMIÈRE QUESTION`, après le bloc `EXEMPLES DE BONNES PREMIÈRES QUESTIONS`.

**Insérer** :

```
TYPES DE QUESTIONS POUR L'ÉTAPE 3 DU PATTERN

Varie la formulation finale selon le contexte. Évite les questions
purement arithmétiques en série — l'utilisateur a souvent une
intuition, pas une formule articulée :
- ✅ "Qu'est-ce qui te fait sortir du barème là ?"
- ✅ "Tu te bases sur quoi pour cette annonce — la main, le score,
  l'opportunité tactique ?"
- ✅ "Tu vois un risque ou tu trouves ça assez sûr ?"
- ✅ "C'est lié à ta sélection [pattern] ou à autre chose ?"
- ❌ "C'est quoi ta formule pour arriver à 130 ?" (trop fermé)
- ❌ "Tu comptes quoi exactement dans ton 140 ?" (l'utilisateur n'a
  souvent pas de "formule" articulée)

Une question fermée arithmétique en début de conversation a un faible
taux d'engagement (mesuré : 73% des conversations meurent au 1er tour
quand la question est arithmétique fermée).

```

### Mod 10 — Priorisation du critère violé

**Position** : dans `PATTERN POUR TA PREMIÈRE QUESTION`, après Mod 9.

**Insérer** :

```
QUAND LA MAIN VIOLE PLUSIEURS CONDITIONS, PRIORISE LA PRINCIPALE

Une main peut diverger de la Feuille sur plusieurs axes. Identifie le
critère qui rend la main NON-conforme à l'annonce, pas un détail
secondaire.

Exemple : ouverture 80 demande "≥2 As + petit jeu". Une main avec 3 As
mais sans petit jeu (sans pièce, < 5 atouts, pas 4 + belote) viole le
critère petit jeu. Le vrai problème est le petit jeu, pas le compte
d'As. Pose la question sur le critère manquant principal.

```

### Mod 11 — Anti-formalisation (dans LIMITES STRICTES)

**Position** : à la fin de la section `LIMITES STRICTES`, en complément des limites existantes.

**Ajouter** :

```
- **Tu n'es PAS un formaliseur de règles.** Ta sortie est de comprendre
  le raisonnement de l'utilisateur — PAS de proposer une règle V2.2
  candidate, PAS de généraliser, PAS de demander si "on garde ça comme
  règle". Aaron consolide les annotations en règles. Toi tu écoutes et
  tu clarifies.
  Phrases interdites :
  - "ça pourrait devenir une règle V2.1"
  - "On garde ça comme règle candidate ?"
  - "Plus restrictif mais plus solide comme condition"
  - "On note ça ?" suivi d'une formulation de règle (le simple "on
    note ?" pour confirmer ce que l'utilisateur a dit reste OK)
```

### Mod 12 — Posture sceptique

**Position** : ajouter une sous-section dans la section `TON`.

**Insérer après le block TON existant** :

```
RESTE SCEPTIQUE, NE VALIDE PAS PAR DÉFAUT

Évite particulièrement :
- "C'est un raisonnement cohérent"
- "Ça tient"
- "Bonne logique"
- "C'est solide"

Quand l'utilisateur a fini d'expliquer, reformule sa logique
neutrement, sans qualifier sa qualité. Si tu vois un trou (suppositions
implicites sur le partenaire, comptage incomplet, risque non chiffré),
pose une question dessus avant de conclure.

Quand l'utilisateur dit "forcément X", demande "qu'est-ce qui rend X
obligatoire ?" — sauf si la chaîne logique est manifestement
inattaquable.

Quand l'utilisateur emploie un terme que tu ne reconnais pas (au-delà
du glossaire fourni — par exemple "antibelote", "le 34", "le 21"),
demande "qu'est-ce que tu appelles X ?" avant de continuer. Ne suppose
JAMAIS le sens d'un mot d'argot de table.

```

### Mod 13 — Précision dans les reformulations

**Position** : dans `TON`, après Mod 12.

**Insérer** :

```
PRÉCISION DANS LES REFORMULATIONS DE MAIN

- "Maître à l'atout" = exactement J + 9 + A (3 cartes). Si la main a
  plus, dis "maître + N atouts" ou "5 atouts incluant le maître", JAMAIS
  "5 atouts maître".
- Singulier vs pluriel doit refléter le compte exact (1 As ext = "ton
  As extérieur", pas "tes As extérieurs").
- Toute opération arithmétique sur les cartes part de 32 cartes au
  total, 8 par couleur — pas 36, pas 9 par couleur.

```

### Mod 14 — `formatCardSelectionSection` — Sélection vs main réelle

**Position** : modifier la fonction `formatCardSelectionSection`.

**Remplacer le `return` final par** :

```js
  return `SÉLECTION DE CARTES PAR L'UTILISATEUR
L'utilisateur a sélectionné les cartes suivantes pour expliquer son raisonnement :
${describeSelectedCards(cardSelection.features)}

Patterns reconnus dans cette sélection :
${describePatterns(cardSelection.features)}

NOTE — la sélection peut être incomplète ou ne pas refléter toute la
force de la main (l'utilisateur peut avoir oublié une carte, ou choisi
de ne montrer qu'un aspect). Compare TOUJOURS la sélection avec la
main complète fournie plus bas. Si la sélection sous-représente la
main (ex : sélection "pièce 2nde" alors que la main contient le maître
à l'atout complet), signale-le gentiment :
"Tu as sélectionné [pattern], mais ta main contient en fait [vraie
structure] — tu t'appuies vraiment sur [pattern] ou tu considères
toute la force ?"

`;
```

---

## Test de régression à créer

Crée le fichier `backend/test/services/claudeService.regression.test.js` (adapte le chemin selon la structure existante des tests vitest dans le projet).

**Contenu** :

```js
const { describe, it, expect } = require('vitest');
const { buildSystemPrompt } = require('../../src/services/claudeService');

describe('claudeService — V2.2 calibration regression (Sacha audit)', () => {
  const baseArgs = {
    feuilleContent: '## stub Feuille V2.1',
    userName: 'Sacha',
    userPastAnnotations: '(none)',
    caseType: 'value-different',
    cardSelection: null,
  };
  const buildVD = (extra = {}) => buildSystemPrompt({ ...baseArgs, ...extra });
  const buildRS = (extra = {}) => buildSystemPrompt({ ...baseArgs, caseType: 'rule-silent', ...extra });

  describe('Mod 1 — Règles fondamentales coinche', () => {
    it('cite le rang trump correct', () => {
      expect(buildVD()).toMatch(/J\s*>\s*9\s*>\s*A\s*>\s*10\s*>\s*K\s*>\s*Q/);
    });
    it('cite 32 cartes / 8 par couleur', () => {
      const sp = buildVD();
      expect(sp).toMatch(/32\s*cartes/);
      expect(sp).toMatch(/8\s*cartes\s+par\s+couleur/i);
    });
    it('mentionne capot = 500 pts', () => {
      expect(buildVD()).toMatch(/[Cc]apot\s*=?\s*500/);
    });
    it('ne mentionne JAMAIS capot = 250', () => {
      expect(buildVD()).not.toMatch(/[Cc]apot.*?250\s*(points|pts)/);
    });
  });

  describe('Mod 2 — Rule-silent renforcé', () => {
    it('contient les exemples de fabrications interdites', () => {
      const sp = buildRS();
      expect(sp).toMatch(/EXEMPLES DE FABRICATIONS/i);
      expect(sp).toMatch(/pièce 3ème = 110 de base/i);
      expect(sp).toMatch(/exactement 2 As/i);
    });
    it('interdit les formules en rule-silent', () => {
      expect(buildRS()).toMatch(/NE PROPOSE PAS DE FORMULE/i);
    });
  });

  describe('Mod 3 — Capot guard', () => {
    it('marque le capot comme non formalisé', () => {
      expect(buildVD()).toMatch(/[Cc]apot.*pas formalisé|GUARD CAPOT/);
    });
  });

  describe('Mod 4 — 80 = au moins 2 As', () => {
    it('dit "au moins 2 As" pour 80', () => {
      expect(buildVD()).toMatch(/au moins 2\s+As/i);
    });
    it('NE dit jamais "exactement 2 As" comme règle', () => {
      // L'expression peut apparaître comme contre-exemple, mais
      // pas comme assertion positive. On cherche au moins une
      // occurrence avec "JAMAIS" à proximité.
      const sp = buildVD();
      const exactMatches = sp.match(/exactement\s+2\s+As/gi) || [];
      // Toutes les occurrences doivent être dans des contextes négatifs
      for (const m of exactMatches) {
        const idx = sp.indexOf(m);
        const context = sp.slice(Math.max(0, idx - 100), idx + 100);
        expect(context).toMatch(/JAMAIS|❌|interdit|pas/i);
      }
    });
  });

  describe('Mod 5 — V2.1 lookup table, pas additive', () => {
    it('explique que V2.1 est une lookup table', () => {
      expect(buildVD()).toMatch(/lookup table|pas une formule/i);
    });
  });

  describe('Mod 6 — Bicolore strict', () => {
    it('dit "strictement 2 couleurs"', () => {
      expect(buildVD()).toMatch(/strictement 2 couleurs/i);
    });
    it('mentionne 4\+\/4\+ comme contre-exemple', () => {
      expect(buildVD()).toMatch(/4\+\/4\+/);
    });
  });

  describe('Mod 7 — Vocabulaire strict', () => {
    it('définit pisser de manière stricte', () => {
      expect(buildVD()).toMatch(/pisser.*UNIQUEMENT|pisser.*ne peut pas surcouper/i);
    });
    it('distingue pli vs main', () => {
      expect(buildVD()).toMatch(/pli.*main|Perdre un pli/i);
    });
    it('avertit sur K/Q hors atout', () => {
      expect(buildVD()).toMatch(/K ou Q hors atout/i);
    });
    it('distingue ouverture vs réponse', () => {
      expect(buildVD()).toMatch(/ouverture.*réponse|RÉPONSE.*OUVERTURE/i);
    });
  });

  describe('Mod 8 — Pré-vérification cellule', () => {
    it('rappelle de relire la cellule avant de citer', () => {
      expect(buildVD()).toMatch(/RELIS la cellule|VÉRIFICATION DE LA CELLULE/i);
    });
  });

  describe('Mod 9 — Diversifier questions', () => {
    it('liste des questions ouvertes alternatives', () => {
      expect(buildVD()).toMatch(/sortir du barème|opportunité tactique/i);
    });
  });

  describe('Mod 10 — Prioriser critère violé', () => {
    it('explique de prioriser le critère principal', () => {
      expect(buildVD()).toMatch(/PRIORISE LA PRINCIPALE|critère manquant principal/i);
    });
  });

  describe('Mod 11 — Anti-formalisation', () => {
    it('interdit les phrases de formalisation', () => {
      const sp = buildVD();
      expect(sp).toMatch(/règle V2\.1.*candidat|pas un formaliseur/i);
      expect(sp).toMatch(/Aaron/);
    });
  });

  describe('Mod 12 — Posture sceptique', () => {
    it('liste les phrases de validation creuse à éviter', () => {
      const sp = buildVD();
      expect(sp).toMatch(/raisonnement cohérent/i);
      expect(sp).toMatch(/[Bb]onne logique/);
    });
    it('demande de challenger les "forcément"', () => {
      expect(buildVD()).toMatch(/forcément/i);
    });
  });

  describe('Mod 13 — Précision reformulations', () => {
    it('rappelle maître = exactement 3 cartes', () => {
      expect(buildVD()).toMatch(/exactement J \+ 9 \+ A|3 cartes/i);
    });
  });

  describe('Mod 14 — Sélection vs main réelle', () => {
    it('avertit sur sélection incomplète', () => {
      const sp = buildSystemPrompt({
        ...baseArgs,
        cardSelection: {
          features: {
            selectedCount: 3,
            // shape minimum pour describeSelectedCards/describePatterns
          },
        },
      });
      // Si describeSelectedCards plante sur le stub, simplifie le test
      // ou injecte un mock. Sinon vérifie la note :
      expect(sp).toMatch(/sélection peut être incomplète|sous-représente la main/i);
    });
  });

  describe('Préservation de l\'existant', () => {
    it('garde les exemples 1, 2, 3 existants', () => {
      const sp = buildVD();
      expect(sp).toMatch(/EXEMPLE 1/);
      expect(sp).toMatch(/EXEMPLE 2/);
      expect(sp).toMatch(/EXEMPLE 3/);
    });
    it('garde le pattern en 3 étapes', () => {
      expect(buildVD()).toMatch(/PATTERN POUR TA PREMIÈRE QUESTION/);
    });
    it('garde les LIMITES STRICTES', () => {
      expect(buildVD()).toMatch(/LIMITES STRICTES/);
    });
    it('garde le glossaire des termes V2.2 (chiquer, ADC, etc.)', () => {
      const sp = buildVD();
      expect(sp).toMatch(/Chiquer/);
      expect(sp).toMatch(/ADC|anti-double-comptage/i);
    });
  });
});
```

> **Note pour Mod 14** : si `describeSelectedCards`/`describePatterns` plantent sur le stub, simplifie le test ou mocke ces helpers depuis `../../src/game/cardFeatures`.

---

## Étapes d'exécution

1. Lis tous les fichiers de la section "Lecture préalable obligatoire".
2. Affiche-moi un résumé de la structure actuelle de `buildSystemPrompt` (sections, ordre) pour confirmer que tu as bien situé les positions.
3. Repère où dans `buildSystemPrompt` chaque section actuelle se trouve (CONTEXTE, GLOSSAIRE, PATTERN POUR TA PREMIÈRE QUESTION, EXEMPLES, LIMITES STRICTES).
4. Applique les Mods 1 → 14 dans l'ordre, en utilisant `str_replace` pour les remplacements et en lisant à nouveau le fichier après chaque modification (StrictMode-style, anti-stale-state).
5. Crée le fichier de test `backend/test/services/claudeService.regression.test.js` (ou adapte le chemin selon la convention du projet).
6. Lance les tests : `cd backend && npm run test:vitest`.
7. Si Anthropic API key disponible, lance le smoke test : `cd backend && export $(cat .env.railway.local | xargs) && node ../scripts/test-claude-conversation.js` (sinon, signale-le et passe).
8. Affiche un diff résumé final et un compteur "Mods appliqués : X/14".

---

## Critères de succès

- ✅ Tous les tests vitest existants passent (118 tests, 9 suites — voir `CLAUDE.md`).
- ✅ Le nouveau fichier de régression passe (au moins 25 assertions).
- ✅ Le system prompt généré contient toutes les nouvelles sections.
- ✅ Aucune section existante n'a été détruite (EXEMPLE 1/2/3 préservés, glossaire V2.2 préservé).
- ✅ Le smoke test (si lancé) ne renvoie pas d'erreur.

---

## À NE PAS FAIRE

- ❌ Ne modifie PAS la fonction `formatScenarioForClaude` autrement que via Mod 14 (qui est sur `formatCardSelectionSection`).
- ❌ Ne change PAS les noms d'exports (`startConversation`, `continueConversation`, `formatScenarioForClaude`, `formatPastAnnotations`, `buildSystemPrompt`, `MODEL`, `MAX_TOKENS`).
- ❌ Ne change PAS le modèle (`claude-sonnet-4-6`) ni `MAX_TOKENS` (1024).
- ❌ Ne supprime PAS les EXEMPLES 1-3 existants — ils calibrent bien Claude sur les cas value-different sans être source des hallucinations.
- ❌ Ne change PAS la signature de `buildSystemPrompt`.
- ❌ Ne crée PAS de TODO/FIXME comments dans le code (cf. CLAUDE.md, conventions).

---

## Cas-test critique de régression manuelle

Une fois les Mods appliqués, fais tourner mentalement (ou via un script) ce scénario contre le nouveau system prompt :

> **Scénario validation-scenario-03** (Conv 14, le pire cas observé) :
> - Main : ♠ A K · ♥ A 10 7 · ♦ A · ♣ 8 7
> - V2.1 attendu : pass
> - Sacha annonce : 80 ♣
> - Note : "C'est 3 as extérieur dont un 21"

**Première question Claude attendue (post-fix)** doit ressembler à :

> "La Feuille dit pass parce que 80 = ≥2 As + **petit jeu**. Tu as bien 3 As, mais ♣ 8 7 ne fait pas petit jeu (pas de pièce, pas 5 atouts, pas 4 + belote). C'est ça le critère qui te fait passer en V2.1. Toi tu ouvres 80 — c'est que tu lis le petit jeu autrement, ou tu te bases sur autre chose ?"

**Symptômes de régression non corrigée** (à détecter) :
- "exactement 2 As" → Mod 4 a échoué.
- "C'est une divergence directe avec la Feuille" sans re-vérification → Mod 8 a échoué.
- Ne mentionne pas le critère petit jeu → Mod 10 a échoué.

Si le test manuel mental montre une de ces régressions, retourne sur le mod concerné et renforce.
