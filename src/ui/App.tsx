import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ContentRating, Game, GameCollection, GameStatus, GameType, NewGameInput, UserProfile } from '../shared';

type LibraryFilter = 'home' | 'all' | 'recent' | 'visual_novel' | 'rpg' | 'simulation' | 'action' | 'other' | 'r18' | GameStatus | `collection:${string}`;
type IconName = 'home' | 'library' | 'clock' | 'play' | 'check' | 'search' | 'shield' | 'plus' | 'book' | 'more' | 'folder' | 'list';

const iconPaths: Record<IconName, string> = {
  home: 'M3 10.8 12 3l9 7.8M5.5 9.7V21h13V9.7M9.5 21v-7h5v7',
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
          <div className="hero-tags"><span>{typeLabels[featured.type]}</span><span>{ratingLabels[featured.contentRating]}</span></div>
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

function GameDetail({ game, collections, onBack, onLaunch, onStatusChange, onManageCollections }: {
  game: Game;
  collections: GameCollection[];
  onBack: () => void;
  onLaunch: () => void;
  onStatusChange: (status: GameStatus) => void;
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
          <div className="detail-kicker"><span>{typeLabels[game.type]}</span><span>{ratingLabels[game.contentRating]}</span><span>{statusLabels[game.status]}</span></div>
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

function AddGameDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (game: Game) => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<GameType>('other');
  const [contentRating, setContentRating] = useState<ContentRating>('general');
  const [status, setStatus] = useState<GameStatus>('unplayed');
  const [executablePath, setExecutablePath] = useState('');
  const [coverSourcePath, setCoverSourcePath] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function chooseExecutable() {
    const selected = await window.gameshelf.pickExecutable();
    if (!selected) return;
    setExecutablePath(selected);
    if (!title) {
      const fileName = selected.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') ?? '';
      setTitle(fileName.replace(/[_-]+/g, ' '));
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
      const input: NewGameInput = { title, type, contentRating, executablePath, coverSourcePath, status };
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
              <div className="form-row"><label>游戏类型<select value={type} onChange={(event) => setType(event.target.value as GameType)}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>内容分级<select value={contentRating} onChange={(event) => setContentRating(event.target.value as ContentRating)}>{Object.entries(ratingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
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

function filterTitle(filter: LibraryFilter, collections: GameCollection[]): string {
  if (filter === 'all') return '全部游戏';
  if (filter === 'recent') return '最近游玩';
  if (filter === 'visual_novel') return 'Galgame';
  if (filter === 'rpg') return 'RPG';
  if (filter === 'simulation') return '模拟经营';
  if (filter === 'action') return '动作游戏';
  if (filter === 'other') return '其他游戏';
  if (filter === 'r18') return 'R18 游戏';
  if (filter === 'home') return '游戏首页';
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
  const [safeView, setSafeView] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [managingCollectionsFor, setManagingCollectionsFor] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [nextGames, nextCollections, nextProfile] = await Promise.all([
        window.gameshelf.listGames(),
        window.gameshelf.listCollections(),
        window.gameshelf.getProfile()
      ]);
      setGames(nextGames);
      setCollections(nextCollections);
      setProfile(nextProfile);
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

  const visibleGames = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return games.filter((game) => {
      if (safeView && game.contentRating === 'r18') return false;
      if (query) return `${game.title} ${game.developer}`.toLocaleLowerCase().includes(query);
      if (filter.startsWith('collection:')) return collections.find((collection) => collection.id === filter.slice(11))?.gameIds.includes(game.id) ?? false;
      if (filter === 'recent') return Boolean(game.lastPlayedAt);
      if (['visual_novel', 'rpg', 'simulation', 'action', 'other'].includes(filter)) return game.type === filter;
      if (filter === 'r18') return game.contentRating === 'r18';
      if (['unplayed', 'playing', 'completed', 'paused'].includes(filter)) return game.status === filter;
      return true;
    });
  }, [collections, filter, games, safeView, search]);

  const selected = games.find((game) => game.id === selectedId) ?? null;
  const membershipGame = games.find((game) => game.id === managingCollectionsFor) ?? null;

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

  function navItem(value: LibraryFilter, icon: IconName, label: string) {
    return <button className={filter === value && !selected ? 'nav-item active' : 'nav-item'} onClick={() => { setFilter(value); setSelectedId(null); }}><Icon name={icon} />{label}</button>;
  }

  const showLibrary = search.trim() !== '' || filter !== 'home';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <label className="sidebar-search"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索游戏" /></label>
        <nav className="sidebar-nav">
          {navItem('home', 'home', '主页')}
          <p className="nav-heading">游戏库</p>
          {navItem('all', 'library', '全部游戏')}
          {navItem('completed', 'check', '已玩完')}
          {navItem('unplayed', 'clock', '欲玩清单')}
          <p className="nav-heading">分类</p>
          {navItem('visual_novel', 'book', 'Galgame')}
          {navItem('rpg', 'play', 'RPG')}
          {navItem('simulation', 'library', '模拟经营')}
          {navItem('action', 'play', '动作游戏')}
          {navItem('other', 'more', '其他游戏')}
          {navItem('r18', 'shield', 'R18 游戏')}
          <div className="collection-heading"><p className="nav-heading">我的合集</p><button onClick={() => setCreatingCollection(true)} aria-label="新建合集"><Icon name="plus" /></button></div>
          <div className="collection-nav">{collections.map((collection) => navItem(`collection:${collection.id}`, 'list', collection.name))}{collections.length === 0 && <span className="sidebar-empty">还没有自定义合集</span>}</div>
        </nav>
        <div className="sidebar-bottom">
          <button className={safeView ? 'safe-toggle active' : 'safe-toggle'} onClick={() => { setSafeView((value) => !value); setSelectedId(null); }}><Icon name="shield" />安全视图<i className={safeView ? 'switch on' : 'switch'} /></button>
          <button className="profile-button" onClick={() => setEditingProfile(true)}>{profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : <span>{profile.name.slice(0, 1) || '玩'}</span>}<strong>{profile.name}</strong><Icon name="more" /></button>
        </div>
      </aside>

      <main className="main-pane">
        {selected ? <GameDetail game={selected} collections={collections} onBack={() => setSelectedId(null)} onLaunch={() => void launch(selected)} onStatusChange={(status) => void updateStatus(selected, status)} onManageCollections={() => setManagingCollectionsFor(selected.id)} /> : loading && games.length === 0 ? <div className="loading-state">正在读取游戏库…</div> : games.length === 0 ? <EmptyLibrary onAdd={() => setAdding(true)} /> : showLibrary ? (
          <div className="library-view"><header className="library-toolbar"><div><span className="eyebrow">游戏库</span><h1>{search.trim() ? '本机搜索结果' : filterTitle(filter, collections)}</h1></div><div><span>{visibleGames.length} 个游戏</span>{safeView && <span className="safe-chip">安全视图已开启</span>}<button className="add-button" onClick={() => setAdding(true)}><Icon name="plus" />添加游戏</button></div></header><section className={filter === 'completed' && !search.trim() ? 'timeline-content' : 'library-content'}>{filter === 'completed' && !search.trim() ? <CompletedTimeline games={visibleGames} onOpen={(game) => setSelectedId(game.id)} onStatusChange={(game, status) => void updateStatus(game, status)} /> : <><div className="poster-grid">{visibleGames.map((game) => <Poster key={game.id} game={game} onOpen={() => setSelectedId(game.id)} />)}</div>{visibleGames.length === 0 && <div className="no-results">没有符合当前条件的游戏</div>}</>}</section></div>
        ) : <HomeView games={visibleGames} onOpen={(game) => setSelectedId(game.id)} onLaunch={(game) => void launch(game)} onAdd={() => setAdding(true)} onShowAll={() => setFilter('all')} />}
      </main>

      {adding && <AddGameDialog onClose={() => setAdding(false)} onAdded={(game) => { setAdding(false); setGames((current) => [game, ...current]); setSelectedId(game.id); }} />}
      {creatingCollection && <CreateCollectionDialog onClose={() => setCreatingCollection(false)} onCreated={(collection) => { setCreatingCollection(false); setCollections((current) => [...current, collection].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))); setFilter(`collection:${collection.id}`); }} />}
      {editingProfile && <ProfileDialog profile={profile} onClose={() => setEditingProfile(false)} onSaved={(nextProfile) => { setProfile(nextProfile); setEditingProfile(false); }} />}
      {membershipGame && <CollectionMembershipDialog game={membershipGame} collections={collections} onClose={() => setManagingCollectionsFor(null)} onSaved={(ids) => void saveMembership(membershipGame, ids)} />}
      {message && <div className="toast">{message}</div>}
    </div>
  );
}
