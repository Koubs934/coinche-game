# La Feuille V2.3 — Draft

> ⚠️ **STATUS : DRAFT — NON CANONIQUE**
>
> Source de vérité pour le bot et Claude V2.2 = `docs/la-feuille-v2.md` (V2.1 + V2.2). Ce draft sera mergé après validation collective avec Sacha et Jeje.

**Origine** : extraction de patterns depuis les annotations training-mode d'Aaron (69 annotations sur 2026-04-21 → 2026-05-08). Méthode : questionnaire interactif Aaron / Claude (assistant) le 2026-05-08, 5 rounds, 15 questions.

**Output** : 7 règles confirmées par Aaron + 5 cas-limite à trancher en session collective.

---

## Sommaire

1. [Règles solides confirmées](#1-règles-solides-confirmées-par-aaron)
2. [Bucket à valider Sacha/Jeje](#2-bucket-à-valider-sachajeje)
3. [Vocabulaire à ajouter au glossaire](#3-vocabulaire-à-ajouter-au-glossaire)
4. [Notes pour la session collective](#4-notes-pour-la-session-de-validation)
5. [Plan de merge dans la canonical V2](#5-plan-de-merge)

---

## 1. Règles solides confirmées par Aaron

### R1 — Surenchère sur overcall : règle structurelle

**Énoncé**

Quand partenaire a ouvert et qu'un adversaire a overcallé, ma réponse :

| Action | Sens stratégique |
|---|---|
| Pass | Pas d'apport, je laisse passer |
| Adverse + 10 strict | **Chiquer** — signal d'apport (conditions précises = bucket A) |
| > Adverse + 10 | **Annonce solide V2.1** — j'applique la table de réponse à l'ouverture du *partenaire*, comme si l'adversaire n'avait pas parlé. Je **saute** au palier V2.1, pas de palier intermédiaire. |

**Cas-limite résolu** (Aaron, 2026-05-08) : si V2.1 réponse à l'ouverture partenaire dit 120 et l'overcall adverse est à 90, je peux annoncer 100 (chiquer +10) ou 120 (V2.1). **Pas 110** — un palier intermédiaire entre +10 et la valeur V2.1 n'est pas une option valide.

**Origine annotation**

- Conv `partner-opened-opp-overcalled-02-partner-100s-opp-110h` (2026-05-06) :
  > Aaron : *"Je rajoute 10 pour lui indiquer que je le support mais je lui donne pas trop d'info non plus... Par rapport à l'enchère adverse"*
- Questionnaire 2026-05-08 R1Q3 :
  > Aaron : *"si je monte plus que 10 c'est le meme scenario quoi"*

**Impact sur la canonical**

- Section V2.2 "Annonces compétitives — pas couvert" devient **largement couverte**.
- Beaucoup de scénarios `partner-opened-opp-overcalled-*` actuellement marqués `expectedAnswer: null` (rule-silent) retrouvent une `expectedAnswer` calculable via R1.
- Le bot V2.3 devra implémenter cette logique en deux branches (chiquer vs V2.1 saut).

---

### R2 — Belote et 10 : annoncés au 2ème tour, pas en ouverture

**Énoncé**

La belote (K+Q d'atout du contrat) et les cartes "10" ne s'annoncent pas en première ouverture. Elles s'annoncent au **2ème tour de bidding** (ou 3ème si le premier tour était un pass complet).

**Conséquence pratique**

- 1er tour : V2.1 lookup pure sur la structure de main, sans bonus belote ni 10.
- 2ème tour (ou 3ème si pass complet) : belote et 10 peuvent être ajoutés comme apport.

**Origine**

Questionnaire 2026-05-08 R2Q1 :
> Aaron : *"les 10 et la belote ca s'annonce au deuxieme tour si y en a un (troisieme si le premier tour etait un pass)"*

**Cas-limite non tranché** : R2-bis (bucket D ci-dessous).

---

### R3 — Belote = K+Q de l'atout du contrat (pas une couleur secondaire)

**Énoncé**

Le terme "belote" désigne **exclusivement** le K+Q de la couleur d'atout du contrat. K+Q dans une couleur secondaire n'est pas une belote.

**Statut** : clarification (définition standard de coinche). Confirmée par Aaron pour clore l'ambiguïté potentielle.

**Origine**

Questionnaire 2026-05-08 R2Q2 : *"toujours dans l'atout"*

---

### R4 — Capot d'ouverture solo : formule déterministe

**Énoncé**

En première position (aucun joueur n'a parlé), le capot est annonçable d'emblée si la main satisfait :

```
Maître à l'atout (J + 9 + A d'atout)
+ ≥ 4 atouts au total (donc maître + ≥1 atout supplémentaire)
+ ≥ 1 longue avec As (≥ 4 cartes incluant l'As) dans une couleur secondaire
```

**Logique des plis**

- 4 atouts maîtres → jusqu'à 4 plis (les adversaires perdent à chaque atout joué)
- Longue 4ème avec As → 4 plis (après purge des atouts adverses, plus de coupes possibles)
- Total : 4 + 4 = 8 plis = capot

**Cas-limite résolu** (Aaron, 2026-05-08) : avec cette structure, on annonce **capot directement** d'emblée. Pas 120 puis capot au 2ème tour.

**Origine annotation**

- Conv `opening-04-maitre-bicolore-7-1-side` (2026-05-06) : Aaron annonce capot ♠ avec main A♠ K♠ Q♠ J♠ 9♠ + A♥ K♥ 10♥ — note : *"5 atout et As roi 10 maitre"*
- Questionnaire 2026-05-08 R4Q1 (reformulé Aaron) :
  > *"il faut etre maitre a l'atout avec quatre atout au total, et avoir une longue a l'as c'est capt assurer"*

**Impact sur la canonical**

- V2 actuelle dit *"Capot non formalisé en V2 — heuristique générale : compter ses perdantes"*. R4 donne un **premier cas déterministe**.
- Cas non couvert : capot en réponse à une ouverture partenaire (bucket C).

---

### R5 — Phase signal puis phase estimation (méta-règle)

**Énoncé**

Le bidding se déroule mentalement en deux phases :

1. **Phase signal** (typiquement tours 1-2)
   - V2.1 lookup pour signaler la **structure** de sa main au partenaire
   - But : informer le partenaire, pas chercher le score réel

2. **Phase estimation** (quand l'info accumulée le permet)
   - Quand mes cartes + l'info partenaire permettent d'estimer le score réel
   - Bascule vers le comptage en arrière depuis 162 (- perdantes)
   - Aaron : *"C'est des probabilités sans le savoir"*

**Statut** : méta-règle stratégique — pas un palier d'annonce, mais une méthode de raisonnement.

**Origine annotation**

- Conv `response-90-01-piece-2nd-1-ace` (2026-05-06) : Aaron explicite la méthode "compter en arrière depuis 162"
- Questionnaire 2026-05-08 R5Q2 :
  > Aaron : *"C'est plus les annonce d'ouverture jusqu'a 120 ca aide a annoncer au partenaire ce qu'on a, ensuite lui en reponse peux me monter l'anonce ou me changer peut importe mais il me donne plus d'info et eventuellement si j'arrive a en deduire que je peux faire beaucoup de plis, je compte les perdantes et estime"*

**Implication pour le bot et Claude V2.2**

- V2.1 lookup s'applique en phase signal (mains moyennes 80-130).
- En phase estimation (mains 140+, capot), V2.1 peut être dépassé légitimement.
- Les "user-disagrees" qui sur-bident V2.1 sur des mains fortes ne sont pas forcément des erreurs : phase estimation ≠ V2.1 dépassée.

---

### R6 — Compte arrière → mains fortes seulement

**Énoncé**

La méthode "162 - perdantes" est utilisée surtout sur les mains visant **140+ ou capot**. Sur les mains 80-130, V2.1 lookup suffit et est préféré.

**Statut** : précision sur R5 — délimite le périmètre où chaque méthode s'applique.

**Origine**

Questionnaire 2026-05-08 R5Q1 : *"Surtout pour les mains très fortes (140, 150, capot)"*

---

### R7 — Anti-belote (vocabulaire formalisé)

**Énoncé**

**Anti-belote** = avoir le **K ou la Q de la couleur d'atout du contrat** (en défense, donc atout choisi par les adversaires). Empêche l'adversaire de jouer sa belote (gain de 20-40 pts perdu pour eux).

**Usage stratégique**

Sécurise une coinche défensive — sans belote possible chez l'adversaire, leur potentiel de score est diminué de 20-40 pts, ce qui peut faire basculer la décision de coincher.

**Origine**

- Conv `second-opp-opened-13-opp-100d-user-coinche-attempt` (2026-05-06) : Aaron : *"As 3eme anti-belote. C'est quand même risqué"*
- Questionnaire 2026-05-08 R5Q3 :
  > Aaron : *"c'est quand tu a soit le roi ou la dame d'atout et tu empeche l'autre equipe d'avoir la belote, donc disons si ils annonce a 150 et je sais que je vais faire un plus de plus de 13 points et jai l'anto belote donc je suis sure de pouvoir les faire chuter donc je vais contrer"*

---

## 2. Bucket à valider Sacha/Jeje

Ces points ont émergé des annotations Aaron mais doivent être tranchés en session collective avant intégration dans la canonical V2.

### A — Conditions précises du chiquer (associé à R1)

Quels apports justifient un chiquer +10 sur overcall ? Options émergées du corpus mais non tranchées :
- Belote dans la couleur d'atout du partenaire
- Pièce d'atout (J ou 9)
- As extérieur seul, sans rien d'autre
- Longue 4+ avec un honneur (As ou A+10)
- 3+ atouts même sans pièce

Aaron lors du questionnaire (R1Q1) : *"on laissera sacha et jeje decider de ca"*

### B — Pièce 3ème sur ouverture 90 → 120 ou 130 ?

Aaron a annoncé 130 sur ouverture 90 avec pièce 3ème + 0 As extérieur (conv `partner-opened-opp-overcalled-03-partner-90h-opp-100s`). V2.1 demande 2 As ext pour 130 (sinon 120 = pièce 3ème + 1 As OU 3 As).

Aaron au questionnaire (R3Q1) : *"je sais pas, peut etre une erreur de ma part"*. À trancher.

### C — Capot en réponse à une ouverture partenaire

Pas de règle déterministe formulée. Aaron au questionnaire (R4Q2) : *"Ça dépend du palier d'ouverture (80 vs 110 vs 120)"*.

À discuter pour potentiellement formuler une règle par palier.

### D — R2-bis : belote +10 au tour qui suit un chiquer ?

Si je chique +10 au 1er tour (R1) et que ma main contient la belote, est-ce que je peux rajouter +10 au tour suivant quand mon tour revient ?

Aaron au questionnaire (cas-limite R2) : *"À valider avec Sacha / Jeje"*.

### E — Belote en ouverture (cas scénario 15)

Aaron a annoncé 140 ♠ sur `validation-scenario-15` avec note *"j'ajoute la belote parce que je suis maître à l'atout"*. Mais R2 dit que belote s'annonce au 2ème tour, pas en ouverture.

Hypothèse : erreur d'annotation, ou cas-limite non couvert par R2. À confirmer.

---

## 3. Vocabulaire à ajouter au glossaire

À intégrer dans le glossaire principal de la Feuille V2 lors du merge :

- **Anti-belote** (cf. R7) : avoir K ou Q de la couleur d'atout du contrat en défense — empêche l'adversaire de poser sa belote.

---

## 4. Notes pour la session de validation collective

Points à aborder lors de la session avec Sacha et Jeje :

1. **R1 : la règle "+10 chiquer / >+10 V2.1 saut" est-elle partagée ?** Particulièrement le saut sans palier intermédiaire (cas-limite résolu Aaron).
2. **Bucket A** : conditions valides du chiquer — convergence ou divergence entre les 3 joueurs ?
3. **Bucket B** : pièce 3ème sur 90 → 120 ou 130 ? Position canonique de Sacha/Jeje.
4. **Bucket C** : capot en réponse — règle par palier ou heuristique seulement ?
5. **R5 (phase signal/estimation)** : est-ce un mental model partagé, ou spécifique à Aaron ?
6. **R7 (anti-belote)** : la définition "K ou Q d'atout" est-elle consensuelle ?

---

## 5. Plan de merge

Étapes pour intégrer ce draft dans `docs/la-feuille-v2.md` après validation :

1. ✅ Session de validation collective avec Sacha + Jeje sur les 7 règles
2. ✅ Discussion bucket A-E pour préciser ou rejeter
3. ⬜ Mise à jour des scénarios training-mode impactés (notamment `partner-opened-opp-overcalled-*` qui passent de rule-silent à value-defined avec R1)
4. ⬜ Ajout des règles déterministes correspondantes dans `botBidding.js`
5. ⬜ Mise à jour des tests `verify.js` (blocs B/R)
6. ⬜ Mise à jour du system prompt Claude V2.2 (`claudeService.js`) avec les règles validées (Mods 18-N additifs aux 14 mods existants — tests de régression Sacha à préserver)

---

## Changelog

- **2026-05-08** — Aaron : extraction initiale des 7 règles depuis les annotations training-mode d'Aaron via un questionnaire interactif structuré (5 rounds, 15 questions). Rédaction de ce draft V2.3.
