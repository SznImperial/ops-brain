import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const p = event.queryStringParameters || {};
  const uid = p.uid || 'u1', q = p.q || '', tenant = p.tenant || 'default', fact = p.fact || '';
  const eid = tenant === 'default' ? uid : `${tenant}:${uid}`;
  let db: any = null;
  try {
    const conn = await getGraph();
    db = conn.db; const graph = conn.graph;
    const now = new Date().toISOString();
    if (q) await graph.query(`MERGE (u:User {id:$uid}) CREATE (u)-[:ASKED {at:$at}]->(:Question {text:$q})`, { params: { uid: eid, at: now, q } });
    let stored_fact: any = null;
    if (fact && fact.includes('=')) {
      const [k, ...rest] = fact.split('='); const v = rest.join('=');
      await graph.query(`MERGE (u:User {id:$uid}) MERGE (f:Fact {k:$k, v:$v}) MERGE (u)-[r:KNOWS_FACT]->(f) SET r.at=$at`, { params: { uid: eid, k: k.trim(), v: v.trim(), at: now } });
      stored_fact = { k: k.trim(), v: v.trim() };
    }
    const hist: any = await graph.query(`MATCH (u:User {id:$uid})-[a:ASKED]->(qq:Question) RETURN qq.text AS q, a.at AS at ORDER BY at DESC LIMIT 10`, { params: { uid: eid } });
    const facts: any = await graph.query(`MATCH (u:User {id:$uid})-[:KNOWS_FACT]->(f:Fact) RETURN f.k AS k, f.v AS v LIMIT 20`, { params: { uid: eid } });
    await db.close();
    const pickH = (r: any) => Array.isArray(r) ? { q: r[0], at: r[1] } : { q: r.q ?? r['qq.text'], at: r.at ?? r['a.at'] };
    const pickF = (r: any) => Array.isArray(r) ? { k: r[0], v: r[1] } : { k: r.k, v: r.v };
    return json({ uid, tenant, stored: !!q, stored_fact, history: hist.data.map(pickH), semantic_facts: facts.data.map(pickF), track: 'T2 Memory' });
  } catch (e: any) { try { if (db) await db.close(); } catch {} return json({ error: 'Graph query failed. Check Netlify env.' }, 500); }
};
