import { MetaVaultOperator, MetaVaultOperator__factory } from '../src/types';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupNativeUSDCBalance
} from 'packages/base/test/utils/setup';
import { Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { BigNumber } from 'ethers';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { expectProtocolBalance } from 'packages/base/test/utils/assertions';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';

const usdcAmount = BigNumber.from('100000000');

describe('MetaVaultOperator', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let metaVaultOperator: MetaVaultOperator;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    metaVaultOperator = await createContractWithAbi<MetaVaultOperator>(
      MetaVaultOperator__factory.abi,
      MetaVaultOperator__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    await core.dolomiteMargin.ownerSetGlobalOperator(metaVaultOperator.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('depositIntoUserAccountFromMetaVault', async () => {
    it('should work normally', async () => {
      await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, metaVaultOperator);
      await metaVaultOperator.depositIntoUserAccountFromMetaVault(
        core.hhUser1.address,
        core.tokens.nativeUsdc.address,
        usdcAmount
      );
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.nativeUsdc, usdcAmount);
    });
  });
});
