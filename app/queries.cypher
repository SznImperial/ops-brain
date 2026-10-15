// T3 - Company Brain: who knows this system?
MATCH (p:Person)-[:WORKED_ON]->(:Project)-[:USES]->(s:System {name: $system})
RETURN p.name AS person, count(*) AS projects
ORDER BY projects DESC LIMIT 5;

// T3 - Trace decision to source
MATCH path = (dec:Decision)<-[:DECIDED]-(d:Doc)<-[:WROTE]-(p:Person)
WHERE dec.topic CONTAINS $topic
RETURN path LIMIT 1;

// T2 - Episodic memory: what did user ask before?
MATCH (u:User {id:$uid})-[a:ASKED]->(q:Question)
RETURN q.text, a.at ORDER BY a.at DESC LIMIT 10;

// T2 - Handoff between agents
MATCH (a1:Agent)-[h:HANDS_OFF]->(a2:Agent)
WHERE h.ticket = $ticket RETURN a1.name, h.summary, a2.name;

// T1 - Blast radius: what breaks if service goes down?
MATCH (s:System {name:$system})<-[:DEPENDS_ON*1..3]-(x)
RETURN DISTINCT x.name AS impacted LIMIT 20;

// T1 WINNER - decide owner by graph proximity
MATCH (pp:Person)-[:WORKS_ON]->(:Project)-[:USES]->(s:System {name:$system})
OPTIONAL MATCH (pp)-[:KNOWS]->(s)
RETURN pp.name AS person, pp.team AS team, count(*) AS score ORDER BY score DESC LIMIT 3;

// T1 ALGORITHMS - BFS investigation frontier from an alert (agent tool #1)
MATCH (t:Ticket {id:$ticket}) CALL algo.bfs(t, 4, null) YIELD nodes
RETURN [n in nodes | labels(n)[0] + ':' + coalesce(n.name, n.id, n.title, '?')] AS trail;

// T1 ALGORITHMS - PageRank most critical system (agent tool #2)
CALL algo.pageRank('System', 'DEPENDS_ON') YIELD node, score
RETURN node.name AS sys, score ORDER BY score DESC LIMIT 5;

// T3 FRESHNESS - ingest a live ticket, linked on arrival
MERGE (s:System {name:$system})
MERGE (t:Ticket {id:$nid}) SET t.title=$text, t.status='open', t.ingested_at=$at
MERGE (t)-[:REPORTED_IN]->(s);

// T3 FRESHNESS - newest knowledge surfaces first in answers
MATCH (t:Ticket) WHERE t.status='open'
RETURN t.id, t.title ORDER BY coalesce(t.ingested_at, 0) DESC LIMIT 3;

// T3 - chats in the same graph, cited like docs and tickets
MATCH (c:Chat) RETURN c.id, c.text ORDER BY coalesce(c.sent_at, 0) DESC LIMIT 2;

// T2 - procedural memory: what the agent learned (playbooks survive sessions)
MATCH (a:Agent)-[:LEARNED]->(pb:Playbook) RETURN a.name, pb.system, pb.steps;

// T1 WINNER - ACT: assign ticket + log action (state change proves agent acts)
MATCH (t:Ticket {id:$ticket}), (pp:Person {name:$who})
MERGE (t)-[r:ASSIGNED_TO]->(pp) SET r.at=$at, r.by='ops-agent'
MERGE (a:Action {ticket:$ticket, kind:'auto-assign'}) SET a.to=$who, a.at=$at, a.system=$system
SET t.status='triaged';

// T3 WINNER - reviewer with sources
MATCH (pp:Person)-[:WORKS_ON]->(pr:Project)
WHERE pr.name CONTAINS 'Checkout' OR $q CONTAINS pr.name
RETURN pp.name AS person, pp.team AS team, pr.name AS project LIMIT 3;
