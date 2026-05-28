# H-UDMP Deployment

部署资产目录。

| Folder | Purpose |
|---|---|
| `docker` | Docker Compose、Dockerfile、环境变量模板 |
| `scripts` | 初始化、迁移、备份、恢复脚本 |

MVP 当前包含 `hudmp-backend`、`hudmp-postgres`、`hudmp-redis` 三个服务。

```powershell
docker compose -f deploy/docker/docker-compose.yml up -d --build
docker compose -f deploy/docker/docker-compose.yml exec backend alembic upgrade head
curl http://localhost:8101/health
```
