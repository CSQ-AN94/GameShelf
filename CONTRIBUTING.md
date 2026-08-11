# Contributing

GameShelf 以小而可回溯的 pull request 维护。

1. 从最新 `main` 创建短期分支，使用 `feature/`、`fix/`、`docs/` 或 `codex/` 前缀。
2. 只提交与一个目标相关的改动；不要提交真实游戏目录、存档、`data` 或诊断日志。
3. 运行 `npm run typecheck`、`npm test` 和与改动相关的 Windows 验证。
4. 通过 pull request 合并到 `main`，合并后删除分支。仓库不保留长期开发或 release 分支；发布由 `v*.*.*` tag 驱动。

涉及 Package、存档、恢复或数据路径的改动，必须使用可丢弃夹具，并明确记录任何需要人工完成的 Windows 验收。
