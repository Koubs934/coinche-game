# Curation des feuilles personnelles — guide opérateur

V2.2 Phase 3 — modèle "passive capture + batch curation". Claude capture des règles candidates pendant les conversations ; Aaron les relit en batch.

## Où vivent les fichiers

- **Personnel (per-user, auto-écrit)** : `backend/data/training/<userId>/feuille-personnelle.md`
- **Commune (partagé, écrit à la main)** : `backend/data/training/feuille-commune.md`

En production, ces chemins sont sur le volume Railway monté à `/data/training/`. Pull en local via `railway ssh`.

## Cycle de curation

### 1. Repérer les nouvelles entrées

Toutes les entrées commencent par `[PROPOSED]` — c'est l'état par défaut quand Claude vient de capturer. Format ligne par ligne :

```
[PROPOSED] <règle en une ligne dense> (origin: <scenarioId>)
```

L'`origin` te dit dans quel scénario la règle a été énoncée — utile pour relire la conversation source si nécessaire (`backend/data/training/<userId>/<timestamp>-<scenarioId>.json`, champ `claude_conversation.messages`).

### 2. Trier en relisant

Pour chaque entrée `[PROPOSED]`, choisis :

- **Confirmer** : remplace `[PROPOSED]` par `[VALIDATED]`. Claude la traitera désormais comme autoritative dans les prochaines conversations.
- **Réécrire** : édite la ligne (la formulation de Claude n'est pas toujours optimale). Garde `[PROPOSED]` ou passe à `[VALIDATED]` selon ta confiance.
- **Supprimer** : si la règle est fausse, redondante avec La Feuille V2.1, ou trop spécifique pour être généralisable, supprime la ligne.

### 3. Promouvoir vers la feuille commune (optionnel)

Si tu vois la même règle émerger sur **plusieurs** feuilles personnelles et qu'elle est suffisamment générale, copie-la dans `backend/data/training/feuille-commune.md` avec le statut `[VALIDATED]`. La feuille commune est partagée entre tous les utilisateurs et sert de couche de consensus.

Format suggéré pour `feuille-commune.md` :

```markdown
# Feuille commune — règles validées par Aaron

> Consolidée à partir des feuilles personnelles. Toutes les entrées sont [VALIDATED] par construction.

---

## Règles

[VALIDATED] règle 1 — ...
[VALIDATED] règle 2 — ...
```

## Pas de redéploiement

Les deux feuilles sont relues par le backend à **chaque appel API** (pas de cache). Une fois ton édit sauvegardé, le prochain tour de conversation (n'importe quel utilisateur) la voit.

## Anti-patterns

- ❌ N'édite **jamais** une entrée pendant qu'une conversation active est en cours pour le même utilisateur — tu risques de réinjecter du contenu modifié au milieu d'un échange.
- ❌ Ne supprime **jamais** la feuille personnelle entière — l'historique des hypothèses est utile pour mesurer la qualité de capture sur la durée. Préfère vider la section `## Règles` et garder le header.
- ❌ Ne mets **jamais** de `[VALIDATED]` sans avoir relu la conversation source au moins une fois (le champ `(origin: <scenarioId>)` te dit où chercher). Claude se trompe parfois sur ce qui est "principe vs description ad hoc".

## Vérification rapide

Pour parser un fichier feuille en ligne de commande (utile en debug) :

```js
const pf = require('./backend/src/services/personalFeuille');
const content = pf.loadPersonalFeuille('<userId>');
console.log(pf.parseFeuilleEntries(content));
```

Sortie : `[{status: 'PROPOSED'|'VALIDATED', rule: '...', origin: '...'}]`. Ignore les lignes mal formées silencieusement — pratique pour vérifier qu'un édit manuel n'a pas cassé le format.
