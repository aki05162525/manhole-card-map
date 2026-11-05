# mapcn source provenance

Installed on 2026-11-05 with the official shadcn registry command (`bunx shadcn@latest add @mapcn/map --yes`). The generated component is committed at `src/components/ui/map.tsx`; installs/builds do not download a fresh component. Runtime versions are pinned in `package.json` and `bun.lock`.

- Registry: https://www.mapcn.dev/r/map.json
- Registry response SHA256: `a3ec4afa7b6f4e7f0922baeafa48828f03b6bf82ebee6ab915805acf85bc4dd1`
- Registry component content before local formatting/change SHA256: `ba55810f9ada1e3b0aa0a1384074540fe89ace78535113f3f8dcc5a23bd4ed87`
- License: MIT, Copyright (c) 2025 Anmoldeep Singh; full text in `MAPCN_LICENSE.txt`, also copied into build artifacts. This also covers the official skill stored under `.agents/skills/mapcn` at repository root.

Local changes to the component: Oxfmt formatting and `setWorkerUrl('/maplibre-gl-worker.mjs')` instead of the default unpkg URL. Self-hosting follows https://www.mapcn.dev/docs/installation. The worker and companion shared module are copied from the installed MapLibre version during build and served from that dependency during development.

`unicorn/no-useless-fallback-in-spread` is disabled only for this generated component, preserving the upstream expressions. All other configured lint rules still run. Application behavior lives in `src/card-map.tsx` and `src/app.tsx`.

The APM lockfile pins the **skill**, not this registry response. Update either explicitly, inspect the source diff and rerun tests. No shadcn CLI execution is required in CI.
