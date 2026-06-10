# Règles du jeu — référence factuelle

> Couche de référence **factuelle** (faits du jeu : ordre des cartes, points, obligations de pli).
> Elle n'est **PAS** la convention d'annonce — l'autorité sur les annonces reste **La Feuille**.
> En cas de conflit sur une annonce, La Feuille prime ; ce document ne sert qu'aux faits du jeu.

## Ordre et points des cartes
- À l'ATOUT: V(20) > 9(14) > A(11) > 10(10) > R(4) > D(3) > 8(0) > 7(0). Le Valet d'atout est la carte la plus forte du jeu, puis le 9 d'atout.
- HORS atout: A(11) > 10(10) > R(4) > D(3) > V(2) > 9(0) > 8(0) > 7(0).
- Total d'une donne: 152 points de cartes + 10 de der (dernier pli) = 162. Belote (R+D d'atout chez un même joueur) = +20 → 182 max pour le camp qui la détient.

## Annonces et points
- Une annonce est un contrat en POINTS DE CARTES (paliers de 10, 80 à 160, puis capot). Pour annoncer: compter ses perdantes EN POINTS et déduire de 162 (ou 182 avec belote). Exemple validé: pire cas -15 points → 147 + 20 de belote = 167 → annonce 160.
- Capot = faire TOUS les plis. À la marque le capot vaut 500, mais le 500 ne sert PAS au calcul d'annonce — on raisonne en plis/points de cartes.
- Coinche/surcoinche: la coinche DOUBLE (×2), la surcoinche QUADRUPLE (×4) la valeur du contrat dans le calcul. Contrat coinché RÉUSSI = score à plat « tout au gagnant » : valeur×multiplicateur + 160 (+20 si l'équipe du contrat tient la belote) ; les défenseurs marquent 0. Contrat CHUTÉ = l'équipe qui défend marque 160 + valeur×multiplicateur, l'équipe du contrat marque 0 (s'applique aussi sans coinche, multiplicateur = 1). (source: implémentation du jeu — game/scoring.js:16, 53-75)

## Déroulement d'un pli (obligations)
- Fournir la couleur demandée si possible. À l'atout: obligation de monter (surcouper) si possible.
- Sans la couleur demandée: obligation de couper (jouer atout) si on en a ET qu'un ADVERSAIRE est maître du pli. EXCEPTION confirmée: si le PARTENAIRE est déjà maître du pli, on est libre de jouer n'importe quoi — pas d'obligation de couper. Si un adversaire a déjà coupé, il faut SURCOUPER (monter à l'atout) si on peut ; sinon, libre de jouer n'importe quoi. (source: implémentation du jeu — game/rules.js:61-73)
- Se défausser (jouer une carte d'une autre couleur, non-atout): légal quand on est sans la couleur demandée ET soit on n'a aucun atout, soit le partenaire est déjà maître du pli (défausse VOLONTAIRE possible même en tenant des atouts), soit un adversaire a coupé et on ne peut pas surcouper. (source: implémentation du jeu — game/rules.js:59-73)
- Pisser (à l'atout): jouer un petit atout faible quand on ne peut pas surcouper — à NE PAS confondre avec se défausser (qui est jouer une autre couleur). À une entame atout on doit fournir un atout ; si on ne peut pas monter, on « pisse » le plus petit. (source: implémentation du jeu — game/rules.js:42-50)
- La partance = l'entame du premier pli (et par extension, avoir la main).

## Lexique du groupe
- le 34 = Valet + 9 d'atout (20+14 = 34 points), les deux maîtres.
- le 21 = As + 10 d'une même couleur (11+10).
- la belote = R+D d'atout; l'antibelote = tenir le R OU la D d'atout, ce qui rend la belote adverse impossible.
- pièce = Valet ou 9 d'atout; "pièce Nème" = la pièce + N atouts au total (seuils "au moins").
- capot servi = capot réalisable seul, sans aucun pli du partenaire.
- fausse annonce = annonce qui ne respecte pas la promesse de la convention.
- la repart = la répartition des cartes restantes.
- plis maîtres / longue maître = cartes qui gagnent leur pli une fois les atouts tombés.
- "parler dans ses As" = annoncer une couleur où on détient un As (à éviter selon certains joueurs: on préfère une couleur neutre).
- maître à l'atout = V+9+A d'atout (la Feuille fixe les conditions exactes par annonce).
