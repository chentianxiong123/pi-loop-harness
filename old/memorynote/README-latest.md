# memorynote v2/nextjs 最新归档说明

原始 home 副本已删除，最新改动保存如下：

## 保存的额外文件
- `.env` — 环境变量（含敏感凭据，chmod 600）
- `v2-nextjs/docker-compose.dev.yaml` — 最新版本（覆盖了旧版）
- `v2-nextjs/patch-2026-09-26-docker-compose-volumes.diff` — diff 记录

## 最新 commit 内容
commit: `1c5fbadf` on 2026-09-26
改动：volume 命名规范化 + external:true + tmpfs
- `memorynote_postgres_data` → `memorynote-postgres-data`（external: true）
- `memorynote_neo4j_data` → `memorynote-neo4j-data`（external: true）
- 新增 `tmpfs: /logs` for neo4j

## 恢复方法
```bash
git clone https://github.com/chentianxiong123/MemoryNote.git
cd MemoryNote
git checkout v2/nextjs
cp /mnt/shared/pi-loop-harness/old/memorynote/.env ./
cp /mnt/shared/pi-loop-harness/old/memorynote/v2-nextjs/docker-compose.dev.yaml ./
docker compose -f docker-compose.dev.yaml up -d
```
