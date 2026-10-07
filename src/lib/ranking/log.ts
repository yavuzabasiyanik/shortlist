// Logs carry only counts, codes, and timings, never job descriptions,
// resume text, file names, or error messages that could echo them.
export type Logger = (event: string, fields: Record<string, number | string | boolean>) => void;

export const consoleLogger: Logger = (event, fields) => {
  console.info(JSON.stringify({ event, ...fields }));
};
