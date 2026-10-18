// ============================================================
// Ops Brain — the exact Cypher the product depends on
// Graph: company_brain (FalkorDB Cloud)
//
// Parameters used: $q, $system, $ticket, $uid, $tenant, $factKey,
// $factVal, $nid, $text, $at, $who, $topic, $chunk
//
// Open in FalkorDB Browser and paste a block to verify each
// claim in the README. Every query below is the one running in
// app/main.py and netlify/functions/*.ts.
// ============================================================


// ------------------------------------------------------------
// T3 — COMPANY BRAIN
// ------------------------------------------------------------

// T3.1 Who owns / knows this system?
// Multi-hop: Person -> Project -> System. The synthetic filter keeps
// bulk-load users out of real answers.
MATCH (p:Person)-[:WORKS_ON]->(:Project)-[:USES]->(s:System)
WHERE (s.name CONTAINS $q OR $q CONTAINS s.name) AND p.synthetic IS NULL
RETURN p.name AS person, count(*) AS projects
ORDER BY projects DESC LIMIT 5;

// T3.2 Why did we choose Postgres? Decision -> reason -> doc -> author.
// This is the trace a vector store cannot produce.
MATCH (d:Doc)-[:DECIDED]->(dec:Decision)
MATCH (p:Person)-[:WROTE]->(d)
WHERE dec.topic CONTAINS 'Postgres'
RETURN dec.topic, dec.reason, d.title, p.name LIMIT 1;

// T3.3 Reviewer suggestion (people on the project)
MATCH (p:Person)-[:WORKS_ON]->(pr:Project)
WHERE (pr.name CONTAINS 'Checkout' OR $q CONTAINS pr.name) AND p.synthetic IS NULL
RETURN p.name AS person, p.team AS team, pr.name AS project LIMIT 3;

// T3.4 Sources: docs, open tickets (newest first), chats
MATCH (d:Doc) RETURN d.title LIMIT 3;

MATCH (t:Ticket) WHERE t.status='open'
RETURN t.id, t.title ORDER BY coalesce(t.ingested_at, 0) DESC LIMIT 3;

MATCH (c:Chat) RETURN c.id, c.text ORDER BY coalesce(c.sent_at, 0) DESC LIMIT 2;


// ------------------------------------------------------------
// T3 — FRESHNESS (knowledge lands in the graph live)
// ------------------------------------------------------------

// T3.5 Ingest a ticket; the next /answer cites it
MERGE (s:System {name:$system})
MERGE (t:Ticket {id:$nid}) SET t.title=$text, t.status='open', t.ingested_at=$at
MERGE (t)-[:REPORTED_IN]->(s);

// T3.6 Ingest a doc instead
MERGE (s:System {name:$system})
MERGE (d:Doc {title:$text}) SET d.ingested_at=$at
MERGE (d)-[:DESCRIBES]->(s);


// ------------------------------------------------------------
// T1 — AGENTS THAT ACT
// ------------------------------------------------------------

// T1.1 Blast radius: variable-length reverse DEPENDS_ON
MATCH (s:System {name:$system})<-[:DEPENDS_ON*1..3]-(x)
RETURN DISTINCT x.name AS impacted LIMIT 20;

// T1.2 Rank owners by graph proximity (WORKS_ON + KNOWS)
MATCH (p:Person)-[:WORKS_ON]->(:Project)-[:USES]->(s:System {name:$system})
WHERE p.synthetic IS NULL
OPTIONAL MATCH (p)-[:KNOWS]->(s)
RETURN p.name AS person, p.team AS team, count(*) AS score
ORDER BY score DESC LIMIT 3;

// T1.3 ALGORITHM #1 — BFS investigation frontier from the alert ticket
MATCH (t:Ticket {id:$ticket}) CALL algo.bfs(t, 4, null) YIELD nodes
RETURN [n IN nodes | labels(n)[0] + ':' + coalesce(n.name, n.id, n.title, '?')] AS trail;

// T1.4 ALGORITHM #2 — PageRank: which system matters most
CALL algo.pageRank('System', 'DEPENDS_ON') YIELD node, score
RETURN node.name AS sys, score ORDER BY score DESC LIMIT 5;

// T1.5 THE ACTION — assign the ticket and record what the agent did.
// This is the write path: after this, the graph is different.
MATCH (t:Ticket {id:$ticket}), (p:Person {name:$who})
MERGE (t)-[r:ASSIGNED_TO]->(p) SET r.at=$at, r.by='ops-agent'
MERGE (a:Action {ticket:$ticket, kind:'auto-assign'})
  SET a.to=$who, a.at=$at, a.system=$system
MERGE (ag:Agent {name:'ops-agent'})
MERGE (pb:Playbook {system:$system})
  SET pb.steps='blast-radius -> rank-owners -> assign', pb.updated=$at
MERGE (ag)-[:LEARNED]->(pb)
SET t.status='triaged';


// ------------------------------------------------------------
// T2 — MEMORY + COORDINATION
// ------------------------------------------------------------

// T2.1 Episodic memory: store a question with a timestamp
MERGE (u:User {id:$uid})
CREATE (u)-[:ASKED {at:$at}]->(:Question {text:$q});

// T2.2 Read it back, newest first
MATCH (u:User {id:$uid})-[a:ASKED]->(q:Question)
RETURN q.text, a.at ORDER BY a.at DESC LIMIT 10;

// T2.3 Semantic memory: a fact about the user
MERGE (u:User {id:$uid})
MERGE (f:Fact {k:$factKey, v:$factVal})
MERGE (u)-[r:KNOWS_FACT]->(f) SET r.at=$at;

MATCH (u:User {id:$uid})-[:KNOWS_FACT]->(f:Fact)
RETURN f.k, f.v LIMIT 20;

// T2.4 Tenant isolation: ids are prefixed (`acme:u9`), so tenants never mix
// Note the parentheses — `STARTS WITH ($tenant + ':')`, not `STARTS WITH $tenant + ':'`.
MATCH (u:User)-[a:ASKED]->(q:Question)
WHERE u.id STARTS WITH ($tenant + ':')
RETURN u.id, q.text LIMIT 10;

// T2.5 Agent handoff with shared state
MERGE (a1:Agent {name:$from}) MERGE (a2:Agent {name:$to})
CREATE (a1)-[:HANDS_OFF {ticket:$ticket, summary:$summary}]->(a2);

MATCH (a1:Agent)-[h:HANDS_OFF]->(a2:Agent)
WHERE h.ticket = $ticket
RETURN a1.name, h.summary, a2.name;

// T2.6 Procedural memory: what the agent learned (survives sessions)
MATCH (a:Agent)-[:LEARNED]->(pb:Playbook)
RETURN a.name, pb.system, pb.steps;

// T2.7 Concurrency probe: the read fired N times in parallel
MATCH (p:Person)-[:WORKS_ON]->(:Project {name:'Checkout'})
RETURN count(p) AS n;


// ------------------------------------------------------------
// SCALE — bulk load + timed traversal
// ------------------------------------------------------------

// S.1 Idempotent bulk ingest (batches of 500, max 5,000 nodes)
// MERGE everywhere: clicking twice does not duplicate anything.
UNWIND $chunk AS row
MERGE (proj:Project {name:'Checkout'})
MERGE (sys:System {name:'payments-api'})
MERGE (p:Person {name: row.nm}) SET p.team='Scale', p.synthetic=true
MERGE (t:Ticket {id: row.tk})
  SET t.title='Synthetic load ticket', t.status='open', t.synthetic=true
MERGE (p)-[:WORKS_ON]->(proj)
MERGE (t)-[:REPORTED_IN]->(sys);

// S.2 The timed traversal after ingest
MATCH (p:Person)-[:WORKS_ON]->(:Project {name:'Checkout'}) RETURN count(p) AS n;

MATCH (s:System {name:'payments-api'})<-[:DEPENDS_ON*1..3]-(x)
RETURN count(DISTINCT x) AS n;

MATCH (n) RETURN count(n) AS n;
