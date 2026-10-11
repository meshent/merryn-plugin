# merryn — Merryn's generic skills for Claude Code

A Claude Code plugin for working any Merryn instance: one tenant's backlog, its domain charters, its desk and
its docs. Nothing in it names a tenant's product repositories, a model or a person; everything tenant-specific comes from the
instance at run time (`get_domain` for the charter, `get_policy` for routing, the items themselves). The only
instance it names is Mira's own (`merryn-mira`), as the worked example below; no command defaults to it. A
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
| `hooks/hooks.json`, `hooks/check-in.js` | the SessionStart hook: the session checks in with each registered instance and gets its guidance (below) |

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

Invoke it inside Claude Code as `/merryn [project] [verb] [flags]` (fully qualified: `/merryn:merryn`). Bare
`/merryn` runs the backlog loop; the loop takes `--domain <id>`, `--items <key>…`, `--rounds N`, `--dry-run` and
`--no-merge`. Run `--dry-run` first against a new instance: it prints the lane table and dispatches nothing.

| verb | runs | options |
|---|---|---|
| *(none)*, `loop` | the backlog loop | as above |
| `answer` | `/merryn:answer`, the desk; needs an admin token and stops before reading anything without one | `--domain <id>`, `--assist` (distil a long desk into principles), `--auto` (unattended) |
| `status` | where the project stands; read only | none |
| `pause` / `stop` | release this session's leases (after finishing what is in flight / now) | none |
| `run <domain>` | `/merryn:run` | `--item <key>` (work that one ticket), `--session <label>` (a dispatcher's label), `--tier <tier>…` (overrides what the routing policy gives your model), `--max N` (default 3) |
| `feature [key]` | `/merryn:feature` | `--domain <id>`, `--session <label>`, `--probe-only`, `--dry-run`, `--rounds N` (default 3) |
| `groom <domain>` | `/merryn:groom` | `--item <key>` (work that one design ticket), `--session <label>` (a dispatcher's label), `--dry-run` |

When you call a worker skill directly, use its qualified name, **`/merryn:<skill>`**. The qualified form avoids collisions:
Claude Code has a built-in `/run`, and another installed plugin may ship its own `feature`, `groom` or
`answer`, so a bare name may reach a different skill (and a different instance). This README, the skills and
`/merryn`'s lane briefs always use the qualified form.

## Which command for which project

Each instance gets **one MCP server registration** on each device: a server name, the instance's URL and the
variable that holds that device's token (see "Register the instance" above). In claude.ai the connectors are
named like `Merryn_<Project>`. The project word picks the connector, so `/merryn mira answer --assist` runs Mira's
desk. Leave it out and every skill resolves the connector the same way (`skills/_instance/README.md` ›
*Choosing the connector*):

1. the project or `--server <name>` you named;
2. else the only Merryn connector attached;
3. else the one whose project matches the session's repository or Claude project name;
4. else it asks which project, and calls nothing until you answer.

There is no default server name. An instance-wide connector that serves several projects still takes
`--project <id>` to pick one inside it. A project that needs more than the generic loop (its own lanes, detectors
or standing rules) ships a layer plugin of its own whose skills wrap these with its specifics; run the layer's
commands for that project.

For local development only, `claude --plugin-dir /path/to/merryn-plugin/plugins/merryn` loads the working copy;
it silently overrides an installed plugin of the same name, so drop it when you are done.

## The session check-in hook

Every Claude Code session that has this plugin enabled checks in with the Merryn instances this device is
registered with, at session start and again on resume, `/clear`, compaction and fork. The hook
(`hooks/check-in.js`, run with `node`, which the fleet has) reads the hook input Claude Code hands it
(`session_id`, `model`, `cwd`), finds the registrations in `~/.claude.json` whose URL ends in `/mcp` and whose
header is `Authorization: Bearer ${VARIABLE}` and that look like Merryn's (a name starting `merryn`, a host
containing `merryn`, or a `MERRYN_*` variable), takes each token from the named variable in its own process, and
POSTs `/api/v1/sessions/check-in` with:

```json
{ "sessionId": "<session_id>", "harness": "claude-code", "model": "<model>", "device": { "name": "<hostname>", "os": "Windows 11 | macOS 24.6 | Linux …" },
  "cwd": "<cwd>", "canDispatch": ["fable", "opus", "sonnet", "haiku"], "source": "hook" }
```

The instance records the session (`GET /sessions`, the board's *Who's working*: device, harness, model, project,
since, last seen, trust `hook`) and answers `guidance`: who you are to it, the project, its routing (tiers →
models), which models online sessions can run, and that the loop's own check-in step can be skipped. The hook
prints that as `additionalContext`, so it is in the session's context from the first turn; the served `loop`
prompt sees the line beginning *Checked in with Merryn* and does not check in again.

What the hook never does: it finishes within the 10-second budget (an 8-second deadline of its own; Node alone can take a second to start on Windows) or exits quietly; on any failure (no
registration, the variable not set, the instance unreachable, an older instance without the route, a refused
token) it prints nothing and exits 0, so a session always starts; it writes the token nowhere, not stdout, not
stderr, not a file (the test in `scripts/test-hook.js` checks this against a fake instance). It is the one
place in the plugin that reads a token's value, and it does so the way Claude Code itself does when it connects:
from the variable the registration names. The skills still never read the environment or the configuration.

Knobs, all optional: `MERRYN_CHECKIN=off` disables the hook; `MERRYN_CHECKIN_SERVERS=merryn-acme,merryn-mira`
names the registrations to check in with (default: every Merryn-looking one whose variable is set, so a device
registered with two instances checks in with both); `MERRYN_CAN_DISPATCH=opus,haiku` overrides the models this
harness reports it can hand work to. On Windows the hook runs under whichever shell Claude Code uses (Git Bash,
or PowerShell without it); it is exec-form (`node <script>`), so neither matters.

Harnesses without hooks (claude.ai, ChatGPT, Codex, Cursor) are covered by the instance itself: the served
`loop` prompt's first step calls `check_in` with `source: "self"`.

## Another tenant

One instance per tenant, one token and one server name per instance on each device. Pass the server name:
`/merryn acme` (or `/merryn --server merryn-acme`). A run talks to exactly one instance, so work, questions and docs
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
