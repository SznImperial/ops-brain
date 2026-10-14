"""FalkorDB connection helper. Works with local or Cloud."""
import os
from dotenv import load_dotenv

load_dotenv()

try:
    from falkordb import FalkorDB
except ImportError:
    FalkorDB = None


def get_graph(graph_name: str | None = None):
    if FalkorDB is None:
        raise RuntimeError("pip install -r requirements.txt first (falkordb missing)")
    host = os.getenv("FALKOR_HOST", "localhost")
    port = int(os.getenv("FALKOR_PORT", "6379"))
    username = os.getenv("FALKOR_USERNAME") or None
    password = os.getenv("FALKOR_PASSWORD") or None
    name = graph_name or os.getenv("GRAPH_NAME", "company_brain")
    # Cloud needs username+password. Local usually needs neither.
    db = FalkorDB(host=host, port=port, username=username, password=password)
    return db.select_graph(name)
