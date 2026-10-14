import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const p = event.queryStringParameters || {};
  const ticket = p.ticket || 'PAY-101', frm = p.from || 'Triage', to = p.to || 'Fixer', summary = p.summary || 'payments timeout, owner Aarav';
  const { db, graph } = await getGraph();
  try {
    await graph.query(`MERGE (a:Agent {name:$f}) MERGE (b:Agent {name:$t}) CREATE (a)-[:HANDS_OFF {ticket:$tk, summary:$sm}]->(b)`, { params: { f: frm, t: to, tk: ticket, sm: summary } });
    const res: any = await graph.query(`MATCH (a:Agent)-[h:HANDS_OFF]->(b:Agent) WHERE h.ticket=$tk RETURN a.name, h.summary, b.name`, { params: { tk: ticket } });
    await db.close();
    return json({ ticket, handoff: res.data.map((r: any) => ({ from: r[0], summary: r[1], to: r[2] })), track: 'T2 Coordination' });
  } catch (e: any) { try { await db.close(); } catch {} return json({ error: String(e?.message || e) }, 500); }
};
