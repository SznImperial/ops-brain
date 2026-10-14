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
