module.exports = {
  measureStatementCoverage: false,
  measureFunctionCoverage: true,
  measureModifierCoverage: true,
  skipFiles: [
    // 'external/abracadabra',
    // 'external/general',
    // 'external/glp',
    // 'external/gmxV2',
    // 'external/helpers',
    // 'external/interestsetters',
    'external/interfaces',
    // 'external/jones',
    // 'external/lib',
    // 'external/liquidators',
    // 'external/oracles',
    // 'external/pendle',
    // 'external/plutus',
    // 'external/proxies',
    // 'external/staking',
    // 'external/traders',
    // 'external/umami',
    // 'protocol/',
    'test/',
    'utils/',
  ],
  configureYulOptimizer: true,
  solcOptimizerDetails: {
    peephole: false,
    inliner: false,
    jumpdestRemover: false,
    orderLiterals: true,  // <-- TRUE! Stack too deep when false
    deduplicate: false,
    cse: false,
    constantOptimizer: false,
    yul: false
  }
};
