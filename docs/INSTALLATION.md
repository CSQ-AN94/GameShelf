# 安装、升级与便携使用

GameShelf 1.0.0 提供 Windows x64 安装版和便携 ZIP。两个包功能相同，数据位置不同。

## 下载与校验

从 [GitHub Releases](https://github.com/CSQ-AN94/GameShelf/releases/latest) 下载：

- `GameShelf-1.0.0-windows-x64-setup.exe`：安装版。
- `GameShelf-1.0.0-windows-x64-portable.zip`：便携版。
- `SHA256SUMS.txt`：两项产物的 SHA-256。

PowerShell 校验示例：

```powershell
Get-FileHash .\GameShelf-1.0.0-windows-x64-setup.exe -Algorithm SHA256
Get-FileHash .\GameShelf-1.0.0-windows-x64-portable.zip -Algorithm SHA256
```

结果应与 `SHA256SUMS.txt` 完全一致。当前 1.0.0 产物未做代码签名，Windows SmartScreen 可能显示未知发布者；只从本仓库 Release 下载并先核对 SHA-256。

## 安装版

运行 setup 文件后从开始菜单启动 GameShelf。安装版数据位于 `%APPDATA%\GameShelf`，应用升级不会覆盖该目录。

升级前：

1. 退出 GameShelf 和所有 GameShelf 窗口。
2. 在“设置 → 数据安全与诊断”创建手动备份。
3. 可选但推荐：复制整个 `%APPDATA%\GameShelf` 到另一位置。
4. 运行新版安装程序；启动后核对游戏数量、合集、封面与设置。

## 便携版

将 ZIP 解压到可写目录，例如 `G:\GameShelf`。`GameShelf.exe` 旁必须保留 `gameshelf-portable` 文件；存在该标记时，所有受管数据都放在同目录的 `data`。

覆盖升级：

1. 退出 GameShelf。
2. 复制整个 `data` 文件夹作为备份。
3. 把新 ZIP 解压到原目录并覆盖应用文件，不要删除或覆盖现有 `data`。
4. 确认 `gameshelf-portable` 仍与 `GameShelf.exe` 同级，再启动并核对数据。

1.0.0 的便携 ZIP 兼容旧预览版放在程序旁的 `data`；不需要移动真实游戏或存档目录。删除 `gameshelf-portable` 会让应用改用安装版数据位置，因此不要把它当作无用文件清理。

## 安装版与便携版互换

先退出 GameShelf，再复制整个数据目录：

- 便携版 → 安装版：从便携目录的 `data` 复制到 `%APPDATA%\GameShelf`。
- 安装版 → 便携版：从 `%APPDATA%\GameShelf` 复制到 `GameShelf.exe` 旁的 `data`，并确认 `gameshelf-portable` 存在。

目标位置已有数据时不要直接混合两个目录；先把目标目录完整改名或备份，再复制来源目录。

## 故障排查

- 应用无法写入：确认便携目录可写，或改用安装版。
- 更新后看不到原数据：检查使用的是 `%APPDATA%\GameShelf` 还是程序旁 `data`，不要创建空库后继续大量编辑。
- 数据库错误：先复制整个数据目录，再按 [数据安全与恢复](RECOVERY.md) 操作。
- Package 或存档操作失败：保留原目录和 `.gameshelf-restore-old-*`，按 [Package 与存档安全](PACKAGES-AND-SAVES.md) 排查。
