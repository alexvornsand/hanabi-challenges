import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Hanabi Challenges — Reference',
  tagline: 'Event configuration reference and DSL guide',
  url: 'http://localhost:5173',
  baseUrl: '/reference/',
  onBrokenLinks: 'warn',
  favicon: undefined,

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Hanabi Reference',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'dslSidebar',
          position: 'left',
          label: 'DSL',
        },
        {
          type: 'docSidebar',
          sidebarId: 'examplesSidebar',
          position: 'left',
          label: 'Examples',
        },
      ],
    },
    prism: {
      additionalLanguages: ['yaml', 'bash'],
    },
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
