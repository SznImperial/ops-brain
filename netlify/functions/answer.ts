import { getGraph, json } from './_db.js';
export const handler = async (event: any) => {
  const q = event.queryStringParameters?.q || 'Who can review the Checkout PR?';
  const ql = q.toLowerCase();
  let db: any = null;
  try {
    const conn = await getGraph();
    db = conn.db; const graph = conn.graph;
    if (ql.includes('why') && (ql.includes('postgres') || ql.includes('ledger') || ql.includes('decision'))) {
      const r: any = await graph.query(`MATCH (d:Doc)-[:DECIDED]->(dec:Decision) MATCH (pp:Person)-[:WROTE]->(d) WHERE dec.topic CONTAINS 'Postgres' RETURN dec.topic AS t, dec.reason AS reason, d.title AS doc, pp.name AS who LIMIT 1`, { params: {} });
      const row = r.data[0]; await db.close();
      if (!row) return json({ track: 'T3 Company Brain', q, answer: 'No decision found.', sources: [] });
      const o = Array.isArray(row) ? { t: row[0], reason: row[1], doc: row[2], who: row[3] } : row;
      return json({ track: 'T3 Company Brain', q, answer: `We chose Postgres for the ledger because: ${o.reason} (by ${o.who} in '${o.doc}').`, sources: [{ type: 'Decision', text: o.t }, { type: 'Reason', text: o.reason }, { type: 'Doc', text: o.doc }, { type: 'Author', text: o.who }], path: 'Decision<-DECIDED-Doc<-WROTE-Person' });
    }
    const owners: any = await graph.query(`MATCH (pp:Person)-[:WORKS_ON]->(pr:Project) WHERE (pr.name CONTAINS 'Checkout' OR $q CONTAINS pr.name) AND pp.synthetic IS NULL RETURN pp.name AS person, pp.team AS team, pr.name AS project LIMIT 3`, { params: { q } });
    const people = owners.data.map((r: any) => Array.isArray(r) ? { person: r[0], team: r[1], project: r[2] } : r);
    const docs: any = await graph.query(`MATCH (d:Doc) RETURN d.title AS t LIMIT 3`, { params: {} });
    const chats: any = await graph.query(`MATCH (c:Chat) RETURN c.id AS id, c.text AS text ORDER BY coalesce(c.sent_at, 0) DESC LIMIT 2`, { params: {} });
    const tickets: any = await graph.query(`MATCH (t:Ticket) WHERE t.status='open' RETURN t.id AS id, t.title AS title ORDER BY coalesce(t.ingested_at, 0) DESC LIMIT 3`, { params: {} });
    await db.close();
    const sources = [...people.map((x: any) => ({ type: 'Owner', text: `${x.person} (${x.team})` })), ...docs.data.map((r: any) => ({ type: 'Doc', text: Array.isArray(r) ? r[0] : (r.t ?? Object.values(r)[0]) })), ...tickets.data.map((r: any) => Array.isArray(r) ? ({ type: 'Ticket', text: `${r[0]}: ${r[1]}` }) : ({ type: 'Ticket', text: `${r.id}: ${r.title}` })), ...chats.data.map((r: any) => Array.isArray(r) ? ({ type: 'Chat', text: `${r[0]} #${r[1]}` }) : ({ type: 'Chat', text: `${r.id} #${r.text}` }))];
    return json({ track: 'T3 Company Brain', q, answer: people[0] ? `Best reviewer: ${people[0].person} (${people[0].team}) — works on Checkout, knows the stack.` : 'No owner found.', sources, action_taken: people[0] ? { suggested_reviewer: people[0].person, draft: `Assigned ${people[0].person} to review (team ${people[0].team}).` } : null, path: 'Person->Project + Doc + Ticket' });
  } catch (e: any) { try { if (db) await db.close(); } catch {} return json({ error: 'Graph query failed. Check Netlify env.' }, 500); }
};
