# merryn-plugin

The `meshent` marketplace for [Claude Code](https://claude.com/claude-code) plugins that work
Merryn instances. Merryn is a work-coordination platform: one queue per tenant,
leases so no two agents take the same item, a desk for questions, and a mirror that writes state to git.

It holds one plugin today, `merryn`. Its `/merryn` skill runs the backlog loop against any Merryn instance:
answer what the desk can, plan lanes, dispatch one agent per pulled item, review, land, close out, and repeat
until the queue is dry. Its worker skills do one part of that loop each: `/run` works one domain's tickets,
`/feature` builds cross-cutting features, `/groom` keeps a domain's queue true, and `/answer` is the desk.

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

Each device registers **one MCP server per Merryn instance**: a server name, the instance's URL, and the
environment variable that holds that device's token. The server name picks the instance; an instance may host
several projects, and `--project <id>` picks one of them. Pass both to every command:

```
/merryn      --server <name> --project <id>            the whole loop, landing included
/merryn:run  <domain> --server <name> --project <id>   one domain's tickets
/feature     [key] --server <name> --project <id>      cross-cutting features
/groom       <domain> --server <name> --project <id>   keep a domain's queue true
/answer      --server <name> --project <id>            the desk
```

`/merryn:run` is the qualified name: Claude Code has a built-in `/run`. Without `--server` the commands use
`merryn-mira`, Mira's own instance; without `--project` they work every project on the instance. A project
with needs beyond the generic loop ships its own layer plugin that wraps these skills with its server name,
project and specifics; for that project, run the layer's commands. Registration and options:
[plugins/merryn/README.md](plugins/merryn/README.md#which-command-for-which-project).

## Layout

```
.claude-plugin/marketplace.json     the "meshent" marketplace
plugins/merryn/
  .claude-plugin/plugin.json        the "merryn" plugin
  skills/merryn/SKILL.md            /merryn, the backlog loop
  skills/run/SKILL.md               /run, the worker loop over one domain
  skills/feature/SKILL.md           /feature, cross-cutting features
  skills/groom/SKILL.md             /groom, keep a domain's queue true
  skills/answer/SKILL.md            /answer, the desk
  skills/_instance/README.md        every tool an instance serves, with its REST twin
  skills/_review/README.md          the review gate
  skills/_docs/README.md            the decision-doc contract
scripts/check.py                    the checks CI runs (manifests, skills, secrets, tenant names)
```

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
