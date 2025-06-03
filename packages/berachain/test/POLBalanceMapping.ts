import { BigNumber } from 'ethers';
import { ZERO_BI } from 'packages/base/src/utils/no-deps-constants';

interface POLBalanceInfo {
  accountNumber: BigNumber;
  polAmount: BigNumber;
  metaVault: string;
  drUsdMetaVaultBalance: BigNumber;
  metaVaultStakedBalance: BigNumber;
}

export const POLBalanceMapping: Record<string, POLBalanceInfo> = {
  '0x52256ef863a713Ef349ae6E97A7E8f35785145dE': {
    accountNumber: BigNumber.from('26344303671339237499951431289790394189307938779879054501628389380567819156753'),
    polAmount: BigNumber.from('20872155583436123654'),
    metaVault: '0x76F103037601a2a8f042Caa259C55abbb34e30EB',
    drUsdMetaVaultBalance: ZERO_BI,
    metaVaultStakedBalance: BigNumber.from('20872155583436123654'),
  },
  '0x62dFA6eBA6a34E55c454894dd9b3E688F88CB09b': {
    accountNumber: BigNumber.from('44976727696018895331746976563377652501904371332622590265514825582226055111404'),
    polAmount: BigNumber.from('79565535859332896399831'),
    metaVault: '0xcfC2C3C4c92C72c9C77414396551657EcfCa47f0',
    drUsdMetaVaultBalance: ZERO_BI,
    metaVaultStakedBalance: ZERO_BI,
  },
  '0x2c1259a2C764dCc66241edFbdFD281AfcB6d870A': {
    accountNumber: ZERO_BI,
    polAmount: BigNumber.from('1997039405486810795168'),
    metaVault: '0xc60216c77acB247917eAB4D003Ab5D50C03c3737',
    drUsdMetaVaultBalance: ZERO_BI,
    metaVaultStakedBalance: BigNumber.from('1997039405486810795168'),
  },
  '0x7FD2f0ff55045451232cFfd5293AA728880c79B4': {
    accountNumber: BigNumber.from('25976805081149420853137631528454194518782565538748073577746751306167888139064'),
    polAmount: BigNumber.from('9947797824206590115'),
    metaVault: '0x09C40964ea932f27b08dd795C0dd6886D4A96F5a',
    drUsdMetaVaultBalance: ZERO_BI,
    metaVaultStakedBalance: ZERO_BI,
  },
  '0xb0521C3Ce72d0a4579b972CAf2001308551DE0B6': {
    accountNumber: BigNumber.from('20063557780232337088244108625764239136937618758390814340765237003120721304022'),
    polAmount: BigNumber.from('497467918625634458906029'),
    metaVault: '0x2B93A851c5165B91D8D6E90C25BaC9380E6Bc67b',
    drUsdMetaVaultBalance: ZERO_BI,
    metaVaultStakedBalance: ZERO_BI,
  },
  '0x2278A9463774fc0b538B7d52087a00405Ca9e1Ac': {
    accountNumber: BigNumber.from('5562695315075236073750998647900119744485896376476769037857043902681181427405'),
    polAmount: BigNumber.from('994743808631058495761026'),
    metaVault: '0xc27d03B0E5335FaAdBd574E61a86583A6135c395',
    drUsdMetaVaultBalance: ZERO_BI,
    metaVaultStakedBalance: ZERO_BI,
  },
  '0x87F3940fc2FD6095b7BBdBb895Ce9E453bC8af48': {
    accountNumber: ZERO_BI,
    polAmount: BigNumber.from('40000000000000000000'),
    metaVault: '0x927380f13407e9206D563137EC6f87bAC4B6902A',
    drUsdMetaVaultBalance: ZERO_BI,
    metaVaultStakedBalance: ZERO_BI,
  }
};
