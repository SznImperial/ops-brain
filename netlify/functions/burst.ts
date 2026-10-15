import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const n = Math.max(1, Math.min(Number(event.queryStringParameters?.n || 20), 50));
  let db: any = null;
  try {
    const conn = await getGraph();
    db = conn.db; const graph = conn.graph;
    const t0 = Date.now();
    const out: any[] = await Promise.all(Array.from({ length: n }, () =>
      (graph as any).query(`MATCH (p:Person)-[:WORKS_ON]->(:Project {name:'Checkout'}) RETURN count(p) AS n`, { params: {} })));
    const val = (r: any) => { const v = r.data[0]; return Array.isArray(v) ? v[0] : (v.n ?? Object.values(v)[0]); };
    const ok = out.filter((r) => val(r) > 0).length;
    await db.close();
    return json({ track: 'T2 high-concurrency reads', parallel_queries: n, ok, ms: Date.now() - t0 });
  } catch (e: any) { try { if (db) await db.close(); } catch {} return json({ error: 'Graph query failed. Check Netlify env.' }, 500); }
};
