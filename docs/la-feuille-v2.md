# La Feuille V2 — Convention d'annonce

Convention d'ouverture et de réponse partenaire pour le bot de Coinche, version 2.
Document de référence destiné à servir de spec pour l'implémentation et de checklist pour les sessions de validation.

---

## Définitions clés

- **Pièce** = Valet d'atout OU 9 d'atout (uniquement à l'atout, jamais ailleurs)
- **Maître à l'atout** = Valet + 9 + As de la couleur d'atout
- **As extérieur** = As dans une couleur autre que l'atout
- **Petit jeu** (pour qualifier 80) = au moins une de ces conditions :
  - ≥1 pièce + ≥2 atouts
  - 4 atouts avec belote, sans pièce
  - ≥5 atouts, sans pièce

---

## 🟢 Ouvertures

L'ouverture est l'annonce **la plus haute** que la main qualifie, dans cet ordre de priorité descendant : 120 → 110 → 100 → 80 → 90 → pass.

> **⚠️ Note importante sur la hiérarchie : 80 est prioritaire sur 90.**
> Si une main qualifie pour 80 ET pour 90, on annonce 80 (signal informatif aux 2 As). Mais 100/110/120 restent prioritaires sur 80.

| Annonce | Conditions |
|---|---|
| **120 bicolore** | Maître à l'atout + ≥1 autre atout + cartes réparties dans **strictement 2 couleurs** (atout + 1 seule autre) |
| **110** | Maître à l'atout + 1 As extérieur |
| **100** | Maître à l'atout (sans As extérieur) |
| **80** | Exactement 2 As + petit jeu |
| **90** | Une de ces 3 conditions :<br>• Pièce 4ème + 1 As extérieur<br>• Valet 3ème + belote (V+K+Q) + 1 As extérieur<br>• V + 9 + 1 autre atout + 1 As extérieur |
| **Pass** | Sinon |

**Logique du 120 bicolore :** avec 0 carte dans 2 couleurs, on peut couper les As adverses dès le premier tour de chaque couleur. C'est ce qui justifie le saut à 120.

---

## 🔵 Réponses partenaire

### Sur ouverture 80 (= partenaire a 2 As + petit jeu)

| Réponse | Condition |
|---|---|
| 90 | Valet sec **OU** pièce 2nde (V ou 9 + 1 autre atout). ❌ Jamais 9 sec |
| 100 | Pièce + 1 As |
| 110 | Pièce + 2 As |
| 120 | Pièce 3ème |
| 130 | Pièce 3ème + 1 As |
| 140 | Pièce 3ème + 2 As |

### Sur ouverture 90 (= partenaire a une main construite à l'atout)

| Réponse | Condition |
|---|---|
| 100 | ≥1 atout + 1 As (sans pièce) |
| 110 | Pièce 2nde + 1 As |
| 120 | Pièce 3ème + 1 As **OU** 3 As |
| 130 | Pièce 3ème + 2 As |

### Sur ouverture 100 (= partenaire a maître à l'atout, sans As ext)

**+10 par As extérieur.** Plafond pratique 130 (partenaire ayant déjà l'As d'atout, le partenaire ne peut au mieux qu'ajouter 3 As extérieurs).

### Sur ouverture 110 (= partenaire a maître + 1 As ext)

**+10 par As extérieur.** Pas de plafond mécanique en V2.

### Sur ouverture 120 bicolore (règle restrictive)

| Réponse | Condition |
|---|---|
| 130 | 3 As **OU** une pièce d'atout |
| Pass | Sinon (même avec 2 As) |

**Logique du pass à 2 As :** le partenaire peut être bicolore sur une main potentiellement déséquilibrée. 2 As seuls ne couvrent pas forcément ses perdantes si tu as par ailleurs des cartes faibles.

---

## ⚙️ Règles transversales

- **Choix de la couleur d'atout** quand plusieurs sont candidates : **non formalisé en V2**. À traiter via les exemples du mode entraînement plutôt que par règle automatique.
- **Pas de plafond mécanique** sur les réponses 100/110/130/140+. Des règles futures (10s, longues, second tour) géreront les paliers supérieurs.
- **Capot** : non formalisé en V2. Heuristique générale : compter ses **perdantes** en tenant compte des plis que le partenaire est censé faire selon son annonce, plutôt que de compter ses cartes fortes.

---

## 📋 20 scénarios de validation

Mains à 8 cartes. Annonce attendue selon La Feuille V2.

| # | Main | Annonce | Justification |
|---|---|---|---|
| 1 | K♠ Q♠ 8♠ 7♥ 9♦ 8♦ Q♣ 7♣ | PASS | 0 As, aucune pièce |
| 2 | A♠ 8♠ 7♠ Q♥ J♥ 10♦ 8♣ 7♣ | PASS | 1 As, J♥ sec ne qualifie pas pour 90 |
| 3 | A♠ K♠ A♥ 10♥ 7♥ A♦ 8♣ 7♣ | PASS | 3 As ≠ exactement 2, et pas de pièce |
| 4 | A♠ K♠ A♥ 10♥ 8♥ J♦ 9♣ 7♣ | PASS | 2 As mais V♦ sec = 1 atout seul (pas petit jeu) |
| 5 | A♠ Q♠ A♥ 10♥ 7♥ J♦ 8♦ 7♣ | 80 ♦ | 2 As + V+8♦ (pièce + 2 atouts ✅) |
| 6 | A♠ K♠ A♦ 10♦ 7♦ 9♥ 8♣ 7♣ | PASS | 9♥ sec, ne qualifie pas |
| 7 | J♠ 10♠ 8♠ 7♠ A♥ Q♥ K♦ 9♣ | 90 ♠ | Pièce 4ème (V♠) + A♥ |
| 8 | J♠ K♠ Q♠ A♥ 10♥ 8♥ 7♦ 9♣ | 90 ♠ | V♠ 3ème + belote (K+Q) + A♥ |
| 9 | J♠ 9♠ 8♠ A♥ K♥ Q♥ 7♦ 10♣ | 90 ♠ | V+9+8♠ + A♥ |
| 10 | J♠ 9♠ A♠ 7♠ K♥ Q♥ J♦ 10♣ | 100 ♠ | Maître ♠, 0 As ext |
| 11 | J♣ 9♣ A♣ K♣ Q♣ 10♥ J♦ 8♦ | 100 ♣ | Maître ♣ (5 atouts), 0 As ext |
| 12 | J♠ 9♠ A♠ 7♠ A♥ Q♥ J♦ 10♣ | 110 ♠ | Maître ♠ + A♥ |
| 13 | J♣ 9♣ A♣ 10♣ A♠ K♠ A♥ 7♦ | 110 ♣ | Maître ♣ + 2 As ext (palier d'ouverture reste 110) |
| 14 | J♥ 9♥ A♥ K♥ A♣ 10♣ 9♣ 8♣ | 120 bicolore ♥ | Maître + K♥ + 4 ♣, exactement 2 couleurs |
| 15 | J♠ 9♠ A♠ K♠ Q♠ A♥ 10♥ 7♥ | 120 bicolore ♠ | Maître + 2 atouts + 3 ♥, exactement 2 couleurs |
| 16 | J♥ 9♥ A♥ K♥ A♣ 10♣ 9♣ 7♠ | 110 ♥ | Maître + A♣ ; le 7♠ casse le bicolore (3 couleurs) |
| 17 | J♠ 9♠ A♠ 8♠ A♥ Q♥ J♦ 10♣ | 110 ♠ | Qualifie 80 ET 110 → 110 gagne (100+ > 80) |
| 18 | J♠ 9♠ 8♠ A♥ K♥ Q♥ 8♦ A♣ | 80 ♠ | Qualifie 80 ET 90 → 80 prioritaire |
| 19 | J♠ 9♠ 8♠ 7♠ J♥ K♥ Q♥ A♦ | 90 — couleur libre | Tie-break non formalisé |
| 20 | J♠ 9♠ 8♠ J♥ 9♥ K♥ A♦ A♣ | 80 — couleur libre | Tie-break non formalisé |

---

## 🚧 Sujets non formalisés en V2 (à traiter ultérieurement)

1. **Tie-break entre 2 couleurs candidates à l'atout** — en discussion, plusieurs critères en jeu (nombre de pièces, longue extérieure à protéger, nombre d'atouts, points). À explorer via le mode entraînement.
2. **Capot** — annonce et soutien. Heuristique générale documentée mais pas de règle mécanique.
3. **Plafonds des réponses** au-delà de 130/140 — à intégrer avec les futures règles (10s, longues, second tour).
4. **Coinche / Surcoinche** — pas couvert.
5. **Annonces compétitives** (après ouverture adverse) — pas couvert.
6. **Second tour d'enchères** (après un tour complet de pass) — pas couvert.

---

## 📜 Historique de la convention

- **V1** (actuelle dans `botBidding.js`) : 80 = fallback (2+ As, n'importe quelle main), hiérarchie 90/100/110/120 > 80, bicolore = "exploitable" lâche (longueur 4+ ou A+honneur).
- **V2** (ce document) : 80 exige petit jeu, hiérarchie 100+ > 80 > 90, bicolore = strictement 2 couleurs.
- **V2.1** (correction sur réponses à 90) : Distinction pièce 2nde (110) vs pièce 3ème (120). Découvert par confrontation des annotations training-mode contre la table V2 — les 3 annotateurs ont convergé sur 110 pour pièce 2nde + 1 As, contredisant la table V2 qui annonçait 120 dans ce cas.

Migration V1 → V2 : à planifier séparément (réécriture de `botBidding.js`, mise à jour de `verify.js` blocs B1-B9 et R1-R20, mise à jour de `smoke.test.js`, vocabulaire de tags `reasonTags.json` à enrichir si besoin).

---

## Sujets identifiés pour V2.2 — non formalisés en V2.1

Cette section liste des principes de bidding articulés mais pas encore
formalisés dans la Feuille V2.1, et donc pas implémentés dans le bot.
À traiter dans une révision future une fois que les données d'annotation
de plusieurs joueurs auront convergé sur ces zones.

### Principe 1 — Anti-double-comptage entre relances partenaire

Un As déjà signalé via une ouverture ne peut plus être re-compté dans une
relance subséquente. Si je dis 90 (qui promet déjà 1 As ext minimum), et
que mon partenaire relance à 110, je ne peux pas ajouter +10 pour mon As
quand ça revient à moi — il sait déjà que je l'ai.

**Exception :** une ouverture à 80 promet exactement 2 As (V2.1 strict).
Donc si j'ai 3 As et que mon partenaire relance, je peux signaler le
3ème As — c'est de l'information nouvelle.

### Principe 2 — Pass-puis-parler signale une recherche, pas une promesse Feuille

Si je passe au premier tour d'enchères, et que je parle au second tour
(après que tout le monde a aussi passé une fois), mon annonce ne suit
pas les règles V2.1. Mon partenaire doit interpréter ça comme :
"j'ai quelque chose mais pas une main V2.1-grade — je cherche."

### Principe 3 — Montée +10 vs montée +20 dans un contexte compétitif

Quand l'adversaire a parlé et que je relance, une montée minimale (+10)
signale "je cherche mon partenaire, je n'ai pas exactement la main V2.1".
Une montée de +20 ou plus signale "j'ai vraiment cette main solide
selon la Feuille".

### Méta-principe synthèse

Une annonce dans un contexte chargé d'information préalable (déjà parlé,
déjà passé, ou adversaire actif) n'est pas une promesse Feuille — c'est
un signal d'exploration. La Feuille V2.1 décrit les annonces "premier
tour, sans contexte", et c'est insuffisant pour couvrir tous les cas.
La V2.2 devra étendre la Feuille à ces zones.

### Stratégie de formalisation

Ces 3 principes ont été articulés en discussion mais pas encore validés
contre des données d'annotation. Avant de coder ou de modifier la
Feuille, attendre :

1. Annotations multi-utilisateurs sur les 100 nouveaux scénarios
   (round 2, déployés le 2026-05-04). En particulier les zones
   `partner-opened-opp-overcalled-*`, `second-opp-opened-*`, et
   `second-pass-*`.
2. Convergence (ou divergence claire) entre joueurs sur ces zones.
3. Discussion explicite avec Jeje pour valider que ces principes
   reflètent bien la convention groupe.
