# 120 et chique — questions ouvertes (session dédiée + validation Sacha / Jerem)

Notes issues d'une revue manuelle avec Sacha. Le 120 est complexe → session dédiée. Le chique → à valider avec Sacha et Jerem. Ce doc fige les points ouverts pour ne rien perdre.

## État committé actuel (point de départ, commit f892a17)
- **Ouverture 120** = bicolore : maître à l'atout + ≥1 autre atout + cartes réparties dans strictement 2 couleurs.
- Note « barrage de fait » : la seule relance possible est +10 (130), donc ouvrir 120 bloque les enchères.
- **Réponse sur ouverture 120** = « 130 = 3 As seulement » (la pièce d'atout ne compte plus).
- Note ② : « chique à 120 ou 120 annoncé en réponse (pas une ouverture) → compter les plis perdants pour décider si on monte au-dessus de 120 ».

## 120 — à trancher
1. **Condition bicolore.** Garde-t-on « bicolore » obligatoire pour l'ouverture 120, ou on l'enlève ? Si on l'enlève, qu'est-ce qui définit un 120 ?
2. **Réponse à un 120 : « Valet ou 9 second → 130 ».** Est-ce que ça REMPLACE le « 3 As seulement » committé en V2.3, ou ça s'ajoute (« 3 As OU Valet/9 second → 130 ») ? ⚠️ révise la décision V2.3.
3. **Note ② (plis perdants).** Tient-elle, ou le « Valet/9 second → 130 » la remplace pour le contexte réponse ?
4. **Bug mesuré (éco, --no-judge, N=3).** Le bot dévie 3/3 sur le chique-120 : il répond « non formalisé (second tour) » au lieu de compter les plis perdants. Tension entre la note ② et le périmètre/non-formalisé (#5 compétitif, #6 second tour). À résoudre selon 1–3 (soit rendre ② explicitement gagnant sur « non formalisé », soit ② devient caduc).

## Chique — à valider avec Sacha / Jerem
5. **Chique avec la belote.** Quelle règle ? La belote change-t-elle quelque chose au chique ?
6. **Promesse du chique.** Un chique promet-il spécifiquement « un As », ou « un petit quelque chose » (As ext, pièce faible, soutien) ? Impact sur le mapping « ce qui est promis ».
