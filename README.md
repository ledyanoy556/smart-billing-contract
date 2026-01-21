# 💰 BillPay Contract

A decentralized invoice and billing management system built on Ethereum using Scaffold-ETH 2.

## 📋 Overview

BillPay Contract is a smart contract-based solution for managing invoices (bills) on the blockchain. It allows organizations and individuals to:

- Create invoices with customizable payment terms
- Accept partial and full payments
- Withdraw collected funds
- Cancel invoices with automatic refunds
- Track invoice history and status

## 🛠 Tech Stack

- **Smart Contracts**: Solidity ^0.8.17
- **Framework**: Hardhat
- **Frontend**: Next.js 15, React 19, TypeScript
- **Web3**: Wagmi, Viem, RainbowKit
- **Testing**: Hardhat, ethers.js, Chai
- **Security**: OpenZeppelin Contracts (ReentrancyGuard, Ownable)
- **UI**: Tailwind CSS, DaisyUI

## 📦 Requirements

- Node.js >= 20.18.3
- Yarn (v1 or v2+)
- Git

## 🚀 Quick Start

### 1. Install Dependencies

```bash
yarn install
```

### 2. Start Local Blockchain

In the first terminal:

```bash
yarn chain
```

This starts a local Hardhat network on `http://localhost:8545`.

### 3. Deploy Contracts

In a second terminal:

```bash
yarn deploy
```

This deploys the `InvoiceManager` contract to your local network. The contract address will be automatically saved to `packages/nextjs/contracts/deployedContracts.ts`.

### 4. Start Frontend

In a third terminal:

```bash
yarn start
```

Visit `http://localhost:3000` to interact with the application.


## 🛌 User Flow

### After launching the service, you need to connect your wallet:

![screenshot_1](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_1.png)

### Select "MetaMask":

![screenshot_2](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_2.png)

![screenshot_3](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_3.png)

### Using the "Grab funds from faucet" button, we can add +1 ETH to the wallet:

![screenshot_4](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_4.png)

### Go to the list of invoices:

![screenshot_5](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_5.png)

### Create invoice:

![screenshot_6](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_6.png)

### Create an invoice for 1 ETH:

![screenshot_7](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_7.png)

### Confirm the transaction request in MetaMask:

![screenshot_12](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_12.png)

### Pay the invoice:

![screenshot_9](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_8.png)

### Confirm transaction in MetaMask:

![screenshot_10](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_9.png)

### Invoice paid:

![screenshot_11](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_10.png)

### It is possible to withdraw the invoice. Revoke the invoice (Withdraw button):

![screenshot_12](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_11.png)

### Confirm in MetaMask:

![screenshot_13](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_12.png)

### Invoice is withdrawn:

![screenshot_14](https://github.com/ledyanoy556/smart-billing-contract/raw/main/screenshots/screenshot_13.png)


## 📝 Contract API

### InvoiceManager Contract

#### Functions

**`createInvoice(address payer, uint256 amount, uint256 dueDate, string calldata metadata)`**
- Creates a new invoice
- `payer`: Address of the payer (use `0x0` for open invoices that anyone can pay)
- `amount`: Invoice amount in wei
- `dueDate`: Unix timestamp (0 for no due date)
- `metadata`: IPFS hash, URI, or description string
- Returns: `uint256 invoiceId`
- Emits: `InvoiceCreated` event

**`payInvoice(uint256 invoiceId)`**
- Pay an invoice (supports partial payments)
- Must send ETH with the transaction
- If overpaid, excess is stored in `pendingReturns` (pull pattern)
- Emits: `InvoicePaid` event

**`withdraw(uint256 invoiceId)`**
- Withdraw funds from a paid invoice (issuer only)
- Transfers collected funds to the issuer
- Emits: `InvoiceWithdrawn` event

**`cancelInvoice(uint256 invoiceId)`**
- Cancel an invoice (issuer only)
- Refunds paid amount to payer via `pendingReturns`
- Emits: `InvoiceCancelled` event

**`withdrawPending()`**
- Withdraw pending returns (overpayments/refunds)
- Pull pattern for security

**`getInvoice(uint256 invoiceId)`**
- Get invoice data and metadata
- Returns: `(Invoice struct, string metadata)`

**`getInvoicesOfIssuer(address issuer)`**
- Get all invoice IDs created by an issuer
- Returns: `uint256[]`

**`getInvoicesOfPayer(address payer)`**
- Get all invoice IDs addressed to a payer
- Returns: `uint256[]`

**`getRemainingAmount(uint256 invoiceId)`**
- Get remaining amount to be paid
- Returns: `uint256`

#### Events

- `InvoiceCreated(uint256 indexed id, address indexed issuer, address indexed payer, uint256 amount)`
- `InvoicePaid(uint256 indexed id, address indexed payer, uint256 amount, uint256 paidAmount)`
- `InvoiceCancelled(uint256 indexed id)`
- `InvoiceWithdrawn(uint256 indexed id, address indexed issuer, uint256 amount)`
- `PendingReturnWithdrawn(address indexed user, uint256 amount)`

#### Invoice Struct

```solidity
struct Invoice {
    uint256 id;           // Unique invoice ID
    address issuer;       // Address that created the invoice
    address payer;        // Address the invoice is addressed to (0x0 = anyone can pay)
    uint256 amount;       // Total invoice amount in wei
    uint256 paidAmount;   // Amount already paid in wei
    uint256 dueDate;      // Unix timestamp (0 = no due date)
    bool cancelled;       // Whether the invoice is cancelled
}
```

## 🧪 Testing

Run the test suite:

```bash
yarn test
```

The test suite covers:
- Invoice creation
- Partial and full payments
- Overpayment handling (pull pattern)
- Withdrawals
- Cancellations
- Reentrancy protection
- Access control

## 📜 CLI Scripts

### Create Invoice

```bash
# Set contract address (from deployment output)
export INVOICE_MANAGER_ADDRESS=0x...

# Create invoice
yarn hardhat run scripts/createInvoice.ts --network localhost
```

### Pay Invoice

```bash
# Pay invoice ID 0 with 0.5 ETH
export INVOICE_MANAGER_ADDRESS=0x...
export INVOICE_ID=0
export PAYMENT_AMOUNT=0.5

yarn hardhat run scripts/payInvoice.ts --network localhost
```

### Withdraw Funds

```bash
# Withdraw from invoice ID 0 (issuer only)
export INVOICE_MANAGER_ADDRESS=0x...
export INVOICE_ID=0

yarn hardhat run scripts/withdraw.ts --network localhost
```

## 🎨 Frontend Usage

### View Invoices

Navigate to `/invoices` to see:
- Invoices you created (as issuer)
- Invoices addressed to you (as payer)
- Invoice status, amounts, and due dates
- Actions: Pay, Withdraw

### Create Invoice

Navigate to `/invoices/create` to:
- Set payer address (optional - leave empty for open invoice)
- Set amount in ETH
- Set due date (optional)
- Add metadata (IPFS hash, URI, or description)

### Pay Invoice

From the invoices list, click "Pay" on any unpaid invoice. The payment will:
- Send ETH to the contract
- Update the invoice's `paidAmount`
- Handle overpayments via pull pattern

### Withdraw Funds

As an issuer, click "Withdraw" on paid invoices to:
- Transfer collected funds to your address
- Reset the invoice's `paidAmount`

## 🔒 Security Features

- **ReentrancyGuard**: All state-changing functions are protected against reentrancy attacks
- **Pull Pattern**: Overpayments and refunds use pull pattern (users must call `withdrawPending()`)
- **Access Control**: Only issuers can withdraw or cancel their invoices
- **Input Validation**: All functions validate inputs (amount > 0, invoice exists, etc.)
- **OpenZeppelin**: Uses battle-tested OpenZeppelin contracts

## 🌐 Deployment

### Local Network

```bash
yarn deploy
```

### Testnet (Sepolia)

```bash
# Set your private key in .env
# DEPLOYER_PRIVATE_KEY=your_private_key

yarn deploy --network sepolia
```

### Mainnet

```bash
# Set your private key in .env
# DEPLOYER_PRIVATE_KEY=your_private_key

yarn deploy --network mainnet
```

## 📁 Project Structure

```
smart-billing-contract/
├── packages/
│   ├── hardhat/
│   │   ├── contracts/
│   │   │   └── InvoiceManager.sol      # Main contract
│   │   ├── deploy/
│   │   │   └── 01_deploy_invoice_manager.ts
│   │   ├── scripts/
│   │   │   ├── createInvoice.ts
│   │   │   ├── payInvoice.ts
│   │   │   └── withdraw.ts
│   │   └── test/
│   │       └── InvoiceManager.test.ts
│   └── nextjs/
│       ├── app/
│       │   ├── invoices/
│       │   │   ├── page.tsx            # Invoice dashboard
│       │   │   └── create/
│       │   │       └── page.tsx        # Create invoice form
│       │   └── page.tsx                # Home page
│       └── contracts/
│           └── deployedContracts.ts    # Auto-generated
├── .github/
│   └── workflows/
│       └── ci.yml                      # CI/CD pipeline
└── README.md
```

## 🔄 CI/CD

GitHub Actions automatically:
- Runs tests on push/PR
- Lints code
- Builds frontend
- Supports Node.js 18.x and 20.x

## 📚 Examples

### Example: Create and Pay Invoice

1. **Create Invoice**:
   ```solidity
   createInvoice(
       0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb,  // payer
       1000000000000000000,                        // 1 ETH
       1735689600,                                 // due date
       "ipfs://QmExample123"                       // metadata
   )
   ```

2. **Pay Invoice** (partial):
   ```solidity
   payInvoice(0)  // Send 0.3 ETH with transaction
   ```

3. **Pay Remaining**:
   ```solidity
   payInvoice(0)  // Send 0.7 ETH with transaction
   ```

4. **Withdraw** (issuer):
   ```solidity
   withdraw(0)  // Transfers 1 ETH to issuer
   ```

## 🐛 Troubleshooting

### Contract Not Deployed

If you see "Contract not deployed" errors:
1. Make sure `yarn chain` is running
2. Run `yarn deploy` to deploy the contract
3. Check that `deployedContracts.ts` has the contract address

### Tests Failing

- Ensure Hardhat network is running: `yarn chain`
- Check that OpenZeppelin contracts are installed: `yarn install`

### Frontend Not Loading

- Check that `yarn start` is running
- Verify contract is deployed: `yarn deploy`
- Check browser console for errors

## 📄 License

MIT

## 🙏 Acknowledgments

- Built on [Scaffold-ETH 2](https://github.com/scaffold-eth/scaffold-eth-2)
- Uses [OpenZeppelin Contracts](https://openzeppelin.com/contracts/)

## 🔮 Future Enhancements

- [ ] ERC20 token payment support
- [ ] Multi-currency invoices
- [ ] Invoice templates
- [ ] Recurring invoices
- [ ] Invoice sharing via QR codes
- [ ] Integration with payment gateways

## 📞 Support

For issues and questions:
- Check the [Scaffold-ETH 2 documentation](https://docs.scaffoldeth.io)
- Open an issue on GitHub

---

**Note**: This is a development version. For production use, ensure proper security audits and testing.
