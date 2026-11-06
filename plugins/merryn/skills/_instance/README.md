# The instance — every tool a Merryn instance serves, and its REST twin

A Merryn instance serves one tenant (an organization), which may hold several projects. It exposes the same services twice: an MCP server at `POST /mcp`
(JSON-RPC 2.0 over streamable HTTP, plain JSON responses) and a REST API under `/api/v1`. Both take the same
bearer token (`Authorization: Bearer mk_…`), the same scopes and the same rate limit, so a skill may use either
and get the same behaviour. `GET /api/openapi.json` is the REST schema.

**Scopes.** `read` sees; `work` pulls, claims, writes items and submits docs; `answer` answers and reopens
the desk's questions and records the principles the owner approves there, in the token's own project (it can be
bound to one); `admin` implies it and also changes charters. Admin comes in two reaches: on a token bound
to no project it is **instance admin**; on a token bound to a project it is **project admin**, which administers that
project only (its charters, policies, templates, skills, runners and dispatch secrets, import, the knowledge reindex,
import and listing of its own entries, and the link sweep over its own items) and answers `403 instance-admin-only` on the routes that act on the whole instance: minting,
listing and revoking tokens, the connector allowlist, the model catalog, integrations, creating or editing projects,
the tenant-wide escalation policy and the mirror run. `tools/list` only shows the tools
your token's scopes allow; a call without the scope answers `forbidden`.

**Project-bound tokens and links.** A token bound to one project links only inside it: a `parent`, `dependsOn` or
`blocks` key it adds (`create_item`, `update_item`, `bulk_update`, clone) must name an existing item in its project, and
another project's key answers exactly like a key that does not exist (400 `unknown-item`; `unknown-feature` for a
parent); a released question's `blocks` drops such keys. Links already stored (made by an instance-wide token) are not
re-judged by an edit that leaves them alone, but acting on them stays inside the project: answering or re-opening a
question never unblocks, re-blocks or notes another project's item (each reads `not-found`, like a missing key, and
items elsewhere that link the question are not listed); convert judges the parent again as the token sees it; the
sub-task depth check counts only the project's own children. An instance-wide token links and acts across projects as
before.

**Binding.** Each device registers the instance as a user-scope MCP server (the plugin README shows how; the
server name is whatever the device chose, `merryn-<tenant>` by convention). Without MCP, call the REST route below
at the same host, piping the header to curl on stdin rather than putting it on the command line:
`printf 'Authorization: Bearer %s\n' "$<VARIABLE>" | curl -sS -H @- "https://<instance-host>/api/v1/..."`
(`printf` is a shell built-in, so the token is in no process's arguments; a request body goes in a file,
`-d @<file> -H 'Content-Type: application/json'`, because stdin carries the header; process substitution, `-H @<(…)`, fails in Git Bash on
Windows). If that fails, stop rather than put the header on the command line; never use `-v` or `--trace`,
which print it. Never print a token.

**Projects.** An instance may host several projects (an organization's products), each owning its domains,
board view and docs mirror target. `list_projects` (REST `GET /projects`) lists them, the home project first.
`pull_work`, `list_items`, `list_domains`, `list_active`, `list_open_questions` and `submit_doc` take a
`project` argument (REST: a `project` query parameter on `/items`, `/domains`, `/work/active`; a field on the
pull and doc bodies); a lane serving one project always passes it. An unknown project is an error, never an
empty list. An instance that does not serve `list_projects`, or lists none, hosts one project: pass no
`project` there.

## Choosing the connector

A session can have several Merryn connectors attached, one per instance or per project-bound token. Claude Code
registrations are usually named `merryn-<tenant>`; claude.ai connectors look like `Merryn_<Project>`, so their
tools are `mcp__Merryn_<Project>__*`. A connector is a Merryn one when its tools include `pull_work` and
`list_open_questions`. Every skill in this plugin resolves the connector the same way, before its first call:

1. **Named:** the `[project]` word or `--server <name>` the person typed. Match it case-insensitively against
   each connector's name with any `merryn`/`Merryn_` prefix and `-`/`_` removed, and against the project its
   instructions name ("This token works in project '<id>' only"). If nothing matches, list the connected ones
   and stop.
2. **Only one:** exactly one Merryn connector is attached, so use it.
3. **Inferred:** exactly one connector matches the session's repository name or the Claude project's name.
4. **Ask:** otherwise, ask which project, offering the connected ones by name. Call nothing until they answer.
   Never fall back to a default name.

A connector bound to one project is that project: pass no `--project`. An instance-wide connector serving several
projects still takes `--project <id>` (or the `[project]` word, which then names the project inside it).

## The tool map

One line each: what it does · scope · REST twin (relative to `/api/v1`).

### Session
| tool | purpose | scope | REST |
|---|---|---|---|
| `initialize` (MCP method, not a tool) | handshake; its `instructions` carry the working loop, which wins over any skill text | any valid token | none (`GET /me`, read scope, says who the token is) |

### Domains (the project's charters)
| tool | purpose | scope | REST |
|---|---|---|---|
| `list_projects` | the projects on this instance, home first, with each one's domain ids | read | `GET /projects` |
| `list_domains` | every domain with its project, position banner and repo policy (`project` narrows it) | read | `GET /domains` |
| `get_domain` | one domain: the binding charter, position banner, repo policy, counts, recent journal, ETag | read | `GET /domains/{id}` |
| `update_domain` | patch a domain with its ETag; lanes may change position, flags, lastActivity; every other field (title, repo, repos, charter, charterSummary, repoPolicy, queues) needs admin | work (admin for other fields) | `PATCH /domains/{id}` with `If-Match` |

### Items (tickets, features, questions, requests, notes, decisions)
| tool | purpose | scope | REST |
|---|---|---|---|
| `list_items` | filtered list (domain, kind, status, tier, repo, q, limit, default 100); each entry is key, domain, kind, status, tier, priority, repo, title and the live lease holder; body, acceptance criteria, `blockedReason`, `blocks`, `dependsOn` and links are omitted (`get_item` each, or use the REST twin) | read | `GET /items?…` (adds owner and leased filters, returns full items, default limit 1000) |
| `get_item` | one item: body, acceptance criteria, links, ETag and its last 20 events (`get_history` has them all) | read | `GET /items/{key}` (events: `GET /items/{key}/events`) |
| `create_item` | create a task, feature, question, request, note or decision (a decision created with no `status` is in force, `done`, by the owner's ruling; propose a candidate with `status:"todo"`); also takes `parent`, `labels`, `release`, `dueDate`, `storyPoints`, `assignee` (+`assigneeSoft`), `watchers` and `template` (below) | work | `POST /items` |
| `update_item` | patch fields with the item's ETag (412 when stale); status never becomes in-progress this way; labels, dueDate (yyyy-MM-dd), storyPoints (0-100) and watchers too, never the assignee (use `assign_item`) | work | `PATCH /items/{key}` with `If-Match` |

### Authoring and assignment (tickets)
| tool | purpose | scope | REST |
|---|---|---|---|
| `draft_item` | describe it: free text, a pasted tracker row (header and row) or a tracker issue as JSON becomes a `create_item` draft for you to check; only keys in dependency phrases (depends on, blocked by, requires, after) become `dependsOn`, other keys come back as `related`; nothing is created | work | `POST /items/draft` |
| `assign_item` | assign a ticket (intent, separate from the checkout): `me`, `next-free-agent`, a principal, or `none` to unassign; `soft` makes it a preference; an optional `reason`; each change appends an `assigned` event. `pull_work` offers you your own assigned tickets first and skips one hard-assigned to someone else | work | `POST /items/{key}/assign` |
| `comment` | a Markdown comment on the ticket's timeline (a `comment` event); @mentions resolve to principals the caller can see, item keys are recorded as links | work | `POST /items/{key}/comments` |
| `bulk_update` | status, priority, tier, assignee, release, labels (add/remove) and dependsOn (add/remove) on up to 200 tickets, each written with the ETag you read; a stale ETag fails only that ticket and is reported; one event per ticket names the batch | work | `POST /items/bulk` |
| `import_items` | import another tracker's export into one domain (`format`: jira-json, jira-csv, ado-csv, planner-xlsx as base64, merryn-json); `dryRun` (the default) returns the field mapping and what would be created; source keys are kept as the external reference, so a re-import skips them | work | `POST /items/import` |
| `list_my_work` | the caller's assigned, checked-out, watched and @mentioned tickets (`project` narrows it) | read | `GET /my-work` |

`create_item`'s `template` names a kind (task, feature, question, request, note): every field the call leaves out
(body, acceptanceCriteria, tier, priority, labels, a question's options, a request's level) comes from the project's
template for that kind, and the kind defaults to it; a field the call names wins, even when empty. A project with no
saved templates uses generic defaults. The templates themselves are REST only: `GET /templates` (read) and
`PATCH /templates` with `If-Match` (admin; a kind set to null returns to its default).

### Checkout (leases)
| tool | purpose | scope | REST |
|---|---|---|---|
| `pull_work` | select the next eligible item and claim it in one step; `pulled:false` lists why candidates were skipped | work | `POST /work/pull` |
| `claim` | take one named item; one live lease per session label (per token without a label) | work | `POST /items/{key}/claim` |
| `heartbeat` | extend your lease by its original TTL; every 15 minutes; `not-holder` means someone else holds it now: stop; `no-lease` means yours lapsed or was released: `claim` again at once unless `get_item` shows someone else released it | work | `POST /items/{key}/heartbeat?session=<label>` (the label is a query parameter) |
| `release` | end the lease: `done` (+commits), `blocked` (+question), `handoff` (+resumeFrom), `abandon` | work | `POST /items/{key}/release` |
| `list_active` | every live lease: holder, session, branch, since when (filter by repo, domain) | read | `GET /work/active` |

### The desk (questions and decisions)
| tool | purpose | scope | REST |
|---|---|---|---|
| `list_open_questions` | every open question with what each one holds (unbounded) | read | `GET /items?kind=question&status=todo` (full items, default limit 1000, `limit` up to 5000) |
| `answer_question` | record an answer with provenance; returns the items it held to todo | answer (admin implies it) | `POST /items/{key}/answer` |
| `reopen_question` | the veto: archive the answer, return the question to the desk, hold its items again | answer (admin implies it) | `POST /items/{key}/reopen` |
| `desk_evaluate` | deterministic signals for one question: escalation categories hit, candidate decisions, similar and duplicate questions; decides nothing | read | `GET /desk/evaluate/{key}` |
| `get_escalation_policy` | the categories that always go to a person (tenant default overlaid by the domain's) | read | `GET /escalation-policy`, `GET /domains/{id}/escalation-policy` |
| `get_decision` | one decision or answered question, its citations and its supersededBy chain | read | `GET /decisions/{key}` |
| `list_decisions` | decisions and answered questions (domain, category, since, q) | read | `GET /decisions` |

`create_item` binds more fields than an older instance's advertised MCP schema lists: `question` (a question's
text), `for` and `level` (a request's consumer and the seam's level) and `blockedReason` are accepted on create, by
MCP and by `POST /items` alike. Pass every field the item needs in the one `create_item` call. Only if the client
refuses a field outside the advertised schema, create without it and set it with one `update_item`. That
works for every field except on a question: its `question`, `title`, `options`, `blocks` and `status` belong to
the desk, so patching them needs the `admin` scope (a work token gets `forbidden`). File a question with
everything in the one `create_item` call, or with `release {outcome:"blocked", question}`.

### Knowledge
| tool | purpose | scope | REST |
|---|---|---|---|
| `search_knowledge` | ranked search over decisions, answered questions, charters and decision docs; each hit has a key to cite | read | `GET /knowledge/search?q=…` |
| `why` | for a topic or an item key, the decisions, answers and docs that bear on it | read | `GET /knowledge/why?topic=…` or `?key=…` |
| `get_history` | an item's history across events, code changes and releases, oldest first | read | `GET /items/{key}/history` |

### Docs and the mirror
| tool | purpose | scope | REST |
|---|---|---|---|
| `submit_doc` | submit markdown at a docs-repository path, linked to items; the mirror commits it | work | `POST /docs` |
| `mirror_status` | the docs still waiting for the mirror (up to 100) | read | `GET /mirror/status` (mirror configuration, last run and commit, last error, conflicts and a pending count; the pending docs themselves: `GET /docs?status=pending&limit=500`) |
| `append_event` | a journal line on an item (note, commit, status) or on `<domain>:journal` (kind journal). Data keys only the server writes (`approver`, `approvalBackfilled`, `via`, `ticketComment`, `tool`, `comment`, any case) are dropped and named in the answer's `stripped` | work | `POST /items/{key}/events` |

### Code changes and releases
| tool | purpose | scope | REST |
|---|---|---|---|
| `list_changes` | pull requests and branches linked to work, newest first | read | `GET /changes` |
| `list_releases` | deployments, releases and package publishes with what shipped | read | `GET /releases` |
| `open_change` | open a pull request through the repository's git host and link it to items; merging stays with people | work | `POST /changes` |

### Routing
| tool | purpose | scope | REST |
|---|---|---|---|
| `get_policy` | a domain's routing policy, if one is configured (null is normal) | read | `GET /domains/{id}/policy` |
| `route_item` | evaluate one item against its domain's routing policy; read-only, claims nothing | read | `POST /items/{key}/route` |

## REST only
`GET /me`, `GET /ping`, `GET /tickets` and `GET /tickets/{key}` (the ticket table: filters, `sort`, `dir` and
`groupBy` = domain, status, assignee, tier or release), `GET /tickets/export?format=csv|json` (the table's filter,
unpaged), `POST /items/{key}/watch` (work), `GET /docs` and `GET /docs/{id}` (submitted docs), `GET /knowledge/status`
(read), `GET /templates` (read), `PATCH /templates` (admin), and the caller's own saved Tickets filters:
`GET /filters`, `POST /filters`, `PATCH /filters/{id}` (`If-Match`) and `DELETE /filters/{id}` (read scope; a filter
is the principal's own, in one project, and its `url` is the shareable `/tickets?<query>`), and the ticket actions
(work): `POST /items/{key}/clone`, `POST /items/{key}/convert` (`If-Match`; task, feature or question; converting an
open question that holds nothing needs answer scope) and the caller's own comment's `PATCH` or
`DELETE /items/{key}/comments/{id}` within 15 minutes of posting it. Admin: the token registry (`/agents`), import,
mirror run and conflicts, escalation and routing policy writes, knowledge reindex (a project admin's rebuilds and
curates its own project's entries only), knowledge entries (`POST /admin/knowledge/entries` imports and the paged
`GET /admin/knowledge/entries` lists, both within the caller's read scope; a restricted caller's import reports the
links it refused under `dropped`) and the link sweep (`GET /admin/links`, `POST /admin/links/clean`; a project admin's
covers its own project only, with links into other projects masked). A skill in this plugin never
calls an admin route unless the charter hands it that job.
