"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { AddressInput } from "@scaffold-ui/components";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { parseEther, isAddress } from "viem";
import { toast } from "react-hot-toast";
import type { NextPage } from "next";

const CreateInvoicePage: NextPage = () => {
  const router = useRouter();
  const { address: connectedAddress } = useAccount();
  const [payerAddress, setPayerAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [metadata, setMetadata] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { writeContractAsync: writeInvoiceManager } = useScaffoldWriteContract({
    contractName: "InvoiceManager",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connectedAddress) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    // Validate payer address if provided
    if (payerAddress && !isAddress(payerAddress)) {
      toast.error("Please enter a valid payer address");
      return;
    }

    try {
      setIsCreating(true);

      const amountWei = parseEther(amount);
      const dueDateTimestamp = dueDate ? Math.floor(new Date(dueDate).getTime() / 1000) : 0;

      await writeInvoiceManager({
        functionName: "createInvoice",
        args: [
          payerAddress || "0x0000000000000000000000000000000000000000",
          amountWei,
          BigInt(dueDateTimestamp),
          metadata || "",
        ],
      });

      toast.success("Invoice created successfully!");
      router.push("/invoices");
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      toast.error(error?.message || "Failed to create invoice");
    } finally {
      setIsCreating(false);
    }
  };

  if (!connectedAddress) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please connect your wallet</h1>
          <p className="text-neutral">Connect your wallet to create invoices</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Create Invoice</h1>
        <p className="text-neutral">Create a new invoice for payment</p>
      </div>

      <form onSubmit={handleSubmit} className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Payer Address (Optional)</span>
            </label>
            <AddressInput
              value={payerAddress}
              onChange={setPayerAddress}
              placeholder="0x... or leave empty for open invoice"
            />
            <label className="label">
              <span className="label-text-alt">
                Leave empty to allow anyone to pay this invoice
              </span>
            </label>
          </div>

          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Amount (ETH)</span>
            </label>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1.0"
              className="input input-bordered w-full"
              required
            />
          </div>

          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Due Date (Optional)</span>
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>

          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Metadata (Optional)</span>
            </label>
            <textarea
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              placeholder="IPFS hash, URI, or description"
              className="textarea textarea-bordered w-full"
              rows={3}
            />
          </div>

          <div className="card-actions justify-end mt-4">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => router.back()}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isCreating}>
              {isCreating ? (
                <>
                  <span className="loading loading-spinner"></span>
                  Creating...
                </>
              ) : (
                "Create Invoice"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateInvoicePage;

