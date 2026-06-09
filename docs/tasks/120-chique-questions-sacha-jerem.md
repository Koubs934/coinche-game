# 120 et chique — questions ouvertes + tranchées (ratification via les scènes 120)

Notes issues de revues avec Sacha + de ses entraînements (annotations + transcripts). Sacha a déjà tranché plusieurs points ; ils restent à ratifier formellement par Sacha ET Jerem via la section « 120 » des entraînements (commit ac2b56f). Une fois récoltés, on corrige `la-feuille-v2.md`. Ce doc fige l'état pour ne rien perdre.

## ⚠️ Premise corrigée
La version committée de la Feuille (et le code des bots) décrit l'ouverture 120 comme « maître à l'atout + bicolore ». **Sacha a tranché que le 120 n'exige PAS le maître à l'atout.** `la-feuille-v2.md` garde encore l'ancien cadrage (maître, et « 130 = 3 As seulement ») — à corriger à la ratification, pas avant.

## Tranché par Sacha (à ratifier via les scènes, puis reporter dans la Feuille)
1. **120 ≠ maître.** Confirmé par ses 120 en compétitif :
   - conv 10 : partenaire 100♠, adv 110♥ → Sacha bid **120 ♠** avec seulement belote ♠ + 10♠ (ni pièce ni As).
   - conv 11 : partenaire 90♥, adv 100♠ → **120 ♥** avec pièce 3ème + As d'atout (pas de maître complet).
2. **Réponse à un 120 = « 3 As OU la pièce → 130 ».** ⚠️ Contredit le V2.3 committé (« 130 = 3 As seulement », commit 5c3dc8c). Évidences Sacha :
   - annotation `response-120-02`, note verbatim : « Ouverture de mon partenaire 2 réponse possible / 3 as extérieur +10 / La pièce +10 ».
   - note de la revue (screenshot) : « Valet ou 9 second → 130 ».
   - cohérent avec `response-120-01` (3 As → 130) et `response-120-03` (2 As sans pièce → pass).
   - Logique : 120 ≠ maître → le partenaire n'a pas forcément la pièce → en réponse on PEUT l'avoir → « la pièce → 130 » s'applique bien en réponse à une ouverture 120.
3. **« Bicolore » = strictement 2 couleurs** (5+3, 6+2, 4+4, 7+1) — **PAS** « une longue couleur secondaire » (la curated doc flag explicitement cette confusion).
4. **Cas limite capot** : conv 13 — avec un vrai maître + longue extérieure, Sacha a monté **capot**, pas 120. À préciser avec lui.

## 120 — encore à trancher
1. **Définition positive de l'ouverture 120.** Si ce n'est pas le maître, c'est quoi ? (Bicolore + combien d'atout / quelle force ?) → scènes `opening-120-no-maitre-bicolore`, `opening-120-three-suits-not-bicolore`, `opening-120-maitre-or-capot`.
2. **Note ② (plis perdants).** En réponse / chique 120, monte-t-on au-dessus en comptant les plis perdants ? → scènes `facing-120-go-above-plis`, `chique-120-support-no-maitre`.
3. **Bug mesuré (éco, --no-judge, N=3).** Le bot dévie 3/3 sur le chique-120 (« non formalisé / second tour » au lieu de compter les plis perdants). À résoudre selon la décision ci-dessus.

## Chique — questions ouvertes (Sacha / Jerem)
1. **Chique avec la belote.** Quelle règle ? La belote change-t-elle quelque chose ?
2. **Promesse du chique.** Un As précis, ou « un petit quelque chose » (As ext, pièce faible, soutien) ?

## Mécanisme de ratification
La section « 120 » des entraînements (commit ac2b56f) = 8 scènes (3 réponse, 3 ouverture, 2 chique/face-à-120), la plupart **rule-silent** pour capturer le raisonnement de Sacha et Jerem sans imposer la Feuille actuelle. Workflow : Sacha **et** Jerem répondent indépendamment → on compare → on ratifie → on corrige `la-feuille-v2.md` (réponse-120 « 3 As OU la pièce » + définition d'ouverture 120 sans maître + condition bicolore).

## À aligner plus tard (code)
`backend/src/game/botBidding.js` exige le maître pour ouvrir 120 (`isMaster = J+9+A`) → les bots **sous-bident** le 120 vs la convention de Sacha. À corriger une fois la définition ratifiée.
