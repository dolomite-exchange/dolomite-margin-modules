export interface TokenInfo {
  oracleInfos: OracleInfo[];
  token: string;
  decimals: number;
}

export interface OracleInfo {
  oracle: string;
  tokenPair: string;
  weight: number;
}
