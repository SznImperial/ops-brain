"""FastAPI demo: Company Brain that remembers + acts. Run: uvicorn app.main:app --reload"""
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI(title="Ops Brain - Graph Hacks")

HTML = """
<h2>Ops Brain - Company Brain Demo</h2>
<form method=get action=/ask>
<input name=q style='width:400px' placeholder='Who knows payments-api?'>
<button>Ask</button></form>
<p><a href=/blast?system=payments-api>Blast radius (T1)</a> |
<a href=/memory?uid=u1>Memory u1 (T2)</a> |
<a href=/health>Health</a></p>
<p>Try: who owns payments-api / what breaks if payments-api goes down / who can review Checkout PR</p>
"""

@app.get("/", response_class=HTMLResponse)
def home():
    return HTML

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/ask")
def ask(q: str = ""):
    # Lazy import so /health works even without FalkorDB creds
    from .db import get_graph
    g = get_graph()
    # T3: ownership query (parameterized to avoid injection)
    cypher = """
    MATCH (p:Person)-[:WORKS_ON]->(:Project)-[:USES]->(s:System)
    WHERE s.name CONTAINS $q OR $q CONTAINS s.name
    RETURN p.name AS person, count(*) AS projects ORDER BY projects DESC LIMIT 5
    """
    try:
        res = g.query(cypher, {"q": q or "payments"})
        rows = [{"person": r[0], "projects": r[1]} for r in res.result_set]
    except Exception as e:
        rows = [{"error": str(e)}]
    return {"q": q, "cypher": " ".join(cypher.split()), "result": rows, "path": "Person->Project->System"}


@app.get("/blast")
def blast(system: str = "payments-api"):
    """T1: what breaks if this service goes down?"""
    from .db import get_graph
    g = get_graph()
    # ensure demo dependency chain exists (idempotent)
    g.query("""
    MERGE (s:System {name:$s})
    MERGE (c:System {name:'checkout-web'})
    MERGE (w:System {name:'webhook-worker'})
    MERGE (c)-[:DEPENDS_ON]->(s)
    MERGE (w)-[:DEPENDS_ON]->(c)
    """, {"s": system})
    res = g.query("""
    MATCH (s:System {name:$s})<-[:DEPENDS_ON*1..3]-(x)
    RETURN DISTINCT x.name AS impacted LIMIT 20
    """, {"s": system})
    return {"system": system, "impacted": [r[0] for r in res.result_set],
            "cypher": "MATCH (s:System)<-[:DEPENDS_ON*1..3]-(x) RETURN x"}


@app.get("/memory")
def memory(uid: str = "u1", q: str = ""):
    """T2: per-user episodic memory + shared handoff demo."""
    from .db import get_graph
    from datetime import datetime
    g = get_graph()
    if q:
        g.query("MERGE (u:User {id:$uid}) CREATE (u)-[:ASKED {at:$at}]->(:Question {text:$q})",
                {"uid": uid, "at": datetime.utcnow().isoformat(), "q": q})
    hist = g.query("MATCH (u:User {id:$uid})-[a:ASKED]->(q:Question) RETURN q.text, a.at ORDER BY a.at DESC LIMIT 10",
                   {"uid": uid})
    return {"uid": uid, "stored": bool(q),
            "history": [{"q": r[0], "at": r[1]} for r in hist.result_set]}


@app.get("/handoff")
def handoff(ticket: str = "PAY-101", frm: str = "Triage", to: str = "Fixer", summary: str = "payments timeout, owner Aarav"):
    """T2: multi-agent shared state."""
    from .db import get_graph
    g = get_graph()
    g.query("MERGE (a:Agent {name:$f}) MERGE (b:Agent {name:$t}) CREATE (a)-[:HANDS_OFF {ticket:$tk, summary:$sm}]->(b)",
            {"f": frm, "t": to, "tk": ticket, "sm": summary})
    res = g.query("MATCH (a:Agent)-[h:HANDS_OFF]->(b:Agent) WHERE h.ticket=$tk RETURN a.name, h.summary, b.name",
                  {"tk": ticket})
    return {"ticket": ticket, "handoff": [{"from": r[0], "summary": r[1], "to": r[2]} for r in res.result_set]}
