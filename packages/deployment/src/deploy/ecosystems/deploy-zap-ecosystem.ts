import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { NetworkType } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

const OLD_ADDRESSES: Record<'GenericTraderProxyV1' | 'LiquidatorProxyV4WithGenericTrader', Record<number, any>> = {
  GenericTraderProxyV1: {
    196: {
      address: '0xE355Df372C4FAaeDf895B958De5D7FB89215aeEa',
      transactionHash: '0x3f30daad1fa49224712152ed6fbc32fad1b1f8b8657fffb3008c6526827864ee',
    },
    1101: {
      address: '0x660bd80f67Aa9C7bFB82933e1068F8F616D88255',
      transactionHash: '0xe5c1af5073902909f5d7488508d1f81ababf79a69545d2b6268c6eb197e70387',
    },
    5000: {
      address: '0x8A13C00facd1971FBb7CED5EbF88f9e900419D5C',
      transactionHash: '0xa55d5883712ffb9cfeaab1aebf34f89d5c38f7979ed4d297b3cfac40f71a8ca1',
    },
    8453: {
      address: '0x4C08681c6D8E9857fE6FBD0ba39C427199Ea32d0',
      transactionHash: '0x0f824310323d08805a2ed5ec70506508b0f2624a58bcf09330bf3660b675d49a',
    },
    42161: {
      address: '0xe50c3118349f09abafc1bb01ad5cb946b1de83f6',
      transactionHash: '0xb74148f90d9cba2bcfcca7c7189bff24c72705339afc64577d71f498a8fbda39',
    },
    80084: {
      address: '0xbE6c38709FAb83c8e0FE4319a5Ee1440cf128f52',
      transactionHash: '0xf5edc393c279cfbd2ce36c9c2dcd71b5886e6ec363dedb272e7fe6fe28608a6d',
    },
  },
  LiquidatorProxyV4WithGenericTrader: {
    196: {
      address: '0x277118ca98f7A8C26Afeb12928D0A37eDb382D7e',
      transactionHash: '0xba651f3306203a131abf4fc35c8c99b4263e89c51cd754aece60f72d62c2b7d8',
    },
    1101: {
      address: '0x66D4D46B140149DfA603DE01Aac4b33723495001',
      transactionHash: '0xd19dd4dcf53e111bb158b46b8f2c10d8de6f92a3e76faf19f0cb6c7a1324901e',
    },
    5000: {
      address: '0x17b8bcF4B7Cc3782d4c67407dE6144A904a77F2C',
      transactionHash: '0x866e19a62565fff999f1744f32183773c0cd31de3ab44548796f02d5cc4c3d85',
    },
    8453: {
      address: '0x22dd9f4393a3cc698D6C09AD14B0b9D515084FC7',
      transactionHash: '0x56506d32d3cbef32d863743b9edd03bf57102053562720fec0df958b26d92c36',
    },
    42161: {
      address: '0x34975624E992bF5c094EF0CF3344660f7AaB9CB3',
      transactionHash: '0x865d8530dc2ff97a3a42739ba1ba0aaf59960ec8f74f47cec2bc0a1495cb6ada',
    },
    80084: {
      address: '0x21EbaF74f534d9aC9270DFA5ff9612123D677689',
      transactionHash: '0x4d6b7fa8daab702ca8a7c591b52bc44e79d6a3ccf803bb75ff2ce800fdb71a2b',
    },
  },
};

async function main<T extends NetworkType>(): Promise<DryRunOutput<T>> {
  const network = (await getAnyNetwork()) as T;
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions: EncodedTransaction[] = [
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetGlobalOperator',
      [OLD_ADDRESSES.GenericTraderProxyV1[core.config.networkNumber].address, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetGlobalOperator',
      [OLD_ADDRESSES.LiquidatorProxyV4WithGenericTrader[core.config.networkNumber].address, false],
    ),
  ];

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: 'Migrate Zap Ecosystem',
      },
    },
    invariants: async () => {
      assertHardhatInvariant(
        !(await core.dolomiteMargin.getIsGlobalOperator(
          OLD_ADDRESSES.GenericTraderProxyV1[core.config.networkNumber].address,
        )),
        'GenericTraderProxyV1 must not be operator',
      );
      assertHardhatInvariant(
        !(await core.dolomiteMargin.getIsGlobalOperator(
          OLD_ADDRESSES.LiquidatorProxyV4WithGenericTrader[core.config.networkNumber].address,
        )),
        'LiquidatorProxyV4WithGenericTrader must not be operator',
      );
    },
  };
}

// noinspection JSIgnoredPromiseFromCall
doDryRunAndCheckDeployment(main);
