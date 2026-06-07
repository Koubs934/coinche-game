// V2.2 calibration regression suite — locks down the 14 prompt-engineering
// mods derived from the Sacha audit (docs/sacha-v22-conversations-2026-05-07.md).
// If a mod's guard text drifts or gets removed, one of these assertions fires.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { buildSystemPrompt } = require('../claudeService.js');
const { computeFeatures } = require('../../game/cardFeatures.js');

const baseArgs = {
  feuilleContent: '## stub Feuille V2.1',
  userName: 'Sacha',
  userPastAnnotations: '(none)',
  caseType: 'value-different',
  cardSelection: null,
};
const buildVD = (extra = {}) => buildSystemPrompt({ ...baseArgs, ...extra });
const buildRS = (extra = {}) => buildSystemPrompt({ ...baseArgs, caseType: 'rule-silent', ...extra });

describe('claudeService — V2.2 calibration regression (Sacha audit)', () => {
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
    it('ne mentionne JAMAIS capot = 250 comme valeur correcte', () => {
      const sp = buildVD();
      const matches = sp.match(/[Cc]apot[^.]{0,30}250\s*(points|pts)?/g) || [];
      // Toute occurrence doit être dans un contexte négatif (jamais, pas, ❌)
      for (const m of matches) {
        const idx = sp.indexOf(m);
        const context = sp.slice(Math.max(0, idx - 60), idx + m.length + 60);
        expect(context).toMatch(/jamais|pas|❌/i);
      }
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
    it('inclut le contre-exemple "pas de formule arithmétique"', () => {
      expect(buildRS()).toMatch(/✅.*"C'est quoi ta logique pour arriver/);
    });
  });

  describe('Mod 3 — Capot guard', () => {
    it('marque le capot comme non formalisé', () => {
      expect(buildVD()).toMatch(/[Cc]apot.*pas formalisé|GUARD CAPOT/);
    });
    it('interdit les seuils d\'As pour le capot', () => {
      expect(buildVD()).toMatch(/seuil d'As pour annoncer capot|il en faut 4/);
    });
    it('demande de questionner sur les perdantes', () => {
      expect(buildVD()).toMatch(/perdantes/);
    });
  });

  describe('Mod 4 — 80 = au moins 2 As', () => {
    it('dit "au moins 2 As" pour 80', () => {
      expect(buildVD()).toMatch(/au moins 2\s+As/i);
    });
    it('NE dit jamais "exactement 2 As" comme règle positive', () => {
      const sp = buildVD();
      const exactMatches = sp.match(/exactement\s+2\s+As/gi) || [];
      // Toutes les occurrences doivent être dans des contextes négatifs
      for (const m of exactMatches) {
        const idx = sp.indexOf(m);
        const context = sp.slice(Math.max(0, idx - 100), idx + 100);
        expect(context).toMatch(/JAMAIS|❌|interdit|pas|fabrication/i);
      }
    });
    it('précise que petit jeu est le critère principal', () => {
      expect(buildVD()).toMatch(/petit jeu[\s\S]*?condition[\s\S]*?PRINCIPALE/i);
    });
  });

  describe('Mod 5 — V2.1 lookup table, pas additive', () => {
    it('explique que V2.1 est une lookup table', () => {
      expect(buildVD()).toMatch(/lookup table|pas une formule/i);
    });
    it('donne le contre-exemple "pièce 3ème = 110 de base"', () => {
      expect(buildVD()).toMatch(/pièce 3ème = 110 de base/i);
    });
    it('rappelle que ADC est la SEULE formule additive', () => {
      expect(buildVD()).toMatch(/SEULE formule additive/i);
    });
  });

  describe('Mod 6 — Bicolore strict', () => {
    it('dit "strictement 2 couleurs"', () => {
      expect(buildVD()).toMatch(/strictement\s+2\s+couleurs/i);
    });
    it('mentionne 4+/4+ comme contre-exemple', () => {
      expect(buildVD()).toMatch(/4\+\/4\+/);
    });
    it('liste les distributions valides', () => {
      const sp = buildVD();
      expect(sp).toMatch(/4\+4/);
      expect(sp).toMatch(/5\+3/);
      expect(sp).toMatch(/6\+2/);
      expect(sp).toMatch(/7\+1/);
    });
  });

  describe('Mod 7 — Vocabulaire strict', () => {
    it('définit pisser de manière stricte', () => {
      expect(buildVD()).toMatch(/pisser.*UNIQUEMENT|pisser.*ne peut pas surcouper|UNIQUEMENT.*ne peut pas surcouper/i);
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
    it('précise pièce uniquement à l\'atout du contrat', () => {
      expect(buildVD()).toMatch(/pièce.*UNIQUEMENT.*atout/i);
    });
  });

  describe('Mod 8 — Pré-vérification cellule', () => {
    it('rappelle de relire la cellule avant de citer', () => {
      expect(buildVD()).toMatch(/RELIS la cellule|VÉRIFICATION DE LA CELLULE/i);
    });
    it('mentionne la régression historique de Sacha', () => {
      expect(buildVD()).toMatch(/Sacha.*au moins 2 As|divergence directe/);
    });
    it('distingue "au moins" vs "exactement"', () => {
      expect(buildVD()).toMatch(/au moins.*exactement|exactement.*au moins/);
    });
  });

  describe('Mod 9 — Diversifier questions', () => {
    it('liste des questions ouvertes alternatives', () => {
      expect(buildVD()).toMatch(/sortir du barème|opportunité tactique/i);
    });
    it('marque comme contre-exemple les questions arithmétiques fermées', () => {
      expect(buildVD()).toMatch(/❌.*formule pour arriver|❌.*comptes quoi exactement/);
    });
  });

  describe('Mod 10 — Prioriser critère violé', () => {
    it('explique de prioriser le critère principal', () => {
      expect(buildVD()).toMatch(/PRIORISE LA PRINCIPALE|critère manquant principal/i);
    });
    it('donne l\'exemple du critère petit jeu vs As', () => {
      expect(buildVD()).toMatch(/3 As[\s\S]*?sans petit jeu|petit jeu[\s\S]*?pas le compte d'As/i);
    });
  });

  describe('Mod 11 — Anti-formalisation', () => {
    it('rappelle que Claude n\'est pas un formaliseur', () => {
      expect(buildVD()).toMatch(/n'es PAS un formaliseur|pas un formaliseur de règles/i);
    });
    it('cite Aaron comme consolidateur', () => {
      expect(buildVD()).toMatch(/Aaron/);
    });
    it('liste les phrases interdites', () => {
      const sp = buildVD();
      expect(sp).toMatch(/Phrases interdites/i);
      expect(sp).toMatch(/règle V2\.1.*candidat|règle candidate/i);
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
    it('demande de clarifier l\'argot inconnu', () => {
      expect(buildVD()).toMatch(/antibelote|le 34|le 21/i);
    });
    it('porte le titre RESTE SCEPTIQUE', () => {
      expect(buildVD()).toMatch(/RESTE SCEPTIQUE|NE VALIDE PAS PAR DÉFAUT/i);
    });
  });

  describe('Mod 13 — Précision reformulations', () => {
    it('rappelle maître = exactement 3 cartes', () => {
      expect(buildVD()).toMatch(/exactement J \+ 9 \+ A|3 cartes/i);
    });
    it('rappelle 32 cartes / 8 par couleur dans les opérations arithmétiques', () => {
      expect(buildVD()).toMatch(/32 cartes au\s+total/i);
    });
  });

  describe('Mod 14 — Sélection vs main réelle', () => {
    it('avertit sur sélection incomplète quand cardSelection présent', () => {
      // Build a real features object using cardFeatures so the helpers don't crash
      const features = computeFeatures(
        [
          { value: 'J', suit: 'S' },
          { value: '9', suit: 'S' },
          { value: '7', suit: 'S' },
        ],
        'S'
      );
      const sp = buildVD({ cardSelection: { features } });
      expect(sp).toMatch(/sélection peut être incomplète|sous-représente/i);
    });
    it('ne contient PAS le note Mod 14 quand pas de cardSelection', () => {
      const sp = buildVD({ cardSelection: null });
      expect(sp).not.toMatch(/sous-représente la main/i);
    });
  });

  describe('Préservation de l\'existant (anti-régression)', () => {
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
    it('garde la branche caseType ternaire (rule-silent vs value-different)', () => {
      const rs = buildRS();
      const vd = buildVD();
      expect(rs).not.toBe(vd);
      expect(rs).toMatch(/Feuille V2\.1 ne couvre pas/);
      expect(vd).toMatch(/Pas d'accord/);
    });
  });

  describe('Mod 15 — discipline de contenu (un point, une question, pas de laïus)', () => {
    it('cadre : au plus un point + une question, pas de leçon', () => {
      const sp = buildVD();
      expect(sp).toMatch(/SÉLECTIONNE, NE FAIS PAS LA LEÇON/);
      expect(sp).toMatch(/Traite AU PLUS UN point/);
      expect(sp).toMatch(/Pose AU PLUS UNE question/);
      expect(sp).toMatch(/N'explique pas, ne justifie pas la règle longuement/);
    });
    it('coupe le laïus mais garde la correction obligatoire (pas de terseness qui lâche la correction)', () => {
      const sp = buildVD();
      expect(sp).toMatch(/couper l'explication.{0,4}lâcher la correction/);
      expect(sp).toMatch(/une phrase nette reste OBLIGATOIRE/);
    });
  });

  describe('Mod 17 — protéger le challenge (question pointue, jamais de clôture molle)', () => {
    it('exige une question pointue au retour de main, pas une clôture qui appelle l\'accord', () => {
      const sp = buildVD();
      expect(sp).toMatch(/RENDRE LA MAIN.{0,4}INVITER L'ACCORD/);
      expect(sp).toMatch(/question\s+POINTUE/);
      expect(sp).toMatch(/JAMAIS une clôture\s+molle/);
    });
    it('garde le garde-fou symétrique : ne pas fabriquer de challenge quand l\'utilisateur a raison', () => {
      const sp = buildVD();
      expect(sp).toMatch(/ne fabrique pas d'objection/);
      expect(sp).toMatch(/interdit d'ADOUCIR un challenge\s+mérité, pas d'en inventer/);
    });
  });

  describe('Mod 16 — discipline des noms (pas d\'écho)', () => {
    it('interdit de répéter le nom d\'un autre joueur, même pour décliner', () => {
      const sp = buildVD();
      expect(sp).toMatch(/NE RÉPÈTE PAS ce nom/);
      expect(sp).toMatch(/même pas pour dire que tu ne le/);
    });
  });

  describe('Mod 18 — règle du dix de der (compte de points)', () => {
    it('contient la règle du der, socratique et tightement scopée', () => {
      const sp = buildVD();
      expect(sp).toMatch(/RÈGLE DU DIX DE DER/);
      expect(sp).toMatch(/tient compte du DIX DE DER/);
      expect(sp).toMatch(/le dernier pli, il va\s+à qui si tu perds le 7♥ en dernier/);
      expect(sp).toMatch(/Ne calcule PAS le total exact/);
      expect(sp).toMatch(/QUE sur une justification chiffrée d'annonce/);
    });
  });

  describe('Mod 19 — règle de la belote (validité K+Q)', () => {
    it('contient la règle de validité belote, socratique si douteuse, silencieuse si valide', () => {
      const sp = buildVD();
      expect(sp).toMatch(/RÈGLE DE LA BELOTE \(validité\)/);
      expect(sp).toMatch(/Roi ET la Dame d'atout dans la MÊME main/);
      expect(sp).toMatch(/t'as bien le\s+Roi ET la Dame d'atout, pas juste l'un des deux/);
      expect(sp).toMatch(/tu n'en PARLES que si la belote est\s+DOUTEUSE/);
      expect(sp).toMatch(/Si la belote est VALIDE/);
      expect(sp).toMatch(/n'écris jamais « ça tient »/);
    });
  });
});
