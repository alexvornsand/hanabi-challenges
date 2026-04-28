import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  dslSidebar: [
    'intro',
    {
      type: 'category',
      label: 'DSL Reference',
      collapsed: false,
      items: ['dsl/fields', 'dsl/expressions', 'dsl/generators'],
    },
  ],
  examplesSidebar: [
    {
      type: 'category',
      label: 'Examples',
      collapsed: false,
      items: ['examples/nvc', 'examples/boom-and-bloom', 'examples/gauntlet'],
    },
  ],
};

export default sidebars;
