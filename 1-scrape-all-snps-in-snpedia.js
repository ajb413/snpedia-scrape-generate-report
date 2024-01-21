// Run this first.
// Finds out all of the rs numbers for every SNP in SNPedia.
// Follows the instructions at `https://www.snpedia.com/index.php/Bulk#Forbidden`
// for finding all of the current DB entries.
// Roughly 111725 entries in SNPedia. Resulting file is <2 MB.

const fs = require('fs');
const jsonDataFile = './all-snps.json';
let data = {};
let idx = 0;

function getUrlBasedOnOffset(offset) {
  const base = `https://bots.snpedia.com/api.php?action=query&list=categorymembers&cmtitle=Category%3AIs_a_snp&cmlimit=5000&format=json`;
  if (!offset) {
    return base;
  } else {
    return base + `&cmcontinue=${offset}`
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(offset) {
  console.log('Fetching SNPs, offset:', offset, 'idx', idx, 'rows:', Object.keys(data).length);
  const res = await fetch(getUrlBasedOnOffset(offset));
  const json = await res.json();

  const hasMore = json.continue && json.continue.cmcontinue && json.continue.continue;

  if (json.query && json.query.categorymembers) {
    json.query.categorymembers.forEach((item) => {
      data[item.title] = true;
    });
  }

  // Save new data to local file
  fs.writeFileSync(jsonDataFile, JSON.stringify(Object.keys(data)));

  if (!hasMore) {
    console.log('No more continue, exiting...');
    process.exit();
  } else {
    idx++;
    // await sleep(1000); // sleep 1s, self-imposed API rate limit
    await main(json.continue.cmcontinue);
  }
}

(async () => {
  // Load data from local file if it exists
  if (fs.existsSync(jsonDataFile)) {
    data = JSON.parse(fs.readFileSync(jsonDataFile).toString());
  }

  await main();
})().catch(console.error);
