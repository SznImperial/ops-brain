import { FalkorDB } from 'falkordb';
export async function getGraph(name = 'company_brain') {
  const db = await FalkorDB.connect({
    host: process.env.FALKOR_HOST,
    port: Number(process.env.FALKOR_PORT || 6379),
    username: process.env.FALKOR_USERNAME,
    password: process.env.FALKOR_PASSWORD
  });
  return { db, graph: db.selectGraph(name) };
}
export const json = (data: unknown, statusCode = 200) => ({
  statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(data)
});
