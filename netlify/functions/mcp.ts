import { getGraph, json } from './_db.js';

const TOOLS = [
  { name: 'ask_owner', description: 'Rank who owns a system via Person->Project->System.', inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] } },
  { name: 'blast_radius', description: 'What breaks if a system goes down (DEPENDS_ON hops).', inputSchema: { type: 'object', properties: { system: { type: 'string' } }, required: ['system'] } },
  { name: 'investigate_alert', description: 'BFS frontier from an alert ticket (algo.bfs).', inputSchema: { type: 'object', properties: { ticket: { type: 'string' } }, required: ['ticket'] } },
  { name: 'rank_critical_systems', description: 'Most critical systems via PageRank (algo.pageRank).', inputSchema: { type: 'object', properties: {} } },
  { name: 'auto_assign', description: 'Investigate, rank owners, and ASSIGN the ticket in the graph.', inputSchema: { type: 'object', properties: { ticket: { type: 'string' }, system: { type: 'string' } }, required: ['ticket', 'system'] } },
  { name: 'answer_with_sources', description: 'Company-brain answer with cited sources and an action.', inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] } },
  { name: 'ingest_ticket', description: 'Add a live ticket to the graph so answers stay current.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, system: { type: 'string' } }, required: ['text', 'system'] } },
];

const cell = (r: any, k: string) => Array.isArray(r) ? r[0] : (r[k] ?? Object.values(r)[0]);

async function callTool(graph: any, name: string, a: any) {
  if (name === 'ask_owner') {
    const r: any = await graph.query(`MATCH (p:Person)-[:WORKS_ON]->(:Project)-[:USES]->(s:System) WHERE s.name CONTAINS $q AND p.synthetic IS NULL RETURN p.name AS person ORDER BY person LIMIT 5`, { params: { q: a.q || 'payments-api' } });
    return { owners: r.data.map((x: any) => cell(x, 'person')) };
  }
  if (name === 'blast_radius') {
    const r: any = await graph.query(`MATCH (s:System {name:$s})<-[:DEPENDS_ON*1..3]-(x) RETURN DISTINCT x.name AS impacted LIMIT 20`, { params: { s: a.system || 'payments-api' } });
    return { system: a.system, impacted: r.data.map((x: any) => cell(x, 'impacted')) };
  }
  if (name === 'investigate_alert') {
    const r: any = await graph.query(`MATCH (t:Ticket {id:$tk}) CALL algo.bfs(t, 4, null) YIELD nodes RETURN [n in nodes | labels(n)[0] + ':' + coalesce(n.name, n.id, '?')] AS trail`, { params: { tk: a.ticket || 'PAY-101' } });
    const row = r.data[0]; return { trail: Array.isArray(row) ? row[0] : (row.trail ?? Object.values(row)[0]) };
  }
  if (name === 'rank_critical_systems') {
    const r: any = await graph.query(`CALL algo.pageRank('System', 'DEPENDS_ON') YIELD node, score RETURN node.name AS sys, score ORDER BY score DESC LIMIT 5`, { params: {} });
    return { critical: r.data.map((x: any) => Array.isArray(x) ? { system: x[0], score: x[1] } : { system: x.sys, score: x.score }) };
  }
  if (name === 'auto_assign') {
    const ticket = a.ticket || 'PAY-101', system = a.system || 'payments-api';
    const owners: any = await graph.query(`MATCH (pp:Person)-[:WORKS_ON]->(:Project)-[:USES]->(s:System {name:$s}) WHERE pp.synthetic IS NULL RETURN pp.name AS person LIMIT 1`, { params: { s: system } });
    const who = cell(owners.data[0], 'person');
    await graph.query(`MATCH (t:Ticket {id:$tk}), (pp:Person {name:$who}) MERGE (t)-[r:ASSIGNED_TO]->(pp) SET t.status='triaged'`, { params: { tk: ticket, who } });
    return { assigned_to: who, ticket, ticket_status: 'triaged' };
  }
  if (name === 'answer_with_sources') {
    const q = a.q || 'Who can review the Checkout PR?';
    const owners: any = await graph.query(`MATCH (pp:Person)-[:WORKS_ON]->(pr:Project) WHERE (pr.name CONTAINS 'Checkout' OR $q CONTAINS pr.name) AND pp.synthetic IS NULL RETURN pp.name AS person, pp.team AS team LIMIT 2`, { params: { q } });
    const people = owners.data.map((x: any) => Array.isArray(x) ? { person: x[0], team: x[1] } : x);
    return { answer: people[0] ? `Best reviewer: ${people[0].person} (${people[0].team}).` : 'No owner found.', sources: people };
  }
  if (name === 'ingest_ticket') {
    const ts = Date.now(), nid = `T-${ts}`;
    await graph.query(`MERGE (s:System {name:$s}) MERGE (t:Ticket {id:$nid}) SET t.title=$t, t.status='open', t.ingested_at=$at MERGE (t)-[:REPORTED_IN]->(s)`, { params: { s: a.system || 'payments-api', nid, t: a.text || '', at: ts } });
    return { ticket: nid, edge: 'REPORTED_IN->System' };
  }
  throw new Error(`unknown tool: ${name}`);
}

export const handler = async (event: any) => {
  let body: any = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); }
  const { id = null, method, params = {} } = body;
  if (method === 'initialize') return json({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'ops-brain', version: '1.0.0' } } });
  if (method === 'tools/list') return json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  if (method === 'tools/call') {
    let db: any = null;
    try {
      const conn = await getGraph();
      db = conn.db;
      const out = await callTool(conn.graph, params.name || '', params.arguments || {});
      await db.close();
      return json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out) }] } });
    } catch (e: any) { try { if (db) await db.close(); } catch {} return json({ jsonrpc: '2.0', id, error: { code: -32000, message: String(e?.message || e).slice(0, 200) } }); }
  }
  return json({ jsonrpc: '2.0', id, error: { code: -32601, message: `unknown method: ${method}` } });
};
