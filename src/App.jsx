import { useState, useEffect, useMemo } from "react";

const DDR = "https://ddragon.leagueoflegends.com";

// Riot's official non-linear stat growth formula (introduced Season 11)
const growStat = (base, growth, lvl) => {
  const n = lvl - 1;
  return base + growth * n * (0.7025 + 0.0175 * n);
};

const stripTags = (html = "") =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n").trim();

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
  FlatCritChanceMod:     v => ["Crit Chance",      `+${Math.round(v*100)}%`],
  FlatHPRegenMod:        v => ["HP Regen",         `+${v.toFixed(1)}`],
  FlatMPRegenMod:        v => ["Mana Regen",       `+${v.toFixed(1)}`],
  PercentLifeStealMod:   v => ["Life Steal",       `+${Math.round(v*100)}%`],
  PercentCritDamageMod:  v => ["Bonus Crit Dmg",   `+${Math.round(v*100)}%`],
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
    TD: "#4A5568",   // dim text
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
      style={{ display:"flex", flexDirection:"column", height:"100vh", background:C.BG, fontFamily:C.FF, color:C.GL, overflow:"hidden" }}
      onMouseMove={e => tooltip && setMpos({ x: e.clientX, y: e.clientY })}
    >
      {/* ── Global Styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Rajdhani:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:${C.BG};}
        ::-webkit-scrollbar-thumb{background:${C.GX};border-radius:2px;}
        ::-webkit-scrollbar-thumb:hover{background:${C.G};}
        input{font-family:${C.FF};outline:none;}
        input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:${C.G};border:2px solid ${C.BG};cursor:pointer;}
        .champ-icon:hover{border-color:${C.G}!important;transform:scale(1.06);z-index:2;}
        .champ-icon{transition:all .15s ease;cursor:pointer;}
        .item-cell:hover{border-color:${C.G}!important;transform:scale(1.06);z-index:2;}
        .item-cell{transition:all .15s ease;cursor:pointer;}
        .slot-box{transition:border-color .15s,background .15s;}
        .slot-box:hover .slot-rm{display:flex!important;}
        .cat-btn{transition:all .15s ease;cursor:pointer;}
        .cat-btn:hover{color:${C.GL}!important;background:rgba(200,155,60,.12)!important;}
        .panel-title{font-family:${C.FFT};font-size:12px;color:${C.G};letter-spacing:3px;margin-bottom:10px;text-transform:uppercase;}
        .gold-divider{height:1px;background:linear-gradient(90deg,transparent,${C.GX} 20%,${C.GX} 80%,transparent);}
      `}</style>

      {/* ══ Header ══════════════════════════════════════════════════════════════ */}
      <div style={{ display:"flex", alignItems:"center", gap:14, padding:"8px 18px", borderBottom:`1px solid ${C.GX}`, background:C.P, flexShrink:0 }}>
        <div style={{ fontFamily:C.FFT, fontSize:20, color:C.G, letterSpacing:3, fontWeight:600 }}>
          ⚔ THEORY FORGE
        </div>
        <div style={{ color:C.TD, fontSize:11, letterSpacing:1.5 }}>League of Legends Build Simulator</div>
        {ver && (
          <div style={{ marginLeft:"auto", display:"flex", gap:16, alignItems:"center" }}>
            {champDetail && equipped.some(Boolean) && (
              <span style={{ color:C.G, fontSize:12, fontFamily:C.FFT }}>
                💰 {totalGold.toLocaleString()}g
              </span>
            )}
            <span style={{ color:C.TD, fontSize:11 }}>Patch {ver}</span>
          </div>
        )}
      </div>

      {/* ══ Body ════════════════════════════════════════════════════════════════ */}
      <div style={{ display:"flex", flex:1, overflow:"hidden", gap:"1px", background:C.GX }}>

        {/* ─────── LEFT: CHAMPION ─────────────────────────────────────────── */}
        <div style={{ width:330, display:"flex", flexDirection:"column", background:C.P, flexShrink:0, overflow:"hidden" }}>

          {showPicker ? (
            /* Champion Grid Picker */
            <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden", padding:"14px 12px" }}>
              <div className="panel-title">Select Champion</div>
              <input
                value={champSearch}
                onChange={e => setChampSearch(e.target.value)}
                placeholder="Search champions…"
                style={{ background:C.BD, border:`1px solid ${C.B}`, color:C.GL, padding:"6px 10px", fontSize:13, borderRadius:3, marginBottom:10, flexShrink:0 }}
              />
              <div style={{ flex:1, overflowY:"auto", display:"flex", flexWrap:"wrap", gap:5, alignContent:"flex-start" }}>
                {filteredChamps.map(c => (
                  <div
                    key={c.id}
                    className="champ-icon"
                    onClick={() => pickChamp(c)}
                    title={c.name}
                    style={{ position:"relative" }}
                  >
                    <img
                      src={`${DDR}/cdn/${ver}/img/champion/${c.image.full}`}
                      alt={c.name}
                      style={{ width:46, height:46, display:"block", border:`2px solid ${C.B}`, borderRadius:2 }}
                    />
                  </div>
                ))}
                {filteredChamps.length === 0 && (
                  <div style={{ color:C.TD, fontSize:13, paddingTop:10 }}>No champions found</div>
                )}
              </div>
            </div>

          ) : champDetail ? (
            /* Champion Detail + Stats */
            <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>

              {/* Champion header card */}
              <div style={{ background:C.P2, padding:"12px 14px", borderBottom:`1px solid ${C.GX}`, flexShrink:0 }}>
                <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                  <div style={{ position:"relative", flexShrink:0 }}>
                    <img
                      src={`${DDR}/cdn/${ver}/img/champion/${champDetail.image.full}`}
                      alt={champDetail.name}
                      style={{ width:64, height:64, border:`2px solid ${C.G}`, borderRadius:2, display:"block" }}
                    />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:C.FFT, fontSize:18, color:C.G, letterSpacing:1, lineHeight:1.1 }}>{champDetail.name}</div>
                    <div style={{ color:C.TD, fontSize:11, marginTop:3, fontStyle:"italic" }}>{champDetail.title}</div>
                    <div style={{ display:"flex", gap:6, marginTop:5, flexWrap:"wrap" }}>
                      {champDetail.tags?.map(t => (
                        <span key={t} style={{ background:C.BD, border:`1px solid ${C.B}`, color:C.T, fontSize:10, padding:"2px 6px", borderRadius:2 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPicker(true)}
                    style={{ background:"none", border:`1px solid ${C.GX}`, color:C.T, cursor:"pointer", padding:"4px 8px", fontSize:10, fontFamily:C.FFT, borderRadius:2, letterSpacing:1, flexShrink:0 }}
                  >
                    CHANGE
                  </button>
                </div>

                {/* Level Control */}
                <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ color:C.TD, fontSize:11, letterSpacing:1.5, flexShrink:0 }}>LEVEL</span>
                  <input
                    type="range" min={1} max={18} value={level}
                    onChange={e => setLevel(+e.target.value)}
                    style={{ flex:1, background:`linear-gradient(to right,${C.G} ${((level-1)/17)*100}%,${C.BD} ${((level-1)/17)*100}%)` }}
                  />
                  <div style={{ background:C.G, color:C.BG, fontFamily:C.FFT, fontWeight:700, fontSize:15, width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {level}
                  </div>
                </div>
              </div>

              {/* Stat bars */}
              <div style={{ flex:1, overflowY:"auto", padding:"10px 14px" }}>
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
                    <div key={cfg.k} style={{ marginBottom: cfg.sub ? 3 : 8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        {/* Label */}
                        <span style={{ color:C.TD, fontSize:cfg.sub?10:12, width:102, flexShrink:0, paddingLeft:cfg.sub?10:0, letterSpacing:0.5 }}>
                          {cfg.label}
                        </span>
                        {/* Bar */}
                        <div style={{ flex:1, height:cfg.sub?3:5, background:C.BD, borderRadius:2, overflow:"hidden" }}>
                          <div style={{ display:"flex", height:"100%", transition:"width 0.35s" }}>
                            <div style={{ width:`${basePct}%`, background:cfg.color, opacity:0.75, transition:"width .35s" }} />
                            <div style={{ width:`${bonusPct}%`, background:C.G, transition:"width .35s" }} />
                          </div>
                        </div>
                        {/* Value */}
                        <div style={{ minWidth:80, textAlign:"right", flexShrink:0 }}>
                          <span style={{ color:bonus>0.001?C.GL:C.T, fontSize:cfg.sub?11:13, fontWeight:bonus>0.001?600:400 }}>
                            {cfg.fmt(total)}
                          </span>
                          {bonus > 0.001 && (
                            <span style={{ color:C.G, fontSize:9, marginLeft:4, opacity:0.9 }}>
                              ({cfg.fmtB(bonus)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Footer info */}
                <div className="gold-divider" style={{ margin:"12px 0" }} />
                <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
                  <Chip label="Resource" val={champDetail.partype} C={C} />
                  <Chip label="Range"    val={champDetail.stats.attackrange} C={C} />
                  <Chip label="Movespeed" val={champDetail.stats.movespeed} C={C} />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* ─────── RIGHT: BUILD ────────────────────────────────────────────── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.P, overflow:"hidden" }}>

          {/* ── Inventory ── */}
          <div style={{ padding:"12px 14px 10px", borderBottom:`1px solid ${C.GX}`, flexShrink:0 }}>
            <div className="panel-title" style={{ marginBottom:8 }}>
              Item Build
              <span style={{ marginLeft:10, color:C.TD, fontSize:10, fontFamily:C.FF, letterSpacing:0.5, textTransform:"none" }}>
                Drag from shop · click to remove
              </span>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8 }}>
              {equipped.map((item, idx) => (
                <div
                  key={idx}
                  className="slot-box"
                  draggable={!!item}
                  onDragStart={e => onSlotDragStart(e, idx)}
                  onDragOver={e => onSlotDragOver(e, idx)}
                  onDrop={e => onSlotDrop(e, idx)}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDragEnd={onDragEnd}
                  onClick={() => item && removeItem(idx)}
                  onMouseEnter={item ? (e => { setTooltip(item); setMpos({ x:e.clientX, y:e.clientY }); }) : undefined}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    position:"relative", paddingTop:"100%",
                    background: dragOverSlot===idx ? "rgba(200,155,60,.18)" : (item ? C.BD : "#040D18"),
                    border:`2px solid ${dragOverSlot===idx ? C.G : (item ? C.GX : C.B)}`,
                    borderRadius:3, cursor:item?"pointer":"default",
                  }}
                >
                  {item ? (
                    <>
                      <img
                        src={`${DDR}/cdn/${ver}/img/item/${item.image.full}`}
                        alt={item.name}
                        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", borderRadius:2 }}
                      />
                      <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(0,0,0,.78)", color:C.G, fontSize:9, textAlign:"center", padding:"1px 0", fontFamily:C.FFT, letterSpacing:0.5 }}>
                        {item.gold?.total?.toLocaleString()}g
                      </div>
                      <div className="slot-rm" style={{ display:"none", position:"absolute", inset:0, background:"rgba(180,20,20,.65)", alignItems:"center", justifyContent:"center", fontSize:20, color:"#fff", borderRadius:2, fontWeight:700 }}>
                        ✕
                      </div>
                    </>
                  ) : (
                    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:C.B, fontSize:20, letterSpacing:0 }}>
                      ＋
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Shop ── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", padding:"10px 14px" }}>
            <div className="panel-title">Shop</div>

            {/* Search */}
            <input
              value={shopSearch}
              onChange={e => setShopSearch(e.target.value)}
              placeholder="Search items…"
              style={{ background:C.BD, border:`1px solid ${C.B}`, color:C.GL, padding:"6px 10px", fontSize:13, borderRadius:3, marginBottom:8, flexShrink:0 }}
            />

            {/* Category tabs */}
            <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10, flexShrink:0 }}>
              {SHOP_CATS.map(cat => (
                <button
                  key={cat.id}
                  className="cat-btn"
                  onClick={() => setShopCat(cat.id)}
                  style={{
                    background: shopCat===cat.id ? "rgba(200,155,60,.18)" : "transparent",
                    border:`1px solid ${shopCat===cat.id ? C.G : C.B}`,
                    color: shopCat===cat.id ? C.G : C.TD,
                    padding:"3px 9px", fontSize:11, fontFamily:C.FF, borderRadius:2,
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Item grid */}
            <div style={{ flex:1, overflowY:"auto" }}>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, alignContent:"flex-start" }}>
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
                    style={{ position:"relative", width:52, height:52, border:`2px solid ${C.GX}`, borderRadius:3, overflow:"hidden", flexShrink:0 }}
                  >
                    <img
                      src={`${DDR}/cdn/${ver}/img/item/${item.image.full}`}
                      alt={item.name}
                      style={{ width:"100%", height:"100%", display:"block" }}
                    />
                    <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(0,0,0,.8)", color:C.G, fontSize:8, textAlign:"center", fontFamily:C.FFT, letterSpacing:0.3 }}>
                      {item.gold?.total?.toLocaleString()}g
                    </div>
                  </div>
                ))}
                {shopItems.length === 0 && (
                  <div style={{ color:C.TD, fontSize:13, padding:"20px 0" }}>No items match this filter.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ Item Tooltip ════════════════════════════════════════════════════════ */}
      {tooltip && ver && <ItemTooltip item={tooltip} pos={mpos} ver={ver} C={C} FMT={ITEM_STAT_FMT} strip={stripTags} />}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Chip({ label, val, C }) {
  return (
    <div style={{ display:"flex", gap:5, fontSize:11 }}>
      <span style={{ color:C.TD }}>{label}:</span>
      <span style={{ color:C.T }}>{val}</span>
    </div>
  );
}

function ItemTooltip({ item, pos, ver, C, FMT, strip }) {
  const WIN_W = typeof window !== "undefined" ? window.innerWidth : 1200;
  const WIN_H = typeof window !== "undefined" ? window.innerHeight : 800;
  const TW = 270, TH_EST = 380;
  const left = pos.x + 14 + TW > WIN_W ? pos.x - TW - 8 : pos.x + 14;
  const top  = pos.y - 10 + TH_EST > WIN_H ? WIN_H - TH_EST - 10 : Math.max(10, pos.y - 10);

  const itemStats = item.stats ? Object.entries(item.stats).filter(([k]) => FMT[k]) : [];
  const desc = strip(item.description || "");

  return (
    <div style={{
      position:"fixed", left, top, width:TW,
      background:"#0A1824", border:`1px solid ${C.G}`,
      borderRadius:4, padding:"12px", zIndex:9999,
      pointerEvents:"none", boxShadow:"0 6px 30px rgba(0,0,0,.9)",
    }}>
      {/* Header */}
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:8, paddingBottom:8, borderBottom:`1px solid ${C.GX}` }}>
        <img
          src={`${DDR}/cdn/${ver}/img/item/${item.image.full}`}
          alt={item.name}
          style={{ width:42, height:42, border:`2px solid ${C.G}`, borderRadius:2, flexShrink:0 }}
        />
        <div>
          <div style={{ fontFamily:`'Cinzel',Georgia,serif`, color:C.G, fontSize:13, lineHeight:1.2, fontWeight:600 }}>{item.name}</div>
          {item.gold && (
            <div style={{ marginTop:4, display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ color:C.G, fontSize:12 }}>💰 {item.gold.total?.toLocaleString()}g</span>
              {item.gold.sell > 0 && <span style={{ color:C.TD, fontSize:10 }}>→ sell {item.gold.sell}g</span>}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {itemStats.length > 0 && (
        <div style={{ marginBottom:8, paddingBottom:8, borderBottom:`1px solid ${C.GX}` }}>
          {itemStats.map(([key, val]) => {
            const [label, fval] = FMT[key](val);
            return (
              <div key={key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, marginBottom:3 }}>
                <span style={{ color:C.T }}>{label}</span>
                <span style={{ color:"#A8FF78", fontWeight:600 }}>{fval}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Description */}
      {desc && (
        <div style={{ color:C.TD, fontSize:11, lineHeight:1.55, maxHeight:140, overflowY:"hidden" }}>
          {desc.length > 320 ? desc.substring(0, 320) + "…" : desc}
        </div>
      )}

      {/* Tags */}
      {item.tags?.length > 0 && (
        <div style={{ marginTop:8, display:"flex", gap:4, flexWrap:"wrap" }}>
          {item.tags.map(t => (
            <span key={t} style={{ background:C.BD, border:`1px solid ${C.B}`, color:C.TD, fontSize:9, padding:"2px 5px", borderRadius:2 }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
