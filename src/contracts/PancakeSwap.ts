/* eslint-disable no-underscore-dangle */
import retry from "async-retry";
import { BigNumber, Contract, utils } from "ethers";

import { account, provider } from "../server";
import pcsAbi from "../utils/abi.json";
import factoryAbi from "../utils/factoryAbi.json";
import routerAbi from "../utils/routerAbi.json";

interface IPancakeSwap {
  routerAddress: string;
  factoryAddress: string;
}

class PancakeSwap {
  factory: Contract;
  router: Contract;

  static pcsAbi = new utils.Interface(pcsAbi);

  static wbnbAddress = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
  static gasPrice = utils.parseUnits("5", "gwei");
  static gasLimit = 350000;

  constructor({ factoryAddress, routerAddress }: IPancakeSwap) {
    this.setFactory(factoryAddress);
    this.setRouter(routerAddress);
  }

  public setFactory = (factoryAddress: string): void => {
    this.factory = new Contract(factoryAddress, factoryAbi, account);
  };

  public setRouter = (routerAddress: string): void => {
    this.router = new Contract(routerAddress, routerAbi, account);
  };

  public snipe = async (tokenAddress: string): Promise<void> => {
    const EXPECTED_PONG_BACK = 30000;
    const KEEP_ALIVE_CHECK_INTERVAL = 15000;
    let pingTimeout = null;
    let keepAliveInterval = null;

    provider._websocket.on("open", () => {
      console.log("txPool sniping has begun...\n");
      keepAliveInterval = setInterval(() => {
        provider._websocket.ping();
        // Use `WebSocket#terminate()`, which immediately destroys the connection,
        // instead of `WebSocket#close()`, which waits for the close timer.
        // Delay should be equal to the interval at which your server
        // sends out pings plus a conservative assumption of the latency.
        pingTimeout = setTimeout(() => {
          provider._websocket.terminate();
        }, EXPECTED_PONG_BACK);
      }, KEEP_ALIVE_CHECK_INTERVAL);

      provider.on("pending", async (txHash) => {
        provider.getTransaction(txHash).then(async (tx) => {
          if (tx && tx.to) {
            if (tx.to === this.router.address) {
              const re1 = new RegExp("^0xf305d719");
              const re2 = new RegExp("^0x267dd102");
              const re3 = new RegExp("^0xe8078d94");

              if (re1.test(tx.data) || re2.test(tx.data) || re3.test(tx.data)) {
                const decodedInput = PancakeSwap.pcsAbi.parseTransaction({
                  data: tx.data,
                  value: tx.value,
                });

                if (utils.getAddress(tokenAddress) === decodedInput.args[0]) {
                  // await this.buyToken(tx);
                  console.log("Sniped");
                }
              }
            }
          }
        });
      });
    });

    provider._websocket.on("close", () => {
      console.log("WebSocket Closed...Reconnecting...");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      this.snipe(tokenAddress);
    });

    provider._websocket.on("error", () => {
      console.log("Error. Attemptiing to Reconnect...");
      clearInterval(keepAliveInterval);
      clearTimeout(pingTimeout);
      this.snipe(tokenAddress);
    });

    provider._websocket.on("pong", () => {
      clearInterval(pingTimeout);
    });
  };

  public listenForNewPairs = async (): Promise<void> => {
    console.log("Listening for new pairs...");
    this.factory.on("PairCreated", async (token0, token1, pairAddress) => {
      console.log(`
      New pair
      =================
      token0: ${token0}
      token1: ${token1}
      =================
      pairAddress: ${pairAddress}
    `);
    });
  };

  public buyToken = async (
    tokenAddress: string,
    buyAmount: string
  ): Promise<void> => {
    const value = utils.parseUnits(buyAmount, "ether");
    const amountOutMin = 0;

    const tx = await retry(
      async () => {
        const buyConfirmation =
          await this.router.swapExactETHForTokensSupportingFeeOnTransferTokens(
            amountOutMin,
            [PancakeSwap.wbnbAddress, tokenAddress],
            process.env.RECIPIENT,
            Date.now() + 1000 * 60 * 5, // 5 minutes
            {
              value,
              gasLimit: PancakeSwap.gasLimit,
              gasPrice: PancakeSwap.gasPrice,
            }
          );

        return buyConfirmation;
      },
      {
        retries: 5,
        minTimeout: 10000,
        maxTimeout: 15000,
        onRetry: (err, number) => {
          console.log("Purchase failed - retrying", number);
          console.log("Error", err);
          if (number === 5) {
            console.log("Purchase has failed...");
            process.exit();
          }
        },
      }
    );

    console.log("Waiting for transaction receipt...");
    const receipt = await tx.wait();
    console.log("Token purchase complete.");
    console.log(`Your txHash: ${receipt.transactionHash}`);
    process.exit();
  };

  public sellToken = async (
    tokenAddress: string,
    sellAmount?: string
  ): Promise<void> => {
    const token = new Contract(
      tokenAddress,
      [
        "function approve(address _spender, uint256 _value) public returns (bool success)",
        "function balanceOf(address account) external view returns (uint256)",
      ],
      account
    );

    const balance = await token.balanceOf(process.env.RECIPIENT);
    console.log(`Your current balance: ${balance.toString()}`);

    // If no amount provided, sell whole balance
    let testSellAmount: BigNumber;
    if (sellAmount) {
      testSellAmount = BigNumber.from(sellAmount);
    } else {
      testSellAmount = BigNumber.from(balance.toString());
    }

    // await token.approve(process.env.ROUTER, testSellAmount);

    const amounts = await this.router.getAmountsOut(testSellAmount, [
      tokenAddress,
      PancakeSwap.wbnbAddress,
    ]);
    const amountOutMin = amounts[1].sub(amounts[1].div(12));

    const tx = await retry(
      async () => {
        const sellConfirmation =
          await this.router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            testSellAmount,
            amountOutMin,
            [tokenAddress, PancakeSwap.wbnbAddress],
            process.env.RECIPIENT,
            Date.now() + 1000 * 60 * 5, // 5 minutes
            {
              gasLimit: PancakeSwap.gasLimit,
              gasPrice: PancakeSwap.gasPrice,
            }
          );

        return sellConfirmation;
      },
      {
        retries: 5,
        minTimeout: 10000,
        maxTimeout: 15000,
        onRetry: (err, number) => {
          console.log("Sale failed - retrying", number);
          console.log("Error", err);
          if (number === 5) {
            console.log("Sale has failed...");
            process.exit();
          }
        },
      }
    );

    console.log("Waiting for transaction receipt...");
    const receipt = await tx.wait();
    console.log("Token sale complete.");
    console.log(`Your txHash: ${receipt.transactionHash}`);
    process.exit();
  };
}

export default PancakeSwap;
