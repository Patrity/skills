## Constraints that bit before
- `ssh` flattens its arguments into one string, so a nested `ssh <host> pct exec <ctid> -- bash -lc '…'` silently runs on the wrong machine (or runs only its first word). Quote the whole remote command, base64 anything with nested quotes or SQL, and verify with `hostname` when a result surprises you — the `remote-ops` skill has the working forms.
