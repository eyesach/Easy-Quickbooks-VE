# Easy-Quickbooks-VE

A browser-based accounting journal application built for **Virtual Enterprises (VE)** systems. Track expenses, receivables, payables, cash flow, profit & loss, balance sheets, fixed assets, loans, budgets, and break-even analysis — all running locally in your browser with no server required. Optional collaborative group sync via Supabase.

## Quick Start

1. Open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari)
2. Enter your company/owner name in the header
3. Create category folders and categories via **Manage Categories**
4. Start adding transactions with the **+ New Entry** button
5. Your data auto-saves to the browser automatically

## Features

### Journal
- **Transaction Entry**: Add receivable/payable transactions with dates, categories, amounts, status tracking, and notes
- **Inline Status Changes**: Change transaction status (pending/paid/received) directly in the table with month-paid prompt
- **"Paid Today" / "Received Today"**: Quick button sets status, date processed, and month in one click
- **Pretax Amounts**: Track pretax amounts separately for receivable transactions (e.g., gross before sales tax)
- **Bulk Folder Entries**: Create entries for all categories in a folder at once (+ Add Folder button) with live preview
- **Sorting**: Sort transactions by Entry Date, Month Due, or Category
- **Filtering**: Filter by folder, type, status, month, and category (cascading filters)
- **Late Payment Detection**: Highlights late payments with indicator text
- **Overdue Detection**: Subtle highlighting for overdue pending items
- **CSV Export**: Export all transactions to CSV

### Cash Flow Summary
- Spreadsheet-style view grouped by month (columns) and category (rows)
- Cash Receipts and Cash Payments sections
- Beginning Cash Balance, Total Receipts, Total Payments, Ending Balance
- Net Cash Inflow (Outflow) per month
- **Drag-and-drop** row reordering within sections (order saved)
- Future month projections with inline-editable cells

### Profit & Loss Statement (VE Format)
- **Accrual-based**: Uses `month_due`, includes all transactions regardless of payment status
- Revenue, Cost of Goods Sold, Gross Profit, Operating Expenses, Depreciation, EBITDA, Net Income
- Uses pretax amounts for revenue when available
- **Tax Mode**: Corporate (21% auto-calculated) or Pass-through ($0)
- **Editable Cells**: Click any P&L value to override it; overrides highlighted and persisted
- Asset depreciation and loan interest automatically flow into their respective lines
- Categories flagged as: COGS, Depreciation, Sales Tax, B2B Sales, or Hidden from P&L

### Balance Sheet
- "As of" date selector for any month
- **Assets**: Cash, Accounts Receivable (by category), Fixed Assets (gross cost minus accumulated depreciation)
- **Liabilities**: Accounts Payable (by category), Sales Tax Payable, Loan balances outstanding
- **Equity**: Common Stock (par value x shares), Additional Paid-In Capital, Retained Earnings
- Balance verification: Assets = Liabilities + Equity (match/mismatch indicator)

### Assets & Equity
- **Fixed Assets**: Add, edit, delete fixed assets with purchase cost, salvage value, useful life, and depreciation method
- **Depreciation Methods**: Straight-Line, Double-Declining Balance, Not Depreciable
- Full depreciation schedule per asset (month-by-month table)
- Auto-create purchase journal entry option
- **Stockholders' Equity**: Common Stock (par value, shares), APIC amount, expected/received dates
- Auto-create journal entries for seed money and APIC

### Loans
- Multi-loan support with full amortization schedules
- Loan fields: principal, annual rate, term, payments per year, start date, first payment date
- **Inline Payment Overrides**: Click any payment row to override the amount
- **Skip Payments**: Mark individual payments as skipped (interest accrues)
- Auto-create budget expense and journal category option
- Loan interest flows to P&L; balance flows to Balance Sheet

### Budget (Monthly Expenses)
- Add, edit, delete recurring monthly expenses with start/end dates
- Link expenses to journal categories
- **Record to Journal**: Bulk-create journal entries for all active expenses in a chosen month
- Budget expenses feed into Break-Even fixed cost calculations

### Break-Even Analysis
- **Configurable Fixed Costs**: Choose sources — budget expenses, asset depreciation, loan interest, asset purchase costs
- **Dual Sales Channels**: Consumer (price + COGS per unit) and B2B contracts (monthly units at a rate)
- Break-even summary cards: fixed costs, BE revenue, BE units, contribution margins per channel
- **Break-Even Chart**: Revenue vs. Total Costs vs. Variable Costs vs. Fixed Costs by unit volume
- **Monthly Timeline Chart**: Projected fixed costs, revenue, and profit/loss per month
- **Data Table**: Tabular version of the chart data
- **Break-Even Progress Tracker**: Compares actual P&L revenue to break-even targets with "as of" month selector, cumulative revenue vs. pace chart, and on-track/behind status indicator

### Group Sync (Collaborative Sharing)
- **Supabase Backend**: Real-time collaborative editing via Supabase (Postgres + Storage)
- **Create/Join Groups**: Create a shared group and invite others by group ID
- **Auto-Push**: Every local save also pushes the database to the server
- **Auto-Pull**: Background polling (30s) detects and applies remote updates
- **Optimistic Locking**: Conflicts detected when two users save simultaneously; auto-resolves by pulling latest
- **Version History**: Browse all past versions with who saved them and when
- **Rollback**: Restore any previous version with one click
- **Status Indicator**: Colored dot shows sync state (connected, saving, conflict, error)
- Works offline — local saves always succeed; remote sync resumes when connected

### Settings
- **9 Theme Presets**: Default, Ocean, Forest, Sunset, Midnight, Ultra Modern, Futuristic, Vintage Ledger, Accounting
- **Custom Theme**: 4 color pickers for primary, accent, background, and surface colors
- **Timeline**: Global start/end month constrains all reports and date pickers
- **Drag-and-Drop Tab Reordering**: Reorder the 8 tabs; order saved and restored
- **Reset All Data**: Requires typing "RESET" to confirm

### Data Management
- **Auto-Save**: Every change auto-saves to browser IndexedDB (debounced 500ms)
- **Save/Save As**: Export database as `.db` file (uses File System Access API when available)
- **Load**: Import a previously saved `.db` file
- **Schema Migration**: Automatically adds new columns/tables when loading older databases
- **Journal Owner**: Editable name in header, reflected in page title and export filenames

## How to Use

### Categories & Folders
1. Click **Manage Categories** in the header
2. Create folders (Payable/Receivable type) to group categories
3. Add categories with typical price, type, and behavioral flags:
   - **Monthly**: Enables "Payment For" month tracking
   - **Hide from P&L**: Excludes from profit & loss
   - **COGS**: Appears in Cost of Goods Sold section
   - **Depreciation**: Appears as manually-editable P&L rows
   - **Sales Tax**: Tracked separately in Balance Sheet
   - **B2B Sales**: Flags revenue for break-even progress tracking

### Adding Transactions
1. Click **+ New Entry** or **+ Add Folder** for bulk entry
2. Select a category (auto-fills default amount and type)
3. Set the amount, type, status, month due
4. For receivables, optionally enter a pretax amount
5. Click **Add Entry**

### Setting Up Group Sync
1. Create a free [Supabase](https://supabase.com) project
2. Run `supabase-setup.sql` in the Supabase SQL Editor
3. Create a `db-blobs` storage bucket (set to Public)
4. Click the sync icon in the app header, enter your Supabase URL and anon key
5. Create a group and share the invite code with collaborators

## Technical Details

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (no frameworks or bundlers)
- **Database**: SQLite via sql.js (WebAssembly)
- **Storage**: IndexedDB for auto-save, File System Access API for backups
- **Charts**: Chart.js 4.4 with chartjs-plugin-annotation
- **Sync**: Supabase (Postgres + Storage) via pluggable adapter pattern
- **Fonts**: DM Sans (UI) and DM Mono (tables/numbers) from Google Fonts
- **Architecture**: Global singletons — `Utils`, `Database`, `UI`, `App`, `SyncService`, `SupabaseAdapter`
- **No Server Required**: Runs entirely in the browser (sync is optional)

## File Structure

```
Easy-Quickbooks-VE/
├── index.html                # Main HTML (layout, 8 tabs, 20+ modals)
├── css/
│   └── styles.css            # All styling with CSS variables and 9 theme presets
├── js/
│   ├── utils.js              # Formatting, dates, amortization, depreciation, break-even math
│   ├── database.js           # SQLite CRUD, migrations, P&L/Balance Sheet/Cash Flow queries
│   ├── ui.js                 # DOM rendering (tables, spreadsheets, charts, forms)
│   ├── app.js                # Event handlers, app logic, tab switching, sync integration
│   ├── sync.js               # Backend-agnostic sync service (push/pull, versioning, polling)
│   └── supabase-adapter.js   # Supabase implementation of the sync API
├── tests/
│   ├── sync.test.html        # Test runner (open in browser)
│   └── sync.test.js          # 30 unit tests for SyncService
├── supabase-setup.sql        # SQL schema for Supabase backend
├── SYNC_ARCHITECTURE.md      # Detailed sync architecture documentation
├── PROGRESS_NOTEBOOK.md      # Development progress log
└── README.md                 # This file
```

## Database Schema

### Tables
- **categories** — id, name, type, is_monthly, default_amount, default_type, folder_id, cashflow_sort_order, show_on_pl, is_cogs, is_depreciation, is_sales_tax, is_b2b
- **category_folders** — id, name, folder_type, sort_order
- **transactions** — id, entry_date, category_id, item_description, amount, pretax_amount, transaction_type, status, date_processed, month_due, month_paid, payment_for_month, notes
- **pl_overrides** — category_id, month, override_amount (for P&L manual overrides; category_id -1 = Income Tax)
- **fixed_assets** — id, name, purchase_cost, salvage_value, useful_life_months, depreciation_method, purchase_date, depreciation_start_date, notes
- **equity_config** — id, par_value, shares, apic, seed_expected_date, seed_received_date, apic_expected_date, apic_received_date
- **loans** — id, name, principal, annual_rate, term_months, payments_per_year, start_date, first_payment_date, notes
- **loan_payment_overrides** — loan_id, payment_number, override_amount, is_skipped
- **budget_expenses** — id, name, monthly_amount, start_month, end_month, category_id, notes
- **app_meta** — key/value store for all settings and configuration

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
- Group sync requires a Supabase project (free tier is sufficient)
- Designed specifically for VE (Virtual Enterprises) accounting workflows

---

For development notes and change history, see `PROGRESS_NOTEBOOK.md`. For sync architecture details, see `SYNC_ARCHITECTURE.md`.
