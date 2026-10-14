# Ops Brain — Company Brain that Remembers + Acts

Solo entry for Graph Hacks (Oct 15-18, 2026). One repo, all 3 tracks.
Tracks: T1 Agents That Act + T2 Memory/Coordination + T3 Company Brain.

## Graph model
(Person)-[:WORKS_ON]->(Project)-[:USES]->(System)
(Person)-[:KNOWS]->(System)
(Ticket)-[:REPORTED_IN]->(System)
(Doc)-[:DESCRIBES]->(System)
(User)-[:ASKED]->(Question) | (Agent)-[:HANDS_OFF]->(Agent)

## Setup (no Docker — uses FalkorDB Cloud)
1. Create free DB at https://app.falkordb.cloud
2. `cp .env.example .env` and fill HOST/PORT/USERNAME/PASSWORD
3. `pip install -r requirements.txt`
4. `python -m app.seed`
5. `uvicorn app.main:app --reload` → open http://127.0.0.1:8000

## Live demo
https://ops-brain.netlify.app — neo-brutalism UI.
- T3: `/.netlify/functions/ask?q=payments-api` → Aarav, path Person->Project->System
- T1: `/.netlify/functions/blast?system=payments-api` → checkout-web, webhook-worker
- T2: `/.netlify/functions/memory?uid=u1&q=...` + `/.netlify/functions/handoff?ticket=PAY-101`
- Python mirror: `app/main.py` (`/ask`, `/blast`, `/memory`, `/handoff`)

## Submission checklist
- [x] Public repo + this README + graph model (done here)
- [x] app/queries.cypher (the queries product depends on)
- [x] Live deployment (Netlify above) + local setup below
- [ ] Demo video (see DEMO_SCRIPT.md)
- [ ] Blog post (see BLOG_OUTLINE.md — AirPods prize)
- [x] Tracks entered: T1, T2, T3
