---
name: landing
description: "Fan-out landing: a fresh, independent sibling session lands one handed-off Merryn item. Usage /merryn:landing <key> --repo <owner/name> --branch <lane branch> --base <base> --session <label> [--server <mcp-name>] [--project <id>]. Claims it, builds a conflict-free merge preview, runs the full tests with 0 skipped, opens the PR, gets an independent comment review ending MERGE or DO NOT MERGE, runs at most two fix rounds and releases blocked awaiting merge with the structured landing. Never merges."
---

You are a **landing** session: fresh and independent of the lane that wrote the work. After a lane releases
`handoff`, the fan-out coordinator spawns you with a few lines naming this skill and its inputs. You open the PR,
review it independently, run the fix rounds and leave the item awaiting the coordinator's merge. The coordinator only
reads your structured verdict and merges; **you never merge**.

## Inputs
From the spawn prompt (a missing one: stop with a one-line final message naming it):
**KEY**, **REPO** (owner/name), **BRANCH** (the lane's), **BASE** (what the charter's branch model names: `release`
where a release train publishes, else the default branch), **LABEL** (your session label), and **EXTERNAL** (your
harness's session id, when known) passed as `externalSession` on `check_in` and `claim`.

## Steps
1. **Bind and toolchain** as `${CLAUDE_PLUGIN_ROOT}/skills/lane/SKILL.md` steps 1 and 2 say.
2. **Lease.** The coordinator claims KEY under LABEL before spawning you. `get_item {key:KEY,
   fields:["status","lease","blockedReason","resumeFrom"], events:0}`:
   - a live lease whose session is LABEL is yours: carry on (`heartbeat` it now);
   - a live lease under any other session: final message `HELD` and stop;
   - no live lease (the coordinator could not claim first): `claim {key:KEY, session:LABEL,
     externalSession:EXTERNAL}`; `lease-held` means someone else took it: `HELD`, stop.
   Heartbeat LABEL every 15 minutes until you release.
3. **Verify.** Fetch BRANCH and BASE and check they share history (`git merge-base`). Build the merge preview in its
   own worktree: BASE + BRANCH, conflict-free; on a conflict, stop and `release {key:KEY, session:LABEL, outcome:"blocked",
   blockedReason:"merge conflict with BASE: <files>", note}` (resumeFrom stays as the lane left it; a blocked item
   is never pulled, and the coordinator sends it to a lane or the owner, not to another landing). Full build (warnings
   as the charter says) and the full test suites, `0 skipped`. Grep the diff for what the charter forbids: floating
   versions, `Version*`/`PackageVersion` edits, credentials, tenant or person names in a platform core package.
4. **PR.** `open_change {repo:REPO, head:BRANCH, base:BASE, title, body, items:[KEY]}` (falls back to the git host's
   own tool, then `record_change`). The body: what landed, test counts, review findings, decisions for veto.
5. **Independent review.** One reviewer subagent with a verification brief (build, tests, security surface, charter,
   merge-tree against BASE, and re-running the lane's fail-first table, not just reading it). It posts a **comment**
   review on the PR ending `MERGE` or `DO NOT MERGE` (never a formal approval).
6. **Fix rounds** on `DO NOT MERGE` with fixable findings: fix on BRANCH under your lease (no new claim), re-run the
   tests, review again. **Two-round cap**; findings that survive go in the PR body and the item note.
7. **Hand to the coordinator.** Read the PR's head SHA and BASE's SHA as reviewed, then
   `release {key:KEY, session:LABEL, outcome:"blocked", blockedReason:"awaiting merge of <PR URL>",
   landing:{prUrl, headSha, baseSha, verdict:"MERGE"|"DO_NOT_MERGE", reviewUrl, tests:{passed, failed, skipped}},
   note:"<non-blocking findings, residuals>"}`. An instance that refuses `landing` (an older one): put
   `VERDICT=<MERGE|DO NOT MERGE> review=<url> head=<sha> base=<sha> tests=<p/f/s>` at the start of the note instead.
   **Never** merge, push BASE or the default branch, or dispatch a workflow.
8. **Final message**, at most 15 lines: PR URL, head SHA, verdict, test counts, findings.

## Invariants
As the merryn skill's *Invariants*: fan-out changes only where the work runs, never the lease, the desk's escalation
rules, the review gate or the rules on branches, versions, workflows and credentials.
