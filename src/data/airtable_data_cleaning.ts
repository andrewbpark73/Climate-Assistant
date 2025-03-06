import * as fs from 'node:fs';
import * as path from 'node:path';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';
import csvParser from 'csv-parser';
import { stringify } from 'csv-stringify/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define data directory
const dataDir = path.join(__dirname, "../.observablehq/cache/data/");

// Files to process
const files = {
  categories: "categories.csv",
  subcategories: "subcategories.csv",
  solutions: "solutions.csv",
  solutionMetadata: "solution_metadata.csv",
  geoHazard: "geo_hazard.csv",
};

// Helper function to read CSV into an array of objects
const readCSV = async (filePath: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data: any) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error: Error) => reject(error));
  });
};

// Helper function to write CSV file
const writeCSV = (filePath: string, data: any[]): void => {
  const output = stringify(data, { header: true });
  fs.writeFileSync(filePath, output);
  console.log(`Saved: ${filePath}`);
};

async function processAndSaveData() {
  try {
    console.log("Reading CSV files...");

    // Load data from CSVs
    const categories = await readCSV(path.join(dataDir, files.categories));
    const subcategories = await readCSV(path.join(dataDir, files.subcategories));
    const solutions = await readCSV(path.join(dataDir, files.solutions));
    const solutionMetadata = await readCSV(path.join(dataDir, files.solutionMetadata));
    const geoHazards = await readCSV(path.join(dataDir, files.geoHazard));

    console.log("Processing labelized data...");

    // Create ID-to-Name mappings
    const categoryMap = Object.fromEntries(categories.map(cat => [cat.id, cat["Category Name"]]));
    const subcategoryMap = Object.fromEntries(subcategories.map(sub => [sub.id, sub["Subcategory Name"]]));
    const solutionMap = Object.fromEntries(solutions.map(sol => [sol.id, sol["solution_name"]]));
    const geoHazardMap = Object.fromEntries(geoHazards.map(haz => [haz.id, haz["Official_Name"]]));

    // Process categories to create labelized version
    const categoriesLabelized = categories.map(cat => {
      const processed = { ...cat };
      
      // Replace Subcategories IDs with names while keeping the array structure
      if (cat.Subcategories) {
        processed.Subcategories = cat.Subcategories.replace(
          /"(rec[a-zA-Z0-9]+)"/g,
          (match: string, id: string) => `"${subcategoryMap[id] || `Unknown(${id})`}"`
        );
      }

      // Replace Solutions IDs with names while keeping the array structure
      if (cat.Solutions) {
        processed.Solutions = cat.Solutions.replace(
          /"(rec[a-zA-Z0-9]+)"/g,
          (match: string, id: string) => `"${solutionMap[id] || `Unknown(${id})`}"`
        );
      }

      return processed;
    });

    // Process subcategories to create labelized version
    const subcategoriesLabelized = subcategories.map(sub => {
      const processed = { ...sub };
      
      // Replace Parent Category IDs with names while keeping the array structure
      if (sub["Parent Category"]) {
        processed["Parent Category"] = sub["Parent Category"].replace(
          /"(rec[a-zA-Z0-9]+)"/g,
          (match: string, id: string) => `"${categoryMap[id] || `Unknown(${id})`}"`
        );
      }

      // Replace Solution IDs with names while keeping the array structure
      if (sub.Solutions) {
        processed.Solutions = sub.Solutions.replace(
          /"(rec[a-zA-Z0-9]+)"/g,
          (match: string, id: string) => `"${solutionMap[id] || `Unknown(${id})`}"`
        );
      }

      return processed;
    });

    // Save processed labelized CSVs
    writeCSV(path.join(dataDir, "categories_labelized.csv"), categoriesLabelized);
    writeCSV(path.join(dataDir, "subcategories_labelized.csv"), subcategoriesLabelized);

    console.log("Labelized data successfully processed and saved.");
  } catch (error) {
    console.error("Error processing data:", error);
  }
}

// Run the script
processAndSaveData();