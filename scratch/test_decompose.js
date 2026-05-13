async function test() {
  const DDR = "https://ddragon.leagueoflegends.com";
  const [v] = await fetch(`${DDR}/api/versions.json`).then(r => r.json());
  const id = await fetch(`${DDR}/cdn/${v}/data/en_US/item.json`).then(r => r.json());
  const allItems = id.data;

  const equippedIds = ["3031", "3089"]; // IE, Rabadon
  
  let columns = [];
  
  function getDepth(itemId) {
    const item = allItems[itemId];
    if (!item || !item.from || item.from.length === 0) return 1;
    return 1 + Math.max(...item.from.map(getDepth));
  }

  equippedIds.forEach(eqId => {
    const depth = getDepth(eqId);
    let itemCols = Array(depth).fill(null).map(() => []);
    
    function traverse(itemId, currentDepth) {
      const item = allItems[itemId];
      if (!item) return;
      
      itemCols[currentDepth - 1].push(itemId);
      
      if (item.from) {
        item.from.forEach(childId => {
          traverse(childId, getDepth(childId));
        });
      }
    }
    
    traverse(eqId, depth);
    columns.push(...itemCols);
  });

  console.log(JSON.stringify(columns, null, 2));
}

test();
