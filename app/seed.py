"""Seed a tiny company graph. Run: python -m app.seed"""
from .db import get_graph

SEED_CYPHER = """
CREATE (a:Person {name:'Aarav', team:'Payments'})-[:WORKS_ON]->(p:Project {name:'Checkout'}),
       (a)-[:KNOWS]->(s:System {name:'payments-api'}),
       (p)-[:USES]->(s),
       (t:Ticket {id:'PAY-101', title:'Timeout on retry', status:'open'})-[:REPORTED_IN]->(s),
       (d:Doc {title:'Payments retry design'})-[:DESCRIBES]->(s)
"""

def main():
    g = get_graph()
    g.query(SEED_CYPHER)
    print("seeded. sample check:")
    res = g.query("MATCH (p:Person)-[:WORKS_ON]->(pr:Project) RETURN p.name, pr.name LIMIT 5")
    print(res.result_set)

if __name__ == "__main__":
    main()
