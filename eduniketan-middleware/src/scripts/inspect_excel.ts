import * as xlsx from 'xlsx';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'lpu_production_sample.xlsx');
const workbook = xlsx.readFile(filePath);

console.log('Sheet Names:', workbook.SheetNames);
workbook.SheetNames.forEach(name => {
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[name]) as any[];
  console.log(`Sheet: ${name}, Rows: ${data.length}`);
  if (data.length > 0) {
    console.log(`Columns:`, Object.keys(data[0] as object));
    console.log(`First row:`, JSON.stringify(data[0]));
  }
  console.log('---');
});
