# Demo video — full script + how to record (3 min)

## Record setup (5 min before)
1. Close extra tabs. Open 2 windows side-by-side: left `https://ops-brain.netlify.app`, right FalkorDB Browser on `company_brain` (the graph view with 14 nodes).
2. Chrome zoom 125%, 1080p, mic test. Quiet room.
3. Open `app/queries.cypher` in VS Code for 1 quick flash (optional).
4. Record with Xbox Game Bar (Win+G) or Loom. One take, mistakes OK.

## What to show + what to say (read word-for-word)

### 0:00-0:25 PROBLEM — show Netlify homepage
> "Agents are blind. They answer from chunks, they forget last session, and they can't tell you why. If you ask who owns payments, who fixed it before, or what breaks if it goes down — normal RAG guesses. I built Ops Brain so my agent reads a graph instead."

### 0:25-0:50 SOLUTION — switch to FalkorDB Browser graph
> "Everything is nodes and edges in FalkorDB Cloud. Person works on Project, Project uses System, Ticket reported in System, User asked Question, Agent hands off to Agent. One instance, one graph called company_brain. This is the whole company brain."

### 0:50-1:30 T3 — back to Netlify, click ASK (payments-api)
> "Track 3, Company Brain. I ask: who knows payments-api? It runs this Cypher — match Person to Project to System — and returns Aarav, with the full path Person to Project to System on screen. No hallucination, there's the proof."

Hold 3 sec on the JSON: `{"person":"Aarav","projects":1}`.

### 1:30-2:00 T1 — click BLAST
> "Track 1, act on connected data. I ask: what breaks if payments-api goes down? It follows DEPENDS_ON hops and returns checkout-web and webhook-worker. That's blast radius from the graph, not a guess. In a real incident this auto-assigns the ticket."

Hold 3 sec on `impacted` list.

### 2:00-2:35 T2 — type `who owns payments-api?`, click REMEMBER, then HANDOFF
> "Track 2, memory and coordination. I ask as user u1, it stores User Asked Question with timestamp. Refresh — history is still there. Different user, different history, same graph via multigraph. And Triage agent hands off to Fixer agent with the ticket summary shared. They coordinate through the graph."

Show history list growing.

### 2:35-3:00 CLOSE — scroll to top, show badge T1+T2+T3
> "One repo, all three tracks. T3 brain, T2 memory, T1 action. Frontend is neo-brutalism on Netlify, functions are TypeScript with falkordb-ts, mirror API in Python FastAPI. Links are in the README — repo, live demo, queries. Thanks."

Stop recording.

## After recording
1. Upload unedited to YouTube (Unlisted). Title: `Ops Brain — Company Brain that Remembers + Acts (Graph Hacks)`.
2. Description: repo `https://github.com/SznImperial/ops-brain`, demo `https://ops-brain.netlify.app`, tracks T1+T2+T3, FalkorDB Cloud.
3. Copy YouTube link into WeMakeDevs submission + README.
