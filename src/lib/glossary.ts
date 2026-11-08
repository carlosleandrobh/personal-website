// Plain-language meanings for the terms used on the site and in posts (shown at /glossary/).
// Keep each meaning to one or two short sentences, with no jargon that is not itself in this list.
export interface GlossaryTerm {
  term: string;
  /** What the letters stand for, when it is an abbreviation. */
  expansion?: string;
  meaning: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  { term: 'AI', expansion: 'artificial intelligence', meaning: 'Software that does tasks which normally need human judgement, such as writing, sorting or spotting patterns.' },
  { term: 'ALM', expansion: 'application lifecycle management', meaning: 'The way a team plans, builds, tests and releases software in a controlled way, from the first idea to the live version.' },
  { term: 'API', expansion: 'application programming interface', meaning: 'A way for one program to ask another program for data or to do something.' },
  { term: 'AS-IS / TO-BE', meaning: 'Two diagrams of the same process. AS-IS shows how the work happens today. TO-BE shows how it should happen after the change.' },
  { term: 'Azure', meaning: 'Microsoft\'s cloud platform, where organisations rent computing and storage instead of owning the machines.' },
  { term: 'BABOK', expansion: 'Business Analysis Body of Knowledge', meaning: 'A guide from the IIBA that describes the methods and skills of business analysis.' },
  { term: 'BI', expansion: 'business intelligence', meaning: 'Reports and dashboards that turn an organisation\'s data into answers people can act on.' },
  { term: 'BPM', expansion: 'business process management', meaning: 'Managing how work flows through an organisation, step by step, so it can be measured and improved.' },
  { term: 'BPMN', expansion: 'Business Process Model and Notation', meaning: 'A standard way to draw a business process as a diagram that business people and developers can both read.' },
  { term: 'Business analysis', meaning: 'Working out what an organisation really needs, then describing a solution that people and technology can both deliver.' },
  { term: 'CBAP', expansion: 'Certified Business Analysis Professional', meaning: 'An advanced business analysis certification awarded by the IIBA.' },
  { term: 'CI/CD', expansion: 'continuous integration and continuous delivery', meaning: 'Automatic steps that test a change and publish it, so nobody has to do it by hand.' },
  { term: 'Cloudflare', meaning: 'A company whose network sits in front of this site. It speeds pages up and blocks abusive traffic.' },
  { term: 'CRM', expansion: 'customer relationship management', meaning: 'Software that keeps track of customers, sales and every conversation with them.' },
  { term: 'CSP', expansion: 'Content Security Policy', meaning: 'A rule the site gives your browser about which code it may run. It limits the damage if someone tries to sneak in bad code.' },
  { term: 'DAX', expansion: 'Data Analysis Expressions', meaning: 'The formula language used in Power BI to calculate figures from data.' },
  { term: 'DHCP', expansion: 'Dynamic Host Configuration Protocol', meaning: 'The service on a network that gives each device its address when it connects.' },
  { term: 'DNS', expansion: 'Domain Name System', meaning: 'The internet\'s phone book. It turns a name like carlos.nz into the address of a computer.' },
  { term: 'DP-300', meaning: 'A Microsoft exam for people who run databases on Azure.' },
  { term: 'ERP', expansion: 'enterprise resource planning', meaning: 'Software a business uses to run its finances, stock, people and orders in one place.' },
  { term: 'Homelab', meaning: 'A small set of computers at home used to try out tools and learn how they behave, away from real business systems.' },
  { term: 'HRIS', expansion: 'human resources information system', meaning: 'Software that holds employee records and handles things like payroll and leave.' },
  { term: 'HSQE', expansion: 'health, safety, quality and environment', meaning: 'The part of an organisation that keeps people safe and work to standard, and reports on both.' },
  { term: 'IIBA', expansion: 'International Institute of Business Analysis', meaning: 'The professional body for business analysts. It publishes the BABOK and awards the CBAP.' },
  { term: 'PBS', expansion: 'Proxmox Backup Server', meaning: 'Software that makes backups of virtual machines and can keep copies somewhere else.' },
  { term: 'Power BI', meaning: 'Microsoft\'s tool for turning data into charts, reports and dashboards.' },
  { term: 'Proxmox VE', expansion: 'Proxmox Virtual Environment', meaning: 'Free software that lets one physical computer run many virtual computers, and lets several computers work together.' },
  { term: 'QMS', expansion: 'quality management system', meaning: 'The procedures and records an organisation uses to show that its work meets a standard.' },
  { term: 'Reverse proxy', meaning: 'A server that receives requests from the internet and passes them to the right service behind it.' },
  { term: 'RLS', expansion: 'row-level security', meaning: 'A database feature that decides, row by row, who may read or change data.' },
  { term: 'RSS', expansion: 'Really Simple Syndication', meaning: 'A feed that lets you follow this site\'s posts in a news reader app, instead of visiting the site to check.' },
  { term: 'SQL', expansion: 'Structured Query Language', meaning: 'The standard language for asking a database for data and for changing it.' },
  { term: 'SQL Server', meaning: 'Microsoft\'s database software, widely used in business.' },
  { term: 'SSRS', expansion: 'SQL Server Reporting Services', meaning: 'Microsoft\'s tool for building printable reports from a database.' },
  { term: 'Supabase', meaning: 'The database service that stores this site\'s content. Visitors\' browsers never talk to it.' },
  { term: 'T-SQL', expansion: 'Transact-SQL', meaning: 'Microsoft\'s version of SQL, used with SQL Server.' },
  { term: 'Traefik', meaning: 'A reverse proxy that sends web traffic to the right service in a homelab.' },
  { term: 'Turnstile', meaning: 'Cloudflare\'s spam check on the contact form. It decides whether a visitor is a person without asking them to solve a puzzle.' },
  { term: 'VM', expansion: 'virtual machine', meaning: 'A computer that exists only as software, running inside a real computer.' },
  { term: 'WCAG', expansion: 'Web Content Accessibility Guidelines', meaning: 'The international rules for making websites usable by people with disabilities. This site aims for version 2.2, level AA.' },
];
