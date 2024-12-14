/* eslint-disable no-undef */
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Loader2 } from 'lucide-react';

const API_URL_BLOCKS = 'https://explorer.facet.org/api/v2/main-page/blocks';
const CONTRACT_ADDRESS = '0x4200000000000000000000000000000000000015';
const RPC_URL = 'https://mainnet.facet.org/';
const MAX_MINT_RATE = 10000000; // Maximum mint rate in gwei
const INITIAL_TARGET_FCT = 400000; // Initial target FCT for adjustment period
const BLOCKS_PER_HALVING = 2630000; // Number of blocks per halving period

const ABI = [
  {
    "inputs": [],
    "name": "fctMintPeriodL1DataGas",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "fctMintRate",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

function App() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const calculateTargetFCT = (blockHeight) => {
    const halvingPeriod = Math.floor(blockHeight / BLOCKS_PER_HALVING);
    return Math.floor(INITIAL_TARGET_FCT / Math.pow(2, halvingPeriod));
  };

  const fetchLatestBlockHeight = async () => {
    const response = await fetch(API_URL_BLOCKS);
    const data = await response.json();
    const latestBlockHeight = parseInt(data[0]?.height, 10);
    if (isNaN(latestBlockHeight)) throw new Error('Invalid block height');
    return latestBlockHeight;
  };

  const fetchContractData = async () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    const fctMintPeriodL1DataGas = await contract.fctMintPeriodL1DataGas();
    const fctMintRate = await contract.fctMintRate();

    const fctMintRateGwei = ethers.formatUnits(fctMintRate, 'gwei');
    const fctMined = fctMintPeriodL1DataGas * BigInt(Math.floor(Number(fctMintRateGwei) * 1e9));
    const fctMinedEther = parseFloat(ethers.formatEther(fctMined));

    return {
      fctMintedSoFar: Math.round(fctMinedEther),
      currentMintRate: Math.round(parseFloat(fctMintRateGwei))
    };
  };

  const calculateAdjustmentPrediction = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const totalBlocks = await fetchLatestBlockHeight();
      const targetFCT = calculateTargetFCT(totalBlocks);
      const contractData = await fetchContractData();
      const { fctMintedSoFar, currentMintRate } = contractData;

      // Calculate current adjustment period
      const currentPeriod = Math.floor(totalBlocks / 10000) + 1;
      const periodStartBlock = (currentPeriod - 1) * 10000;
      const periodEndBlock = periodStartBlock + 9999;
      const blocksElapsedInPeriod = totalBlocks - periodStartBlock + 1;
      const percentComplete = (blocksElapsedInPeriod / 10000) * 100;
      const blocksRemaining = 10000 - blocksElapsedInPeriod;

      const forecastedIssuance = Math.round((fctMintedSoFar / blocksElapsedInPeriod) * 10000);

      // Forecasted mint rate
      let forecastedMintRate = Math.round(
        currentMintRate * (targetFCT / forecastedIssuance)
      );

      // Apply bounds
      const upperBound = Math.min(MAX_MINT_RATE, currentMintRate * 2);
      const lowerBound = Math.round(currentMintRate * 0.5);
      forecastedMintRate = Math.min(Math.max(forecastedMintRate, lowerBound), upperBound);

      const changeInMintRatePercent = ((forecastedMintRate - currentMintRate) / currentMintRate) * 100;
      const halvingPeriod = Math.floor(totalBlocks / BLOCKS_PER_HALVING);

      setData({
        adjustmentPeriod: {
          period: currentPeriod,
          targetFCT,
          halvingPeriod,
          periodStartBlock,
          periodEndBlock,
          currentBlockHeight: totalBlocks,
          blocksElapsed: blocksElapsedInPeriod,
          blocksRemaining,
          percentComplete,
          issuanceRate: currentMintRate,
          totalFCTIssued: fctMintedSoFar,
          percentOfTarget: ((fctMintedSoFar / targetFCT) * 100).toFixed(1)
        },
        prediction: {
          forecastedIssuance,
          targetDifference: targetFCT - forecastedIssuance,
          changeInMintRate: changeInMintRatePercent.toFixed(1),
          newMintRate: forecastedMintRate
        }
      });
    } catch (error) {
      console.error('Error in calculateAdjustmentPrediction:', error);
      setError('Failed to fetch data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    calculateAdjustmentPrediction();
  }, []);

  return (
    <div className="App">
      <h1>
        <span style={{ fontWeight: 'bold', color: '#3F19D9' }}>F</span>
        <span style={{ color: '#9C9EA4' }}>ore</span>
        <span style={{ fontWeight: 'bold', color: '#3F19D9' }}>C</span>
        <span style={{ color: '#9C9EA4' }}>as</span>
        <span style={{ fontWeight: 'bold', color: '#3F19D9' }}>T</span>
      </h1>
      
      <button onClick={calculateAdjustmentPrediction} disabled={isLoading}>
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Refreshing...
          </span>
        ) : (
          'Refresh'
        )}
      </button>

      {error && (
        <div className="text-red-500 mt-4">{error}</div>
      )}

      {isLoading && !data && (
        <div className="flex justify-center items-center mt-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {data && !isLoading && (
        <div className="mt-6 text-left">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Adjustment Period Stats:</h2>
            <ul className="space-y-2">
              <li>Adjustment period: {data.adjustmentPeriod.period}</li>
              <li>Target FCT issuance: {data.adjustmentPeriod.targetFCT.toLocaleString()} (after {data.adjustmentPeriod.halvingPeriod} halvings)</li>
              <li>Period start block: {data.adjustmentPeriod.periodStartBlock.toLocaleString()}</li>
              <li>Period end block: {data.adjustmentPeriod.periodEndBlock.toLocaleString()}</li>
              <li>Current block height: {data.adjustmentPeriod.currentBlockHeight.toLocaleString()}
                <ul className="ml-6 mt-1">
                  <li>Blocks elapsed in period: {data.adjustmentPeriod.blocksElapsed.toLocaleString()} ({data.adjustmentPeriod.percentComplete.toFixed(1)}%)</li>
                  <li>Blocks remaining in period: {data.adjustmentPeriod.blocksRemaining.toLocaleString()} ({(100 - data.adjustmentPeriod.percentComplete).toFixed(1)}%)</li>
                </ul>
              </li>
              <li>Issuance rate: {data.adjustmentPeriod.issuanceRate.toLocaleString()} (gwei)</li>
              <li>Total FCT issued: {data.adjustmentPeriod.totalFCTIssued.toLocaleString()} ({data.adjustmentPeriod.percentOfTarget}% of Target)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">Prediction:</h2>
            <ul className="space-y-2">
              <li>Forecasted issuance in current period: {data.prediction.forecastedIssuance.toLocaleString()} FCT
                <ul className="ml-6 mt-1">
                  <li>Under target by {data.prediction.targetDifference.toLocaleString()} FCT</li>
                </ul>
              </li>
              <li>Forecasted change in mint rate: {data.prediction.changeInMintRate}%</li>
              <li>Forecasted new mint rate: {data.prediction.newMintRate.toLocaleString()} (gwei)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;