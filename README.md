# merryn-plugin

The `meshent` marketplace for [Claude Code](https://claude.com/claude-code) plugins that work
Merryn instances. Merryn is a work-coordination platform: one queue per tenant,
leases so no two agents take the same item, a desk for questions, and a mirror that writes state to git.

It holds one plugin today, `merryn`. Its `/merryn` skill runs the backlog loop against any Merryn instance:
answer what the desk can, plan lanes, dispatch one agent per pulled item, review, land, close out, and repeat
until the queue is dry. Its worker skills do one part of that loop each: `/merryn:run` works one domain's tickets,
`/merryn:feature` builds cross-cutting features, `/merryn:groom` keeps a domain's queue true, and `/merryn:answer` is the desk.

## Install

```bash
claude plugin marketplace add meshent/merryn-plugin
claude plugin install merryn@meshent --scope user
```

Before the first run, register your instance's MCP server at user scope with a token only you can read. The
plugin ships no MCP server and no instance binding, so this step is per device and per tenant. See
[plugins/merryn/README.md](plugins/merryn/README.md) for the commands and the skill's options, and start with
`/merryn --dry-run`, which reads and prints the plan without changing anything.

To pick up changes later, run `claude plugin update merryn@meshent`.

## Which command for which project

One command, `/merryn [project] [verb]` (the verb may also come first: `/merryn loop mira`):

```
/merryn                          the backlog loop, landing included
/merryn mira                     the same, for the mira project
/merryn mira loop                the same, with the verb spelled out (also /merryn loop mira, /merryn:loop mira)
/merryn mira answer              the desk (needs the answer scope)
/merryn mira answer --assist     the desk distilled into a few principle-level questions
/merryn mira status              where the project stands; read only
/merryn mira run <domain>        one domain's tickets (also: groom <domain>, feature [key], pause, stop)
```

The project picks the Merryn connector. When you leave it out, the skill uses the only Merryn connector
attached, or the one whose project matches the session's repository or Claude project name. If none of
those settles it, it asks; it never falls back to a default. The long forms (`/merryn:answer --server <name>
--project <id> --assist` and the like) still work. A project with needs beyond the generic loop ships its own
layer plugin that wraps these skills with its specifics; for that project, run the layer's commands.
Registration and options: [plugins/merryn/README.md](plugins/merryn/README.md#which-command-for-which-project).

## Layout

```
.claude-plugin/marketplace.json     the "meshent" marketplace
plugins/merryn/
  .claude-plugin/plugin.json        the "merryn" plugin
  skills/merryn/SKILL.md            /merryn, the backlog loop
  skills/loop/SKILL.md              /merryn:loop, the loop's qualified name (hands off to /merryn)
  skills/run/SKILL.md               /merryn:run, the worker loop over one domain
  skills/feature/SKILL.md           /merryn:feature, cross-cutting features
  skills/groom/SKILL.md             /merryn:groom, keep a domain's queue true
  skills/answer/SKILL.md            /merryn:answer, the desk
  skills/_instance/README.md        every tool an instance serves, with its REST twin
  skills/_review/README.md          the review gate
  skills/_docs/README.md            the decision-doc contract
  hooks/hooks.json                  the SessionStart hook
  hooks/check-in.js                 what it runs: the session check-in (node)
scripts/check.py                    the checks CI runs (manifests, skills, secrets, tenant names)
scripts/test-hook.js                the hook's tests against a fake instance on localhost
```

## The session check-in

The plugin ships one hook. At session start (and on resume, clear, compact and fork) it tells each Merryn
instance this device is registered with what the session is: harness, model, device, working directory and the
models it can hand work to. The instance answers with guidance (the project, how its routing maps tiers to
models, which models are online now), which lands in the session's context, so the loop starts knowing how to
drive. The board's Dashboard shows the session under *Who's working*. It uses the token the device already
holds for that instance, the one its MCP registration names; it finishes within three seconds, says nothing when
an instance cannot be reached, never blocks the session and never prints a token. `MERRYN_CHECKIN=off` disables
it. Details: [plugins/merryn/README.md](plugins/merryn/README.md#the-session-check-in-hook).

A directory under `skills/` that starts with `_` is a shared contract the skills read, not a skill of its own.

## Contributing

Everything here is generic: it names no tenant's products, repositories or people, and carries no instance
host, token or account id. Tenant specifics come from the instance at run time (charters, policy, items). A
tenant that needs more should layer its own plugin on top of this one rather than fork it. `scripts/check.py`
enforces part of this: it fails when any file or path names a tenant it knows the plugin was modelled on.

To try a working copy, run `claude --plugin-dir ./plugins/merryn`. It overrides an installed plugin of the same
name, so drop the flag when you're done.

Before opening a pull request, run the same checks CI does:

```bash
claude plugin validate .
claude plugin validate plugins/merryn
python3 scripts/check.py
```

## License

[MIT](LICENSE)
