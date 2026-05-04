# Archive — Training mode v2 vocabulary

These files are kept for historical reference. They drove the structured-tag
annotation flow that was removed in May 2026 when training mode pivoted to a
divergence-driven design (see `docs/training-divergence-flow.md`).

The 18 schemaVersion 2 annotations on disk under
`backend/data/training/<userId>/` reference these tag keys. They remain
loadable by `scripts/build-training-snapshot.js` under its "Legacy v2"
section. New annotations no longer carry tags.

- `reasonTags.json` — final v2 vocabulary (`tagsSchemaVersion: 2`, with
  bidding-action requireExactlyOne and trump-hand recommendAtLeastOne)
- `reasonTags.v1.json` — pre-v2 vocabulary, kept for completeness
