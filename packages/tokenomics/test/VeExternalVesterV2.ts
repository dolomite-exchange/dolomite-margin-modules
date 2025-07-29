import { MAX_UINT_256_BI, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { expect } from 'chai';
import { VeExternalVesterImplementationV2, VeExternalVesterImplementationV2__factory } from '../src/types';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';

describe('VeExternalVesterV2', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;

  let vesterImplementation: VeExternalVesterImplementationV2;
  let vester: VeExternalVesterImplementationV2;
  let dao: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 8_390_500,
    });

    vesterImplementation = await createContractWithAbi<VeExternalVesterImplementationV2>(
      VeExternalVesterImplementationV2__factory.abi,
      VeExternalVesterImplementationV2__factory.bytecode,
      [
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        core.tokenomics.veExternalVester.PAIR_TOKEN(), // dolo
        core.tokenomics.veExternalVester.PAIR_MARKET_ID(),
        core.tokenomics.veExternalVester.PAYMENT_TOKEN(), // usdc
        core.tokenomics.veExternalVester.PAYMENT_MARKET_ID(),
        core.tokenomics.veExternalVester.REWARD_TOKEN(), // dolo
        core.tokenomics.veExternalVester.REWARD_MARKET_ID(),
      ]
    );

    // Withdraw all pushed DOLO from the vester to the DAO. Pushed tokens should then be 0 and promised
    // tokens should equal dolo.balanceOf() because of 1:1 pairing
    const preBal = await core.tokens.dolo.balanceOf(core.daoAddress!);
    const pushedTokens = await core.tokenomics.veExternalVester.pushedTokens();
    await core.tokenomics.veExternalVester.connect(core.governance).ownerWithdrawRewardToken(
      core.daoAddress!,
      pushedTokens,
      true
    );
    expect(await core.tokenomics.veExternalVester.pushedTokens()).to.eq(ZERO_BI);
    expect(await core.tokenomics.veExternalVester.promisedTokens()).to.eq(
      await core.tokenomics.dolo.balanceOf(core.tokenomics.veExternalVester.address)
    );
    expect(await core.tokens.dolo.balanceOf(core.daoAddress!)).to.eq(pushedTokens.add(preBal));

    // Upgrade the vester
    await core.tokenomics.veExternalVesterProxy.connect(core.governance).upgradeTo(vesterImplementation.address);
    vester = VeExternalVesterImplementationV2__factory.connect(
      core.tokenomics.veExternalVesterProxy.address,
      core.governance
    );

    dao = await impersonate(core.daoAddress!, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await vester.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await vester.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await vester.PAYMENT_TOKEN()).to.eq(core.tokens.usdc.address);
      expect(await vester.PAIR_TOKEN()).to.eq(core.tokens.dolo.address);
      expect(await vester.REWARD_TOKEN()).to.eq(core.tokens.dolo.address);
      expect(await vester.PAYMENT_MARKET_ID()).to.eq(core.marketIds.usdc);
      expect(await vester.PAIR_MARKET_ID()).to.eq(MAX_UINT_256_BI);
      expect(await vester.REWARD_MARKET_ID()).to.eq(MAX_UINT_256_BI);
    });
  });

  describe('#initializer', () => {
    it('should be initialized', async () => {
      await expectThrow(
        vester.connect(core.governance).initialize(
          defaultAbiCoder.encode(['address'], [core.tokenomics.oDolo.address]),
        ),
        'Initializable: contract is already initialized'
      );
    });
  });

  describe('#lazyInitialize', () => {
    it('should fail', async () => {
      await expectThrow(
        vester.connect(core.governance).lazyInitialize(
          core.tokenomics.veVesterDiscountCalculator.address,
          core.tokenomics.veDolo.address,
        ),
        'VeExternalVesterImplementationV2: veToken already initialized'
      );
    });
  });

  describe('#vest', () => {
    it('should work normally', async () => {
      const preBal = await core.tokens.dolo.balanceOf(core.daoAddress!);
      await core.tokens.dolo.connect(dao).approve(vester.address, MAX_UINT_256_BI);
      const pushedTokens = await vester.pushedTokens();
      expect(pushedTokens).to.eq(preBal);
    });
  });

  describe('#pushedTokens', () => {
    it('should work normally if allowance > bal', async () => {
      const preBal = await core.tokens.dolo.balanceOf(core.daoAddress!);
      await core.tokens.dolo.connect(dao).approve(vester.address, MAX_UINT_256_BI);
      const pushedTokens = await vester.pushedTokens();
      expect(pushedTokens).to.eq(preBal);
    });

    it('should work normally if allowance < bal', async () => {
      const preBal = await core.tokens.dolo.balanceOf(core.daoAddress!);
      await core.tokens.dolo.connect(dao).approve(vester.address, preBal.div(2));
      const pushedTokens = await vester.pushedTokens();
      expect(pushedTokens).to.eq(preBal.div(2));
    });

    it('should fail if no DOLO in DAO', async () => {
      const preBal = await core.tokens.dolo.balanceOf(dao.address);
      await core.tokens.dolo.connect(dao).transfer(core.hhUser1.address, preBal);
      await expectThrow(
        vester.pushedTokens(),
        'VeExternalVesterImplementationV2: No DOLO balance in DAO'
      );
    });
  });
});
