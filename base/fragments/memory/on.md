## Memory
- Always use the `mymind` MCP server. Its memories come from every Claude Code session and are project-scoped: search them (`search_memories`, `search_docs`, `search_passages`) before answering from recollection and whenever you start discovery or a new implementation.
- Mirror project docs and wikis to MyMind when you write them; file them under the project slug.
- Two inlets: the enrichment loop (preferred, distils session transcripts into confidence-scored memories) and `save_memory` (sparingly, for one durable sentence enrichment cannot see, always with a `confidence`). Architecture detail belongs in handovers and the wiki, not in memories.
- Search MyMind tasks for open work fronts before starting; create or update a task whenever work is deferred or finished.
