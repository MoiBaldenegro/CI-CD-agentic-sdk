module.exports = (defaultOptions) => ({
  resolve: {
    ...defaultOptions.resolve,
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
});
