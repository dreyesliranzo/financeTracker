export type CsvMapping = {
  date: string;
  amount: string;
  type?: string;
  category?: string;
  account?: string;
  merchant?: string;
  notes?: string;
  tags?: string;
};

export const csvFieldOptions = [
  "date",
  "amount",
  "type",
  "category",
  "account",
  "merchant",
  "notes",
  "tags"
] as const;

export const requiredCsvFields: Array<keyof CsvMapping> = ["date", "amount"];
