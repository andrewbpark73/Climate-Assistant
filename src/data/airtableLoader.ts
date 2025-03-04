import { fileURLToPath } from 'node:url';
import * as path from 'path';
import { fetchTableRecords, saveToCSV, TableConfig, AirtableError } from "./airtable.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define new output directory
const outputDir = path.join(__dirname, "../.observablehq/cache/data/");

// Table configurations
const tables: TableConfig[] = [
  { name: 'Categories', filename: 'categories.csv' },
  { name: 'Subcategories', filename: 'subcategories.csv' },
  { name: 'Solution Metadata', filename: 'solution_metadata.csv' },
  { name: 'Solutions', filename: 'solutions.csv' },
  { name: 'Geo-Hazard', filename: 'geo_hazard.csv' }
].map(table => ({
  ...table,
  filename: path.join(outputDir, table.filename)
}));

async function processTable(table: TableConfig): Promise<void> {
  try {
    console.log(`\nProcessing table: ${table.name}`);
    const records = await fetchTableRecords(table.name);
    console.log(`Found ${records.length} records`);

    if (records.length > 0) {
      console.log('\nSample record fields:');
      console.log(JSON.stringify(records[0].fields, null, 2));
    }

    await saveToCSV(records, table.filename);
    console.log(`Saved to ${table.filename}`);
  } catch (error) {
    if (error instanceof AirtableError) {
      console.error(`Error fetching ${table.name}:`, error.originalError);
    } else {
      console.error(`Unexpected error for ${table.name}:`, error);
    }
  }
}

async function main() {
  for (const table of tables) {
    await processTable(table);
  }
  console.log("All tables processed and saved.");
}

main().catch(console.error);