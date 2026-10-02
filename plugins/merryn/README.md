# merryn — Merryn's generic skills for Claude Code

A Claude Code plugin for working any Merryn instance: one tenant's backlog, its domain charters, its desk and
its docs. Nothing in it names a tenant's product repositories, a model or a person; everything tenant-specific comes from the
instance at run time (`get_domain` for the charter, `get_policy` for routing, the items themselves). The only
instance it names is Mira's own (`merryn-mira`), as the default server name and the worked example below. A
tenant that needs more layers its own plugin on top of this one instead of forking it.

## What's here

| path | what it is |
|---|---|
| `skills/merryn/SKILL.md` | `/merryn`, the backlog loop: desk first, plan lanes, dispatch one agent per pulled item, review, land, close out, repeat until the queue is dry |
| `skills/_instance/README.md` | every tool an instance serves over MCP, its scope and its REST twin under `/api/v1` |
| `skills/_review/README.md` | the review gate: three lenses, reproductions, 0 skipped, the two-round cap, the independent `MERGE` / `DO NOT MERGE` review |
| `skills/_docs/README.md` | the decision doc: path, front matter, `## Intent` and `## Usage`, delivery through `submit_doc` |

The plugin ships **no MCP server**, so that each device holds its own token at user scope and the plugin
carries no binding to any instance. (For the record: in a plugin's `.mcp.json` `headers`, only a fixed list of
credential variables, Claude Code's own and cloud providers' credentials, `NPM_TOKEN` and similar, reads as
empty; the blanket stripping of `*TOKEN*` / `*KEY*` names applies to `headersHelper`. A plugin-level server
could have worked; it would have tied every install to one instance.)

## Register the instance (once per device and tenant)

Put the token in a file only you can read, and export it from your shell profile (`~/.zshrc`, `~/.bashrc`):

```bash
export MERRYN_MIRA_TOKEN="$(cat ~/.claude/mira/tokens/merryn-mira.token)"
```

Then register the server. The single quotes matter: Claude Code stores the `${…}` reference and reads the
variable when it connects, so the token never lands in its configuration:

```bash
claude mcp add --transport http -s user merryn-mira https://<mira-instance-host>/mcp \
  --header 'Authorization: Bearer ${MERRYN_MIRA_TOKEN}'
```

Any other tenant gets its own server name, URL and variable:

```bash
export MERRYN_ACME_TOKEN="$(cat ~/.config/merryn/acme.token)"      # in the shell profile
claude mcp add --transport http -s user merryn-acme https://merryn-acme.example.com/mcp \
  --header 'Authorization: Bearer ${MERRYN_ACME_TOKEN}'
```

Tokens are registry tokens (`mk_…`) with the `read` and `work` scopes (`admin` only if the skill should answer
desk questions). Ask the instance's owner to mint one per device, harness and model (board: **Tokens**), so
the board attributes the work. Never put a token in a repository file, a project `.claude/settings.json`, a
URL or a chat.

## Install

```bash
claude plugin marketplace add meshent/merryn-plugin
claude plugin install merryn@meshent --scope user
claude plugin update merryn@meshent                  # later, to pick up changes
```

Invoke it inside Claude Code as `/merryn` (fully qualified: `/merryn:merryn`), with any of `--server <name>` (default `merryn-mira`;
the name this device registered), `--domain <id>`, `--items <key>…`, `--rounds N`, `--dry-run`, `--no-merge`.
Run `--dry-run` first against a new instance: it prints the lane table and dispatches nothing.

For local development only, `claude --plugin-dir /path/to/merryn-plugin/plugins/merryn` loads the working copy;
it silently overrides an installed plugin of the same name, so drop it when you are done.

## Another tenant

One instance per tenant, one token and one server name per instance on each device. Pass the server name:
`/merryn --server merryn-acme`. A run talks to exactly one instance, so work, questions and docs
for one tenant never land on another's.

## Troubleshooting

- **The MCP server answers 401 right after you set the token variable.** The Claude Code process started
  before the variable existed, so it connects with an empty header. This is typical of a variable set at
  machine or user scope on Windows (`setx`, System Properties), which only processes started afterwards see.
  Restart the app (every window) and it connects. The REST twin works meanwhile from a new shell that has
  the variable (see `skills/_instance/README.md`).

## What the skill never does

- Work an item it has not pulled, or hold more than one live lease per session label.
- Push the default branch, dispatch a CI workflow, set a package version, or float a package dependency.
- Read, print, mint or rotate a credential; anything that needs one goes to the owner in the close-out batch.
- Answer a question that hits an escalation category (money, legal, scope, security against usability,
  irreversible, reversal, agents disagreeing): those wait for a person.
- Merge without an independent `MERGE` review, merge when the charter or the owner has not let it, or merge
  its own pull request.
- Run infrastructure writes no permission rule or charter covers.
- Commit state or docs by hand: state goes through the instance, docs through `submit_doc`.
