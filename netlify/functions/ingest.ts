import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const p = event.queryStringParameters || {};
  const kind = p.kind || 'ticket', text = p.text || 'Refund webhook delayed', system = p.system || 'payments-api';
  let db: any = null;
  try {
    const conn = await getGraph();
    db = conn.db; const graph = conn.graph;
    const ts = Date.now();
    let created: any;
    if (kind === 'doc') {
      const nid = p.tid || `DOC-${ts}`;
      await graph.query(`MERGE (s:System {name:$s}) MERGE (d:Doc {title:$t}) SET d.ingested_at=$at MERGE (d)-[:DESCRIBES]->(s)`, { params: { s: system, t: text, at: ts } });
      created = { kind, doc: nid, text, edge: 'DESCRIBES->System', system };
    } else {
      const nid = p.tid || `T-${ts}`;
      await graph.query(`MERGE (s:System {name:$s}) MERGE (t:Ticket {id:$nid}) SET t.title=$t, t.status='open', t.ingested_at=$at MERGE (t)-[:REPORTED_IN]->(s)`, { params: { s: system, nid, t: text, at: ts } });
      created = { kind, ticket: nid, text, edge: 'REPORTED_IN->System', system };
    }
    const total: any = await graph.query(`MATCH (n) RETURN count(n) AS n`, { params: {} });
    const row = total.data[0]; const n = Array.isArray(row) ? row[0] : (row.n ?? Object.values(row)[0]);
    await db.close();
    return json({ track: 'T3 knowledge stays current', created, total_nodes: n, proof: 'ask /answer again — this shows up in sources' });
  } catch (e: any) { try { if (db) await db.close(); } catch {} return json({ error: 'Graph query failed. Check Netlify env.' }, 500); }
};
