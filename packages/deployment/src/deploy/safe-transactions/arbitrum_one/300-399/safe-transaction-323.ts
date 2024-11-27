import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { getRamsesCLPriceOracleV3ConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { expect } from 'chai';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import ModuleDeployments from '../../deployments.json';

const GRAI_USDC_POOL = '0x1a30f6c99fe9f9e1607fda54e1c76dc03000f9d8';

/**
 * This script encodes the following transactions:
 * - Updates the GRAI price feed to use the newest pool
 * - Updates the dTokens to restrict receivers via registry
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  console.log('\tGRAI price before:', (await core.dolomiteMargin.getMarketPrice(core.marketIds.grai)).value.toString());

  const graiUsdcOracleAddress = await deployContractAndSave(
    'RamsesCLPriceOracle',
    getRamsesCLPriceOracleV3ConstructorParams(core, core.tokens.grai, GRAI_USDC_POOL),
    'GraiUsdcPriceOracleV3',
  );
  const graiFraxOracleAddress = ModuleDeployments.GraiFraxPriceOracleV3[network].address;

  const dolomiteErc20ImplementationV3Address = await deployContractAndSave(
    'DolomiteERC20',
    [],
    'DolomiteERC20ImplementationV3',
  );
  const dolomiteErc20WithPayableImplementationV3Address = await deployContractAndSave(
    'DolomiteERC20WithPayable',
    [core.tokens.weth.address],
    'DolomiteERC20WithPayableImplementationV3',
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { oracleAggregator: core.oracleAggregatorV2 },
      'oracleAggregator',
      'ownerInsertOrUpdateToken',
      [
        {
          oracleInfos: [
            { oracle: graiUsdcOracleAddress, tokenPair: core.tokens.nativeUsdc.address, weight: 67 },
            { oracle: graiFraxOracleAddress, tokenPair: core.tokens.frax.address, weight: 33 },
          ],
          decimals: 18,
          token: core.tokens.grai.address,
        },
      ],
    ),
    await prettyPrintEncodedDataWithTypeSafety(core, { proxy: core.dTokens.usdcProxy }, 'proxy', 'upgradeTo', [
      dolomiteErc20ImplementationV3Address,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { proxy: core.dTokens.wbtcProxy }, 'proxy', 'upgradeTo', [
      dolomiteErc20ImplementationV3Address,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { proxy: core.dTokens.wethProxy }, 'proxy', 'upgradeTo', [
      dolomiteErc20WithPayableImplementationV3Address,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { dToken: core.dTokens.usdc }, 'dToken', 'initializeVersion3', [
      core.dolomiteRegistry.address,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { dToken: core.dTokens.wbtc }, 'dToken', 'initializeVersion3', [
      core.dolomiteRegistry.address,
    ]),
    await prettyPrintEncodedDataWithTypeSafety(core, { dToken: core.dTokens.weth }, 'dToken', 'initializeVersion3', [
      core.dolomiteRegistry.address,
    ]),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    skipTimeDelay: true,
    invariants: async () => {
      console.log(
        '\tGRAI price after:',
        (await core.dolomiteMargin.getMarketPrice(core.marketIds.grai)).value.toString(),
      );
      expect(await core.dTokens.usdc.dolomiteRegistry()).to.eq(core.dolomiteRegistry.address);
      expect(await core.dTokens.wbtc.dolomiteRegistry()).to.eq(core.dolomiteRegistry.address);
      expect(await core.dTokens.weth.dolomiteRegistry()).to.eq(core.dolomiteRegistry.address);
    },
  };
}

doDryRunAndCheckDeployment(main);
