import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const uid = event.queryStringParameters?.uid || 'u1';
  const q = event.queryStringParameters?.q || '';
  let db: any = null;
  try {
    const conn = await getGraph();
    db = conn.db;
    const graph = conn.graph;
    if (q) await graph.query(`MERGE (u:User {id:$uid}) CREATE (u)-[:ASKED {at:$at}]->(:Question {text:$q})`, { params: { uid, at: new Date().toISOString(), q } });
    const hist: any = await graph.query(`MATCH (u:User {id:$uid})-[a:ASKED]->(qq:Question) RETURN qq.text AS q, a.at AS at ORDER BY at DESC LIMIT 10`, { params: { uid } });
    await db.close();
    const pick = (r: any) => Array.isArray(r) ? { q: r[0], at: r[1] } : { q: r.q ?? r['qq.text'], at: r.at ?? r['a.at'] };
    return json({ uid, history: hist.data.map(pick), track: 'T2 Memory' });
  } catch (e: any) { try { if (db) await db.close(); } catch {} return json({ error: 'Graph query failed. Check Netlify env FALKOR_HOST/PORT/USERNAME/PASSWORD.' }, 500); }
};
