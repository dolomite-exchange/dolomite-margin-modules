import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { base16 } from '@scure/base';
import axios from 'axios';
import dotenv from 'dotenv';
import { BigNumber } from 'ethers';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { BYTES_ZERO, ONE_DAY_SECONDS } from 'packages/base/src/utils/no-deps-constants';
import path from 'path';

const fullReportAbiSchema = [
  { name: 'reportContext', type: 'bytes32[3]' },
  { name: 'reportBlob',    type: 'bytes' },
  { name: 'rawRs',         type: 'bytes32[]' },
  { name: 'rawSs',         type: 'bytes32[]' },
  { name: 'rawVs',         type: 'bytes32' },
];

const reportBlobV3Schema = [
  { name: 'feedId', type: 'bytes32' },
  { name: 'validFromTimestamp', type: 'uint32' },
  { name: 'observationsTimestamp', type: 'uint32' },
  { name: 'nativeFee', type: 'uint192' },
  { name: 'linkFee', type: 'uint192' },
  { name: 'expiresAt', type: 'uint32' },
  { name: 'benchmarkPrice', type: 'int192' },
  { name: 'bid', type: 'int192' },
  { name: 'ask', type: 'int192' },
];

dotenv.config({ path: path.resolve(process.cwd(), '../../../../.env') });
const encoder = new TextEncoder();

const clientID = process.env.CHAINLINK_DATA_STREAM_CLIENT_ID;
const clientSecret = process.env.CHAINLINK_DATA_STREAM_CLIENT_SECRET;
const chainlinkMainnetUrl = 'https://api.dataengine.chain.link';

export async function getLatestChainlinkDataStreamReport(feedId: string) {
  const path = '/api/v1/reports/latest';
  const method = 'GET';
  const search = `?feedID=${feedId}`;

  const headers = generateHeaders(method, path, search);

  const result = await axios.get(
    `${chainlinkMainnetUrl}${path}${search}`,
    { headers }
  ).then(response => response.data)
  .catch((error) => {
    console.error('Error while retrieving latest Chainlink Data Stream report', error);
    throw error;
  });

  return result;
}

export function getAskPriceFromReport(report: any): BigNumber {
  const decodedReport = defaultAbiCoder.decode(fullReportAbiSchema as any, report.report.fullReport);
  const detailedReport = defaultAbiCoder.decode(reportBlobV3Schema as any, decodedReport.reportBlob);
  return BigNumber.from(detailedReport.ask);
}

export function getBidPriceFromReport(report: any): BigNumber {
  const decodedReport = defaultAbiCoder.decode(fullReportAbiSchema as any, report.report.fullReport);
  const detailedReport = defaultAbiCoder.decode(reportBlobV3Schema as any, decodedReport.reportBlob);
  return BigNumber.from(detailedReport.bid);
}

export function getPriceFromReport(report: any): BigNumber {
  const decodedReport = defaultAbiCoder.decode(fullReportAbiSchema as any, report.report.fullReport);
  const detailedReport = defaultAbiCoder.decode(reportBlobV3Schema as any, decodedReport.reportBlob);
  return BigNumber.from(detailedReport.benchmarkPrice);
}

export function getTimestampFromReport(report: any): BigNumber {
  const decodedReport = defaultAbiCoder.decode(fullReportAbiSchema as any, report.report.fullReport);
  const detailedReport = defaultAbiCoder.decode(reportBlobV3Schema as any, decodedReport.reportBlob);
  return BigNumber.from(detailedReport.observationsTimestamp);
}

export function getTestPayloads(feedIds: string[], prices: BigNumber[], timestamp: BigNumber) {
  const payloads = [];
  for (let i = 0; i < feedIds.length; i++) {
    const dataBytes = defaultAbiCoder.encode(
      reportBlobV3Schema as any,
      [feedIds[i], timestamp, timestamp, 0, 0, timestamp.add(ONE_DAY_SECONDS), prices[i], prices[i], prices[i]]
    );
    const payload = defaultAbiCoder.encode(
      fullReportAbiSchema as any,
      [[BYTES_ZERO, BYTES_ZERO, BYTES_ZERO], dataBytes, [], [], BYTES_ZERO]
    );
    payloads.push(payload);
  }
  return payloads;
}

function generateHeaders(method: any, path: any, search: any, timestamp = +new Date()): any {
  const signed = [
    method,
    `${path}${search}`,
    base16.encode(sha256.create().update('').digest()).toLowerCase(),
    clientID,
    String(timestamp)
  ];

  return {
    Authorization: clientID,
    'X-Authorization-Timestamp': timestamp.toString(),
    'X-Authorization-Signature-SHA256': base16.encode(
      hmac(sha256, encoder.encode(clientSecret), signed.join(' '))
    ).toLowerCase()
  };
}
