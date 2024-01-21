// Run this second. Need to have a DNA report file!
// Finds the intersection of my DNA data with the pages entries available on SNPedia
// Scrapes the relevant data using the SNPedia API
// According to the rate limit API response data (https://www.mediawiki.org/wiki/API:Ratelimit)
// there either is no rate limit for reading or it is 700 requests / 30 seconds?
// My resulting file `my-snpedia-data.json` is ~3 MB.

const fs = require('fs');
const snpediaJsonDataFile = './all-snps.json';// input
const myDnaDataFile = './Dna_Raw_Data_report.txt'; // input
const relevantSnpediaDataRip = './my-snpedia-data.json'; // output

(async () => {
  if (!fs.existsSync(myDnaDataFile)){
    console.error('Missing my raw DNA data file.');
    process.exit(1);
  }

  if (!fs.existsSync(snpediaJsonDataFile)){
    console.error('First run `1-scrape-all-snps-in-snpedia.js`.');
    process.exit(1);
  }

  let myDnaDataFromFile = fs.readFileSync(myDnaDataFile).toString();
  let snpediaJsonDataArray = JSON.parse(fs.readFileSync(snpediaJsonDataFile).toString());
  let snpediaDataJso = {};
  snpediaJsonDataArray.forEach(item => { snpediaDataJso[item.toLowerCase()] = true; });

  let mySnpDataLines = myDnaDataFromFile.split('\n');
  let mySnpData = {};

  const snpediaPagesOfMyData = [];

  mySnpDataLines.forEach((line) => {
    const data = line.split('\t');

    if (data.length === 5 && data[0] !== 'rsid') {
      const snp = data[0];
      const chromosome = data[1];
      const position = data[2];
      const allele1 = data[3];
      const allele2 = data[4];
      mySnpData[snp] = { allele1, allele2, position, chromosome };
    }
  });

  Object.keys(mySnpData).forEach((snp) => {
    if (snpediaDataJso[snp]) {
      snpediaPagesOfMyData.push(snp);
    }
  });

  console.log('Available SNPs in Snpedia:', snpediaJsonDataArray.length);
  console.log('My total SNPs documented:', (Object.keys(mySnpData).length));
  console.log('Intersection set size:', snpediaPagesOfMyData.length);

  myDnaDataFromFile = undefined;
  snpediaJsonDataArray = undefined;
  snpediaDataJso = undefined;
  mySnpDataLines = undefined;
  mySnpData = undefined;

  let relevantSnpediaData = {};
  if (fs.existsSync(relevantSnpediaDataRip)) {
    relevantSnpediaData = JSON.parse(fs.readFileSync(relevantSnpediaDataRip).toString());
  }

  for (let i = 0; i < snpediaPagesOfMyData.length; i++) {
    const snpRsNumber = snpediaPagesOfMyData[i];

    if (relevantSnpediaData[snpRsNumber]) {
      continue;
    }

    updateConsoleLogLine(`Fetching ${i} / ${snpediaPagesOfMyData.length}: ${snpRsNumber}`);

    const snpediaData = await getSnpediaDataWithRsNumber(snpRsNumber);

    relevantSnpediaData[snpRsNumber] = snpediaData;
    await sleep(150); // max 400 r / min

    if (i % 50 === 0) {
      // Save new data to local file
      fs.writeFileSync(relevantSnpediaDataRip, JSON.stringify(relevantSnpediaData));
    }
  }

  // Save new data to local file
  fs.writeFileSync(relevantSnpediaDataRip, JSON.stringify(relevantSnpediaData));
  console.log('\nDone');

})().catch(console.error);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateConsoleLogLine() {
  const strings = [];

  Object.values(arguments).forEach(arg => {
    const str = arg.toString();
    strings.push(str === '[object Object]' ? JSON.stringify(arg) : str);
  });

  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(strings.join(', '));
}

function parseSnpMetadata(snpMetadataString) {
  const result = {
    genotypes: []
  };

  snpMetadataString = snpMetadataString.replace(/\ \=\ /g, '\=');
  snpMetadataString = snpMetadataString.toLowerCase();

  const position = snpMetadataString.match(/\|position\=(.*?)\n/);
  const chromosome = snpMetadataString.match(/\|chromosome\=(.*?)\n/);
  const orientation = snpMetadataString.match(/\|orientation\=(.*?)\n/);
  const summary = snpMetadataString.match(/\|summary\=(.*?)\n/);
  const genotypes = snpMetadataString.match(/\|geno[0-9]\=(.*?)\n/g);

  if (position) result.position = position[1];
  if (chromosome) result.chromosome = chromosome[1];
  if (orientation) result.orientation = orientation[1] === 'plus' ? 1 : 0;
  if (summary) result.summary = summary[1];
  if (genotypes) {
    genotypes.forEach((genotype) => {
      genotype = genotype.match(/\((.*)\)/)[1].replace(/\;/g, '').toUpperCase();
      result.genotypes.push(genotype);
    });
  }

  return result;
}

function parseGenotypeMetadata(genotypeMetadataString) {
  const result = {};

  genotypeMetadataString = genotypeMetadataString.replace(/\ \=\ /g, '\=');
  genotypeMetadataString = genotypeMetadataString.toLowerCase();

  const magnitude = genotypeMetadataString.match(/\|magnitude\=(.*?)\n/);
  const repute = genotypeMetadataString.match(/\|repute\=(.*?)\n/);
  const summary = genotypeMetadataString.match(/\|summary\=(.*?)\n/);
  
  if (magnitude) result.magnitude = +magnitude[1];
  if (repute) {
    result.repute = repute[1] === 'good' ? 1 : 2;
  } else {
    result.repute = 0;
  }
  if (summary) result.summary = summary[1];

  return result;
}

async function getSnpediaDataWithRsNumber(rsNumber) {
  const res = await fetch(`https://bots.snpedia.com/api.php?action=query&generator=allpages&gaplimit=5&gapfilterredir=nonredirects&gapfrom=${rsNumber}&prop=revisions&rvprop=content&format=json`);
  const json = await res.json();

  const result = {
    gtd: {},
  };

  try {
    const pageIds = Object.keys(json.query.pages);
    pageIds.forEach((pageId) => {
      const page = json.query.pages[pageId];

      if (
        (page.title && typeof page.title === 'string') &&
        (
          page.title.toLowerCase() === rsNumber ||
          page.title.toLowerCase().includes(rsNumber + '(')
        ) &&
        Array.isArray(page.revisions) && page.revisions[0] &&
        page.revisions[0].contentformat && page.revisions[0].contentformat === 'text/x-wiki' &&
        page.revisions[0].contentmodel && page.revisions[0].contentmodel === 'wikitext' && 
        page.revisions[0]['*'] &&
        page.revisions[0]['*'].match(/\{(?=.*\n)[^}]+\}\}/)
      ) {
        let pageMetadata = page.revisions[0]['*'].match(/\{(?=.*\n)[^}]+\}\}/)[0];

        const pageTitle = page.title.toLowerCase();

        // SNP page, eg rs17822931
        // Genotype page, eg rs17822931(C;C)
        const isSnpPage = pageTitle === rsNumber;

        if (isSnpPage) {
          const data = parseSnpMetadata(pageMetadata);
          // result.snp = rsNumber;
          result.gt = data.genotypes;
          result.o = data.orientation;
          result.c = data.chromosome;
          result.p = data.position;
          result.s = data.summary;
        } else {
          const data = parseGenotypeMetadata(pageMetadata);
          const genotype = pageTitle.match(/\((.*)\)/)[1].replace(/\;/g, '').toUpperCase();
          result.gtd[genotype] = {
            m: data.magnitude,
            r: data.repute,
            s: data.summary,
          };
        }
      }
    });

    Object.keys(result).forEach((k) => {
      if (result[k] === undefined || result[k] === null) delete result[k];
    });

    Object.keys(result.gtd).forEach((gt) => {
      Object.keys(result.gtd[gt]).forEach((k) => {
        if (result.gtd[gt][k] === undefined || result.gtd[gt][k] === null) delete result.gtd[gt][k];
      });
    });
  } catch(e) {
    console.log('Caught', e);
  }

  return result;
}
