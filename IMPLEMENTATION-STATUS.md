# Productization stage record

- A — Domain migration: `domain_v3` adds package classification and media metadata; legacy packages become `未分类`; backend migration test passes.
- B — API: package/assets/products pagination and filters, metadata update, batch classification, preview/download, disk ZIP, workflow, revision and archive authorization implemented.
- C — Web: task board, package/file library, products, revisions, users, audit, statistics and non-secret settings use shared V1 data; responsive type/layout contract is tested.
- D — Mini program upload user: required package basics, optional classification, original-quality sources, resumable draft queue, progress/error/retry/replace/delete/memo, supplement upload, product confirmation and version history.
- E — Mini program editor: task filtering, list/grid views, asset download compatibility, product upload and failure feedback.
- F — See final command output for lint, build, migration/workflow/permission, mini program static and forbidden-content scans. Production deployment intentionally not run.
- Core library browsing — Web and mini program now share folder and all-files views, preserve the selected upload account across modes, expose date provenance, and use server-side cross-package filtering and pagination.

## Role acceptance checklist

- Upload user: sign in → create classified package → add original-quality media → retry/replace/delete draft → submit → supplement upload → review versions → request changes or confirm.
- Editor/admin: sign in → inspect prioritized tasks → search/filter packages and files → preview/download single asset or package → start editing → upload product version → process revisions → archive completed work → inspect users and audit records.
- Separation: drafts are private to their owner; editor queues exclude unsubmitted drafts; completed and archived statuses are independently filterable; cross-user access by another upload account is rejected.
