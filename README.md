# Ops Brain — Company Brain that Remembers + Acts

Solo entry for Graph Hacks (Oct 15–18, 2026). One repo, all 3 tracks: **T1 Agents That Act, T2 Memory + Coordination, T3 Company Brain.**

Live: https://ops-brain.netlify.app · Repo: https://github.com/SznImperial/ops-brain

## What it is
Company knowledge (people, projects, systems, docs, tickets, chats, decisions) lives in one FalkorDB graph. Agents read it to answer with sources (T3), remember users across sessions (T2), and take action — investigating alerts, ranking owners, assigning tickets (T1). Same API in Python (FastAPI, `app/main.py`) and TypeScript (Netlify Functions, `netlify/functions/`).

## Track → endpoint map
| Track | Endpoint | What the graph does |
|---|---|---|
| T3 | `/ask`, `/answer` | Owner ranking, reviewer suggestion, decision trace — every answer with cited sources (Owner/Doc/Ticket/Chat) |
| T3 | `/ingest` | New tickets/docs land in the graph live; next answer cites them |
| T1 | `/blast`, `/act` | Blast radius, owner ranking, then ASSIGNs the ticket + logs an Action node |
| T1 | `/path` | `algo.bfs` investigation frontier + `algo.pageRank` critical-system ranking as agent tools |
| T1 | `/mcp`, `/tools` | 7 tools over MCP JSON-RPC (`initialize`/`tools/list`/`tools/call`) |
| T2 | `/memory` | Episodic questions + semantic facts, namespaced per tenant (`&tenant=acme`) |
| T2 | `/handoff`, `/burst` | Agent handoffs + playbooks; N parallel readers stress test |
| All | `/scale` | Bulk UNWIND ingest + timed traversal (4,024 nodes, ~300ms queries) |

## Graph model
```
(Person)-[:WORKS_ON]->(Project)-[:USES]->(System)
(Person)-[:KNOWS]->(System)
(Ticket)-[:REPORTED_IN]->(System)
(Doc)-[:DESCRIBES]->(System)
(Chat)-[:MENTIONS]->(System)
(Doc)-[:DECIDED]->(Decision)  (Person)-[:WROTE]->(Doc)
(System)-[:DEPENDS_ON]->(System)
(User)-[:ASKED]->(Question)  (User)-[:KNOWS_FACT]->(Fact)
(Ticket)-[:ASSIGNED_TO]->(Person)  (Agent)-[:HANDS_OFF]->(Agent)
(Agent)-[:LEARNED]->(Playbook)  (:Action logs what agents did)
```
Synthetic load nodes carry `synthetic=true` and are excluded from people ranking. Full queries: `app/queries.cypher`.

## Run it locally
1. Free DB at https://app.falkordb.cloud → copy host/port/username/password
2. `cp .env.example .env` and fill values · `pip install -r requirements.txt`
3. `python -m app.seed` · `uvicorn app.main:app --reload` → http://127.0.0.1:8000

## Deploy it (Netlify)
Import this repo → publish `public`, functions `netlify/functions` (see `netlify.toml`) → set env `FALKOR_HOST`, `FALKOR_PORT`, `FALKOR_USERNAME`, `FALKOR_PASSWORD`, `GRAPH_NAME=company_brain` → deploy. Functions live at `/.netlify/functions/<name>`.

## Notes
- Data is synthetic + hand-authored for the demo; no private data.
- AI coding assistants were used to scaffold and debug; the architecture, graph model, and all queries were designed and verified by the author (every endpoint test-green before recording).
- FalkorDB Cloud free tier; demo load a few thousand nodes by choice, traversals ~300ms.

## Submission checklist
- [x] Public repo + README + graph model + `app/queries.cypher`
- [x] Live deployment (Netlify) + local setup (above) · Tracks: T1, T2, T3
- [ ] Demo video (YouTube Unlisted link goes in the WeMakeDevs submission)
- [ ] Blog post (AirPods side prize)
