const webpack = require('webpack');

module.exports = function override(config, env) {
  // Добавляем только необходимые полифилы
  config.resolve.fallback = {
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    assert: require.resolve('assert'),
    http: false,
    https: false,
    os: false,
    url: false
  };
  
  // Убираем ProvidePlugin для process/browser, чтобы избежать ошибки с dynamic import
  // Вместо этого добавляем глобальные определения
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env),
      'process.env': '{}' // или конкретные переменные окружения
    })
  );
  
  return config;
};
