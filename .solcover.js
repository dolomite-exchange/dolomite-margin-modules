module.exports = {
  measureStatementCoverage: true,
  measureFunctionCoverage: true,
  measureModifierCoverage: true,
  skipFiles: [
    'test/',
    'utils/',
    'external/umami',
    'external/abracadabra',
    'external/glp',
    'external/jones',
    'external/oracles',
    'external/pendle',
    'external/proxies',
    'external/plutus',
    'external/traders',
  ],
};
