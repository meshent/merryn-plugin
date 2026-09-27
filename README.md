# merryn-plugin

The `meshent` marketplace for [Claude Code](https://claude.com/claude-code) plugins that work
Merryn instances. Merryn is a work-coordination platform: one queue per tenant,
leases so no two agents take the same item, a desk for questions, and a mirror that writes state to git.

It holds one plugin today, `merryn`, whose `/merryn` skill runs the backlog loop against any Merryn instance:
answer what the desk can, plan lanes, dispatch one agent per pulled item, review, land, close out, and repeat
until the queue is dry.

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

## Layout

```
.claude-plugin/marketplace.json     the "meshent" marketplace
plugins/merryn/
  .claude-plugin/plugin.json        the "merryn" plugin
  skills/merryn/SKILL.md            /merryn, the backlog loop
  skills/_instance/README.md        every tool an instance serves, with its REST twin
  skills/_review/README.md          the review gate
  skills/_docs/README.md            the decision-doc contract
scripts/check.py                    the checks CI runs
```

A directory under `skills/` that starts with `_` is a shared contract the skills read, not a skill of its own.

## Contributing

Everything here is generic: it names no tenant's products, repositories or people, and carries no instance
host, token or account id. Tenant specifics come from the instance at run time (charters, policy, items). A
tenant that needs more should layer its own plugin on top of this one rather than fork it.

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
