import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network, ONE_BI } from 'packages/base/src/utils/no-deps-constants';
import { deployPendlePtSystem, prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../utils/dry-run-utils';
import getScriptName from '../../../../utils/get-script-name';
import ModuleDeployments from '../../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Deploys PT-GLP (SEP 2024) unwrapper / wrapper V3
 * - Deploys PT-weETH (JUN 2024) unwrapper / wrapper V3
 * - Sets DPX supply cap to 1 unit
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const transactions = [];
  const glpPendleSystem = await deployPendlePtSystem(
    core,
    'GLPSep2024',
    core.pendleEcosystem.glpSep2024.glpMarket,
    core.pendleEcosystem.glpSep2024.ptOracle,
    core.pendleEcosystem.glpSep2024.ptGlpToken,
    core.pendleEcosystem.syGlpSep2024Token,
    core.tokens.sGlp,
  );
  const weEthPendleSystem = await deployPendlePtSystem(
    core,
    'WeETHJun2024',
    core.pendleEcosystem.weEthJun2024.weEthMarket,
    core.pendleEcosystem.weEthJun2024.ptOracle,
    core.pendleEcosystem.weEthJun2024.ptWeEthToken,
    core.pendleEcosystem.syWeEthToken,
    core.tokens.weEth,
  );

  const oldPtGlpUnwrapper = ModuleDeployments.PendlePtGLPSep2024IsolationModeUnwrapperTraderV2[network].address;
  const oldPtGlpWrapper = ModuleDeployments.PendlePtGLPSep2024IsolationModeWrapperTraderV2[network].address;

  const oldPtWeEthUnwrapper = ModuleDeployments.PendlePtWeETHJun2024IsolationModeUnwrapperTraderV2[network].address;
  const oldPtWeEthWrapper = ModuleDeployments.PendlePtWeETHJun2024IsolationModeWrapperTraderV2[network].address;

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: glpPendleSystem.factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [oldPtGlpUnwrapper, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: glpPendleSystem.factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [oldPtGlpWrapper, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: glpPendleSystem.factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [glpPendleSystem.unwrapper.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: glpPendleSystem.factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [glpPendleSystem.wrapper.address, true],
    ),

    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: weEthPendleSystem.factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [oldPtWeEthUnwrapper, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: weEthPendleSystem.factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [oldPtWeEthWrapper, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: weEthPendleSystem.factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [weEthPendleSystem.unwrapper.address, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: weEthPendleSystem.factory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [weEthPendleSystem.wrapper.address, true],
    ),

    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetMaxWei',
      [core.marketIds.dpx, 1],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      assertHardhatInvariant(
        !(await glpPendleSystem.factory.isTokenConverterTrusted(oldPtGlpUnwrapper)),
        'Old PT-GLP unwrapper is trusted',
      );
      assertHardhatInvariant(
        !(await glpPendleSystem.factory.isTokenConverterTrusted(oldPtGlpWrapper)),
        'Old PT-GLP unwrapper is trusted',
      );
      assertHardhatInvariant(
        await glpPendleSystem.factory.isTokenConverterTrusted(glpPendleSystem.unwrapper.address),
        'PT-GLP unwrapper is not trusted',
      );
      assertHardhatInvariant(
        await glpPendleSystem.factory.isTokenConverterTrusted(glpPendleSystem.wrapper.address),
        'PT-GLP unwrapper is not trusted',
      );

      assertHardhatInvariant(
        !(await weEthPendleSystem.factory.isTokenConverterTrusted(oldPtWeEthUnwrapper)),
        'Old PT-eETH unwrapper is trusted',
      );
      assertHardhatInvariant(
        !(await weEthPendleSystem.factory.isTokenConverterTrusted(oldPtWeEthWrapper)),
        'Old PT-eETH unwrapper is trusted',
      );
      assertHardhatInvariant(
        await weEthPendleSystem.factory.isTokenConverterTrusted(weEthPendleSystem.unwrapper.address),
        'PT-eETH unwrapper is not trusted',
      );
      assertHardhatInvariant(
        await weEthPendleSystem.factory.isTokenConverterTrusted(weEthPendleSystem.wrapper.address),
        'PT-eETH unwrapper is not trusted',
      );

      const maxWei = await core.dolomiteMargin.getMarketMaxWei(core.marketIds.dpx);
      assertHardhatInvariant(
        maxWei.value.eq(ONE_BI),
        'Invalid DPX max wei',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
