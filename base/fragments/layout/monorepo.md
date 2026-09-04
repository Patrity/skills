## Constraints that bit before
- App code lives under `{{appDir}}`. Every path-scoped rule glob must use that prefix; a rule whose glob never matches is silently dead (it happened: a glob copied from a single-app repo matched nothing for ten tasks).
