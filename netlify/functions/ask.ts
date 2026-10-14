import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const q = event.queryStringParameters?.q || 'payments-api';
  const { db, graph } = await getGraph();
  try {
    const res: any = await graph.query(
      `MATCH (p:Person)-[:WORKS_ON]->(:Project)-[:USES]->(s:System)
       WHERE s.name CONTAINS $q OR $q CONTAINS s.name
       RETURN p.name, count(*) ORDER BY count(*) DESC LIMIT 5`,
      { params: { q } });
    await db.close();
    return json({ q, result: res.data.map((r: any) => ({ person: r[0], projects: r[1] })), path: 'Person->Project->System', track: 'T3 Company Brain' });
  } catch (e: any) { try { await db.close(); } catch {} return json({ error: String(e?.message || e) }, 500); }
};
