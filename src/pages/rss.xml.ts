import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getPosts, getProfile } from '../lib/content';

export const GET: APIRoute = async (context) => {
  const [profile, posts] = await Promise.all([getProfile(), getPosts()]);
  return rss({
    title: `${profile.display_name} — carlos.nz`,
    description: profile.subheadline,
    site: context.site ?? 'https://carlos.nz',
    trailingSlash: true,
    items: posts
      .filter((p) => p.status === 'published')
      .map((p) => ({
        title: p.title,
        description: p.excerpt,
        link: `/posts/${p.slug}/`,
        pubDate: new Date(p.published_at ?? Date.now()),
        categories: [p.category, ...p.tags],
      })),
    customData: '<language>en-nz</language>',
  });
};
