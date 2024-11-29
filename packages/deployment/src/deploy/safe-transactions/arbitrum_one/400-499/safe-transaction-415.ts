import { getAndCheckSpecificNetwork } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from 'packages/base/test/utils';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../../../utils/dry-run-utils';
import getScriptName from '../../../../../utils/get-script-name';

const HARVEST_DAI = '0xA95E010aF63196747F459176A1B85d250E8211b4';
const HARVEST_USDC = '0xD174dd89af9F58804B47A67435317bc31f971cee';
const HARVEST_USDT = '0x257b80afB7143D8877D16Aae58ffCa4C0b1D3F13';
const HARVEST_WBTC = '0xFDF482245b68CfEB89b3873Af9f0Bb210d815A7C';
const HARVEST_USDC_e = '0x6C7d2382Ec65582c839BC4f55B55922Be69f8764';
const HARVEST_GMX = '0x2E53f490FB438c9d2d0d7D7Ab17153A2f4a20870';
const HARVEST_ETH = '0x905Fea083FbbcaCf1cF1c7Bb15f6504A458cCACb';

/**
 * This script encodes the following transactions:
 * - Sets the Harvest Finance strategies as transfer agents on Minerals
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const mineralTokenImplementationAddress = await deployContractAndSave(
    'MineralToken',
    [core.dolomiteMargin.address],
    'MineralTokenImplementationV2',
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { mineralTokenProxy: core.liquidityMiningEcosystem.minerals.mineralTokenProxy },
      'mineralTokenProxy',
      'upgradeTo',
      [mineralTokenImplementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { mineralToken: core.liquidityMiningEcosystem.minerals.mineralToken },
      'mineralToken',
      'ownerSetIsTransferAgent',
      [HARVEST_DAI, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { mineralToken: core.liquidityMiningEcosystem.minerals.mineralToken },
      'mineralToken',
      'ownerSetIsTransferAgent',
      [HARVEST_USDC, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { mineralToken: core.liquidityMiningEcosystem.minerals.mineralToken },
      'mineralToken',
      'ownerSetIsTransferAgent',
      [HARVEST_USDT, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { mineralToken: core.liquidityMiningEcosystem.minerals.mineralToken },
      'mineralToken',
      'ownerSetIsTransferAgent',
      [HARVEST_WBTC, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { mineralToken: core.liquidityMiningEcosystem.minerals.mineralToken },
      'mineralToken',
      'ownerSetIsTransferAgent',
      [HARVEST_USDC_e, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { mineralToken: core.liquidityMiningEcosystem.minerals.mineralToken },
      'mineralToken',
      'ownerSetIsTransferAgent',
      [HARVEST_GMX, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { mineralToken: core.liquidityMiningEcosystem.minerals.mineralToken },
      'mineralToken',
      'ownerSetIsTransferAgent',
      [HARVEST_ETH, true],
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
      const mineralToken = core.liquidityMiningEcosystem.minerals.mineralToken;
      assertHardhatInvariant(
        await mineralToken.isTransferAgent(HARVEST_DAI),
        'Invalid transfer agent for HARVEST_DAI',
      );
      assertHardhatInvariant(
        await mineralToken.isTransferAgent(HARVEST_USDC),
        'Invalid transfer agent for HARVEST_USDC',
      );
      assertHardhatInvariant(
        await mineralToken.isTransferAgent(HARVEST_USDT),
        'Invalid transfer agent for HARVEST_USDT',
      );
      assertHardhatInvariant(
        await mineralToken.isTransferAgent(HARVEST_WBTC),
        'Invalid transfer agent for HARVEST_WBTC',
      );
      assertHardhatInvariant(
        await mineralToken.isTransferAgent(HARVEST_USDC_e),
        'Invalid transfer agent for HARVEST_USDC_e',
      );
      assertHardhatInvariant(
        await mineralToken.isTransferAgent(HARVEST_GMX),
        'Invalid transfer agent for HARVEST_GMX',
      );
      assertHardhatInvariant(
        await mineralToken.isTransferAgent(HARVEST_ETH),
        'Invalid transfer agent for HARVEST_ETH',
      );
    },
  };
}

doDryRunAndCheckDeployment(main);
