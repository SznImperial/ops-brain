import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const p = event.queryStringParameters || {};
  const ticket = p.ticket || 'PAY-101', system = p.system || 'payments-api';
  let db: any = null;
  try {
    const conn = await getGraph();
    db = conn.db; const graph = conn.graph;
    const blast: any = await graph.query(`MATCH (s:System {name:$s})<-[:DEPENDS_ON*1..3]-(x) RETURN DISTINCT x.name AS impacted LIMIT 20`, { params: { s: system } });
    const impacted = blast.data.map((r: any) => Array.isArray(r) ? r[0] : (r.impacted ?? Object.values(r)[0]));
    const owners: any = await graph.query(`MATCH (pp:Person)-[:WORKS_ON]->(:Project)-[:USES]->(s:System {name:$s}) WHERE pp.synthetic IS NULL OPTIONAL MATCH (pp)-[:KNOWS]->(s) RETURN pp.name AS person, pp.team AS team, count(*) AS score ORDER BY score DESC LIMIT 3`, { params: { s: system } });
    const ranking = owners.data.map((r: any) => Array.isArray(r) ? { person: r[0], team: r[1], score: r[2] } : { person: r.person, team: r.team, score: r.score });
    const assignee = ranking[0]?.person || 'Aarav';
    await graph.query(`MATCH (t:Ticket {id:$tk}), (pp:Person {name:$who}) MERGE (t)-[r:ASSIGNED_TO]->(pp) SET r.at=$at, r.by='ops-agent' MERGE (a:Action {ticket:$tk, kind:'auto-assign'}) SET a.to=$who, a.at=$at, a.system=$s MERGE (ag:Agent {name:'ops-agent'}) MERGE (pb:Playbook {system:$s}) SET pb.steps='blast-radius -> rank-owners -> assign', pb.updated=$at MERGE (ag)-[:LEARNED]->(pb) SET t.status='triaged'`, { params: { tk: ticket, who: assignee, at: new Date().toISOString(), s: system } });
    await db.close();
    return json({ track: 'T1 Agents That Act', ticket, system, reasoning: [`blast_radius(${system})=${JSON.stringify(impacted)}`, `owner_ranking=${JSON.stringify(ranking)}`, `decision=assign ${ticket} to ${assignee}`], action_taken: { assigned_to: assignee, ticket_status: 'triaged' }, procedural_memory: { agent: 'ops-agent', playbook: system, steps: 'blast-radius -> rank-owners -> assign' }, path: 'Alert->System->DEPENDS_ON->Impacted + Person->Project->System->Owner' });
  } catch (e: any) { try { if (db) await db.close(); } catch {} return json({ error: 'Graph query failed. Check Netlify env.' }, 500); }
};
