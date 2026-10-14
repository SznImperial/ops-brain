import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const uid = event.queryStringParameters?.uid || 'u1';
  const q = event.queryStringParameters?.q || '';
  const { db, graph } = await getGraph();
  try {
    if (q) await graph.query(`MERGE (u:User {id:$uid}) CREATE (u)-[:ASKED {at:$at}]->(:Question {text:$q})`, { params: { uid, at: new Date().toISOString(), q } });
    const hist: any = await graph.query(`MATCH (u:User {id:$uid})-[a:ASKED]->(qq:Question) RETURN qq.text, a.at ORDER BY a.at DESC LIMIT 10`, { params: { uid } });
    await db.close();
    return json({ uid, history: hist.data.map((r: any) => ({ q: r[0], at: r[1] })), track: 'T2 Memory' });
  } catch (e: any) { try { await db.close(); } catch {} return json({ error: String(e?.message || e) }, 500); }
};
