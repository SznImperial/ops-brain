import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const nodes = Math.max(100, Math.min(Number(event.queryStringParameters?.nodes || 2000), 5000));
  let db: any = null;
  try {
    const conn = await getGraph();
    db = conn.db; const graph = conn.graph;
    const batch = 500, t0 = Date.now();
    for (let start = 0; start < nodes; start += batch) {
      const chunk = [];
      for (let i = start; i < Math.min(start + batch, nodes); i++)
        chunk.push({ i, nm: `scale-user-${String(i).padStart(5, '0')}`, tk: `SCALE-${String(i).padStart(5, '0')}` });
      await graph.query(`UNWIND $chunk AS row MERGE (proj:Project {name:'Checkout'}) MERGE (sys:System {name:'payments-api'}) MERGE (p:Person {name: row.nm}) SET p.team='Scale', p.synthetic=true MERGE (t:Ticket {id: row.tk}) SET t.title='Synthetic load ticket', t.status='open', t.synthetic=true MERGE (p)-[:WORKS_ON]->(proj) MERGE (t)-[:REPORTED_IN]->(sys)`, { params: { chunk } });
    }
    const ingest_ms = Date.now() - t0, t1 = Date.now();
    const owners: any = await graph.query(`MATCH (p:Person)-[:WORKS_ON]->(:Project {name:'Checkout'}) RETURN count(p) AS n`, { params: {} });
    const blast: any = await graph.query(`MATCH (s:System {name:'payments-api'})<-[:DEPENDS_ON*1..3]-(x) RETURN count(DISTINCT x) AS n`, { params: {} });
    const total: any = await graph.query(`MATCH (n) RETURN count(n) AS n`, { params: {} });
    const val = (r: any) => { const v = r.data[0]; return Array.isArray(v) ? v[0] : (v.n ?? Object.values(v)[0]); };
    await db.close();
    return json({ track: 'Scale', ingested: nodes, ingest_ms, people_on_checkout: val(owners), blast_count: val(blast), total_nodes: val(total), traversal_ms: Date.now() - t1, method: 'UNWIND batches of 500, MERGE idempotent' });
  } catch (e: any) { try { if (db) await db.close(); } catch {} return json({ error: 'Graph query failed. Check Netlify env.' }, 500); }
};
