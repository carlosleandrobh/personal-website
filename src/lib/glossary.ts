// Plain-language meanings for the terms used on the site and in posts (shown at /glossary/).
// Keep each meaning to one or two short sentences, with no jargon that is not itself in this list.
//
// The list follows the site's text: a term is here because a page uses it. Add a term when the text starts using it and
// remove it when no page uses it any more. `npm run test:glossary` (scripts/check-glossary.mjs) checks both directions
// against the built site, and the "glossary" skill in .claude/skills/ has the steps.
export interface GlossaryTerm {
  term: string;
  /** What the letters stand for, when it is an abbreviation. */
  expansion?: string;
  meaning: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  { term: 'AA', meaning: 'The middle level of the WCAG rules, and the one most accessibility laws ask for.' },
  { term: 'AAA', meaning: 'The strictest level of the WCAG rules. Few sites can meet all of it.' },
  { term: 'AI', expansion: 'artificial intelligence', meaning: 'Software that does tasks which normally need human judgement, such as writing, sorting or spotting patterns.' },
  { term: 'AS-IS / TO-BE', meaning: 'Two diagrams of the same process. AS-IS shows how the work happens today. TO-BE shows how it should happen after the change.' },
  { term: 'Azure', meaning: 'Microsoft\'s cloud platform, where organisations rent computing and storage instead of owning the machines.' },
  { term: 'BABOK', expansion: 'Business Analysis Body of Knowledge', meaning: 'A guide from the IIBA that describes the methods and skills of business analysis.' },
  { term: 'BI', expansion: 'business intelligence', meaning: 'Reports and dashboards that turn an organisation\'s data into answers people can act on.' },
  { term: 'BPMN', expansion: 'Business Process Model and Notation', meaning: 'A standard way to draw a business process as a diagram that business people and developers can both read.' },
  { term: 'Business analysis', meaning: 'Working out what an organisation really needs, then describing a solution that people and technology can both deliver.' },
  { term: 'CBAP', expansion: 'Certified Business Analysis Professional', meaning: 'An advanced business analysis certification awarded by the IIBA.' },
  { term: 'Cloudflare', meaning: 'A company whose network sits in front of this site. It speeds pages up and blocks abusive traffic.' },
  { term: 'CRM', expansion: 'customer relationship management', meaning: 'Software that keeps track of customers, sales and every conversation with them.' },
  { term: 'DAX', expansion: 'Data Analysis Expressions', meaning: 'The formula language used in Power BI to calculate figures from data.' },
  { term: 'DHCP', expansion: 'Dynamic Host Configuration Protocol', meaning: 'The service on a network that gives each device its address when it connects.' },
  { term: 'DNS', expansion: 'Domain Name System', meaning: 'The internet\'s phone book. It turns a name like carlos.nz into the address of a computer.' },
  { term: 'DP-300', meaning: 'A Microsoft exam for people who run databases on Azure.' },
  { term: 'ERP', expansion: 'enterprise resource planning', meaning: 'Software a business uses to run its finances, stock, people and orders in one place.' },
  { term: 'Homelab', meaning: 'A small set of computers at home used to try out tools and learn how they behave, away from real business systems.' },
  { term: 'HRIS', expansion: 'human resources information system', meaning: 'Software that holds employee records and handles things like payroll and leave.' },
  { term: 'HSQE', expansion: 'health, safety, quality and environment', meaning: 'The part of an organisation that keeps people safe and work to standard, and reports on both.' },
  { term: 'HTTPS', expansion: 'Hypertext Transfer Protocol Secure', meaning: 'The secure way a browser talks to a website. Nobody in between can read or change what is sent.' },
  { term: 'IIBA', expansion: 'International Institute of Business Analysis', meaning: 'The professional body for business analysts. It publishes the BABOK and awards the CBAP.' },
  { term: 'IPP', expansion: 'information privacy principle', meaning: 'One of the 13 rules in New Zealand\'s Privacy Act about how personal information is collected, kept and used.' },
  { term: 'NVDA', expansion: 'NonVisual Desktop Access', meaning: 'A free screen reader for Windows.' },
  { term: 'PL/SQL', expansion: 'Procedural Language for SQL', meaning: 'Oracle\'s version of SQL. It adds steps, conditions and loops, so a database can run small programs.' },
  { term: 'Power BI', meaning: 'Microsoft\'s tool for turning data into charts, reports and dashboards.' },
  { term: 'Proxmox VE', expansion: 'Proxmox Virtual Environment', meaning: 'Free software that lets one physical computer run many virtual computers, and lets several computers work together.' },
  { term: 'QMS', expansion: 'quality management system', meaning: 'The procedures and records an organisation uses to show that its work meets a standard.' },
  { term: 'RSS', expansion: 'Really Simple Syndication', meaning: 'A feed that lets you follow this site\'s posts in a news reader app, instead of visiting the site to check.' },
  { term: 'Screen reader', meaning: 'A tool that reads aloud what is on the screen, so a person can use a phone or computer without seeing it.' },
  { term: 'SQL', expansion: 'Structured Query Language', meaning: 'The standard language for asking a database for data and for changing it.' },
  { term: 'SQL Server', meaning: 'Microsoft\'s database software, widely used in business.' },
  { term: 'SSRS', expansion: 'SQL Server Reporting Services', meaning: 'Microsoft\'s tool for building printable reports from a database.' },
  { term: 'Supabase', meaning: 'The database service that stores this site\'s content. Visitors\' browsers never talk to it.' },
  { term: 'T-SQL', expansion: 'Transact-SQL', meaning: 'Microsoft\'s version of SQL, used with SQL Server.' },
  { term: 'TSQL', meaning: 'How GitHub writes T-SQL (Transact-SQL), Microsoft\'s version of SQL used with SQL Server.' },
  { term: 'Traefik', meaning: 'Software that receives requests from the internet and passes each one to the right service in a homelab.' },
  { term: 'Turnstile', meaning: 'Cloudflare\'s spam check on the contact form. It decides whether a visitor is a person without asking them to solve a puzzle.' },
  { term: 'UX', expansion: 'user experience', meaning: 'How easy, clear and pleasant something is to use, from the first click to getting the job done.' },
  { term: 'WCAG', expansion: 'Web Content Accessibility Guidelines', meaning: 'The international rules for making websites usable by people with disabilities. This site aims for version 2.2, level AA.' },
];

/**
 * Abbreviations that need no entry: names, places and words everyone knows. `npm run test:glossary` and
 * e2e/words.spec.ts accept these. Add a name here; add anything a reader may not know to GLOSSARY instead.
 */
export const NOT_JARGON: readonly string[] = [
  'IBM', 'NZ', 'CV', 'PDF', 'IT', 'HR', 'IP', 'TOTVS', 'SETHOS', 'PUC', 'RM', 'VE', 'UTC', 'OK', 'SE',
];

/**
 * Abbreviations that only the test content (supabase/seed/content.json) uses. The real site does not use them, so they
 * have no entry; the checks accept them when the site is built from the fixtures. Keep this list as short as the
 * fixtures allow.
 */
export const FIXTURE_ONLY: readonly string[] = ['ALM', 'API', 'BPM', 'PBS', 'VM'];

/** What counts as an abbreviation in running text: two or more capitals or digits, such as "ERP", "T-SQL" or "DP-300". */
export const ABBREVIATION = /\b(?:[A-Z]-)?[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)*\b/g;

/** The words a glossary entry covers: "AS-IS / TO-BE" covers "AS-IS" and "TO-BE". */
export const knownWords = (): Set<string> => new Set(GLOSSARY.flatMap((entry) => entry.term.split('/').map((part) => part.trim())));

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isWordChar = (char: string | undefined) => char !== undefined && /[A-Za-z0-9-]/.test(char);

/**
 * Whether a text uses a term, as a whole word. An abbreviation (no lowercase letters) must match its case, so "AI" is
 * not found in "said"; other terms ignore case. A trailing "s" or "es" is allowed ("ERPs"). A word inside another
 * ("SQL" in "T-SQL") is not a match.
 */
export function usesTerm(text: string, term: string): boolean {
  const abbreviation = !/[a-z]/.test(term);
  const pattern = new RegExp(escape(term), abbreviation ? 'g' : 'gi');
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const before = text[match.index - 1];
    const after = text.slice(match.index + match[0].length).replace(/^(?:es|s)(?![A-Za-z0-9-])/, '');
    if (!isWordChar(before) && !isWordChar(after[0])) return true;
  }
  return false;
}
