import { ethers } from "hardhat";
import { InvoiceManager } from "../typechain-types";

/**
 * CLI script to create an invoice
 * Usage: yarn hardhat run scripts/createInvoice.ts --network localhost
 */
async function main() {
  const [deployer, issuer, payer] = await ethers.getSigners();

  console.log("Creating invoice with account:", issuer.address);

  // Get the deployed contract
  const invoiceManagerAddress = process.env.INVOICE_MANAGER_ADDRESS;
  if (!invoiceManagerAddress) {
    throw new Error("Please set INVOICE_MANAGER_ADDRESS environment variable");
  }

  const invoiceManager = (await ethers.getContractAt(
    "InvoiceManager",
    invoiceManagerAddress
  )) as InvoiceManager;

  // Example invoice parameters
  const payerAddress = payer.address; // or ethers.ZeroAddress for open invoice
  const amount = ethers.parseEther("1.0"); // 1 ETH
  const dueDate = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
  const metadata = "ipfs://QmExample123"; // IPFS hash or description

  console.log("Invoice parameters:");
  console.log("  Payer:", payerAddress);
  console.log("  Amount:", ethers.formatEther(amount), "ETH");
  console.log("  Due Date:", new Date(Number(dueDate) * 1000).toISOString());
  console.log("  Metadata:", metadata);

  const tx = await invoiceManager.connect(issuer).createInvoice(payerAddress, amount, dueDate, metadata);
  const receipt = await tx.wait();

  // Get invoice ID from event
  const event = receipt?.logs.find(
    (log: any) => invoiceManager.interface.parseLog(log)?.name === "InvoiceCreated"
  );
  if (event) {
    const parsedLog = invoiceManager.interface.parseLog(event);
    const invoiceId = parsedLog?.args[0];
    console.log("\n✅ Invoice created successfully!");
    console.log("  Invoice ID:", invoiceId.toString());
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

