import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeUnwrapperTraderV2__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { GMX_GOV_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitDays,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupGMXBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { getUnwrapZapParams } from '@dolomite-exchange/modules-base/test/utils/zap-utils';
import deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  IGLPIsolationModeVaultFactoryOld,
  IGMXIsolationModeVaultFactory,
  TestGLPIsolationModeTokenVaultV2,
  TestGLPIsolationModeTokenVaultV2__factory,
  TestGMXIsolationModeTokenVaultV1,
  TestGMXIsolationModeTokenVaultV1__factory,
} from '../src/types';
import { createGMXIsolationModeTokenVaultV1 } from './glp-ecosystem-utils';

const gmxAmount = parseEther('10'); // 10 GMX
const esGmxAmount = parseEther('0.01'); // 0.01 esGMX tokens
const accountNumber = ZERO_BI;
const otherAccountNumber = BigNumber.from('123');

describe('GMXIsolationModeTokenVaultV1_swapExactInputForOutput', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let gmxFactory: IGMXIsolationModeVaultFactory;
  let glpFactory: IGLPIsolationModeVaultFactoryOld;
  let gmxVault: TestGMXIsolationModeTokenVaultV1;
  let glpVault: TestGLPIsolationModeTokenVaultV2;
  let gmxMarketId: BigNumberish;
  let underlyingMarketIdGmx: BigNumberish;

  before(async () => {
    const network = Network.ArbitrumOne;
    core = await setupCoreProtocol({
      network,
      blockNumber: await getRealLatestBlockNumber(true, network),
    });

    glpFactory = core.gmxEcosystem.live.dGlp.connect(core.hhUser1);
    gmxFactory = core.gmxEcosystem.live.dGmx.connect(core.hhUser1);

    await core.testEcosystem!.testPriceOracle.setPrice(glpFactory.address, '1000000000000000000');
    await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.dfsGlp!, core.testEcosystem!.testPriceOracle.address);

    unwrapper = SimpleIsolationModeUnwrapperTraderV2__factory.connect(
      deployments.GMXIsolationModeUnwrapperTraderV4[network].address,
      core.hhUser1,
    );
    underlyingMarketIdGmx = core.marketIds.dGmx!;
    await core.testEcosystem!.testPriceOracle.setPrice(gmxFactory.address, '1000000000000000000');
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketIdGmx, core.testEcosystem!.testPriceOracle.address);

    gmxMarketId = core.marketIds.gmx!;
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.gmx.address, '1000000000000000000');
    await core.dolomiteMargin.ownerSetPriceOracle(gmxMarketId, core.testEcosystem!.testPriceOracle.address);

    const implementation = await createGMXIsolationModeTokenVaultV1();
    await gmxFactory.connect(core.governance).ownerSetUserVaultImplementation(implementation.address);

    await gmxFactory.createVault(core.hhUser1.address);
    gmxVault = setupUserVaultProxy<TestGMXIsolationModeTokenVaultV1>(
      await gmxFactory.getVaultByAccount(core.hhUser1.address),
      TestGMXIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    glpVault = setupUserVaultProxy<TestGLPIsolationModeTokenVaultV2>(
      await glpFactory.getVaultByAccount(core.hhUser1.address),
      TestGLPIsolationModeTokenVaultV2__factory,
      core.hhUser1,
    );

    // Make sure distributor has high tokens per interval and enough esGMX
    await core.gmxEcosystem.esGmxDistributorForStakedGmx.setTokensPerInterval('10333994708994708');
    const gov = await impersonate(GMX_GOV_MAP[Network.ArbitrumOne]!, true);
    await core.gmxEcosystem.esGmx.connect(gov).mint(
      core.gmxEcosystem.esGmxDistributorForStakedGmx.address,
      parseEther('100000000'),
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  async function doHandleRewardsWithWaitTime(daysToWait: number) {
    if (daysToWait > 0) {
      await waitDays(daysToWait);
    }
    await glpVault.handleRewardsWithSpecificDepositAccountNumber(
      true,
      false,
      true,
      false,
      true,
      true,
      false,
      accountNumber,
    );
  }

  describe('#swapExactInputForOutput', () => {
    it('should work normally with no staked GMX', async () => {
      // Set max wei to greater than 1 for testing purposes
      await core.dolomiteMargin.ownerSetMaxWei(gmxMarketId, parseEther('1000000000000000000'));
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.transferIntoPositionWithUnderlyingToken(accountNumber, otherAccountNumber, gmxAmount);

      const zapParams = await getUnwrapZapParams(
        underlyingMarketIdGmx,
        gmxAmount,
        gmxMarketId,
        ONE_BI,
        unwrapper,
        core,
      );
      await gmxVault.swapExactInputForOutput(
        123,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, gmxMarketId, gmxAmount);
    });

    it('should work normally with staked GMX', async () => {
      // Set max wei to greater than 1 for testing purposes
      await core.dolomiteMargin.ownerSetMaxWei(gmxMarketId, parseEther('1000000000000000000'));
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.transferIntoPositionWithUnderlyingToken(accountNumber, otherAccountNumber, gmxAmount);

      const zapParams = await getUnwrapZapParams(
        underlyingMarketIdGmx,
        gmxAmount,
        gmxMarketId,
        ONE_BI,
        unwrapper,
        core,
      );
      await gmxVault.swapExactInputForOutput(
        123,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, gmxMarketId, gmxAmount);
    });

    it('should work normally with vested GMX and sweep', async () => {
      // Set max wei to greater than 1 for testing purposes
      await core.dolomiteMargin.ownerSetMaxWei(gmxMarketId, parseEther('1000000000000000000'));
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.transferIntoPositionWithUnderlyingToken(accountNumber, otherAccountNumber, gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      await waitDays(366);

      const zapParams = await getUnwrapZapParams(
        underlyingMarketIdGmx,
        gmxAmount,
        gmxMarketId,
        ONE_BI,
        unwrapper,
        core,
      );
      await gmxVault.swapExactInputForOutput(
        123,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, esGmxAmount);
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, otherAccountNumber, gmxMarketId, gmxAmount);
    });
  });
});
