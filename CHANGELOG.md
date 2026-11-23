# Changelog

The `merryn` plugin's notable changes, newest first. The version is `plugins/merryn/.claude-plugin/plugin.json`'s.
This repository has no release train: each change that alters what the plugin does sets the next version there, in
the same pull request, and adds its entry here.

## 0.3.13: assist answers go to Applied
- `/merryn answer --assist` records every row the owner approved with `reviewed:true`, so the answer is reviewed in
  the same write and lands in the desk's Applied tab. Before this, answers recorded by principle or as filed waited in
  Auto-answered for a board Accept the owner had in effect already given, and piled up there. On an instance whose
  `answer_question` has no `reviewed`, the run records without it and says those answers wait for Accept. Earlier
  approved answers are accepted with the instance's `review_question` only when the owner asks in the run.
- `--auto` never marks an answer reviewed: the owner reviews what the desk decided.

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
