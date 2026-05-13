import { generateFlowchartFromEquipped } from '../src/flowchartUtils.js';

async function test() {
  const DDR = "https://ddragon.leagueoflegends.com";
  const [v] = await fetch(`${DDR}/api/versions.json`).then(r => r.json());
  const id = await fetch(`${DDR}/cdn/${v}/data/en_US/item.json`).then(r => r.json());
  const allItems = id.data;

  const equippedIds = ["3031", "3089"]; // IE, Rabadon
  
  const stages = generateFlowchartFromEquipped(equippedIds, allItems);
  console.log(JSON.stringify(stages, null, 2));
}

test();
