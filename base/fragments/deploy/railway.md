## Deploy
- Railway runs a persistent process: in-process state (SSE fan-out, caches, schedulers) only works with `numReplicas: 1`; say so in the config and the wiki before scaling.
- Deploys follow the production branch; run migrations from CI, not from a laptop.
