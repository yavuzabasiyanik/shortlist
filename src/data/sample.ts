// Fictional sample data for "Try with sample data".
// Every company, person, and resume below is invented for this demo.
// The results are hand-written placeholders, not model output, so sample
// mode makes zero API calls.

export type SampleJob = {
  title: string;
  company: string;
  description: string;
};

export type SampleResume = {
  fileName: string;
  text: string;
};

// Mirrors the planned LLM output schema, minus the explanation (SHORT-06).
export type RankingResult = {
  fileName: string;
  candidateName: string;
  score: number;
  strengths: [string, string, string];
  gaps: [string, string];
};

export const sampleJob: SampleJob = {
  title: "Senior Frontend Engineer",
  company: "Harborlight Labs (fictional)",
  description: `Harborlight Labs builds a logistics analytics dashboard used by small freight companies. We are hiring a Senior Frontend Engineer to own our customer-facing web app.

Must have:
- 4+ years of professional experience with React and TypeScript
- Experience building data-heavy dashboards or data visualizations
- Writes automated tests (unit and end-to-end)

Nice to have:
- Next.js in production
- Accessibility (WCAG) experience
- D3 or a similar charting library

You will work with a product designer and two backend engineers, ship weekly, and mentor one junior engineer.`,
};

export const sampleResumes: SampleResume[] = [
  {
    fileName: "maya-okafor.pdf",
    text: `Maya Okafor — Frontend Engineer
Experience
- Tidewater Freight Software, Senior Frontend Engineer (2021–present): Leads the React + TypeScript shipment-tracking dashboard. Built route and delay charts with D3. Introduced Playwright end-to-end tests and raised unit test coverage with Jest from 40% to 85%.
- Copperline Studio, Frontend Engineer (2019–2021): Built React apps for retail clients. Ran an accessibility audit and fixed WCAG AA issues across three apps.
Skills: React, TypeScript, D3, Jest, Playwright, WCAG, CSS`,
  },
  {
    fileName: "daniel-reyes.pdf",
    text: `Daniel Reyes — Software Engineer
Experience
- Brightpath Commerce, Frontend Engineer (2020–present): Built and maintains a Next.js storefront in TypeScript. Owns the Jest and React Testing Library suite. Mentors two interns.
- Lumen Forms, Junior Developer (2019–2020): React form builder components.
Skills: React, TypeScript, Next.js, Jest, React Testing Library, Node.js`,
  },
  {
    fileName: "sofia-lindqvist.pdf",
    text: `Sofia Lindqvist — Frontend Developer
Experience
- Northgate Energy Data, Frontend Developer (2023–present): Migrated an energy-usage dashboard from Vue to React. Builds interactive D3 charts for grid operators.
- Fjordline Media, Frontend Developer (2020–2023): Vue.js data visualizations for news graphics.
Skills: Vue.js, React, JavaScript, D3, SVG, Figma`,
  },
  {
    fileName: "grace-kim.pdf",
    text: `Grace Kim — Junior Frontend Engineer
Experience
- Parcelpoint, Frontend Engineer (2024–present): Builds React + TypeScript screens for a delivery-scheduling app. Writes component tests with Vitest. Added keyboard navigation and screen-reader labels to the booking flow.
Education: Full-stack web development bootcamp (2023)
Skills: React, TypeScript, Vitest, Tailwind, accessibility`,
  },
  {
    fileName: "tomas-herrera.pdf",
    text: `Tomás Herrera — Backend Engineer
Experience
- Quarry Logistics, Senior Backend Engineer (2018–present): Designs Python and PostgreSQL services for freight pricing. Built an internal React admin page for pricing rules. Writes pytest suites for all services.
- Ironleaf Systems, Software Engineer (2016–2018): Django APIs.
Skills: Python, Django, PostgreSQL, pytest, some React`,
  },
];

export const sampleResults: RankingResult[] = [
  {
    fileName: "maya-okafor.pdf",
    candidateName: "Maya Okafor",
    score: 92,
    strengths: [
      "Has led a React + TypeScript freight dashboard since 2021",
      "Built route and delay charts with D3",
      "Introduced Playwright end-to-end tests and raised Jest coverage to 85%",
    ],
    gaps: [
      "No Next.js experience listed",
      "No mentoring experience mentioned",
    ],
  },
  {
    fileName: "daniel-reyes.pdf",
    candidateName: "Daniel Reyes",
    score: 76,
    strengths: [
      "6 years of React, including TypeScript since 2020",
      "Next.js storefront in production",
      "Owns a Jest and React Testing Library suite; mentors interns",
    ],
    gaps: [
      "No dashboard or data visualization work listed",
      "No end-to-end testing mentioned",
    ],
  },
  {
    fileName: "sofia-lindqvist.pdf",
    candidateName: "Sofia Lindqvist",
    score: 58,
    strengths: [
      "Builds interactive D3 charts for an energy dashboard",
      "5+ years of data visualization work",
      "Led a Vue-to-React dashboard migration",
    ],
    gaps: [
      "Under 4 years of React; no TypeScript listed (must-have)",
      "No automated testing mentioned (must-have)",
    ],
  },
  {
    fileName: "grace-kim.pdf",
    candidateName: "Grace Kim",
    score: 52,
    strengths: [
      "Current React and TypeScript work",
      "Writes component tests with Vitest",
      "Added keyboard navigation and screen-reader labels",
    ],
    gaps: [
      "About 2 years of experience versus 4+ required (must-have)",
      "No dashboard or data visualization work listed",
    ],
  },
  {
    fileName: "tomas-herrera.pdf",
    candidateName: "Tomás Herrera",
    score: 34,
    strengths: [
      "Freight logistics domain experience",
      "Consistently writes automated tests (pytest)",
      "Built an internal React admin page",
    ],
    gaps: [
      "Primarily backend; lacks 4+ years of React and TypeScript (must-have)",
      "No dashboard or data visualization work listed",
    ],
  },
];
