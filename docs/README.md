# SeatLock Documentation

| Doc | Read it for |
| --- | --- |
| [System design](system-design.md) | The problem, requirements, tech stack, data model (ER diagram + tables), core flows (sequence diagrams), concurrency strategy, failure modes, API, limitations, open questions |
| [Architecture](architecture.md) | C4 diagrams (context → containers → components), the AWS production target and low-cost demo deployment, CI/CD, security, observability |
| [Plan](plan.md) | Phases, task checklists, status tracking, decision log |
| [ADRs](adr/) | One record per significant decision and its trade-offs |
| `images/` | Exported AWS architecture diagrams (PlantUML) |

**Suggested reading order:** system design → architecture → plan.

## Conventions

- Flow, sequence, ER, state and C4 diagrams are **Mermaid** inside the Markdown (GitHub renders them).
- AWS diagrams are **PlantUML** with the official AWS icons (`awslib14`), generated at [plantuml.com](https://www.plantuml.com/plantuml) and exported as PNG to `docs/images/aws-production.png` and `docs/images/aws-demo.png`.
- Design changes go through a PR like code. A significant decision gets an ADR.
- Docs describe the **intended** design. When the implementation diverges, update the doc in the same PR.
