# Demo video script (3 min, solo-friendly)
0:00-0:20 Problem: agents lose context. Show 2 Slack + 1 ticket disconnected.
0:20-0:50 Solution: Ops Brain graph. Show FalkorDB Browser visualization.
0:50-1:40 Live: ask "Who knows payments-api?" → show Cypher + path Person->Project->System. Ask "What breaks if payments-api goes down?" → blast radius.
1:40-2:20 Memory: ask same q as different user → different answer. Show HANDS_OFF between Triage→Fixer.
2:20-3:00 Action: auto-assign ticket + explain path. End with tracks slide + repo link.
Record with `uvicorn app.main:app` + browser side-by-side. No editing needed.
