import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const ticket = event.queryStringParameters?.ticket || 'PAY-101';
  let db: any = null;
  try {
    const conn = await getGraph();
    db = conn.db; const graph = conn.graph;
    const bfs: any = await graph.query(`MATCH (t:Ticket {id:$tk}) CALL algo.bfs(t, 4, null) YIELD nodes RETURN [n in nodes | labels(n)[0] + ':' + coalesce(n.name, n.id, n.title, '?')] AS trail`, { params: { tk: ticket } });
    const pr: any = await graph.query(`CALL algo.pageRank('System', 'DEPENDS_ON') YIELD node, score RETURN node.name AS sys, score ORDER BY score DESC LIMIT 5`, { params: {} });
    const trail = bfs.data[0]; const tr = Array.isArray(trail) ? trail[0] : (trail.trail ?? Object.values(trail)[0]);
    await db.close();
    return json({ track: 'T1 graph algorithms as agent tools', ticket,
      tools_used: ['algo.bfs(t, 4) — investigation frontier from alert', "algo.pageRank('System','DEPENDS_ON') — most critical system"],
      bfs_frontier: tr,
      pagerank_systems: pr.data.map((r: any) => Array.isArray(r) ? { system: r[0], score: Math.round(r[1] * 10000) / 10000 } : { system: r.sys, score: r.score }),
      agent_reads: 'BFS tells the agent WHERE to look, PageRank tells it WHAT matters most' });
  } catch (e: any) { try { if (db) await db.close(); } catch {} return json({ error: 'Graph query failed. Check Netlify env.' }, 500); }
};
