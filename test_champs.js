const fs = require('fs');
fetch('https://ddragon.leagueoflegends.com/cdn/14.8.1/data/en_US/champion.json')
  .then(r => r.json())
  .then(async data => {
    const champs = Object.keys(data.data);
    for (let c of champs) {
      const res = await fetch(`https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/${c}.json`);
      if (!res.ok) {
        console.log(`Failed for ${c}`);
      }
    }
    console.log("Done");
  });
