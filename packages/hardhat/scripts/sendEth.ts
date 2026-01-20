import { ethers } from "ethers";

// Default Hardhat account 0 (faucet account)
const FAUCET_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const FAUCET_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// Target address that needs ETH
const TARGET_ADDRESS = process.env.TARGET_ADDRESS || "0x35A7A388C329B8A916AeF4e7d56b61eDF51Eb512";

// Amount to send (1 ETH)
const AMOUNT = ethers.parseEther("1");

async function main() {
  console.log("🚰 Sending ETH from faucet...");
  console.log("From:", FAUCET_ADDRESS);
  console.log("To:", TARGET_ADDRESS);
  console.log("Amount: 1 ETH\n");

  // Connect to local Hardhat network
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const wallet = new ethers.Wallet(FAUCET_PRIVATE_KEY, provider);

  // Check faucet balance
  const faucetBalance = await provider.getBalance(FAUCET_ADDRESS);
  console.log("Faucet balance:", ethers.formatEther(faucetBalance), "ETH");

  if (faucetBalance < AMOUNT) {
    console.error("❌ Faucet doesn't have enough ETH!");
    process.exit(1);
  }

  // Check target balance before
  const targetBalanceBefore = await provider.getBalance(TARGET_ADDRESS);
  console.log("Target balance before:", ethers.formatEther(targetBalanceBefore), "ETH\n");

  // Send transaction
  const tx = await wallet.sendTransaction({
    to: TARGET_ADDRESS,
    value: AMOUNT,
  });

  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");

  await tx.wait();

  // Check target balance after
  const targetBalanceAfter = await provider.getBalance(TARGET_ADDRESS);
  console.log("\n✅ Success!");
  console.log("Target balance after:", ethers.formatEther(targetBalanceAfter), "ETH");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

