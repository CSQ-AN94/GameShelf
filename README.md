<div align="center">
  <img src="assets/app-icon.png" width="118" alt="GameShelf icon" />
  <h1>GameShelf</h1>
  <p><strong>把散落在硬盘里的游戏，整理成一座真正属于你的私人游戏库。</strong></p>
  <p>Windows · Local-first · Visual novels & local games</p>

  <p>
    <img src="https://img.shields.io/badge/platform-Windows-2563EB?style=flat-square" alt="Windows" />
    <img src="https://img.shields.io/badge/data-local--first-202124?style=flat-square" alt="Local first" />
    <img src="https://img.shields.io/badge/Electron-202124?style=flat-square&logo=electron" alt="Electron" />
    <img src="https://img.shields.io/badge/React-202124?style=flat-square&logo=react" alt="React" />
  </p>
</div>

---

<div align="center">
  <img src="docs/preview.png" width="960" alt="GameShelf 游戏设置界面" />
</div>

---

GameShelf 是一款面向 Windows 本地游戏的桌面管理器。它不区分游戏来自哪个平台，也不要求游戏必须是 Galgame：只要能在本机运行，就可以用统一的封面、资料、启动项、分类与游玩记录来管理。

它的重点不是再造一个商店，而是让已有的本地收藏更好找、更好看，也更容易正确启动。

## 现在可以做什么

| 整理 | 游玩 | 隐私 |
| --- | --- | --- |
| 封面墙、搜索、状态与自定义分类 | 默认启动项与原版、汉化版、补丁版等多启动项 | 敏感游戏可在安全视图中完全隐藏 |
| 原名与中文名独立保存、全局切换 | 自动记录启动次数、最近游玩与游玩时长 | 数据库、图片和记录默认只保存在本机 |
| 欲玩清单与自定义系列合集 | 游戏设置中直接打开所在文件夹 | 移出游戏库不会删除游戏本体或存档 |

## GameShelf 的设计方向

**像内容库，而不是文件启动器。** 主页负责继续游玩与回顾收藏，游戏库负责查找，详情页负责启动；不同页面各自有明确目的。

**本地优先。** 游戏文件仍留在原来的硬盘位置。GameShelf 只保存索引、用户设置、复制后的封面和游玩记录。

**一个游戏，多种玩法。** 同一条目可以维护多个启动项，用来区分原版、汉化版、全年龄版或补丁版，而不必在书库里制造重复游戏。

**为私人收藏保留边界。** 安全视图是产品的一等功能，不是给成人内容单独建立一个显眼分类。

## 功能状态

- [x] 本地 SQLite 游戏库
- [x] 深色 / 浅色外观
- [x] 中文名 / 原名双标题
- [x] 自定义分类与系列合集
- [x] 多启动项与游玩统计
- [x] 本地安全视图
- [ ] Mod 与补丁包管理
- [ ] 存档快照与分支
- [ ] 角色路线与攻略笔记
- [ ] Locale Emulator、脚本与 Magpie 启动助手
- [ ] 可选择的元数据提供方

## 数据与隐私

GameShelf 不上传游戏列表、封面、启动路径或游玩记录。正式版会把数据库、封面、背景和设置放在程序旁的 `data` 文件夹中，整个 `GameShelf` 文件夹可以一起整理或迁移；游戏本体保持在用户原有目录中。

“移出游戏库”只删除 GameShelf 中的索引与关联记录，不会删除游戏目录。

## 本地开发

需要 Node.js 与 Windows 环境：

```bash
npm install
npm start
```

运行检查：

```bash
npm run typecheck
npm test
```

打包 Windows 应用：

```bash
npm run package
```

## 灵感与致谢

GameShelf 从 [PotatoVN](https://github.com/GoldenPotato137/PotatoVN)、[LunaBox](https://github.com/Saramanda9988/LunaBox) 与 [Playnite](https://github.com/JosefNemec/Playnite) 的开源实践中学习了本地游戏管理的思路；界面则探索适合 Windows 的内容库式桌面体验。项目没有复制这些应用的界面、品牌或代码。

---

<div align="center">
  <sub>Early preview · Built for a private local library</sub>
</div>
