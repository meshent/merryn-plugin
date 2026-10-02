# The instance — every tool a Merryn instance serves, and its REST twin

A Merryn instance serves one tenant. It exposes the same services twice: an MCP server at `POST /mcp`
(JSON-RPC 2.0 over streamable HTTP, plain JSON responses) and a REST API under `/api/v1`. Both take the same
bearer token (`Authorization: Bearer mk_…`), the same scopes and the same rate limit, so a skill may use either
and get the same behaviour. `GET /api/openapi.json` is the REST schema.

**Scopes.** `read` sees; `work` pulls, claims, writes items and submits docs; `admin` answers the desk,
reopens questions and changes charters. `tools/list` only shows the tools your token's scopes allow; a call
without the scope answers `forbidden`.

**Binding.** Each device registers the instance as a user-scope MCP server (the plugin README shows how; the
server name is whatever the device chose, `merryn-<tenant>` by convention). Without MCP, call the REST route below
at the same host, passing the header through a file curl reads rather than on the command line:
`curl -sS -H @<(printf 'Authorization: Bearer %s\n' "$<VARIABLE>") https://<instance-host>/api/v1/...`.
Never print a token.

## The tool map

One line each: what it does · scope · REST twin (relative to `/api/v1`).

### Session
| tool | purpose | scope | REST |
|---|---|---|---|
| `initialize` (MCP method, not a tool) | handshake; its `instructions` carry the working loop, which wins over any skill text | any valid token | none (`GET /me`, read scope, says who the token is) |

### Domains (the project's charters)
| tool | purpose | scope | REST |
|---|---|---|---|
| `list_domains` | every domain with its position banner and repo policy | read | `GET /domains` |
| `get_domain` | one domain: the binding charter, position banner, repo policy, counts, recent journal, ETag | read | `GET /domains/{id}` |
| `update_domain` | patch a domain with its ETag; lanes may change position, flags, lastActivity; every other field (title, repo, repos, charter, charterSummary, repoPolicy, queues) needs admin | work (admin for other fields) | `PATCH /domains/{id}` with `If-Match` |

### Items (tickets, features, questions, requests, notes, decisions)
| tool | purpose | scope | REST |
|---|---|---|---|
| `list_items` | filtered list (domain, kind, status, tier, repo, q, limit, default 100); each entry is key, domain, kind, status, tier, priority, repo, title and the live lease holder; body, acceptance criteria, `blockedReason`, `blocks`, `dependsOn` and links are omitted (`get_item` each, or use the REST twin) | read | `GET /items?…` (adds owner and leased filters, returns full items, default limit 1000) |
| `get_item` | one item: body, acceptance criteria, links, ETag, recent events | read | `GET /items/{key}` (events: `GET /items/{key}/events`) |
| `create_item` | create a task, feature, question, request, note or decision | work | `POST /items` |
| `update_item` | patch fields with the item's ETag (412 when stale); status never becomes in-progress this way | work | `PATCH /items/{key}` with `If-Match` |

### Checkout (leases)
| tool | purpose | scope | REST |
|---|---|---|---|
| `pull_work` | select the next eligible item and claim it in one step; `pulled:false` lists why candidates were skipped | work | `POST /work/pull` |
| `claim` | take one named item; one live lease per session label (per token without a label) | work | `POST /items/{key}/claim` |
| `heartbeat` | extend your lease by its original TTL; every 15 minutes; `not-holder` means stop | work | `POST /items/{key}/heartbeat?session=<label>` (the label is a query parameter) |
| `release` | end the lease: `done` (+commits), `blocked` (+question), `handoff` (+resumeFrom), `abandon` | work | `POST /items/{key}/release` |
| `list_active` | every live lease: holder, session, branch, since when (filter by repo, domain) | read | `GET /work/active` |

### The desk (questions and decisions)
| tool | purpose | scope | REST |
|---|---|---|---|
| `list_open_questions` | every open question with what each one holds (unbounded) | read | `GET /items?kind=question&status=todo` (full items, default limit 1000, `limit` up to 5000) |
| `answer_question` | record an answer with provenance; returns the items it held to todo | admin | `POST /items/{key}/answer` |
| `reopen_question` | the veto: archive the answer, return the question to the desk, hold its items again | admin | `POST /items/{key}/reopen` |
| `desk_evaluate` | deterministic signals for one question: escalation categories hit, candidate decisions, similar and duplicate questions; decides nothing | read | `GET /desk/evaluate/{key}` |
| `get_escalation_policy` | the categories that always go to a person (tenant default overlaid by the domain's) | read | `GET /escalation-policy`, `GET /domains/{id}/escalation-policy` |
| `get_decision` | one decision or answered question, its citations and its supersededBy chain | read | `GET /decisions/{key}` |
| `list_decisions` | decisions and answered questions (domain, category, since, q) | read | `GET /decisions` |

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
| `append_event` | a journal line on an item (note, commit, status) or on `<domain>:journal` (kind journal) | work | `POST /items/{key}/events` |

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
`GET /me`, `GET /ping`, `GET /tickets` and `GET /tickets/{key}` (the ticket table), `GET /docs` and
`GET /docs/{id}` (submitted docs), `GET /knowledge/status` (read). Admin: the token registry (`/agents`), import,
mirror run and conflicts, escalation and routing policy writes, knowledge reindex. A skill in this plugin never
calls an admin route unless the charter hands it that job.
