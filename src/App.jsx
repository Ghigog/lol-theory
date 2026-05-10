import { useState, useEffect, useMemo, useRef } from "react";
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
  res = res.replace(/<mainText>(.*?)<\/mainText>/gs, '<div class="d-block">$1</div>');
  
  // 6. Final cleanup: normalize breaks and strip remaining tags but keep content
  res = res.replace(/<br\s*\/?>/gi, "<br/>");
  res = res.replace(/<.*?>/gs, (match) => {
    if (/<(div|span|br)/i.test(match) || /<\/(div|span)/i.test(match)) return match;
    return "";
  });

  // 7. Cleanup extra breaks and empty elements
  res = res.replace(/(<br\s*\/?>){2,}/gi, "<br/>"); // No double breaks
  res = res.replace(/<div class="d-block">\s*<br\s*\/?>/gi, '<div class="d-block">'); // No leading break in blocks
  
  // 8. Handle Data Dragon variables (e.g., {{ qdamage }})
  res = res.replace(/\{\{\s*(.*?)\s*\}\}/g, (match, p1) => {
    return `<span class="d-var" title="Missing Data Dragon Variable">? ${p1}</span>`;
  });

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
  { k: "range",      label: "Range",           color: "#94A3B8", max: 800,  fmt: v => Math.round(v), fmtB: v => `+${Math.round(v)}` },
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
  const [equipped,      setEquipped]    = useState(Array(7).fill(null));
  const [shopSearch,    setShopSearch]  = useState("");
  const [shopCat,       setShopCat]     = useState("all");
  const [tooltip,       setTooltip]     = useState(null);
  const [mpos,          setMpos]        = useState({ x: 0, y: 0 });
  const [loading,       setLoading]     = useState(true);
  const [loadErr,       setLoadErr]     = useState(null);
  const [dragging,      setDragging]    = useState(null);
  const [dragOverSlot,  setDragOverSlot]= useState(null);
  const [showPicker,    setShowPicker]  = useState(true);
  const [activeTab,     setActiveTab]   = useState(null);

  // ── Saved Builds (Ticket #5) ───────────────────────────────────────────────
  const [savedBuilds,   setSavedBuilds] = useState(() => {
    const saved = localStorage.getItem("tf_builds");
    const data = saved ? JSON.parse(saved) : [];
    // Ensure always 6 slots
    return Array.from({ length: 6 }, (_, i) => data[i] || null);
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // index of slot to delete

  // ── Global Listeners ────────────────────────────────────────────────────────

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

  useEffect(() => {
    localStorage.setItem("tf_builds", JSON.stringify(savedBuilds));
  }, [savedBuilds]);

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
    const d = await fetch(`https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/${c.id}.json`).then(r => r.json());
    setChampDetail(d);
    setShowPicker(false);
  };

  // ── Stat Calculation ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!champDetail) return null;
    const s = champDetail.stats;
    const n = level - 1;

    const base = {
      hp:          growStat(s.health.flat, s.health.perLevel, level),
      hpregen:     growStat(s.healthRegen.flat, s.healthRegen.perLevel, level),
      mp:          growStat(s.mana.flat, s.mana.perLevel, level),
      mpregen:     growStat(s.manaRegen.flat, s.manaRegen.perLevel, level),
      ad:          growStat(s.attackDamage.flat, s.attackDamage.perLevel, level),
      armor:       growStat(s.armor.flat, s.armor.perLevel, level),
      mr:          growStat(s.magicResistance.flat, s.magicResistance.perLevel, level),
      attackspeed: s.attackSpeed.flat * (1 + (s.attackSpeed.perLevel * n) / 100),
      movespeed:   s.movespeed.flat,
      range:       s.attackRange.flat,
      ap: 0, critchance: 0, lifesteal: 0,
    };

    const bon = { hp:0, hpregen:0, mp:0, mpregen:0, ad:0, ap:0, armor:0, mr:0, attackspeed:0, critchance:0, lifesteal:0, movespeed:0, moveSpeedPct:0, range:0 };

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
      range:       base.range + bon.range,
    };

    return { base, total };
  }, [champDetail, level, equipped]);

  // ── Shop Items ──────────────────────────────────────────────────────────────
  const shopItems = useMemo(() => {
    const filtered = Object.entries(allItems)
      .filter(([id, item]) => {
        if (!item.gold?.purchasable || !item.maps?.["11"]) return false;
        if (!item.gold.total) return false;
        if (item.inStore === false) return false;
        if (shopSearch && !item.name.toLowerCase().includes(shopSearch.toLowerCase())) return false;
        if (shopCat !== "all" && !(item.tags || []).includes(shopCat)) return false;
        return true;
      })
      .map(([id, item]) => ({ ...item, itemId: id }));

    // Deduplicate by name - some items have duplicate entries in Data Dragon
    const unique = [];
    const seen = new Set();
    for (const item of filtered) {
      if (!seen.has(item.name)) {
        seen.add(item.name);
        unique.push(item);
      }
    }

    return unique.sort((a, b) => (a.gold?.total || 0) - (b.gold?.total || 0));
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
    setEquipped(Array(7).fill(null));
  };

  const resetAll = () => {
    setChampDetail(null);
    setEquipped(Array(7).fill(null));
    setLevel(1);
    setShowPicker(true);
    setChampSearch("");
    setShopSearch("");
    setShopCat("all");
  };

  // ── Build Saving Logic (Ticket #5) ──────────────────────────────────────────
  const saveToSlot = (idx) => {
    if (!champDetail) return;
    const newBuilds = [...savedBuilds];
    newBuilds[idx] = {
      champId: champDetail.id,
      champName: champDetail.name,
      level: level,
      itemIds: equipped.map(i => i ? i.itemId : null),
      timestamp: Date.now()
    };
    setSavedBuilds(newBuilds);
    setShowSaveModal(false);
  };

  const loadFromSlot = async (idx) => {
    const b = savedBuilds[idx];
    if (!b) return;
    
    // 1. Pick Champ
    const c = allChamps[b.champId];
    if (c) {
      const d = await fetch(`https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/${c.id}.json`).then(r => r.json());
      setChampDetail(d);
      setShowPicker(false);
    }
    
    // 2. Set Stats
    setLevel(b.level);
    
    // 3. Set Items
    const items = Array(7).fill(null).map((_, i) => {
      const id = b.itemIds?.[i];
      return id ? { ...allItems[id], itemId: id } : null;
    });
    setEquipped(items);
  };

  const deleteSlot = (idx) => {
    const next = [...savedBuilds];
    next[idx] = null;
    setSavedBuilds(next);
    setConfirmDelete(null);
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

  const filteredChamps = Object.values(allChamps)
    .filter(c => c.name.toLowerCase().includes(champSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));


  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content animate-fade">
          <div className="loading-icon">⚔</div>
          <div className="loading-text">FORGING ASSETS</div>
          <div className="loading-sub">Fetching Riot Data Dragon…</div>
        </div>
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="error-screen">
        <div className="error-content animate-slide">
          <div className="error-title">CONNECTION FAILED</div>
          <div className="error-msg">{loadErr}</div>
          <button className="action-btn" onClick={() => window.location.reload()}>RETRY</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`app-container ${activeTab ? "mobile-view" : "desktop-view"}`}
      onMouseMove={e => tooltip && setMpos({ x: e.clientX, y: e.clientY })}
    >
      <Header 
        ver={ver} 
        totalGold={totalGold} 
        champDetail={champDetail} 
        equipped={equipped} 
        resetAll={resetAll} 
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
            />
          ) : (
            <ChampionDetails 
              champDetail={champDetail}
              stats={stats}
              level={level}
              setLevel={setLevel}
              setShowPicker={setShowPicker}
              ver={ver}
              savedBuilds={savedBuilds}
              loadFromSlot={loadFromSlot}
              setConfirmDelete={setConfirmDelete}
            />
          )}
          
          <div className="saved-builds-section">
            <div className="saved-builds-title">Saved Builds</div>
            <div className="saved-builds-grid">
              {savedBuilds.map((b, i) => (
                <div 
                  key={i} 
                  className={`mini-build-slot ${b ? 'active' : ''}`} 
                  onClick={() => b ? loadFromSlot(i) : saveToSlot(i)}
                  title={b ? `Load: ${b.champName}` : "Save current build"}
                >
                  {b ? (
                    <>
                      <img src={`${DDR}/cdn/${ver}/img/champion/${b.champId}.png`} alt={b.champId} className="mini-slot-img" />
                      <div className="mini-slot-rm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(i); }}>✕</div>
                    </>
                  ) : (
                    <div className="mini-slot-empty">＋</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`panel-group ${(activeTab === 'build' || !activeTab) ? 'active' : ''}`}>
          <div className="panel build-panel active">
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
              champDetail={champDetail}
              setShowSaveModal={setShowSaveModal}
            />
          </div>

          <div className="panel shop-panel active">
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
            />
          </div>
        </div>
      </main>

      {activeTab && (
        <nav className="mobile-nav">
          <button id="nav-stats" className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>STATS</button>
          <button id="nav-build" className={activeTab === 'build' ? 'active' : ''} onClick={() => setActiveTab('build')}>BUILD</button>
        </nav>
      )}


      {tooltip && ver && (
        <ItemTooltip 
          item={tooltip} 
          pos={mpos} 
          ver={ver} 
          FMT={ITEM_STAT_FMT} 
          getStatLabel={getStatLabel}
          format={formatDescription} 
        />
      )}

      {showSaveModal && (
        <Modal title="Save Build" onClose={() => setShowSaveModal(false)}>
          <div className="save-modal-list">
            <p className="modal-hint">Select a slot to save your current build.</p>
            {savedBuilds.map((b, i) => (
              <div key={i} className={`save-slot-row ${b ? 'occupied' : ''} ${i === 5 ? 'special-slot-row' : ''}`} onClick={() => saveToSlot(i)}>
                <span className="slot-num">{i + 1}</span>
                <div className="slot-info">
                  {b ? (
                    <>
                      <div className="slot-name">{b.champName}</div>
                      <div className="slot-meta">Level {b.level} • {new Date(b.timestamp).toLocaleDateString()}</div>
                    </>
                  ) : 'EMPTY SLOT'}
                </div>
                <span className="slot-action">{b ? 'OVERWRITE' : 'SAVE'}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {confirmDelete !== null && (
        <Modal title="Confirm Deletion" onClose={() => setConfirmDelete(null)}>
          <div className="delete-confirm">
            <p>Are you sure you want to delete the build in Slot {confirmDelete + 1}?</p>
            <div className="modal-actions">
              <button className="action-btn delete-btn" onClick={() => deleteSlot(confirmDelete)}>Delete</button>
              <button className="action-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Header({ ver, totalGold, champDetail, equipped, resetAll }) {
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

function ChampionPicker({ champSearch, setChampSearch, filteredChamps, pickChamp, ver }) {
  return (
    <div className="champ-picker">
      <div className="panel-title">Select Champion</div>
      <input
        value={champSearch}
        onChange={e => setChampSearch(e.target.value)}
        placeholder="Search champions…"
        className="search-input"
      />
      <div className="champ-grid" onMouseLeave={() => setTooltip(null)}>
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

function ChampionDetails({ champDetail, stats, level, setLevel, setShowPicker, ver, savedBuilds, loadFromSlot, setConfirmDelete }) {
  const formatResource = (res) => {
    if (!res || res === "NONE") return "";
    return res.replace(/_/g, ' ').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
  };

  const renderModifier = (mod, stats) => {
    const unit = mod.units[0] || "";
    const baseStr = mod.values.map(v => Number.isInteger(v) ? v : v.toFixed(1)).join(" / ");

    if (unit === "") return baseStr;
    
    let statVal = 0;
    const uLower = unit.toLowerCase();
    if (uLower.includes("% bonus ad") || uLower.includes("% bonus attack damage")) statVal = (stats?.total?.ad || 0) - (stats?.base?.ad || 0);
    else if (uLower.includes("% ad") || uLower.includes("% attack damage")) statVal = stats?.total?.ad || 0;
    else if (uLower.includes("% ap") || uLower.includes("% ability power")) statVal = stats?.total?.ap || 0;
    else if (uLower.includes("% bonus health")) statVal = (stats?.total?.hp || 0) - (stats?.base?.hp || 0);
    else if (uLower.includes("% health") || uLower.includes("% max health")) statVal = stats?.total?.hp || 0;
    else if (uLower.includes("% armor")) statVal = stats?.total?.armor || 0;
    else if (uLower.includes("% mr") || uLower.includes("% magic resistance")) statVal = stats?.total?.mr || 0;

    if (statVal > 0) {
      const calculated = mod.values.map(v => Math.round(statVal * (v / 100)));
      return (
        <span className="dynamic-scaling">
          {baseStr} {unit}
          <span className="calc-result" title="Dynamically calculated from stats"> (+{calculated.join(" / ")})</span>
        </span>
      );
    }

    return `${baseStr} ${unit}`;
  };

  return (
    <div className="champ-details">
      <div className="champ-header-card">
        <div className="champ-info">
          <div className="champ-avatar-wrapper" onClick={() => setShowPicker(true)} title="Change Champion">
            <img src={`${DDR}/cdn/${ver}/img/champion/${champDetail.key}.png`} alt={champDetail.name} className="champ-avatar" />
            <div className="champ-avatar-overlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
              </svg>
            </div>
          </div>
          <div className="champ-meta">
            <div className="champ-name">{champDetail.name}</div>
            <div className="champ-title">{champDetail.title}</div>
            <div className="champ-tags">
              {champDetail.roles?.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>
        </div>

        <div className="level-control">
          <span className="level-label">LEVEL</span>
          <input
            type="range" min={1} max={18} value={level}
            onChange={e => setLevel(+e.target.value)}
          />
          <div className="level-badge">{level}</div>
        </div>
      </div>

      <div className="stat-bars">
        {stats && STATS.map(cfg => {
          const hasRes = champDetail.resource && champDetail.resource !== "NONE";
          if (cfg.resource && !hasRes) return null;

          const total = stats.total[cfg.k] ?? 0;
          const base  = stats.base[cfg.k]  ?? 0;
          const bonus = total - base;
          if (cfg.itemOnly && bonus < 0.001) return null;

          const resName = formatResource(champDetail.resource);
          const label = cfg.resource 
            ? (cfg.sub ? `${resName} Regen` : resName)
            : cfg.label;

          // Dynamic colors for non-mana resources
          let barColor = cfg.color;
          if (cfg.resource && champDetail.resource !== "MANA") {
            if (champDetail.resource === "ENERGY") {
              barColor = cfg.sub ? "#EAB308" : "#FACC15";
            } else {
              // Fury, Blood Well, Heat, etc.
              barColor = cfg.sub ? "#DC2626" : "#EF4444";
            }
          }

          const barMax  = cfg.max;
          const totalPct  = Math.min(total / barMax, 1) * 100;
          const basePct   = total > 0 ? (base / total) * totalPct : 0;
          const bonusPct  = totalPct - basePct;

          return (
            <div key={cfg.k} className={`stat-row ${cfg.sub ? 'sub' : ''}`}>
              <div className="stat-label">{label}</div>
              <div className="stat-bar-container">
                <div className="stat-bar-fill" style={{ width:`${basePct}%`, background:barColor, opacity:0.75 }} />
                <div className="stat-bar-bonus" style={{ width:`${bonusPct}%`, background:`var(--c-gold)` }} />
              </div>
              <div className="stat-value">
                <span className={bonus > 0.001 ? 'has-bonus' : ''}>{cfg.fmt(total)}</span>
                {bonus > 0.001 && <span className="bonus-val">({cfg.fmtB(bonus)})</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="abilities-section">
        <div className="panel-title">Abilities</div>
        <div className="ability-list">
          {["P", "Q", "W", "E", "R"].map(key => {
            const abilityArray = champDetail.abilities?.[key];
            if (!abilityArray || abilityArray.length === 0) return null;
            const ability = abilityArray[0];
            return (
              <div key={key} className="ability-card">
                <img src={ability.icon} alt={ability.name} className="ability-img" />
                <div className="ability-info">
                  <div className="ability-header">
                    <div className="ability-name">{ability.name}</div>
                    <div className="ability-key">{key === "P" ? "Passive" : key}</div>
                  </div>
                  <div className="ability-desc">
                    {ability.effects.map((eff, i) => (
                      <div key={i} className="ability-effect-block">
                        <div dangerouslySetInnerHTML={{ __html: formatDescription(eff.description) }} />
                        {eff.leveling && eff.leveling.length > 0 && (
                          <div className="ability-scaling">
                            {eff.leveling.map((lvl, j) => (
                              <div key={j} className="scaling-row">
                                <span className="scaling-attr">{lvl.attribute}:</span>
                                {lvl.modifiers.map((mod, k) => (
                                  <span key={k} className="scaling-val">{renderModifier(mod, stats)}</span>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Inventory({ equipped, clearBuild, onSlotDragStart, onSlotDragOver, onSlotDrop, onDragEnd, removeItem, setTooltip, setMpos, dragOverSlot, ver, champDetail, setShowSaveModal }) {
  return (
    <div className="inventory-panel">
      <div className="panel-title inventory-header">
        <div className="title-group">
          <div className="main-title">Item Build</div>
          <div className="subtitle">Drag from shop · click to remove</div>
        </div>
        <div className="header-actions">
          <button className="save-btn" onClick={() => setShowSaveModal(true)} disabled={!champDetail || !equipped.some(Boolean)} title="Save Build">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          </button>
          {equipped.some(Boolean) && (
            <button className="trash-btn" onClick={clearBuild} title="Clear Build">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          )}
        </div>
      </div>

      <div className="inventory-grid" onMouseLeave={() => setTooltip(null)}>
        {equipped.map((item, idx) => (
          <div
            key={idx}
            className={`slot-box ${dragOverSlot === idx ? 'drag-over' : ''} ${item ? 'has-item' : ''} ${idx === 6 ? 'special-item-slot' : ''}`}
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

function Shop({ shopSearch, setShopSearch, shopCat, setShopCat, shopItems, addItem, onShopDragStart, onDragEnd, setTooltip, setMpos, ver }) {
  const [collapsed, setCollapsed] = useState({});

  const toggleGroup = (grp) => {
    setCollapsed(prev => ({ ...prev, [grp]: !prev[grp] }));
  };

  const groupedItems = useMemo(() => {
    const groups = {
      "Basic": [],
      "Epic": [],
      "Legendary": [],
      "Boots": [],
      "Starter": [],
      "Consumable": []
    };

    shopItems.forEach(item => {
      let g = "Legendary";
      if (item.tags?.includes("Consumable")) g = "Consumable";
      else if (item.tags?.includes("Lane") || item.tags?.includes("Jungle")) g = "Starter";
      else if (item.tags?.includes("Boots")) g = "Boots";
      else {
        const depth = item.depth || 1;
        if (depth === 1) g = "Basic";
        else if (depth === 2) g = "Epic";
      }

      if (groups[g]) groups[g].push(item);
      else groups["Legendary"].push(item);
    });

    return groups;
  }, [shopItems]);

  const ORDER = ["Basic", "Epic", "Legendary", "Boots", "Starter", "Consumable"];

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

      <div className="shop-scroll-area" onMouseLeave={() => setTooltip(null)}>
        {ORDER.map(grp => {
          const items = groupedItems[grp];
          if (!items || items.length === 0) return null;

          return (
            <div key={grp} className="shop-group">
              <div className="shop-group-header" onClick={() => toggleGroup(grp)}>
                <div className="shop-group-title">{grp}</div>
                <div className={`shop-group-arrow ${collapsed[grp] ? 'collapsed' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
              {!collapsed[grp] && (
                <div className="shop-grid">
                  {items.map(item => (
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
                </div>
              )}
            </div>
          );
        })}
        {shopItems.length === 0 && <div className="no-results">No items match this filter.</div>}
      </div>
    </div>
  );
}

function Chip({ label, val }) {
  return (
    <div className="info-chip">
      <span className="chip-label">{label}:</span>
      <span className="chip-val">{val}</span>
    </div>
  );
}

function ItemTooltip({ item, pos, ver, FMT, getStatLabel, format }) {
  const [h, setH] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) setH(ref.current.offsetHeight);
  }, [item]);

  const TW = 280;
  const gap = 14;
  
  let left = pos.x + gap;
  if (left + TW > window.innerWidth) left = pos.x - TW - gap;
  if (left < 0) left = 10;

  let top = pos.y - 10;
  if (h > 0 && top + h > window.innerHeight) top = window.innerHeight - h - 10;
  if (top < 10) top = 10;

  const itemStats = item.stats ? Object.entries(item.stats) : [];
  const descHtml = format(item.description || "");

  return (
    <div 
      ref={ref}
      className="tooltip-container animate-fade"
      style={{ left, top }}
    >
      <div className="tooltip-header">
        <img src={`${DDR}/cdn/${ver}/img/item/${item.image.full}`} alt={item.name} className="tooltip-img" />
        <div className="tooltip-meta">
          <div className="tooltip-name">{item.name}</div>
          {item.gold && (
            <div className="tooltip-gold">
               <span className="gold-text">💰 {item.gold.total?.toLocaleString()}g</span>
              {item.gold.sell > 0 && <span className="sell-text">→ sell {item.gold.sell}g</span>}
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
          className="tooltip-desc"
          dangerouslySetInnerHTML={{ __html: descHtml }}
        />
      )}

    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
