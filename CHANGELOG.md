# Changelog

The `merryn` plugin's notable changes, newest first. The version is `plugins/merryn/.claude-plugin/plugin.json`'s.
This repository has no release train: each change that alters what the plugin does sets the next version there, in
the same pull request, and adds its entry here.

## 0.3.9: fan-out
- **Fan-out mode** in the loop: `/merryn loop [project] --siblings N` (and the project's default, `fanOutSiblings` in
  `coordinator_status`) runs every lane and every landing as its own sibling session when the harness can spawn one
  (Claude Code on the web's `create_session`). The coordinator keeps only the desk, `coordinator_status`, spawning,
  merging on a structured `MERGE` verdict whose head SHA still matches, the banner and the close-out. It wakes on
  `subscribe_events` webhooks with a 30-60 minute fallback timer and never polls in short intervals. Leases, the
  desk's escalation rules, the review gate and the branch, version, workflow and credential rules are unchanged.
- **New skills** `lane` (`/merryn:lane`: a sibling works one item and releases `handoff`) and `landing`
  (`/merryn:landing`: a fresh sibling opens the PR, gets an independent review, runs at most two fix rounds and
  releases `blocked` awaiting merge with the structured `landing` object; it never merges). The instance serves them
  too (`get_skill lane | landing`).
- **Compact reads** in the loop's context budget: `get_domain`/`get_item` `fields`, `journal`, `events`;
  `list_items` `blockedReasonPrefix` and `fields`; "Items awaiting a merge" reads `coordinator_status` or the
  prefix filter instead of one `get_item` per blocked item.
- **The instance tool map** (`_instance`) documents `coordinator_status`, `subscribe_events`, `unsubscribe_events`,
  `check_in`, the `landing` release object, `externalSession` on `pull_work`, `claim` and `check_in`, and the new list
  row fields, each with its REST twin.

## 0.3.8
- Owner decisions go through the desk only, never inline; the close-out never pauses the loop.
