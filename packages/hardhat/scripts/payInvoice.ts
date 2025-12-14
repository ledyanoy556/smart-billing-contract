import { ethers } from "hardhat";
import { InvoiceManager } from "../typechain-types";

/**
 * CLI script to pay an invoice
 * Usage: yarn hardhat run scripts/payInvoice.ts --network localhost
 * 
 * Set INVOICE_ID environment variable: INVOICE_ID=0 yarn hardhat run scripts/payInvoice.ts
 */
async function main() {
  const invoiceId = process.env.INVOICE_ID ? BigInt(process.env.INVOICE_ID) : 0n;
  const paymentAmount = process.env.PAYMENT_AMOUNT
    ? ethers.parseEther(process.env.PAYMENT_AMOUNT)
    : ethers.parseEther("0.5");

  const [deployer, , payer] = await ethers.getSigners();

  console.log("Paying invoice with account:", payer.address);
  console.log("Invoice ID:", invoiceId.toString());
  console.log("Payment amount:", ethers.formatEther(paymentAmount), "ETH");

  // Get the deployed contract
  const invoiceManagerAddress = process.env.INVOICE_MANAGER_ADDRESS;
  if (!invoiceManagerAddress) {
    throw new Error("Please set INVOICE_MANAGER_ADDRESS environment variable");
  }

  const invoiceManager = (await ethers.getContractAt(
    "InvoiceManager",
    invoiceManagerAddress
  )) as InvoiceManager;

  // Get invoice info before payment
  const invoice = await invoiceManager.invoices(invoiceId);
  console.log("\nInvoice before payment:");
  console.log("  Amount:", ethers.formatEther(invoice.amount), "ETH");
  console.log("  Paid:", ethers.formatEther(invoice.paidAmount), "ETH");
  console.log("  Remaining:", ethers.formatEther(invoice.amount - invoice.paidAmount), "ETH");

  const tx = await invoiceManager.connect(payer).payInvoice(invoiceId, { value: paymentAmount });
  const receipt = await tx.wait();

  // Get updated invoice info
  const updatedInvoice = await invoiceManager.invoices(invoiceId);
  console.log("\n✅ Payment successful!");
  console.log("  Paid amount:", ethers.formatEther(updatedInvoice.paidAmount), "ETH");
  console.log("  Remaining:", ethers.formatEther(updatedInvoice.amount - updatedInvoice.paidAmount), "ETH");

  // Check for overpayment
  const pendingReturn = await invoiceManager.pendingReturns(payer.address);
  if (pendingReturn > 0n) {
    console.log("  ⚠️  Overpayment detected:", ethers.formatEther(pendingReturn), "ETH");
    console.log("  Use withdrawPending() to get your refund");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

