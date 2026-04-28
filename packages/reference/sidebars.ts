import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  dslSidebar: [
    'intro',
    {
      type: 'category',
      label: 'event',
      link: { type: 'doc', id: 'event/index' },
      items: [
        'event/aggregation-function',
        'event/time-window',
        'event/capture-policy',
        'event/registration-policy',
        'event/visibility-policy',
        'event/matchmaking',
        'event/advancement',
        'event/routing',
        'event/dimensions',
        'event/absence-policy',
        'event/promotion-relegation',
        {
          type: 'category',
          label: 'sections',
          link: { type: 'doc', id: 'event/sections/index' },
          items: [
            'event/sections/slots',
            'event/sections/awards',
            'event/sections/scoreboards',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'generators',
      link: { type: 'doc', id: 'generators/index' },
      items: [
        'generators/bracket-generators',
        'generators/lazy-slots',
      ],
    },
    'expressions',
  ],
  examplesSidebar: [
    'examples/nvc',
    'examples/boom-and-bloom',
    'examples/gauntlet',
  ],
};

export default sidebars;
