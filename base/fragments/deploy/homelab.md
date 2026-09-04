## Deploy
- Homelab (Proxmox + Docker), internet-exposed through a tunnel. Prod ops go through the host with `pct exec`; the `remote-ops` skill covers the nested-quoting trap that has silently run commands on the wrong machine before.
- Never paste hostnames, IPs or credentials into skills or rules that could be published; keep them in the gitignored project notes.
