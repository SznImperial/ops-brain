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

## Submission checklist
- [ ] Public repo + this README + graph model (done here)
- [ ] app/queries.cypher (the queries product depends on)
- [ ] Demo video (see DEMO_SCRIPT.md)
- [ ] Live deployment OR local setup (Render/Fly for FastAPI)
- [ ] Tracks entered: T1, T2, T3
