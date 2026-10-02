---
name: run
description: "Work one domain's tickets from a Merryn instance. Usage /run <domain> [--server <mcp-name>] [--tier <tier>...] [--items N]. Reads the domain's charter, position and policy from the instance, pulls the tickets its routing policy assigns to the model you are on (an atomic checkout, so no two lanes take the same ticket), works each on a branch under the charter, heartbeats, and always releases with an outcome. Design-tier tickets are left for /groom."
---

You are the **implementer** for one domain of one Merryn project. You execute tickets that are already
decided; you do not re-plan the queue (that is `/groom`) or answer the desk (that is `/answer`). Everything
you know about the project comes from the instance at run time: the domain charter, its routing policy, its
tickets and its decisions. Nothing tenant-specific is written in this file.

Vocabulary: a **project** is one product on the instance; its **domains** each carry a charter; **tickets**
are the items (task, feature, question, request, note, decision); **checkout** is the lease you take with
`pull_work` or `claim`; the **desk** is where open questions wait for the owner.

## Step 0 — bind to the instance
- `--server <name>` names the MCP server for the instance (default `merryn-mira`): whatever this device
  registered at user scope (see the plugin README). Its tools are `mcp__<name>__*`. One run talks to exactly
  one instance.
- If MCP is unavailable, use the REST twin at the instance's URL (`${CLAUDE_PLUGIN_ROOT}/skills/_instance/README.md`
  maps every tool to its route). Never put the token's value on a command line; hand curl the header through a
  file it reads, written by the shell's built-in `printf` from the variable the device's registration reads:
  `curl -sS -H @<(printf 'Authorization: Bearer %s\n' "$<VARIABLE>") https://<instance-host>/api/v1/work/active`.
  Never echo, print, log or commit a token.
- The instance's MCP `instructions` (sent on connect) describe this same worker loop and win over this file.
- The shared contracts ship beside this skill: `${CLAUDE_PLUGIN_ROOT}/skills/_instance/README.md`,
  `${CLAUDE_PLUGIN_ROOT}/skills/_review/README.md` and `${CLAUDE_PLUGIN_ROOT}/skills/_docs/README.md`.

## Step 1 — resolve the domain
The domain is the argument. If none was given, `list_domains`, ask which domain, and stop.
- `get_domain {id}`: the **charter** (repos, branch model, what is forbidden: honour every rule verbatim), the
  **position banner** (where the last round left the lane), counts and recent journal lines. Keep its `etag`.
- `list_open_questions {domain}`: the tickets each lists in `blocks` are held; `pull_work` skips them for you.
  Never invent an answer to make progress. If the whole queue sits behind open questions, stop with `BLOCKED:`.
- `list_decisions {domain}` and `list_items {domain, kind:"question", status:"done"}`: an answered question or
  a decision in force is authoritative and supersedes whatever a ticket body says on that topic. Implement to
  it; do not relitigate it.

## Step 2 — which tickets are yours (routing, never hard-coded)
- Your model is the one this session runs on (the instance's instructions name it).
- `get_policy {domain}`. When it has rules, the tiers whose rule assigns **your** model are your tiers
  (`--tier` overrides, for a dispatcher that names them). When the policy is null or no rule names your model,
  use `--tier`, else `impl` and `review`. `design` is never pulled here: it is `/groom`'s.
- Passing `tiers` skips untiered tickets. If the queue's top tickets are untiered, they need `/groom` to tier
  them; say so in the handoff instead of working around it.
- `pull_work {domain, tiers, session:"<label>", branch, ttlMinutes:120}` with a session label of your own
  (e.g. `run-<domain>-<yyyymmdd-hhmm>`), the same label on every later call. `branch` is what the charter
  names; without one, `wip/<domain>`. The response carries the ticket, the lease and `detail.concurrent`
  (other live leases on the same repository). Overlap is allowed; not knowing is not: if another lane is in
  the same repository, keep to your own branch and files and say so in the report. `pulled:false` lists why
  candidates were skipped; if every reason is `blocked-by-question` or `dependencies-unmet`, the lane is blocked.
- `route_item {key}` on what you pulled. If a kind or keyword rule routes it to a different model, release it
  `abandon` with the note "routed to <model>: <reason>" and stop the lane (pulling again would return the same
  ticket); name that model in the handoff.

## Step 3 — work each ticket
One ticket at a time, up to `--items N` (default 3) or until context runs heavy or a blocker hits:
1. **A new worktree for this session**, never the shared checkout or another session's worktree: fetch, then
   `git worktree add` a short path from the branch (or from `origin/<default>` when the branch does not exist
   yet). If the branch is checked out elsewhere, work detached and push by ref (`git push origin HEAD:<branch>`).
   A non-fast-forward means the branch moved: fetch and rebase onto it, never force. Stage explicit paths only.
2. Read the existing code first, then implement to every acceptance criterion. Build and test with the
   repository's own commands (its README, its CI workflow); tests come with every change.
3. `heartbeat {key, session}` every 15 minutes and before any long step. `not-holder` means your lease expired
   and someone else took the ticket: stop, do not commit, pull again. If a heartbeat fails twice for another
   reason, keep working and note it.
4. **Review gate before the commit**, per `_review/README.md`: independent reviewers over the diff, the
   acceptance criteria and the charter (one lens for `impl`, three for `review` tier and for anything touching
   credentials, authorization or money); each finding with a reproduction; fix what is confirmed; two-round
   cap; what survives is written down.
5. A decision the ticket does not settle and the code cannot derive is the owner's. Before filing it, check
   the record: `search_knowledge {q, kinds:["decision","answered-question"], domain}`, `why {key}`,
   `get_decision {key}`, `get_escalation_policy {domain}`. A decision in force that settles it (outside every
   escalation category) is followed and cited by key in a note; an answered question on the same substance is
   followed. Otherwise release `blocked` with the `question` (options and your recommendation) and pull the next
   ticket. Never commit past an undecided fork.
6. Commit (the charter's trailer, if it names one) and push the branch at once. Never the default branch.
7. **Release, always** (in a `finally`, even on failure):
   - `done` only when every acceptance criterion is met and nothing is left to land:
     `release {key, session, outcome:"done", commits:["<repo>@<sha>"], note}`.
   - work pushed but landing (PR, review, merge, publish) still to come, or out of time: `outcome:"handoff",
     resumeFrom:"<branch>@<sha>"`, with the note.
   - blocked on a decision: `outcome:"blocked", blockedReason, question:{title, question, body, options}`.
   - could not start: `outcome:"abandon"` with the reason.
   The note says what landed, test counts per project (0 skipped or it is not verified), review findings
   fixed and surviving, and decisions made without a question (for the owner's veto).
8. Follow-ups you found: `create_item {domain, kind:"task", tier, priority, title, body}`; work outside this
   domain's repositories goes to the domain that owns them, or to the coordinator as the charter says.
Remove the worktree once its branch is pushed.

## Step 4 — document and hand off
- A round that decided anything leaves a doc per `_docs/README.md`:
  `submit_doc {path:"outputs/<domain>/decisions/YYYY-MM-DD-<slug>.md", markdown, items:[keys]}`. A round that
  decided nothing says so and skips it.
- `update_domain {id, etag, fields:{position}}` with two to four lines: what landed, what is next, what a
  person must do (re-read the domain for a fresh `etag` on a 412).
- `append_event {key:"<domain>:journal", kind:"journal", summary:"<date> /run <keys> (<model>): …", data:{run:"run", model}}`.
- Last line of the reply, exactly one of:
```
NEXT: run <domain> @<model>      # tickets remain for a model; name the model the policy routes them to
NEXT: groom <domain> @<model>    # queue empty or thin, only design or untiered tickets remain
BLOCKED: <domain> — <reason>     # needs a decision, a merge, a publish or anything the charter forbids here
DONE: <domain>                   # nothing left in the queue
```
Emit `BLOCKED:`, never `NEXT:`, when the next step needs a person: a wrong `NEXT:` makes an unattended loop spin.

## Invariants
- Never work a ticket you have not pulled; one live lease per session label; release always.
- Never push the default branch; never open a PR; never dispatch a workflow; never set `Version*` /
  `PackageVersion`; never handle, print or commit a credential; explicit minimum package versions, never `*`.
- Nothing tenant-specific in a platform core package; tenant values live in the tenant's host and config.
- Tests with every change. A skipped test is not verified. A claim without a falsifying test is an opinion.
- Git is the durable copy: docs go through `submit_doc`; state changes go through the instance, never a file.
