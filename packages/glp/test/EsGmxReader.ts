import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { GMX_GOV_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { MAX_UINT_256_BI, Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitDays,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupGMXBalance,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { DolomiteAccountRegistry__factory } from 'packages/base/src/types';
import {
  createAndUpgradeDolomiteRegistry,
  createDolomiteAccountRegistryImplementation,
  createRegistryProxy,
} from 'packages/base/test/utils/dolomite';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  EsGmxReader,
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeTokenVaultV1__factory,
  GMXIsolationModeVaultFactory,
  GmxRegistryV1,
  IGLPIsolationModeVaultFactoryOld,
  TestGLPIsolationModeTokenVaultV2,
  TestGLPIsolationModeTokenVaultV2__factory,
} from '../src/types';
import {
  createEsGmxReader,
  createGMXIsolationModeTokenVaultV1,
  createGMXIsolationModeVaultFactory,
  createGmxRegistry,
  createTestGLPIsolationModeTokenVaultV2,
} from './glp-ecosystem-utils';
import { DEFAULT_BLOCK_NUMBER_FOR_GLP_WITH_VESTING } from './glp-utils';

const gmxAmount = BigNumber.from('10000000000000000000'); // 10 GMX
const usdcAmount = BigNumber.from('2000000000'); // 2,000 USDC
const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 GLP tokens

const esGmxAmount = BigNumber.from('10000000000000000'); // 0.01 esGMX tokens
const accountNumber = ZERO_BI;

describe('EsGmxReader', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let glpFactory: IGLPIsolationModeVaultFactoryOld;
  let gmxFactory: GMXIsolationModeVaultFactory;
  let glpVault: TestGLPIsolationModeTokenVaultV2;
  let gmxVault: GMXIsolationModeTokenVaultV1;

  let underlyingGlpMarketId: BigNumber;
  let underlyingGmxMarketId: BigNumber;
  let gmxRegistry: GmxRegistryV1;
  let account: AccountInfoStruct;
  let esGmxReader: EsGmxReader;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: DEFAULT_BLOCK_NUMBER_FOR_GLP_WITH_VESTING,
      network: Network.ArbitrumOne,
    });
    gmxRegistry = await createGmxRegistry(core);
    await createAndUpgradeDolomiteRegistry(core);

    const vaultImplementation = await createTestGLPIsolationModeTokenVaultV2();
    glpFactory = core.gmxEcosystem!.live.dGlp;
    await glpFactory.connect(core.governance).setUserVaultImplementation(vaultImplementation.address);
    await glpFactory.connect(core.governance).setGmxRegistry(gmxRegistry.address);

    const gmxVaultImplementation = await createGMXIsolationModeTokenVaultV1();
    gmxFactory = await createGMXIsolationModeVaultFactory(core, gmxRegistry, gmxVaultImplementation);
    await gmxRegistry.connect(core.governance).ownerSetGlpVaultFactory(glpFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetGmxVaultFactory(gmxFactory.address);

    const dolomiteAccountRegistry = await createDolomiteAccountRegistryImplementation();
    const calldata = await dolomiteAccountRegistry.populateTransaction.initialize([
      gmxFactory.address,
      glpFactory.address,
    ]);
    const accountRegistryProxy = await createRegistryProxy(dolomiteAccountRegistry.address, calldata.data!, core);
    const accountRegistry = DolomiteAccountRegistry__factory.connect(accountRegistryProxy.address, core.governance);
    await core.dolomiteRegistry.connect(core.governance).ownerSetDolomiteAccountRegistry(accountRegistry.address);

    underlyingGlpMarketId = BigNumber.from(core.marketIds.dfsGlp!);
    await core.testEcosystem!.testPriceOracle.setPrice(glpFactory.address, '1000000000000000000');
    await core.dolomiteMargin
      .connect(core.governance)
      .ownerSetPriceOracle(underlyingGlpMarketId, core.testEcosystem!.testPriceOracle.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(glpFactory.address, true);

    underlyingGmxMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(gmxFactory.address, '1000000000000000000');
    await setupTestMarket(core, gmxFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gmxFactory.address, true);
    await gmxFactory.connect(core.governance).ownerInitialize([]);

    await gmxFactory.createVault(core.hhUser1.address);
    gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
      await gmxFactory.getVaultByAccount(core.hhUser1.address),
      GMXIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    glpVault = setupUserVaultProxy<TestGLPIsolationModeTokenVaultV2>(
      await glpFactory.getVaultByAccount(core.hhUser1.address),
      TestGLPIsolationModeTokenVaultV2__factory,
      core.hhUser1,
    );
    account = { owner: glpVault.address, number: accountNumber };

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core
      .gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, ONE_BI, ONE_BI);
    // use sGLP for approvals/transfers and fsGLP for checking balances
    await core.gmxEcosystem!.sGlp.connect(core.hhUser1).approve(glpVault.address, MAX_UINT_256_BI);
    await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
    expect(await core.gmxEcosystem!.fsGlp.connect(core.hhUser1).balanceOf(glpVault.address)).to.eq(amountWei);
    expect(await glpVault.underlyingBalanceOf()).to.eq(amountWei);

    const glpProtocolBalance = await core.dolomiteMargin.getAccountWei(account, underlyingGlpMarketId);
    expect(glpProtocolBalance.sign).to.eq(true);
    expect(glpProtocolBalance.value).to.eq(amountWei);

    await core.gmxEcosystem!.esGmxDistributorForStakedGlp.setTokensPerInterval('10333994708994708');
    await core.gmxEcosystem!.esGmxDistributorForStakedGmx.setTokensPerInterval('10333994708994708');
    const gov = await impersonate(GMX_GOV_MAP[Network.ArbitrumOne]!, true);
    await core
      .gmxEcosystem!.esGmx.connect(gov)
      .mint(core.gmxEcosystem!.esGmxDistributorForStakedGmx.address, parseEther('100000000'));
    await core
      .gmxEcosystem!.esGmx.connect(gov)
      .mint(core.gmxEcosystem!.esGmxDistributorForStakedGlp.address, parseEther('100000000'));

    esGmxReader = await createEsGmxReader(glpFactory);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await esGmxReader.GLP_FACTORY()).to.eq(glpFactory.address);
    });
  });

  describe('#balanceOf', () => {
    async function setupGmxStakingAndEsGmxVesting() {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      expect(await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, 0, underlyingGmxMarketId, gmxAmount);

      // The user has not vested any esGMX into GMX, so the balance should be 0
      expect(await core.tokens.gmx!.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.gmx!.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).gte(gmxAmount)).to.eq(true);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.tokens.weth.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.tokens.weth.balanceOf(core.hhUser1.address)).to.be.eq(ZERO_BI);
      return gmxVault;
    }

    it('should work when assets are claimed and not staked', async () => {
      const gmxVault = await setupGmxStakingAndEsGmxVesting();
      expect(await esGmxReader.balanceOf(glpVault.address)).to.eq(ZERO_BI);

      await waitDays(30);
      await glpVault.handleRewards(true, false, true, false, true, true, false);

      expect((await core.gmxEcosystem!.esGmx.balanceOf(glpVault.address)).gt(esGmxAmount)).to.eq(true);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await esGmxReader.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect((await esGmxReader.balanceOf(core.hhUser1.address)).gt(esGmxAmount)).to.eq(true);
    });

    it('should return 0 if the vault is not a glp vault', async () => {
      expect(await esGmxReader.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
    });
  });
});
