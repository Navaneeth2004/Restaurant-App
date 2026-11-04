/** "Table 7" for the next free number: one above the highest trailing number in existing labels. */
export function nextTableLabel(labels: ReadonlyArray<string>): string {
  const nums = labels.map(l => { const m = /\d+$/.exec(l); return m ? parseInt(m[0], 10) : 0; }).filter(n => n > 0);
  return `Table ${nums.length > 0 ? Math.max(...nums) + 1 : labels.length + 1}`;
}
