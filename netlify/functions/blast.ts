import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const system = event.queryStringParameters?.system || 'payments-api';
  let db: any = null;
  try {
    const conn = await getGraph();
    db = conn.db;
    const graph = conn.graph;
    await graph.query(`MERGE (s:System {name:$s}) MERGE (c:System {name:'checkout-web'}) MERGE (w:System {name:'webhook-worker'}) MERGE (c)-[:DEPENDS_ON]->(s) MERGE (w)-[:DEPENDS_ON]->(c)`, { params: { s: system } });
    const res: any = await graph.query(`MATCH (s:System {name:$s})<-[:DEPENDS_ON*1..3]-(x) RETURN DISTINCT x.name LIMIT 20`, { params: { s: system } });
    await db.close();
    return json({ system, impacted: res.data.map((r: any) => r[0]), track: 'T1 Act on Connected Data' });
  } catch (e: any) { try { if (db) await db.close(); } catch {} return json({ error: 'Graph query failed. Check Netlify env FALKOR_HOST/PORT/USERNAME/PASSWORD.' }, 500); }
};
