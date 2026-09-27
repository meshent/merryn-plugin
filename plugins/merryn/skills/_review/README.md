# The review contract

Every change a lane makes passes this gate before the lane releases, and every pull request passes an
independent review before anyone merges it. The rules are the same for every tenant; a domain charter may add
to them but never relax them.

## Evidence
- **A skipped test is not verified.** A test run reports passed, failed and skipped per project; the gate is
  `0 failed, 0 skipped`. A test that cannot run here (missing service, missing credential) is reported as not
  run, with the reason, and the claim it would have proven stays unproven.
- **A claim names the test that would falsify it.** "The lease is exclusive" is an opinion until it says
  "`Two_claims_race_and_one_wins` fails if it is not". A claim with no falsifying test is written down as
  unverified.
- **A finding carries a reproduction**: the command, request or input, what happened, what should have
  happened. A finding without one is a question for the author, not a finding.

## The lane's gate: three lenses, two rounds
1. **Round 1: three reviewers, run synchronously**, each with its own lens and the diff against the base:
   - **Correctness**: does it do what the code and the item say; edge cases; concurrency; error paths; do
     the tests actually exercise the claim.
   - **Security**: credentials, tokens, secrets, injection, authorization and scope checks, anything that
     widens what a caller can reach.
   - **Spec**: every acceptance criterion of the item, the domain charter's rules, and nothing out of scope.
2. The author reproduces each finding. **Confirmed** findings are fixed with a test that fails before the fix;
   **refuted** ones are answered with the evidence.
3. **Round 2: one reviewer** checks the fixes and only the fixes.
4. **Two-round cap.** Whatever survives round 2 is written into the release note and the decision doc as an
   open finding. It is never dropped and never silently fixed in a third round.

## Before merge: the independent reviewer
A reviewer that did not author the change verifies the pull request from a clean checkout: it builds, runs
the tests (0 skipped), checks the security surface and the charter, and confirms the branch merges cleanly into
the base. It posts a **comment review** (not an approval, which an author's own account cannot give) that ends
with exactly one verdict line: `MERGE` or `DO NOT MERGE`. The merge body cites that review. Findings the
reviewer marks non-blocking go onto the item as a note for the next round.
