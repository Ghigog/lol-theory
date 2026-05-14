import { useState, useEffect, useMemo, useRef } from "react";
import ProgressiveFlowchart from "./components/ProgressiveFlowchart";
import { generateFlowchartFromEquipped, validateFlowchart } from "./flowchartUtils";
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
  { k: "abilityhaste",label: "Ability Haste",  color: "#38BDF8", max: 150,  fmt: v => Math.round(v), fmtB: v => `+${Math.round(v)}` },
  { k: "lethality",  label: "Lethality",       color: "#F472B6", max: 100,  fmt: v => Math.round(v), fmtB: v => `+${Math.round(v)}`, itemOnly: true },
  { k: "armorpen",   label: "Armor Pen",       color: "#FB923C", max: 1.0,  fmt: v => Math.round(v*100)+"%", fmtB: v => `+${Math.round(v*100)}%`, itemOnly: true },
  { k: "magpenflat", label: "Magic Pen",       color: "#A78BFA", max: 80,   fmt: v => Math.round(v), fmtB: v => `+${Math.round(v)}`, itemOnly: true },
  { k: "magpenpct",  label: "Magic Pen %",     color: "#C084FC", max: 1.0,  fmt: v => Math.round(v*100)+"%", fmtB: v => `+${Math.round(v*100)}%`, itemOnly: true },
  { k: "critchance", label: "Crit Chance",     color: "#EF4444", max: 1.0,  fmt: v => Math.round(v*100)+"%", fmtB: v => `+${Math.round(v*100)}%` },
  { k: "tenacity",   label: "Tenacity",        color: "#F87171", max: 1.0,  fmt: v => Math.round(v*100)+"%", fmtB: v => `+${Math.round(v*100)}%` },
  { k: "lifesteal",  label: "Life Steal",      color: "#10B981", max: 1.0,  fmt: v => Math.round(v*100)+"%", fmtB: v => `+${Math.round(v*100)}%`, itemOnly: true },
  { k: "omnivamp",   label: "Omnivamp",        color: "#EF4444", max: 1.0,  fmt: v => Math.round(v*100)+"%", fmtB: v => `+${Math.round(v*100)}%`, itemOnly: true },
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

const STAT_SHARDS = {
  row1: [
    { id: "r1_ad", label: "+9 Adaptive Force", stat: "adaptive", val: 9, icon: "StatMods/StatModsAdaptiveForceIcon.png" },
    { id: "r1_as", label: "+10% Attack Speed", stat: "attackspeed", val: 0.10, icon: "StatMods/StatModsAttackSpeedIcon.png" },
    { id: "r1_ah", label: "+8 Ability Haste", stat: "abilityhaste", val: 8, icon: "StatMods/StatModsCDRScalingIcon.png" }
  ],
  row2: [
    { id: "r2_ad", label: "+9 Adaptive Force", stat: "adaptive", val: 9, icon: "StatMods/StatModsAdaptiveForceIcon.png" },
    { id: "r2_ms", label: "+2% Move Speed", stat: "movespeed_pct", val: 0.02, icon: "StatMods/StatModsMovementSpeedIcon.png" },
    { id: "r2_hp", label: "+10-180 Scaling Health", stat: "health_scaling", val: [10, 180], icon: "StatMods/StatModsHealthScalingIcon.png" }
  ],
  row3: [
    { id: "r3_hp", label: "+65 Flat Health", stat: "health", val: 65, icon: "StatMods/StatModsHealthPlusIcon.png" },
    { id: "r3_tn", label: "+10% Tenacity", stat: "tenacity", val: 0.10, icon: "StatMods/StatModsTenacityIcon.png" },
    { id: "r3_hs", label: "+10-180 Scaling Health", stat: "health_scaling", val: [10, 180], icon: "StatMods/StatModsHealthScalingIcon.png" }
  ]
};

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
  const [allRunes,      setAllRunes]    = useState([]);
  const [champSearch,   setChampSearch] = useState("");
  const [champDetail,   setChampDetail] = useState(null);
  const [champAbilities,setChampAbilities] = useState(null); // async-loaded from Meraki
  const [allItems,      setAllItems]    = useState({});
  const [level,         setLevel]       = useState(13);
  const [equipped,      setEquipped]    = useState(Array(7).fill(null));
  const [selectedRunes, setSelectedRunes] = useState({
    primary: null, secondary: null,
    keystone: null, p1: null, p2: null, p3: null,
    s1: null, s2: null,
    shard1: "r1_ad", shard2: "r2_ad", shard3: "r3_hp"
  });
  const [showRuneModal, setShowRuneModal] = useState(false);
  const [shopSearch,    setShopSearch]  = useState("");
  const [shopCat,       setShopCat]     = useState("all");
  const [tooltip,       setTooltip]     = useState(null);
  const [tooltipAnchor, setTooltipAnchor] = useState(null); // DOM ref for click-outside
  const [mpos,          setMpos]        = useState({ x: 0, y: 0 });
  const [loading,       setLoading]     = useState(true);
  const [loadErr,       setLoadErr]     = useState(null);
  const [dragging,      setDragging]    = useState(null);
  const [dragOverSlot,  setDragOverSlot]= useState(null);
  const [showPicker,    setShowPicker]  = useState(true);
  const [activeTab,     setActiveTab]   = useState(null);
  
  // ── Flowchart (Ticket #6) ───────────────────────────────────────────────────
  const [showFlowchart, setShowFlowchart] = useState(false);
  const [flowchartData, setFlowchartData] = useState({ nodes: {}, stages: [] });

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

  // ── Click-outside to dismiss tooltip ────────────────────────────────────────
  useEffect(() => {
    if (!tooltip) return;
    const handler = (e) => {
      if (tooltipAnchor && tooltipAnchor.contains(e.target)) return;
      setTooltip(null);
      setTooltipAnchor(null);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [tooltip, tooltipAnchor]);

  // ── Fetch Data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [v] = await fetch(`${DDR}/api/versions.json`).then(r => r.json());
        setVer(v);
        const [cd, id, runes] = await Promise.all([
          fetch(`${DDR}/cdn/${v}/data/en_US/champion.json`).then(r => r.json()),
          fetch(`${DDR}/cdn/${v}/data/en_US/item.json`).then(r => r.json()),
          fetch(`${DDR}/cdn/${v}/data/en_US/runesReforged.json`).then(r => r.json()),
        ]);
        setAllChamps(cd.data);
        setAllItems(id.data);
        setAllRunes(runes);
      } catch (e) {
        setLoadErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Async-load Meraki abilities (non-blocking) ───────────────────────────────
  const loadMerakiAbilities = (champId) => {
    setChampAbilities(null);
    const targetUrl = `https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/${champId}.json`;
    // Route through a reliable CORS proxy as Meraki CDN may block direct browser requests
    fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.abilities) setChampAbilities(d.abilities); })
      .catch((e) => { console.error("Failed to fetch Meraki abilities:", e); });
  };

  // ── Champion Pick (DDragon = fast; Meraki abilities = async background) ──────
  const pickChamp = async (c) => {
    if (!ver) return;
    try {
      const d = await fetch(`${DDR}/cdn/${ver}/data/en_US/champion/${c.id}.json`).then(r => r.json());
      setChampDetail(d.data[c.id]);
      setShowPicker(false);
      loadMerakiAbilities(c.id);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch champion data.");
    }
  };

  // ── Stat Calculation ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!champDetail) return null;
    const s = champDetail.stats;
    // DDragon schema uses flat keys (e.g. s.hp, s.armor)
    // Meraki schema uses nested objects (s.health.flat) — detect which we have
    const isM = s && typeof s.hp === 'undefined';
    const n = level - 1;

    const g = (flat, perLvl) => growStat(flat ?? 0, perLvl ?? 0, level);
    const base = isM ? {
      // Meraki nested schema
      hp:          g(s?.health?.flat, s?.health?.perLevel),
      hpregen:     g(s?.healthRegen?.flat, s?.healthRegen?.perLevel),
      mp:          g(s?.mana?.flat, s?.mana?.perLevel),
      mpregen:     g(s?.manaRegen?.flat, s?.manaRegen?.perLevel),
      ad:          g(s?.attackDamage?.flat, s?.attackDamage?.perLevel),
      armor:       g(s?.armor?.flat, s?.armor?.perLevel),
      mr:          g(s?.magicResistance?.flat, s?.magicResistance?.perLevel),
      attackspeed: (s?.attackSpeed?.flat ?? 0.625) * (1 + ((s?.attackSpeed?.perLevel ?? 0) * n) / 100),
      movespeed:   s?.movespeed?.flat ?? 330,
      range:       s?.attackRange?.flat ?? 125,
      ap: 0, critchance: 0, lifesteal: 0,
    } : {
      // DDragon flat schema
      hp:          g(s?.hp, s?.hpperlevel),
      hpregen:     g(s?.hpregen, s?.hpregenperlevel),
      mp:          g(s?.mp, s?.mpperlevel),
      mpregen:     g(s?.mpregen, s?.mpregenperlevel),
      ad:          g(s?.attackdamage, s?.attackdamageperlevel),
      armor:       g(s?.armor, s?.armorperlevel),
      mr:          g(s?.spellblock, s?.spellblockperlevel),
      attackspeed: (s?.attackspeed ?? 0.625) * (1 + ((s?.attackspeedperlevel ?? 0) * n) / 100),
      movespeed:   s?.movespeed ?? 330,
      range:       s?.attackrange ?? 125,
      ap: 0, critchance: 0, lifesteal: 0,
    };

    const bon = { hp:0, hpregen:0, mp:0, mpregen:0, ad:0, ap:0, armor:0, mr:0, attackspeed:0, critchance:0, lifesteal:0, movespeed:0, moveSpeedPct:0, range:0, abilityhaste:0, tenacity:0, lethality:0, armorpen:0, magpenflat:0, magpenpct:0, omnivamp:0 };
    const rBon = { hp:0, hpregen:0, mp:0, mpregen:0, ad:0, ap:0, armor:0, mr:0, attackspeed:0, critchance:0, lifesteal:0, movespeed:0, moveSpeedPct:0, range:0, adaptive:0, abilityhaste:0, tenacity:0, lethality:0, armorpen:0, magpenflat:0, magpenpct:0, omnivamp:0 };

    const addShard = (shardId, rowKey) => {
      if (!shardId) return;
      const shardDef = STAT_SHARDS[rowKey].find(s => s.id === shardId);
      if (shardDef) {
        if (Array.isArray(shardDef.val)) {
          const [min, max] = shardDef.val;
          const val = min + ((max - min) / 17) * (level - 1);
          if (shardDef.stat === "health_scaling") rBon.hp += val;
        } else {
          rBon[shardDef.stat] = (rBon[shardDef.stat] || 0) + shardDef.val;
        }
      }
    };
    addShard(selectedRunes.shard1, 'row1');
    addShard(selectedRunes.shard2, 'row2');
    addShard(selectedRunes.shard3, 'row3');

    // Basic Keystone Logic for Conqueror (Full Stacks Adaptive Force)
    if (selectedRunes.keystone === 8010) { // Conqueror ID is 8010
      const conqAF = 14.4 + ((32.4 - 14.4) / 17) * (level - 1);
      rBon.adaptive += conqAF;
    }

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
      if (st.PercentAttackSpeedMod) bon.attackspeed += st.PercentAttackSpeedMod;
      if (st.FlatCritChanceMod)     bon.critchance += st.FlatCritChanceMod;
      if (st.PercentLifeStealMod)   bon.lifesteal  += st.PercentLifeStealMod;
      if (st.FlatAbilityHasteMod)   bon.abilityhaste += st.FlatAbilityHasteMod;
      if (st.PercentTenacityMod)    bon.tenacity     += st.PercentTenacityMod;
      if (st.FlatLethalityMod)      bon.lethality    += st.FlatLethalityMod;
      if (st.PercentArmorPenetrationMod) bon.armorpen += st.PercentArmorPenetrationMod;
      if (st.FlatMagicPenetrationMod) bon.magpenflat += st.FlatMagicPenetrationMod;
      if (st.PercentMagicPenetrationMod) bon.magpenpct += st.PercentMagicPenetrationMod;
      if (st.PercentOmnivampMod)    bon.omnivamp     += st.PercentOmnivampMod;
    });

    // Adaptive Force resolution
    // 1 Adaptive Force = 0.6 AD or 1 AP. If bonus AD >= bonus AP, it becomes AD.
    if (rBon.adaptive > 0) {
      if (bon.ad >= bon.ap) {
        rBon.ad += rBon.adaptive * 0.6;
      } else {
        rBon.ap += rBon.adaptive;
      }
    }

    const total = {
      hp:          base.hp + bon.hp + rBon.hp,
      hpregen:     base.hpregen + bon.hpregen + rBon.hpregen,
      mp:          base.mp + bon.mp + rBon.mp,
      mpregen:     base.mpregen + bon.mpregen + rBon.mpregen,
      ad:          base.ad + bon.ad + rBon.ad,
      ap:          bon.ap + rBon.ap,
      armor:       base.armor + bon.armor + rBon.armor,
      mr:          base.mr + bon.mr + rBon.mr,
      attackspeed: base.attackspeed * (1 + bon.attackspeed + rBon.attackspeed),
      critchance:  bon.critchance + rBon.critchance,
      lifesteal:   bon.lifesteal + rBon.lifesteal,
      movespeed:   (base.movespeed + bon.movespeed + rBon.movespeed) * (1 + bon.moveSpeedPct + rBon.moveSpeedPct),
      range:       base.range + bon.range + rBon.range,
      abilityhaste: bon.abilityhaste + rBon.abilityhaste,
      tenacity:     bon.tenacity + rBon.tenacity,
      lethality:    bon.lethality + rBon.lethality,
      armorpen:     bon.armorpen + rBon.armorpen,
      magpenflat:   bon.magpenflat + rBon.magpenflat,
      magpenpct:    bon.magpenpct + rBon.magpenpct,
      omnivamp:     bon.omnivamp + rBon.omnivamp,
    };

    const rBonDisplay = {};
    const totalWithoutRunes = {
      hp:           base.hp + bon.hp,
      hpregen:      base.hpregen + bon.hpregen,
      mp:           base.mp + bon.mp,
      mpregen:      base.mpregen + bon.mpregen,
      ad:           base.ad + bon.ad,
      ap:           bon.ap,
      armor:        base.armor + bon.armor,
      mr:           base.mr + bon.mr,
      attackspeed:  base.attackspeed * (1 + bon.attackspeed),
      critchance:   bon.critchance,
      lifesteal:    bon.lifesteal,
      movespeed:    (base.movespeed + bon.movespeed) * (1 + bon.moveSpeedPct),
      range:        base.range,
      abilityhaste: bon.abilityhaste,
      tenacity:     bon.tenacity,
      lethality:    bon.lethality,
      armorpen:     bon.armorpen,
      magpenflat:   bon.magpenflat,
      magpenpct:    bon.magpenpct,
      omnivamp:     bon.omnivamp,
    };
    Object.keys(total).forEach(k => {
      rBonDisplay[k] = total[k] - (totalWithoutRunes[k] || 0);
    });

    return { base, total, rBon: rBonDisplay };
  }, [champDetail, level, equipped, selectedRunes]);

  // ── Shop Items ──────────────────────────────────────────────────────────────
  const shopItems = useMemo(() => {
    const filtered = Object.entries(allItems)
      .filter(([id, item]) => {
        if (!item.gold?.purchasable || !item.maps?.["11"]) return false;
        if (!item.gold.total) return false;
        if (item.inStore === false) return false;
        if (shopSearch) {
          const q = shopSearch.toLowerCase();
          const nameMatch = item.name.toLowerCase().includes(q);
          const descMatch = (item.description || "").toLowerCase().replace(/<[^>]*>?/gm, '').includes(q);
          if (!nameMatch && !descMatch) return false;
        }
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
    setTooltip(null);
    const idx = equipped.findIndex(e => !e);
    if (idx < 0) return;
    const next = [...equipped];
    next[idx] = item;
    setEquipped(next);
    setFlowchartData({ nodes: {}, stages: [] });
  };

  const removeItem = (idx) => {
    const next = [...equipped];
    next[idx] = null;
    setEquipped(next);
    setFlowchartData({ nodes: {}, stages: [] });
  };

  const clearBuild = () => {
    setEquipped(Array(7).fill(null));
    setFlowchartData({ nodes: {}, stages: [] });
  };

  const resetAll = () => {
    setChampDetail(null);
    setEquipped(Array(7).fill(null));
    setLevel(1);
    setShowPicker(true);
    setChampSearch("");
    setShopSearch("");
    setShopCat("all");
    setFlowchartData({ nodes: {}, stages: [] });
  };

  const saveToSlot = (idx) => {
    if (!champDetail) return;
    
    // Validate flowchart if it has data
    if (showFlowchart || flowchartData.stages.length > 0) {
      const equippedIds = equipped.map(i => i ? i.itemId : null);
      const missing = validateFlowchart(flowchartData, equippedIds, allItems);
      if (missing.length > 0) {
        alert(`Cannot save build! The flowchart is missing required components for: ${missing.join(', ')}`);
        return;
      }
    }

    const newBuilds = [...savedBuilds];
    // Use DDragon string id (champDetail.id is e.g. "Garen")
    newBuilds[idx] = {
      champId: champDetail.id,
      champName: champDetail.name,
      level: level,
      itemIds: equipped.map(i => i ? i.itemId : null),
      runes: selectedRunes,
      flowchartData: flowchartData,
      timestamp: Date.now()
    };
    setSavedBuilds(newBuilds);
    setShowSaveModal(false);
  };

  const loadFromSlot = async (idx) => {
    const b = savedBuilds[idx];
    if (!b) return;
    
    // 1. Pick Champ (resilient lookup handles both Name ID and Numeric Key)
    let c = allChamps[b.champId];
    if (!c) {
      c = Object.values(allChamps).find(ch => ch.id === b.champId || ch.key === b.champId);
    }
    if (c) {
      try {
        const d = await fetch(`${DDR}/cdn/${ver}/data/en_US/champion/${c.id}.json`).then(r => r.json());
        setChampDetail(d.data[c.id]);
        setShowPicker(false);
        loadMerakiAbilities(c.id);
      } catch (e) {
        console.error("Failed to load champion", e);
      }
    }
    
    // 2. Set Stats
    setLevel(b.level);
    
    // 3. Set Items
    const items = Array(7).fill(null).map((_, i) => {
      const id = b.itemIds?.[i];
      return id ? { ...allItems[id], itemId: id } : null;
    });
    setEquipped(items);
    
    // 4. Set Runes
    if (b.runes) {
      setSelectedRunes(b.runes);
    } else {
      setSelectedRunes({
        primary: null, secondary: null,
        keystone: null, p1: null, p2: null, p3: null,
        s1: null, s2: null,
        shard1: "r1_ad", shard2: "r2_ad", shard3: "r3_hp"
      });
    }

    // 5. Set Flowchart
    if (b.flowchartData) {
      setFlowchartData(b.flowchartData);
    } else {
      setFlowchartData({ nodes: {}, stages: [] });
    }
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
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'shop-item', itemId: item.itemId }));
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
    let changed = false;
    if (dragging.src === "shop") {
      next[idx] = dragging.item;
      changed = true;
    } else if (typeof dragging.src === "number") {
      if (next[idx] !== next[dragging.src]) {
        [next[idx], next[dragging.src]] = [next[dragging.src], next[idx]];
        changed = true;
      }
    }
    setEquipped(next);
    if (changed) setFlowchartData({ nodes: {}, stages: [] });
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
              champAbilities={champAbilities}
              stats={stats}
              level={level}
              setLevel={setLevel}
              setShowPicker={setShowPicker}
              ver={ver}
              savedBuilds={savedBuilds}
              loadFromSlot={loadFromSlot}
              setConfirmDelete={setConfirmDelete}
              setShowRuneModal={setShowRuneModal}
              selectedRunes={selectedRunes}
              allRunes={allRunes}
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
                      {(() => {
                        const c = Object.values(allChamps).find(ch => ch.id === b.champId || ch.key === b.champId);
                        const imgId = c ? c.id : b.champId;
                        return <img src={`${DDR}/cdn/${ver}/img/champion/${imgId}.png`} alt={b.champName} className="mini-slot-img" />;
                      })()}
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
              setTooltipAnchor={setTooltipAnchor}
              setMpos={setMpos}
              tooltip={tooltip}
              dragOverSlot={dragOverSlot}
              ver={ver}
              champDetail={champDetail}
              setShowSaveModal={setShowSaveModal}
              showFlowchart={showFlowchart}
              setShowFlowchart={(val) => {
                if (val && flowchartData.stages.length === 0) {
                  const equippedIds = equipped.map(i => i ? i.itemId : null);
                  setFlowchartData(generateFlowchartFromEquipped(equippedIds, allItems));
                }
                setShowFlowchart(val);
              }}
            />
            {showFlowchart && (
              <ProgressiveFlowchart 
                flowchartData={flowchartData}
                setFlowchartData={setFlowchartData}
                allItems={allItems}
                ver={ver}
                setTooltip={setTooltip}
                setTooltipAnchor={setTooltipAnchor}
                setMpos={setMpos}
                tooltip={tooltip}
                onDragEnd={onDragEnd}
                dragging={dragging}
              />
            )}
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
              setTooltipAnchor={setTooltipAnchor}
              setMpos={setMpos}
              tooltip={tooltip}
              ver={ver}
            />
          </div>
        </div>
      </main>

      {activeTab && (
        <nav className="mobile-nav">
          <button id="nav-stats" className={activeTab === 'stats' ? 'active' : ''} onClick={() => { setActiveTab('stats'); setTooltip(null); }}>STATS</button>
          <button id="nav-build" className={activeTab === 'build' ? 'active' : ''} onClick={() => { setActiveTab('build'); setTooltip(null); }}>BUILD</button>
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

      {showRuneModal && (
        <RuneModal
          allRunes={allRunes}
          selectedRunes={selectedRunes}
          setSelectedRunes={setSelectedRunes}
          onClose={() => setShowRuneModal(false)}
          ver={ver}
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

// Renders a single modifier chip inline (e.g. "30 / 60 / 90 + 50% AD (+35)")
function renderModifier(mod, stats, champLevel = 1, abilityKey = 'Q') {
  if (!mod) return null;
  const unit = (mod.units || [])[0] || "";
  const vals = mod.values || [];

  let rankIdx = 0;
  if (vals.length > 1) {
    if (abilityKey === 'R') {
      if (champLevel < 11) rankIdx = 0;
      else if (champLevel < 16) rankIdx = 1;
      else rankIdx = 2;
      rankIdx = Math.min(rankIdx, vals.length - 1);
    } else {
      rankIdx = Math.min(vals.length - 1, Math.max(0, Math.ceil(champLevel / 2) - 1));
    }
  }

  const v = vals[rankIdx] !== undefined ? vals[rankIdx] : vals[0];
  const baseStr = typeof v === 'number' ? (Number.isInteger(v) ? v : +v.toFixed(1)) : v;

  if (unit === "") return baseStr;

  let statVal = 0;
  const u = unit.toLowerCase();
  if (u.includes("% bonus ad"))          statVal = (stats?.total?.ad||0) - (stats?.base?.ad||0);
  else if (u.includes("% ad"))           statVal = stats?.total?.ad || 0;
  else if (u.includes("% ap") || u.includes("% ability power")) statVal = stats?.total?.ap || 0;
  else if (u.includes("% bonus health")) statVal = (stats?.total?.hp||0) - (stats?.base?.hp||0);
  else if (u.includes("% health") || u.includes("% max health")) statVal = stats?.total?.hp || 0;
  else if (u.includes("% armor"))        statVal = stats?.total?.armor || 0;
  else if (u.includes("% mr") || u.includes("% magic resistance")) statVal = stats?.total?.mr || 0;

  if (statVal > 0) {
    const calcVal = typeof v === 'number' ? Math.round(statVal * (v / 100)) : 0;
    return (
      <span className="dynamic-scaling">
        {baseStr} {unit}
        <span className="calc-result"> (+{calcVal})</span>
      </span>
    );
  }
  return `${baseStr} ${unit}`;
}

// Compact ability row — shows icon + key + name + scaling chips by default.
// Full description is revealed on hover (desktop) or tap (mobile).
function AbilityRow({ abilityKey, name, iconSrc, effects, stats, champLevel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Collect only leveling entries that have dynamic modifiers
  const scalings = (effects || []).flatMap(eff =>
    (eff.leveling || []).map(lvl => ({ attr: lvl.attribute, mods: lvl.modifiers || [] }))
  ).filter(s => s.mods.length);

  // Toggle on tap; close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  return (
    <div
      ref={ref}
      className={`ability-row ${open ? 'open' : ''}`}
      onMouseEnter={() => { if (window.matchMedia("(hover: hover)").matches) setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
      onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
    >
      <div className="ability-row-main">
        <div className="ability-header">
          <img src={iconSrc} alt={name} className="ability-img" />
          <div className="ability-key-badge">{abilityKey === "P" ? "P" : abilityKey}</div>
          <div className="ability-name">{name}</div>
        </div>
        {scalings.length > 0 && (
          <div className="ability-chips">
            {scalings.map((s, i) => (
              <span key={i} className="ability-chip">
                <span className="chip-attr">{s.attr}:</span>
                {s.mods.map((m, j) => <span key={j}>{renderModifier(m, stats, champLevel, abilityKey)}</span>)}
              </span>
            ))}
          </div>
        )}
      </div>
      {open && (
        <div className="ability-desc-panel">
          {(effects || []).map((eff, i) => (
            <div key={i}>
              {eff.description && <div dangerouslySetInnerHTML={{ __html: formatDescription(eff.description) }} />}
              {(eff.leveling || []).length > 0 && (
                <div className="ability-scaling">
                  {eff.leveling.map((lvl, j) => (
                    <div key={j} className="scaling-row">
                      <span className="scaling-attr">{lvl.attribute}:</span>
                      {(lvl.modifiers || []).map((mod, k) => (
                        <span key={k} className="scaling-val">{renderModifier(mod, stats, champLevel, abilityKey)}</span>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChampionDetails({ champDetail, champAbilities, stats, level, setLevel, setShowPicker, ver, savedBuilds, loadFromSlot, setConfirmDelete, setShowRuneModal, selectedRunes, allRunes }) {
  // DDragon: partype (e.g. "Mana"), Meraki: resource (e.g. "MANA")
  const partype = champDetail.partype || "";
  const hasRes  = partype && partype !== "None";

  const formatResLabel = (base, sub) => {
    if (!hasRes) return null;
    return sub ? `${partype} Regen` : partype;
  };

  // Dynamic bar color per resource type
  const resourceBarColor = (cfg) => {
    if (!cfg.resource) return cfg.color;
    if (partype === "Mana") return cfg.color;
    if (partype === "Energy") return cfg.sub ? "#EAB308" : "#FACC15";
    return cfg.sub ? "#DC2626" : "#EF4444";
  };

  // Build abilities list from Meraki (preferred) or DDragon fallback
  const abilityRows = useMemo(() => {
    const rows = [];
    if (champAbilities) {
      // Meraki: icon URLs are CDN links
      ["P","Q","W","E","R"].forEach(key => {
        const arr = champAbilities[key];
        if (!arr || arr.length === 0) return;
        const ab = arr[0];
        rows.push({ key, name: ab.name, iconSrc: ab.icon, effects: ab.effects || [] });
      });
    } else {
      // DDragon fallback
      if (champDetail.passive) {
        rows.push({
          key: "P",
          name: champDetail.passive.name,
          iconSrc: `${DDR}/cdn/${ver}/img/passive/${champDetail.passive.image.full}`,
          effects: [{ description: champDetail.passive.description, leveling: [] }],
        });
      }
      (champDetail.spells || []).forEach((spell, idx) => {
        const keys = ["Q","W","E","R"];
        rows.push({
          key: keys[idx],
          name: spell.name,
          iconSrc: `${DDR}/cdn/${ver}/img/spell/${spell.image.full}`,
          effects: [{ description: spell.tooltip || spell.description, leveling: [] }],
        });
      });
    }
    return rows;
  }, [champAbilities, champDetail, ver]);

  return (
    <div className="champ-details">
      <div className="champ-header-card">
        <div className="champ-info">
          <div className="champ-avatar-wrapper" onClick={() => setShowPicker(true)} title="Change Champion">
            <img src={`${DDR}/cdn/${ver}/img/champion/${champDetail.image.full}`} alt={champDetail.name} className="champ-avatar" />
            <div className="champ-avatar-overlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
              </svg>
            </div>
          </div>
          <div className="rune-button" onClick={() => setShowRuneModal(true)} title="Set Runes">
            {selectedRunes.primary ? (
              <img src={`${DDR}/cdn/img/${allRunes.find(r => r.id === selectedRunes.primary)?.icon}`} alt="Runes" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            )}
          </div>
          <div className="champ-meta">
            <div className="champ-name">{champDetail.name}</div>
            <div className="champ-title">{champDetail.title}</div>
            <div className="champ-tags">
              {(champDetail.tags || []).map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>
        </div>

        <div className="level-control">
          <span className="level-label">LEVEL</span>
          <input type="range" min={1} max={18} value={level} onChange={e => setLevel(+e.target.value)} />
          <div className="level-badge">{level}</div>
        </div>
      </div>

      <div className="stat-bars">
        {stats && STATS.map(cfg => {
          if (cfg.resource && !hasRes) return null;
          const total = stats.total[cfg.k] ?? 0;
          const base  = stats.base[cfg.k]  ?? 0;
          const rBon  = stats.rBon?.[cfg.k] ?? 0;
          const itemBonus = total - base - rBon;
          const displayBonus = total - base; // item + rune

          if (cfg.itemOnly && displayBonus < 0.001) return null;

          const label = cfg.resource ? formatResLabel(partype, cfg.sub) : cfg.label;
          const barColor = resourceBarColor(cfg);
          const totalPct = Math.min(total / cfg.max, 1) * 100;
          const basePct  = total > 0 ? (base / total) * totalPct : 0;
          const itemPct  = total > 0 ? (itemBonus / total) * totalPct : 0;
          const runePct  = totalPct - basePct - itemPct;

          return (
            <div key={cfg.k} className={`stat-row ${cfg.sub ? 'sub' : ''}`}>
              <div className="stat-label">{label}</div>
              <div className="stat-bar-container">
                <div className="stat-bar-fill"  style={{ width:`${basePct}%`, background:barColor, opacity:0.75 }} />
                <div className="stat-bar-bonus" style={{ width:`${itemPct}%`, background:`var(--c-gold)` }} />
                <div className="stat-bar-rune"  style={{ width:`${runePct}%`, background:`var(--c-rune, #EC4899)` }} />
              </div>
              <div className="stat-value">
                <span className={displayBonus > 0.001 ? 'has-bonus' : ''}>{cfg.fmt(total)}</span>
                {displayBonus > 0.001 && <span className="bonus-val">({cfg.fmtB(displayBonus)})</span>}
              </div>
            </div>
          );
        })}
      </div>

      {abilityRows.length > 0 && (
        <div className="abilities-section">
          <div className="panel-title">Abilities
            {!champAbilities && <span className="abilities-loading"> · loading details…</span>}
          </div>
          <div className="ability-list">
            {abilityRows.map(row => (
              <AbilityRow
                key={row.key}
                abilityKey={row.key}
                name={row.name}
                iconSrc={row.iconSrc}
                effects={row.effects}
                stats={stats}
                champLevel={level}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Inventory({ equipped, clearBuild, onSlotDragStart, onSlotDragOver, onSlotDrop, onDragEnd, removeItem, setTooltip, setTooltipAnchor, setMpos, tooltip, dragOverSlot, ver, champDetail, setShowSaveModal, showFlowchart, setShowFlowchart }) {
  return (
    <div className="inventory-panel">
      <div className="panel-title inventory-header">
        <div className="title-group">
          <div className="main-title">Item Build</div>
          <div className="subtitle">Drag from shop · click to remove</div>
        </div>
        <div className="header-actions">
          <button className={`flow-toggle-btn ${showFlowchart ? 'active' : ''}`} onClick={() => setShowFlowchart(!showFlowchart)} title="Toggle Progressive Flowchart">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"></path><path d="M8 3H3v5"></path><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.828l-2.656-2.656A4 4 0 0 1 7 5.39V3"></path><path d="M12 22v-8.3a4 4 0 0 1 1.172-2.828l2.656-2.656A4 4 0 0 0 17 5.39V3"></path></svg>
          </button>
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

      {!showFlowchart && (
        <div className="inventory-grid">
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
              onMouseEnter={item ? (e => { setTooltip(item); setMpos({ x:e.clientX, y:e.clientY }); setTooltipAnchor(e.currentTarget); }) : undefined}
              onMouseLeave={item ? () => { setTooltip(null); setTooltipAnchor(null); } : undefined}
              onClick={e => {
                if (item) {
                  removeItem(idx);
                  setTooltip(null);
                  setTooltipAnchor(null);
                }
              }}
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
      )}
    </div>
  );
}

function Shop({ shopSearch, setShopSearch, shopCat, setShopCat, shopItems, addItem, onShopDragStart, onDragEnd, setTooltip, setTooltipAnchor, setMpos, tooltip, ver }) {
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
      <div className="panel-title shop-header">
        <div className="title-group">
          <div className="main-title">Shop</div>
          <div className="subtitle">Double tap to add to build</div>
        </div>
      </div>
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

      <div className="shop-scroll-area">
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
                      onMouseEnter={e => { setTooltip(item); setMpos({ x:e.clientX, y:e.clientY }); setTooltipAnchor(e.currentTarget); }}
                      onMouseLeave={() => { setTooltip(null); setTooltipAnchor(null); }}
                      onMouseMove={e => setMpos({ x:e.clientX, y:e.clientY })}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (e.detail >= 2) {
                          addItem(item);
                        } else {
                          if (tooltip?.itemId === item.itemId) { 
                            setTooltip(null); 
                            setTooltipAnchor(null); 
                          } else { 
                            setTooltip(item); 
                            setMpos({ x:e.clientX, y:e.clientY }); 
                            setTooltipAnchor(e.currentTarget); 
                          }
                        }
                      }}
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

function RuneModal({ allRunes, selectedRunes, setSelectedRunes, onClose, ver }) {
  const updateRune = (key, val) => setSelectedRunes(p => ({ ...p, [key]: val }));

  const primaryTree = allRunes.find(r => r.id === selectedRunes.primary);
  const secondaryTree = allRunes.find(r => r.id === selectedRunes.secondary);

  const handleSecondaryClick = (runeId) => {
    if (selectedRunes.s1 === runeId) return updateRune('s1', null);
    if (selectedRunes.s2 === runeId) return updateRune('s2', null);
    if (!selectedRunes.s1) return updateRune('s1', runeId);
    if (!selectedRunes.s2) return updateRune('s2', runeId);
    updateRune('s2', runeId); // overwrite second slot if full
  };

  return (
    <Modal title="Runes & Shards" onClose={onClose}>
      <div className="rune-modal-body">
        
        {/* Primary Path */}
        <div className="rune-section primary-section">
          <div className="rune-section-title">Primary Path</div>
          <div className="rune-row tree-select">
            {allRunes.map(r => (
              <div key={r.id} className={`rune-icon tree-icon ${selectedRunes.primary === r.id ? 'active' : ''}`} onClick={() => updateRune('primary', r.id)}>
                <img src={`${DDR}/cdn/img/${r.icon}`} alt={r.name} title={r.name} />
              </div>
            ))}
          </div>
          {primaryTree && (
            <div className="rune-slots">
              {primaryTree.slots.map((slot, sIdx) => {
                const key = sIdx === 0 ? 'keystone' : `p${sIdx}`;
                return (
                  <div key={sIdx} className={`rune-row ${sIdx === 0 ? 'keystone-row' : ''}`}>
                    {slot.runes.map(r => (
                      <div key={r.id} className={`rune-icon ${selectedRunes[key] === r.id ? 'active' : ''}`} onClick={() => updateRune(key, r.id)}>
                        <img src={`${DDR}/cdn/img/${r.icon}`} alt={r.name} title={r.name} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Secondary Path */}
        <div className="rune-section secondary-section">
          <div className="rune-section-title">Secondary Path</div>
          <div className="rune-row tree-select">
            {allRunes.filter(r => r.id !== selectedRunes.primary).map(r => (
              <div key={r.id} className={`rune-icon tree-icon ${selectedRunes.secondary === r.id ? 'active' : ''}`} onClick={() => updateRune('secondary', r.id)}>
                <img src={`${DDR}/cdn/img/${r.icon}`} alt={r.name} title={r.name} />
              </div>
            ))}
          </div>
          {secondaryTree && (
            <div className="rune-slots">
              {secondaryTree.slots.slice(1).map((slot, sIdx) => (
                <div key={sIdx} className="rune-row">
                  {slot.runes.map(r => {
                    const isActive = selectedRunes.s1 === r.id || selectedRunes.s2 === r.id;
                    return (
                      <div key={r.id} className={`rune-icon ${isActive ? 'active' : ''}`} onClick={() => handleSecondaryClick(r.id)}>
                        <img src={`${DDR}/cdn/img/${r.icon}`} alt={r.name} title={r.name} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stat Shards */}
        <div className="rune-section shards-section">
          <div className="rune-section-title">Stat Shards</div>
          <div className="rune-slots">
            {['row1', 'row2', 'row3'].map((rowKey, idx) => {
              const stateKey = `shard${idx + 1}`;
              return (
                <div key={rowKey} className="rune-row shard-row">
                  {STAT_SHARDS[rowKey].map(shard => (
                    <div key={shard.id} className={`rune-icon shard-icon ${selectedRunes[stateKey] === shard.id ? 'active' : ''}`} onClick={() => updateRune(stateKey, shard.id)}>
                      <img src={`${DDR}/cdn/img/perk-images/${shard.icon}`} alt={shard.label} title={shard.label} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </Modal>
  );
}
