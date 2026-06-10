# La Feuille V2 — Convention d'annonce

Convention d'ouverture et de réponse partenaire pour le bot de Coinche, version 2.
Document de référence destiné à servir de spec pour l'implémentation et de checklist pour les sessions de validation.

**Périmètre :** cette Feuille couvre les **ouvertures** et les **réponses sur ouverture** (1er niveau d'enchère). Les **réponses sur réponses** (tours suivants, comptage de points plus fin) ne sont **pas encore formalisées**.

---

## Définitions clés

- **Pièce** = Valet d'atout OU 9 d'atout (uniquement à l'atout, jamais ailleurs)
- **Maître à l'atout** = Valet + 9 + As de la couleur d'atout, avec au moins 4 atouts (V9 As 4ème minimum)
- **As extérieur** = As dans une couleur autre que l'atout
- **Petit jeu** (pour qualifier 80) = au moins une de ces conditions :
  - ≥1 pièce + ≥2 atouts
  - 4 atouts avec belote, sans pièce
  - ≥5 atouts, sans pièce
- **Seuils** : sauf indication contraire, une position en Xème signifie « au moins Xème » (les seuils de pièce/atout sont des minimums).

---

### Types d'annonce : ouverture, réponse, chique

Toute annonce relève de l'un de ces trois types (exemple avec 120, mais la règle vaut à tous les montants) :

- **Réponse** — monter sur l'annonce de son **partenaire** :
  - dans la même couleur d'atout → toujours une réponse, même en sautant de plus de 10 ;
  - sur une ouverture à **80** → toujours une réponse, même dans une autre couleur.
- **Ouverture** — tout le reste : annonce directe, saut de plus de 10, ou changement de couleur d'atout — **sauf** les cas de réponse ci-dessus. Seul cas où monter sur son partenaire est une ouverture : changer de couleur sur une ouverture du partenaire **≥ 90**.
- **Chique** — +10 strict par-dessus l'annonce de l'**adversaire** (signal d'apport ; voir la catégorie « Chiquer »).

---

## 🟢 Ouvertures

L'ouverture est l'annonce **la plus haute** que la main qualifie, dans cet ordre de priorité descendant : 120 → 110 → 100 → 80 → 90 → pass.

> **⚠️ Note importante sur la hiérarchie : 80 est prioritaire sur 90.**
> Si une main qualifie pour 80 ET pour 90, on annonce 80 (signal informatif aux 2 As). Mais 100/110/120 restent prioritaires sur 80.

| Annonce | Conditions |
|---|---|
| **120 bicolore** | Maître à l'atout + ≥1 autre atout + cartes réparties dans **strictement 2 couleurs** (atout + 1 seule autre) |
| **110** | Maître à l'atout + 1 As extérieur, minimum V9 As 4ème |
| **100** | Maître à l'atout (sans As extérieur), minimum V9 As 4ème |
| **80** | Au moins 2 As + petit jeu |
| **90** | Une de ces 3 conditions :<br>• Pièce 4ème + 1 As extérieur<br>• Valet 3ème + belote (V+K+Q) + 1 As extérieur<br>• V + 9 + 1 autre atout + 1 As extérieur |
| **Pass** | Sinon |

**Logique du 120 bicolore :** avec 0 carte dans 2 couleurs, on peut couper les As adverses dès le premier tour de chaque couleur. C'est ce qui justifie le saut à 120.

**Barrage de fait :** la seule relance possible est +10 (130), donc ouvrir 120 bloque les enchères.

---

## 🔵 Réponses partenaire

### Sur ouverture 80 (= partenaire a 2 As + petit jeu)

| Réponse | Condition |
|---|---|
| 90 | Valet sec **OU** pièce 2nde (V ou 9 + 1 autre atout). ❌ Jamais 9 sec |
| 100 | Valet + 1 As OU 9 second + 1 As |
| 110 | Valet + 2 As OU 9 second + 2 As |
| 120 | Pièce 3ème |
| 130 | Pièce 3ème + 1 As |
| 140 | Pièce 3ème + 2 As |

### Sur ouverture 90 (= partenaire a une main construite à l'atout)

| Réponse | Condition |
|---|---|
| 100 | ≥1 atout + 1 As (sans pièce) |
| 110 | Au moins 1 atout + 2 As |
| 120 | Pièce 2nde OU 3 As |
| 130 | Pièce 3ème + 2 As |

### Sur ouverture 100 (= partenaire a maître à l'atout, sans As ext)

**+10 par As extérieur.** Pas de plafond — capot possible.

### Sur ouverture 110 (= partenaire a maître + 1 As ext)

**+10 par As extérieur.** Pas de plafond mécanique en V2.

### Sur ouverture 120 bicolore (règle restrictive)

| Réponse | Condition |
|---|---|
| 130 | 3 As |
| Pass | Sinon (même avec 2 As) |

**Logique du pass à 2 As :** le partenaire peut être bicolore sur une main potentiellement déséquilibrée. 2 As seuls ne couvrent pas forcément ses perdantes si tu as par ailleurs des cartes faibles.

**Chique à 120 ou 120 annoncé en réponse (pas une ouverture) :** la règle des 3 As ne s'applique pas. Pour décider si on monte au-dessus de 120, on compte ses **plis perdants** et on annonce plus (ou non) selon les plis / points qu'on risque de perdre.

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
| 3 | A♠ K♠ A♥ 10♥ 7♥ A♦ 8♣ 7♣ | PASS | 3 As mais pas de pièce ni petit-jeu (la condition petit-jeu n'est pas remplie) |
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
- **V2.3** (réconciliation avec la feuille de base validée — le modèle de base l'emporte) : retour au modèle de base sur le 120-sur-90 (pièce 2nde ou + → 120), annulant la correction V2.1 (pièce 2nde → 110) ; plancher 4 atouts (V9 As 4ème) sur les ouvertures 100/110 ; réponse sur 120 bicolore = 3 As seulement (la pièce d'atout ne compte plus) ; ajout de la note « seuils = au moins ». Source : feuille de base manuscrite validée par Aaron.
- **V2.3 (clarifications types d'annonce)** : ajout de la règle globale « types d'annonce » (ouverture / réponse / chique), de la note de périmètre (couverture ouvertures + réponses sur ouverture ; réponses sur réponses non encore formalisées), de la distinction chique-120 / 120 en réponse → compter les plis perdants, et de la force relative du chique (toujours plus faible qu'une annonce pure au même montant). Source : clarifications d'Aaron (validées).
- **V2.3 (revue Sacha)** : réponses sur 80 (100/110) précisées (Valet / 9 second + As) ; réponse sur 100 — plafond pratique retiré (capot possible) ; Exploration — ajout « s'appuie sur les annonces ». Source : revue avec Sacha.

Migration V1 → V2 : à planifier séparément (réécriture de `botBidding.js`, mise à jour de `verify.js` blocs B1-B9 et R1-R20, mise à jour de `smoke.test.js`, vocabulaire de tags `reasonTags.json` à enrichir si besoin).

---

## V2.2 — Catégories d'annonces et principes contextuels

Cette section capture le travail conceptuel V2.2 fait le 2026-05-05.
Statut : formalisation partielle. Bot pas encore migré vers ces règles.

### Vue d'ensemble

V2.1 décrit les annonces "premier tour, sans contexte adverse". V2.2 étend
la convention pour couvrir le bidding contextuel : que faire quand
adversaires/partenaire ont déjà parlé, comment lire ce qui n'est pas dit
explicitement, et comment combiner annonces selon stratégie.

V2.2 introduit deux concepts clés :
1. **Anti-double-comptage** entre relances (Principe 1)
2. **Catégories d'annonces** différenciées par intention stratégique

### Principe 1 — Anti-double-comptage entre relances partenaire

Quand le tour me revient après une relance partenaire, je ne peux signaler
que des informations **non déjà promises** par mon ouverture initiale.

#### Mapping "ce qui est promis" par chaque ouverture V2.1

| Ouverture | As d'atout promis | As ext promis | As totaux minimum |
|---|---|---|---|
| 80 | non spécifié | non spécifié | au moins 2 |
| 90 | non | exactement 1 (interprétation lâche : ≥1 acceptable) | au moins 1 |
| 100 | oui (l'A d'atout) | exactement 0 | au moins 1 |
| 110 | oui | exactement 1 | au moins 2 |
| 120 bicolore | oui | non spécifié | au moins 1 |

#### Formule de re-relance

```
mes_as_signalables = (mes_as_réels) - (as_promis_par_mon_ouverture)
re-relance = relance_partenaire + (mes_as_signalables × 10)
```

#### Cas validés

- J'ouvre 90 (1 As ext promis), j'ai 2 As ext, partenaire dit 110 → je peux dire **120** (le 2ème As ext est nouveau)
- J'ouvre 80 (2 As promis), j'ai 3 As, partenaire dit 100 → je peux dire **110** (le 3ème As est nouveau)
- J'ouvre 110 (1 As ext promis), j'ai 2 As ext, partenaire dit 120 → je peux dire **130** (le 2ème As ext est nouveau)

#### Overrides contextuels (la règle n'est PAS purement déterministe)

La formule arithmétique donne le **maximum théorique**. En pratique, le
joueur peut sous-promettre (passer ou monter moins) dans deux cas :

1. **Surprise positive pour sécuriser** : sous-promettre pour avoir plus
   en main que ce qu'on annonce, augmentant la probabilité de faire le
   contrat sans risque de surenchère.

2. **Fenêtre fermée** : si entre la relance partenaire et mon retour, un
   adversaire a surenchéri au-dessus de ma re-relance théorique, je rate
   mathématiquement l'occasion → pass forcé.

Pour le bot V2.2 : Niveau 1 (formule arithmétique) sera codé en
déterministe. Les overrides contextuels resteront non implémentés.

### Catégories d'annonces V2.2

Le bidding compétitif (au-delà du premier tour V2.1) se structure autour
de **5 catégories d'intention stratégique**. Chaque annonce concrète
appartient à une catégorie selon l'intention du joueur, indépendamment
de sa valeur numérique.

#### Solide

- **Définition** : Annonce qui suit exactement les règles V2.1 (tables
  d'ouverture et de réponse).
- **Promesse au partenaire** : "J'ai exactement ce que la Feuille V2.1
  décrit pour cette annonce."
- **Force** : Toute valeur, mais déterminée par la main réelle.

#### Chiquer

- **Définition** : Annonce de **+10 strict** par-dessus l'annonce adverse
  courante. Signal d'apport — "j'apporte un petit quelque chose" (typiquement
  1 As ext, pièce d'atout faible, ou soutien minimal). **Ce N'EST PAS une
  coinche** — pas de doublement de score, pas de pénalité, l'enchère continue
  normalement.
- **Promesse au partenaire** : "J'apporte quelque chose d'utile (As, pièce,
  belote, longue...) — la nature précise est déductible par élimination."
- **Lisibilité** : Pas 100% au moment de l'annonce, mais converge vers
  100% au fil des plis joués.
- **Réitérable** : Possible de chiquer à nouveau si le tour revient et
  qu'on veut signaler encore plus.
- **Force** : Toujours +10 exactement. +20 ou plus n'est pas du chiquer.
- **Plus faible qu'une vraie annonce** : à tout montant, un chique = main **plus faible** qu'une annonce pure au même montant.

#### Exploration

- **Définition** : Annonce **risquée** dans un contexte compétitif où ma
  main a un potentiel intéressant mais ambigu. Je tente une couleur
  (souvent inattendue) en pariant que partenaire complète.
- **Promesse au partenaire** : "J'ai sûrement le reste du jeu dans cette
  couleur — espérons que tu aies les compléments."
- **Différence avec chiquer** : Le chiquer soutient l'annonce existante.
  L'exploration **change la couleur d'atout** ou tente une voie inédite.
- **Risque élevé** : Si partenaire ne complète pas, on chute.
- **S'appuie sur les annonces :** l'exploration se décide à partir des annonces déjà faites (partenaire et adversaires) — on en tire de l'information pour estimer si une autre voie/couleur est jouable.
- **Statut formalisation** : **Non formalisée mécaniquement.**
  Réservée aux humains. Le bot V2.2 ne fera pas d'exploration.

#### Défense / Bloquage (catégorie unifiée)

- **Définition** : Action stratégique (annonce ou pass) faite quand on
  suspecte que les adversaires ont un bon jeu. On veut limiter leur
  capacité à prendre confortablement le contrat.
- **Mécanisme** : Annoncer plus haut que ce que la main justifie pour
  forcer les adversaires à monter encore plus haut s'ils veulent prendre.
- **Promesse au partenaire** : Difficile à interpréter — partenaire doit
  comprendre via le **contexte** (annonces adverses suggérant qu'ils ont
  du jeu) que c'est probablement défensif.
- **Force** : N'importe quel montant selon la situation (+10 chiquer-de-
  blocage, +20/+30/+40+ saut, ou même pass tactique).
- **Coût** : Mutuellement risqué. Si on est laissés dessus, on doit faire
  le contrat avec moins que ce qu'on a annoncé.
- **Partenaire peut surmonter** : Si partenaire a vraiment un gros jeu,
  il peut monter au-dessus du bloquage (rare et risqué).

##### Sous-modalités du pass tactique (incluses dans Défense/Bloquage)

Le pass n'est pas toujours "rien à dire". Trois sous-modalités existent :

1. **Pass passif** : "je n'ai vraiment rien" (V2.1 standard).
2. **Pass défensif relais** : "j'ai du jeu mais je laisse partenaire
   monter" (l'info est plus utile venant de lui dans certains contextes).
3. **Pass-piège pré-coinche** : "je laisse l'adversaire monter pour
   mieux le coincher" — feinte de faiblesse pour piéger.

**Implication pour le bot** : V2.1 suppose que tous les pass = "rien".
En V2.2 humain, l'interprétation contextuelle des pass adverses devra
prendre en compte ces 3 sous-modalités. **Non implémenté pour V2.2 bot.**

#### Coinche

- **Statut** : Catégorie reconnue mais **formalisation reportée** (trop
  complexe pour la session du 2026-05-05).
- **À traiter dans une session future**.

### Comparaison synthétique

| Catégorie | Force | Promesse | Statut bot V2.2 |
|---|---|---|---|
| Solide | n'importe | "j'ai exactement la main V2.1" | Implémenté (V2.1) |
| Chiquer | +10 strict | "j'apporte qqch, déduis" | Implémenté (V2.2) |
| Exploration | n'importe | "j'ai du jeu dans cette couleur" | **Non formalisé** |
| Défense/Bloquage | n'importe (incl. pass) | "ne se lit pas selon ma main" | À implémenter (partiellement) |
| Coinche | action distincte | (à formaliser) | Reporté |

### Stratégie d'implémentation pour le bot V2.2

1. **Anti-double-comptage** : règle déterministe arithmétique (Niveau 1
   uniquement). Faisable en commit isolé.

2. **Chiquer** : règle conditionnelle (+10 si certaines conditions sont
   réunies). Plus complexe — nécessite que le bot évalue le contexte
   compétitif.

3. **Défense/Bloquage** : très contextuel. Probablement pas codable
   en règles déterministes — nécessitera système de poids ou paramètres.

4. **Exploration et Coinche** : non implémentés. Le bot pass dans ces zones.

### Stratégie de validation

Avant de coder V2.2 dans le bot :

1. Annotations multi-utilisateurs sur les 100 nouveaux scénarios
   (round 2, déployés le 2026-05-04). En particulier les zones
   `partner-opened-opp-overcalled-*`, `second-opp-opened-*`,
   `second-pass-*`.

2. Convergence (ou divergence claire) entre joueurs sur ces zones.

3. Discussion explicite avec Jeje pour valider que ces catégories
   reflètent bien la convention groupe.

4. Itération : compléter Coinche et raffiner les définitions selon
   les annotations reçues.

### TODO restants pour finaliser V2.2

- [ ] Définir formellement la catégorie **Coinche** (signaux, contextes,
       stratégie)
- [ ] Préciser la sémantique exacte du 90 (au moins 1 As ext vs exactement)
       quand pertinent pour anti-double-comptage
- [ ] Designer 15-20 scénarios training ciblés sur Principe 1 et catégories
       (chiquer, défense)
- [ ] Implémenter Niveau 1 anti-double-comptage dans `botBidding.js`
- [ ] Ajouter R/B blocs pour anti-double-comptage dans `verify.js`
