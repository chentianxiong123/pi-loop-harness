# memorynote v2/nextjs 最新归档说明

原始 home 副本已删除，最新改动保存如下：

## 保存的额外文件

- `v2-nextjs/docker-compose.dev.yaml` — 最新版本（覆盖了旧版）
- `v2-nextjs/patch-2026-09-26-docker-compose-volumes.diff` — diff 记录
- `.env` — **存放在 `/home/a1/.secrets/memorynote.env`**（不在 git 仓库里，chmod 600，仅 a1 可访问）

## 最新 commit 内容

commit: `1c5fbadf` on 2026-09-26（本地）
改动：volume 命名规范化 + external:true + tmpfs
- `memorynote_postgres_data` → `memorynote-postgres-data`（external: true）
- `memorynote_neo4j_data` → `memorynote-neo4j-data`（external: true）
- 新增 `tmpfs: /logs` for neo4j

## 恢复方法

```bash
git clone https://github.com/chentianxiong123/MemoryNote.git
cd MemoryNote
git checkout v2/nextjs
cp /mnt/shared/pi-loop-harness/old/memorynote/v2-nextjs/docker-compose.dev.yaml ./
cp /home/a1/.secrets/memorynote.env ./.env
docker compose -f docker-compose.dev.yaml up -d
```
