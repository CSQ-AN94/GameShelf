# Changelog

本项目的重要变更记录在此文件中。版本号遵循 [Semantic Versioning](https://semver.org/)。

## [1.1.0] - 2026-08-13

### Added

- 每个游戏可添加、删除自定义标签；标签会显示在主页与详情页。
- 游戏库侧栏按标签筛选，搜索栏可按一个或多个标签查找游戏。

### Changed

- 数据库升级到版本 3，为游戏记录增加标签字段；升级前自动创建迁移备份。

### Fixed

- 横向背景图现在只会在点击“更换横向背景”按钮时打开文件选择器，点击背景本身不再弹窗。

### Validation

- macOS：31 Pass / 0 Fail，typecheck 与生产依赖审计通过。
- Windows：30 Pass / 0 Fail / 1 Skip，typecheck、x64 安装版和便携版构建通过；Skip 为已由独立实机夹具通过的 junction 场景。
- Windows 真实数据副本完成数据库迁移与标签增删、筛选、搜索 GUI 验收；真实便携库升级后 23 个游戏和关联记录完整，数据库校验通过。

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
[1.1.0]: https://github.com/CSQ-AN94/GameShelf/releases/tag/v1.1.0
