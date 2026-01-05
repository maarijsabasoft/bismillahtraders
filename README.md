# Bismillah Traders - Beverages Management System

A comprehensive web-based desktop application for managing beverages business operations including inventory, sales, customers, suppliers, staff, and financial reporting.

## Features

### Core Modules

1. **Company & Product Management**
   - Manage multiple companies/brands
   - Add products with SKU, barcode, category, bottle size
   - Set purchase and sale prices
   - Tax and discount configuration
   - Activate/deactivate products

2. **Inventory & Stock Management**
   - Stock IN/OUT tracking
   - Real-time stock levels
   - Low-stock alerts
   - Batch and expiry date tracking
   - Opening & closing stock

3. **Customer & Supplier Management**
   - Complete customer profiles
   - Business type classification
   - Credit limit management
   - Outstanding balance tracking
   - Supplier management with payable tracking

4. **Sales Management**
   - Create sales orders
   - Cash & credit sales
   - Multiple payment methods (Cash, Bank Transfer, JazzCash, EasyPaisa)
   - Discount handling
   - Returns & refunds support

5. **Invoice & Billing**
   - Auto-generated invoices
   - Professional invoice format
   - Print & PDF export
   - Invoice reprint capability

6. **Reports**
   - Daily, weekly, and monthly sales reports
   - Product-wise and company-wise sales
   - Profit & loss reports
   - Outstanding receivables & payables
   - Payment method breakdown

7. **Staff Management**
   - Staff profiles with roles (Admin, Manager, Cashier)
   - Salary setup
   - Attendance tracking
   - Monthly salary reports

8. **Expense Management**
   - Fixed & variable expenses
   - Transport & fuel costs
   - Utility bills
   - Miscellaneous expenses
   - Cost vs profit analysis

## Technology Stack

- **Frontend**: React 18
- **Desktop**: Electron
- **Database**: SQLite (better-sqlite3)
- **Routing**: React Router v6
- **Styling**: CSS (Light theme, no gradients)

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Run the application in development mode:
```bash
npm start
```

4. In another terminal, run Electron:
```bash
npm run electron
```

## Building for Production

To build the application for production:

```bash
npm run build
npm run electron-pack
```

This will create an executable file in the `dist` folder.

## Database

The application uses SQLite database stored locally. The database file (`bismillah_traders.db`) is automatically created in the user's application data directory when the app first runs.

### Database Location
- **Windows**: `%APPDATA%/bismillah-traders/bismillah_traders.db`
- **macOS**: `~/Library/Application Support/bismillah-traders/bismillah_traders.db`
- **Linux**: `~/.config/bismillah-traders/bismillah_traders.db`

## Usage

1. **Start by adding Companies**: Navigate to Companies section and add your beverage companies/brands.

2. **Add Products**: Go to Products section and add products under each company.

3. **Manage Inventory**: Use Inventory section to record stock IN/OUT transactions.

4. **Add Customers & Suppliers**: Set up your customer and supplier database.

5. **Create Sales**: Use the Sales section to create new sales orders with multiple products.

6. **View Reports**: Check Reports section for sales, profit, and expense analysis.

7. **Manage Staff**: Add staff members and track their information in the Staff section.

8. **Track Expenses**: Record all business expenses in the Expenses section.

## Project Structure

```
bismillah-traders/
├── public/
│   ├── electron.js          # Electron main process
│   └── index.html           # HTML template
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Button/
│   │   ├── Card/
│   │   ├── Input/
│   │   ├── Layout/
│   │   ├── Modal/
│   │   └── Table/
│   ├── context/             # React context providers
│   │   └── DatabaseContext.js
│   ├── pages/               # Page components
│   │   ├── Dashboard/
│   │   ├── Companies/
│   │   ├── Products/
│   │   ├── Inventory/
│   │   ├── Customers/
│   │   ├── Suppliers/
│   │   ├── Sales/
│   │   ├── Invoices/
│   │   ├── Reports/
│   │   ├── Staff/
│   │   └── Expenses/
│   ├── utils/               # Utility functions
│   │   └── database.js      # Database initialization
│   ├── App.js               # Main app component
│   └── index.js            # Entry point
├── package.json
└── README.md
```

## Features Highlights

- **No Backend Required**: All data is stored locally using SQLite
- **Professional UI**: Clean, simple light theme interface
- **Real-time Updates**: Instant updates across all modules
- **Comprehensive Reporting**: Detailed sales and financial reports
- **Multi-payment Support**: Support for various payment methods
- **Inventory Tracking**: Real-time stock level monitoring
- **Customer Credit Management**: Track outstanding balances

## License

This project is proprietary software for Bismillah Traders.

## Support

For issues or questions, please contact the development team.

