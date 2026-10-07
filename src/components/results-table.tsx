// The ranked table shared by the sample and live results: a table on wide
// screens and one card per candidate on phones.
export type TableRow = {
  key: string;
  rank: number;
  candidateName: string;
  score: number;
  strengths: string[];
  gaps: string[];
};

export function ResultsTable({ rows }: { rows: TableRow[] }) {
  return (
    <>
      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-lg border border-stone-200 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Rank</th>
              <th scope="col" className="px-4 py-3 font-medium">Candidate</th>
              <th scope="col" className="px-4 py-3 font-medium">Score</th>
              <th scope="col" className="px-4 py-3 font-medium">Strengths</th>
              <th scope="col" className="px-4 py-3 font-medium">Gaps</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 align-top">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-4 py-4 font-semibold text-stone-500">
                  {row.rank}
                </td>
                <td className="px-4 py-4 font-medium">{row.candidateName}</td>
                <td className="px-4 py-4">
                  <Score value={row.score} />
                </td>
                <td className="px-4 py-4">
                  <BulletList items={row.strengths} />
                </td>
                <td className="px-4 py-4">
                  <BulletList items={row.gaps} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per candidate */}
      <ol className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li
            key={row.key}
            className="rounded-lg border border-stone-200 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">
                <span className="mr-2 text-stone-500">#{row.rank}</span>
                {row.candidateName}
              </p>
              <Score value={row.score} />
            </div>
            <h3 className="mt-3 text-xs font-medium uppercase tracking-wide text-stone-500">
              Strengths
            </h3>
            <BulletList items={row.strengths} />
            <h3 className="mt-3 text-xs font-medium uppercase tracking-wide text-stone-500">
              Gaps
            </h3>
            <BulletList items={row.gaps} />
          </li>
        ))}
      </ol>
    </>
  );
}

function Score({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 font-semibold tabular-nums">
        {value}
        <span className="sr-only"> out of 100</span>
      </span>
      <div
        className="h-1.5 w-16 rounded-full bg-stone-200"
        role="presentation"
      >
        <div
          className="h-full rounded-full bg-teal-600"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 list-disc space-y-1 pl-4 text-stone-700 marker:text-stone-400">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
