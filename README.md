# Easy-Quickbooks-VE

A browser-based accounting journal application built for **Virtual Enterprises (VE)** systems. Track expenses, receivables, payables, cash flow, and profit & loss — all running locally in your browser with no server required.

## Features

### Journal
- **Transaction Entry**: Add receivable/payable transactions with dates, categories, amounts, status tracking, and notes
- **Inline Status Changes**: Change transaction status (pending/paid/received) directly in the table with month-paid prompt
- **Category Folders**: Organize categories into typed folders (Payable, Receivable, or None)
- **Monthly Payment Categories**: Mark categories as recurring with "Payment For" month tracking
- **Pretax Amounts**: Track pretax amounts separately for receivable transactions
- **Bulk Folder Entries**: Create entries for all categories in a folder at once (+ Add Folder button)
- **Sorting**: Sort transactions by Entry Date, Month Due, or Category
- **Filtering**: Filter by folder, type, status, month, and category
- **Late Payment Detection**: Highlights late payments with indicator text
- **Overdue Detection**: Subtle orange highlighting for overdue pending items
- **CSV Export**: Export all transactions to CSV

### Cash Flow Summary
- Spreadsheet-style view grouped by month (columns) and category (rows)
- Cash Receipts and Cash Payments sections
- Beginning Cash Balance, Total Receipts, Total Payments, Ending Balance
- Net Cash Inflow (Outflow) per month
- **Drag-and-drop** row reordering within sections

### Profit & Loss Statement (VE Format)
- **Accrual-based**: Uses `month_due` (not `month_paid`), includes all transactions regardless of payment status
- **Revenue**: Receivable categories (uses pretax amounts when available)
- **Cost of Goods Sold**: Categories flagged as COGS
- **Gross Profit** and **Gross Margin %**
- **Operating Expenses**: All payable categories in a flat list
- **Depreciation**: Categories flagged as depreciation appear in Operating Expenses with manually-editable values per month (not auto-calculated from transactions)
- **Net Income Before/After Taxes** and **Cumulative Net Income**
- **Tax Mode Dropdown**: Corporate (21% auto-calculated) or Pass-through ($0)
- **Editable Cells**: Click any P&L value to override it; overrides are highlighted and persist
- **Hide from P&L**: Checkbox to exclude categories (e.g., fixed assets) from the P&L

### Data Management
- **Auto-save**: Every change auto-saves to browser IndexedDB (debounced 500ms)
- **Save/Save As**: Export database as `.db` file (uses File System Access API when available)
- **Load**: Import a previously saved `.db` file
- **Schema Migration**: Automatically adds new columns/tables when loading older databases
- **Journal Owner**: Editable name in header, reflected in page title and export filenames

## Quick Start

1. Open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari)
2. Enter your company/owner name in the header
3. Create category folders and categories via **Manage Categories**
4. Start adding transactions with the **+ New Entry** button
5. Your data auto-saves to the browser automatically

## How to Use

### Categories & Folders
1. Click **Manage Categories** in the header
2. Create folders (Payable/Receivable type) to group categories
3. Add categories with typical price, type, and P&L flags:
   - **Hide from P&L**: Excludes from profit & loss (use for fixed assets)
   - **Cost of Goods Sold**: Appears in COGS section of P&L
   - **Depreciation**: Appears in P&L Operating Expenses as manually-editable rows
   - **Monthly**: Enables "Payment For" month tracking

### Adding Transactions
1. Click **+ New Entry** or **+ Add Folder** for bulk entry
2. Select a category (auto-fills default amount and type)
3. Set the amount, type, status, month due
4. For receivables, optionally enter a pretax amount
5. Click **Add Entry**

### Profit & Loss
1. Click the **Profit & Loss** tab
2. Select tax mode: Corporate (21%) or Pass-through
3. Click any cell to override the auto-calculated value
4. Depreciation rows default to $0 — click cells to enter monthly depreciation amounts

## Technical Details

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (no frameworks)
- **Database**: SQLite via sql.js (WebAssembly)
- **Storage**: IndexedDB for auto-save, File System Access API or download for backups
- **Architecture**: Global singletons — `Utils`, `Database`, `UI`, `App`
- **No Server Required**: Runs entirely in the browser

## File Structure

```
Easy-Quickbooks-VE/
├── index.html              # Main HTML (layout, modals, forms)
├── css/
│   └── styles.css          # All styling with CSS variables
├── js/
│   ├── utils.js            # Formatting, dates, grouping helpers
│   ├── database.js         # SQLite CRUD, migrations, P&L queries
│   ├── ui.js               # DOM rendering (tables, spreadsheets, forms)
│   └── app.js              # Event handlers, app logic, tab switching
├── PROGRESS_NOTEBOOK.md    # Development progress log
└── README.md               # This file
```

## Database Schema

### Tables
- **categories** — id, name, type, is_monthly, default_amount, default_type, folder_id, cashflow_sort_order, show_on_pl, is_cogs, is_depreciation
- **category_folders** — id, name, folder_type, sort_order
- **transactions** — id, entry_date, category_id, item_description, amount, pretax_amount, transaction_type, status, date_processed, month_due, month_paid, payment_for_month, notes
- **pl_overrides** — category_id, month, override_amount (for P&L manual overrides; category_id -1 = Income Tax)
- **app_meta** — key/value store (journal_owner, journal_name, pl_tax_mode, migration flags)

## Browser Support

Works in all modern browsers:
- Chrome 57+
- Firefox 52+
- Safari 11+
- Edge 16+

## Notes

- Data is stored per-browser (different browsers = separate data)
- Use **Save** regularly to backup your data as a `.db` file
- Internet required on first load (sql.js loaded from CDN)
- Designed specifically for VE (Virtual Enterprises) accounting workflows

---

For development notes and change history, see `PROGRESS_NOTEBOOK.md`
