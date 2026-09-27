# merryn-plugin

The `meshent` Claude Code marketplace. It holds one plugin, `merryn`, whose `/merryn` skill runs the backlog
loop against any Merryn instance: desk first, plan lanes, dispatch one agent per pulled item, review, land,
close out, repeat until the queue is dry.

```bash
claude plugin marketplace add meshent/merryn-plugin
claude plugin install merryn@meshent --scope user
```

Each device registers its instance's MCP server at user scope before the first run; see
[plugins/merryn/README.md](plugins/merryn/README.md) for that and for the skill's options.
