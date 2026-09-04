
## Test account (dev only)
- Register a dedicated account in the DEV environment the first time this skill is used and record it here — never a production credential, never in a shared bundle.
- email: TODO · password: TODO · role: TODO
- Login flow: `goto <login-url>` → `snapshot` → `fill <email-ref>` → `fill <password-ref>` → `click <submit-ref>`; then `state-save auth.json` and reuse with `state-load auth.json` within a session. Delete the state file when done.
