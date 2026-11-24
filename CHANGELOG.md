# Changelog

The `merryn` plugin's notable changes, newest first. The version is `plugins/merryn/.claude-plugin/plugin.json`'s.
This repository has no release train: each change that alters what the plugin does sets the next version there, in
the same pull request, and adds its entry here.

## 0.3.13: run and feature open their own PRs
- `/merryn:run` and `/merryn:feature`, whose output is code, now land it the way the loop's Step 4 does: merge the
  base into the branch (a merge commit) and rerun the full suites, open the PR into the base the charter's branch
  model names, get an independent comment review ending `MERGE` or `DO NOT MERGE` (two-round cap), and merge only
  when the charter or the owner in writing allows it, never a PR they authored. Their Invariants say "open a PR only
  from your own work branch into the base …; never merge a PR you authored" in place of "never open a PR".
- The normal end of a ticket with an open PR is `release blocked` "awaiting merge of <PR URL>" with the structured
  `landing`, so the session's next `pull_work` no longer re-takes the item it just finished. `handoff` stays only
  for work pushed with no PR yet. The handoff lines gain `BLOCKED: <domain> — awaiting merge of <PR URLs>`.
- Unchanged: `/merryn:groom` and `/merryn:answer` never open a PR, and neither does a lane (the loop's brief and
  `/merryn:lane`), because the coordinator or the landing session lands its work; both now say so.

## 0.3.12: filing decisions in force or as candidates
- The owner's rule (2026-11-23): a connector creates a decision in force only after the owner confirms its exact
  text in the conversation; when nobody can be asked it files a candidate (`status:"todo"`) so work is not held up.
  The instance tool map (`_instance`) says so under "Filing a decision".
- A candidate's wording is corrected with `update_item` before it is accepted, and a reject names its successor in
  the same patch (`{status:"superseded", supersededBy}`). Needs a Mira instance from release 20261123.

## 0.3.11: accepting candidate decisions
- The owner's rule (2026-11-19): accepting a candidate decision is an answer. A connector the owner approved with
  the `answer` scope acts for them and accepts any candidate, whoever filed it; the instance records the owner as
  `approvedBy` and the connector as `approvedVia`. A token no person approved may propose and reject, never accept
  (`403 accept-needs-person`). Needs a Mira instance with the same rule; an older one answers `admin-accept-only`
  or `self-accept`, and the owner accepts on the board.
- `/merryn answer` lists the candidates waiting, asks the owner about each, and accepts or rejects on their word.
  `answer_question` never accepts a candidate; `--auto` never accepts one.
- `groom` says where and how the owner accepts, which refusal a caller gets, and what to do next.

## 0.3.9: fan-out
- **Fan-out mode** in the loop: `/merryn loop [project] --siblings N` (and the project's default, `fanOutSiblings` in
  `coordinator_status`) runs every lane and every landing as its own sibling session when the harness can spawn one
  (Claude Code on the web's `create_session`). The coordinator keeps only the desk, `coordinator_status`, spawning,
  merging on a structured `MERGE` verdict whose head SHA still matches, the banner and the close-out. It wakes on
  `subscribe_events` webhooks (with a receiver that can verify the instance's HMAC; a secret sealed to another
  service is not used) and a fallback timer, and never polls in short intervals. It takes the landing lease before
  spawning a landing and the merge lease before merging, honours `--no-merge`, and rescues a dead sibling by spawning
  a new lane on its pushed branch. Leases, the desk's escalation rules, the review gate and the branch, version,
  workflow and credential rules are unchanged.
- **New skills** `lane` (`/merryn:lane`: a sibling works one item, routes it, sends an escalation to the desk, and
  releases `handoff`; `--item` resumes a dead lane's item) and `landing`
  (`/merryn:landing`: a fresh sibling opens the PR, gets an independent review, runs at most two fix rounds and
  releases `blocked` awaiting merge with the structured `landing` object, or blocked on a merge conflict; it never
  merges). The instance serves them
  too (`get_skill lane | landing`).
- **Compact reads** in the loop's context budget: `get_domain`/`get_item` `fields`, `journal`, `events`;
  `list_items` `blockedReasonPrefix` and `fields`; "Items awaiting a merge" reads `coordinator_status` or the
  prefix filter instead of one `get_item` per blocked item.
- **The instance tool map** (`_instance`) documents `coordinator_status`, `subscribe_events`, `unsubscribe_events`,
  `check_in`, the `landing` release object, `externalSession` on `pull_work`, `claim` and `check_in`, and the new list
  row fields, each with its REST twin.

## 0.3.8
- Owner decisions go through the desk only, never inline; the close-out never pauses the loop.
