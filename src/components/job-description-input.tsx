import { StepTitle } from "@/components/step-title";
import { JOB_DESCRIPTION_MAX_CHARS, JOB_DESCRIPTION_MIN_CHARS } from "@/lib/limits";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function JobDescriptionInput({ value, onChange }: Props) {
  const count = value.length;
  const tooLong = count > JOB_DESCRIPTION_MAX_CHARS;
  const tooShort = count < JOB_DESCRIPTION_MIN_CHARS;

  let hint = "Ready.";
  if (tooLong)
    hint = `Over the limit by ${(count - JOB_DESCRIPTION_MAX_CHARS).toLocaleString("en-US")}. Shorten it to ${JOB_DESCRIPTION_MAX_CHARS.toLocaleString("en-US")} characters or fewer.`;
  else if (tooShort)
    hint = `Enter at least ${JOB_DESCRIPTION_MIN_CHARS} characters (${JOB_DESCRIPTION_MIN_CHARS - count} more needed).`;

  return (
    <div>
      <StepTitle step={1} title="Job description" htmlFor="job-description" />
      <textarea
        id="job-description"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={7}
        placeholder="Paste the job description, including the must-have requirements."
        aria-describedby="job-description-hint job-description-count"
        aria-invalid={tooLong}
        className={`mt-2.5 block w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm leading-relaxed text-stone-900 placeholder:text-stone-500 focus:outline-2 focus:outline-offset-1 focus:outline-teal-700 ${
          tooLong ? "border-red-600" : "border-stone-300"
        }`}
      />
      <div className="mt-1.5 flex items-start justify-between gap-4 text-xs">
        <p
          id="job-description-hint"
          className={tooLong ? "text-red-700" : "text-stone-600"}
        >
          {hint}
        </p>
        <p
          id="job-description-count"
          className={`shrink-0 tabular-nums ${tooLong ? "font-medium text-red-700" : "text-stone-500"}`}
        >
          {count.toLocaleString("en-US")} / {JOB_DESCRIPTION_MAX_CHARS.toLocaleString("en-US")}
        </p>
      </div>
    </div>
  );
}
