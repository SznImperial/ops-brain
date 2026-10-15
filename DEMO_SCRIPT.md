# Demo video — full script + how to record (4 min)

## Record setup (5 min before)
1. Close extra tabs. Open 2 windows side-by-side: left `https://ops-brain.netlify.app`, right FalkorDB Browser on `company_brain`.
2. Chrome zoom 125%, 1080p, mic test. Quiet room.
3. Open `app/queries.cypher` in VS Code for 1 quick flash (optional).
4. Record with Xbox Game Bar (Win+G) or Loom. One take, mistakes OK.

## What to show + what to say (read word-for-word)

### 0:00-0:25 PROBLEM — show Netlify homepage, let the ticker run
> "Agents are blind. They answer from chunks, they forget last session, and they can't tell you why. If you ask who owns payments, who fixed it before, or what breaks if it goes down — normal RAG guesses. I built Ops Brain so my agent reads a graph instead."

Slow-scroll once so cards rise in — motion is on, let judges see it.

### 0:25-0:50 SOLUTION — switch to FalkorDB Browser graph, zoom the starburst
> "Everything is nodes and edges in FalkorDB Cloud. Person works on Project, Project uses System, Ticket reported in System, User asked Question, Agent hands off to Agent. One instance, one graph called company_brain — over four thousand nodes, almost five thousand edges, and every query you are about to see answers in about three hundred milliseconds."

Hold 4 sec on the NODES/EDGES panel. Then add, honestly:
> "Full disclosure: this is running on FalkorDB's free tier, so I capped the demo load at a few thousand nodes. The traversals and algorithms are matrix-based, so on real iron this same code scales to millions — imagine what it does on the machine we're competing for."

### 0:50-1:30 T3 — back to Netlify, click ASK (payments-api), then ANSWER WITH SOURCES + WHY POSTGRES?
> "Track 3, Company Brain. Who knows payments-api? Aarav, with the full path on screen — no hallucination. Best reviewer for the Checkout PR? Ranked people plus the docs and tickets it cited. And why Postgres? Traced back to the decision, the reason, the doc, the author. Every answer carries its sources."

Hold 3 sec on the sources array.

### 1:30-2:00 T1 — click BLAST, then TRIAGE PAY-101 NOW
> "Track 1, act on connected data. Blast radius says checkout-web and webhook-worker go down with payments-api. But my agent doesn't stop at answers — watch TRIAGE. It ranks owners from the graph, assigns the ticket to Zainab, flips it to triaged, and logs the action node. The graph changed because the agent acted."

Hold 3 sec on `assigned_to`.

### 2:00-2:25 T1 ALGORITHMS + MCP — click RUN ALGORITHMS, then CALL TOOL
> "And it doesn't hand-write traversals — it calls graph algorithms as tools. BFS gives the investigation frontier from the alert, PageRank ranks payments-api the most critical system. All seven tools are exposed over MCP, so any agent client can list and call them. Tool selection through MCP, check."

### 2:25-2:50 SCALE + FRESHNESS — INGEST 2000, then ADD TICKET, then ANSWER
> "Scale: two thousand nodes bulk-loaded with timed traversals — sub-second, every agent step. Freshness: I add a ticket right now, ask again, and it's already in the sources. The brain never goes stale."

### 2:50-3:10 T2 — type `who owns payments-api?`, click REMEMBER, then HANDOFF
> "Track 2, memory and coordination. I ask as user u1, it stores User Asked Question with timestamp. Refresh — history is still there. And Triage agent hands off to Fixer agent with the ticket summary shared."

### 3:10-3:30 CLOSE — scroll to top, show badge T1+T2+T3
> "One repo, all three tracks. T3 brain with sources, T2 memory, T1 action with algorithms and MCP — on four thousand nodes at three hundred milliseconds a query. Frontend is neo-brutalism on Netlify, functions are TypeScript with falkordb-ts, mirror API in Python FastAPI. Links are in the README — repo, live demo, queries. Give this graph an M6 and watch it fly. Thanks."

Stop recording.

## After recording
1. Upload unedited to YouTube (Unlisted). Title: `Ops Brain — Company Brain that Remembers + Acts (Graph Hacks)`.
2. Description: repo `https://github.com/SznImperial/ops-brain`, demo `https://ops-brain.netlify.app`, tracks T1+T2+T3, FalkorDB Cloud.
3. Copy YouTube link into WeMakeDevs submission + README.
