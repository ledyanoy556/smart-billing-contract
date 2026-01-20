"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { Address } from "@scaffold-ui/components";
import { useScaffoldReadContract, useScaffoldWriteContract, useScaffoldEventHistory } from "~~/hooks/scaffold-eth";
import { formatEther } from "viem";
import { toast } from "react-hot-toast";
import type { NextPage } from "next";

interface Invoice {
  id: bigint;
  issuer: string;
  payer: string;
  amount: bigint;
  paidAmount: bigint;
  dueDate: bigint;
  cancelled: boolean;
  metadata?: string;
}

const InvoicesPage: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingInvoiceId, setPayingInvoiceId] = useState<bigint | null>(null);
  const [withdrawingInvoiceId, setWithdrawingInvoiceId] = useState<bigint | null>(null);
  const prevInvoiceIdsRef = useRef<string>("");
  const prevEventsKeyRef = useRef<string>("");

  const { writeContractAsync: writeInvoiceManager } = useScaffoldWriteContract({
    contractName: "InvoiceManager",
  });

  // Get invoices where user is issuer
  const { data: issuerInvoiceIds } = useScaffoldReadContract({
    contractName: "InvoiceManager",
    functionName: "getInvoicesOfIssuer",
    args: connectedAddress ? [connectedAddress] : undefined,
  });

  // Get invoices where user is payer
  const { data: payerInvoiceIds } = useScaffoldReadContract({
    contractName: "InvoiceManager",
    functionName: "getInvoicesOfPayer",
    args: connectedAddress ? [connectedAddress] : undefined,
  });

  // Watch for new invoice events
  const { data: createdEvents } = useScaffoldEventHistory({
    contractName: "InvoiceManager",
    eventName: "InvoiceCreated",
    watch: true,
  });

  const { data: paidEvents } = useScaffoldEventHistory({
    contractName: "InvoiceManager",
    eventName: "InvoicePaid",
    watch: true,
  });

  const { data: withdrawnEvents } = useScaffoldEventHistory({
    contractName: "InvoiceManager",
    eventName: "InvoiceWithdrawn",
    watch: true,
  });

  // Combine all invoice IDs
  const allInvoiceIds = useMemo(() => {
    const ids = new Set<bigint>();
    try {
      if (issuerInvoiceIds && Array.isArray(issuerInvoiceIds)) {
        issuerInvoiceIds.forEach((id: bigint) => {
          if (id !== undefined && id !== null) {
            ids.add(BigInt(id.toString()));
          }
        });
      }
      if (payerInvoiceIds && Array.isArray(payerInvoiceIds)) {
        payerInvoiceIds.forEach((id: bigint) => {
          if (id !== undefined && id !== null) {
            ids.add(BigInt(id.toString()));
          }
        });
      }
      // Also add from events
      if (createdEvents && Array.isArray(createdEvents)) {
        createdEvents.forEach((event: any) => {
          if (event?.args?.id) {
            try {
              ids.add(BigInt(event.args.id.toString()));
            } catch (e) {
              console.error("Error parsing event ID:", e);
            }
          }
        });
      }
    } catch (error) {
      console.error("Error combining invoice IDs:", error);
    }
    return Array.from(ids);
  }, [issuerInvoiceIds, payerInvoiceIds, createdEvents]);

  // Create stable string representation for dependency comparison
  const invoiceIdsKey = useMemo(() => {
    return allInvoiceIds.map(id => id.toString()).sort().join(",");
  }, [allInvoiceIds]);

  // Create stable key from events to trigger refresh when payments/withdrawals happen
  const eventsKey = useMemo(() => {
    const paidCount = paidEvents?.length || 0;
    const withdrawnCount = withdrawnEvents?.length || 0;
    return `${paidCount}-${withdrawnCount}`;
  }, [paidEvents?.length, withdrawnEvents?.length]);

  // Fetch invoice details
  useEffect(() => {
    const fetchInvoices = async () => {
      if (!connectedAddress || !publicClient) {
        setLoading(false);
        setInvoices([]);
        return;
      }

      // Skip if invoice IDs and events haven't changed
      const currentKey = `${invoiceIdsKey}-${eventsKey}`;
      if (currentKey === prevInvoiceIdsRef.current) {
        return;
      }
      
      prevInvoiceIdsRef.current = currentKey;

      try {
        setLoading(true);
        const deployedContract = (await import("~~/contracts/deployedContracts")).default;
        const chainId = publicClient.chain?.id;
        if (!chainId || !deployedContract[chainId]?.InvoiceManager) {
          setLoading(false);
          setInvoices([]);
          return;
        }

        // If no invoice IDs, just set empty array
        if (allInvoiceIds.length === 0) {
          setInvoices([]);
          setLoading(false);
          return;
        }

        const contractAddress = deployedContract[chainId].InvoiceManager.address;
        const contractAbi = deployedContract[chainId].InvoiceManager.abi;

        const invoicePromises = allInvoiceIds.map(async (id) => {
          try {
            const result = await publicClient.readContract({
              address: contractAddress,
              abi: contractAbi,
              functionName: "getInvoice",
              args: [id],
            });

            // getInvoice returns (Invoice, string)
            const invoiceStruct = result[0] as any;
            const metadata = result[1] as string;

            return {
              id,
              issuer: invoiceStruct.issuer as string,
              payer: invoiceStruct.payer as string,
              amount: invoiceStruct.amount as bigint,
              paidAmount: invoiceStruct.paidAmount as bigint,
              dueDate: invoiceStruct.dueDate as bigint,
              cancelled: invoiceStruct.cancelled as boolean,
              metadata: metadata,
            };
          } catch (e) {
            console.error(`Error fetching invoice ${id}:`, e);
            return null;
          }
        });

        const fetchedInvoices = (await Promise.all(invoicePromises)).filter((inv) => inv !== null) as Invoice[];
        setInvoices(fetchedInvoices);
      } catch (error) {
        console.error("Error fetching invoices:", error);
        toast.error("Failed to load invoices");
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [connectedAddress, publicClient, invoiceIdsKey, eventsKey]);

  const handlePayInvoice = async (invoiceId: bigint, remainingAmount: bigint) => {
    try {
      setPayingInvoiceId(invoiceId);
      await writeInvoiceManager({
        functionName: "payInvoice",
        args: [invoiceId],
        value: remainingAmount,
      });
      toast.success("Payment successful!");
      // Data will auto-refresh via events
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error?.message || "Payment failed");
    } finally {
      setPayingInvoiceId(null);
    }
  };

  const handleWithdraw = async (invoiceId: bigint) => {
    try {
      setWithdrawingInvoiceId(invoiceId);
      await writeInvoiceManager({
        functionName: "withdraw",
        args: [invoiceId],
      });
      toast.success("Withdrawal successful!");
      // Data will auto-refresh via events
    } catch (error: any) {
      console.error("Withdrawal error:", error);
      toast.error(error?.message || "Withdrawal failed");
    } finally {
      setWithdrawingInvoiceId(null);
    }
  };

  const formatDate = (timestamp: bigint) => {
    if (timestamp === 0n) return "No due date";
    return new Date(Number(timestamp) * 1000).toLocaleDateString();
  };

  if (!connectedAddress) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please connect your wallet</h1>
          <p className="text-neutral">Connect your wallet to view and manage invoices</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">My Invoices</h1>
        <Link href="/invoices/create" className="btn btn-primary">
          Create Invoice
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4">Loading invoices...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-neutral text-lg">No invoices found</p>
          <Link href="/invoices/create" className="btn btn-primary mt-4">
            Create your first invoice
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {invoices.map((invoice) => {
            const remaining = invoice.amount - invoice.paidAmount;
            const isIssuer = invoice.issuer.toLowerCase() === connectedAddress.toLowerCase();
            const isPayer = invoice.payer.toLowerCase() === connectedAddress.toLowerCase() || invoice.payer === "0x0000000000000000000000000000000000000000";
            
            // Check if invoice was ever fully paid (by checking if it was withdrawn)
            const wasWithdrawn = withdrawnEvents?.some(
              (event: any) => event.args?.id?.toString() === invoice.id.toString()
            ) || false;
            
            // If withdrawn, invoice is considered fully paid (even though paidAmount is now 0)
            const isFullyPaid = wasWithdrawn || remaining === 0n;
            
            const canPay = !invoice.cancelled && !isFullyPaid && remaining > 0n && (isPayer || invoice.payer === "0x0000000000000000000000000000000000000000");
            const canWithdraw = isIssuer && invoice.paidAmount > 0n;

            return (
              <div key={invoice.id.toString()} className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="card-title">Invoice #{invoice.id.toString()}</h2>
                      <div className="mt-2 space-y-1">
                        <div>
                          <span className="font-semibold">Issuer:</span>{" "}
                          <Address address={invoice.issuer} />
                        </div>
                        <div>
                          <span className="font-semibold">Payer:</span>{" "}
                          {invoice.payer === "0x0000000000000000000000000000000000000000" ? (
                            <span className="text-accent">Anyone can pay</span>
                          ) : (
                            <Address address={invoice.payer} />
                          )}
                        </div>
                        <div>
                          <span className="font-semibold">Amount:</span> {formatEther(invoice.amount)} ETH
                        </div>
                        <div>
                          <span className="font-semibold">Paid:</span> {formatEther(invoice.paidAmount)} ETH
                        </div>
                        <div>
                          <span className="font-semibold">Remaining:</span> {formatEther(remaining)} ETH
                        </div>
                        <div>
                          <span className="font-semibold">Due Date:</span> {formatDate(invoice.dueDate)}
                        </div>
                        <div>
                          <span className="font-semibold">Status:</span>{" "}
                          {invoice.cancelled ? (
                            <span className="badge badge-error">Cancelled</span>
                          ) : isFullyPaid ? (
                            <span className="badge badge-success">
                              {wasWithdrawn ? "Paid (Withdrawn)" : "Paid"}
                            </span>
                          ) : (
                            <span className="badge badge-warning">Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="card-actions justify-end">
                      {canPay && (
                        <button
                          className="btn btn-primary"
                          onClick={() => handlePayInvoice(invoice.id, remaining)}
                          disabled={payingInvoiceId === invoice.id}
                        >
                          {payingInvoiceId === invoice.id ? (
                            <span className="loading loading-spinner"></span>
                          ) : (
                            "Pay"
                          )}
                        </button>
                      )}
                      {canWithdraw && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleWithdraw(invoice.id)}
                          disabled={withdrawingInvoiceId === invoice.id}
                        >
                          {withdrawingInvoiceId === invoice.id ? (
                            <span className="loading loading-spinner"></span>
                          ) : (
                            "Withdraw"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;

