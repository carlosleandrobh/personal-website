// Shapes of the rows the site reads. Mirrors supabase/migrations/*.sql.

export interface Profile {
  display_name: string;
  full_name: string;
  greeting: string;
  headline: string;
  subheadline: string;
  role_line: string;
  location: string;
  availability_text: string | null;
  is_available: boolean;
  years_experience: number;
  about_md: string | null;
  linkedin_url: string | null;
  github_username: string | null;
  portrait_alt: string;
}

export interface SpectrumArea {
  position: number;
  title: string;
  summary: string;
  icon: string;
  tags: string[];
}

export interface NowItem {
  position: number;
  label: string;
  title: string;
  description: string;
  icon: string;
  status_text: string | null;
  meta_text: string | null;
}

export type CertStatus = 'planned' | 'studying' | 'achieved';
export interface Certification {
  position: number;
  name: string;
  issuer: string | null;
  status: CertStatus;
  progress: number | null;
  target_label: string | null;
  credential_url: string | null;
}

export interface Experience {
  role: string;
  company: string;
  company_url: string | null;
  context: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  summary: string;
  highlights: string[];
  tags: string[];
}

export interface Education {
  degree: string;
  institution: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  in_progress: boolean;
}

export type LabStatus = 'live' | 'testing' | 'archived';
export interface Lab {
  slug: string;
  name: string;
  url: string;
  summary: string | null;
  status: LabStatus;
  category: string;
  tags: string[];
  icon: string;
  learned?: string | null;
  notes_post_slug?: string | null;
  repo_url?: string | null;
  started_on?: string | null;
  featured: boolean;
  position: number;
}

export interface HomelabItem {
  position: number;
  title: string;
  icon: string;
  lines: string[];
}

export type PostStatus = 'draft' | 'published' | 'archived';
export interface Post {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  body_md: string;
  category: string;
  tags: string[];
  cover_image_url?: string | null;
  cover_alt?: string | null;
  status: PostStatus;
  published_at: string | null;
  updated_at?: string | null;
  share_to_linkedin: boolean;
  linkedin_commentary: string | null;
  seo_description?: string | null;
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  pushed_at: string | null;
  featured: boolean;
}
