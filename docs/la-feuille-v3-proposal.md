# La Feuille V3 — Proposition de ratification

> **Statut : PROPOSITION (draft).** Ne remplace pas `la-feuille-v2.md`, **pas lu par le bot**.
> **Embargo :** ne pas montrer à Sacha ni Jerem avant leurs passes à l'aveugle sur les 24 scènes.
> Mise à jour 2026-08 : consolidation de l'analyse du corpus complet (1 424 parties, 3 726 annonces — voir Annexe A). Les positions « ferme (Aaron) » et les chiffres corpus sont pré-enregistrés pour accélérer la session.

## 0. Déjà acté (écrit en V2 courante)
- Maître à l'atout = V + 9 + As, avec au moins 4 atouts (commit 36f3222).
- Suppression du draft `la-feuille-v2.3-draft.md`.
- **Portée des tables de réponse = même couleur que le partenaire** ; changement de couleur sur 80 = table distincte (écrit le 2026-06-10, à ratifier en session).

## 1. Correction gelée — à dégeler en session
- Réponse sur ouverture 120 bicolore : « 130 | 3 As » devient « 130 | 3 As **OU la pièce** ».

## 2. Ouvertures — candidates (corpus : 1 424 ouvertures)
La Feuille décrit très bien le 80 (**625/694 conformes, 90%**) et mal le 90 (**236/497, 47%**).
### 2.1 Domination d'atout → 90 sans As extérieur — *ferme (Aaron), massif au corpus*
**143 cas** d'ouvertures 90 sur des mains où la Feuille dit pass. Scènes B1/B2, sondes P1-P3 pour la frontière.
### 2.2 La priorité 80>90 saute sur atout fort — *107 cas*
90 ouverts là où la Feuille prescrit 80. Scène C1 (capot réel 500/0). Niveau exact (90 vs 100) à caler — cf. le « maître fonctionnel » (V+9 sans l'As = contrôle équivalent, l'As adverse tombe sous le 9).
### 2.3 Seuil des mains à base de 9
Le 9 reste une pièce (ruling Aaron). Sonde P4 cale le plancher des mains faibles.
### 2.4 As sans pièce — **contesté** (Jerem ouvre, Aaron passe). A1/A2 + Sacha trancheront.
### 2.5 Ouvertures directes hautes — *à cartographier*
Le corpus contient 59 ouvertures directes à 120-140 et la moitié des ouvertures 100/110 divergent du barème maître. Question : formaliser un barème d'ouverture au-dessus de 110 ?

## 3. Réponses même couleur — candidates (corpus : 123 pures sur-80, 155 sur-90)
### 3.1 Compter les As **extérieurs**, pas totaux — *validé tous joueurs*
Sur-90 : **72% vs 61%** (n=155). Sur-80 : 59% vs 52%. Jerem : 43/52 sur-90, 27/30 sur-80.
### 3.2 Le « sans pièce » de la ligne 100 : un 9 sec ne doit pas bloquer
3 occurrences systématiques (9 sec + 1 As → 100). Scène RC1.
### 3.3 Échelle sur-80 : **dissoute par la lecture même-couleur** (Jerem 27/30 = la table écrite est bonne). Reste le micro-cas du « 34 » : J+9 second → 100 au lieu de 90 (2 cas).
### 3.4 ~~9 sans Valet ne porte pas~~ — **RETIRÉ** (ruling Aaron 2026-06-10).
### 3.5 Sur-90 : +10 par As au-dessus des lignes pièce — *nouveau, 4 cas*
Pièce 2nde/3ème + 1 As → 130 annoncé (table : 120). L'échelle pratiquée empile +10/As extérieur sur les lignes pièce.
### 3.6 Question : les As extérieurs valent-ils aussi sur-80 ? (1 cas : J + As d'atout seul → 90, pas 100.)

## 4. Table « changement de couleur sur 80 » — pré-remplie (corpus : 182 cas, tous joueurs)
| Réponse | Condition (empirique) | Cas |
|---|---|---|
| 90 | pièce (V ou 9) + soutien — **les As ne changent rien** | 138 (dont 104 pièce simple) |
| 100 | V + 9 ensemble (« le 34 ») | 22 |
| 110-130 | V+9 + longueur (5+) ou 2 As (« bombe ») | 10 |

Hypothèse structurelle : la table est **relative au palier** — pièce+soutien = palier minimum, V+9 = +10, bombe = saut. Les 8 changements sur-90 du corpus suivent exactement la logique décalée (pièce+soutien → 100). Une seule règle pour tous les étages, si Sacha + les sondes Q confirment.
Ancrages : Aaron QA (Valet 4ème + 2 As promis → 90 « exploration ») ; satellites (« on repart de zéro avec les infos de l'ouverture », « fit trouvé > couleur plus forte, sauf bombe »).

## 5. Capot — doctrine chiffrée (corpus : 48 annoncés, 107 faits non annoncés)
Scoring vérifié (`scoring.js`) : **symétrique 500/500** — chuté = 500 à la défense (pas 160+500) ; capot fait non annoncé = **zéro bonus**.
Conséquence : annoncer n'est rentable qu'à **~75-80% de certitude** (l'alternative 140-150 vaut ~+270-310 quasi sûrs).
Corpus : 56% de conversion (Jerem 10/16, Reb's 6/10, Sacha 3/5, **Aaron 3/11**). Les 107 capots faits sans annonce sont donc majoritairement des **décisions correctes** à confiance moyenne — pas un gisement raté.
Mécanisme réel : **le capot est un fait de paire** — 44/48 annoncés sur une annonce partenaire ; partenaire ≥130 → 67% vs 53%. Le « capot servi » autosuffisant est rare (3 cas, dont 1 chuté sur atout trop court : la doctrine doit inclure la **longueur**).
**Doctrine à ratifier** (Sacha, amendée) : « Le capot s'annonce à zéro perdante visible, promesses du partenaire comprises — jamais sur l'espoir. En dessous de cette certitude, s'arrêter à 140-150 : le contrat plein vaut plus que le pari. »

## 6. Le chique — la convention manquante (corpus : 1 226 annonces, 1/3 du total)
Deux règles **déjà unanimes** (à écrire comme descriptives) :
- Le chique monte de **+10 exactement** (1 226/1 226).
- Le chique **change de couleur** (1 225/1 226) — « je prends la main dans MA couleur ».
Rendement : 51-58% de tenue partout (vs 76-81% conventionnel) ; main moyenne 48/152 pts → annonce d'**obstruction**, pas de force. Mais l'obstruction paye : camp preneur → issue favorable 58% ; adversaire laissé preneur → 39%.
Discriminant fort : **V+9 + 4 atouts → 75%**, + 5 atouts → 88% ; V+9 à 2 atouts → 42% ; pièce seule → 49-56%.
**Règle prescriptive candidate** : « Chiquer haut sur V+9 avec 4 atouts minimum ; en dessous, le chique est un pari d'obstruction assumé. »

## 7. Hauts paliers — la frontière conventionnelle
Taux de tenue par palier (contrats portés) : 80→81%, 90→79%, 100→76%, 110→73%, 120→76%, **130→63%**, 140→63%, 150→57%, capot 56%.
Le 130 est le **seuil de rentabilité exact** (chuter coûte 290 pour ~292 de gain). **La frontière conventionnelle réelle du groupe est 120.**
Le 140 en réponse : 4/15 conformes à « pièce 3ème + 2 As » — la pratique unanime = **2 As posés sur un partenaire déjà haut, tenue d'atout indifférente**. Question : réécrire la ligne ?
150/160 = zone de guerre (chiques), hors convention. Force de main **plate** de 90 à 140 (48-51 pts) : au-dessus de 90, le niveau mesure la position d'enchère, pas la main.
Coût des chutes sur le corpus : **108 530 pts offerts** ; les manches 130+/capot coûtent 3-4× plus par manche que le socle.

## 8. Coinche / surcoinche
Coinche ×2 : 128 manches, le coincheur a raison **62%** — bien joué, à tous les niveaux (y compris 80/90).
Surcoinche ×4 : 12 manches, le surcoincheur a **tort 67%** du temps. Question : décourager la surcoinche par défaut ?

## 9. Questions ouvertes de session
1. (À l'aveugle, avant toute lecture) « Pour toi, les tables de réponse s'appliquent-elles quand on change de couleur ? »
2. Le **21** (10 derrière l'As) vaut-il +10 ?
3. Niveau d'ouverture sur atout dominant : 90 ou 100 (cf. 2.2, maître fonctionnel) ?
4. Le 140 en réponse : réécrire en « 2 As sur partenaire haut » ?
5. As extérieurs sur-80 aussi (3.6) ? Le « 34 » même-couleur → 100 (3.3) ? L'échelle +10/As sur-90 (3.5) ?
6. Chique : ratifier la règle V+9 + 4 atouts ?
7. Surcoinche : doctrine ?
8. Ouvertures directes >110 : cartographier (2.5) ?

## 10. Résultats des passes (à remplir après collecte)
| Scène | Feuille | Aaron | Sacha | Jerem | Verdict |
|---|---|---|---|---|---|
| *(24 lignes après les trois passes)* | | | | | |

## 11. Process
Trois passes à l'aveugle → section 10 remplie → V3 finale → ratification Sacha + Jerem → fold dans `la-feuille-v2.md` (label V3) → alignement `botBidding.js` → flip `TRAINING_ONLY_ZG = false` → dégel réponse-120.

## Annexe A — Corpus & identités (couche d'analyse, jamais appliquée aux données brutes)
Extraction 2026-08-20 : 1 424 parties, 3 726 annonces, issues complètes. Bots (113) et doublons resave exclus.
Identités : **Jerem = Pacha + AK Test + Jejemoumou06** (865 annonces) ; **exclusion** : AK Test des 5 et 15 juin (Aaron au 2ème téléphone, 14 lignes) ; **Delfino = Dolphy + stephane.delfino** ; **Djez = Jérémy Ecaillet, PAS Jerem** ; Reb's = joueur à part entière, **voix consultative** (pas de poids de ratification).
Contrats portés au bout, par joueur : Gilbus 88/108 (81%), Rod 112/146 (77%), Jerem 239/323 (74%), Aaron 212/286 (74%), Le luds 42/57, Delfino 43/58, Reb's 174/240 (72%), **Sacha 86/139 (62%)**.
Divers : belote dans 29% des manches, rebelote 419/419 ; couleurs équivalentes (70-77%) ; 19% des manches non contestées ; le siège en face du donneur prend et tient moins (21%, 66%).
