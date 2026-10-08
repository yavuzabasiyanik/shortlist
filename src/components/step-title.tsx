// "1. Job description"-style section title. Renders as a <label> when it
// names a form control, otherwise as a heading.
export function StepTitle({ step, title, htmlFor, id }: { step: number; title: string; htmlFor?: string; id?: string }) {
  const content = (
    <>
      <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-700 text-[11px] font-semibold text-white">
        {step}
      </span>
      <span>
        <span className="sr-only">{step}. </span>
        {title}
      </span>
    </>
  );
  const className = "flex items-center gap-2 text-sm font-semibold text-stone-900";
  return htmlFor ? (
    <label htmlFor={htmlFor} id={id} className={className}>{content}</label>
  ) : (
    <h3 id={id} className={className}>{content}</h3>
  );
}
