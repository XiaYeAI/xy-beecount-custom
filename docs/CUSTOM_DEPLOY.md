# 自定义版本部署（xiayeai）

本项目的自定义版本由 `XiaYeAI/xy-beecount` 管理；服务器运行的业务数据和
认证配置继续由 `/home/ubuntu/beecount/docker-compose.yml` 与 `data/` 维护。
不要把 `data/`、`.env` 或任何密码文件放入 Git 仓库或发布源码。

## 首次发布

在服务器 `/home/ubuntu/beecount` 目录执行。先构建镜像，再停服务备份，可缩短
维护窗口：

```bash
git clone https://github.com/XiaYeAI/xy-beecount.git source
docker compose -f docker-compose.yml -f source/docker-compose.custom.yml build
docker compose stop beecount-cloud
tar czf "backups/data-before-custom-$(date +%Y%m%d-%H%M%S).tar.gz" data
docker compose -f docker-compose.yml -f source/docker-compose.custom.yml up -d --force-recreate
curl -fsS http://127.0.0.1:8869/ready
```

这会继续使用原 Compose 中的端口、`./data:/data`、管理员初始化配置和 JWT 密钥。
Docker 容器启动时会自动执行 Alembic 迁移；不要运行 `docker compose down -v`。

## 后续升级

每次在本地完成测试、提交并推送后：

```bash
cd /home/ubuntu/beecount/source
git pull --ff-only
cd ..
docker compose -f docker-compose.yml -f source/docker-compose.custom.yml build
docker compose -f docker-compose.yml -f source/docker-compose.custom.yml up -d --force-recreate
curl -fsS http://127.0.0.1:8869/ready
```

若要保留每个镜像版本，在发布前同时更新
`docker-compose.custom.yml` 中的 `image` 与 `VERSION` 值。

## 回滚

仅代码或镜像异常时，先切回原 Compose（不删除数据卷）：

```bash
cd /home/ubuntu/beecount
docker compose up -d --force-recreate
curl -fsS http://127.0.0.1:8869/ready
```

只有数据库迁移失败且需要恢复数据时，才停止容器后还原刚才生成的 `data` 备份；
恢复 SQLite 数据库前必须删除旧的 `beecount.db-wal` 和 `beecount.db-shm`。
