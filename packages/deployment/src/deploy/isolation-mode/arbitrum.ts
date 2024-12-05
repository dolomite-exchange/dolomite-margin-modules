import { TokenVaultDeployerParams } from "packages/base/test/utils/ecosystem-utils/isolation-mode";

export const marketToIsolationModeVaultInfoArbitrumOne: Record<number, TokenVaultDeployerParams> = {
  6: {
    contractName: 'GLPIsolationModeTokenVaultV2',
    implementationAddress: '0x56359da5151AB4B12370690a4E81ea09Ae6Ad212',
    constructorParams: [],
    libraries: {
      'IsolationModeTokenVaultV1ActionsImpl': '0x2CCEF16241ef4008Edd777D509f5931AC57Ff5D2'
    },
    currentVersionNumber: 6,
    marketId: 6,
  },
  22: {
    contractName: 'PendlePtIsolationModeTokenVaultV1',
    implementationAddress: '0xE47C41C33C198676F0998b9c7d8f3e5fd10e46D9',
    constructorParams: [],
    libraries: {
      'IsolationModeTokenVaultV1ActionsImpl': '0x2CCEF16241ef4008Edd777D509f5931AC57Ff5D2'
    },
    currentVersionNumber: 5,
    marketId: 22,
  },
  28: {
    contractName: 'ARBIsolationModeTokenVaultV1',
    implementationAddress: '0x44122d653D5E2d2AC1F8C684093C22318748B99E',
    constructorParams: [],
    libraries: {
      'IsolationModeTokenVaultV1ActionsImpl': '0x2CCEF16241ef4008Edd777D509f5931AC57Ff5D2'
    },
    currentVersionNumber: 7,
    marketId: 28,
  },
  34: {
    contractName: 'GmxV2IsolationModeTokenVaultV1',
    implementationAddress: '0x818f986eDc9A208497206f816e4F6042d3440fB1',
    constructorParams: ['0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 42161],
    libraries: {
      'IsolationModeTokenVaultV1ActionsImpl': '0x2CCEF16241ef4008Edd777D509f5931AC57Ff5D2',
      'GmxV2Library': '0xD7B6b9e73F3F0Ee8062942772aFA877A2CB3a374',
      'SafeDelegateCallLib': '0xAA65096eBB42635238865eCA79f6a9F61D8bb425'
    },
    currentVersionNumber: 15,
    marketId: 34,
  }
};
