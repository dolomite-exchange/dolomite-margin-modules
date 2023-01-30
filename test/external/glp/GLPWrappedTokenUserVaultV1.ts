import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  GLPWrappedTokenUserVaultFactory,
  GLPWrappedTokenUserVaultFactory__factory,
  GLPWrappedTokenUserVaultV1,
  GLPWrappedTokenUserVaultV1__factory,
} from '../../../src/types';
import {
  BORROW_POSITION_PROXY_V2,
  ES_GMX,
  GLP_MANAGER,
  GLP_REWARD_ROUTER,
  GMX,
  FS_GLP,
  USDC,
  V_GLP,
  WETH,
  WETH_MARKET_ID,
} from '../../../src/utils/constants';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { MAX_UINT_256_BI, ONE_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot, waitDays } from '../../utils';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';

const usdcAmount = '2000000000'; // 2,000 USDC
const amountWei = '1250000000000000000000'; // 1,250 GLP tokens
const amountWeiSmall = '125000000000000000000'; // 125 GLP tokens

describe('GLPWrappedTokenUserVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let factory: GLPWrappedTokenUserVaultFactory;
  let vault: GLPWrappedTokenUserVaultV1;
  let underlyingMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 56545700,
    });
    const vaultImplementation = await createContractWithAbi<GLPWrappedTokenUserVaultV1>(
      GLPWrappedTokenUserVaultV1__factory.abi,
      GLPWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    factory = await createContractWithAbi<GLPWrappedTokenUserVaultFactory>(
      GLPWrappedTokenUserVaultFactory__factory.abi,
      GLPWrappedTokenUserVaultFactory__factory.bytecode,
      [
        WETH.address,
        WETH_MARKET_ID,
        GLP_REWARD_ROUTER.address,
        GMX.address,
        ES_GMX.address,
        V_GLP.address,
        FS_GLP.address,
        BORROW_POSITION_PROXY_V2.address,
        vaultImplementation.address,
        core.dolomiteMargin.address,
      ],
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testPriceOracle.setPrice(factory.address, '1000000000000000000');
    await setupTestMarket(core, factory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.initialize([]);

    await factory.createVault(core.hhUser1.address);
    vault = setupUserVaultProxy<GLPWrappedTokenUserVaultV1>(
      await factory.getVaultByAccount(core.hhUser1.address),
      GLPWrappedTokenUserVaultV1__factory,
      core.hhUser1,
    );

    await setupUSDCBalance(core.hhUser1, usdcAmount, GLP_MANAGER);
    await GLP_REWARD_ROUTER.connect(core.hhUser1).mintAndStakeGlp(
      USDC.address,
      usdcAmount,
      ONE_BI,
      ONE_BI,
    );
    await FS_GLP.connect(core.hhUser1).approve(vault.address, MAX_UINT_256_BI);
    await vault.depositIntoVaultForDolomiteMargin(ZERO_BI, amountWei);
    expect(await FS_GLP.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#handleRewards', () => {
    it('should work', async () => {
      await waitDays(30);
      await vault.handleRewards(true, false, true, false, true, true, false);
      console.log('GMX balance', (await GMX.connect(core.hhUser1).balanceOf(core.hhUser1.address)).toString());
      console.log('esGMX balance', (await ES_GMX.connect(core.hhUser1).balanceOf(vault.address)).toString());
      console.log('WETH balance', (await WETH.connect(core.hhUser1).balanceOf(core.hhUser1.address)).toString());
    });
  });

  describe('#stakeGmx', () => {
    it('should ', async () => {
    });
  });

  describe('#unstakeGmx', () => {
    it('should ', async () => {
    });
  });

  describe('#stakeEsGmx', () => {
    it('should ', async () => {
    });
  });

  describe('#unstakeEsGmx', () => {
    it('should ', async () => {
    });
  });

  describe('#vestGlp', () => {
    it('should ', async () => {
    });
  });

  describe('#unvestGlp', () => {
    it('should ', async () => {
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should ', async () => {
    });
  });

  describe('#glpRewardsRouter', () => {
    it('should work normally', async () => {
      expect(await vault.glpRewardsRouter()).to.equal(GLP_REWARD_ROUTER.address);
    });
  });

  describe('#underlyingBalanceOf', () => {
    it('should work when funds are only in vault', async () => {
      expect(await vault.underlyingBalanceOf()).to.equal(amountWei);
    });

    it('should work when funds are in vault and vesting', async () => {
    });

    it('should work when funds are only in vesting', async () => {
    });
  });

  describe('#vGlp', () => {
    it('should work normally', async () => {
      expect(await vault.vGlp()).to.equal(V_GLP.address);
    });
  });
});
