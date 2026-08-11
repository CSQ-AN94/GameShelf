# Changelog

本项目的重要变更记录在此文件中。版本号遵循 [Semantic Versioning](https://semver.org/)。

## [1.0.0] - 2026-08-12

### Added

- 批量扫描、审核、导入和整理本地游戏，支持重复路径、多启动项、相关版本与本地 `gameshelf.json`。
- 封面墙与信息列表、完整搜索、分类排序、合集排序/重命名/删除和系列整体进度。
- 可预览、备份、确认和撤销的 Package 目录管理。
- 带 SHA-256 清单的存档分支、快照、校验恢复和恢复前快照。
- 覆盖搜索、主页、统计、分类、合集和打开状态的安全视图投影。
- Windows x64 安装版、便携 ZIP、GitHub Actions 持续构建和 SHA-256 校验文件。

### Changed

- 安装版使用稳定的 `%APPDATA%\GameShelf` 数据目录；便携版继续使用程序旁 `data`。
- 正式采用 MIT 许可证。

### Fixed

- Windows 裸 `R18`、`Adult`、`Fix`、`修复`、`Voice`、`语音` Package 目录识别。
- 搜索返回流程、分类/合集视图和合集重命名/删除交互。

### Validation

- Windows 批次 A 核心夹具：12 Pass / 0 Fail。
- Windows 批次 B 修复后回归：21 Pass / 0 Fail / 1 Skip；跳过的 junction 场景已由独立 Windows 实机夹具通过。
- macOS 与 Windows typecheck 通过；Windows x64 生产打包已通过。

[1.0.0]: https://github.com/CSQ-AN94/GameShelf/releases/tag/v1.0.0
