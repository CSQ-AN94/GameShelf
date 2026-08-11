# GameShelf 1.0 发布清单

## 已有验证证据

- [x] Windows 批次 A 核心夹具：12 Pass / 0 Fail。
- [x] Windows 批次 B 修复后回归：21 Pass / 0 Fail / 1 Skip；junction 独立夹具 Pass。
- [x] Windows 与 macOS typecheck 通过；Windows x64 生产打包通过。
- [x] `G:\GalGame` 与 `G:\game` 仅做真实目录只读扫描。

## 1.0 发布候选

- [x] 本机 `npm run typecheck`、29/29 测试、`git diff --check` 和 Vite 生产构建通过。
- [x] `npm audit --omit=dev`：0；完整审计：24 条仅位于 Electron Forge 构建链（3 low / 20 high / 1 critical，当前无可用修复），不做破坏性升级。
- [x] GitHub Actions 在提交 `8504f65` 上通过 typecheck、29/29 测试、生产依赖审计、安装版和便携版构建（[run 31532009726](https://github.com/CSQ-AN94/GameShelf/actions/runs/31532009726)）。
- [x] Windows 实机：安装版安装、启动和卸载通过；程序位于 `%LOCALAPPDATA%\GameShelf`，数据位于 `%APPDATA%\GameShelf`，程序旁未创建 `data`。
- [x] Windows 实机：便携 ZIP 从 `%TEMP%` 启动通过；`gameshelf-portable` 生效，旁置 `data/gameshelf.sqlite` 与自动备份已生成。
- [x] Windows 实机：同版本重装后验证文件 SHA-256 未变化，`gameshelf.sqlite` 保留。
- [x] Windows 实机：核对程序版本为 1.0.0、两个产物名称正确，本机与 Windows 的 SHA-256 均与 `SHA256SUMS.txt` 一致。
- [x] Windows 实机 GUI：首页 1440×900 截图人工核对通过；中文字体、侧栏、空库状态与按钮显示正常，页面完成加载且 CDP 未捕获异常。
- [ ] Manual：用已填充的 0.4 数据验证跨版本升级后数据库、合集、封面和设置保留。
- [ ] Manual：记录未签名程序的 SmartScreen 表现；不将其误记为已签名。

## 发布

- [ ] PR #3 退出 draft，检查通过并合并到 `main`。
- [ ] 在合并提交创建并推送 `v1.0.0` annotated tag。
- [ ] tag 工作流创建 GitHub Release，并上传安装版、便携版和 `SHA256SUMS.txt`。
- [ ] 从公开 Release 页面重新下载并复核 SHA-256 与基本启动。
- [ ] 合并后删除 PR 分支；只保留 `main` 作为长期分支。
