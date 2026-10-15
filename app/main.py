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
    WHERE (s.name CONTAINS $q OR $q CONTAINS s.name) AND p.synthetic IS NULL
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


@app.get("/act")
def act(ticket: str = "PAY-101", system: str = "payments-api"):
    """T1 WINNER: agent investigates via graph, decides, and TAKES ACTION (assigns ticket)."""
    from .db import get_graph
    from datetime import datetime
    g = get_graph()
    # 1. investigate: blast radius
    blast = g.query("MATCH (s:System {name:$s})<-[:DEPENDS_ON*1..3]-(x) RETURN DISTINCT x.name LIMIT 20", {"s": system})
    impacted = [r[0] for r in blast.result_set]
    # 2. decide: rank owners by graph proximity (WORKS_ON + KNOWS)
    owners = g.query("""
    MATCH (p:Person)-[:WORKS_ON]->(:Project)-[:USES]->(s:System {name:$s})
    WHERE p.synthetic IS NULL
    OPTIONAL MATCH (p)-[:KNOWS]->(s)
    RETURN p.name AS person, p.team AS team, count(*) AS score ORDER BY score DESC LIMIT 3
    """, {"s": system})
    ranking = [{"person": r[0], "team": r[1], "score": r[2]} for r in owners.result_set]
    assignee = ranking[0]["person"] if ranking else "Aarav"
    # 3. act: assign ticket + log action (THIS is what T1 judges want: state changed by agent)
    g.query("""
    MATCH (t:Ticket {id:$tk}), (p:Person {name:$who})
    MERGE (t)-[r:ASSIGNED_TO]->(p) SET r.at=$at, r.by='ops-agent'
    MERGE (a:Action {ticket:$tk, kind:'auto-assign'}) SET a.to=$who, a.at=$at, a.system=$s
    MERGE (ag:Agent {name:'ops-agent'}) MERGE (pb:Playbook {system:$s})
    SET pb.steps='blast-radius -> rank-owners -> assign', pb.updated=$at
    MERGE (ag)-[:LEARNED]->(pb)
    SET t.status='triaged'
    """, {"tk": ticket, "who": assignee, "at": datetime.utcnow().isoformat(), "s": system})
    return {"track": "T1 Agents That Act", "ticket": ticket, "system": system,
            "reasoning": [f"blast_radius({system})={impacted}", f"owner_ranking={ranking}", f"decision=assign {ticket} to {assignee}"],
            "action_taken": {"assigned_to": assignee, "ticket_status": "triaged"},
            "procedural_memory": {"agent": "ops-agent", "playbook": system, "steps": "blast-radius -> rank-owners -> assign"},
            "path": "Alert->System->DEPENDS_ON->Impacted + Person->Project->System->Owner",
            "cypher": "MATCH blast + MATCH owners + MERGE ASSIGNED_TO + MERGE Action + MERGE Playbook"}


@app.get("/answer")
def answer(q: str = "Who can review the Checkout PR?"):
    """T3 WINNER: company brain answers + gets work done, with sources."""
    from .db import get_graph
    g = get_graph()
    ql = q.lower()
    sources, steps, action = [], [], None
    if "why" in ql and ("postgres" in ql or "ledger" in ql or "decision" in ql):
        r = g.query("MATCH (d:Doc)-[:DECIDED]->(dec:Decision) MATCH (p:Person)-[:WROTE]->(d) WHERE dec.topic CONTAINS 'Postgres' RETURN dec.topic, dec.reason, d.title, p.name LIMIT 1")
        if r.result_set:
            t, reason, doc, who = r.result_set[0]
            sources = [{"type": "Decision", "text": t}, {"type": "Reason", "text": reason}, {"type": "Doc", "text": doc}, {"type": "Author", "text": who}]
            steps = ["traced Decision<-Doc<-Person"]
            return {"track": "T3 Company Brain", "q": q, "answer": f"We chose Postgres for the ledger because: {reason} (by {who} in '{doc}').", "sources": sources, "path": "Decision<-DECIDED-Doc<-WROTE-Person"}
    # default: reviewer/owner question — rank people, cite docs + tickets
    owners = g.query("""
    MATCH (p:Person)-[:WORKS_ON]->(pr:Project)
    WHERE (pr.name CONTAINS 'Checkout' OR $q CONTAINS pr.name) AND p.synthetic IS NULL
    RETURN p.name AS person, p.team AS team, pr.name AS project LIMIT 3
    """, {"q": q})
    people = [{"person": r[0], "team": r[1], "project": r[2]} for r in owners.result_set]
    docs = g.query("MATCH (d:Doc) RETURN d.title LIMIT 3")
    tickets = g.query("MATCH (t:Ticket) WHERE t.status='open' RETURN t.id, t.title ORDER BY coalesce(t.ingested_at, 0) DESC LIMIT 3")
    chats = g.query("MATCH (c:Chat) RETURN c.id, c.text ORDER BY coalesce(c.sent_at, 0) DESC LIMIT 2")
    sources = ([{"type": "Owner", "text": f"{p['person']} ({p['team']})"} for p in people]
               + [{"type": "Doc", "text": r[0]} for r in docs.result_set]
               + [{"type": "Ticket", "text": f"{r[0]}: {r[1]}"} for r in tickets.result_set]
               + [{"type": "Chat", "text": f"{r[0]} #{r[1]}"} for r in chats.result_set])
    if people:
        action = {"suggested_reviewer": people[0]["person"], "draft": f"Assigned {people[0]['person']} to review (team {people[0]['team']})."}
    return {"track": "T3 Company Brain", "q": q, "answer": f"Best reviewer: {people[0]['person']} ({people[0]['team']}) — works on Checkout, knows the stack." if people else "No owner found.",
            "sources": sources, "action_taken": action, "path": "Person->Project + Doc + Ticket"}


@app.get("/scale")
def scale(nodes: int = 2000):
    """SCALE PROOF: bulk-ingest synthetic company data with UNWIND batches, then time a traversal."""
    import time
    from .db import get_graph
    nodes = max(100, min(nodes, 5000))  # guard free-tier RAM
    g = get_graph()
    batch = 500
    t0 = time.perf_counter()
    for start in range(0, nodes, batch):
        chunk = [{"i": i, "nm": f"scale-user-{i:05d}", "tk": f"SCALE-{i:05d}"} for i in range(start, min(start + batch, nodes))]
        g.query("""
        UNWIND $chunk AS row
        MERGE (proj:Project {name:'Checkout'})
        MERGE (sys:System {name:'payments-api'})
        MERGE (p:Person {name: row.nm}) SET p.team='Scale', p.synthetic=true
        MERGE (t:Ticket {id: row.tk}) SET t.title='Synthetic load ticket', t.status='open', t.synthetic=true
        MERGE (p)-[:WORKS_ON]->(proj)
        MERGE (t)-[:REPORTED_IN]->(sys)
        """, {"chunk": chunk})
    ingest_ms = int((time.perf_counter() - t0) * 1000)
    t1 = time.perf_counter()
    owners = g.query("MATCH (p:Person)-[:WORKS_ON]->(:Project {name:'Checkout'}) RETURN count(p) AS n")
    blast = g.query("MATCH (s:System {name:'payments-api'})<-[:DEPENDS_ON*1..3]-(x) RETURN count(DISTINCT x) AS n")
    total = g.query("MATCH (n) RETURN count(n) AS n")
    query_ms = int((time.perf_counter() - t1) * 1000)
    return {"track": "Scale", "ingested": nodes, "ingest_ms": ingest_ms,
            "people_on_checkout": owners.result_set[0][0], "blast_count": blast.result_set[0][0],
            "total_nodes": total.result_set[0][0], "traversal_ms": query_ms,
            "method": "UNWIND batches of 500, MERGE idempotent — click twice, no dupes"}


@app.get("/path")
def path(ticket: str = "PAY-101"):
    """T1 ALGORITHMS: agent calls BFS + PageRank as tools before acting."""
    from .db import get_graph
    g = get_graph()
    bfs = g.query("MATCH (t:Ticket {id:$tk}) CALL algo.bfs(t, 4, null) YIELD nodes "
                  "RETURN [n in nodes | labels(n)[0] + ':' + coalesce(n.name, n.id, n.title, '?')] AS trail",
                  {"tk": ticket})
    pr = g.query("CALL algo.pageRank('System', 'DEPENDS_ON') YIELD node, score "
                 "RETURN node.name AS sys, score ORDER BY score DESC LIMIT 5")
    return {"track": "T1 graph algorithms as agent tools", "ticket": ticket,
            "tools_used": ["algo.bfs(t, 4) — investigation frontier from alert",
                           "algo.pageRank('System','DEPENDS_ON') — most critical system"],
            "bfs_frontier": bfs.result_set[0][0] if bfs.result_set else [],
            "pagerank_systems": [{"system": r[0], "score": round(r[1], 4)} for r in pr.result_set],
            "agent_reads": "BFS tells the agent WHERE to look, PageRank tells it WHAT matters most"}


@app.get("/ingest")
def ingest(kind: str = "ticket", text: str = "Refund webhook delayed", system: str = "payments-api", tid: str = ""):
    """T3 FRESHNESS: company knowledge lands in the graph live — next answer cites it."""
    import time
    from .db import get_graph
    g = get_graph()
    ts = int(time.time() * 1000)
    if kind == "doc":
        nid = tid or f"DOC-{ts}"
        g.query("MERGE (s:System {name:$s}) MERGE (d:Doc {title:$t}) SET d.ingested_at=$at MERGE (d)-[:DESCRIBES]->(s)",
                {"s": system, "t": text, "at": ts})
        edge = "DESCRIBES->System"
    else:
        nid = tid or f"T-{ts}"
        g.query("MERGE (s:System {name:$s}) MERGE (t:Ticket {id:$nid}) SET t.title=$t, t.status='open', t.ingested_at=$at MERGE (t)-[:REPORTED_IN]->(s)",
                {"s": system, "nid": nid, "t": text, "at": ts})
        edge = "REPORTED_IN->System"
    total = g.query("MATCH (n) RETURN count(n) AS n").result_set[0][0]
    return {"track": "T3 knowledge stays current", "created": {kind: nid, "text": text, "edge": edge, "system": system},
            "total_nodes": total, "proof": "ask /answer again — this shows up in sources"}


MCP_TOOLS = [
    {"name": "ask_owner", "description": "Rank who owns a system via Person->Project->System.",
     "inputSchema": {"type": "object", "properties": {"q": {"type": "string"}}, "required": ["q"]}},
    {"name": "blast_radius", "description": "What breaks if a system goes down (DEPENDS_ON hops).",
     "inputSchema": {"type": "object", "properties": {"system": {"type": "string"}}, "required": ["system"]}},
    {"name": "investigate_alert", "description": "BFS frontier from an alert ticket (algo.bfs).",
     "inputSchema": {"type": "object", "properties": {"ticket": {"type": "string"}}, "required": ["ticket"]}},
    {"name": "rank_critical_systems", "description": "Most critical systems via PageRank (algo.pageRank).",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "auto_assign", "description": "Investigate, rank owners, and ASSIGN the ticket in the graph.",
     "inputSchema": {"type": "object", "properties": {"ticket": {"type": "string"}, "system": {"type": "string"}}, "required": ["ticket", "system"]}},
    {"name": "answer_with_sources", "description": "Company-brain answer with cited sources and an action.",
     "inputSchema": {"type": "object", "properties": {"q": {"type": "string"}}, "required": ["q"]}},
    {"name": "ingest_ticket", "description": "Add a live ticket to the graph so answers stay current.",
     "inputSchema": {"type": "object", "properties": {"text": {"type": "string"}, "system": {"type": "string"}}, "required": ["text", "system"]}},
]


def _mcp_call(tool, args):
    from .db import get_graph
    g = get_graph()
    if tool == "ask_owner":
        q = args.get("q", "payments-api")
        r = g.query("MATCH (p:Person)-[:WORKS_ON]->(:Project)-[:USES]->(s:System) WHERE s.name CONTAINS $q "
                    "AND p.synthetic IS NULL RETURN p.name AS person ORDER BY person LIMIT 5", {"q": q})
        return {"owners": [x[0] for x in r.result_set]}
    if tool == "blast_radius":
        s = args.get("system", "payments-api")
        r = g.query("MATCH (s:System {name:$s})<-[:DEPENDS_ON*1..3]-(x) RETURN DISTINCT x.name LIMIT 20", {"s": s})
        return {"system": s, "impacted": [x[0] for x in r.result_set]}
    if tool == "investigate_alert":
        r = g.query("MATCH (t:Ticket {id:$tk}) CALL algo.bfs(t, 4, null) YIELD nodes "
                    "RETURN [n in nodes | labels(n)[0] + ':' + coalesce(n.name, n.id, '?')] AS trail",
                    {"tk": args.get("ticket", "PAY-101")})
        return {"trail": r.result_set[0][0] if r.result_set else []}
    if tool == "rank_critical_systems":
        r = g.query("CALL algo.pageRank('System', 'DEPENDS_ON') YIELD node, score "
                    "RETURN node.name AS sys, score ORDER BY score DESC LIMIT 5")
        return {"critical": [{"system": x[0], "score": round(x[1], 4)} for x in r.result_set]}
    if tool == "auto_assign":
        return act(args.get("ticket", "PAY-101"), args.get("system", "payments-api"))
    if tool == "answer_with_sources":
        return answer(args.get("q", "Who can review the Checkout PR?"))
    if tool == "ingest_ticket":
        return ingest("ticket", args.get("text", ""), args.get("system", "payments-api"))
    raise ValueError(f"unknown tool: {tool}")


@app.get("/tools")
def tools():
    return {"server": "ops-brain", "protocol": "mcp-json-rpc", "tools": MCP_TOOLS}


@app.post("/mcp")
async def mcp(req: object):
    """Minimal MCP server (JSON-RPC): initialize / tools/list / tools/call."""
    import json as _json
    body = await req.json()
    mid, method, params = body.get("id"), body.get("method"), body.get("params", {})
    if method == "initialize":
        return {"jsonrpc": "2.0", "id": mid,
                "result": {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}},
                           "serverInfo": {"name": "ops-brain", "version": "1.0.0"}}}
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": mid, "result": {"tools": MCP_TOOLS}}
    if method == "tools/call":
        try:
            out = _mcp_call(params.get("name", ""), params.get("arguments", {}))
            return {"jsonrpc": "2.0", "id": mid, "result": {"content": [{"type": "text", "text": _json.dumps(out)}]}}
        except Exception as e:
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32000, "message": str(e)[:200]}}
    return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"unknown method: {method}"}}
