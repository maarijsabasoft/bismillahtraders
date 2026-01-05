const webpack = require('webpack');

module.exports = function override(config, env) {
  // Ensure resolve exists
  if (!config.resolve) {
    config.resolve = {};
  }

  // Add fallbacks for Node.js modules
  config.resolve.fallback = {
    ...(config.resolve.fallback || {}),
    "fs": false,
    "path": require.resolve("path-browserify"),
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "util": require.resolve("util/"),
    "buffer": require.resolve("buffer/"),
    "process": require.resolve("process/browser"),
  };

  // Add plugins
  config.plugins = [
    ...(config.plugins || []),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ];

  // Ignore fs and path in sql.js
  config.module = config.module || {};
  config.module.rules = config.module.rules || [];
  
  return config;
};

