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
  { term: 'API', expansion: 'application programming interface', meaning: 'A way for one program to ask another program for data or to do something.' },
  { term: 'Business analysis', meaning: 'Working out what an organisation really needs, then describing a solution that people and technology can both deliver.' },
  { term: 'CI/CD', expansion: 'continuous integration and continuous delivery', meaning: 'Automatic steps that test a change and publish it, so nobody has to do it by hand.' },
  { term: 'Cloudflare', meaning: 'A company whose network sits in front of this site. It speeds pages up and blocks abusive traffic.' },
  { term: 'CSP', expansion: 'Content Security Policy', meaning: 'A rule the site gives your browser about which code it may run. It limits the damage if someone tries to sneak in bad code.' },
  { term: 'DHCP', expansion: 'Dynamic Host Configuration Protocol', meaning: 'The service on a network that gives each device its address when it connects.' },
  { term: 'DNS', expansion: 'Domain Name System', meaning: 'The internet\'s phone book. It turns a name like carlos.nz into the address of a computer.' },
  { term: 'ERP', expansion: 'enterprise resource planning', meaning: 'Software a business uses to run its finances, stock, people and orders in one place.' },
  { term: 'Homelab', meaning: 'A small set of computers at home used to try out tools and learn how they behave, away from real business systems.' },
  { term: 'Proxmox VE', expansion: 'Proxmox Virtual Environment', meaning: 'Free software that lets one physical computer run many virtual computers, and lets several computers work together.' },
  { term: 'Reverse proxy', meaning: 'A server that receives requests from the internet and passes them to the right service behind it.' },
  { term: 'RLS', expansion: 'row-level security', meaning: 'A database feature that decides, row by row, who may read or change data.' },
  { term: 'Supabase', meaning: 'The database service that stores this site\'s content. Visitors\' browsers never talk to it.' },
  { term: 'Traefik', meaning: 'A reverse proxy that sends web traffic to the right service in a homelab.' },
  { term: 'Turnstile', meaning: 'Cloudflare\'s spam check on the contact form. It decides whether a visitor is a person without asking them to solve a puzzle.' },
  { term: 'VM', expansion: 'virtual machine', meaning: 'A computer that exists only as software, running inside a real computer.' },
  { term: 'WCAG', expansion: 'Web Content Accessibility Guidelines', meaning: 'The international rules for making websites usable by people with disabilities. This site aims for version 2.2, level AA.' },
];
