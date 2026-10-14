import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const p = event.queryStringParameters || {};
  const ticket = p.ticket || 'PAY-101', frm = p.from || 'Triage', to = p.to || 'Fixer', summary = p.summary || 'payments timeout, owner Aarav';
  let db: any = null;
  try {
    const conn = await getGraph();
    db = conn.db;
    const graph = conn.graph;
    await graph.query(`MERGE (a:Agent {name:$f}) MERGE (b:Agent {name:$t}) MERGE (a)-[h:HANDS_OFF {ticket:$tk}]->(b) SET h.summary=$sm`, { params: { f: frm, t: to, tk: ticket, sm: summary } });
    const res: any = await graph.query(`MATCH (a:Agent)-[h:HANDS_OFF]->(b:Agent) WHERE h.ticket=$tk RETURN a.name AS from, h.summary AS summary, b.name AS to`, { params: { tk: ticket } });
    await db.close();
    const pick = (r: any) => Array.isArray(r) ? { from: r[0], summary: r[1], to: r[2] } : { from: r.from ?? r['a.name'], summary: r.summary ?? r['h.summary'], to: r.to ?? r['b.name'] };
    return json({ ticket, handoff: res.data.map(pick), track: 'T2 Coordination' });
  } catch (e: any) { try { if (db) await db.close(); } catch {} return json({ error: 'Graph query failed. Check Netlify env FALKOR_HOST/PORT/USERNAME/PASSWORD.' }, 500); }
};
