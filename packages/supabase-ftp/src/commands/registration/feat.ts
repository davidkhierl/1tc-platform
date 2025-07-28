import { CommandRegistry } from '../registry.js';

const feat: CommandRegistry = {
  directive: 'FEAT',
  handler: async function () {
    const registry = (await import('../registry.js')).default;
    const featuresSet = new Set<string>();

    Object.keys(registry).forEach(cmd => {
      const feat = registry[cmd]?.flags?.feat ?? null;
      if (feat) featuresSet.add(feat);
    });

    if (this.server.options.anonymous) {
      featuresSet.add('ANON');
    }

    const features = Array.from(featuresSet)
      .sort()
      .map(feat => ({
        message: ` ${feat}`,
        raw: true,
      }));

    if (features.length === 0) {
      return this.reply(211, 'No features');
    }

    return this.reply(211, 'Extensions supported:', ...features, 'End');
  },

  syntax: '{{cmd}}',
  description: 'Get the feature list implemented by the server',
  flags: {
    no_auth: true,
  },
};

export default feat;
