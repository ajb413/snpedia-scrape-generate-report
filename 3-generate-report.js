// Run this third.
// Writes a HTML file that can be viewed in the browser.
// My resulting file is ~3 MB.

const fs = require('fs');
const myDnaDataFile = './Dna_Raw_Data_report.txt';
const snpediaDataJsonFile = './my-snpedia-data.json';
const outputHtmlFile = './report.html';

let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>DNA Visualization</title>
    <style>
      * {
        font-family: Arial;
        font-size: 22px;
      }
      body {
        margin: auto;
        max-width: 1000px;
      }
      hr { border: 2px solid gray; }
      .bold { font-weight: bold; }
      .black { color: black; }
      .green { color: green; }
      .red { color: red; }
    </style>
  </head>
  <body>
`;

const baseUri = 'https://www.snpedia.com/index.php/';

(async () => {
  if (!fs.existsSync(myDnaDataFile)){
    console.error('Missing my raw DNA data file.');
    process.exit(1);
  }

  if (!fs.existsSync(snpediaDataJsonFile)){
    console.error('First run `1-scrape-all-snps-in-snpedia.js` then `2-scrape-my-data.js`.');
    process.exit(1);
  }

  let myDnaDataFromFile = fs.readFileSync(myDnaDataFile).toString();
  let snpediaData = JSON.parse(fs.readFileSync(snpediaDataJsonFile).toString());
  
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

  const rows = []; // { html: 'html str', sumMagnitude: number } (sort by most popular on snpedia)
  Object.keys(mySnpData).forEach((snp) => {
    if (snpediaData[snp] && Object.keys(snpediaData[snp].gtd).length && snpediaData[snp].gt.length) {
      const { allele1, allele2, position, chromosome } = mySnpData[snp];
      let me;
      if (allele1 && allele2) {
        me = allele1 + allele2;
      } else if (allele1 && !allele2) {
        me = allele1;
      } else {
        return;
      }

      let data = snpediaData[snp].o === 1 ?
        snpediaData[snp] :
        invert(snp, snpediaData[snp]);

      if (reorder(me)) me = reorder(me);

      if (data.gtd[me] && data.p === position && data.c === chromosome) {
        const _sumMagnitude = sumMagnitude(data);
        let _html = `<a href=${baseUri + snp}>${snp}</a>\n`;

        if (data.s) {
          _html += `<p>${data.s}</p>\n`;
        }

        let meColor = '';
        let meRepute = '';
        // if (data.gtd[me].r === 1) { meRepute = '(Good)'; meColor = 'green'; }
        if (data.gtd[me].r === 2) { meRepute = '(Bad)';  meColor = 'red'; }

        if (data.gtd[me].r === 1) {
          meRepute = '(Good)';
          meColor = 'green';

          if (
            data.gtd[me].s &&
            data.gtd[me].s !== 'common in clinvar' &&
            data.gtd[me].s !== 'normal' &&
            data.gtd[me].s !== 'common/normal' &&
            data.gtd[me].s !== 'common' &&
            data.gtd[me].s !== 'common genotype' &&
            data.gtd[me].s !== 'common on affy axiom data' &&
            data.gtd[me].s !== 'common in complete genomics'
          ) {
            meRepute = '(Good Common)';
          }
        }

        _html += `<p class="bold ${meColor}">Me: ${snp}(${me}) ${meRepute}</p>\n`;

        Object.keys(data.gtd).forEach((gt) => {
          const gtd = data.gtd[gt];
          let color = '';
          let isMine = gt === me ? 'bold' : '';
          if (gtd.r === 1) color = 'green';
          if (gtd.r === 2) color = 'red';
          _html += `<p class="${color}${' '+isMine}">${snp}(${gt}) ${gtd.s || ''}</p>\n`;
        });
        _html += `<hr />\n`;

        rows.push({ html: _html, sumMagnitude: _sumMagnitude });
      }
    }
  });

  rows.sort((a, b) => { return a.sumMagnitude > b.sumMagnitude ? -1 : 1 });

  rows.forEach((row) => {
    html += row.html;
  });

  html += `
    </body>
    </html>
  `;

  fs.writeFileSync(outputHtmlFile, html);
})().catch(console.error);

// SNPedia only has one order of alleles, test result could be either
function reorder(item) {
  const _reorder = {
    CA: 'AC',
    GA: 'AG',
    TA: 'AT',
    GC: 'CG',
    TC: 'CT',
    CG: 'GC',
    TG: 'GT',
    '--': '--',
  }

  return _reorder[item];
}

function inverse(item) {
  const _inverse = {
    'A': 'T',
    'T': 'A',
    'G': 'C',
    'C': 'G',
    '-': '-',
  };
  return _inverse[item];
}

function _invert(gt) {
  let result = '';
  [...gt].forEach(allele => result += inverse(allele));
  return result;
}

function invert(snp, _snpediaDataEntry) {
  const result = JSON.parse(JSON.stringify(_snpediaDataEntry));
  // console.log(snp, result);
  if (result.o !== 0) throw Error('SNP entry does not need to be inverted.');
  Object.keys(result.gtd).forEach((gt) => {
    const inverted = _invert(gt);
    result.gtd[inverted] = result.gtd[gt];
    delete result.gtd[gt];
  });
  result.gt.forEach((gt, i) => {
    const inverted = _invert(gt);
    result.gt[i] = inverted;
  });
  result.o = 1;
  return result;
}

function sumMagnitude(_snpediaDataEntry) {
  let result = 0;
  Object.keys(_snpediaDataEntry.gtd).forEach((key) => {
    if (_snpediaDataEntry.gtd[key].m) {
      result += _snpediaDataEntry.gtd[key].m;
    }
  });
  return result;
}
