export const SITE = {
  url: 'https://carlos.nz',
  name: 'carlos.nz',
  locale: 'en_NZ',
  // Bump when the privacy policy changes; stored with each contact-form consent.
  privacyVersion: '2026-10-08',
  nav: [
    { href: '/#about', label: 'About' },
    { href: '/#experience', label: 'Experience' },
    { href: '/labs/', label: 'Labs' },
    { href: '/projects/', label: 'Projects' },
    { href: '/posts/', label: 'Posts' },
  ],
} as const;
