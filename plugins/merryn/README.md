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
| `skills/run/SKILL.md` | `/merryn:run <domain>`, the worker loop over one domain: pull the tickets its routing policy gives your model, work them under the charter, release each |
| `skills/feature/SKILL.md` | `/merryn:feature [key]`, cross-cutting features: probe the seams the repositories actually expose, build when they are there, file the gaps when not |
| `skills/groom/SKILL.md` | `/merryn:groom <domain>`, keep a domain's queue true: close what is done, file gaps, fold answers and requests into tickets, work design tickets inline |
| `skills/answer/SKILL.md` | `/merryn:answer`, the desk: present open questions with a recommendation, record the owner's answers with provenance (`--assist`, `--auto`) |
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
the name this device registered), `--project <id>`, `--domain <id>`, `--items <key>…`, `--rounds N`, `--dry-run`,
`--no-merge`. Run `--dry-run` first against a new instance: it prints the lane table and dispatches nothing.

The worker skills take the same `--server` and `--project`:

| command | options |
|---|---|
| `/merryn:run <domain>` | `--item <key>` (work that one ticket), `--session <label>` (a dispatcher's label), `--tier <tier>…` (overrides what the routing policy gives your model), `--max N` (default 3) |
| `/merryn:feature [key]` | `--domain <id>`, `--session <label>`, `--probe-only`, `--dry-run`, `--rounds N` (default 3) |
| `/merryn:groom <domain>` | `--item <key>` (work that one design ticket), `--session <label>` (a dispatcher's label), `--dry-run` |
| `/merryn:answer` | `--domain <id>`, `--assist` (distil a long desk into principles), `--auto` (unattended; needs `admin`) |

Invoke every worker skill by its qualified name, **`/merryn:<skill>`**. The qualified form avoids collisions:
Claude Code has a built-in `/run`, and another installed plugin may ship its own `feature`, `groom` or
`answer`, so a bare name may reach a different skill (and a different instance). This README, the skills and
`/merryn`'s lane briefs always use the qualified form.

## Which command for which project

Each instance gets **one MCP server registration** on each device: a server name, the instance's URL and the
variable that holds that device's token (see "Register the instance" above). The server name selects the
instance; when the instance hosts several projects (`list_projects`), `--project <id>` selects the project
inside it. Pass both to every command:

| to | run |
|---|---|
| work the whole backlog, landing included | `/merryn --server <name> --project <id>` |
| work one domain's tickets | `/merryn:run <domain> --server <name> --project <id>` |
| work cross-cutting features | `/merryn:feature [key] --server <name> --project <id>` |
| keep a domain's queue true | `/merryn:groom <domain> --server <name> --project <id>` |
| answer the desk | `/merryn:answer --server <name> --project <id>` |

With no `--server`, every command uses `merryn-mira`, Mira's own instance; with no `--project`, it works every
project on the instance. A project that needs more than the generic loop (its own lanes, detectors or standing
rules) ships a layer plugin of its own whose skills wrap these with its server name, project and specifics;
run the layer's commands for that project.

For local development only, `claude --plugin-dir /path/to/merryn-plugin/plugins/merryn` loads the working copy;
it silently overrides an installed plugin of the same name, so drop it when you are done.

## Another tenant

One instance per tenant, one token and one server name per instance on each device. Pass the server name:
`/merryn --server merryn-acme`. A run talks to exactly one instance, so work, questions and docs
for one tenant never land on another's; `--project` keeps it to one of that tenant's projects.

## Troubleshooting

- **The MCP server answers 401 right after you set the token variable.** The Claude Code process started
  before the variable existed, so it connects with an empty header. This is typical of a variable set at
  machine or user scope on Windows (`setx`, System Properties), which only processes started afterwards see.
  Restart the app (every window) and it connects. The REST twin works meanwhile from a new shell that has
  the variable (see `skills/_instance/README.md`).

## What the skills never do

- Work an item they have not pulled, or hold more than one live lease per session label.
- Push the default branch, dispatch a CI workflow, set a package version, or float a package dependency.
- Read, print, mint or rotate a credential; anything that needs one goes to the owner in the close-out batch.
- Decide on their own a question that hits an escalation category (the instance's escalation policy: typically
  money, legal, scope, security against usability, irreversible, reversal, agents disagreeing): those wait for
  a person, and `/merryn:answer` records only what the owner says about them.
- Open or merge a pull request from a worker skill (`/merryn:run`, `/merryn:feature`, `/merryn:groom`, `/merryn:answer`): landing is
  `/merryn`'s. `/merryn` never merges without an independent `MERGE` review, when the charter or the owner has
  not let it, or its own pull request.
- Run infrastructure writes no permission rule or charter covers.
- Commit state or docs by hand: state goes through the instance, docs through `submit_doc`.
