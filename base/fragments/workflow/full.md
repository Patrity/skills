## Workflow
- Creative work follows the superpowers cycle: brainstorm → design spec (`docs/superpowers/specs/`) → implementation plan (`docs/superpowers/plans/`) → subagent-driven build with TDD → two-stage review (spec compliance, then code quality). Never skip the review loop.
- Verification before completion: run the tests, typecheck and build and paste the evidence before claiming anything is done. Green typecheck is not proof the UI works.
- Rules carry direction and constraints; skills carry the how-to. When a recurring lesson appears, add a rule or skill instead of a longer CLAUDE.md.

## Testing
- TDD: write the failing test first, watch it fail for the right reason, then implement. A test that never failed proves nothing.
- Every new test is sabotage-proven before commit: break the code line it covers, confirm the test fails, revert.
