import { useEffect, useState } from 'react';
import heroArt from './assets/twilight-platform.jpg';
import './ui-prototype.css';

type Variant = 'A' | 'B' | 'C';
type IconName = 'home' | 'library' | 'clock' | 'heart' | 'search' | 'shield' | 'settings' | 'play' | 'plus' | 'grid' | 'list' | 'gamepad' | 'folder' | 'more';

const iconPaths: Record<IconName, string> = {
  home: 'M3 10.8 12 3l9 7.8M5.5 9.7V21h13V9.7M9.5 21v-7h5v7',
  library: 'M4 4v16M9 4v16M14 5v15M19 3l2 16',
  clock: 'M12 7v5l3.5 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  heart: 'M20.8 5.9c-1.8-2.3-5.2-2.1-6.8.2L12 9 10 6.1C8.4 3.8 5 3.6 3.2 5.9c-1.7 2.2-1.3 5.4.8 7.3L12 20l8-6.8c2.1-1.9 2.5-5.1.8-7.3Z',
  search: 'm20 20-4.4-4.4M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  shield: 'M12 22s8-3.8 8-10V5l-8-3-8 3v7c0 6.2 8 10 8 10Z',
  settings: 'M12 15.3a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  play: 'M8 5v14l11-7Z',
  plus: 'M12 5v14M5 12h14',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  gamepad: 'M8.5 9.5v5M6 12h5M16 11.5h.01M18.5 14h.01M7 5h10c3.8 0 5.3 8.7 3.3 12.5-1.2 2.3-3.2.8-5.4-1.5H9.1c-2.2 2.3-4.2 3.8-5.4 1.5C1.7 13.7 3.2 5 7 5Z',
  folder: 'M3 6h7l2 2h9v11H3Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01'
};

function Icon({ name, fill = false }: { name: IconName; fill?: boolean }) {
  return (
    <svg className="proto-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={iconPaths[name]} fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const mockGames = [
  { title: '潮汐以北', meta: '游玩中 · 12.4 小时', tone: 'sea' },
  { title: '花与玻璃', meta: '最近加入', tone: 'flower' },
  { title: '零点书简', meta: '视觉小说', tone: 'letter' },
  { title: '夏末回声', meta: '已完成 · 28.1 小时', tone: 'summer' },
  { title: 'NOCTURNE', meta: 'RPG · 6.8 小时', tone: 'night' },
  { title: '雾中庭院', meta: '未开始', tone: 'garden' }
] as const;

function TrafficLights() {
  return <div className="traffic-lights" aria-hidden="true"><i /><i /><i /></div>;
}

function Cover({ game, square = false }: { game: typeof mockGames[number]; square?: boolean }) {
  return (
    <div className={`mock-cover ${game.tone} ${square ? 'square' : ''}`}>
      <span className="cover-line" />
      <strong>{game.title}</strong>
      <small>GAMESHELF ORIGINAL</small>
    </div>
  );
}

function TvVariant() {
  return (
    <div className="prototype-page tv-page">
      <aside className="tv-sidebar">
        <TrafficLights />
        <div className="tv-brand">GameShelf</div>
        <button className="tv-search"><Icon name="search" />搜索</button>
        <nav>
          <button className="selected"><Icon name="home" />首页</button>
          <button><Icon name="library" />资料库</button>
          <button><Icon name="clock" />最近游玩</button>
          <button><Icon name="heart" />收藏</button>
        </nav>
        <p>分类</p>
        <nav>
          <button><span className="nav-dot blue" />视觉小说</button>
          <button><span className="nav-dot amber" />角色扮演</button>
          <button><span className="nav-dot moss" />其他游戏</button>
        </nav>
        <div className="tv-sidebar-bottom">
          <button><Icon name="shield" />安全视图<span className="native-switch" /></button>
          <div className="local-only"><span>KS</span><div><b>本地资料库</b><small>所有记录仅在此电脑</small></div></div>
        </div>
      </aside>

      <main className="tv-main">
        <section className="tv-hero">
          <img src={heroArt} alt="虚构游戏《潮汐以北》的海边车站主视觉" />
          <div className="tv-hero-shade" />
          <div className="tv-hero-copy">
            <span className="tv-category">正在游玩</span>
            <h1>潮汐以北</h1>
            <p className="tv-jp">潮の向こうに、君がいる。</p>
            <p className="tv-synopsis">海边小城的最后一个夏天。沿着废弃铁路，找回一封从未寄出的信。</p>
            <div className="tv-actions">
              <button className="white-action"><Icon name="play" fill />继续游玩</button>
              <button className="round-action" aria-label="添加到收藏"><Icon name="plus" /></button>
              <button className="round-action" aria-label="更多选项"><Icon name="more" /></button>
            </div>
          </div>
          <span className="hero-progress"><i /></span>
        </section>

        <div className="tv-shelves">
          <section>
            <header><h2>继续游玩</h2><button>查看全部</button></header>
            <div className="landscape-row">
              <article className="landscape-card featured" style={{ backgroundImage: `url(${heroArt})` }}>
                <button aria-label="继续游玩潮汐以北"><Icon name="play" fill /></button>
                <div><strong>潮汐以北</strong><small>第二章 · 海风与旧站台</small></div>
                <span><i /></span>
              </article>
              <article className="landscape-card abstract-a"><div><strong>NOCTURNE</strong><small>上次游玩：昨天</small></div><span><i /></span></article>
              <article className="landscape-card abstract-b"><div><strong>夏末回声</strong><small>完成度 74%</small></div><span><i /></span></article>
            </div>
          </section>
          <section>
            <header><h2>最近加入</h2><button>资料库</button></header>
            <div className="tv-poster-row">
              {mockGames.map((game) => <article key={game.title}><Cover game={game} /><strong>{game.title}</strong><small>{game.meta}</small></article>)}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function MusicVariant() {
  return (
    <div className="prototype-page music-page">
      <aside className="music-sidebar">
        <TrafficLights />
        <label className="music-search"><Icon name="search" /><input placeholder="搜索" /></label>
        <nav>
          <p>GameShelf</p>
          <button><Icon name="home" />主页</button>
          <button className="selected"><Icon name="library" />资料库</button>
          <button><Icon name="clock" />最近游玩</button>
          <p>资料库</p>
          <button><Icon name="gamepad" />全部游戏</button>
          <button><Icon name="heart" />收藏</button>
          <button><Icon name="folder" />收藏夹</button>
        </nav>
        <button className="sidebar-add"><Icon name="plus" />新建收藏夹</button>
      </aside>

      <main className="music-main">
        <header className="music-toolbar">
          <div><button>‹</button><button>›</button></div>
          <div className="now-playing">
            <div className="now-thumb" style={{ backgroundImage: `url(${heroArt})` }} />
            <div><strong>潮汐以北</strong><small>上次游玩：今天 18:42</small></div>
            <span className="session-progress"><i /></span>
          </div>
          <button className="safe-button"><Icon name="shield" />安全视图</button>
        </header>
        <div className="music-scroll">
          <section className="music-heading">
            <div><span>资料库</span><h1>全部游戏</h1></div>
            <div className="view-actions"><button>最近添加⌄</button><button className="selected"><Icon name="grid" /></button><button><Icon name="list" /></button><button className="music-add"><Icon name="plus" />添加游戏</button></div>
          </section>
          <section className="music-feature">
            <div className="music-feature-art" style={{ backgroundImage: `url(${heroArt})` }} />
            <div className="music-feature-copy"><small>继续游玩</small><h2>潮汐以北</h2><p>第二章 · 海风与旧站台</p><span>已游玩 12.4 小时 · 完成度 38%</span><div><button className="music-play"><Icon name="play" fill />继续</button><button className="music-more"><Icon name="more" /></button></div></div>
          </section>
          <section className="music-library">
            <header><h2>最近添加</h2><button>查看全部</button></header>
            <div className="album-grid">
              {mockGames.map((game) => <article key={game.title}><Cover game={game} square /><strong>{game.title}</strong><small>{game.meta}</small></article>)}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function WorkVariant() {
  return (
    <div className="prototype-page work-page">
      <aside className="work-sidebar">
        <TrafficLights />
        <div className="work-brand"><span>G</span><strong>GameShelf</strong></div>
        <nav><button className="selected"><Icon name="library" />游戏库</button><button><Icon name="clock" />活动</button><button><Icon name="shield" />安全视图</button></nav>
        <div className="work-bottom"><button><Icon name="settings" />设置</button><span>本地模式</span></div>
      </aside>
      <section className="game-list-pane">
        <header><h1>游戏库</h1><button><Icon name="plus" /></button></header>
        <label><Icon name="search" /><input placeholder="搜索 24 个游戏" /></label>
        <div className="list-filter"><button className="selected">全部</button><button>游玩中</button><button>未开始</button></div>
        <div className="compact-list">
          {mockGames.map((game, index) => <button className={index === 0 ? 'selected' : ''} key={game.title}><Cover game={game} /><span><strong>{game.title}</strong><small>{game.meta}</small></span>{index === 0 && <i />}</button>)}
        </div>
      </section>
      <main className="work-detail">
        <section className="work-hero">
          <img src={heroArt} alt="海边车站" />
          <div className="work-hero-copy"><span>视觉小说 · R18</span><h1>潮汐以北</h1><p>North of the Tide</p><div><button className="work-play"><Icon name="play" fill />开始游玩</button><button className="profile-button">汉化版⌄</button><button className="work-round"><Icon name="more" /></button></div></div>
        </section>
        <nav className="detail-tabs"><button className="selected">概览</button><button>启动项 <span>3</span></button><button>Mod <span>7</span></button><button>存档 <span>12</span></button><button>路线</button><button>笔记</button></nav>
        <div className="work-content">
          <section className="work-overview">
            <div className="stat-line"><div><small>总时长</small><strong>12.4 小时</strong></div><div><small>最近游玩</small><strong>今天 18:42</strong></div><div><small>完成度</small><strong>38%</strong></div><div><small>启动次数</small><strong>16</strong></div></div>
            <div className="progress-block"><header><div><small>当前进度</small><h2>第二章 · 海风与旧站台</h2></div><button>更新进度</button></header><div className="chapter-progress"><span><i /></span><b>7 / 18</b></div><p>“在月台的长椅下发现了没有署名的旧信封。”</p></div>
            <div className="session-card"><header><h2>最近记录</h2><button>全部统计</button></header><div><span className="session-date">今<br /><b>10</b></span><p><strong>游玩 1 小时 42 分</strong><small>汉化版 · Magpie · 2 个 Mod</small></p><span>18:42 — 20:24</span></div></div>
          </section>
          <aside className="tool-pane">
            <section><header><h2>游玩配置</h2><button>管理</button></header><button className="profile-row selected"><span><Icon name="gamepad" /></span><p><strong>汉化版</strong><small>Locale Emulator · Magpie</small></p><i>默认</i></button><button className="profile-row"><span><Icon name="gamepad" /></span><p><strong>原版</strong><small>直接启动</small></p></button></section>
            <section><header><h2>本地工具</h2></header><div className="quick-tools"><button><b>7</b><span>Mod</span></button><button><b>12</b><span>存档</span></button><button><b>4/9</b><span>路线</span></button></div></section>
          </aside>
        </div>
      </main>
    </div>
  );
}

const variants: { id: Variant; label: string; hint: string }[] = [
  { id: 'A', label: 'Apple TV', hint: '沉浸首页' },
  { id: 'B', label: 'Apple Music', hint: '资料库' },
  { id: 'C', label: 'Steam × Luna', hint: '管理台' }
];

export function UIPrototype() {
  const initial = new URLSearchParams(window.location.search).get('variant');
  const [variant, setVariant] = useState<Variant>(initial === 'B' || initial === 'C' ? initial : 'A');

  function select(next: Variant) {
    setVariant(next);
    const url = new URL(window.location.href);
    url.searchParams.set('prototype', 'ui');
    url.searchParams.set('variant', next);
    window.history.replaceState(null, '', url);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches('input, textarea, [contenteditable="true"]')) return;
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const index = variants.findIndex((item) => item.id === variant);
      const step = event.key === 'ArrowRight' ? 1 : -1;
      select(variants[(index + step + variants.length) % variants.length]!.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant]);

  return (
    <div className="ui-prototype">
      {variant === 'A' ? <TvVariant /> : variant === 'B' ? <MusicVariant /> : <WorkVariant />}
      <nav className="variant-switcher" aria-label="界面方案">
        {variants.map((item) => <button key={item.id} className={variant === item.id ? 'selected' : ''} onClick={() => select(item.id)}><b>{item.id}</b><span>{item.label}<small>{item.hint}</small></span></button>)}
        <em>← → 切换</em>
      </nav>
    </div>
  );
}
