# Accounting Journal Calculator - Progress Notebook

This notebook tracks all development progress, changes, and code details for session continuity.
**Last Updated:** 2026-02-18

---

## Project Overview

A browser-based accounting journal application built for **Virtual Enterprises (VE)** systems. Features:
- SQLite database via sql.js (WebAssembly)
- Auto-save to browser's IndexedDB
- Manual database file export/import (File System Access API or download)
- Journal, Cash Flow Summary, and Profit & Loss tabs
- Clean, minimal UI with CSS variables

---

## File Structure

```
Accounting Journal Calculator/
├── index.html              # Main HTML structure (UI layout, all modals)
├── css/
│   └── styles.css          # All styling with CSS variables
├── js/
│   ├── utils.js            # Helper functions (formatting, dates, grouping)
│   ├── database.js         # SQLite operations + IndexedDB + P&L queries
│   ├── ui.js               # UI rendering (tables, spreadsheets, forms)
│   └── app.js              # Main application logic + event handlers
├── PROGRESS_NOTEBOOK.md    # This file
└── README.md               # Setup and usage instructions
```

---

## Database Schema

### Tables

**category_folders**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| name | TEXT | Folder name (unique) |
| folder_type | TEXT | 'payable', 'receivable', or 'none' |
| sort_order | INTEGER | Display order |
| created_at | DATETIME | Creation timestamp |

**categories**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| name | TEXT | Category name (unique) |
| type | TEXT | 'receivable', 'payable', or 'both' |
| is_monthly | INTEGER | 1 if monthly payment (loan, rent, etc.) |
| default_amount | DECIMAL(10,2) | Typical price for this category |
| default_type | TEXT | Default transaction type |
| folder_id | INTEGER | FK to category_folders |
| cashflow_sort_order | INTEGER | Custom sort order for cash flow/P&L |
| show_on_pl | INTEGER | 1 = hidden from P&L (inverted semantics) |
| is_cogs | INTEGER | 1 = Cost of Goods Sold category |
| is_depreciation | INTEGER | 1 = Depreciation (manual P&L entry) |
| created_at | DATETIME | Creation timestamp |

**transactions**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key, auto-increment |
| entry_date | DATE | Date entry was created |
| category_id | INTEGER | FK to categories |
| item_description | TEXT | Optional description |
| amount | DECIMAL(10,2) | Transaction amount |
| pretax_amount | DECIMAL(10,2) | Pretax amount (receivables only) |
| transaction_type | TEXT | 'receivable' or 'payable' |
| status | TEXT | 'pending', 'paid', or 'received' |
| date_processed | DATE | When bank processed |
| month_due | TEXT | Month due (YYYY-MM) |
| month_paid | TEXT | Month paid (YYYY-MM) |
| payment_for_month | TEXT | For monthly payments, which month covered |
| notes | TEXT | Optional notes |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

**pl_overrides**
| Column | Type | Description |
|--------|------|-------------|
| category_id | INTEGER | Category ID (-1 for Income Tax) |
| month | TEXT | Month (YYYY-MM) |
| override_amount | DECIMAL(10,2) | Manual override value |

**app_meta**
| Column | Type | Description |
|--------|------|-------------|
| key | TEXT | Primary key |
| value | TEXT | Setting value |

Known keys: `journal_owner`, `journal_name`, `pl_tax_mode` ('corporate'/'passthrough'), `pl_hide_migration` (one-time flag)

---

## Key Features Implemented

### 1. Entry Form (Modal)
- Entry date with "Today" button (editable for past entries)
- Category dropdown with optgroup folder grouping and "+ New" button
- Amount input
- **Pretax Amount** field (appears for receivable types)
- **Payment For Month** dropdown (appears for monthly categories)
- Type toggle (Receivable/Payable)
- Status dropdown (context-aware: pending/received for receivable, pending/paid for payable)
- Date processed picker (appears when not pending)
- Month due and month paid pickers (split month + year dropdowns)
- Auto-fill month paid from date processed
- Notes field
- Edit mode loads existing transaction data

### 2. Category Management (Modal)
- Categories stored in SQLite with folder grouping
- Default categories pre-populated on first run
- **Category Folders**: Create typed folders (Payable, Receivable, None)
- Folder type enforces default type on contained categories
- **Category Options**:
  - Typical Price (default amount)
  - Typical Type (default transaction type)
  - Monthly Payment checkbox
  - **Hide from P&L** checkbox (excludes from profit & loss)
  - **Cost of Goods Sold** checkbox
  - **Depreciation** checkbox (manual P&L entry per month)
- Collapsible folder groups in manage modal
- Edit/delete for both categories and folders
- Folder deletion moves categories to unfiled
- Badges: Monthly, Type, Amount, Hidden, COGS, Depr.

### 3. Transaction Table
- Grouped by month (Entry Date), Month Due, or Category (sort mode dropdown)
- Color-coded type badges (green receivable / red payable)
- **Inline status dropdown** — change status directly in the table
- **Month Paid Prompt** — modal asks for month when changing to paid/received
- **Late payment indicator** — shows "in [Month]" when paid after due date
- **Late payment row shading** for visual emphasis
- **Payment for month label** — shows which month a recurring payment covers
- **Notes tooltip** — hover/click on notes icon to see notes
- Status colors: Yellow (pending), Green (received/paid), Orange (overdue)
- Inline edit/delete buttons (appear on hover)

### 4. Bulk Folder Entries
- **+ Add Folder** button in header
- Select a folder → previews all categories with default amounts
- Set month due, entry date, status
- Creates one transaction per category in the folder
- Shows warnings for categories missing default amounts

### 5. Filters & Sort
- Sort by: Entry Date, Month Due, Category
- Filter by: Folder, Type, Status, Month, Category
- Folder filter cascades to category filter
- All filters combine

### 6. Summary Cards
- **Cash Balance** = Total Received - Total Paid
- **Accounts Receivable** = Sum of pending receivables
- **Accounts Payable** = Sum of pending payables
- Late payment detection with card shading and indicator text

### 7. Cash Flow Summary Tab
- Spreadsheet: categories as rows, months as columns
- Uses `month_paid` (cash basis) — only completed transactions
- Sections: Beginning Cash Balance → Cash Receipts → Total Receipts → Beginning + Receipts → Cash Payments → Total Payments → Ending Cash Balance → Net Cash Inflow (Outflow)
- **Drag-and-drop** row reordering within sections (persists via cashflow_sort_order)
- Uses `Map` for category grouping (preserves DB insertion order)

### 8. Profit & Loss Tab (VE Format)
- **Accrual-based**: Uses `month_due` (not `month_paid`), includes ALL transactions regardless of status
- **Revenue**: Receivable categories (not COGS, not hidden), uses `COALESCE(pretax_amount, amount)`
- **COGS**: Categories with `is_cogs=1` (not hidden)
- **Gross Profit**: Revenue - COGS
- **Gross Margin %**: GP / Revenue
- **Operating Expenses**: All payable categories (not COGS, not depreciation, not hidden) in flat list
- **Depreciation**: Categories with `is_depreciation=1` appear regardless of hidden status; values are manual overrides only (no transaction aggregation), default $0.00
- **Total Operating Expenses**: Sum of opex + depreciation
- **Net Income (Loss) Before Taxes**: Gross Profit - Total OpEx
- **Income Tax**: Corporate mode = 21% of positive NI (editable via overrides, sentinel category_id -1); Pass-through mode = $0 with dashes
- **Net Income (Loss) After Taxes**: Before Taxes - Tax
- **Cumulative Net Income (Loss)**: Running total
- **Tax Mode Dropdown**: Corporate (21%) or Pass-through, stored in `app_meta`
- **Editable Cells**: Click any category cell to override the auto-calculated value; overrides highlighted with yellow background
- **Hide from P&L**: Categories with `show_on_pl=1` are excluded from all P&L queries

### 9. Data Persistence
- **Auto-save:** Every change auto-saves to IndexedDB (debounced 500ms)
- **Save:** File System Access API (remembers file handle) or download fallback
- **Save As:** Always prompts for new location
- **Load:** Import `.db` file with confirmation modal
- **CSV Export:** Export all transactions as CSV

### 10. Schema Migration
- `migrateSchema()` runs on every database load
- Adds missing columns via try/catch ALTER TABLE pattern
- Creates missing tables (category_folders, pl_overrides, app_meta)
- One-time `show_on_pl` semantics reset migration (from "show" to "hide")

---

## Architecture Notes

### Module Pattern
Four global singletons, loaded in order:
1. `Utils` — Pure helper functions (no DOM, no DB)
2. `Database` — SQLite operations via sql.js, IndexedDB persistence
3. `UI` — DOM rendering (reads from Database for badge counts)
4. `App` — Event handlers, orchestration, tab switching

### P&L Data Flow
1. `Database.getPLSpreadsheet()` returns `{ months, revenue, cogs, opex, depreciation }`
2. `Database.getAllPLOverrides()` returns `{ "catId-month": amount }` map
3. `Database.getPLTaxMode()` returns `'corporate'` or `'passthrough'`
4. `UI.renderProfitLossSpreadsheet(plData, overrides, taxMode)` builds the HTML table
5. `App.setupPnLCellEditing()` binds click-to-edit on `.pnl-editable` cells (once)
6. On edit: `Database.setPLOverride(catId, month, amount)` → `App.refreshPnL()`

### Key Design Decisions
- **`show_on_pl` inverted semantics**: `1` means "hidden from P&L" (originally was "show on P&L", migrated with one-time flag)
- **Sentinel IDs in pl_overrides**: `-1` = Income Tax row
- **Depreciation categories**: Queried separately from opex; no transaction aggregation — values come entirely from `pl_overrides`
- **Accrual vs Cash basis**: P&L uses `month_due` (accrual); Cash Flow uses `month_paid` (cash)
- **Map for category grouping**: JavaScript `Map` preserves insertion order from DB queries (unlike plain `{}`)

---

## CSS Design System

### Colors (CSS Variables)
```css
--color-primary: #4a90a4      /* Teal blue for accents */
--color-receivable: #28a745   /* Green for income */
--color-payable: #dc3545      /* Red for expenses */
--color-overdue: #e67e22      /* Muted orange for overdue */
--color-bg: #f8f9fa           /* Light gray background */
--color-white: #ffffff        /* Card backgrounds */
--color-text: #212529         /* Primary text */
--color-text-muted: #6c757d   /* Secondary text */
--color-bg-dark: #eef0f2      /* Darker background for totals */
```

### Key Component Classes
- `.summary-card` — Dashboard summary cards with late-payment shading
- `.transaction-table` — Data table with hover effects
- `.status-select` — Inline status dropdown in table
- `.cashflow-table` — Cash flow spreadsheet
- `.cashflow-drag-handle` — Draggable rows in cash flow
- `.pnl-table` — P&L spreadsheet
- `.pnl-editable` — Clickable cells for P&L overrides
- `.pnl-overridden` — Yellow highlight for overridden cells
- `.pnl-section-header` — Section header rows (Revenue, COGS, etc.)
- `.pnl-subtotal` / `.pnl-total` — Subtotal and total rows
- `.pnl-controls` — Tax mode dropdown container
- `.category-badge` — Small colored badges (Monthly, COGS, Hidden, Depr.)
- `.modal` — Overlay modals with `.modal.active` display
- `.bulk-preview` — Preview area in Add Folder Entries modal

---

## Change Log

### 2026-02-18 - P&L Depreciation Fix
- **Depreciation categories** now appear in P&L Operating Expenses regardless of "Hide from P&L" status
- Depreciation values are manually entered per month via editable cells (no auto-calculation from transactions)
- OpEx query excludes depreciation categories to prevent double-counting
- Separate query fetches `is_depreciation=1` categories by name/id only

### 2026-02-18 - P&L Redesign (VE Format)
- Rewrote P&L to match VE (Virtual Enterprises) system format
- **Accrual-based**: Changed all P&L queries from `month_paid` to `month_due`
- **All statuses**: Removed `status != 'pending'` filter — includes pending transactions
- **Simplified structure**: Removed D&A section, EBIT, Interest Expense, EBT, Net Profit Margin %
- **Tax mode**: Added Corporate (21%) / Pass-through dropdown with `app_meta` storage
- **Income Tax**: Corporate auto-calculates 21% on positive income (editable); Pass-through shows dashes
- All payable categories appear in one flat Operating Expenses list
- Revenue uses `COALESCE(pretax_amount, amount)` for pretax amounts

### 2026-02-18 - P&L Tab (Initial GAAP Implementation, then replaced)
- Added P&L spreadsheet tab with full GAAP multi-step format
- Added `show_on_pl`, `is_cogs`, `is_depreciation` flags to categories
- Added `pl_overrides` table for manual cell overrides
- Added "Hide from P&L" checkbox (inverted from original "Show on P&L")
- Badges: Hidden, COGS, Depr. shown on category items
- *Note: GAAP format was replaced by VE format in subsequent update*

### 2026-02-18 - Cash Flow Enhancements
- Added **drag-and-drop** row reordering in cash flow spreadsheet
- Added `cashflow_sort_order` column to categories
- Added **Net Cash Inflow (Outflow)** summary row
- Switched from plain `{}` to `Map` for category grouping (preserves DB order)
- Darker CSS for total/subtotal rows

### 2026-02-18 - Pretax Amounts & Folder Entries
- Added `pretax_amount` column to transactions
- Pretax Amount field appears for receivable transactions
- Added **+ Add Folder** button for bulk entry creation
- Bulk modal: select folder, set month/status, preview entries, create all at once

### 2026-02-18 - Category Folders & Management
- Added `category_folders` table with folder types (Payable/Receivable/None)
- Categories can be assigned to folders
- Folder type enforces default type on contained categories
- Collapsible folder groups in Manage Categories modal
- Added folder CRUD (add, edit, delete)
- Category dropdown uses `<optgroup>` for folder grouping

### 2026-02-18 - Feature Enhancements
- **Inline Status Dropdown**: Change status directly in table
- **Month Paid Prompt Modal**: Asks for month when changing to paid/received
- **Editable Entry Date**: Entry date editable with "Today" button
- **Late Payment Indicator**: Shows "in [Month]" when paid late
- **Monthly Payment Categories**: Checkbox + "Payment For" month dropdown
- **Journal Owner**: Editable name in header, auto-sizes, persists in `app_meta`
- **Save/Save As/Load**: File System Access API with saved file handles
- **Notes Tooltip**: Hover/click to view notes
- Schema migration for backwards compatibility

### 2026-02-18 - Initial Development
- Created project folder structure
- Implemented HTML structure with semantic layout
- Created CSS with clean, minimal design using CSS variables
- Built utils.js with formatting, date, and grouping functions
- Implemented database.js with full SQLite CRUD operations
- Added IndexedDB auto-save persistence
- Created ui.js with all rendering functions
- Built app.js with event handlers and application logic
- Added modals: entry form, categories, folders, delete confirmations, load, save as
- Implemented transaction grouping and filtering
- Added overdue status detection
- CSV export functionality

---

## Session Continuity Notes

### To Resume Development:
1. Open `C:\Users\mrisa\Accounting Journal Calculator` folder
2. Review this PROGRESS_NOTEBOOK.md for context
3. Run `index.html` in a browser to test current state
4. Check browser console for any errors

### Completed Enhancements:
- [x] Monthly payment categories
- [x] Category folders with typed grouping
- [x] Pretax amounts for receivables
- [x] Cash flow spreadsheet with drag-and-drop
- [x] Profit & Loss statement (VE format, accrual-based)
- [x] Tax mode (Corporate 21% / Pass-through)
- [x] Depreciation as manual P&L entries
- [x] Bulk folder entries
- [x] CSV export
- [x] Save/Save As with File System Access API

### Known Considerations:
- sql.js is loaded from CDN (requires internet on first load)
- Database is stored in browser (different browsers = different data)
- `show_on_pl = 1` means HIDDEN (inverted semantics, migrated once)
- Depreciation categories bypass the hidden flag on P&L
- For offline use, download sql-wasm.js and sql-wasm.wasm to local /lib folder

---

*This notebook is updated after every significant code change.*
