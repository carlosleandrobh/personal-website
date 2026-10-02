import type { APIRoute, GetStaticPaths } from 'astro';
import { getPosts, getProfile } from '../../lib/content';
import { readingMinutes } from '../../lib/markdown';
import { renderOg, type OgInput } from '../../lib/og';

export const getStaticPaths = (async () => {
  const [profile, posts] = await Promise.all([getProfile(), getPosts()]);
  const initials = profile.full_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  const base = { author: profile.display_name, role: profile.role_line, initials };
  const pages: { params: { slug: string }; props: OgInput }[] = [
    { params: { slug: 'default' }, props: { ...base, title: profile.headline, subtitle: profile.subheadline, kicker: 'Portfolio', meta: profile.location } },
    ...posts.map((post) => ({
      params: { slug: post.slug },
      props: { ...base, title: post.title, subtitle: post.excerpt, kicker: post.category, meta: `${readingMinutes(post.body_md)} min read · Auckland, NZ` },
    })),
  ];
  return pages;
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOg(props as OgInput);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
