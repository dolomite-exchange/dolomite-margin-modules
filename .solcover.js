module.exports = {
  measureStatementCoverage: false,
  measureFunctionCoverage: true,
  measureModifierCoverage: true,
  skipFiles: [
    'external/interfaces',
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
