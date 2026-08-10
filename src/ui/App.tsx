import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ContentRating, Game, GameStatus, GameType, NewGameInput } from '../shared';

type LibraryFilter = 'all' | 'recent' | GameStatus;

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

function playTime(seconds: number): string {
  if (seconds < 60) return seconds ? `${seconds} 秒` : '尚未游玩';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} 小时 ${minutes} 分` : `${minutes} 分钟`;
}

function displayDate(value: string | null): string {
  if (!value) return '从未';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
    new Date(value)
  );
}

function Poster({ game, onOpen }: { game: Game; onOpen: () => void }) {
  return (
    <button className="poster" onClick={onOpen} aria-label={`打开 ${game.title}`}>
      <div className="poster-art">
        {game.coverDataUrl ? (
          <img src={game.coverDataUrl} alt="" />
        ) : (
          <div className="poster-placeholder" aria-hidden="true">
            <span>{game.title.slice(0, 1).toUpperCase()}</span>
          </div>
        )}
        <div className="poster-overlay">
          <span className="poster-play">▶</span>
        </div>
        {game.contentRating === 'r18' && <span className="rating-badge">R18</span>}
      </div>
      <span className="poster-title">{game.title}</span>
      <span className="poster-meta">
        {statusLabels[game.status]} · {playTime(game.totalPlaySeconds)}
      </span>
    </button>
  );
}

function EmptyLibrary({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">▦</div>
      <h2>建立你的游戏书架</h2>
      <p>添加一个本地游戏。封面、记录和资料只保存在这台电脑上。</p>
      <button className="primary-button" onClick={onAdd}>添加第一个游戏</button>
    </div>
  );
}

function GameDetail({ game, onBack, onLaunch }: { game: Game; onBack: () => void; onLaunch: () => void }) {
  return (
    <article className="detail-view">
      <div className="detail-glow" style={game.coverDataUrl ? { backgroundImage: `url(${game.coverDataUrl})` } : undefined} />
      <button className="back-button" onClick={onBack}>‹ 返回图书馆</button>
      <div className="detail-content">
        <div className="detail-cover">
          {game.coverDataUrl ? <img src={game.coverDataUrl} alt={`${game.title} 封面`} /> : <div>{game.title.slice(0, 1)}</div>}
        </div>
        <div className="detail-copy">
          <div className="detail-kicker">
            <span>{typeLabels[game.type]}</span>
            <span>{ratingLabels[game.contentRating]}</span>
            <span>{statusLabels[game.status]}</span>
          </div>
          <h1>{game.title}</h1>
          <p className="detail-developer">{game.developer || '未填写会社或开发者'}</p>
          <p className="detail-description">{game.description || '还没有简介。之后可以从元数据源获取，或手动补充。'}</p>
          <div className="detail-actions">
            <button className="play-button" onClick={onLaunch}><span>▶</span> 开始游玩</button>
            <button className="icon-button" title="游玩配置将在下一阶段加入">•••</button>
          </div>
          <dl className="stats-strip">
            <div><dt>总时长</dt><dd>{playTime(game.totalPlaySeconds)}</dd></div>
            <div><dt>启动次数</dt><dd>{game.launchCount}</dd></div>
            <div><dt>最近游玩</dt><dd>{displayDate(game.lastPlayedAt)}</dd></div>
          </dl>
          <div className="coming-grid">
            <section><span>◇</span><h3>游玩配置</h3><p>启动项、补丁组合与显示辅助</p></section>
            <section><span>↻</span><h3>存档快照</h3><p>备份、分支与一键恢复</p></section>
            {game.type === 'visual_novel' && <section><span>⌘</span><h3>路线进度</h3><p>角色路线、结局与攻略笔记</p></section>}
          </div>
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
        <header className="modal-header">
          <div><span className="eyebrow">本地游戏</span><h2 id="add-title">添加到 GameShelf</h2></div>
          <button className="close-button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <form onSubmit={submit}>
          <div className="add-layout">
            <button className="cover-picker" type="button" onClick={chooseCover}>
              {coverPreview ? <img src={coverPreview} alt="封面预览" /> : <><span>＋</span><small>选择封面</small></>}
            </button>
            <div className="form-fields">
              <label>游戏名称<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="输入标题" /></label>
              <label>启动文件<div className="path-field"><input readOnly value={executablePath} placeholder="选择 .exe 文件" /><button type="button" onClick={chooseExecutable}>选择</button></div></label>
              <div className="form-row">
                <label>游戏类型<select value={type} onChange={(event) => setType(event.target.value as GameType)}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>内容分级<select value={contentRating} onChange={(event) => setContentRating(event.target.value as ContentRating)}>{Object.entries(ratingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
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

export function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [search, setSearch] = useState('');
  const [safeView, setSafeView] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    try {
      setGames(await window.gameshelf.listGames());
    } finally {
      setLoading(false);
    }
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
      if (filter === 'recent' && !game.lastPlayedAt) return false;
      if (!['all', 'recent'].includes(filter) && game.status !== filter) return false;
      return !query || `${game.title} ${game.developer}`.toLocaleLowerCase().includes(query);
    });
  }, [filter, games, safeView, search]);

  const selected = games.find((game) => game.id === selectedId) ?? null;

  async function launch(game: Game) {
    try {
      await window.gameshelf.launchGame(game.id);
      setMessage(`已启动 ${game.title}`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    }
  }

  function navItem(value: LibraryFilter, symbol: string, label: string) {
    return <button className={filter === value && !selected ? 'nav-item active' : 'nav-item'} onClick={() => { setFilter(value); setSelectedId(null); }}><span>{symbol}</span>{label}</button>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">G</div><div><strong>GameShelf</strong><small>LOCAL LIBRARY</small></div></div>
        <nav>
          <p className="nav-heading">资料库</p>
          {navItem('all', '▦', '所有游戏')}
          {navItem('recent', '◷', '最近游玩')}
          {navItem('playing', '▶', '游玩中')}
          {navItem('completed', '✓', '已完成')}
          <p className="nav-heading">视图</p>
          <button className={safeView ? 'nav-item active' : 'nav-item'} onClick={() => { setSafeView((value) => !value); setSelectedId(null); }}><span>◉</span>安全视图<i className={safeView ? 'switch on' : 'switch'} /></button>
        </nav>
        <div className="sidebar-footer"><span className="privacy-dot" />所有资料保存在本机</div>
      </aside>

      <main className="main-pane">
        {selected ? (
          <GameDetail game={selected} onBack={() => setSelectedId(null)} onLaunch={() => void launch(selected)} />
        ) : (
          <>
            <header className="toolbar">
              <div><span className="eyebrow">MY COLLECTION</span><h1>{filter === 'recent' ? '最近游玩' : filter === 'all' ? '游戏图书馆' : statusLabels[filter]}</h1></div>
              <div className="toolbar-actions"><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索游戏" /></label><button className="add-button" onClick={() => setAdding(true)}>＋ 添加游戏</button></div>
            </header>
            <section className="library-content">
              {!loading && games.length === 0 ? <EmptyLibrary onAdd={() => setAdding(true)} /> : <><div className="library-summary"><span>{visibleGames.length} 个游戏</span>{safeView && <span className="safe-chip">安全视图已开启</span>}</div><div className="poster-grid">{visibleGames.map((game) => <Poster key={game.id} game={game} onOpen={() => setSelectedId(game.id)} />)}</div>{games.length > 0 && visibleGames.length === 0 && <div className="no-results">没有符合当前条件的游戏</div>}</>}
            </section>
          </>
        )}
      </main>
      {adding && <AddGameDialog onClose={() => setAdding(false)} onAdded={(game) => { setAdding(false); setGames((current) => [game, ...current]); setSelectedId(game.id); }} />}
      {message && <div className="toast">{message}</div>}
    </div>
  );
}
