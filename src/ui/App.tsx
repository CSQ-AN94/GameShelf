import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { moveCategory, orderCategories } from '../category-order';
import { normalizeTags, type AppPreferences, type BatchImportInput, type ContentRating, type Game, type GameCollection, type GamePackage, type GameSetupAnalysis, type GameStatus, type GameType, type LaunchProfile, type LibraryScanCandidate, type NewGameInput, type PackageChange, type PackageChangePreview, type SaveLocation, type SaveRestorePreview, type ThemeMode, type TitleDisplayMode, type UserProfile } from '../shared';
import { applySafeView } from '../safe-view';
import { gameTypeLabels as typeLabels, ratingLabels, searchGames, statusLabels } from '../search';
import { alternateTitle, displayTitle } from '../title-display';

type LibraryFilter = 'home' | 'settings' | 'all' | 'recent' | 'wishlist' | GameStatus | `category:${string}` | `collection:${string}` | `tag:${string}`;
type SidebarSectionName = 'library' | 'categories' | 'tags' | 'collections';
type IconName = 'home' | 'settings' | 'library' | 'clock' | 'play' | 'check' | 'search' | 'shield' | 'plus' | 'book' | 'more' | 'folder' | 'list' | 'sidebar' | 'chevron' | 'sparkles' | 'sword' | 'buildings' | 'bolt' | 'gamepad' | 'trash' | 'tag';

const iconPaths: Record<IconName, string> = {
  home: 'M3 10.8 12 3l9 7.8M5.5 9.7V21h13V9.7M9.5 21v-7h5v7',
  settings: 'M12 15.3a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  library: 'M4 4v16M9 4v16M14 5v15M19 3l2 16',
  clock: 'M12 7v5l3.5 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  play: 'M8 5v14l11-7Z',
  check: 'm5 12 4 4L19 6',
  search: 'm20 20-4.4-4.4M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  shield: 'M12 22s8-3.8 8-10V5l-8-3-8 3v7c0 6.2 8 10 8 10Z',
  plus: 'M12 5v14M5 12h14',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  folder: 'M3 6h7l2 2h9v11H3Z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  sidebar: 'M5.5 4.5h13A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6a1.5 1.5 0 0 1 1.5-1.5ZM9 4.5v15',
  chevron: 'm8 10 4 4 4-4',
  sparkles: 'M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Zm7 12 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z',
  sword: 'm14 4 6 0v6L10 20l-6-6L14 4Zm-7 13-3 3',
  buildings: 'M4 20V8h7v12M13 20V4h7v16M7 11h1M7 14h1M16 8h1M16 11h1M16 14h1M3 20h18',
  bolt: 'm13 2-8 12h6l-1 8 9-13h-6V2Z',
  gamepad: 'M7 8h10a4 4 0 0 1 3.8 5.2l-1.1 3.4a2 2 0 0 1-3.2 1L14 15h-4l-2.5 2.6a2 2 0 0 1-3.2-1l-1.1-3.4A4 4 0 0 1 7 8Zm0 3v4M5 13h4M16.5 12h.01M18.5 14h.01',
  trash: 'M4 7h16M9 3h6l1 4M7 7l1 14h8l1-14M10 11v6M14 11v6',
  tag: 'M20 13 13 20 4 11V4h7l9 9ZM8 8h.01'
};

const typeIcons: Record<GameType, IconName> = {
  visual_novel: 'sparkles',
  rpg: 'sword',
  simulation: 'buildings',
  action: 'bolt',
  other: 'gamepad'
};

const defaultCategories: Record<GameType, string> = {
  visual_novel: 'Galgame',
  rpg: 'RPG',
  simulation: '模拟经营',
  action: '动作游戏',
  other: '其他游戏'
};

const packageKindLabels = { mod: 'Mod', translation: '汉化补丁', adult_patch: '内容补丁', voice: '语音包', fix: '修复补丁', other: '其他 Package' } as const;

function errorMessage(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason);
  return message.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, '');
}

function Icon({ name, fill = false }: { name: IconName; fill?: boolean }) {
  return (
    <svg className={`app-icon icon-${name}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={iconPaths[name]} fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function playTime(seconds: number): string {
  if (seconds < 60) return seconds ? `${seconds} 秒` : '尚未游玩';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} 小时 ${minutes} 分` : `${minutes} 分钟`;
}

function displayDate(value: string | null): string {
  if (!value) return '从未';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function executableName(game: Game): string {
  return game.executablePath.split(/[\\/]/).pop() ?? game.executablePath;
}

function Poster({ game, titleMode, onOpen }: { game: Game; titleMode: TitleDisplayMode; onOpen: () => void }) {
  const title = displayTitle(game, titleMode);
  const alternate = alternateTitle(game, titleMode);
  return (
    <button className="poster" onClick={onOpen} aria-label={`打开 ${title}`} title={title}>
      <div className="poster-art">
        {game.coverDataUrl ? <img src={game.coverDataUrl} alt="" /> : <div className="poster-placeholder"><span>{title.slice(0, 1).toUpperCase()}</span></div>}
        <div className="poster-overlay"><span className="poster-play"><Icon name="play" fill /></span></div>
        {game.contentRating === 'r18' && <span className="rating-badge">R18</span>}
      </div>
      <span className="poster-title">{title}</span>
      <span className="poster-meta">{statusLabels[game.status]} · {playTime(game.totalPlaySeconds)}</span>
      <span className="poster-full-title" aria-hidden="true"><strong>{title}</strong>{alternate && <small>{alternate}</small>}</span>
    </button>
  );
}

function LibraryList({ games, titleMode, onOpen }: { games: Game[]; titleMode: TitleDisplayMode; onOpen: (game: Game) => void }) {
  return <div className="game-list">{games.map((game) => {
    const title = displayTitle(game, titleMode);
    const alternate = alternateTitle(game, titleMode);
    return <button key={game.id} className="game-list-row" onClick={() => onOpen(game)}>
      <span className="game-list-cover">{game.coverDataUrl ? <img src={game.coverDataUrl} alt="" /> : title.slice(0, 1)}</span>
      <span className="game-list-title"><strong>{title}</strong>{alternate && <small>{alternate}</small>}</span>
      <span>{game.category}</span><span>{statusLabels[game.status]}</span><span>{playTime(game.totalPlaySeconds)}</span>
      <small title={game.executablePath}>{executableName(game)}</small>
    </button>;
  })}</div>;
}

function CollectionSeriesView({ collection, games, titleMode, onOpen, onOrderChange }: { collection: GameCollection; games: Game[]; titleMode: TitleDisplayMode; onOpen: (game: Game) => void; onOrderChange: (ids: string[]) => void }) {
  const ordered = collection.gameIds.map((id) => games.find((game) => game.id === id)).filter((game): game is Game => Boolean(game));
  const completed = ordered.filter((game) => game.status === 'completed').length;
  function move(index: number, offset: number) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= ordered.length) return;
    const ids = ordered.map((game) => game.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex]!, ids[index]!];
    onOrderChange(ids);
  }
  return <div className="series-view"><header><div><strong>系列整体进度</strong><span>{completed} / {ordered.length} 部已完成</span></div><i><b style={{ width: `${ordered.length ? completed / ordered.length * 100 : 0}%` }} /></i></header><div>{ordered.map((game, index) => <article key={game.id}><span className="series-number">{index + 1}</span><button className="series-title" onClick={() => onOpen(game)}><strong>{displayTitle(game, titleMode)}</strong><small>{statusLabels[game.status]} · {playTime(game.totalPlaySeconds)}</small></button><div><button disabled={index === 0} onClick={() => move(index, -1)} aria-label="上移">↑</button><button disabled={index === ordered.length - 1} onClick={() => move(index, 1)} aria-label="下移">↓</button></div></article>)}</div></div>;
}

function ContinueCard({ game, titleMode, onOpen, onLaunch }: { game: Game; titleMode: TitleDisplayMode; onOpen: () => void; onLaunch: () => void }) {
  const title = displayTitle(game, titleMode);
  return (
    <article className={`continue-card ${game.coverDataUrl ? '' : 'without-art'}`}>
      {game.coverDataUrl ? <img src={game.coverDataUrl} alt="" /> : <span className="continue-initial">{title.slice(0, 1)}</span>}
      <div className="continue-shade" />
      <button className="continue-open" onClick={onOpen} aria-label={`查看 ${title}`} />
      <div className="continue-copy"><strong title={title}>{title}</strong><small>{displayDate(game.lastPlayedAt)} · {playTime(game.totalPlaySeconds)}</small></div>
      <button className="continue-play" onClick={onLaunch} aria-label={`启动 ${title}`}><Icon name="play" fill /></button>
    </article>
  );
}

function EmptyLibrary({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-symbol"><Icon name="library" /></div>
      <h2>建立你的游戏书架</h2>
      <p>添加一个本地游戏。封面、记录和资料只保存在这台电脑上。</p>
      <button className="primary-button" onClick={onAdd}><Icon name="plus" />添加第一个游戏</button>
    </div>
  );
}

function HomeView({ games, titleMode, onOpen, onLaunch, onAdd, onShowAll }: {
  games: Game[];
  titleMode: TitleDisplayMode;
  onOpen: (game: Game) => void;
  onLaunch: (game: Game) => void;
  onAdd: () => void;
  onShowAll: () => void;
}) {
  const featured = games.find((game) => game.status === 'playing') ?? games.find((game) => game.lastPlayedAt) ?? games[0];
  if (!featured) return <div className="no-results">当前视图没有游戏</div>;
  const recent = games.filter((game) => game.id !== featured.id && game.lastPlayedAt).slice(0, 3);
  const shelf = games.slice(0, 6);
  const totalPlaySeconds = games.reduce((sum, game) => sum + game.totalPlaySeconds, 0);
  const totalLaunches = games.reduce((sum, game) => sum + game.launchCount, 0);
  const completedCount = games.filter((game) => game.status === 'completed').length;
  const playingCount = games.filter((game) => game.status === 'playing').length;
  const unplayedCount = games.filter((game) => game.status === 'unplayed').length;
  const wishlistCount = games.filter((game) => game.wishlist).length;
  const topGames = [...games].filter((game) => game.totalPlaySeconds > 0).sort((a, b) => b.totalPlaySeconds - a.totalPlaySeconds).slice(0, 3);
  const longestPlay = topGames[0]?.totalPlaySeconds ?? 1;
  const heroArt = featured.backgroundDataUrl ?? featured.coverDataUrl;
  const featuredTitle = displayTitle(featured, titleMode);

  return (
    <div className="home-scroll">
      <section className="home-hero">
        <div className={`home-hero-art ${heroArt ? '' : 'without-art'}`}>
          {heroArt ? <img src={heroArt} alt="" /> : <span>{featuredTitle.slice(0, 1)}</span>}
        </div>
        <div className="home-hero-shade" />
        <div className="home-hero-copy">
          <span className="hero-status">{statusLabels[featured.status]}</span>
          <h1 title={featuredTitle}>{featuredTitle}</h1>
          {featured.developer && <p className="hero-developer">{featured.developer}</p>}
          <p className="hero-description">{featured.description || `${typeLabels[featured.type]} · ${ratingLabels[featured.contentRating]}`}</p>
          <div className="hero-tags"><span>{featured.category}</span><span>{ratingLabels[featured.contentRating]}</span>{featured.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
          <div className="hero-actions">
            <button className="hero-play" onClick={() => onLaunch(featured)}><Icon name="play" fill />{featured.lastPlayedAt ? '继续游玩' : '开始游玩'}</button>
            <button className="hero-profile" title={featured.executablePath}><Icon name="book" />默认启动 · {executableName(featured)}</button>
            <button className="hero-more" onClick={() => onOpen(featured)} aria-label="查看游戏详情"><Icon name="more" /></button>
          </div>
        </div>
        <div className="hero-stats">
          <div><small>总时长</small><strong>{playTime(featured.totalPlaySeconds)}</strong></div>
          <div><small>最近游玩</small><strong>{displayDate(featured.lastPlayedAt)}</strong></div>
          <div><small>启动次数</small><strong>{featured.launchCount} 次</strong></div>
          <div><small>游玩状态</small><strong>{statusLabels[featured.status]}</strong></div>
        </div>
      </section>

      <div className="home-shelves">
        {recent.length > 0 && <section className="home-section"><header><h2>继续游玩</h2><button onClick={() => onShowAll()}>查看全部</button></header><div className="continue-grid">{recent.map((game) => <ContinueCard key={game.id} game={game} titleMode={titleMode} onOpen={() => onOpen(game)} onLaunch={() => onLaunch(game)} />)}</div></section>}
        <section className="home-section">
          <header><div><h2>游戏库</h2><span>{games.length} 个本地游戏</span></div><div className="shelf-actions"><button onClick={onAdd}><Icon name="plus" />添加游戏</button><button onClick={onShowAll}>全部游戏</button></div></header>
          <div className="poster-grid home-grid">{shelf.map((game) => <Poster key={game.id} game={game} titleMode={titleMode} onOpen={() => onOpen(game)} />)}</div>
        </section>
        <section className="stats-window">
          <header><div><span className="stats-mark">⌁</span><div><h2>游戏统计</h2><p>根据这台电脑上的游玩记录生成</p></div></div></header>
          <div className="stats-summary"><div><small>游戏总数</small><strong>{games.length}</strong></div><div><small>累计时长</small><strong>{playTime(totalPlaySeconds)}</strong></div><div><small>启动次数</small><strong>{totalLaunches}</strong></div><div><small>已玩完</small><strong>{completedCount}</strong></div></div>
          <div className="stats-body">
            <div className="library-breakdown"><h3>书库状态</h3><div className="breakdown-bar"><i style={{ width: `${completedCount / games.length * 100}%` }} /><i style={{ width: `${playingCount / games.length * 100}%` }} /><i style={{ width: `${unplayedCount / games.length * 100}%` }} /></div><div className="breakdown-legend"><span><i />已玩完 {completedCount}</span><span><i />游玩中 {playingCount}</span><span><i />欲玩 {wishlistCount}</span></div></div>
            <div className="top-played"><h3>游玩时间最多</h3>{topGames.length === 0 ? <p>开始游玩后，这里会出现统计。</p> : topGames.map((game) => <button key={game.id} onClick={() => onOpen(game)} title={displayTitle(game, titleMode)}><span>{displayTitle(game, titleMode)}</span><i><b style={{ width: `${game.totalPlaySeconds / longestPlay * 100}%` }} /></i><small>{playTime(game.totalPlaySeconds)}</small></button>)}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

function CompletedTimeline({ games, titleMode, onOpen, onStatusChange }: { games: Game[]; titleMode: TitleDisplayMode; onOpen: (game: Game) => void; onStatusChange: (game: Game, status: GameStatus) => void }) {
  const sorted = [...games].sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt));
  if (sorted.length === 0) return <div className="no-results">还没有已玩完的游戏</div>;
  return (
    <div className="timeline">
      {sorted.map((game) => <article className="timeline-entry" key={game.id}>
        <time>{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(game.completedAt ?? game.updatedAt))}</time>
        <span className="timeline-dot" />
        <button className="timeline-cover" onClick={() => onOpen(game)}>{game.coverDataUrl ? <img src={game.coverDataUrl} alt={`${displayTitle(game, titleMode)} 封面`} /> : <span>{displayTitle(game, titleMode).slice(0, 1)}</span>}</button>
        <div className="timeline-copy"><strong title={displayTitle(game, titleMode)}>{displayTitle(game, titleMode)}</strong><small>{game.developer || typeLabels[game.type]}</small><p>{playTime(game.totalPlaySeconds)} · 启动 {game.launchCount} 次</p><button onClick={() => onStatusChange(game, 'playing')}>改为游玩中</button></div>
      </article>)}
    </div>
  );
}

function SettingsView({ preferences, profile, gameCount, collectionCount, onThemeChange, onTitleDisplayModeChange, onSafeViewChange, onEditProfile, onOpenDataDirectory, onCreateBackup, onRestoreBackup, onExportDiagnostics }: {
  preferences: AppPreferences;
  profile: UserProfile;
  gameCount: number;
  collectionCount: number;
  onThemeChange: (theme: ThemeMode) => void;
  onTitleDisplayModeChange: (mode: TitleDisplayMode) => void;
  onSafeViewChange: (enabled: boolean) => void;
  onEditProfile: () => void;
  onOpenDataDirectory: () => void;
  onCreateBackup: () => void;
  onRestoreBackup: () => void;
  onExportDiagnostics: () => void;
}) {
  return (
    <div className="settings-view">
      <header><h1>设置</h1><p>外观、隐私与本机资料</p></header>
      <div className="settings-sections">
        <section className="settings-card"><div className="settings-card-copy"><h2>外观</h2><p>选择适合桌面环境的界面配色。</p></div><div className="theme-options"><button className={preferences.theme === 'dark' ? 'selected' : ''} onClick={() => onThemeChange('dark')}><span className="theme-preview dark"><i /><i /><i /></span><strong>深色</strong></button><button className={preferences.theme === 'light' ? 'selected' : ''} onClick={() => onThemeChange('light')}><span className="theme-preview light"><i /><i /><i /></span><strong>浅色</strong></button></div></section>
        <section className="settings-card settings-row"><div className="settings-card-copy"><h2>游戏标题</h2><p>选择书库默认显示原名还是中文名；未填写中文名的游戏会自动显示原名。</p></div><div className="title-mode-options" role="group" aria-label="游戏标题显示方式"><button className={preferences.titleDisplayMode === 'original' ? 'selected' : ''} onClick={() => onTitleDisplayModeChange('original')}>原名</button><button className={preferences.titleDisplayMode === 'chinese' ? 'selected' : ''} onClick={() => onTitleDisplayModeChange('chinese')}>中文名</button></div></section>
        <section className="settings-card settings-row"><div className="settings-card-copy"><h2>安全视图</h2><p>开启后隐藏你在各游戏设置中指定的内容。</p></div><button className={preferences.safeView ? 'settings-switch on' : 'settings-switch'} onClick={() => onSafeViewChange(!preferences.safeView)}><i /></button></section>
        <section className="settings-card settings-row"><div className="settings-profile">{profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : <span>{profile.name.slice(0, 1) || '玩'}</span>}<div><h2>{profile.name}</h2><p>头像与昵称</p></div></div><button className="settings-action" onClick={onEditProfile}>编辑资料</button></section>
        <section className="settings-card settings-row"><div className="settings-card-copy"><h2>本机资料</h2><p>{gameCount} 个游戏 · {collectionCount} 个合集。数据库、封面和记录保存在 Windows 应用数据目录。</p></div><button className="settings-action" onClick={onOpenDataDirectory}>打开文件夹</button></section>
        <section className="settings-card settings-row"><div className="settings-card-copy"><h2>数据安全与诊断</h2><p>每天首次启动自动备份数据库。恢复前会校验备份并保留当前游戏库；所有操作都不会写入游戏目录。</p></div><div className="settings-actions"><button className="settings-action" onClick={onCreateBackup}>立即备份</button><button className="settings-action" onClick={onRestoreBackup}>从备份恢复</button><button className="settings-action" onClick={onExportDiagnostics}>导出诊断</button></div></section>
      </div>
    </div>
  );
}

function GameDetail({ game, titleMode, collections, onBack, onLaunch, onStatusChange, onToggleWishlist, onEditCategory, onManageCollections, onEditSettings }: {
  game: Game;
  titleMode: TitleDisplayMode;
  collections: GameCollection[];
  onBack: () => void;
  onLaunch: (profileId?: string) => void;
  onStatusChange: (status: GameStatus) => void;
  onToggleWishlist: () => void;
  onEditCategory: () => void;
  onManageCollections: () => void;
  onEditSettings: () => void;
}) {
  const backdrop = game.backgroundDataUrl ?? game.coverDataUrl;
  const title = displayTitle(game, titleMode);
  const alternate = alternateTitle(game, titleMode);
  const metadata = [
    game.releaseDate && ['发布日期', game.releaseDate],
    game.languages.length > 0 && ['语言', game.languages.join('、')],
    game.score != null && ['评分', String(game.score)]
  ].filter(Boolean) as string[][];

  return (
    <article className="detail-view">
      <div className="detail-backdrop">{backdrop ? <img src={backdrop} alt="" /> : <span>{title.slice(0, 1)}</span>}</div>
      <div className="detail-shade" />
      <button className="back-button" onClick={onBack}>‹ 返回游戏库</button>
      <div className="detail-content">
        <div className="detail-cover">{game.coverDataUrl ? <img src={game.coverDataUrl} alt={`${title} 封面`} /> : <div>{title.slice(0, 1)}</div>}</div>
        <div className="detail-copy">
          <div className="detail-kicker"><button className="category-chip" onClick={onEditCategory}>{game.category}</button><span>{typeLabels[game.type]}</span><span>{ratingLabels[game.contentRating]}</span><span>{statusLabels[game.status]}</span>{game.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <h1>{title}</h1>
          {alternate && <p className="detail-alternate-title">{alternate}</p>}
          <p className="detail-developer">{game.developer || '未填写会社或开发者'}</p>
          <p className="detail-description">{game.description || '还没有简介。之后可以补充本地资料或接入元数据源。'}</p>
          <div className="detail-actions"><button className="play-button" onClick={() => onLaunch()}><Icon name="play" fill />{game.lastPlayedAt ? '继续游玩' : '开始游玩'}</button><select className="status-select" value={game.status} onChange={(event) => onStatusChange(event.target.value as GameStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className={game.wishlist ? 'collection-button active' : 'collection-button'} onClick={onToggleWishlist}>{game.wishlist ? '已加入欲玩' : '加入欲玩'}</button><button className="collection-button" onClick={onManageCollections}><Icon name="folder" />管理合集</button></div>
          <section className="launch-panel"><header><div><small>启动方式</small><strong>{game.launchProfiles.length} 个启动项</strong></div><button onClick={onEditSettings}>游戏设置</button></header>{game.launchProfiles.map((profile) => <div className="launch-profile" key={profile.id}><span><Icon name="book" /></span><div><small>{profile.isDefault ? '默认启动' : '启动项'}</small><strong>{profile.name} · {profile.executablePath.split(/[\\/]/).pop()}</strong></div><button onClick={() => onLaunch(profile.id)}><Icon name="play" fill />启动</button></div>)}</section>
          {collections.some((collection) => collection.gameIds.includes(game.id)) && <div className="detail-collections">{collections.filter((collection) => collection.gameIds.includes(game.id)).map((collection) => <span key={collection.id}>{collection.name}</span>)}</div>}
          <dl className="stats-strip"><div><dt>总时长</dt><dd>{playTime(game.totalPlaySeconds)}</dd></div><div><dt>启动次数</dt><dd>{game.launchCount}</dd></div><div><dt>最近游玩</dt><dd>{displayDate(game.lastPlayedAt)}</dd></div></dl>
          {metadata.length > 0 && <dl className="metadata-list">{metadata.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
        </div>
      </div>
    </article>
  );
}

function AddGameDialog({ categorySuggestions, onClose, onAdded }: { categorySuggestions: string[]; onClose: () => void; onAdded: (game: Game) => void }) {
  const [title, setTitle] = useState('');
  const [chineseTitle, setChineseTitle] = useState('');
  const [type, setType] = useState<GameType>('other');
  const [category, setCategory] = useState('');
  const [contentRating, setContentRating] = useState<ContentRating>('general');
  const [status, setStatus] = useState<GameStatus>('unplayed');
  const [wishlist, setWishlist] = useState(false);
  const [hideInSafeView, setHideInSafeView] = useState(false);
  const [executablePath, setExecutablePath] = useState('');
  const [coverSourcePath, setCoverSourcePath] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<GameSetupAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function chooseExecutable() {
    const selected = await window.gameshelf.pickExecutable();
    if (!selected) return;
    setExecutablePath(selected);
    setAnalysis(null);
    setAnalyzing(true);
    setError('');
    if (!title) {
      const fileName = selected.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') ?? '';
      const parentName = selected.split(/[\\/]/).slice(-2, -1)[0] ?? fileName;
      setTitle((/^(?:game|launcher|bgi)$/i.test(fileName) ? parentName : fileName).replace(/^\[[^\]]+\]\s*/, '').replace(/[_-]+/g, ' '));
    }
    try {
      const detected = await window.gameshelf.analyzeExecutable(selected);
      setAnalysis(detected);
      setType(detected.suggestedType);
      setCategory(detected.suggestedCategory);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAnalyzing(false);
    }
  }

  async function chooseCover() {
    const selected = await window.gameshelf.pickCover();
    if (!selected) return;
    setCoverSourcePath(selected.path);
    setCoverPreview(selected.dataUrl);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const input: NewGameInput = { title, chineseTitle, type, category, contentRating, executablePath, coverSourcePath, status, wishlist, hideInSafeView };
      onAdded(await window.gameshelf.addGame(input));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
        <header className="modal-header"><div><span className="eyebrow">本地游戏</span><h2 id="add-title">添加到 GameShelf</h2></div><button className="close-button" onClick={onClose} aria-label="关闭">×</button></header>
        <form onSubmit={submit}>
          <div className="add-layout">
            <button className="cover-picker" type="button" onClick={chooseCover}>{coverPreview ? <img src={coverPreview} alt="封面预览" /> : <><Icon name="plus" /><small>选择封面</small></>}</button>
            <div className="form-fields">
              <label>游戏原名<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="作品的原始完整名称" /></label>
              <label>中文名（可选）<input value={chineseTitle} onChange={(event) => setChineseTitle(event.target.value)} placeholder="用于中文标题显示模式" /></label>
              <label>启动文件<div className="path-field"><input readOnly value={executablePath} placeholder="选择 .exe 文件" /><button type="button" onClick={chooseExecutable}>选择</button></div></label>
              {(analyzing || analysis) && <div className="detection-summary">{analyzing ? <span>正在识别游戏结构…</span> : <><strong>{analysis?.engine ?? '未识别引擎'}</strong><span>{analysis?.alternativeExecutables.length ?? 0} 个其他启动项</span><span>{analysis?.modDirectories.length ?? 0} 个 Mod 位置</span><span>{analysis?.saveDirectories.length ?? 0} 个存档位置</span><span>{analysis?.patchDirectories.length ?? 0} 个补丁位置</span></>}</div>}
              <div className="form-row"><label>游戏类型<select value={type} onChange={(event) => setType(event.target.value as GameType)}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>内容分级<select value={contentRating} onChange={(event) => { const rating = event.target.value as ContentRating; setContentRating(rating); if (rating === 'r18') setHideInSafeView(true); }}>{Object.entries(ratingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
              <label>分类<input value={category} list="game-category-suggestions" onChange={(event) => setCategory(event.target.value)} placeholder={`自动：${defaultCategories[type]}`} /><datalist id="game-category-suggestions">{categorySuggestions.map((item) => <option key={item} value={item} />)}</datalist></label>
              <label>游玩状态<select value={status} onChange={(event) => setStatus(event.target.value as GameStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <div className="settings-checks"><label><input type="checkbox" checked={wishlist} onChange={(event) => setWishlist(event.target.checked)} />加入欲玩清单</label><label><input type="checkbox" checked={hideInSafeView} onChange={(event) => setHideInSafeView(event.target.checked)} />安全视图中隐藏</label></div>
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <footer className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={saving}>{saving ? '正在添加…' : '添加游戏'}</button></footer>
        </form>
      </section>
    </div>
  );
}

type ScanDraft = LibraryScanCandidate & { selected: boolean; status: GameStatus; hideInSafeView: boolean };

function ScanImportDialog({ onClose, onImported }: { onClose: () => void; onImported: (games: Game[]) => void }) {
  const [candidates, setCandidates] = useState<ScanDraft[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function scan() {
    setScanning(true);
    setError('');
    try {
      const results = await window.gameshelf.scanLibrary();
      if (results) setCandidates(results.map((candidate) => ({ ...candidate, selected: !candidate.duplicatePath && !candidate.duplicateGameId, status: 'unplayed', hideInSafeView: candidate.contentRating === 'r18' })));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setScanning(false); }
  }

  function patchCandidate(id: string, patch: Partial<ScanDraft>) {
    setCandidates((current) => current?.map((candidate) => candidate.id === id ? { ...candidate, ...patch } : candidate) ?? null);
  }

  async function importSelected() {
    const selected = candidates?.filter((candidate) => candidate.selected) ?? [];
    if (!selected.length) return setError('请至少选择一个没有重复路径的游戏');
    setSaving(true);
    setError('');
    try {
      const inputs: BatchImportInput[] = selected.map((candidate) => ({
        title: candidate.title,
        chineseTitle: candidate.chineseTitle,
        type: candidate.type,
        category: candidate.category,
        contentRating: candidate.contentRating,
        executablePath: candidate.executablePath,
        coverSourcePath: candidate.coverSourcePath,
        status: candidate.status,
        hideInSafeView: candidate.hideInSafeView,
        launchProfiles: candidate.launchProfiles
      }));
      onImported(await window.gameshelf.importGames(inputs));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }

  const selectedCount = candidates?.filter((candidate) => candidate.selected).length ?? 0;
  return <div className="modal-backdrop"><section className="modal scan-modal" role="dialog" aria-modal="true" aria-labelledby="scan-title">
    <header className="modal-header"><div><span className="eyebrow">批量导入</span><h2 id="scan-title">扫描、审核并导入</h2></div><button className="close-button" onClick={onClose}>×</button></header>
    {!candidates ? <div className="scan-start"><Icon name="search" /><h3>选择一个或多个游戏目录</h3><p>只读取目录、Windows 启动文件与可选的本地 <code>gameshelf.json</code>。不会联网，也不会写入游戏目录。</p><button className="primary-button" onClick={() => void scan()} disabled={scanning}>{scanning ? '正在扫描…' : '选择目录并扫描'}</button></div> : <div className="scan-review">
      <div className="scan-summary"><strong>找到 {candidates.length} 个候选游戏</strong><span>已选择 {selectedCount} 个；重复路径默认不选中</span><button className="secondary-button" onClick={() => void scan()} disabled={scanning}>重新扫描</button></div>
      <div className="scan-candidates">{candidates.map((candidate) => <article className={candidate.selected ? 'scan-candidate selected' : 'scan-candidate'} key={candidate.id}>
        <label className="scan-select"><input type="checkbox" checked={candidate.selected} disabled={candidate.duplicatePath} onChange={(event) => patchCandidate(candidate.id, { selected: event.target.checked })} /><span /></label>
        <div className="scan-copy"><div className="scan-title-fields"><input value={candidate.title} onChange={(event) => patchCandidate(candidate.id, { title: event.target.value })} aria-label="游戏名称" /><select value={candidate.titleOptions.some((option) => option.value === candidate.title) ? candidate.title : ''} onChange={(event) => event.target.value && patchCandidate(candidate.id, { title: event.target.value })}><option value="">自定义名称</option>{candidate.titleOptions.map((option) => <option key={`${option.source}-${option.value}`} value={option.value}>{option.source}：{option.value}</option>)}</select></div>
          <p title={candidate.folderPath}>{candidate.folderPath}</p><div className="scan-badges"><span>{candidate.engine ?? '未识别引擎'}</span>{candidate.issues.map((issue) => <em key={issue}>{issue}</em>)}</div>
          <div className="scan-fields"><label>中文名<input value={candidate.chineseTitle} onChange={(event) => patchCandidate(candidate.id, { chineseTitle: event.target.value })} /></label><label>分类<input value={candidate.category} onChange={(event) => patchCandidate(candidate.id, { category: event.target.value })} /></label><label>类型<select value={candidate.type} onChange={(event) => patchCandidate(candidate.id, { type: event.target.value as GameType })}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>状态<select value={candidate.status} onChange={(event) => patchCandidate(candidate.id, { status: event.target.value as GameStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>分级<select value={candidate.contentRating} onChange={(event) => { const contentRating = event.target.value as ContentRating; patchCandidate(candidate.id, { contentRating, hideInSafeView: contentRating === 'r18' || candidate.hideInSafeView }); }}>{Object.entries(ratingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="scan-privacy"><input type="checkbox" checked={candidate.hideInSafeView} onChange={(event) => patchCandidate(candidate.id, { hideInSafeView: event.target.checked })} />安全视图隐藏</label></div>
          <small>{candidate.launchProfiles.length} 个启动项 · {candidate.coverSourcePath ? '发现本地封面' : '导入后需要补充封面'}</small>
        </div>
      </article>)}</div>
    </div>}
    {error && <p className="form-error">{error}</p>}
    <footer className="modal-footer"><button className="secondary-button" onClick={onClose}>取消</button>{candidates && <button className="primary-button" disabled={!selectedCount || saving} onClick={() => void importSelected()}>{saving ? '正在导入…' : `确认导入 ${selectedCount} 个`}</button>}</footer>
  </section></div>;
}

function BulkEditDialog({ games, initialIds, collections, onClose, onChanged, onSaved }: { games: Game[]; initialIds?: string[]; collections: GameCollection[]; onClose: () => void; onChanged: (game: Game) => void; onSaved: (games: Game[]) => void }) {
  const [items, setItems] = useState(games);
  const [selected, setSelected] = useState(() => new Set(initialIds ?? []));
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [privacy, setPrivacy] = useState('');
  const [collectionIds, setCollectionIds] = useState(new Set<string>());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function replaceCover(game: Game) {
    const cover = await window.gameshelf.pickCover();
    if (!cover) return;
    try {
      const updated = await window.gameshelf.updateGameSettings(game.id, { title: game.title, chineseTitle: game.chineseTitle, wishlist: game.wishlist, hideInSafeView: game.hideInSafeView, tags: game.tags, coverSourcePath: cover.path });
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      onChanged(updated);
    } catch (reason) { setError(errorMessage(reason)); }
  }

  async function save() {
    if (!selected.size) return setError('请至少选择一个游戏');
    setSaving(true);
    setError('');
    try {
      onSaved(await window.gameshelf.bulkEditGames({
        gameIds: [...selected],
        status: status ? status as GameStatus : undefined,
        category: category.trim() || undefined,
        hideInSafeView: privacy === '' ? undefined : privacy === 'hide',
        addCollectionIds: [...collectionIds]
      }));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }

  const missingCovers = items.filter((game) => !game.coverDataUrl);
  return <div className="modal-backdrop"><section className="modal bulk-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-title">
    <header className="modal-header"><div><span className="eyebrow">批量整理</span><h2 id="bulk-title">整理游戏资料</h2></div><button className="close-button" onClick={onClose}>×</button></header>
    <div className="bulk-layout"><section><header><strong>选择游戏</strong><button onClick={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((game) => game.id)))}>{selected.size === items.length ? '取消全选' : '全选'}</button></header><div className="bulk-game-list">{items.map((game) => <label key={game.id}><input type="checkbox" checked={selected.has(game.id)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(game.id) ? next.delete(game.id) : next.add(game.id); return next; })} /><span><strong>{game.title}</strong><small>{game.category} · {statusLabels[game.status]}</small></span></label>)}</div></section>
      <section className="bulk-fields"><label>游玩状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">不修改</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>分类<input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="留空则不修改" /></label><label>隐私<select value={privacy} onChange={(event) => setPrivacy(event.target.value)}><option value="">不修改</option><option value="hide">安全视图中隐藏</option><option value="show">安全视图中显示</option></select></label><fieldset><legend>加入合集</legend>{collections.length ? collections.map((collection) => <label key={collection.id}><input type="checkbox" checked={collectionIds.has(collection.id)} onChange={() => setCollectionIds((current) => { const next = new Set(current); next.has(collection.id) ? next.delete(collection.id) : next.add(collection.id); return next; })} />{collection.name}</label>) : <small>还没有合集</small>}</fieldset></section>
    </div>
    <section className="missing-cover-check"><header><strong>缺失封面检查</strong><span>{missingCovers.length} 个待处理</span></header>{missingCovers.length === 0 ? <p>所选范围内没有缺失封面。</p> : <div>{missingCovers.map((game) => <button key={game.id} onClick={() => void replaceCover(game)}><span>{game.title}</span><strong>选择封面</strong></button>)}</div>}</section>
    {error && <p className="form-error">{error}</p>}
    <footer className="modal-footer"><button className="secondary-button" onClick={onClose}>稍后整理</button><button className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? '正在保存…' : `应用到 ${selected.size} 个游戏`}</button></footer>
  </section></div>;
}

function CollectionDialog({ collection, onClose, onSaved, onDeleted }: { collection?: GameCollection; onClose: () => void; onSaved: (collection: GameCollection) => void; onDeleted?: (collectionId: string) => void }) {
  const [name, setName] = useState(collection?.name ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try { onSaved(collection ? await window.gameshelf.renameCollection(collection.id, name) : await window.gameshelf.createCollection(name)); } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(false); }
  }
  async function remove() {
    if (!collection) return;
    setError('');
    setBusy(true);
    try { await window.gameshelf.deleteCollection(collection.id); onDeleted?.(collection.id); } catch (reason) { setError(errorMessage(reason)); setConfirmingDeletion(false); } finally { setBusy(false); }
  }
  return (
    <div className="modal-backdrop"><section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="collection-title"><header className="modal-header"><div><span className="eyebrow">我的合集</span><h2 id="collection-title">{collection ? '编辑游戏合集' : '新建游戏合集'}</h2></div><button className="close-button" onClick={onClose} disabled={busy}>×</button></header><form onSubmit={submit}><div className="form-fields"><label>合集名称<input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：苍之彼方系列" /></label></div>{error && <p className="form-error">{error}</p>}<footer className="modal-footer">{collection && <button type="button" className="danger-button" onClick={() => setConfirmingDeletion(true)} disabled={busy}>删除合集</button>}<button type="button" className="secondary-button" onClick={onClose} disabled={busy}>取消</button><button className="primary-button" disabled={busy}>{busy ? '正在保存…' : collection ? '保存修改' : '创建合集'}</button></footer></form>{confirmingDeletion && collection && <div className="confirm-layer"><section className="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-collection-title"><span className="confirm-icon"><Icon name="trash" /></span><h3 id="delete-collection-title">删除“{collection.name}”？</h3><p>只删除合集与归属关系，不会删除游戏或游戏文件。</p><div><button className="secondary-button" onClick={() => setConfirmingDeletion(false)} disabled={busy}>取消</button><button className="danger-button solid" onClick={() => void remove()} disabled={busy}>{busy ? '正在删除…' : '确认删除'}</button></div></section></div>}</section></div>
  );
}

function ProfileDialog({ profile, onClose, onSaved }: { profile: UserProfile; onClose: () => void; onSaved: (profile: UserProfile) => void }) {
  const [name, setName] = useState(profile.name);
  const [avatarSourcePath, setAvatarSourcePath] = useState<string | null>(null);
  const [preview, setPreview] = useState(profile.avatarDataUrl ?? null);
  const [error, setError] = useState('');
  async function chooseAvatar() {
    const image = await window.gameshelf.pickCover();
    if (!image) return;
    setAvatarSourcePath(image.path);
    setPreview(image.dataUrl);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try { onSaved(await window.gameshelf.saveProfile({ name, avatarSourcePath })); } catch (reason) { setError(errorMessage(reason)); }
  }
  return (
    <div className="modal-backdrop"><section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><header className="modal-header"><div><span className="eyebrow">个人资料</span><h2 id="profile-title">编辑头像与昵称</h2></div><button className="close-button" onClick={onClose}>×</button></header><form onSubmit={submit}><div className="profile-editor"><button className="avatar-picker" type="button" onClick={chooseAvatar}>{preview ? <img src={preview} alt="头像预览" /> : <span>{name.slice(0, 1) || '玩'}</span>}<small>选择头像</small></button><div className="form-fields"><label>昵称<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="你的昵称" /></label></div></div>{error && <p className="form-error">{error}</p>}<footer className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button">保存</button></footer></form></section></div>
  );
}

function CollectionMembershipDialog({ game, titleMode, collections, onClose, onSaved }: { game: Game; titleMode: TitleDisplayMode; collections: GameCollection[]; onClose: () => void; onSaved: (ids: string[]) => void }) {
  const [selected, setSelected] = useState(() => new Set(collections.filter((collection) => collection.gameIds.includes(game.id)).map((collection) => collection.id)));
  return (
    <div className="modal-backdrop"><section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="membership-title"><header className="modal-header"><div><span className="eyebrow">{displayTitle(game, titleMode)}</span><h2 id="membership-title">管理所属合集</h2></div><button className="close-button" onClick={onClose}>×</button></header><div className="membership-list">{collections.length === 0 ? <p>请先在侧栏新建一个合集。</p> : collections.map((collection) => <label key={collection.id}><input type="checkbox" checked={selected.has(collection.id)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(collection.id) ? next.delete(collection.id) : next.add(collection.id); return next; })} /><span><strong>{collection.name}</strong><small>{collection.gameIds.length} 个游戏</small></span></label>)}</div><footer className="modal-footer membership-footer"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={() => onSaved([...selected])}>保存</button></footer></section></div>
  );
}

function CategoryDialog({ game, titleMode, suggestions, onClose, onSaved }: { game: Game; titleMode: TitleDisplayMode; suggestions: string[]; onClose: () => void; onSaved: (category: string) => void }) {
  const [category, setCategory] = useState(game.category);
  return (
    <div className="modal-backdrop"><section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="category-title"><header className="modal-header"><div><span className="eyebrow">{displayTitle(game, titleMode)}</span><h2 id="category-title">修改游戏分类</h2></div><button className="close-button" onClick={onClose}>×</button></header><div className="category-editor"><div className="form-fields"><label>分类<input autoFocus value={category} list="category-edit-suggestions" onChange={(event) => setCategory(event.target.value)} /><datalist id="category-edit-suggestions">{suggestions.map((item) => <option key={item} value={item} />)}</datalist></label></div><p>可以选择现有分类，也可以直接输入新的分类名称。</p></div><footer className="modal-footer membership-footer"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={() => onSaved(category)}>保存</button></footer></section></div>
  );
}

type LaunchProfileDraft = LaunchProfile & { isNew?: boolean };

function GameFilesPanel({ game }: { game: Game }) {
  const [packages, setPackages] = useState<GamePackage[]>([]);
  const [changes, setChanges] = useState<PackageChange[]>([]);
  const [locations, setLocations] = useState<SaveLocation[]>([]);
  const [locationName, setLocationName] = useState('本地存档');
  const [branchNames, setBranchNames] = useState<Record<string, string>>({});
  const [snapshotNames, setSnapshotNames] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ kind: 'package'; value: PackageChangePreview } | { kind: 'save'; value: SaveRestorePreview } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refreshFiles = useCallback(async () => {
    try {
      const [nextPackages, nextChanges, nextLocations] = await Promise.all([window.gameshelf.detectPackages(game.id), window.gameshelf.listPackageChanges(game.id), window.gameshelf.listSaveLocations(game.id)]);
      setPackages(nextPackages); setChanges(nextChanges); setLocations(nextLocations);
    } catch (reason) {
      setError(errorMessage(reason));
      try { setPackages(await window.gameshelf.listPackages(game.id)); } catch { /* keep the actionable detection error */ }
    }
  }, [game.id]);

  useEffect(() => { void refreshFiles(); }, [refreshFiles]);

  async function previewPackage(item: GamePackage, enabled: boolean) {
    setError('');
    try { setPreview({ kind: 'package', value: await window.gameshelf.previewPackageChange(game.id, item.id, enabled) }); }
    catch (reason) { setError(errorMessage(reason)); }
  }

  async function applyPreview() {
    if (!preview) return;
    setBusy(true); setError('');
    try {
      if (preview.kind === 'package') await window.gameshelf.applyPackageChange(preview.value.token);
      else setLocations(await window.gameshelf.applySaveRestore(preview.value.token));
      setPreview(null);
      await refreshFiles();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function addLocation() {
    setError('');
    try {
      const selected = await window.gameshelf.pickSaveDirectory();
      if (selected) setLocations(await window.gameshelf.addSaveLocation(game.id, locationName, selected));
    } catch (reason) { setError(errorMessage(reason)); }
  }

  async function createBranch(locationId: string) {
    setError('');
    try {
      setLocations(await window.gameshelf.createSaveBranch(locationId, branchNames[locationId] ?? '主分支'));
      setBranchNames((current) => ({ ...current, [locationId]: '' }));
    } catch (reason) { setError(errorMessage(reason)); }
  }

  async function createSnapshot(branchId: string) {
    setBusy(true); setError('');
    try {
      setLocations(await window.gameshelf.createSaveSnapshot(branchId, snapshotNames[branchId] ?? '手动快照'));
      setSnapshotNames((current) => ({ ...current, [branchId]: '' }));
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function previewRestore(snapshotId: string) {
    setError('');
    try { setPreview({ kind: 'save', value: await window.gameshelf.previewSaveRestore(snapshotId) }); }
    catch (reason) { setError(errorMessage(reason)); }
  }

  const latestChange = changes[0];
  return <section className="game-files-panel">
    <section className="file-surface"><header><div><h3>Mod 与补丁</h3><p>默认只检测。变更前必须预览、备份并确认；GameShelf 只重命名完整目录。</p></div><button className="settings-action" onClick={() => void refreshFiles()}>重新检测</button></header>
      {packages.length === 0 ? <p className="files-empty">没有识别到可安全管理的 Mod/补丁目录。</p> : <div className="package-list">{packages.map((item) => <article key={item.id}><div><span>{packageKindLabels[item.kind]}</span><strong>{item.name}</strong><small title={item.enabled ? item.path : item.disabledPath}>{item.enabled ? item.path : item.disabledPath}</small></div><button className={item.enabled ? 'danger-button' : 'secondary-button'} onClick={() => void previewPackage(item, !item.enabled)}>{item.enabled ? '预览停用' : '预览启用'}</button></article>)}</div>}
      {latestChange && <div className="change-log"><div><strong>最近变更：{latestChange.packageName}</strong><small>{latestChange.enabledAfter ? '已启用' : '已停用'} · 备份 {latestChange.backupPath}</small></div>{packages.find((item) => item.id === latestChange.packageId)?.enabled === latestChange.enabledAfter && <button className="secondary-button" onClick={() => { const item = packages.find((candidate) => candidate.id === latestChange.packageId); if (item) void previewPackage(item, latestChange.enabledBefore); }}>撤销上次变更</button>}</div>}
    </section>
    <section className="file-surface"><header><div><h3>存档快照与分支</h3><p>快照包含 SHA-256 清单；恢复前自动创建恢复前快照，并保留原目录副本。</p></div><div className="save-location-add"><input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="位置名称" /><button className="settings-action" onClick={() => void addLocation()}>添加存档位置</button></div></header>
      {locations.length === 0 ? <p className="files-empty">还没有配置存档位置。</p> : <div className="save-locations">{locations.map((location) => <article key={location.id}><header><div><strong>{location.name}</strong><small title={location.path}>{location.path}</small></div><div><input value={branchNames[location.id] ?? ''} onChange={(event) => setBranchNames((current) => ({ ...current, [location.id]: event.target.value }))} placeholder="新分支名称" /><button className="secondary-button" onClick={() => void createBranch(location.id)}>新建分支</button></div></header><div className="save-branches">{location.branches.map((branch) => <section key={branch.id}><header><strong>{branch.name}</strong><div><input value={snapshotNames[branch.id] ?? ''} onChange={(event) => setSnapshotNames((current) => ({ ...current, [branch.id]: event.target.value }))} placeholder="快照名称" /><button className="secondary-button" disabled={busy} onClick={() => void createSnapshot(branch.id)}>创建快照</button></div></header>{branch.snapshots.length === 0 ? <small>还没有快照</small> : <div>{branch.snapshots.map((snapshot) => <article key={snapshot.id}><span><strong>{snapshot.name}</strong><small>{snapshot.kind === 'before_restore' ? '恢复前快照' : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(snapshot.createdAt))}</small></span><button className="secondary-button" onClick={() => void previewRestore(snapshot.id)}>预览恢复</button></article>)}</div>}</section>)}</div></article>)}</div>}
    </section>
    {error && <p className="form-error">{error}</p>}
    {preview && <div className="confirm-layer"><section className="confirm-card file-preview-card" role="alertdialog" aria-modal="true"><span className="confirm-icon"><Icon name="shield" /></span><h3>{preview.kind === 'package' ? `${preview.value.enabled ? '启用' : '停用'} ${preview.value.packageName}` : `恢复 ${preview.value.snapshotName}`}</h3>{preview.kind === 'package' ? <><p>来源、目标和备份将按以下路径执行；确认后主进程仍会再次核对。</p><small>来源：{preview.value.sourcePath}<br />目标：{preview.value.targetPath}<br />备份：{preview.value.backupPath}</small></> : <><p>快照已通过校验。恢复前会自动保存当前存档，旧目录也会保留。</p><small>快照：{preview.value.sourcePath}<br />目标：{preview.value.targetPath}<br />恢复前快照：{preview.value.preRestoreSnapshotPath}</small></>}<div><button className="secondary-button" onClick={() => setPreview(null)} disabled={busy}>取消</button><button className="primary-button" onClick={() => void applyPreview()} disabled={busy}>{busy ? '正在安全执行…' : '继续并二次确认'}</button></div></section></div>}
  </section>;
}

function GameSettingsDialog({ game, titleMode, onClose, onChanged, onRemoved }: { game: Game; titleMode: TitleDisplayMode; onClose: () => void; onChanged: (game: Game) => void; onRemoved: (game: Game) => void }) {
  const [title, setTitle] = useState(game.title);
  const [chineseTitle, setChineseTitle] = useState(game.chineseTitle);
  const [wishlist, setWishlist] = useState(game.wishlist);
  const [hideInSafeView, setHideInSafeView] = useState(game.hideInSafeView);
  const [tags, setTags] = useState(game.tags);
  const [tagInput, setTagInput] = useState('');
  const [coverSourcePath, setCoverSourcePath] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState(game.coverDataUrl ?? null);
  const [backgroundSourcePath, setBackgroundSourcePath] = useState<string | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState(game.backgroundDataUrl ?? null);
  const [profiles, setProfiles] = useState<LaunchProfileDraft[]>(game.launchProfiles);
  const [pane, setPane] = useState<'overview' | 'launch' | 'files'>('overview');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => setProfiles(game.launchProfiles), [game.launchProfiles]);

  function patchProfile(id: string, patch: Partial<LaunchProfileDraft>) {
    setProfiles((current) => current.map((profile) => profile.id === id ? { ...profile, ...patch } : profile));
  }

  async function chooseCover() {
    const selected = await window.gameshelf.pickCover();
    if (!selected) return;
    setCoverSourcePath(selected.path);
    setCoverPreview(selected.dataUrl);
    setSaved(false);
  }

  async function chooseBackground() {
    const selected = await window.gameshelf.pickBackground();
    if (!selected) return;
    setBackgroundSourcePath(selected.path);
    setBackgroundPreview(selected.dataUrl);
    setSaved(false);
  }

  function addTag() {
    const normalized = normalizeTags([tagInput])[0];
    if (!normalized) return;
    if (normalized.length > 40) return setError('单个标签最多 40 个字符');
    const next = normalizeTags([...tags, normalized]);
    if (next.length > 30) return setError('每个游戏最多添加 30 个标签');
    setError('');
    setTags(next);
    setTagInput('');
    setSaved(false);
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((item) => item !== tag));
    setSaved(false);
  }

  async function chooseExecutable(id: string) {
    const selected = await window.gameshelf.pickExecutable();
    if (selected) patchProfile(id, { executablePath: selected, workingDirectory: selected.replace(/[\\/][^\\/]+$/, '') });
  }

  async function openGameDirectory() {
    setError('');
    try { await window.gameshelf.openGameDirectory(game.id); }
    catch (reason) { setError(errorMessage(reason)); }
  }

  async function removeFromLibrary() {
    setError('');
    setRemoving(true);
    try {
      await window.gameshelf.removeGame(game.id);
      onRemoved(game);
    } catch (reason) {
      setConfirmingRemoval(false);
      setError(errorMessage(reason));
    } finally { setRemoving(false); }
  }

  async function saveGeneral(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      onChanged(await window.gameshelf.updateGameSettings(game.id, { title, chineseTitle, wishlist, hideInSafeView, tags, coverSourcePath, backgroundSourcePath }));
      setCoverSourcePath(null);
      setBackgroundSourcePath(null);
      setSaved(true);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }

  async function saveProfile(profile: LaunchProfileDraft, makeDefault = profile.isDefault) {
    setError('');
    try {
      const updated = await window.gameshelf.saveLaunchProfile(game.id, {
        id: profile.isNew ? undefined : profile.id,
        name: profile.name,
        executablePath: profile.executablePath,
        launchArguments: profile.launchArguments,
        isDefault: makeDefault
      });
      setProfiles(updated.launchProfiles);
      onChanged(updated);
    } catch (reason) { setError(errorMessage(reason)); }
  }

  async function deleteProfile(profile: LaunchProfileDraft) {
    if (profile.isNew) return setProfiles((current) => current.filter((item) => item.id !== profile.id));
    setError('');
    try {
      const updated = await window.gameshelf.deleteLaunchProfile(game.id, profile.id);
      setProfiles(updated.launchProfiles);
      onChanged(updated);
    } catch (reason) { setError(errorMessage(reason)); }
  }

  function addProfile() {
    if (profiles.some((profile) => profile.isNew)) return;
    setProfiles((current) => [...current, { id: `new-${Date.now()}`, name: '新启动项', executablePath: '', workingDirectory: '', launchArguments: '', isDefault: false, isNew: true }]);
  }

  const headingTitle = displayTitle({ title: title || game.title, chineseTitle }, titleMode);

  return (
    <div className="modal-backdrop"><section className="modal game-settings-modal" role="dialog" aria-modal="true" aria-labelledby="game-settings-title">
      <header className="game-settings-visual">
        <div className={backgroundPreview ? 'settings-background' : 'settings-background empty'}>
          {backgroundPreview ? <img src={backgroundPreview} alt="横向背景预览" /> : <span className="artwork-placeholder">横向背景</span>}
          <button className="artwork-action" type="button" onClick={() => void chooseBackground()} aria-label="更换横向背景图"><Icon name="plus" /><span><strong>更换横向背景</strong><small>用于主页与游戏详情页</small></span></button>
        </div>
        <div className="game-settings-visual-shade" />
        <button className="settings-cover" type="button" onClick={chooseCover} aria-label="更换竖版封面">
          {coverPreview ? <img src={coverPreview} alt="竖版封面预览" /> : <span className="artwork-placeholder">竖版封面</span>}
          <span className="cover-action">更换封面</span>
        </button>
        <div className="game-settings-heading"><span>游戏设置</span><h2 id="game-settings-title">{headingTitle}</h2><p>{game.developer || '本地游戏'}</p></div>
        <button className="close-button settings-close" onClick={onClose} aria-label="关闭">×</button>
      </header>
      <nav className="game-settings-tabs" aria-label="游戏设置栏目"><button className={pane === 'overview' ? 'active' : ''} onClick={() => setPane('overview')}>资料与外观</button><button className={pane === 'launch' ? 'active' : ''} onClick={() => setPane('launch')}>启动项 <span>{profiles.length}</span></button><button className={pane === 'files' ? 'active' : ''} onClick={() => setPane('files')}>Mod 与存档</button></nav>
      <div className="game-settings-body">
        {pane === 'overview' ? <form id="game-general-form" className="game-general-settings" onSubmit={saveGeneral}>
          <section className="settings-surface"><header><span>完整标题</span><p>原名永久保留；中文名可以留空。</p></header><label className="settings-field">游戏原名<input value={title} onChange={(event) => { setTitle(event.target.value); setSaved(false); }} /></label><label className="settings-field secondary-title-field">中文名（可选）<input value={chineseTitle} onChange={(event) => { setChineseTitle(event.target.value); setSaved(false); }} placeholder="未填写时自动使用原名" /></label></section>
          <section className="settings-surface"><header><span>书库行为</span><p>分别控制计划列表与安全视图。</p></header><div className="settings-toggle-list">
            <label className="setting-toggle-row"><span><strong>加入欲玩清单</strong><small>在侧栏的欲玩清单中显示</small></span><input type="checkbox" checked={wishlist} onChange={(event) => { setWishlist(event.target.checked); setSaved(false); }} /><i /></label>
            <label className="setting-toggle-row"><span><strong>安全视图中隐藏</strong><small>开启安全视图时隐藏标题、图片和记录</small></span><input type="checkbox" checked={hideInSafeView} onChange={(event) => { setHideInSafeView(event.target.checked); setSaved(false); }} /><i /></label>
          </div></section>
          <section className="settings-surface tag-settings"><header><span>标签</span><p>用于整理、筛选和搜索；不会改变内容分级或安全视图。</p></header><div className="tag-editor"><div className="tag-input-row"><input value={tagInput} maxLength={40} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder="输入标签，例如 成人向" aria-label="新标签" /><button type="button" className="settings-action" disabled={!tagInput.trim() || tags.length >= 30} onClick={addTag}>添加</button></div>{tags.length > 0 ? <div className="tag-list">{tags.map((tag) => <button type="button" key={tag} onClick={() => removeTag(tag)} aria-label={`删除标签 ${tag}`}>{tag}<span aria-hidden="true">×</span></button>)}</div> : <p className="tag-empty">还没有标签</p>}</div></section>
          <section className="game-location"><Icon name="folder" /><div><strong>游戏所在文件夹</strong><p title={game.workingDirectory}>{game.workingDirectory}</p></div><button type="button" className="settings-action" onClick={() => void openGameDirectory()}>打开文件夹</button></section>
          <section className="settings-danger"><Icon name="trash" /><div><strong>移出游戏库</strong><p>只移除 GameShelf 中的资料，不会删除游戏本体或存档。</p></div><button type="button" className="danger-button" onClick={() => setConfirmingRemoval(true)}>移出游戏库</button></section>
        </form> : pane === 'launch' ? <section className="launch-settings"><header><div><h3>启动项</h3><p>为原版、汉化版或补丁版分别选择 exe；默认项用于“开始游玩”。</p></div><button className="settings-action" onClick={addProfile}><Icon name="plus" />添加启动项</button></header>
          <div className="launch-editors">{profiles.map((profile) => <div className="launch-editor" key={profile.id}>
            <div className="launch-editor-title"><input value={profile.name} onChange={(event) => patchProfile(profile.id, { name: event.target.value })} /><span>{profile.isDefault ? '默认' : ''}</span></div>
            <div className="path-field"><input readOnly value={profile.executablePath} placeholder="选择 .exe 文件" /><button type="button" onClick={() => void chooseExecutable(profile.id)}>选择</button></div>
            <input className="arguments-input" value={profile.launchArguments} onChange={(event) => patchProfile(profile.id, { launchArguments: event.target.value })} placeholder="启动参数（可留空）" />
            <div className="launch-editor-actions"><button type="button" className="secondary-button" onClick={() => void saveProfile(profile)}>保存</button>{!profile.isDefault && !profile.isNew && <button type="button" className="secondary-button" onClick={() => void saveProfile(profile, true)}>设为默认</button>}<button type="button" className="danger-button" onClick={() => void deleteProfile(profile)}>删除</button></div>
          </div>)}</div>
        </section> : <GameFilesPanel game={game} />}
        {error && <p className="form-error">{error}</p>}
      </div>
      <footer className="modal-footer settings-footer"><button className="secondary-button" onClick={onClose}>关闭</button>{pane === 'overview' && <button className={saved ? 'primary-button saved' : 'primary-button'} type="submit" form="game-general-form" disabled={saving}>{saving ? '正在保存…' : saved ? '已保存' : '保存更改'}</button>}</footer>
      {confirmingRemoval && <div className="confirm-layer"><section className="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="remove-game-title"><span className="confirm-icon"><Icon name="trash" /></span><h3 id="remove-game-title">将“{headingTitle}”移出游戏库？</h3><p>游玩记录、分类和启动项会从 GameShelf 中移除。游戏文件夹及其中的存档不会受到影响。</p><small title={game.workingDirectory}>{game.workingDirectory}</small><div><button className="secondary-button" onClick={() => setConfirmingRemoval(false)} disabled={removing}>取消</button><button className="danger-button solid" onClick={() => void removeFromLibrary()} disabled={removing}>{removing ? '正在移出…' : '确认移出'}</button></div></section></div>}
    </section></div>
  );
}

function SearchView({ query, results, titleMode, viewMode, safeView, onQueryChange, onClose, onOpen, onViewModeChange }: { query: string; results: Game[]; titleMode: TitleDisplayMode; viewMode: AppPreferences['libraryViewMode']; safeView: boolean; onQueryChange: (value: string) => void; onClose: () => void; onOpen: (game: Game) => void; onViewModeChange: (mode: AppPreferences['libraryViewMode']) => void }) {
  const active = Boolean(query.trim());
  return <div className="search-view">
    <header className="search-header"><button className="back-button" onClick={onClose}>‹ 返回</button><span className="eyebrow">游戏库</span><h1>搜索</h1><p>按标题、标签、会社、分类、状态、分级、合集或启动项查找。</p></header>
    <label className="search-page-input"><Icon name="search" /><input autoFocus value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索标题、标签或其他资料" aria-label="搜索全部游戏" />{active && <button type="button" onClick={() => onQueryChange('')}>清除</button>}</label>
    {!active ? <section className="search-empty"><h2>快捷筛选</h2><div className="search-suggestions">{['游玩中', '未开始', '已玩完', '欲玩清单', 'R18'].map((suggestion) => <button key={suggestion} onClick={() => onQueryChange(suggestion)}>{suggestion}</button>)}</div><p>也可以组合输入，例如“Fate R18”或“白色相簿系列”。按 Esc 返回刚才的位置。</p></section> : <><div className="search-summary"><span><strong>{results.length}</strong> 个结果</span>{safeView && <span className="safe-chip">安全视图已开启</span>}<span className="view-switch"><button className={viewMode === 'grid' ? 'active' : ''} onClick={() => onViewModeChange('grid')}>封面墙</button><button className={viewMode === 'list' ? 'active' : ''} onClick={() => onViewModeChange('list')}>信息列表</button></span></div><section className="search-results">{viewMode === 'grid' ? <div className="poster-grid">{results.map((game) => <Poster key={game.id} game={game} titleMode={titleMode} onOpen={() => onOpen(game)} />)}</div> : <LibraryList games={results} titleMode={titleMode} onOpen={onOpen} />}{results.length === 0 && <div className="no-results">没有匹配结果，试试更短的关键词或游戏状态</div>}</section></>}
  </div>;
}

function filterTitle(filter: LibraryFilter, collections: GameCollection[]): string {
  if (filter === 'all') return '全部游戏';
  if (filter === 'recent') return '最近游玩';
  if (filter === 'home') return '游戏首页';
  if (filter === 'settings') return '设置';
  if (filter.startsWith('category:')) return filter.slice(9);
  if (filter.startsWith('tag:')) return `标签：${filter.slice(4)}`;
  if (filter.startsWith('collection:')) return collections.find((collection) => collection.id === filter.slice(11))?.name ?? '我的合集';
  if (filter === 'wishlist') return '欲玩清单';
  return statusLabels[filter as GameStatus];
}

export function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [collections, setCollections] = useState<GameCollection[]>([]);
  const [profile, setProfile] = useState<UserProfile>({ name: '玩家', avatarPath: null });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LibraryFilter>('home');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const searchOrigin = useRef<{ filter: LibraryFilter; selectedId: string | null } | null>(null);
  const [preferences, setPreferences] = useState<AppPreferences>({ theme: 'dark', titleDisplayMode: 'original', libraryViewMode: 'grid', safeView: false, sidebarCollapsed: false, categoryOrder: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [bulkEditing, setBulkEditing] = useState<{ games: Game[]; initialIds?: string[] } | null>(null);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [editingCollection, setEditingCollection] = useState<GameCollection | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingCategoryFor, setEditingCategoryFor] = useState<string | null>(null);
  const [managingCollectionsFor, setManagingCollectionsFor] = useState<string | null>(null);
  const [editingSettingsFor, setEditingSettingsFor] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<SidebarSectionName, boolean>>({ library: false, categories: false, tags: false, collections: false });
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [categoryDropTarget, setCategoryDropTarget] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextGames, nextCollections, nextProfile, nextPreferences] = await Promise.all([
        window.gameshelf.listGames(),
        window.gameshelf.listCollections(),
        window.gameshelf.getProfile(),
        window.gameshelf.getPreferences()
      ]);
      setGames(nextGames);
      setCollections(nextCollections);
      setProfile(nextProfile);
      setPreferences(nextPreferences);
    } catch (reason) {
      setMessage(`${errorMessage(reason)}。可在“设置 → 数据安全与诊断”导出诊断信息。`);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  const safeLibrary = useMemo(() => applySafeView(games, collections, preferences.safeView), [collections, games, preferences.safeView]);
  const safeGames = safeLibrary.games;
  const visibleCollections = safeLibrary.collections;
  const activeCollection = filter.startsWith('collection:') ? visibleCollections.find((collection) => collection.id === filter.slice(11)) ?? null : null;

  const visibleGames = useMemo(() => {
    if (activeCollection) return activeCollection.gameIds.map((id) => safeGames.find((game) => game.id === id)).filter((game): game is Game => Boolean(game));
    return safeGames.filter((game) => {
      if (filter.startsWith('category:')) return game.category === filter.slice(9);
      if (filter.startsWith('tag:')) {
        const selectedTag = filter.slice(4).normalize('NFKC').toLocaleLowerCase();
        return game.tags.some((tag) => tag.normalize('NFKC').toLocaleLowerCase() === selectedTag);
      }
      if (filter === 'recent') return Boolean(game.lastPlayedAt);
      if (filter === 'wishlist') return game.wishlist;
      if (['unplayed', 'playing', 'completed', 'paused'].includes(filter)) return game.status === filter;
      return true;
    });
  }, [activeCollection, filter, safeGames]);
  const searchResults = useMemo(() => searchGames(safeGames, visibleCollections, search), [safeGames, search, visibleCollections]);

  const selected = safeGames.find((game) => game.id === selectedId) ?? null;
  const categoryGame = safeGames.find((game) => game.id === editingCategoryFor) ?? null;
  const membershipGame = safeGames.find((game) => game.id === managingCollectionsFor) ?? null;
  const settingsGame = safeGames.find((game) => game.id === editingSettingsFor) ?? null;
  const categories = useMemo(() => orderCategories([...new Set(safeGames.map((game) => game.category).filter(Boolean))], preferences.categoryOrder), [preferences.categoryOrder, safeGames]);
  const tags = useMemo(() => normalizeTags(safeGames.flatMap((game) => game.tags)).sort((a, b) => a.localeCompare(b, 'zh-CN')), [safeGames]);
  const categoryIcons = useMemo(() => new Map(categories.map((category) => {
    const types = [...new Set(safeGames.filter((game) => game.category === category).map((game) => game.type))];
    return [category, category === 'ADV' ? 'book' : types.length === 1 ? typeIcons[types[0]!] : 'book'] as const;
  })), [categories, safeGames]);

  async function launch(game: Game, profileId?: string) {
    try {
      await window.gameshelf.launchGame(game.id, profileId);
      setMessage(`已启动 ${displayTitle(game, preferences.titleDisplayMode)}`);
    } catch (reason) {
      setMessage(errorMessage(reason));
    }
  }

  function replaceGame(updated: Game) {
    setGames((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  async function toggleWishlist(game: Game) {
    try {
      const updated = await window.gameshelf.updateGameSettings(game.id, { title: game.title, chineseTitle: game.chineseTitle, wishlist: !game.wishlist, hideInSafeView: game.hideInSafeView, tags: game.tags });
      replaceGame(updated);
      const title = displayTitle(game, preferences.titleDisplayMode);
      setMessage(updated.wishlist ? `已将 ${title} 加入欲玩清单` : `已将 ${title} 移出欲玩清单`);
    } catch (reason) { setMessage(errorMessage(reason)); }
  }

  async function updateStatus(game: Game, status: GameStatus) {
    try {
      const updated = await window.gameshelf.updateGameStatus(game.id, status);
      setGames((current) => current.map((item) => item.id === updated.id ? updated : item));
      const title = displayTitle(game, preferences.titleDisplayMode);
      setMessage(status === 'completed' ? `已将 ${title} 标记为已玩完` : `已更新 ${title} 的状态`);
    } catch (reason) {
      setMessage(errorMessage(reason));
    }
  }

  async function updateCategory(game: Game, category: string) {
    try {
      const updated = await window.gameshelf.updateGameCategory(game.id, category);
      setGames((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingCategoryFor(null);
      setMessage(`已将 ${displayTitle(game, preferences.titleDisplayMode)} 分类为 ${updated.category}`);
    } catch (reason) {
      setMessage(errorMessage(reason));
    }
  }

  async function saveMembership(game: Game, ids: string[]) {
    try {
      await window.gameshelf.setGameCollections(game.id, ids);
      setCollections((current) => current.map((collection) => ({ ...collection, gameIds: ids.includes(collection.id) ? [...new Set([...collection.gameIds, game.id])] : collection.gameIds.filter((id) => id !== game.id) })));
      setManagingCollectionsFor(null);
      setMessage(`已更新 ${displayTitle(game, preferences.titleDisplayMode)} 的合集`);
    } catch (reason) {
      setMessage(errorMessage(reason));
    }
  }

  async function savePreferences(next: AppPreferences) {
    try {
      setPreferences(await window.gameshelf.savePreferences(next));
    } catch (reason) {
      setMessage(errorMessage(reason));
    }
  }

  async function changeSafeView(safeView: boolean) {
    setSelectedId(null);
    setEditingCategoryFor(null);
    setManagingCollectionsFor(null);
    setEditingSettingsFor(null);
    setBulkEditing(null);
    if (safeView) {
      setFilter('home');
      setSearch('');
      setSearching(false);
      searchOrigin.current = null;
      setMessage('');
    }
    await savePreferences({ ...preferences, safeView });
  }

  async function updateCollectionOrder(collection: GameCollection, gameIds: string[]) {
    try {
      const updated = await window.gameshelf.setCollectionOrder(collection.id, gameIds);
      setCollections((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`已更新 ${collection.name} 的作品顺序`);
    } catch (reason) { setMessage(errorMessage(reason)); }
  }

  async function openDataDirectory() {
    try { await window.gameshelf.openDataDirectory(); } catch (reason) { setMessage(errorMessage(reason)); }
  }

  async function createBackup() {
    try {
      const result = await window.gameshelf.createBackup();
      setMessage(`${result.message}：${result.path}`);
    } catch (reason) {
      setMessage(`${errorMessage(reason)}。请检查 data 文件夹剩余空间与写入权限。`);
    }
  }

  async function restoreBackup() {
    try {
      const result = await window.gameshelf.restoreBackup();
      if (!result) return;
      setSelectedId(null);
      await refresh();
      setMessage(`${result.message}：${result.path}`);
    } catch (reason) {
      setMessage(errorMessage(reason));
    }
  }

  async function exportDiagnostics() {
    try {
      const result = await window.gameshelf.exportDiagnostics();
      if (result) setMessage(`${result.message}：${result.path}`);
    } catch (reason) {
      setMessage(`${errorMessage(reason)}。请确认目标文件夹可写。`);
    }
  }

  function toggleSidebarSection(section: SidebarSectionName) {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function removeGameFromView(game: Game) {
    setGames((current) => current.filter((item) => item.id !== game.id));
    setCollections((current) => current.map((collection) => ({ ...collection, gameIds: collection.gameIds.filter((id) => id !== game.id) })));
    setSelectedId(null);
    setEditingSettingsFor(null);
    setMessage(`已将 ${displayTitle(game, preferences.titleDisplayMode)} 移出游戏库，游戏文件未删除`);
  }

  function openSearch() {
    if (!searching) searchOrigin.current = { filter, selectedId };
    setSelectedId(null);
    setSearching(true);
  }

  function closeSearch() {
    const origin = searchOrigin.current;
    setSearch('');
    setSearching(false);
    searchOrigin.current = null;
    if (origin) {
      setFilter(origin.filter);
      setSelectedId(origin.selectedId);
    }
  }

  function navigateTo(value: LibraryFilter) {
    setSearch('');
    setSearching(false);
    searchOrigin.current = null;
    setFilter(value);
    setSelectedId(null);
  }

  function saveCategoryOrder(source: string, target: string) {
    const allCategories = orderCategories([...new Set(games.map((game) => game.category).filter(Boolean))], preferences.categoryOrder);
    const categoryOrder = moveCategory(allCategories, source, target);
    if (categoryOrder !== allCategories) void savePreferences({ ...preferences, categoryOrder });
  }

  useEffect(() => {
    if (!searching) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const origin = searchOrigin.current;
      setSearch('');
      setSearching(false);
      searchOrigin.current = null;
      if (origin) {
        setFilter(origin.filter);
        setSelectedId(origin.selectedId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searching]);

  function navItem(value: LibraryFilter, icon: IconName, label: string) {
    return <button key={value} className={filter === value && !selected && !searching ? 'nav-item active' : 'nav-item'} title={label} onClick={() => navigateTo(value)}><Icon name={icon} />{label}</button>;
  }

  const showLibrary = filter !== 'home' && filter !== 'settings';

  return (
    <div className={preferences.sidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <aside className="sidebar">
        <div className="sidebar-top"><label className={searching ? 'sidebar-search active' : 'sidebar-search'}><Icon name="search" /><input value={search} onFocus={openSearch} onChange={(event) => { openSearch(); setSearch(event.target.value); }} placeholder="搜索游戏" />{searching && <button type="button" className="sidebar-search-close" aria-label="关闭搜索" onClick={(event) => { event.preventDefault(); closeSearch(); }}>×</button>}</label><button className="sidebar-collapse" title={preferences.sidebarCollapsed ? '展开侧栏' : '收起侧栏'} aria-label={preferences.sidebarCollapsed ? '展开侧栏' : '收起侧栏'} onClick={() => void savePreferences({ ...preferences, sidebarCollapsed: !preferences.sidebarCollapsed })}><Icon name="sidebar" /></button></div>
        <nav className="sidebar-nav">
          {navItem('home', 'home', '主页')}
          <section className="nav-section"><button className={collapsedSections.library ? 'nav-section-heading collapsed' : 'nav-section-heading'} onClick={() => toggleSidebarSection('library')} aria-expanded={!collapsedSections.library}><strong>游戏库</strong><Icon name="chevron" /></button><div className="nav-section-content" hidden={collapsedSections.library}>{navItem('all', 'library', '全部游戏')}{navItem('completed', 'check', '已玩完')}{navItem('wishlist', 'clock', '欲玩清单')}</div></section>
          {categories.length > 0 && <section className="nav-section"><button className={collapsedSections.categories ? 'nav-section-heading collapsed' : 'nav-section-heading'} onClick={() => toggleSidebarSection('categories')} aria-expanded={!collapsedSections.categories}><strong>分类</strong><Icon name="chevron" /></button><div className="nav-section-content" hidden={collapsedSections.categories}>{categories.map((category, index) => <div key={category} className={`category-nav-item${draggedCategory === category ? ' dragging' : ''}${categoryDropTarget === category ? ' drop-target' : ''}`} onDragOver={(event) => { event.preventDefault(); setCategoryDropTarget(category); }} onDrop={(event) => { event.preventDefault(); const source = event.dataTransfer.getData('text/plain') || draggedCategory; if (source) saveCategoryOrder(source, category); setDraggedCategory(null); setCategoryDropTarget(null); }}>{navItem(`category:${category}`, categoryIcons.get(category) ?? 'book', category)}<button className="category-drag-handle" draggable title="拖动排序" aria-label={`调整 ${category} 的顺序`} onClick={(event) => { event.stopPropagation(); event.currentTarget.focus(); }} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', category); setDraggedCategory(category); }} onDragEnd={() => { setDraggedCategory(null); setCategoryDropTarget(null); }} onKeyDown={(event) => { if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return; event.preventDefault(); const target = categories[index + (event.key === 'ArrowUp' ? -1 : 1)]; if (target) saveCategoryOrder(category, target); }}>⠿</button></div>)}</div></section>}
          {tags.length > 0 && <section className="nav-section"><button className={collapsedSections.tags ? 'nav-section-heading collapsed' : 'nav-section-heading'} onClick={() => toggleSidebarSection('tags')} aria-expanded={!collapsedSections.tags}><strong>标签</strong><Icon name="chevron" /></button><div className="nav-section-content" hidden={collapsedSections.tags}>{tags.map((tag) => navItem(`tag:${tag}`, 'tag', tag))}</div></section>}
          <section className="nav-section"><div className="nav-section-heading-row"><button className={collapsedSections.collections ? 'nav-section-heading collapsed' : 'nav-section-heading'} onClick={() => toggleSidebarSection('collections')} aria-expanded={!collapsedSections.collections}><strong>我的合集</strong><Icon name="chevron" /></button><button className="section-add" onClick={() => setCreatingCollection(true)} aria-label="新建合集"><Icon name="plus" /></button></div><div className="nav-section-content collection-nav" hidden={collapsedSections.collections}>{visibleCollections.map((collection) => <div key={collection.id} className="collection-nav-item">{navItem(`collection:${collection.id}`, 'list', collection.name)}<button className="collection-edit-button" title="编辑合集" aria-label={`编辑 ${collection.name}`} onClick={(event) => { event.stopPropagation(); preferences.safeView ? setMessage('关闭安全视图后才能编辑合集') : setEditingCollection(collection); }}><Icon name="more" /></button></div>)}{visibleCollections.length === 0 && <span className="sidebar-empty">还没有可显示的合集</span>}</div></section>
        </nav>
        <div className="sidebar-bottom">
          {navItem('settings', 'settings', '设置')}
          <button className={preferences.safeView ? 'safe-toggle active' : 'safe-toggle'} onClick={() => void changeSafeView(!preferences.safeView)}><Icon name="shield" />安全视图<i className={preferences.safeView ? 'switch on' : 'switch'} /></button>
          <button className="profile-button" onClick={() => setEditingProfile(true)}>{profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : <span>{profile.name.slice(0, 1) || '玩'}</span>}<strong>{profile.name}</strong><Icon name="more" /></button>
        </div>
      </aside>

      <main className="main-pane">
        {selected ? <GameDetail game={selected} titleMode={preferences.titleDisplayMode} collections={visibleCollections} onBack={() => setSelectedId(null)} onLaunch={(profileId) => void launch(selected, profileId)} onStatusChange={(status) => void updateStatus(selected, status)} onToggleWishlist={() => void toggleWishlist(selected)} onEditCategory={() => setEditingCategoryFor(selected.id)} onManageCollections={() => preferences.safeView ? setMessage('关闭安全视图后才能修改合集归属') : setManagingCollectionsFor(selected.id)} onEditSettings={() => setEditingSettingsFor(selected.id)} /> : searching ? <SearchView query={search} results={searchResults} titleMode={preferences.titleDisplayMode} viewMode={preferences.libraryViewMode} safeView={preferences.safeView} onQueryChange={setSearch} onClose={closeSearch} onOpen={(game) => setSelectedId(game.id)} onViewModeChange={(libraryViewMode) => void savePreferences({ ...preferences, libraryViewMode })} /> : filter === 'settings' ? <SettingsView preferences={preferences} profile={profile} gameCount={safeGames.length} collectionCount={visibleCollections.length} onThemeChange={(theme) => void savePreferences({ ...preferences, theme })} onTitleDisplayModeChange={(titleDisplayMode) => void savePreferences({ ...preferences, titleDisplayMode })} onSafeViewChange={(safeView) => void changeSafeView(safeView)} onEditProfile={() => setEditingProfile(true)} onOpenDataDirectory={() => void openDataDirectory()} onCreateBackup={() => void createBackup()} onRestoreBackup={() => void restoreBackup()} onExportDiagnostics={() => void exportDiagnostics()} /> : loading && games.length === 0 ? <div className="loading-state">正在读取游戏库…</div> : games.length === 0 ? <EmptyLibrary onAdd={() => setScanning(true)} /> : showLibrary ? (
          <div className="library-view"><header className="library-toolbar"><div><span className="eyebrow">游戏库</span><h1>{filterTitle(filter, visibleCollections)}</h1></div><div><span>{visibleGames.length} 个游戏</span>{preferences.safeView && <span className="safe-chip">安全视图已开启</span>}<span className="view-switch"><button className={preferences.libraryViewMode === 'grid' ? 'active' : ''} onClick={() => void savePreferences({ ...preferences, libraryViewMode: 'grid' })}>封面墙</button><button className={preferences.libraryViewMode === 'list' ? 'active' : ''} onClick={() => void savePreferences({ ...preferences, libraryViewMode: 'list' })}>信息列表</button></span><button className="secondary-button" onClick={() => setBulkEditing({ games: visibleGames })}>批量整理</button><button className="secondary-button" onClick={() => setAdding(true)}>单个添加</button><button className="add-button" onClick={() => setScanning(true)}><Icon name="search" />扫描导入</button></div></header><section className={filter === 'completed' ? 'timeline-content' : 'library-content'}>{filter === 'completed' ? <CompletedTimeline games={visibleGames} titleMode={preferences.titleDisplayMode} onOpen={(game) => setSelectedId(game.id)} onStatusChange={(game, status) => void updateStatus(game, status)} /> : activeCollection && preferences.libraryViewMode === 'list' ? <CollectionSeriesView collection={activeCollection} games={safeGames} titleMode={preferences.titleDisplayMode} onOpen={(game) => setSelectedId(game.id)} onOrderChange={(ids) => void updateCollectionOrder(activeCollection, ids)} /> : <>{preferences.libraryViewMode === 'grid' ? <div className="poster-grid">{visibleGames.map((game) => <Poster key={game.id} game={game} titleMode={preferences.titleDisplayMode} onOpen={() => setSelectedId(game.id)} />)}</div> : <LibraryList games={visibleGames} titleMode={preferences.titleDisplayMode} onOpen={(game) => setSelectedId(game.id)} />}{visibleGames.length === 0 && <div className="no-results">没有符合当前条件的游戏</div>}</>}</section></div>
        ) : <HomeView games={visibleGames} titleMode={preferences.titleDisplayMode} onOpen={(game) => setSelectedId(game.id)} onLaunch={(game) => void launch(game)} onAdd={() => setScanning(true)} onShowAll={() => setFilter('all')} />}
      </main>

      {adding && <AddGameDialog categorySuggestions={categories} onClose={() => setAdding(false)} onAdded={(game) => { setAdding(false); setGames((current) => [game, ...current]); setSelectedId(game.id); }} />}
      {scanning && <ScanImportDialog onClose={() => setScanning(false)} onImported={(imported) => { const organizable = preferences.safeView ? imported.filter((game) => !game.hideInSafeView) : imported; setScanning(false); setGames((current) => [...imported, ...current]); setFilter('all'); setBulkEditing(organizable.length ? { games: organizable, initialIds: organizable.map((game) => game.id) } : null); if (!organizable.length) setMessage(`已导入 ${imported.length} 个游戏；安全视图已隐藏全部新条目`); }} />}
      {bulkEditing && <BulkEditDialog games={bulkEditing.games} initialIds={bulkEditing.initialIds} collections={visibleCollections} onClose={() => setBulkEditing(null)} onChanged={replaceGame} onSaved={(updated) => { setGames((current) => current.map((game) => updated.find((item) => item.id === game.id) ?? game)); setBulkEditing(null); void refresh(); setMessage(`已整理 ${updated.length} 个游戏`); }} />}
      {creatingCollection && <CollectionDialog onClose={() => setCreatingCollection(false)} onSaved={(collection) => { setCreatingCollection(false); setCollections((current) => [...current, collection].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))); setFilter(`collection:${collection.id}`); }} />}
      {editingCollection && <CollectionDialog collection={editingCollection} onClose={() => setEditingCollection(null)} onSaved={(collection) => { setEditingCollection(null); setCollections((current) => current.map((item) => item.id === collection.id ? collection : item).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))); setMessage(`已重命名为 ${collection.name}`); }} onDeleted={(collectionId) => { setEditingCollection(null); setCollections((current) => current.filter((item) => item.id !== collectionId)); if (filter === `collection:${collectionId}`) setFilter('all'); setMessage('已删除合集，游戏仍保留在游戏库中'); }} />}
      {editingProfile && <ProfileDialog profile={profile} onClose={() => setEditingProfile(false)} onSaved={(nextProfile) => { setProfile(nextProfile); setEditingProfile(false); }} />}
      {categoryGame && <CategoryDialog game={categoryGame} titleMode={preferences.titleDisplayMode} suggestions={categories} onClose={() => setEditingCategoryFor(null)} onSaved={(category) => void updateCategory(categoryGame, category)} />}
      {membershipGame && <CollectionMembershipDialog game={membershipGame} titleMode={preferences.titleDisplayMode} collections={visibleCollections} onClose={() => setManagingCollectionsFor(null)} onSaved={(ids) => void saveMembership(membershipGame, ids)} />}
      {settingsGame && <GameSettingsDialog game={settingsGame} titleMode={preferences.titleDisplayMode} onClose={() => setEditingSettingsFor(null)} onChanged={replaceGame} onRemoved={removeGameFromView} />}
      {message && <div className="toast" role="status" aria-live="polite">{message}</div>}
    </div>
  );
}
