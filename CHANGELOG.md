# Changelog

The `merryn` plugin's notable changes, newest first. The version is `plugins/merryn/.claude-plugin/plugin.json`'s.
This repository has no release train: each change that alters what the plugin does sets the next version there, in
the same pull request, and adds its entry here.

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
