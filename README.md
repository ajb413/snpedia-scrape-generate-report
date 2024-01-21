# Scrape SNPedia and Generate a Local Report

Using a raw file of SNP data, generate a report based on the data in SNPedia. MIT; use at your own risk!

See the example `Example_Dna_Raw_Data_report.txt` for the format of the DNA data file. Assuming the report is all forward side [build 37](https://www.reddit.com/r/promethease/comments/3ayg64/orientation_confusion/) for orientation; the scripts will properly orient the alleles and flip minus SNPedia entries when needed.

See [SNPedia bulk page](https://www.snpedia.com/index.php/Bulk) and [MediaWiki docs](https://www.mediawiki.org/wiki/API:Main_page) for more details on API usage.

## How to Run

Works with [Node.js](https://nodejs.org/en/download/) v20.5.0. Download and install Node.js.

Clone this repository. Navigate to the local directory. Copy and paste the raw DNA data file to the directory as `Dna_Raw_Data_report.txt`. Adjust the parse code in script 2 and 3 (`mySnpDataLines.forEach((line)...`) based on your own data's format if it is different from the example file.

```bash
cd snpedia-scrape-generate-report/

## Find all valid RS numbers in SNPedia using the MediaWiki API (https://www.snpedia.com/index.php/Bulk#Forbidden)
## Saves a JSON file <2 MB
node 1-scrape-all-snps-in-snpedia.js

## Scrapes all RS numbers in my data file but only ones that have SNPedia entries.
## Saves a JSON file ~3 MB
node 2-scrape-my-data.js

## Generates a HTML file report that can be viewed in a web browser.
## Saves a HTML file ~3 MB
node 3-generate-report.js

## Opens file with default os web browser (mac)
open report.html
```

## Personal Data Files

Be sure not to push files with personal data to the public internet. Relevant files (report.html, Dna_Raw_Data_report.txt, all-snps.json, my-snpedia-data.json) are listed in the `.gitignore` file for safety.

## HTML File Report Page Example In Web Browser

[![SNP Data DNA Report HTML File](https://raw.githubusercontent.com/ajb413/snpedia-scrape-generate-report/master/report-screenshot.jpg)](https://raw.githubusercontent.com/ajb413/snpedia-scrape-generate-report/master/report-screenshot.jpg)
