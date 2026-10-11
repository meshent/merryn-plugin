---
name: loop
description: "The backlog loop under its qualified name. Usage /merryn:loop [project] [flags], the same as /merryn loop [project] (and the accepted /merryn [project] loop); the project is optional when one Merryn connector is attached. Hands off to the merryn skill's loop; flags as there: --domain <id>..., --items <key>..., --rounds N, --dry-run, --no-merge, --server <name>, --project <id>."
---

This is a name, not a second loop. `/merryn:loop [project] [flags]` is exactly `/merryn loop [project] [flags]`.

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/merryn/SKILL.md` and follow it from *Step 0* as the coordinator, with the
   verb `loop`.
2. Pass it everything you were given, unchanged: the project word (the first word, when it names a connected
   Merryn project; it is optional) and every flag. A first word that names no connected project is an error there, as it is for
   `/merryn`.
3. Nothing in this file adds to, relaxes or overrides that skill, its Invariants or the instance's charters. If
   the merryn skill cannot be read, stop and say so; never run a loop from memory.
