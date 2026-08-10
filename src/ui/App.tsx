import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AppPreferences, ContentRating, Game, GameCollection, GameSetupAnalysis, GameStatus, GameType, NewGameInput, ThemeMode, UserProfile } from '../shared';

type LibraryFilter = 'home' | 'settings' | 'all' | 'recent' | GameStatus | `category:${string}` | `collection:${string}`;
type IconName = 'home' | 'settings' | 'library' | 'clock' | 'play' | 'check' | 'search' | 'shield' | 'plus' | 'book' | 'more' | 'folder' | 'list';

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
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'
};

const typeLabels: Record<GameType, string> = {
  visual_novel: '视觉小说',
  rpg: 'RPG',
  simulation: '模拟经营',
  action: '动作',
  other: '其他'
};

const defaultCategories: Record<GameType, string> = {
  visual_novel: 'Galgame',
  rpg: 'RPG',
  simulation: '模拟经营',
  action: '动作游戏',
  other: '其他游戏'
};

const ratingLabels: Record<ContentRating, string> = {
  general: '全年龄',
  mature: '成人向',
  r18: 'R18'
};

const statusLabels: Record<GameStatus, string> = {
  unplayed: '未开始',
  playing: '游玩中',
  completed: '已完成',
  paused: '已搁置'
};

function Icon({ name, fill = false }: { name: IconName; fill?: boolean }) {
  return (
    <svg className="app-icon" viewBox="0 0 24 24" aria-hidden="true">
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

function Poster({ game, onOpen }: { game: Game; onOpen: () => void }) {
  return (
    <button className="poster" onClick={onOpen} aria-label={`打开 ${game.title}`}>
      <div className="poster-art">
        {game.coverDataUrl ? <img src={game.coverDataUrl} alt="" /> : <div className="poster-placeholder"><span>{game.title.slice(0, 1).toUpperCase()}</span></div>}
        <div className="poster-overlay"><span className="poster-play"><Icon name="play" fill /></span></div>
        {game.contentRating === 'r18' && <span className="rating-badge">R18</span>}
      </div>
      <span className="poster-title">{game.title}</span>
      <span className="poster-meta">{statusLabels[game.status]} · {playTime(game.totalPlaySeconds)}</span>
    </button>
  );
}

function ContinueCard({ game, onOpen, onLaunch }: { game: Game; onOpen: () => void; onLaunch: () => void }) {
  return (
    <article className={`continue-card ${game.coverDataUrl ? '' : 'without-art'}`}>
      {game.coverDataUrl ? <img src={game.coverDataUrl} alt="" /> : <span className="continue-initial">{game.title.slice(0, 1)}</span>}
      <div className="continue-shade" />
      <button className="continue-open" onClick={onOpen} aria-label={`查看 ${game.title}`} />
      <div className="continue-copy"><strong>{game.title}</strong><small>{displayDate(game.lastPlayedAt)} · {playTime(game.totalPlaySeconds)}</small></div>
      <button className="continue-play" onClick={onLaunch} aria-label={`启动 ${game.title}`}><Icon name="play" fill /></button>
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

function HomeView({ games, onOpen, onLaunch, onAdd, onShowAll }: {
  games: Game[];
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
  const topGames = [...games].filter((game) => game.totalPlaySeconds > 0).sort((a, b) => b.totalPlaySeconds - a.totalPlaySeconds).slice(0, 3);
  const longestPlay = topGames[0]?.totalPlaySeconds ?? 1;

  return (
    <div className="home-scroll">
      <section className="home-hero">
        <div className={`home-hero-art ${featured.coverDataUrl ? '' : 'without-art'}`}>
          {featured.coverDataUrl ? <img src={featured.coverDataUrl} alt="" /> : <span>{featured.title.slice(0, 1)}</span>}
        </div>
        <div className="home-hero-shade" />
        <div className="home-hero-copy">
          <span className="hero-status">{statusLabels[featured.status]}</span>
          <h1>{featured.title}</h1>
          {featured.developer && <p className="hero-developer">{featured.developer}</p>}
          <p className="hero-description">{featured.description || `${typeLabels[featured.type]} · ${ratingLabels[featured.contentRating]}`}</p>
          <div className="hero-tags"><span>{featured.category}</span><span>{ratingLabels[featured.contentRating]}</span></div>
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
        {recent.length > 0 && <section className="home-section"><header><h2>继续游玩</h2><button onClick={() => onShowAll()}>查看全部</button></header><div className="continue-grid">{recent.map((game) => <ContinueCard key={game.id} game={game} onOpen={() => onOpen(game)} onLaunch={() => onLaunch(game)} />)}</div></section>}
        <section className="home-section">
          <header><div><h2>游戏库</h2><span>{games.length} 个本地游戏</span></div><div className="shelf-actions"><button onClick={onAdd}><Icon name="plus" />添加游戏</button><button onClick={onShowAll}>全部游戏</button></div></header>
          <div className="poster-grid home-grid">{shelf.map((game) => <Poster key={game.id} game={game} onOpen={() => onOpen(game)} />)}</div>
        </section>
        <section className="stats-window">
          <header><div><span className="stats-mark">⌁</span><div><h2>游戏统计</h2><p>根据这台电脑上的游玩记录生成</p></div></div></header>
          <div className="stats-summary"><div><small>游戏总数</small><strong>{games.length}</strong></div><div><small>累计时长</small><strong>{playTime(totalPlaySeconds)}</strong></div><div><small>启动次数</small><strong>{totalLaunches}</strong></div><div><small>已玩完</small><strong>{completedCount}</strong></div></div>
          <div className="stats-body">
            <div className="library-breakdown"><h3>书库状态</h3><div className="breakdown-bar"><i style={{ width: `${completedCount / games.length * 100}%` }} /><i style={{ width: `${playingCount / games.length * 100}%` }} /><i style={{ width: `${unplayedCount / games.length * 100}%` }} /></div><div className="breakdown-legend"><span><i />已玩完 {completedCount}</span><span><i />游玩中 {playingCount}</span><span><i />欲玩 {unplayedCount}</span></div></div>
            <div className="top-played"><h3>游玩时间最多</h3>{topGames.length === 0 ? <p>开始游玩后，这里会出现统计。</p> : topGames.map((game) => <button key={game.id} onClick={() => onOpen(game)}><span>{game.title}</span><i><b style={{ width: `${game.totalPlaySeconds / longestPlay * 100}%` }} /></i><small>{playTime(game.totalPlaySeconds)}</small></button>)}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

function CompletedTimeline({ games, onOpen, onStatusChange }: { games: Game[]; onOpen: (game: Game) => void; onStatusChange: (game: Game, status: GameStatus) => void }) {
  const sorted = [...games].sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt));
  if (sorted.length === 0) return <div className="no-results">还没有已玩完的游戏</div>;
  return (
    <div className="timeline">
      {sorted.map((game) => <article className="timeline-entry" key={game.id}>
        <time>{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(game.completedAt ?? game.updatedAt))}</time>
        <span className="timeline-dot" />
        <button className="timeline-cover" onClick={() => onOpen(game)}>{game.coverDataUrl ? <img src={game.coverDataUrl} alt={`${game.title} 封面`} /> : <span>{game.title.slice(0, 1)}</span>}</button>
        <div className="timeline-copy"><strong>{game.title}</strong><small>{game.developer || typeLabels[game.type]}</small><p>{playTime(game.totalPlaySeconds)} · 启动 {game.launchCount} 次</p><button onClick={() => onStatusChange(game, 'playing')}>改为游玩中</button></div>
      </article>)}
    </div>
  );
}

function SettingsView({ preferences, profile, gameCount, collectionCount, onThemeChange, onSafeViewChange, onEditProfile, onOpenDataDirectory }: {
  preferences: AppPreferences;
  profile: UserProfile;
  gameCount: number;
  collectionCount: number;
  onThemeChange: (theme: ThemeMode) => void;
  onSafeViewChange: (enabled: boolean) => void;
  onEditProfile: () => void;
  onOpenDataDirectory: () => void;
}) {
  return (
    <div className="settings-view">
      <header><h1>设置</h1><p>外观、隐私与本机资料</p></header>
      <div className="settings-sections">
        <section className="settings-card"><div className="settings-card-copy"><h2>外观</h2><p>选择适合桌面环境的界面配色。</p></div><div className="theme-options"><button className={preferences.theme === 'dark' ? 'selected' : ''} onClick={() => onThemeChange('dark')}><span className="theme-preview dark"><i /><i /><i /></span><strong>深色</strong></button><button className={preferences.theme === 'light' ? 'selected' : ''} onClick={() => onThemeChange('light')}><span className="theme-preview light"><i /><i /><i /></span><strong>浅色</strong></button></div></section>
        <section className="settings-card settings-row"><div className="settings-card-copy"><h2>安全视图</h2><p>开启后隐藏所有标记为 R18 的游戏。</p></div><button className={preferences.safeView ? 'settings-switch on' : 'settings-switch'} onClick={() => onSafeViewChange(!preferences.safeView)}><i /></button></section>
        <section className="settings-card settings-row"><div className="settings-profile">{profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : <span>{profile.name.slice(0, 1) || '玩'}</span>}<div><h2>{profile.name}</h2><p>头像与昵称</p></div></div><button className="settings-action" onClick={onEditProfile}>编辑资料</button></section>
        <section className="settings-card settings-row"><div className="settings-card-copy"><h2>本机资料</h2><p>{gameCount} 个游戏 · {collectionCount} 个合集。数据库、封面和记录保存在 Windows 应用数据目录。</p></div><button className="settings-action" onClick={onOpenDataDirectory}>打开文件夹</button></section>
      </div>
    </div>
  );
}

function GameDetail({ game, collections, onBack, onLaunch, onStatusChange, onEditCategory, onManageCollections }: {
  game: Game;
  collections: GameCollection[];
  onBack: () => void;
  onLaunch: () => void;
  onStatusChange: (status: GameStatus) => void;
  onEditCategory: () => void;
  onManageCollections: () => void;
}) {
  const metadata = [
    game.releaseDate && ['发布日期', game.releaseDate],
    game.languages.length > 0 && ['语言', game.languages.join('、')],
    game.score != null && ['评分', String(game.score)]
  ].filter(Boolean) as string[][];

  return (
    <article className="detail-view">
      <div className="detail-backdrop">{game.coverDataUrl ? <img src={game.coverDataUrl} alt="" /> : <span>{game.title.slice(0, 1)}</span>}</div>
      <div className="detail-shade" />
      <button className="back-button" onClick={onBack}>‹ 返回游戏库</button>
      <div className="detail-content">
        <div className="detail-cover">{game.coverDataUrl ? <img src={game.coverDataUrl} alt={`${game.title} 封面`} /> : <div>{game.title.slice(0, 1)}</div>}</div>
        <div className="detail-copy">
          <div className="detail-kicker"><button className="category-chip" onClick={onEditCategory}>{game.category}</button><span>{typeLabels[game.type]}</span><span>{ratingLabels[game.contentRating]}</span><span>{statusLabels[game.status]}</span></div>
          <h1>{game.title}</h1>
          <p className="detail-developer">{game.developer || '未填写会社或开发者'}</p>
          <p className="detail-description">{game.description || '还没有简介。之后可以补充本地资料或接入元数据源。'}</p>
          <div className="detail-actions"><button className="play-button" onClick={onLaunch}><Icon name="play" fill />{game.lastPlayedAt ? '继续游玩' : '开始游玩'}</button><select className="status-select" value={game.status} onChange={(event) => onStatusChange(event.target.value as GameStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="collection-button" onClick={onManageCollections}><Icon name="folder" />管理合集</button></div>
          <div className="launch-profile"><span><Icon name="book" /></span><div><small>默认启动</small><strong>{executableName(game)}</strong></div></div>
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
  const [type, setType] = useState<GameType>('other');
  const [category, setCategory] = useState('');
  const [contentRating, setContentRating] = useState<ContentRating>('general');
  const [status, setStatus] = useState<GameStatus>('unplayed');
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
      setError(reason instanceof Error ? reason.message : String(reason));
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
      const input: NewGameInput = { title, type, category, contentRating, executablePath, coverSourcePath, status };
      onAdded(await window.gameshelf.addGame(input));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
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
              <label>游戏名称<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="输入标题" /></label>
              <label>启动文件<div className="path-field"><input readOnly value={executablePath} placeholder="选择 .exe 文件" /><button type="button" onClick={chooseExecutable}>选择</button></div></label>
              {(analyzing || analysis) && <div className="detection-summary">{analyzing ? <span>正在识别游戏结构…</span> : <><strong>{analysis?.engine ?? '未识别引擎'}</strong><span>{analysis?.alternativeExecutables.length ?? 0} 个其他启动项</span><span>{analysis?.modDirectories.length ?? 0} 个 Mod 位置</span><span>{analysis?.saveDirectories.length ?? 0} 个存档位置</span><span>{analysis?.patchDirectories.length ?? 0} 个补丁位置</span></>}</div>}
              <div className="form-row"><label>游戏类型<select value={type} onChange={(event) => setType(event.target.value as GameType)}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>内容分级<select value={contentRating} onChange={(event) => setContentRating(event.target.value as ContentRating)}>{Object.entries(ratingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
              <label>分类<input value={category} list="game-category-suggestions" onChange={(event) => setCategory(event.target.value)} placeholder={`自动：${defaultCategories[type]}`} /><datalist id="game-category-suggestions">{categorySuggestions.map((item) => <option key={item} value={item} />)}</datalist></label>
              <label>游玩状态<select value={status} onChange={(event) => setStatus(event.target.value as GameStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <footer className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" disabled={saving}>{saving ? '正在添加…' : '添加游戏'}</button></footer>
        </form>
      </section>
    </div>
  );
}

function CreateCollectionDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (collection: GameCollection) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try { onCreated(await window.gameshelf.createCollection(name)); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }
  return (
    <div className="modal-backdrop"><section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="collection-title"><header className="modal-header"><div><span className="eyebrow">我的合集</span><h2 id="collection-title">新建游戏合集</h2></div><button className="close-button" onClick={onClose}>×</button></header><form onSubmit={submit}><div className="form-fields"><label>合集名称<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：苍之彼方系列" /></label></div>{error && <p className="form-error">{error}</p>}<footer className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button">创建合集</button></footer></form></section></div>
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
    try { onSaved(await window.gameshelf.saveProfile({ name, avatarSourcePath })); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }
  return (
    <div className="modal-backdrop"><section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><header className="modal-header"><div><span className="eyebrow">个人资料</span><h2 id="profile-title">编辑头像与昵称</h2></div><button className="close-button" onClick={onClose}>×</button></header><form onSubmit={submit}><div className="profile-editor"><button className="avatar-picker" type="button" onClick={chooseAvatar}>{preview ? <img src={preview} alt="头像预览" /> : <span>{name.slice(0, 1) || '玩'}</span>}<small>选择头像</small></button><div className="form-fields"><label>昵称<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="你的昵称" /></label></div></div>{error && <p className="form-error">{error}</p>}<footer className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button">保存</button></footer></form></section></div>
  );
}

function CollectionMembershipDialog({ game, collections, onClose, onSaved }: { game: Game; collections: GameCollection[]; onClose: () => void; onSaved: (ids: string[]) => void }) {
  const [selected, setSelected] = useState(() => new Set(collections.filter((collection) => collection.gameIds.includes(game.id)).map((collection) => collection.id)));
  return (
    <div className="modal-backdrop"><section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="membership-title"><header className="modal-header"><div><span className="eyebrow">{game.title}</span><h2 id="membership-title">管理所属合集</h2></div><button className="close-button" onClick={onClose}>×</button></header><div className="membership-list">{collections.length === 0 ? <p>请先在侧栏新建一个合集。</p> : collections.map((collection) => <label key={collection.id}><input type="checkbox" checked={selected.has(collection.id)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(collection.id) ? next.delete(collection.id) : next.add(collection.id); return next; })} /><span><strong>{collection.name}</strong><small>{collection.gameIds.length} 个游戏</small></span></label>)}</div><footer className="modal-footer membership-footer"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={() => onSaved([...selected])}>保存</button></footer></section></div>
  );
}

function CategoryDialog({ game, suggestions, onClose, onSaved }: { game: Game; suggestions: string[]; onClose: () => void; onSaved: (category: string) => void }) {
  const [category, setCategory] = useState(game.category);
  return (
    <div className="modal-backdrop"><section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="category-title"><header className="modal-header"><div><span className="eyebrow">{game.title}</span><h2 id="category-title">修改游戏分类</h2></div><button className="close-button" onClick={onClose}>×</button></header><div className="category-editor"><div className="form-fields"><label>分类<input autoFocus value={category} list="category-edit-suggestions" onChange={(event) => setCategory(event.target.value)} /><datalist id="category-edit-suggestions">{suggestions.map((item) => <option key={item} value={item} />)}</datalist></label></div><p>可以选择现有分类，也可以直接输入新的分类名称。</p></div><footer className="modal-footer membership-footer"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={() => onSaved(category)}>保存</button></footer></section></div>
  );
}

function filterTitle(filter: LibraryFilter, collections: GameCollection[]): string {
  if (filter === 'all') return '全部游戏';
  if (filter === 'recent') return '最近游玩';
  if (filter === 'home') return '游戏首页';
  if (filter === 'settings') return '设置';
  if (filter.startsWith('category:')) return filter.slice(9);
  if (filter.startsWith('collection:')) return collections.find((collection) => collection.id === filter.slice(11))?.name ?? '我的合集';
  if (filter === 'unplayed') return '欲玩清单';
  return statusLabels[filter as GameStatus];
}

export function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [collections, setCollections] = useState<GameCollection[]>([]);
  const [profile, setProfile] = useState<UserProfile>({ name: '玩家', avatarPath: null });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LibraryFilter>('home');
  const [search, setSearch] = useState('');
  const [preferences, setPreferences] = useState<AppPreferences>({ theme: 'dark', safeView: false, sidebarCollapsed: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingCategoryFor, setEditingCategoryFor] = useState<string | null>(null);
  const [managingCollectionsFor, setManagingCollectionsFor] = useState<string | null>(null);
  const [message, setMessage] = useState('');

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

  const visibleGames = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return games.filter((game) => {
      if (preferences.safeView && game.contentRating === 'r18') return false;
      if (query) return `${game.title} ${game.developer} ${game.category}`.toLocaleLowerCase().includes(query);
      if (filter.startsWith('collection:')) return collections.find((collection) => collection.id === filter.slice(11))?.gameIds.includes(game.id) ?? false;
      if (filter.startsWith('category:')) return game.category === filter.slice(9);
      if (filter === 'recent') return Boolean(game.lastPlayedAt);
      if (['unplayed', 'playing', 'completed', 'paused'].includes(filter)) return game.status === filter;
      return true;
    });
  }, [collections, filter, games, preferences.safeView, search]);

  const selected = games.find((game) => game.id === selectedId) ?? null;
  const categoryGame = games.find((game) => game.id === editingCategoryFor) ?? null;
  const membershipGame = games.find((game) => game.id === managingCollectionsFor) ?? null;
  const categories = useMemo(() => [...new Set(games.map((game) => game.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [games]);

  async function launch(game: Game) {
    try {
      await window.gameshelf.launchGame(game.id);
      setMessage(`已启动 ${game.title}`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function updateStatus(game: Game, status: GameStatus) {
    try {
      const updated = await window.gameshelf.updateGameStatus(game.id, status);
      setGames((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(status === 'completed' ? `已将 ${game.title} 标记为已玩完` : `已更新 ${game.title} 的状态`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function updateCategory(game: Game, category: string) {
    try {
      const updated = await window.gameshelf.updateGameCategory(game.id, category);
      setGames((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingCategoryFor(null);
      setMessage(`已将 ${game.title} 分类为 ${updated.category}`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function saveMembership(game: Game, ids: string[]) {
    try {
      await window.gameshelf.setGameCollections(game.id, ids);
      setCollections((current) => current.map((collection) => ({ ...collection, gameIds: ids.includes(collection.id) ? [...new Set([...collection.gameIds, game.id])] : collection.gameIds.filter((id) => id !== game.id) })));
      setManagingCollectionsFor(null);
      setMessage(`已更新 ${game.title} 的合集`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function savePreferences(next: AppPreferences) {
    try {
      setPreferences(await window.gameshelf.savePreferences(next));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function openDataDirectory() {
    try { await window.gameshelf.openDataDirectory(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); }
  }

  function navItem(value: LibraryFilter, icon: IconName, label: string) {
    return <button className={filter === value && !selected ? 'nav-item active' : 'nav-item'} title={label} onClick={() => { setFilter(value); setSelectedId(null); }}><Icon name={icon} />{label}</button>;
  }

  const showLibrary = search.trim() !== '' || (filter !== 'home' && filter !== 'settings');

  return (
    <div className={preferences.sidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <aside className="sidebar">
        <div className="sidebar-top"><label className="sidebar-search"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索游戏" /></label><button className="sidebar-collapse" title={preferences.sidebarCollapsed ? '展开侧栏' : '收起侧栏'} aria-label={preferences.sidebarCollapsed ? '展开侧栏' : '收起侧栏'} onClick={() => void savePreferences({ ...preferences, sidebarCollapsed: !preferences.sidebarCollapsed })}><Icon name="list" /></button></div>
        <nav className="sidebar-nav">
          {navItem('home', 'home', '主页')}
          <p className="nav-heading">游戏库</p>
          {navItem('all', 'library', '全部游戏')}
          {navItem('completed', 'check', '已玩完')}
          {navItem('unplayed', 'clock', '欲玩清单')}
          {categories.length > 0 && <><p className="nav-heading">分类</p>{categories.map((category) => navItem(`category:${category}`, 'book', category))}</>}
          <div className="collection-heading"><p className="nav-heading">我的合集</p><button onClick={() => setCreatingCollection(true)} aria-label="新建合集"><Icon name="plus" /></button></div>
          <div className="collection-nav">{collections.map((collection) => navItem(`collection:${collection.id}`, 'list', collection.name))}{collections.length === 0 && <span className="sidebar-empty">还没有自定义合集</span>}</div>
        </nav>
        <div className="sidebar-bottom">
          {navItem('settings', 'settings', '设置')}
          <button className={preferences.safeView ? 'safe-toggle active' : 'safe-toggle'} onClick={() => { void savePreferences({ ...preferences, safeView: !preferences.safeView }); setSelectedId(null); }}><Icon name="shield" />安全视图<i className={preferences.safeView ? 'switch on' : 'switch'} /></button>
          <button className="profile-button" onClick={() => setEditingProfile(true)}>{profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : <span>{profile.name.slice(0, 1) || '玩'}</span>}<strong>{profile.name}</strong><Icon name="more" /></button>
        </div>
      </aside>

      <main className="main-pane">
        {selected ? <GameDetail game={selected} collections={collections} onBack={() => setSelectedId(null)} onLaunch={() => void launch(selected)} onStatusChange={(status) => void updateStatus(selected, status)} onEditCategory={() => setEditingCategoryFor(selected.id)} onManageCollections={() => setManagingCollectionsFor(selected.id)} /> : filter === 'settings' && !search.trim() ? <SettingsView preferences={preferences} profile={profile} gameCount={games.length} collectionCount={collections.length} onThemeChange={(theme) => void savePreferences({ ...preferences, theme })} onSafeViewChange={(safeView) => void savePreferences({ ...preferences, safeView })} onEditProfile={() => setEditingProfile(true)} onOpenDataDirectory={() => void openDataDirectory()} /> : loading && games.length === 0 ? <div className="loading-state">正在读取游戏库…</div> : games.length === 0 ? <EmptyLibrary onAdd={() => setAdding(true)} /> : showLibrary ? (
          <div className="library-view"><header className="library-toolbar"><div><span className="eyebrow">游戏库</span><h1>{search.trim() ? '本机搜索结果' : filterTitle(filter, collections)}</h1></div><div><span>{visibleGames.length} 个游戏</span>{preferences.safeView && <span className="safe-chip">安全视图已开启</span>}<button className="add-button" onClick={() => setAdding(true)}><Icon name="plus" />添加游戏</button></div></header><section className={filter === 'completed' && !search.trim() ? 'timeline-content' : 'library-content'}>{filter === 'completed' && !search.trim() ? <CompletedTimeline games={visibleGames} onOpen={(game) => setSelectedId(game.id)} onStatusChange={(game, status) => void updateStatus(game, status)} /> : <><div className="poster-grid">{visibleGames.map((game) => <Poster key={game.id} game={game} onOpen={() => setSelectedId(game.id)} />)}</div>{visibleGames.length === 0 && <div className="no-results">没有符合当前条件的游戏</div>}</>}</section></div>
        ) : <HomeView games={visibleGames} onOpen={(game) => setSelectedId(game.id)} onLaunch={(game) => void launch(game)} onAdd={() => setAdding(true)} onShowAll={() => setFilter('all')} />}
      </main>

      {adding && <AddGameDialog categorySuggestions={categories} onClose={() => setAdding(false)} onAdded={(game) => { setAdding(false); setGames((current) => [game, ...current]); setSelectedId(game.id); }} />}
      {creatingCollection && <CreateCollectionDialog onClose={() => setCreatingCollection(false)} onCreated={(collection) => { setCreatingCollection(false); setCollections((current) => [...current, collection].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))); setFilter(`collection:${collection.id}`); }} />}
      {editingProfile && <ProfileDialog profile={profile} onClose={() => setEditingProfile(false)} onSaved={(nextProfile) => { setProfile(nextProfile); setEditingProfile(false); }} />}
      {categoryGame && <CategoryDialog game={categoryGame} suggestions={categories} onClose={() => setEditingCategoryFor(null)} onSaved={(category) => void updateCategory(categoryGame, category)} />}
      {membershipGame && <CollectionMembershipDialog game={membershipGame} collections={collections} onClose={() => setManagingCollectionsFor(null)} onSaved={(ids) => void saveMembership(membershipGame, ids)} />}
      {message && <div className="toast">{message}</div>}
    </div>
  );
}
