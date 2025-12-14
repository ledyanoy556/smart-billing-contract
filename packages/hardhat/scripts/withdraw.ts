import { ethers } from "hardhat";
import { InvoiceManager } from "../typechain-types";

/**
 * CLI script to withdraw funds from an invoice (issuer only)
 * Usage: yarn hardhat run scripts/withdraw.ts --network localhost
 * 
 * Set INVOICE_ID environment variable: INVOICE_ID=0 yarn hardhat run scripts/withdraw.ts
 */
async function main() {
  const invoiceId = process.env.INVOICE_ID ? BigInt(process.env.INVOICE_ID) : 0n;

  const [deployer, issuer] = await ethers.getSigners();

  console.log("Withdrawing from invoice with account:", issuer.address);
  console.log("Invoice ID:", invoiceId.toString());

  // Get the deployed contract
  const invoiceManagerAddress = process.env.INVOICE_MANAGER_ADDRESS;
  if (!invoiceManagerAddress) {
    throw new Error("Please set INVOICE_MANAGER_ADDRESS environment variable");
  }

  const invoiceManager = (await ethers.getContractAt(
    "InvoiceManager",
    invoiceManagerAddress
  )) as InvoiceManager;

  // Get invoice info before withdrawal
  const invoice = await invoiceManager.invoices(invoiceId);
  console.log("\nInvoice before withdrawal:");
  console.log("  Issuer:", invoice.issuer);
  console.log("  Paid amount:", ethers.formatEther(invoice.paidAmount), "ETH");

  if (invoice.issuer !== issuer.address) {
    throw new Error("Only the issuer can withdraw funds from this invoice");
  }

  const issuerBalanceBefore = await ethers.provider.getBalance(issuer.address);

  const tx = await invoiceManager.connect(issuer).withdraw(invoiceId);
  const receipt = await tx.wait();
  const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

  const issuerBalanceAfter = await ethers.provider.getBalance(issuer.address);
  const withdrawnAmount = invoice.paidAmount;

  console.log("\n✅ Withdrawal successful!");
  console.log("  Withdrawn:", ethers.formatEther(withdrawnAmount), "ETH");
  console.log("  Gas used:", ethers.formatEther(gasUsed), "ETH");
  console.log("  Balance change:", ethers.formatEther(issuerBalanceAfter - issuerBalanceBefore), "ETH");

  // Verify invoice paidAmount is reset
  const updatedInvoice = await invoiceManager.invoices(invoiceId);
  console.log("  Invoice paidAmount after withdrawal:", ethers.formatEther(updatedInvoice.paidAmount), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

