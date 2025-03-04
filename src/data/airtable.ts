import Airtable from 'airtable';
import dotenv from 'dotenv';
import * as fs from 'fs';
import { stringify } from 'csv-stringify/sync';
import path from 'path';

// Load environment variables first
dotenv.config();

// Validate environment variables
const requiredEnvVars = ['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Configure Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID!);

export interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

export interface TableConfig {
  name: string;
  filename: string;
}

export class AirtableError extends Error {
  constructor(message: string, public originalError: any) {
    super(message);
    this.name = 'AirtableError';
  }
}

export const fetchTableRecords = async (tableName: string): Promise<AirtableRecord[]> => {
  try {
    const records = await base(tableName).select().all();
    return records.map(record => ({
      id: record.id,
      fields: record.fields,
      createdTime: record._rawJson.createdTime
    }));
  } catch (error) {
    throw new AirtableError(`Error fetching records from table ${tableName}`, error);
  }
};

export const saveToCSV = (records: AirtableRecord[], filename: string): void => {
  try {
    // Ensure output directory exists
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Get all unique field names from all records
    const allFields = new Set<string>();
    records.forEach(record => {
      Object.keys(record.fields).forEach(field => allFields.add(field));
    });

    // Prepare data for CSV with type handling
    const csvData = records.map(record => {
      const row: Record<string, any> = {
        id: record.id,
        createdTime: record.createdTime
      };
      
      Array.from(allFields).forEach(field => {
        const value = record.fields[field];
        row[field] = formatFieldValue(value);
      });
      
      return row;
    });

    // Convert to CSV with proper column ordering
    const csv = stringify(csvData, {
      header: true,
      columns: ['id', 'createdTime', ...Array.from(allFields)]
    });

    // Write to file
    fs.writeFileSync(filename, csv);
    console.log(`Data saved to ${filename}`);
  } catch (error) {
    throw new AirtableError(`Error saving to CSV file ${filename}`, error);
  }
};

// Helper function to format field values
const formatFieldValue = (value: any): string => {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return value?.toString() ?? '';
};

export const createRecord = async (tableName: string, fields: any): Promise<AirtableRecord> => {
  try {
    const createdRecord = await base(tableName).create([{ fields }]);
    return {
      id: createdRecord[0].id,
      fields: createdRecord[0].fields,
      createdTime: createdRecord[0]._rawJson.createdTime
    };
  } catch (error) {
    console.error('Error creating record in Airtable:', error);
    throw error;
  }
};

export const updateRecord = async (tableName: string, id: string, fields: any): Promise<AirtableRecord> => {
  try {
    const updatedRecord = await base(tableName).update([{ id, fields }]);
    return {
      id: updatedRecord[0].id,
      fields: updatedRecord[0].fields,
      createdTime: updatedRecord[0]._rawJson.createdTime
    };
  } catch (error) {
    console.error('Error updating record in Airtable:', error);
    throw error;
  }
};

export const deleteRecord = async (tableName: string, id: string): Promise<void> => {
  try {
    await base(tableName).destroy([id]);
  } catch (error) {
    console.error('Error deleting record from Airtable:', error);
    throw error;
  }
}; 