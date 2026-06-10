// V2.2 calibration regression suite — locks down the 14 prompt-engineering
// mods derived from the Sacha audit (docs/sacha-v22-conversations-2026-05-07.md).
// If a mod's guard text drifts or gets removed, one of these assertions fires.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildSystemPrompt } = require('../claudeService.js');
const { computeFeatures } = require('../../game/cardFeatures.js');
const { extractCaptureRules, toRuleCandidates } = require('../personalFeuille.js');

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

  describe('Mod 20 — Citations Feuille (M-D1)', () => {
    it('exige la recopie EXACTE de la ligne, vérifier avant d\'adopter le cadre du joueur', () => {
      const sp = buildVD();
      expect(sp).toMatch(/commence par recopier la ligne EXACTE de la table/);
      expect(sp).toMatch(/L'explication vient APRÈS la citation, jamais à sa place/);
      expect(sp).toMatch(/N'énonce JAMAIS une règle générale qui n'est pas écrite dans la Feuille/);
      expect(sp).toMatch(/VÉRIFIE dans la Feuille avant d'adopter son cadre/);
      expect(sp).toMatch(/tie-break\) n'est PAS formalisé/);
      expect(sp).toMatch(/Ne présente jamais ton raisonnement comme étant la Feuille/);
    });
  });

  describe('Mod 21 — Arithmétique et répartitions (M-D2)', () => {
    it('la FICHE DE MAIN est la source de vérité, énumérer les répartitions', () => {
      const sp = buildVD();
      expect(sp).toMatch(/la FICHE DE MAIN est ta source de vérité/);
      expect(sp).toMatch(/re-dérive depuis la fiche/);
      expect(sp).toMatch(/énumère explicitement les cas \(2-2, 3-1, 4-0\)/);
      expect(sp).toMatch(/un cas oublié = une validation fausse/);
    });
  });

  describe('Mod 22 — Clôture et capture (M-E)', () => {
    it('capture-always toute formulation, ne repose pas une question, une CAPTURE_RULE par règle', () => {
      const sp = buildVD();
      expect(sp).toMatch(/capturer la divergence, pas gagner le débat/);
      expect(sp).toMatch(/TOUTE formulation du joueur du type "je fais X quand Y"/);
      expect(sp).toMatch(/tu DOIS la capturer dans le même message/);
      expect(sp).toMatch(/Maximum 2 relances/);
      expect(sp).toMatch(/Ne repose JAMAIS une question déjà posée/);
      expect(sp).toMatch(/Une seule ligne CAPTURE_RULE par règle/);
      expect(sp).toMatch(/SANS question finale/);
    });
  });

  describe('Mod 23 — Premier message (M-F)', () => {
    it('jamais ouvrir sur "La Feuille ne couvre pas", 3 phrases, ton de table', () => {
      const sp = buildVD();
      expect(sp).toMatch(/ne commence JAMAIS par "La Feuille ne couvre pas ce cas"/);
      expect(sp).toMatch(/Structure en 3 phrases maximum/);
      expect(sp).toMatch(/Ton de table entre joueurs, pas un examen/);
      expect(sp).toMatch(/Tu pars capot avec le maître ♠ complet/);
    });
  });

  describe('Mod 24 — Calibration joueur (M-G)', () => {
    it('injecte le hint Pacha quand username=Pacha (et pas le défaut)', () => {
      const sp = buildVD({ userName: 'Pacha' });
      expect(sp).toMatch(/Style avec ce joueur : ultra-court/);
      expect(sp).toMatch(/questions fermées, zéro paraphrase/);
      expect(sp).not.toMatch(/Style : courtois et concis/);
    });
    it('injecte le hint Faispaschier (technique, lexique du groupe)', () => {
      const sp = buildVD({ userName: 'Faispaschier' });
      expect(sp).toMatch(/Style avec ce joueur : technique et direct/);
      expect(sp).toMatch(/le 34, le 21, la partance/);
    });
    it('injecte le hint AK7 (pédagogue)', () => {
      expect(buildVD({ userName: 'AK7' })).toMatch(/Style avec ce joueur : pédagogue/);
    });
    it('retombe sur le défaut pour un joueur inconnu', () => {
      const sp = buildVD({ userName: 'JoueurInconnu' });
      expect(sp).toMatch(/Style : courtois et concis/);
      expect(sp).not.toMatch(/ultra-court/);
    });
    it('rappelle toujours de reprendre le vocabulaire du joueur', () => {
      expect(buildVD()).toMatch(/Reprends le vocabulaire du joueur/);
    });
  });

  describe('Mod 25 — continuité règles personnelles (C3)', () => {
    it('utilise les règles capturées sans re-demander; ne les met jamais au-dessus de la Feuille', () => {
      const sp = buildVD();
      expect(sp).toMatch(/Tu disposes des règles personnelles déjà capturées de ce joueur/);
      expect(sp).toMatch(/Ta règle capturée/);
      expect(sp).toMatch(/Ne re-capture pas une règle déjà présente, sauf si le joueur la modifie/);
      expect(sp).toMatch(/Les règles personnelles ne remplacent jamais la Feuille/);
    });
  });

  describe('C3 — personal feuille injection', () => {
    const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-perso-'));
    const UID = 'test-user-perso';
    let prevDir;
    beforeAll(() => {
      prevDir = process.env.TRAINING_DATA_DIR;
      process.env.TRAINING_DATA_DIR = SCRATCH;
      fs.mkdirSync(path.join(SCRATCH, UID), { recursive: true });
      fs.writeFileSync(
        path.join(SCRATCH, UID, 'feuille-personnelle.md'),
        '# Feuille perso\n[PROPOSED] Règle test capturée X (origin: s1)\n'
      );
    });
    afterAll(() => {
      if (prevDir === undefined) delete process.env.TRAINING_DATA_DIR;
      else process.env.TRAINING_DATA_DIR = prevDir;
      fs.rmSync(SCRATCH, { recursive: true, force: true });
    });
    it('injecte le bloc RÈGLES PERSONNELLES (en-tête verbatim) quand la feuille a du contenu', () => {
      const sp = buildSystemPrompt({ ...baseArgs, userId: UID });
      expect(sp).toMatch(/RÈGLES PERSONNELLES DU JOUEUR — hypothèses capturées lors de conversations précédentes, statut \[PROPOSED\]/);
      expect(sp).toMatch(/Règle test capturée X/);
    });
    it('omet le bloc quand la feuille est absente/vide', () => {
      const sp = buildSystemPrompt({ ...baseArgs, userId: 'no-such-user-xyz' });
      expect(sp).not.toMatch(/RÈGLES PERSONNELLES DU JOUEUR — hypothèses/);
    });
    it('ordre: RÈGLES DU JEU < LA FEUILLE < RÈGLES PERSONNELLES < FICHE DE MAIN', () => {
      const userHand = [
        { suit: 'S', value: 'A' }, { suit: 'S', value: 'K' }, { suit: 'S', value: 'Q' }, { suit: 'H', value: 'A' },
        { suit: 'H', value: '10' }, { suit: 'D', value: '9' }, { suit: 'C', value: '8' }, { suit: 'C', value: '7' },
      ];
      const sp = buildSystemPrompt({ ...baseArgs, userId: UID, reglesContent: 'REGLES_FACTUELLES_MARKER', userHand });
      const iR = sp.indexOf('RÈGLES DU JEU (référence factuelle');
      const iF = sp.indexOf('LA FEUILLE (référence)');
      const iP = sp.indexOf('RÈGLES PERSONNELLES DU JOUEUR — hypothèses');
      const iH = sp.indexOf('FICHE DE MAIN (calculée');
      expect(iR).toBeGreaterThanOrEqual(0);
      expect(iF).toBeGreaterThan(iR);
      expect(iP).toBeGreaterThan(iF);
      expect(iH).toBeGreaterThan(iP);
    });
  });
});

// Capture pipeline fix — rule_candidates was empty EVERYWHERE despite
// feuille-personnelle.md receiving lines: the handlers discarded the extracted
// rules. toRuleCandidates is the missing transform the handlers now persist.
describe('capture pipeline — rule_candidates population (fix)', () => {
  it('extractCaptureRules + toRuleCandidates produce populated records, strip the visible reply', () => {
    const raw = 'Réponse visible.\nCAPTURE_RULE: Pièce 2nde sur 90 → 110, pas 120.\nCAPTURE_RULE: 80 = au moins 2 As + petit jeu.';
    const { rules, cleanText } = extractCaptureRules(raw);
    expect(rules.length).toBe(2);
    expect(cleanText).not.toMatch(/CAPTURE_RULE/);
    const candidates = toRuleCandidates(rules, { scenarioId: 'exotic-01', capturedAt: '2026-06-09T00:00:00Z' });
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      rule: 'Pièce 2nde sur 90 → 110, pas 120.',
      scenarioId: 'exotic-01',
      capturedAt: '2026-06-09T00:00:00Z',
    });
    expect(candidates.every(c => typeof c.rule === 'string' && c.rule.length > 0)).toBe(true);
  });
  it('no CAPTURE_RULE lines → empty candidates (no false positives)', () => {
    const { rules } = extractCaptureRules('Juste une réponse, aucune règle énoncée.');
    expect(toRuleCandidates(rules, { scenarioId: 'x' })).toEqual([]);
  });
  it('is defensive on non-array input', () => {
    expect(toRuleCandidates(null)).toEqual([]);
    expect(toRuleCandidates(undefined)).toEqual([]);
  });
});
