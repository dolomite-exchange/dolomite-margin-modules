import {
  Network,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  setupCoreProtocol,
  setupGMXBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GLPIsolationModeTokenVaultV2,
  GLPIsolationModeTokenVaultV2__factory,
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeTokenVaultV1__factory,
  IGLPIsolationModeVaultFactoryOld,
  IGMXIsolationModeVaultFactory,
  StakedGmxReader,
} from '../src/types';
import {
  createStakedGmxReader,
} from './glp-ecosystem-utils';

const gmxAmount = BigNumber.from('10000000000000000000'); // 10 GMX
const accountNumber = ZERO_BI;

describe('StakedGmxReader', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let glpFactory: IGLPIsolationModeVaultFactoryOld;
  let gmxFactory: IGMXIsolationModeVaultFactory;
  let glpVault: GLPIsolationModeTokenVaultV2;
  let gmxVault: GMXIsolationModeTokenVaultV1;
  let stakedGmxReader: StakedGmxReader;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 264_478_882,
      network: Network.ArbitrumOne,
    });

    glpFactory = core.gmxEcosystem!.live.dGlp;
    gmxFactory = core.gmxEcosystem!.live.dGmx;

    await gmxFactory.createVault(core.hhUser1.address);
    gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
      await gmxFactory.getVaultByAccount(core.hhUser1.address),
      GMXIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    glpVault = setupUserVaultProxy<GLPIsolationModeTokenVaultV2>(
      await glpFactory.getVaultByAccount(core.hhUser1.address),
      GLPIsolationModeTokenVaultV2__factory,
      core.hhUser1,
    );
    stakedGmxReader = await createStakedGmxReader(glpFactory);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await stakedGmxReader.GLP_FACTORY()).to.eq(glpFactory.address);
    });
  });

  describe('#balanceOf', () => {
    it('should work normally', async () => {
      expect(await stakedGmxReader.balanceOf(glpVault.address)).to.eq(ZERO_BI);

      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await stakedGmxReader.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await stakedGmxReader.balanceOf(core.hhUser1.address)).to.eq(gmxAmount);

      await gmxVault.unstakeGmx(gmxAmount.div(2));
      expect(await stakedGmxReader.balanceOf(core.hhUser1.address)).to.eq(gmxAmount.div(2));

      await gmxVault.unstakeGmx(gmxAmount.div(2));
      expect(await stakedGmxReader.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
    });

    it('should return 0 if address does not have a glp vault', async () => {
      expect(await stakedGmxReader.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
    });
  });
});
