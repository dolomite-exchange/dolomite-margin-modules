import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { defaultAbiCoder, keccak256, parseEther } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import { depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from 'packages/base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupNativeUSDCBalance,
} from 'packages/base/test/utils/setup';
import { DOLO, TestOptionAirdrop } from '../src/types';
import { createDOLO, createTestOptionAirdrop } from './tokenomics-ecosystem-utils';

const usdcAmount = BigNumber.from('100000000');
const defaultAccountNumber = ZERO_BI;
const usdcPaymentAmount = BigNumber.from('156250'); // 5 tokens * $.03125 = $0.156250
const USDC_PRICE = BigNumber.from('1000000000000000000000000000000');

describe('OptionAirdrop', () => {
  let core: CoreProtocolArbitrumOne;
  let dolo: DOLO;
  let optionAirdrop: TestOptionAirdrop;

  let merkleRoot: string;
  let validProof1: string[];
  let invalidProof: string[];

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    dolo = await createDOLO(core, core.hhUser5.address);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc);
    await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.nativeUsdc.address, USDC_PRICE);
    await core.dolomiteMargin.ownerSetPriceOracle(
      core.marketIds.nativeUsdc,
      core.testEcosystem!.testPriceOracle.address,
    );

    const rewards = [
      { address: core.hhUser1.address, rewards: parseEther('5') },
      { address: core.hhUser2.address, rewards: parseEther('10') },
    ];
    const leaves = rewards.map((account) =>
      keccak256(defaultAbiCoder.encode(['address', 'uint256'], [account.address, account.rewards])),
    );
    const invalidLeaf = keccak256(
      defaultAbiCoder.encode(['address', 'uint256'], [core.hhUser3.address, parseEther('15')]),
    );
    const tree = new MerkleTree(leaves, keccak256, { sort: true });

    merkleRoot = tree.getHexRoot();
    validProof1 = tree.getHexProof(leaves[0]);
    invalidProof = tree.getHexProof(invalidLeaf);

    optionAirdrop = await createTestOptionAirdrop(core, dolo, core.hhUser5.address);

    await optionAirdrop.connect(core.governance).ownerSetMerkleRoot(merkleRoot);
    await core.dolomiteMargin.ownerSetGlobalOperator(optionAirdrop.address, true);

    await dolo.connect(core.hhUser5).transfer(optionAirdrop.address, parseEther('15'));

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
    await optionAirdrop.connect(core.governance).ownerSetAllowedMarketIds([core.marketIds.nativeUsdc]);
    await optionAirdrop.connect(core.governance).ownerSetHandler(core.hhUser5.address);
    await optionAirdrop.connect(core.hhUser5).ownerSetClaimEnabled(true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await optionAirdrop.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await optionAirdrop.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
      expect(await optionAirdrop.DOLO()).to.eq(dolo.address);
      expect(await optionAirdrop.merkleRoot()).to.eq(merkleRoot);
      expect(await optionAirdrop.treasury()).to.eq(core.hhUser5.address);
    });
  });

  describe('#initializer', () => {
    it('should fail if called again', async () => {
      await expectThrow(
        optionAirdrop.connect(core.hhUser2).initialize(core.hhUser5.address),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#ownerSetAllowedMarketIds', () => {
    it('should work normally', async () => {
      expect(await optionAirdrop.getAllowedMarketIds()).to.deep.eq([BigNumber.from(core.marketIds.nativeUsdc)]);
      expect(await optionAirdrop.isAllowedMarketId(core.marketIds.nativeUsdc)).to.eq(true);
      const res = await optionAirdrop.connect(core.governance).ownerSetAllowedMarketIds([core.marketIds.weth]);
      await expectEvent(optionAirdrop, res, 'AllowedMarketIdsSet', {
        marketIds: [core.marketIds.weth],
      });
      expect(await optionAirdrop.isAllowedMarketId(core.marketIds.nativeUsdc)).to.eq(false);
      expect(await optionAirdrop.getAllowedMarketIds()).to.deep.eq([BigNumber.from(core.marketIds.weth)]);
    });

    it('should work normally with multiple market ids', async () => {
      expect(await optionAirdrop.getAllowedMarketIds()).to.deep.eq([BigNumber.from(core.marketIds.nativeUsdc)]);
      await optionAirdrop
        .connect(core.governance)
        .ownerSetAllowedMarketIds([
          core.marketIds.weth,
          core.marketIds.nativeUsdc,
          core.marketIds.usdt,
          core.marketIds.wbtc,
        ]);
      expect(await optionAirdrop.getAllowedMarketIds()).to.deep.eq([
        BigNumber.from(core.marketIds.weth),
        BigNumber.from(core.marketIds.nativeUsdc),
        BigNumber.from(core.marketIds.usdt),
        BigNumber.from(core.marketIds.wbtc),
      ]);
    });

    it('should clear all allowed market ids if given empty array', async () => {
      expect(await optionAirdrop.getAllowedMarketIds()).to.deep.eq([BigNumber.from(core.marketIds.nativeUsdc)]);
      const res = await optionAirdrop.connect(core.governance).ownerSetAllowedMarketIds([]);
      await expectEvent(optionAirdrop, res, 'AllowedMarketIdsSet', {
        marketIds: [],
      });
      expect(await optionAirdrop.getAllowedMarketIds()).to.deep.eq([]);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        optionAirdrop.connect(core.hhUser1).ownerSetAllowedMarketIds([core.marketIds.nativeUsdc]),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetTreasury', () => {
    it('should work normally', async () => {
      expect(await optionAirdrop.treasury()).to.eq(core.hhUser5.address);
      const newTreasury = core.hhUser1.address;
      const res = await optionAirdrop.connect(core.governance).ownerSetTreasury(newTreasury);
      await expectEvent(optionAirdrop, res, 'TreasurySet', {
        treasury: newTreasury,
      });
      expect(await optionAirdrop.treasury()).to.eq(newTreasury);
    });

    it('should fail if treasury is zero address', async () => {
      await expectThrow(
        optionAirdrop.connect(core.governance).ownerSetTreasury(ADDRESS_ZERO),
        'OptionAirdrop: Invalid treasury address',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        optionAirdrop.connect(core.hhUser1).ownerSetTreasury(core.hhUser1.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#claim', () => {
    it('should work normally', async () => {
      expect(await core.tokens.nativeUsdc.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
      const res = await optionAirdrop
        .connect(core.hhUser1)
        .claim(validProof1, parseEther('5'), parseEther('5'), core.marketIds.nativeUsdc, defaultAccountNumber);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: optionAirdrop.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: parseEther('5'),
      });
      await expectProtocolBalance(core, core.hhUser5, ZERO_BI, core.marketIds.nativeUsdc, usdcPaymentAmount);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount.sub(usdcPaymentAmount),
      );
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(parseEther('5'));
      expect(await dolo.balanceOf(optionAirdrop.address)).to.eq(parseEther('10'));
      expect(await optionAirdrop.userToClaimedAmount(core.hhUser1.address)).to.eq(parseEther('5'));
    });

    it('should work normally if user claims in two parts', async () => {
      const res = await optionAirdrop
        .connect(core.hhUser1)
        .claim(validProof1, parseEther('5'), parseEther('3'), core.marketIds.nativeUsdc, defaultAccountNumber);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: optionAirdrop.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: parseEther('3'),
      });
      const payment1 = BigNumber.from('93750'); // $.093750. usdcPaymentAmount * 3 / 5
      await expectProtocolBalance(core, core.hhUser5, ZERO_BI, core.marketIds.nativeUsdc, payment1);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount.sub(payment1),
      );
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(parseEther('3'));
      expect(await dolo.balanceOf(optionAirdrop.address)).to.eq(parseEther('12'));
      expect(await optionAirdrop.userToClaimedAmount(core.hhUser1.address)).to.eq(parseEther('3'));
      expect(await optionAirdrop.userToPurchases(core.hhUser1.address)).to.eq(1);

      const res2 = await optionAirdrop
        .connect(core.hhUser1)
        .claim(validProof1, parseEther('5'), parseEther('2'), core.marketIds.nativeUsdc, defaultAccountNumber);
      await expectEvent(core.eventEmitterRegistry, res2, 'RewardClaimed', {
        distributor: optionAirdrop.address,
        user: core.hhUser1.address,
        epoch: ONE_BI,
        amount: parseEther('2'),
      });
      await expectProtocolBalance(core, core.hhUser5, ZERO_BI, core.marketIds.nativeUsdc, usdcPaymentAmount);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount.sub(usdcPaymentAmount),
      );
      expect(await dolo.balanceOf(core.hhUser1.address)).to.eq(parseEther('5'));
      expect(await dolo.balanceOf(optionAirdrop.address)).to.eq(parseEther('10'));
      expect(await optionAirdrop.userToClaimedAmount(core.hhUser1.address)).to.eq(parseEther('5'));
      expect(await optionAirdrop.userToPurchases(core.hhUser1.address)).to.eq(2);
    });

    it('should work normally if user has remapped address', async () => {
      await setupNativeUSDCBalance(core, core.hhUser4, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser4, defaultAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
      await optionAirdrop
        .connect(core.hhUser5)
        .ownerSetAddressRemapping([core.hhUser4.address], [core.hhUser1.address]);
      expect(await core.tokens.nativeUsdc.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);

      const res = await optionAirdrop
        .connect(core.hhUser4)
        .claim(validProof1, parseEther('5'), parseEther('5'), core.marketIds.nativeUsdc, defaultAccountNumber);
      await expectEvent(core.eventEmitterRegistry, res, 'RewardClaimed', {
        distributor: optionAirdrop.address,
        user: core.hhUser1.address,
        epoch: ZERO_BI,
        amount: parseEther('5'),
      });
      await expectProtocolBalance(core, core.hhUser5, ZERO_BI, core.marketIds.nativeUsdc, usdcPaymentAmount);
      await expectProtocolBalance(
        core,
        core.hhUser4,
        defaultAccountNumber,
        core.marketIds.nativeUsdc,
        usdcAmount.sub(usdcPaymentAmount),
      );
      expect(await dolo.balanceOf(core.hhUser4.address)).to.eq(parseEther('5'));
      expect(await dolo.balanceOf(optionAirdrop.address)).to.eq(parseEther('10'));
      expect(await optionAirdrop.userToClaimedAmount(core.hhUser1.address)).to.eq(parseEther('5'));
    });

    it('should fail if claim is not enabled', async () => {
      await optionAirdrop.connect(core.hhUser5).ownerSetClaimEnabled(false);
      await expectThrow(
        optionAirdrop.connect(core.hhUser1).claim(
          validProof1,
          parseEther('5'),
          parseEther('5'),
          core.marketIds.nativeUsdc,
          defaultAccountNumber,
        ),
        'BaseClaim: Claim is not enabled',
      );
    });

    it('should fail if remapped user claims again with original address', async () => {
      await setupNativeUSDCBalance(core, core.hhUser4, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser4, defaultAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
      await optionAirdrop
        .connect(core.hhUser5)
        .ownerSetAddressRemapping([core.hhUser4.address], [core.hhUser1.address]);
      expect(await core.tokens.nativeUsdc.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);

      await optionAirdrop
        .connect(core.hhUser4)
        .claim(validProof1, parseEther('5'), parseEther('5'), core.marketIds.nativeUsdc, defaultAccountNumber);
      await expectThrow(
        optionAirdrop
          .connect(core.hhUser1)
          .claim(validProof1, parseEther('5'), parseEther('5'), core.marketIds.nativeUsdc, defaultAccountNumber),
        'OptionAirdrop: Insufficient allocated amount',
      );
    });

    it('should fail if remapped user claims again with remapped address', async () => {
      await optionAirdrop
        .connect(core.hhUser5)
        .ownerSetAddressRemapping([core.hhUser4.address], [core.hhUser1.address]);
      expect(await core.tokens.nativeUsdc.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);

      await optionAirdrop
        .connect(core.hhUser1)
        .claim(validProof1, parseEther('5'), parseEther('5'), core.marketIds.nativeUsdc, defaultAccountNumber);
      await expectThrow(
        optionAirdrop
          .connect(core.hhUser4)
          .claim(validProof1, parseEther('5'), parseEther('5'), core.marketIds.nativeUsdc, defaultAccountNumber),
        'OptionAirdrop: Insufficient allocated amount',
      );
    });

    it('should fail if invalid merkle proof', async () => {
      await expectThrow(
        optionAirdrop
          .connect(core.hhUser3)
          .claim(invalidProof, parseEther('15'), parseEther('15'), core.marketIds.nativeUsdc, defaultAccountNumber),
        'OptionAirdrop: Invalid merkle proof',
      );
    });

    it('should fail if user has already claimed', async () => {
      await optionAirdrop
        .connect(core.hhUser1)
        .claim(validProof1, parseEther('5'), parseEther('5'), core.marketIds.nativeUsdc, defaultAccountNumber);
      await expectThrow(
        optionAirdrop
          .connect(core.hhUser1)
          .claim(validProof1, parseEther('5'), 1, core.marketIds.nativeUsdc, defaultAccountNumber),
        'OptionAirdrop: Insufficient allocated amount',
      );
    });

    it('should fail if payment asset is not allowed', async () => {
      await expectThrow(
        optionAirdrop
          .connect(core.hhUser1)
          .claim(validProof1, parseEther('5'), parseEther('5'), core.marketIds.grail, defaultAccountNumber),
        'OptionAirdrop: Payment asset not allowed',
      );
    });

    it('should fail if reentered', async () => {
      await expectThrow(
        optionAirdrop.callClaimAndTriggerReentrancy(
          validProof1,
          parseEther('5'),
          parseEther('5'),
          core.marketIds.nativeUsdc,
          defaultAccountNumber,
        ),
        'ReentrancyGuard: reentrant call',
      );
    });
  });
});
