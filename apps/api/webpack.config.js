const { composePlugins, withNx } = require('@nx/webpack');

/**
 * Run via the `@nx/webpack:webpack` executor. `withNx()` applies the Node build
 * (main / tsConfig / assets / target / compiler / optimization …) from the
 * executor options in project.json — and, crucially, makes the build
 * watch-capable so `@nx/js:node` serve hot-restarts on source changes.
 */
module.exports = composePlugins(withNx(), (config) => {
  if (process.env.NODE_ENV !== 'production') {
    config.output = {
      ...config.output,
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    };
  }
  return config;
});
