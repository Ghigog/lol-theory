import { useState, useEffect, useMemo } from "react";
import "./App.css";

const DDR = "https://ddragon.leagueoflegends.com";

// Riot's official non-linear stat growth formula (introduced Season 11)
const growStat = (base, growth, lvl) => {
  const n = lvl - 1;
  return base + growth * n * (0.7025 + 0.0175 * n);
};

const formatDescription = (desc) => {
  if (!desc) return "";
  let res = desc;

  // 1. Process <stats> block into bullet points
  res = res.replace(/<stats>(.*?)<\/stats>/gs, (match, p1) => {
    const lines = p1.split(/<br\s*\/?>/gi).map(l => l.trim()).filter(Boolean);
    return `<div class="d-stats">${lines.map(l => `<div class="stat-line"><span class="bullet">+</span> ${l.replace(/<.*?>/g, "")}</div>`).join('')}</div>`;
  });

  // 2. Highlight <attention> and damage/effect tags
  res = res.replace(/<(attention|physicalDamage|magicDamage|trueDamage|keyword|healing|shield|speed|attackSpeed|lifesteal|keywordStealth|status|recharge)>(.*?)<\/\1>/gs, '<span class="d-attn">$2</span>');

  // 3. Passive/Active/Status/Unique headers
  res = res.replace(/<(passive|active|status|unique)>(.*?)<\/\1>/gs, '<div class="d-header">$2</div>');

  // 4. Flavor/Rules (Extended details)
  res = res.replace(/<(flavorText|rule)>(.*?)<\/\1>/gs, '<div class="d-extended">$2</div>');

  // 5. Main blocks
  res = res.replace(/<mainText>(.*?)<\/mainText>/gs, '<div class="d-block">$2</div>');

  // 6. Generic tags cleanup but keep content
  res = res.replace(/<br\s*\/?>/gi, "<br/>");
  res = res.replace(/<(?!br|div|span|\/div|\/span)(.*?)>/gi, "");
  return res.trim();
};

const STATS = [
  { k: "hp",         label: "Health",         color: "#22C55E", max: 5500, fmt: v => Math.round(v), fmtB: v => `+${Math.round(v)}` },
  { k: "hpregen",    label: "HP Regen",        color: "#16A34A", max: 45,   fmt: v => v.toFixed(1)+"/5s", fmtB: v => `+${v.toFixed(1)}`, sub: true },
  { k: "mp",         label: "Mana",            color: "#3B82F6", max: 2600, fmt: v => Math.round(v), fmtB: v => `+${Math.round(v)}`, resource: true },
  { k: "mpregen",    label: "Mana Regen",      color: "#2563EB", max: 45,   fmt: v => v.toFixed(1)+"/5s", fmtB: v => `+${v.toFixed(1)}`, sub: true, resource: true },
  { k: "ad",         label: "Attack Damage",   color: "#F59E0B", max: 450,  fmt: v => Math.round(v), fmtB: v => `+${Math.round(v)}` },
  { k: "ap",         label: "Ability Power",   color: "#A855F7", max: 1100, fmt: v => Math.round(v), fmtB: v => `+${Math.round(v)}` },
  { k: "armor",      label: "Armor",           color: "#EAB308", max: 350,  fmt: v => Math.round(v), fmtB: v => `+${Math.round(v)}` },
  { k: "mr",         label: "Magic Resist",    color: "#8B5CF6", max: 280,  fmt: v => Math.round(v), fmtB: v => `+${Math.round(v)}` },
  { k: "attackspeed",label: "Attack Speed",    color: "#FCD34D", max: 2.5,  fmt: v => v.toFixed(3), fmtB: v => `+${v.toFixed(3)}` },
  { k: "critchance", label: "Crit Chance",     color: "#EF4444", max: 1.0,  fmt: v => Math.round(v*100)+"%", fmtB: v => `+${Math.round(v*100)}%` },
  { k: "lifesteal",  label: "Life Steal",      color: "#10B981", max: 1.0,  fmt: v => Math.round(v*100)+"%", fmtB: v => `+${Math.round(v*100)}%`, itemOnly: true },
  { k: "movespeed",  label: "Move Speed",      color: "#60A5FA", max: 600,  fmt: v => Math.round(v), fmtB: v => `+${Math.round(v)}` },
];

const SHOP_CATS = [
  { id: "all",            label: "All Items" },
  { id: "Damage",         label: "Damage" },
  { id: "SpellDamage",    label: "Mage" },
  { id: "Health",         label: "Health" },
  { id: "Armor",          label: "Armor" },
  { id: "SpellBlock",     label: "Mag. Res." },
  { id: "AttackSpeed",    label: "Atk Speed" },
  { id: "CriticalStrike", label: "Critical" },
  { id: "LifeSteal",      label: "Lifesteal" },
  { id: "Boots",          label: "Boots" },
];

const ITEM_STAT_FMT = {
  FlatHPPoolMod:         v => ["Health",          `+${Math.round(v)}`],
  FlatMPPoolMod:         v => ["Mana",             `+${Math.round(v)}`],
  FlatPhysicalDamageMod: v => ["Attack Damage",    `+${Math.round(v)}`],
  FlatMagicDamageMod:    v => ["Ability Power",    `+${Math.round(v)}`],
  FlatArmorMod:          v => ["Armor",            `+${Math.round(v)}`],
  FlatSpellBlockMod:     v => ["Magic Resist",     `+${Math.round(v)}`],
  FlatMovementSpeedMod:  v => ["Move Speed",       `+${Math.round(v)}`],
  PercentMovementSpeedMod: v => ["Move Speed",     `+${Math.round(v*100)}%`],
  FlatAttackSpeedMod:    v => ["Attack Speed",     `+${Math.round(v*100)}%`],
  FlatCritChanceMod:     v => ["Critical Strike",  `${Math.round(v*100)}%`],
  FlatHPRegenMod:        v => ["Base HP Regen",    `${Math.round(v*100)}%`],
  FlatMPRegenMod:        v => ["Base Mana Regen",  `${Math.round(v*100)}%`],
  PercentLifeStealMod:   v => ["Life Steal",       `${Math.round(v*100)}%`],
  PercentCritDamageMod:  v => ["Bonus Crit Dmg",   `+${Math.round(v*100)}%`],
};

const getStatLabel = (key, val) => {
  if (ITEM_STAT_FMT[key]) return ITEM_STAT_FMT[key](val);
  const label = key.replace(/Flat|Mod|Pool/g, "").replace(/([A-Z])/g, " $1").trim();
  return [label, `+${val}`];
};

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [ver,           setVer]         = useState(null);
  const [allChamps,     setAllChamps]   = useState({});
  const [champSearch,   setChampSearch] = useState("");
  const [champDetail,   setChampDetail] = useState(null);
  const [allItems,      setAllItems]    = useState({});
  const [level,         setLevel]       = useState(13);
  const [equipped,      setEquipped]    = useState(Array(6).fill(null));
  const [shopSearch,    setShopSearch]  = useState("");
  const [shopCat,       setShopCat]     = useState("all");
  const [tooltip,       setTooltip]     = useState(null);
  const [mpos,          setMpos]        = useState({ x: 0, y: 0 });
  const [loading,       setLoading]     = useState(true);
  const [loadErr,       setLoadErr]     = useState(null);
  const [dragging,      setDragging]    = useState(null);
  const [dragOverSlot,  setDragOverSlot]= useState(null);
  const [showPicker,    setShowPicker]  = useState(true);
  const [shiftPressed,  setShiftPressed]= useState(false);
  const [activeTab,     setActiveTab]   = useState(null);

  // ── Global Listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e) => { if (e.key === "Shift") setShiftPressed(true); };
    const up   = (e) => { if (e.key === "Shift") setShiftPressed(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { 
      window.removeEventListener("keydown", down); 
      window.removeEventListener("keyup", up); 
    };
  }, []);

  useEffect(() => {
    const res = () => {
      const isMob = window.innerWidth <= 768;
      if (isMob) {
        setActiveTab(prev => prev || 'stats');
      } else {
        setActiveTab(null);
      }
    };
    window.addEventListener("resize", res);
    res();
    return () => window.removeEventListener("resize", res);
  }, []);

  // ── Fetch Data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [v] = await fetch(`${DDR}/api/versions.json`).then(r => r.json());
        setVer(v);
        const [cd, id] = await Promise.all([
          fetch(`${DDR}/cdn/${v}/data/en_US/champion.json`).then(r => r.json()),
          fetch(`${DDR}/cdn/${v}/data/en_US/item.json`).then(r => r.json()),
        ]);
        setAllChamps(cd.data);
        setAllItems(id.data);
      } catch (e) {
        setLoadErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Champion Pick ───────────────────────────────────────────────────────────
  const pickChamp = async (c) => {
    if (!ver) return;
    const d = await fetch(`${DDR}/cdn/${ver}/data/en_US/champion/${c.id}.json`).then(r => r.json());
    setChampDetail(d.data[c.id]);
    setShowPicker(false);
  };

  // ── Stat Calculation ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!champDetail) return null;
    const s = champDetail.stats;
    const n = level - 1;

    const base = {
      hp:          growStat(s.hp, s.hpperlevel, level),
      hpregen:     growStat(s.hpregen, s.hpregenperlevel, level),
      mp:          growStat(s.mp, s.mpperlevel, level),
      mpregen:     growStat(s.mpregen, s.mpregenperlevel, level),
      ad:          growStat(s.attackdamage, s.attackdamageperlevel, level),
      armor:       growStat(s.armor, s.armorperlevel, level),
      mr:          growStat(s.spellblock, s.spellblockperlevel, level),
      attackspeed: s.attackspeed * (1 + (s.attackspeedperlevel * n) / 100),
      movespeed:   s.movespeed,
      ap: 0, critchance: 0, lifesteal: 0,
    };

    const bon = { hp:0, hpregen:0, mp:0, mpregen:0, ad:0, ap:0, armor:0, mr:0, attackspeed:0, critchance:0, lifesteal:0, movespeed:0, moveSpeedPct:0 };

    equipped.forEach(item => {
      if (!item?.stats) return;
      const st = item.stats;
      if (st.FlatHPPoolMod)         bon.hp         += st.FlatHPPoolMod;
      if (st.FlatMPPoolMod)         bon.mp         += st.FlatMPPoolMod;
      if (st.FlatPhysicalDamageMod) bon.ad         += st.FlatPhysicalDamageMod;
      if (st.FlatMagicDamageMod)    bon.ap         += st.FlatMagicDamageMod;
      if (st.FlatArmorMod)          bon.armor      += st.FlatArmorMod;
      if (st.FlatSpellBlockMod)     bon.mr         += st.FlatSpellBlockMod;
      if (st.FlatHPRegenMod)        bon.hpregen    += st.FlatHPRegenMod;
      if (st.FlatMPRegenMod)        bon.mpregen    += st.FlatMPRegenMod;
      if (st.FlatMovementSpeedMod)  bon.movespeed  += st.FlatMovementSpeedMod;
      if (st.PercentMovementSpeedMod) bon.moveSpeedPct += st.PercentMovementSpeedMod;
      if (st.FlatAttackSpeedMod)    bon.attackspeed += st.FlatAttackSpeedMod;
      if (st.FlatCritChanceMod)     bon.critchance += st.FlatCritChanceMod;
      if (st.PercentLifeStealMod)   bon.lifesteal  += st.PercentLifeStealMod;
    });

    const total = {
      hp:          base.hp + bon.hp,
      hpregen:     base.hpregen + bon.hpregen,
      mp:          base.mp + bon.mp,
      mpregen:     base.mpregen + bon.mpregen,
      ad:          base.ad + bon.ad,
      ap:          bon.ap,
      armor:       base.armor + bon.armor,
      mr:          base.mr + bon.mr,
      attackspeed: base.attackspeed * (1 + bon.attackspeed),
      critchance:  bon.critchance,
      lifesteal:   bon.lifesteal,
      movespeed:   (base.movespeed + bon.movespeed) * (1 + bon.moveSpeedPct),
    };

    return { base, total };
  }, [champDetail, level, equipped]);

  // ── Shop Items ──────────────────────────────────────────────────────────────
  const shopItems = useMemo(() => {
    return Object.entries(allItems)
      .filter(([id, item]) => {
        if (!item.gold?.purchasable || !item.maps?.["11"]) return false;
        if (!item.gold.total) return false;
        if (item.inStore === false) return false;
        if (shopSearch && !item.name.toLowerCase().includes(shopSearch.toLowerCase())) return false;
        if (shopCat !== "all" && !(item.tags || []).includes(shopCat)) return false;
        return true;
      })
      .map(([id, item]) => ({ ...item, itemId: id }))
      .sort((a, b) => (a.gold?.total || 0) - (b.gold?.total || 0));
  }, [allItems, shopSearch, shopCat]);

  // ── Slot Actions ─────────────────────────────────────────────────────────────
  const addItem = (item) => {
    const idx = equipped.findIndex(e => !e);
    if (idx < 0) return;
    const next = [...equipped];
    next[idx] = item;
    setEquipped(next);
  };

  const removeItem = (idx) => {
    const next = [...equipped];
    next[idx] = null;
    setEquipped(next);
  };

  const clearBuild = () => {
    setEquipped(Array(6).fill(null));
  };

  const resetAll = () => {
    setChampDetail(null);
    setEquipped(Array(6).fill(null));
    setLevel(1);
    setShowPicker(true);
    setChampSearch("");
    setShopSearch("");
    setShopCat("all");
  };

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const onShopDragStart = (e, item) => {
    setDragging({ item, src: "shop" });
    e.dataTransfer.effectAllowed = "copy";
  };

  const onSlotDragStart = (e, idx) => {
    if (!equipped[idx]) { e.preventDefault(); return; }
    setDragging({ item: equipped[idx], src: idx });
    e.dataTransfer.effectAllowed = "move";
  };

  const onSlotDragOver = (e, idx) => {
    e.preventDefault();
    setDragOverSlot(idx);
  };

  const onSlotDrop = (e, idx) => {
    e.preventDefault();
    setDragOverSlot(null);
    if (!dragging) return;
    const next = [...equipped];
    if (dragging.src === "shop") {
      next[idx] = dragging.item;
    } else if (typeof dragging.src === "number") {
      [next[idx], next[dragging.src]] = [next[dragging.src], next[idx]];
    }
    setEquipped(next);
    setDragging(null);
  };

  const onDragEnd = () => { setDragging(null); setDragOverSlot(null); };

  const totalGold = equipped.reduce((s, i) => s + (i?.gold?.total || 0), 0);
  const hasMana   = champDetail?.partype === "Mana";
  const hasEnergy = champDetail?.partype === "Energy";

  const filteredChamps = Object.values(allChamps)
    .filter(c => c.name.toLowerCase().includes(champSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── Palette ──────────────────────────────────────────────────────────────────
  const C = {
    G:  "#C89B3C",   // gold
    GL: "#F0E6D2",   // gold light / main text
    GD: "#785A28",   // gold dark
    GX: "#463714",   // gold border dim
    BG: "#010A13",   // page background
    P:  "#0D1F2E",   // panel bg
    P2: "#091624",   // panel darker
    B:  "#1E3A5F",   // blue border
    BD: "#0A1628",   // dark input bg
    T:  "#C8AA6E",   // secondary text (warm)
    TD: "#8A96AB",   // dim text (lightened for better readability)
    FF: `'Rajdhani','Segoe UI',sans-serif`,
    FFT:`'Cinzel',Georgia,serif`,
  };

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:C.BG, color:C.G, fontFamily:C.FFT }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:52, marginBottom:16, letterSpacing:4 }}>⚔</div>
          <div style={{ fontSize:17, letterSpacing:5 }}>LOADING</div>
          <div style={{ marginTop:8, color:C.TD, fontSize:12, fontFamily:C.FF, letterSpacing:2 }}>Fetching from Riot Data Dragon…</div>
        </div>
      </div>
    );
  }
  if (loadErr) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:C.BG, color:"#EF4444", fontFamily:C.FF, padding:20 }}>
        <div>
          <div style={{ fontFamily:C.FFT, marginBottom:8 }}>Failed to load data</div>
          <div style={{ fontSize:12, opacity:0.7 }}>{loadErr}</div>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ display:"flex", flexDirection:"column", height:"100svh", background:C.BG, fontFamily:C.FF, color:C.GL, overflow:"hidden" }}
      onMouseMove={e => tooltip && setMpos({ x: e.clientX, y: e.clientY })}
      className={activeTab ? "mobile-view" : "desktop-view"}
    >
      <Header 
        ver={ver} 
        totalGold={totalGold} 
        champDetail={champDetail} 
        equipped={equipped} 
        resetAll={resetAll} 
        C={C} 
      />

      <main className="main-content">
        <div className={`panel stats-panel ${(activeTab === 'stats' || !activeTab) ? 'active' : ''}`}>
          {showPicker ? (
            <ChampionPicker 
              champSearch={champSearch}
              setChampSearch={setChampSearch}
              filteredChamps={filteredChamps}
              pickChamp={pickChamp}
              ver={ver}
              C={C}
            />
          ) : (
            <ChampionDetails 
              champDetail={champDetail}
              stats={stats}
              level={level}
              setLevel={setLevel}
              hasMana={hasMana}
              hasEnergy={hasEnergy}
              setShowPicker={setShowPicker}
              ver={ver}
              C={C}
            />
          )}
        </div>

        <div className={`panel-group ${(activeTab === 'build' || activeTab === 'shop' || !activeTab) ? 'active' : ''}`}>
          <div className={`panel build-panel ${(activeTab === 'build' || !activeTab) ? 'active' : ''}`}>
            <Inventory 
              equipped={equipped}
              clearBuild={clearBuild}
              onSlotDragStart={onSlotDragStart}
              onSlotDragOver={onSlotDragOver}
              onSlotDrop={onSlotDrop}
              onDragEnd={onDragEnd}
              removeItem={removeItem}
              setTooltip={setTooltip}
              setMpos={setMpos}
              dragOverSlot={dragOverSlot}
              ver={ver}
              C={C}
            />
          </div>

          <div className={`panel shop-panel ${(activeTab === 'shop' || !activeTab) ? 'active' : ''}`}>
            <Shop 
              shopSearch={shopSearch}
              setShopSearch={setShopSearch}
              shopCat={shopCat}
              setShopCat={setShopCat}
              shopItems={shopItems}
              addItem={addItem}
              onShopDragStart={onShopDragStart}
              onDragEnd={onDragEnd}
              setTooltip={setTooltip}
              setMpos={setMpos}
              ver={ver}
              C={C}
            />
          </div>
        </div>
      </main>

      {activeTab && (
        <nav className="mobile-nav">
          <button id="nav-stats" className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>STATS</button>
          <button id="nav-build" className={activeTab === 'build' ? 'active' : ''} onClick={() => setActiveTab('build')}>BUILD</button>
          <button id="nav-shop" className={activeTab === 'shop' ? 'active' : ''} onClick={() => setActiveTab('shop')}>SHOP</button>
        </nav>
      )}

      {tooltip && ver && (
        <ItemTooltip 
          item={tooltip} 
          pos={mpos} 
          ver={ver} 
          C={C} 
          FMT={ITEM_STAT_FMT} 
          getStatLabel={getStatLabel}
          format={formatDescription} 
          shift={shiftPressed} 
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Header({ ver, totalGold, champDetail, equipped, resetAll, C }) {
  return (
    <header className="app-header">
      <div className="logo-group">
        <div className="logo-text">⚔ THEORY FORGE</div>
        <div className="logo-sub">League of Legends Build Simulator</div>
      </div>
      {ver && (
        <div className="header-actions">
          {champDetail && equipped.some(Boolean) && (
            <span className="gold-count">💰 {totalGold.toLocaleString()}g</span>
          )}
          <button className="action-btn reset-btn" onClick={resetAll}>Reset All</button>
          <span className="patch-ver">Patch {ver}</span>
        </div>
      )}
    </header>
  );
}

function ChampionPicker({ champSearch, setChampSearch, filteredChamps, pickChamp, ver, C }) {
  return (
    <div className="champ-picker">
      <div className="panel-title">Select Champion</div>
      <input
        value={champSearch}
        onChange={e => setChampSearch(e.target.value)}
        placeholder="Search champions…"
        className="search-input"
      />
      <div className="champ-grid">
        {filteredChamps.map(c => (
          <div key={c.id} className="champ-icon" onClick={() => pickChamp(c)} title={c.name}>
            <img src={`${DDR}/cdn/${ver}/img/champion/${c.image.full}`} alt={c.name} />
          </div>
        ))}
        {filteredChamps.length === 0 && <div className="no-results">No champions found</div>}
      </div>
    </div>
  );
}

function ChampionDetails({ champDetail, stats, level, setLevel, hasMana, hasEnergy, setShowPicker, ver, C }) {
  return (
    <div className="champ-details">
      <div className="champ-header-card">
        <div className="champ-info">
          <img src={`${DDR}/cdn/${ver}/img/champion/${champDetail.image.full}`} alt={champDetail.name} className="champ-avatar" />
          <div className="champ-meta">
            <div className="champ-name">{champDetail.name}</div>
            <div className="champ-title">{champDetail.title}</div>
            <div className="champ-tags">
              {champDetail.tags?.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>
          <button onClick={() => setShowPicker(true)} className="change-btn">CHANGE</button>
        </div>

        <div className="level-control">
          <span className="level-label">LEVEL</span>
          <input
            type="range" min={1} max={18} value={level}
            onChange={e => setLevel(+e.target.value)}
            style={{ background:`linear-gradient(to right,${C.G} ${((level-1)/17)*100}%,${C.BD} ${((level-1)/17)*100}%)` }}
          />
          <div className="level-badge">{level}</div>
        </div>
      </div>

      <div className="stat-bars">
        {stats && STATS.map(cfg => {
          if (cfg.resource && !hasMana && !hasEnergy) return null;
          const total = stats.total[cfg.k] ?? 0;
          const base  = stats.base[cfg.k]  ?? 0;
          const bonus = total - base;
          if (cfg.itemOnly && bonus < 0.001) return null;

          const barMax  = cfg.max;
          const totalPct  = Math.min(total / barMax, 1) * 100;
          const basePct   = total > 0 ? (base / total) * totalPct : 0;
          const bonusPct  = totalPct - basePct;

          return (
            <div key={cfg.k} className={`stat-row ${cfg.sub ? 'sub' : ''}`}>
              <div className="stat-label">{cfg.label}</div>
              <div className="stat-bar-container">
                <div className="stat-bar-fill" style={{ width:`${basePct}%`, background:cfg.color, opacity:0.75 }} />
                <div className="stat-bar-bonus" style={{ width:`${bonusPct}%`, background:C.G }} />
              </div>
              <div className="stat-value">
                <span className={bonus > 0.001 ? 'has-bonus' : ''}>{cfg.fmt(total)}</span>
                {bonus > 0.001 && <span className="bonus-val">({cfg.fmtB(bonus)})</span>}
              </div>
            </div>
          );
        })}

        <div className="gold-divider" />
        <div className="champ-footer-chips">
          <Chip label="Resource" val={champDetail.partype} C={C} />
          <Chip label="Range"    val={champDetail.stats.attackrange} C={C} />
          <Chip label="Movespeed" val={champDetail.stats.movespeed} C={C} />
        </div>
      </div>
    </div>
  );
}

function Inventory({ equipped, clearBuild, onSlotDragStart, onSlotDragOver, onSlotDrop, onDragEnd, removeItem, setTooltip, setMpos, dragOverSlot, ver, C }) {
  return (
    <div className="inventory-panel">
      <div className="panel-title flex-between">
        <div>
          Item Build
          <span className="subtitle">Drag from shop · click to remove</span>
        </div>
        {equipped.some(Boolean) && <button className="action-btn" onClick={clearBuild}>Clear Build</button>}
      </div>

      <div className="inventory-grid">
        {equipped.map((item, idx) => (
          <div
            key={idx}
            className={`slot-box ${dragOverSlot === idx ? 'drag-over' : ''} ${item ? 'has-item' : ''}`}
            draggable={!!item}
            onDragStart={e => onSlotDragStart(e, idx)}
            onDragOver={e => onSlotDragOver(e, idx)}
            onDrop={e => onSlotDrop(e, idx)}
            onDragLeave={() => {}}
            onDragEnd={onDragEnd}
            onClick={() => item && removeItem(idx)}
            onMouseEnter={item ? (e => { setTooltip(item); setMpos({ x:e.clientX, y:e.clientY }); }) : undefined}
            onMouseLeave={() => setTooltip(null)}
          >
            {item ? (
              <>
                <img src={`${DDR}/cdn/${ver}/img/item/${item.image.full}`} alt={item.name} className="item-img" />
                <div className="item-price">{item.gold?.total?.toLocaleString()}g</div>
                <div className="slot-rm">✕</div>
              </>
            ) : (
              <div className="empty-slot">＋</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Shop({ shopSearch, setShopSearch, shopCat, setShopCat, shopItems, addItem, onShopDragStart, onDragEnd, setTooltip, setMpos, ver, C }) {
  return (
    <div className="shop-content">
      <div className="panel-title">Shop</div>
      <input
        value={shopSearch}
        onChange={e => setShopSearch(e.target.value)}
        placeholder="Search items…"
        className="search-input"
      />

      <div className="shop-cats">
        {SHOP_CATS.map(cat => (
          <button
            key={cat.id}
            className={`cat-btn ${shopCat === cat.id ? 'active' : ''}`}
            onClick={() => setShopCat(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="shop-grid">
        {shopItems.map(item => (
          <div
            key={item.itemId}
            className="item-cell"
            draggable
            onDragStart={e => onShopDragStart(e, item)}
            onDragEnd={onDragEnd}
            onClick={() => addItem(item)}
            onMouseEnter={e => { setTooltip(item); setMpos({ x:e.clientX, y:e.clientY }); }}
            onMouseLeave={() => setTooltip(null)}
            onMouseMove={e => setMpos({ x:e.clientX, y:e.clientY })}
          >
            <img src={`${DDR}/cdn/${ver}/img/item/${item.image.full}`} alt={item.name} />
            <div className="item-price">{item.gold?.total?.toLocaleString()}g</div>
          </div>
        ))}
        {shopItems.length === 0 && <div className="no-results">No items match this filter.</div>}
      </div>
    </div>
  );
}

function Chip({ label, val, C }) {
  return (
    <div className="info-chip">
      <span className="chip-label">{label}:</span>
      <span className="chip-val">{val}</span>
    </div>
  );
}

function ItemTooltip({ item, pos, ver, C, FMT, getStatLabel, format, shift }) {
  const TW = 280;
  const left = typeof window !== 'undefined' && pos.x + 14 + TW > window.innerWidth ? pos.x - TW - 8 : pos.x + 14;
  const top  = Math.max(10, pos.y - 10);

  const itemStats = item.stats ? Object.entries(item.stats).filter(([k]) => FMT[k]) : [];
  const descHtml = format(item.description || "");

  return (
    <div className="tooltip-container" style={{ left, top }}>
      <div className="tooltip-header">
        <img src={`${DDR}/cdn/${ver}/img/item/${item.image.full}`} alt={item.name} className="tooltip-img" />
        <div className="tooltip-meta">
          <div className="tooltip-name">{item.name}</div>
          {item.gold && (
            <div className="tooltip-gold">
              <span className="gold-text">💰 {item.gold.total?.toLocaleString()}g</span>
              {shift && item.gold.sell > 0 && <span className="sell-text">→ sell {item.gold.sell}g</span>}
            </div>
          )}
        </div>
      </div>

      {itemStats.length > 0 && (
        <div className="tooltip-stats">
          {itemStats.map(([key, val]) => {
            const [label, fval] = getStatLabel(key, val);
            return (
              <div key={key} className="tooltip-stat-row">
                <span className="stat-name">{label}</span>
                <span className="stat-val">{fval}</span>
              </div>
            );
          })}
        </div>
      )}

      {descHtml && (
        <div 
          className={`tooltip-desc ${shift ? "show-extended" : ""}`}
          dangerouslySetInnerHTML={{ __html: descHtml }}
        />
      )}

      {!shift && <div className="shift-hint">HOLD [SHIFT] FOR DETAILS</div>}
    </div>
  );
}
