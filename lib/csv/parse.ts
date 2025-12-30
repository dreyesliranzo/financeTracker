import Papa from "papaparse";

export function parseCsv(file: File) {
  return new Promise<{
    headers: string[];
    data: Record<string, string>[];
  }>((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        resolve({ headers, data: results.data });
      },
      error: (error) => reject(error)
    });
  });
}
