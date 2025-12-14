// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title InvoiceManager
 * @author billpay-contract
 * @notice A smart contract for managing invoices (bills) with support for partial payments,
 *         overpayments, withdrawals, and cancellations.
 * @dev Uses OpenZeppelin's ReentrancyGuard for security and pull pattern for refunds.
 */
contract InvoiceManager is ReentrancyGuard, Ownable {
    using Address for address payable;

    /**
     * @notice Invoice structure containing all invoice data
     * @param id Unique invoice identifier
     * @param issuer Address that created the invoice (seller/organization)
     * @param payer Address the invoice is addressed to (0x0 means anyone can pay)
     * @param amount Total invoice amount in wei
     * @param paidAmount Amount already paid in wei
     * @param dueDate Unix timestamp for payment due date (0 means no due date)
     * @param cancelled Whether the invoice has been cancelled
     */
    struct Invoice {
        uint256 id;
        address issuer;
        address payer;
        uint256 amount;
        uint256 paidAmount;
        uint256 dueDate;
        bool cancelled;
    }

    /// @notice Next invoice ID to be assigned
    uint256 public nextInvoiceId;

    /// @notice Mapping from invoice ID to Invoice struct
    mapping(uint256 => Invoice) public invoices;

    /// @notice Mapping from invoice ID to metadata string (IPFS hash, URI, or description)
    mapping(uint256 => string) public invoiceMetadata;

    /// @notice Pull pattern: mapping of addresses to their pending returns (overpayments/refunds)
    mapping(address => uint256) public pendingReturns;

    /// @notice Mapping from issuer address to array of invoice IDs they created
    mapping(address => uint256[]) public invoicesOfIssuer;

    /// @notice Mapping from payer address to array of invoice IDs addressed to them
    mapping(address => uint256[]) public invoicesOfPayer;

    /**
     * @notice Emitted when a new invoice is created
     * @param id Invoice ID
     * @param issuer Address that created the invoice
     * @param payer Address the invoice is addressed to
     * @param amount Invoice amount in wei
     */
    event InvoiceCreated(
        uint256 indexed id,
        address indexed issuer,
        address indexed payer,
        uint256 amount
    );

    /**
     * @notice Emitted when an invoice is paid (partially or fully)
     * @param id Invoice ID
     * @param payer Address that made the payment
     * @param amount Payment amount in wei
     * @param paidAmount Total amount paid so far
     */
    event InvoicePaid(
        uint256 indexed id,
        address indexed payer,
        uint256 amount,
        uint256 paidAmount
    );

    /**
     * @notice Emitted when an invoice is cancelled
     * @param id Invoice ID
     */
    event InvoiceCancelled(uint256 indexed id);

    /**
     * @notice Emitted when funds are withdrawn from an invoice
     * @param id Invoice ID
     * @param issuer Address that withdrew the funds
     * @param amount Amount withdrawn in wei
     */
    event InvoiceWithdrawn(
        uint256 indexed id,
        address indexed issuer,
        uint256 amount
    );

    /**
     * @notice Emitted when pending returns are withdrawn
     * @param user Address that withdrew pending returns
     * @param amount Amount withdrawn in wei
     */
    event PendingReturnWithdrawn(address indexed user, uint256 amount);

    /**
     * @notice Constructor sets the initial owner
     * @param _owner Address that will own the contract (can be used for admin functions)
     */
    constructor(address _owner) Ownable(_owner) {}

    /**
     * @notice Creates a new invoice
     * @param payer Address the invoice is addressed to (0x0 means anyone can pay)
     * @param amount Invoice amount in wei (must be > 0)
     * @param dueDate Unix timestamp for payment due date (0 means no due date)
     * @param metadata IPFS hash, URI, or description string
     * @return invoiceId The ID of the newly created invoice
     */
    function createInvoice(
        address payer,
        uint256 amount,
        uint256 dueDate,
        string calldata metadata
    ) external returns (uint256 invoiceId) {
        require(amount > 0, "InvoiceManager: amount must be greater than 0");

        invoiceId = nextInvoiceId;
        nextInvoiceId++;

        invoices[invoiceId] = Invoice({
            id: invoiceId,
            issuer: msg.sender,
            payer: payer,
            amount: amount,
            paidAmount: 0,
            dueDate: dueDate,
            cancelled: false
        });

        invoiceMetadata[invoiceId] = metadata;

        // Track invoices by issuer and payer
        invoicesOfIssuer[msg.sender].push(invoiceId);
        if (payer != address(0)) {
            invoicesOfPayer[payer].push(invoiceId);
        }

        emit InvoiceCreated(invoiceId, msg.sender, payer, amount);
    }

    /**
     * @notice Pay an invoice (supports partial payments)
     * @dev If payment exceeds remaining amount, overpayment is stored in pendingReturns
     * @param invoiceId ID of the invoice to pay
     */
    function payInvoice(uint256 invoiceId) external payable nonReentrant {
        require(msg.value > 0, "InvoiceManager: payment amount must be greater than 0");

        Invoice storage invoice = invoices[invoiceId];
        require(invoice.issuer != address(0), "InvoiceManager: invoice does not exist");
        require(!invoice.cancelled, "InvoiceManager: invoice is cancelled");
        require(
            invoice.payer == address(0) || invoice.payer == msg.sender,
            "InvoiceManager: invoice is not addressed to you"
        );

        uint256 remaining = invoice.amount - invoice.paidAmount;
        require(remaining > 0, "InvoiceManager: invoice is already fully paid");

        uint256 paymentAmount = msg.value;
        uint256 overpay = 0;

        if (paymentAmount > remaining) {
            // Overpayment: store excess in pendingReturns (pull pattern)
            overpay = paymentAmount - remaining;
            pendingReturns[msg.sender] += overpay;
            paymentAmount = remaining;
        }

        invoice.paidAmount += paymentAmount;

        emit InvoicePaid(invoiceId, msg.sender, paymentAmount, invoice.paidAmount);
    }

    /**
     * @notice Withdraw funds from a paid invoice (only issuer can withdraw)
     * @param invoiceId ID of the invoice to withdraw from
     */
    function withdraw(uint256 invoiceId) external nonReentrant {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.issuer != address(0), "InvoiceManager: invoice does not exist");
        require(invoice.issuer == msg.sender, "InvoiceManager: only issuer can withdraw");
        require(invoice.paidAmount > 0, "InvoiceManager: no funds to withdraw");

        uint256 withdrawAmount = invoice.paidAmount;
        invoice.paidAmount = 0;

        payable(msg.sender).sendValue(withdrawAmount);

        emit InvoiceWithdrawn(invoiceId, msg.sender, withdrawAmount);
    }

    /**
     * @notice Cancel an invoice and refund any paid amount to the payer
     * @dev Only issuer can cancel. Refunds go to pendingReturns (pull pattern)
     * @param invoiceId ID of the invoice to cancel
     */
    function cancelInvoice(uint256 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.issuer != address(0), "InvoiceManager: invoice does not exist");
        require(invoice.issuer == msg.sender, "InvoiceManager: only issuer can cancel");
        require(!invoice.cancelled, "InvoiceManager: invoice is already cancelled");

        invoice.cancelled = true;

        // If there's a paid amount and a specific payer, add to their pending returns
        if (invoice.paidAmount > 0 && invoice.payer != address(0)) {
            pendingReturns[invoice.payer] += invoice.paidAmount;
            invoice.paidAmount = 0;
        }

        emit InvoiceCancelled(invoiceId);
    }

    /**
     * @notice Withdraw pending returns (overpayments/refunds)
     * @dev Pull pattern: users must call this to get their refunds
     */
    function withdrawPending() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "InvoiceManager: no pending returns");

        pendingReturns[msg.sender] = 0;
        payable(msg.sender).sendValue(amount);

        emit PendingReturnWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Get invoice data and metadata
     * @param invoiceId ID of the invoice
     * @return invoice The Invoice struct
     * @return metadata The metadata string
     */
    function getInvoice(
        uint256 invoiceId
    ) external view returns (Invoice memory invoice, string memory metadata) {
        invoice = invoices[invoiceId];
        require(invoice.issuer != address(0), "InvoiceManager: invoice does not exist");
        metadata = invoiceMetadata[invoiceId];
    }

    /**
     * @notice Get all invoice IDs created by an issuer
     * @param issuer Address of the issuer
     * @return Array of invoice IDs
     */
    function getInvoicesOfIssuer(address issuer) external view returns (uint256[] memory) {
        return invoicesOfIssuer[issuer];
    }

    /**
     * @notice Get all invoice IDs addressed to a payer
     * @param payer Address of the payer
     * @return Array of invoice IDs
     */
    function getInvoicesOfPayer(address payer) external view returns (uint256[] memory) {
        return invoicesOfPayer[payer];
    }

    /**
     * @notice Get the remaining amount to be paid for an invoice
     * @param invoiceId ID of the invoice
     * @return Remaining amount in wei
     */
    function getRemainingAmount(uint256 invoiceId) external view returns (uint256) {
        Invoice memory invoice = invoices[invoiceId];
        require(invoice.issuer != address(0), "InvoiceManager: invoice does not exist");
        if (invoice.amount > invoice.paidAmount) {
            return invoice.amount - invoice.paidAmount;
        }
        return 0;
    }

    /**
     * @notice Allow contract to receive ETH
     */
    receive() external payable {}
}

