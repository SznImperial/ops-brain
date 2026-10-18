# Ops Brain — Company Brain that Remembers + Acts

**Graph Hacks (Oct 15–18, 2026) · Solo entry · All 3 tracks: T1 Agents That Act · T2 Memory + Coordination · T3 Company Brain**

| | |
|---|---|
| 🎥 **Demo video** | https://www.loom.com/share/29ddc85394764764b898bf3bfe2a1440 |
| 🌐 **Live demo** | https://ops-brain.netlify.app |
| 💻 **Repo** | https://github.com/SznImperial/ops-brain |
| 🗄️ **Graph** | FalkorDB Cloud — one graph, `company_brain`, 4,024 nodes at recording (4,035 now; it grows as tickets are ingested) |

---

## The problem

Most "AI agents" answer from vector chunks. That works for prose, and fails at everything an operator actually asks:

- *Who owns `payments-api`?* — chunks don't know ownership.
- *What breaks if it goes down?* — similarity search can't follow dependencies.
- *Why did we choose Postgres?* — the answer lives in a decision, a doc, and an author, not one paragraph.
- *What did this user ask last session?* — there is no session.
- *Can the agent fix it, not just describe it?* — chat completion has no write path.

**Ops Brain** puts company knowledge in a property graph and lets the agent traverse it: answer with sources, remember across sessions, and change the graph when it acts.

---

## What it does

One FalkorDB graph holds people, projects, systems, docs, tickets, chats, decisions, users, agents and their actions. A single API (Python FastAPI + TypeScript Netlify Functions, identical semantics) exposes graph operations as agent tools.

| Track | Question it answers | Graph operation |
|---|---|---|
| **T3 Company Brain** | Who knows this? Why did we decide that? | Multi-hop ownership, decision trace, cited sources |
| **T2 Memory** | What did this user ask? What do we know about them? | Episodic + semantic memory, tenant isolation, handoffs |
| **T1 Agents That Act** | What breaks, who fixes it, and do it | Blast radius → owner ranking → **assign in the graph** |

Every answer carries sources. Every action leaves a node. Nothing is a mock — remove FalkorDB and the product returns 500.

---

## See it in 90 seconds

Open https://ops-brain.netlify.app and click down the page. The cards are grouped by track:

1. **T3** — `ASK` → `ANSWER WITH SOURCES` → `WHY POSTGRES?` → type a ticket → `ADD TICKET TO GRAPH` → `ANSWER` again (the new ticket appears in sources).
2. **T1** — `BLAST` → `TRIAGE PAY-101 NOW` (graph is written: `ASSIGNED_TO` + `Action` + `Playbook`) → `RUN ALGORITHMS` → `CALL TOOL`.
3. **Scale** — `INGEST + TIME IT` with 2000.
4. **T2** — `REMEMBER` → `SAVE FACT` (`team = Checkout`) → change tenant to `acme` → `REMEMBER` → `BURST 20x` → `HANDOFF`.

---

## Architecture

```
┌──────────────────────────────┐
│  Neo-brutalist UI (Netlify) │  public/index.html — no framework, motion + reduced-motion
└──────────────┬───────────────┘
               │ fetch /.netlify/functions/<name>
┌──────────────▼───────────────┐        ┌────────────────────────────┐
│ TypeScript functions (prod)  │───────▶│   FalkorDB Cloud           │
│ falkordb-ts, one conn/req    │        │   graph: company_brain     │
└──────────────────────────────┘        │   Cypher + algo.bfs        │
┌──────────────────────────────┐        │   algo.pageRank            │
│ Python FastAPI (local/mirror)│───────▶│   ~4,000 nodes / ~4,000 edges│
│ uvicorn app.main:app         │        └────────────────────────────┘
└──────────────────────────────┘
```

- **Production path:** Netlify static site + serverless functions (`netlify/functions/*.ts`), talking to FalkorDB Cloud over TLS.
- **Local/mirror path:** `app/main.py` (FastAPI) implements the same routes 1:1 — useful for testing the graph without a deploy.
- **Agent path:** `/mcp` speaks MCP JSON-RPC, so any MCP client can discover and call the same seven tools.

### Repo layout

```
app/
  main.py           FastAPI routes — every track's logic
  db.py             FalkorDB connection
  seed.py           hand-authored demo company (people, systems, docs, chats, decisions)
  queries.cypher    judge-facing Cypher for every query used
netlify/functions/  ask|blast|memory|handoff|act|answer|scale|path|ingest|mcp|burst|tools
public/index.html   the whole UI
netlify.toml        publish public, functions netlify/functions, esbuild
```

---

## Graph model

```
                        ┌──────────┐
              ┌────────▶│  System  │◀────────┐
              │ USES    └────┬─────┘         │
        ┌─────┴─────┐       │ DEPENDS_ON    │ REPORTED_IN
        │  Project  │       ▼               │
        └─────▲─────┘  ┌──────────┐    ┌────┴────┐
              │        │  System  │    │ Ticket  │
         WORKS_ON      └──────────┘    └────┬────┘
              │                             │ ASSIGNED_TO
        ┌─────┴─────┐   KNOWS         ┌─────▼─────┐
        │  Person   │────────────────▶│  Person   │
        └───────────┘                 └───────────┘

  Knowledge:  (Doc)-[:DESCRIBES]->(System)   (Chat)-[:MENTIONS]->(System|Project)
              (Doc)-[:DECIDED]->(Decision)   (Person)-[:WROTE]->(Doc)
  Memory:     (User)-[:ASKED {at}]->(Question)   (User)-[:KNOWS_FACT]->(Fact)
              (Agent)-[:HANDS_OFF {ticket,summary}]->(Agent)
              (Agent)-[:LEARNED]->(Playbook)
  Action:     (Ticket)-[:ASSIGNED_TO {at,by}]->(Person)
              (:Action {ticket,kind,to,at,system})
```

**Why these edges exist**

| Edge | Enables |
|---|---|
| `Person-[:WORKS_ON]->Project-[:USES]->System` | Ownership ranking without a lookup table |
| `System-[:DEPENDS_ON]->System` | Variable-length blast radius, PageRank criticality |
| `Ticket-[:REPORTED_IN]->System` | Fresh incidents join the same neighbourhood as owners |
| `Doc-[:DECIDED]->Decision` + `Person-[:WROTE]->Doc` | Decision tracing: topic → reason → doc → author |
| `Chat-[:MENTIONS]->System` | Slack context is citable, not lost |
| `User-[:ASKED]->Question` | Episodic memory with timestamps |
| `User-[:KNOWS_FACT]->Fact` | Semantic memory (`team = Checkout`) |
| `Ticket-[:ASSIGNED_TO]->Person` | T1's write path — the agent changes state |
| `Agent-[:LEARNED]->Playbook` | Procedural memory: the next session reuses the triage steps |

**Node properties that matter**

- `Person.synthetic` — bulk-load nodes are flagged and excluded from every ranking, so scale data never pollutes a real answer.
- `Ticket.status`, `Ticket.ingested_at` — freshness ordering (`ORDER BY coalesce(ingested_at, 0) DESC`).
- `Action.*` — audit trail of what the agent did, when, and to whom.

Full runnable queries: [`app/queries.cypher`](app/queries.cypher) — 26 statements, each validated against the live graph with `EXPLAIN` before submission.

---

## The queries that do the work

**T3 — ownership through the graph (parameterised, no string interpolation):**
```cypher
MATCH (p:Person)-[:WORKS_ON]->(:Project)-[:USES]->(s:System)
WHERE (s.name CONTAINS $q OR $q CONTAINS s.name) AND p.synthetic IS NULL
RETURN p.name AS person, count(*) AS projects
ORDER BY projects DESC LIMIT 5
```

**T3 — decision trace (why Postgres, not just "Postgres"):**
```cypher
MATCH (d:Doc)-[:DECIDED]->(dec:Decision)
MATCH (p:Person)-[:WROTE]->(d)
WHERE dec.topic CONTAINS 'Postgres'
RETURN dec.topic, dec.reason, d.title, p.name LIMIT 1
```

**T1 — blast radius (variable-length, direction matters):**
```cypher
MATCH (s:System {name:$s})<-[:DEPENDS_ON*1..3]-(x)
RETURN DISTINCT x.name AS impacted LIMIT 20
```

**T1 — algorithms as tools:**
```cypher
MATCH (t:Ticket {id:$tk}) CALL algo.bfs(t, 4, null) YIELD nodes
RETURN [n IN nodes | labels(n)[0] + ':' + coalesce(n.name, n.id, n.title, '?')] AS trail;

CALL algo.pageRank('System', 'DEPENDS_ON') YIELD node, score
RETURN node.name AS sys, score ORDER BY score DESC LIMIT 5
```

**T1 — the action (write path):**
```cypher
MATCH (t:Ticket {id:$tk}), (p:Person {name:$who})
MERGE (t)-[r:ASSIGNED_TO]->(p) SET r.at=$at, r.by='ops-agent'
MERGE (a:Action {ticket:$tk, kind:'auto-assign'}) SET a.to=$who, a.at=$at, a.system=$s
MERGE (ag:Agent {name:'ops-agent'}) MERGE (pb:Playbook {system:$s})
SET pb.steps='blast-radius -> rank-owners -> assign', pb.updated=$at
MERGE (ag)-[:LEARNED]->(pb)
SET t.status='triaged'
```

**T2 — memory + tenant isolation** (`acme:u9` and `stark:u9` are distinct nodes):
```cypher
MERGE (u:User {id:$uid})
CREATE (u)-[:ASKED {at:$at}]->(:Question {text:$q})

MERGE (u:User {id:$uid}) MERGE (f:Fact {k:$k, v:$v})
MERGE (u)-[r:KNOWS_FACT]->(f) SET r.at=$at
```

**Scale — idempotent bulk load (click it twice, no duplicates):**
```cypher
UNWIND $chunk AS row
MERGE (proj:Project {name:'Checkout'})
MERGE (sys:System {name:'payments-api'})
MERGE (p:Person {name: row.nm}) SET p.team='Scale', p.synthetic=true
MERGE (t:Ticket {id: row.tk}) SET t.title='Synthetic load ticket', t.status='open', t.synthetic=true
MERGE (p)-[:WORKS_ON]->(proj)
MERGE (t)-[:REPORTED_IN]->(sys)
```

---

## API reference

Base URL (live): `https://ops-brain.netlify.app/.netlify/functions`
Local: `http://127.0.0.1:8000`

| Method | Route | Params | Returns |
|---|---|---|---|
| GET | `/ask` | `q` | Ranked owners + the Cypher used |
| GET | `/answer` | `q` | Answer, cited sources (Owner/Doc/Ticket/Chat), suggested action |
| GET | `/blast` | `system` | Impacted systems within 3 `DEPENDS_ON` hops |
| GET | `/act` | `ticket`, `system` | Reasoning, assignee, new status, playbook |
| GET | `/path` | `ticket` | BFS frontier + PageRank ranking |
| GET | `/ingest` | `kind=ticket\|doc`, `text`, `system`, `tid` | New node + total count |
| GET | `/memory` | `uid`, `q`, `fact`, `tenant` | History + semantic facts |
| GET | `/handoff` | `ticket`, `frm`, `to`, `summary` | Handoff edges |
| GET | `/burst` | `n` | Parallel read results + latency |
| GET | `/scale` | `nodes` | Ingest/traversal timings, totals |
| GET | `/tools` | — | Tool catalogue |
| POST | `/mcp` | JSON-RPC body | `initialize` / `tools/list` / `tools/call` |

### Examples

```bash
# T3 — answer with sources
curl "https://ops-brain.netlify.app/.netlify/functions/answer?q=Who%20can%20review%20the%20Checkout%20PR%3F"
```
```json
{
  "track": "T3 Company Brain",
  "q": "Who can review the Checkout PR?",
  "answer": "Best reviewer: Aarav (Payments) — works on Checkout, knows the stack.",
  "sources": [
    {"type": "Owner",  "text": "Aarav (Payments)"},
    {"type": "Owner",  "text": "Zainab (Checkout)"},
    {"type": "Doc",    "text": "Payments retry design"},
    {"type": "Doc",    "text": "Checkout ownership"},
    {"type": "Ticket", "text": "T-1792029176745: Refund webhook delayed"},
    {"type": "Chat",   "text": "slack-pay-2 #Zainab: checkout-web also affected, same root cause"},
    {"type": "Chat",   "text": "slack-auth-1 #login spike looks unrelated, watching auth-service"}
  ],
  "action_taken": {"suggested_reviewer": "Aarav", "draft": "Assigned Aarav to review (team Payments)."},
  "path": "Person->Project + Doc + Ticket + Chat"
}
```

```bash
# T1 — the agent acts, not just answers
curl "https://ops-brain.netlify.app/.netlify/functions/act?ticket=PAY-101&system=payments-api"
```
```json
{
  "reasoning": [
    "blast_radius(payments-api)=[\"checkout-web\",\"webhook-worker\"]",
    "owner_ranking=[{\"person\":\"Zainab\",\"team\":\"Checkout\",\"score\":1},{\"person\":\"Emeka\",\"team\":\"Platform\",\"score\":1},{\"person\":\"Aarav\",\"team\":\"Payments\",\"score\":1}]",
    "decision=assign PAY-101 to Zainab"
  ],
  "action_taken": {"assigned_to": "Zainab", "ticket_status": "triaged"},
  "procedural_memory": {"agent": "ops-agent", "playbook": "payments-api", "steps": "blast-radius -> rank-owners -> assign"},
  "path": "Alert->System->DEPENDS_ON->Impacted + Person->Project->System->Owner"
}
```

```bash
# MCP — any client can discover and call the tools
curl -X POST https://ops-brain.netlify.app/.netlify/functions/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**MCP tools:** `ask_owner`, `blast_radius`, `investigate_alert`, `rank_critical_systems`, `auto_assign`, `answer_with_sources`, `ingest_ticket`.

---

## Run it locally

```bash
# 1. Free FalkorDB Cloud instance
#    https://app.falkordb.cloud → copy host / port / username / password

# 2. Configure
cp .env.example .env        # FALKOR_HOST, FALKOR_PORT, FALKOR_USERNAME, FALKOR_PASSWORD, GRAPH_NAME

# 3. Install & seed & run
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload
# → http://127.0.0.1:8000
```

No Docker required. The seed is hand-authored and idempotent (`MERGE`, not `CREATE`).

## Deploy it (Netlify)

1. Import this repo in Netlify.
2. Build settings come from `netlify.toml` — publish `public`, functions `netlify/functions`, esbuild bundler.
3. Set environment variables: `FALKOR_HOST`, `FALKOR_PORT`, `FALKOR_USERNAME`, `FALKOR_PASSWORD`, `GRAPH_NAME=company_brain`.
4. Deploy. Functions are served at `/.netlify/functions/<name>`.

---

## Scale & performance

Measured on FalkorDB Cloud free tier — 4,024 nodes at recording (4,035 now, 4,036 edges; most edges are the 2,000 scale `WORKS_ON` + 2,000 `REPORTED_IN` pairs):

| Operation | Time |
|---|---|
| BFS from alert, depth 4 (`algo.bfs`) | ~325 ms |
| PageRank over `System` / `DEPENDS_ON` | ~292 ms |
| Owner ranking traversal | ~272 ms |
| Bulk ingest 2,000 nodes (`UNWIND` batches of 500) | reported live per run |

The load is deliberately capped (a few thousand nodes) to respect free-tier RAM. FalkorDB's traversals and algorithms are sparse-matrix based, so the same queries are designed to scale to millions of nodes — the cap is an infrastructure choice, not an algorithmic one.

---

## Engineering notes (what was actually hard)

- **`shortestPath` is not usable here** — FalkorDB rejects it undirected and only allows it inside `WITH`/`RETURN`. Replaced with `algo.bfs`, which is also more honest as an *agent tool*: it returns a frontier, not one path.
- **falkordb-ts returns objects, not arrays** — `{"p.name": "Aarav"}` rather than `["Aarav"]`. Every TS handler has an array/object pick helper; assuming arrays silently produced `undefined` in the UI.
- **Bulk load created duplicate demo nodes** — a `CREATE (:Project {name:'Checkout'})` inside the scale query added 201 duplicates. Fixed by `MERGE` on every shared node; `/scale` is now idempotent.
- **Synthetic nodes polluted answers** — after 2,000 scale users, "who owns payments-api" ranked fake users first. Every ranking query now filters `p.synthetic IS NULL`. This was caught by a local test harness before recording, not by luck.
- **Connection-per-request** — serverless functions open and close a connection per invocation; the burst endpoint demonstrates 20 parallel readers succeeding.

---

## Honest limitations

- **No LLM in the loop.** Answers are deterministic graph reads with templates. That is a deliberate trade: the demo proves retrieval and action, and a model could sit on top of `/answer`'s `sources` without changing the graph layer.
- **Hand-authored seed.** Data is synthetic and written for the demo (people, systems, docs, chats, decisions). No private data.
- **Free-tier cap.** `/scale` is capped at 5,000 nodes to avoid OOM on the free instance.
- **Tenant isolation is key-prefixing**, not row-level security — fine for a demo, not a multi-tenant SaaS boundary.
- **`/ingest` accepts text, not file uploads**; extraction/embeddings are out of scope.

---

## AI assistance disclosure

AI coding assistants were used to scaffold, debug, and review code. The architecture, graph model, Cypher queries, and every endpoint were designed and verified by the author — all routes were tested green locally and against the live deployment before recording the demo. The author can explain any file and any query in this repo.

---

## Submission checklist

- [x] Public repo — https://github.com/SznImperial/ops-brain
- [x] README with graph model + track mapping
- [x] Cypher queries — [`app/queries.cypher`](app/queries.cypher)
- [x] Live deployment — https://ops-brain.netlify.app
- [x] Demo video — https://www.loom.com/share/29ddc85394764764b898bf3bfe2a1440
- [x] FalkorDB is load-bearing — every route queries the graph; no fallback store
- [x] Tracks: T1, T2, T3 in one repo
