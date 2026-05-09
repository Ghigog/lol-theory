const fetch = require('node-fetch');

async function checkDuplicates() {
  const DDR = "https://ddragon.leagueoflegends.com";
  const [v] = await fetch(`${DDR}/api/versions.json`).then(r => r.json());
  const id = await fetch(`${DDR}/cdn/${v}/data/en_US/item.json`).then(r => r.json());
  
  const allItems = id.data;
  const items = Object.entries(allItems)
    .filter(([id, item]) => {
      if (!item.gold?.purchasable || !item.maps?.["11"]) return false;
      if (!item.gold.total) return false;
      if (item.inStore === false) return false;
      return true;
    })
    .map(([id, item]) => ({ ...item, itemId: id }));

  const counts = {};
  items.forEach(item => {
    counts[item.name] = (counts[item.name] || 0) + 1;
  });

  const duplicates = Object.entries(counts).filter(([name, count]) => count > 1);
  console.log(JSON.stringify(duplicates, null, 2));
}

checkDuplicates();
