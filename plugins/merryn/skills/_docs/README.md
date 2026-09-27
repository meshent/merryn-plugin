# The docs contract

Every round that changes something leaves one decision doc. The instance is never the only copy: a doc goes
in through `submit_doc` and the mirror commits it to the tenant's docs repository. Nobody commits these docs by
hand.

## Where
- `outputs/<domain>/decisions/YYYY-MM-DD-<slug>.md` for a round's decision doc (the usual case).
- `features/decisions/FEAT-<nnnn>.md` for a feature's standing design record.
Paths the mirror renders from the store (the runbook directory, `features/queues/`, files at the top of the
features directory, imported sources) are refused with `renderer-owned` unless the token is admin; pick a
path under `outputs/`.

## Shape
```markdown
---
date: YYYY-MM-DD
run: <what produced it: feature | run | sweep | coordinator, with the model>
commits: [<repo>@<sha>, ...]
related: [<item keys, question keys, other doc paths>]
---
# <title>

## Intent
Why this change exists: the item, the problem, the decisions taken (and the ones taken without a question,
marked for veto), what was deliberately left out.

## Usage
How to use what landed: commands, routes, configuration, with the test counts per project and the review
findings (fixed, refuted, open).
```
Both headings are required, in that order. Front matter keys are `date`, `run`, `commits` and `related`.

## Delivery
`submit_doc {path, markdown, items:[<keys>]}` (REST `POST /api/v1/docs` with the same body). `items` links the
doc to the work it records: `get_item` lists it under `links.docs` and `why {key}` finds it once the knowledge
index has it (`get_history` shows it only for a decision, which records the citation as an event). The doc is queued until the mirror runs;
`mirror_status` shows it pending. A doc that is still pending is recorded, not lost.
