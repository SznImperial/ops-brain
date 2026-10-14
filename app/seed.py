"""Seed company graph for T1+T3 wins. Run: python -m app.seed"""
from .db import get_graph

SEED_CYPHER = """
MERGE (a:Person {name:'Aarav'}) SET a.team='Payments'
MERGE (z:Person {name:'Zainab'}) SET z.team='Checkout'
MERGE (e:Person {name:'Emeka'}) SET e.team='Platform'
MERGE (p:Project {name:'Checkout'})
MERGE (f:Project {name:'Fraud-shield'})
MERGE (s:System {name:'payments-api'})
MERGE (c:System {name:'checkout-web'})
MERGE (w:System {name:'webhook-worker'})
MERGE (au:System {name:'auth-service'})
MERGE (a)-[:WORKS_ON]->(p)
MERGE (z)-[:WORKS_ON]->(p)
MERGE (e)-[:WORKS_ON]->(f)
MERGE (a)-[:KNOWS]->(s)
MERGE (z)-[:KNOWS]->(c)
MERGE (e)-[:KNOWS]->(au)
MERGE (p)-[:USES]->(s)
MERGE (p)-[:USES]->(c)
MERGE (f)-[:USES]->(s)
MERGE (c)-[:DEPENDS_ON]->(s)
MERGE (w)-[:DEPENDS_ON]->(c)
MERGE (t:Ticket {id:'PAY-101'}) SET t.title='Timeout on retry', t.status='open'
MERGE (t)-[:REPORTED_IN]->(s)
MERGE (t2:Ticket {id:'AUTH-7'}) SET t2.title='Login spike', t2.status='open'
MERGE (t2)-[:REPORTED_IN]->(au)
MERGE (d:Doc {title:'Payments retry design'}) MERGE (d)-[:DESCRIBES]->(s)
MERGE (d2:Doc {title:'Checkout ownership'}) MERGE (d2)-[:DESCRIBES]->(c)
MERGE (dec:Decision {topic:'chose Postgres for ledger'}) SET dec.reason='strong consistency, team knew it'
MERGE (d)-[:DECIDED]->(dec)
MERGE (a)-[:WROTE]->(d)
"""

def main():
    g = get_graph()
    g.query(SEED_CYPHER)
    print("seeded T1+T3.")
    print(g.query("MATCH (p:Person) RETURN p.name LIMIT 10").result_set)

if __name__ == "__main__":
    main()
