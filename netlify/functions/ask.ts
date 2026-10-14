import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const q = event.queryStringParameters?.q || 'payments-api';
  let db: any = null;
  try {
    const conn = await getGraph();
    db = conn.db;
    const graph = conn.graph;
    const res: any = await graph.query(
      `MATCH (p:Person)-[:WORKS_ON]->(:Project)-[:USES]->(s:System)
       WHERE s.name CONTAINS $q OR $q CONTAINS s.name
       RETURN p.name, count(*) ORDER BY count(*) DESC LIMIT 5`,
      { params: { q } });
    await db.close();
    return json({ q, result: res.data.map((r: any) => ({ person: r[0], projects: r[1] })), path: 'Person->Project->System', track: 'T3 Company Brain' });
  } catch (e: any) { try { if (db) await db.close(); } catch {} return json({ error: 'Graph query failed. Check Netlify env FALKOR_HOST/PORT/USERNAME/PASSWORD.' }, 500); }
};
