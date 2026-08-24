# Workflow migration

`workflow_v1.py`, `asset_memo_v2.py` and `domain_v3.py` are ordered, idempotent application migrations recorded in `schema_migrations`.

Before production deployment, stop writes and copy both the SQLite database and media directories:

```bash
cp -a data/daitora.db data/daitora.db.pre-workflow-v1
cp -a data/uploads data/uploads.pre-workflow-v1
cp -a data/finished-products data/finished-products.pre-workflow-v1
```

On first application start the migrations add workflow tables, classification and media metadata columns without dropping old fields. Existing ungrouped assets are linked to an archived `历史素材包`; V3 marks that package as `未分类`. The compatibility endpoint remains available during the transition.

Rollback is application rollback plus restoration of the database and media backups. Verify the backup with `sqlite3 backup.db 'PRAGMA integrity_check'` before upgrading. Because SQLite cannot safely remove columns in place, do not attempt a partial down migration on production data.
