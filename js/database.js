/**
 * Database module for SQLite operations using sql.js
 * Includes IndexedDB auto-save functionality
 */

const Database = {
    db: null,
    SQL: null,
    IDB_NAME: 'AccountingJournalDB',
    IDB_STORE: 'database',
    IDB_KEY: 'sqliteDb',

    /**
     * Initialize the database
     * @returns {Promise<void>}
     */
    async init() {
        this.SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });

        const savedData = await this.loadFromIndexedDB();

        if (savedData) {
            this.db = new this.SQL.Database(savedData);
            this.migrateSchema();
            console.log('Database loaded from IndexedDB');
        } else {
            this.db = new this.SQL.Database();
            this.createSchema();
            console.log('New database created');
        }
    },

    /**
     * Create database schema
     */
    createSchema() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS category_folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                folder_type TEXT NOT NULL DEFAULT 'payable',
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                type TEXT DEFAULT 'both',
                is_monthly INTEGER DEFAULT 0,
                default_amount DECIMAL(10,2),
                default_type TEXT,
                folder_id INTEGER,
                cashflow_sort_order INTEGER DEFAULT 0,
                show_on_pl INTEGER DEFAULT 0,
                is_cogs INTEGER DEFAULT 0,
                is_depreciation INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (folder_id) REFERENCES category_folders(id)
            )
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_date DATE NOT NULL,
                category_id INTEGER NOT NULL,
                item_description TEXT,
                amount DECIMAL(10,2) NOT NULL,
                pretax_amount DECIMAL(10,2),
                transaction_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                date_processed DATE,
                month_due TEXT,
                month_paid TEXT,
                payment_for_month TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS pl_overrides (
                category_id INTEGER,
                month TEXT,
                override_amount DECIMAL(10,2),
                PRIMARY KEY(category_id, month)
            )
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS app_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        // Create default "Monthly Expenses" folder
        this.db.run('INSERT OR IGNORE INTO category_folders (name, folder_type, sort_order) VALUES (?, ?, ?)', ['Monthly Expenses', 'payable', 0]);

        const defaultCategories = [
            'General Income',
            'General Expense',
            'Loan',
            'Investment',
            'Salary',
            'Utilities',
            'Supplies'
        ];

        const stmt = this.db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
        defaultCategories.forEach(cat => {
            stmt.run([cat]);
        });
        stmt.free();
    },

    /**
     * Migrate existing database schema (add new columns if missing)
     */
    migrateSchema() {
        try {
            this.db.exec('SELECT is_monthly FROM categories LIMIT 1');
        } catch (e) {
            this.db.run('ALTER TABLE categories ADD COLUMN is_monthly INTEGER DEFAULT 0');
        }

        try {
            this.db.exec('SELECT payment_for_month FROM transactions LIMIT 1');
        } catch (e) {
            this.db.run('ALTER TABLE transactions ADD COLUMN payment_for_month TEXT');
        }

        // Add default_amount column to categories
        try {
            this.db.exec('SELECT default_amount FROM categories LIMIT 1');
        } catch (e) {
            this.db.run('ALTER TABLE categories ADD COLUMN default_amount DECIMAL(10,2)');
        }

        // Add default_type column to categories
        try {
            this.db.exec('SELECT default_type FROM categories LIMIT 1');
        } catch (e) {
            this.db.run('ALTER TABLE categories ADD COLUMN default_type TEXT');
        }

        // Add folder_id column to categories
        try {
            this.db.exec('SELECT folder_id FROM categories LIMIT 1');
        } catch (e) {
            this.db.run('ALTER TABLE categories ADD COLUMN folder_id INTEGER');
        }

        // Create category_folders table if not exists
        this.db.run(`
            CREATE TABLE IF NOT EXISTS category_folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                folder_type TEXT NOT NULL DEFAULT 'payable',
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add folder_type column to category_folders if missing
        try {
            this.db.exec('SELECT folder_type FROM category_folders LIMIT 1');
        } catch (e) {
            this.db.run("ALTER TABLE category_folders ADD COLUMN folder_type TEXT NOT NULL DEFAULT 'payable'");
        }

        // Add pretax_amount column to transactions
        try {
            this.db.exec('SELECT pretax_amount FROM transactions LIMIT 1');
        } catch (e) {
            this.db.run('ALTER TABLE transactions ADD COLUMN pretax_amount DECIMAL(10,2)');
        }

        // Add cashflow_sort_order column to categories
        try {
            this.db.exec('SELECT cashflow_sort_order FROM categories LIMIT 1');
        } catch (e) {
            this.db.run('ALTER TABLE categories ADD COLUMN cashflow_sort_order INTEGER DEFAULT 0');
        }

        // Add P&L flags to categories
        try {
            this.db.exec('SELECT show_on_pl FROM categories LIMIT 1');
        } catch (e) {
            this.db.run('ALTER TABLE categories ADD COLUMN show_on_pl INTEGER DEFAULT 0');
        }
        try {
            this.db.exec('SELECT is_cogs FROM categories LIMIT 1');
        } catch (e) {
            this.db.run('ALTER TABLE categories ADD COLUMN is_cogs INTEGER DEFAULT 0');
        }
        try {
            this.db.exec('SELECT is_depreciation FROM categories LIMIT 1');
        } catch (e) {
            this.db.run('ALTER TABLE categories ADD COLUMN is_depreciation INTEGER DEFAULT 0');
        }

        // Create pl_overrides table for P&L manual overrides
        this.db.run(`
            CREATE TABLE IF NOT EXISTS pl_overrides (
                category_id INTEGER,
                month TEXT,
                override_amount DECIMAL(10,2),
                PRIMARY KEY(category_id, month)
            )
        `);

        // Ensure app_meta table exists
        this.db.run(`
            CREATE TABLE IF NOT EXISTS app_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        // One-time migration: reset show_on_pl flags (semantics inverted from "show" to "hide")
        const migrated = this.db.exec("SELECT value FROM app_meta WHERE key = 'pl_hide_migration'");
        if (migrated.length === 0 || migrated[0].values.length === 0) {
            this.db.run('UPDATE categories SET show_on_pl = 0');
            this.db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('pl_hide_migration', '1')");
        }
    },

    // ==================== FOLDER OPERATIONS ====================

    /**
     * Get all category folders
     * @returns {Array} Array of folder objects
     */
    getFolders() {
        const results = this.db.exec('SELECT * FROM category_folders ORDER BY sort_order ASC, name ASC');
        if (results.length === 0) return [];
        return this.rowsToObjects(results[0]);
    },

    /**
     * Add a new folder
     * @param {string} name - Folder name
     * @param {string} type - Folder type ('payable' or 'receivable')
     * @returns {number} New folder ID
     */
    addFolder(name, type = 'payable') {
        this.db.run('INSERT INTO category_folders (name, folder_type) VALUES (?, ?)', [name.trim(), type]);
        const result = this.db.exec('SELECT last_insert_rowid() as id');
        this.autoSave();
        return result[0].values[0][0];
    },

    /**
     * Update a folder
     * @param {number} id - Folder ID
     * @param {string} name - New name
     * @param {string} type - Folder type ('payable' or 'receivable')
     */
    updateFolder(id, name, type = 'payable') {
        this.db.run('UPDATE category_folders SET name = ?, folder_type = ? WHERE id = ?', [name.trim(), type, id]);
        this.autoSave();
    },

    /**
     * Delete a folder (moves its categories to unfiled)
     * @param {number} id - Folder ID
     */
    deleteFolder(id) {
        this.db.run('UPDATE categories SET folder_id = NULL WHERE folder_id = ?', [id]);
        this.db.run('DELETE FROM category_folders WHERE id = ?', [id]);
        this.autoSave();
    },

    /**
     * Get folder by ID
     * @param {number} id - Folder ID
     * @returns {Object|null} Folder object
     */
    getFolderById(id) {
        const results = this.db.exec('SELECT * FROM category_folders WHERE id = ?', [id]);
        if (results.length === 0) return null;
        return this.rowsToObjects(results[0])[0];
    },

    // ==================== CATEGORY OPERATIONS ====================

    /**
     * Get all categories with folder info
     * @returns {Array} Array of category objects
     */
    getCategories() {
        const results = this.db.exec(`
            SELECT c.*, cf.name as folder_name
            FROM categories c
            LEFT JOIN category_folders cf ON c.folder_id = cf.id
            ORDER BY cf.sort_order ASC, cf.name ASC, c.name ASC
        `);
        if (results.length === 0) return [];
        return this.rowsToObjects(results[0]);
    },

    /**
     * Add a new category
     * @param {string} name - Category name
     * @param {boolean} isMonthly - Whether this is a monthly payment category
     * @param {number|null} defaultAmount - Default amount for this category
     * @param {string|null} defaultType - Default type ('receivable' or 'payable')
     * @param {number|null} folderId - Folder ID
     * @returns {number} New category ID
     */
    addCategory(name, isMonthly = false, defaultAmount = null, defaultType = null, folderId = null, showOnPl = false, isCogs = false, isDepreciation = false) {
        this.db.run(
            'INSERT INTO categories (name, is_monthly, default_amount, default_type, folder_id, show_on_pl, is_cogs, is_depreciation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name.trim(), isMonthly ? 1 : 0, defaultAmount, defaultType, folderId, showOnPl ? 1 : 0, isCogs ? 1 : 0, isDepreciation ? 1 : 0]
        );
        const result = this.db.exec('SELECT last_insert_rowid() as id');
        this.autoSave();
        return result[0].values[0][0];
    },

    /**
     * Delete a category
     * @param {number} id - Category ID
     * @returns {boolean} Success (false if category is in use)
     */
    deleteCategory(id) {
        const inUse = this.db.exec('SELECT COUNT(*) as count FROM transactions WHERE category_id = ?', [id]);
        if (inUse[0].values[0][0] > 0) {
            return false;
        }
        this.db.run('DELETE FROM categories WHERE id = ?', [id]);
        this.autoSave();
        return true;
    },

    /**
     * Get category by ID
     * @param {number} id - Category ID
     * @returns {Object|null} Category object
     */
    getCategoryById(id) {
        const results = this.db.exec(`
            SELECT c.*, cf.name as folder_name
            FROM categories c
            LEFT JOIN category_folders cf ON c.folder_id = cf.id
            WHERE c.id = ?
        `, [id]);
        if (results.length === 0) return null;
        return this.rowsToObjects(results[0])[0];
    },

    /**
     * Update a category
     * @param {number} id - Category ID
     * @param {string} name - New name
     * @param {boolean} isMonthly - Whether this is a monthly payment category
     * @param {number|null} defaultAmount - Default amount
     * @param {string|null} defaultType - Default type
     * @param {number|null} folderId - Folder ID
     */
    updateCategory(id, name, isMonthly = false, defaultAmount = null, defaultType = null, folderId = null, showOnPl = false, isCogs = false, isDepreciation = false) {
        this.db.run(
            'UPDATE categories SET name = ?, is_monthly = ?, default_amount = ?, default_type = ?, folder_id = ?, show_on_pl = ?, is_cogs = ?, is_depreciation = ? WHERE id = ?',
            [name.trim(), isMonthly ? 1 : 0, defaultAmount, defaultType, folderId, showOnPl ? 1 : 0, isCogs ? 1 : 0, isDepreciation ? 1 : 0, id]
        );
        this.autoSave();
    },

    /**
     * Get all categories in a specific folder
     * @param {number} folderId - Folder ID
     * @returns {Array} Array of category objects
     */
    getCategoriesByFolder(folderId) {
        const results = this.db.exec(
            'SELECT * FROM categories WHERE folder_id = ? ORDER BY name ASC',
            [folderId]
        );
        if (results.length === 0) return [];
        return this.rowsToObjects(results[0]);
    },

    /**
     * Update cashflow sort order for a list of category IDs
     * @param {Array<{id: number, sortOrder: number}>} orderList
     */
    updateCashflowSortOrder(orderList) {
        const stmt = this.db.prepare('UPDATE categories SET cashflow_sort_order = ? WHERE id = ?');
        orderList.forEach(({ id, sortOrder }) => {
            stmt.run([sortOrder, id]);
        });
        stmt.free();
        this.autoSave();
    },

    /**
     * Get count of transactions using a category
     * @param {number} categoryId - Category ID
     * @returns {number} Transaction count
     */
    getCategoryUsageCount(categoryId) {
        const result = this.db.exec('SELECT COUNT(*) as count FROM transactions WHERE category_id = ?', [categoryId]);
        return result[0].values[0][0];
    },

    // ==================== TRANSACTION OPERATIONS ====================

    /**
     * Get all transactions
     * @param {Object} filters - Optional filters
     * @returns {Array} Array of transaction objects
     */
    getTransactions(filters = {}) {
        let query = `
            SELECT t.*, c.name as category_name, c.is_monthly as category_is_monthly
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.type) {
            query += ' AND t.transaction_type = ?';
            params.push(filters.type);
        }

        if (filters.status) {
            query += ' AND t.status = ?';
            params.push(filters.status);
        }

        if (filters.month) {
            query += ' AND substr(t.entry_date, 1, 7) = ?';
            params.push(filters.month);
        }

        if (filters.folderId) {
            if (filters.folderId === 'unfiled') {
                query += ' AND c.folder_id IS NULL';
            } else {
                query += ' AND c.folder_id = ?';
                params.push(filters.folderId);
            }
        }

        if (filters.categoryId) {
            query += ' AND t.category_id = ?';
            params.push(filters.categoryId);
        }

        query += ' ORDER BY t.entry_date DESC, t.id DESC';

        const results = this.db.exec(query, params);
        if (results.length === 0) return [];

        return this.rowsToObjects(results[0]);
    },

    /**
     * Get a single transaction by ID
     * @param {number} id - Transaction ID
     * @returns {Object|null} Transaction object
     */
    getTransactionById(id) {
        const results = this.db.exec(`
            SELECT t.*, c.name as category_name, c.is_monthly as category_is_monthly
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.id = ?
        `, [id]);

        if (results.length === 0) return null;
        return this.rowsToObjects(results[0])[0];
    },

    /**
     * Add a new transaction
     * @param {Object} transaction - Transaction data
     * @returns {number} New transaction ID
     */
    addTransaction(transaction) {
        this.db.run(`
            INSERT INTO transactions
            (entry_date, category_id, item_description, amount, pretax_amount, transaction_type,
             status, date_processed, month_due, month_paid, payment_for_month, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            transaction.entry_date,
            transaction.category_id,
            transaction.item_description || null,
            transaction.amount,
            transaction.pretax_amount || null,
            transaction.transaction_type,
            transaction.status,
            transaction.date_processed || null,
            transaction.month_due || null,
            transaction.month_paid || null,
            transaction.payment_for_month || null,
            transaction.notes || null
        ]);

        const result = this.db.exec('SELECT last_insert_rowid() as id');
        this.autoSave();
        return result[0].values[0][0];
    },

    /**
     * Update a transaction
     * @param {number} id - Transaction ID
     * @param {Object} transaction - Transaction data
     */
    updateTransaction(id, transaction) {
        this.db.run(`
            UPDATE transactions SET
                entry_date = ?,
                category_id = ?,
                item_description = ?,
                amount = ?,
                pretax_amount = ?,
                transaction_type = ?,
                status = ?,
                date_processed = ?,
                month_due = ?,
                month_paid = ?,
                payment_for_month = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            transaction.entry_date,
            transaction.category_id,
            transaction.item_description || null,
            transaction.amount,
            transaction.pretax_amount || null,
            transaction.transaction_type,
            transaction.status,
            transaction.date_processed || null,
            transaction.month_due || null,
            transaction.month_paid || null,
            transaction.payment_for_month || null,
            transaction.notes || null,
            id
        ]);
        this.autoSave();
    },

    /**
     * Update just the status of a transaction (for inline status changes)
     * @param {number} id - Transaction ID
     * @param {string} status - New status
     * @param {string} monthPaidValue - Optional month paid value (required for paid/received)
     */
    updateTransactionStatus(id, status, monthPaidValue = null) {
        if (status === 'pending') {
            // Reverting to pending: clear date_processed and month_paid
            this.db.run(`
                UPDATE transactions SET
                    status = ?,
                    date_processed = NULL,
                    month_paid = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [status, id]);
        } else {
            // Paid/received: set month_paid (required)
            const monthPaid = monthPaidValue || Utils.getCurrentMonth();
            this.db.run(`
                UPDATE transactions SET
                    status = ?,
                    month_paid = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [status, monthPaid, id]);
        }
        this.autoSave();
    },

    /**
     * Delete a transaction
     * @param {number} id - Transaction ID
     */
    deleteTransaction(id) {
        this.db.run('DELETE FROM transactions WHERE id = ?', [id]);
        this.autoSave();
    },

    // ==================== JOURNAL METADATA ====================

    /**
     * Get journal owner name
     * @returns {string} Journal owner name (empty string if not set)
     */
    getJournalOwner() {
        const result = this.db.exec("SELECT value FROM app_meta WHERE key = 'journal_owner'");
        if (result.length === 0 || result[0].values.length === 0) {
            return '';
        }
        return result[0].values[0][0] || '';
    },

    /**
     * Set journal owner name
     * @param {string} owner - Owner/company name
     */
    setJournalOwner(owner) {
        this.db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('journal_owner', ?)", [owner]);
        this.autoSave();
    },

    /**
     * Get journal name (legacy support)
     * @returns {string} Journal name
     */
    getJournalName() {
        const result = this.db.exec("SELECT value FROM app_meta WHERE key = 'journal_name'");
        if (result.length === 0 || result[0].values.length === 0) {
            return 'Accounting Journal';
        }
        return result[0].values[0][0];
    },

    /**
     * Set journal name (legacy support)
     * @param {string} name - Journal name
     */
    setJournalName(name) {
        this.db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('journal_name', ?)", [name]);
        this.autoSave();
    },

    // ==================== CALCULATIONS ====================

    /**
     * Calculate summary totals
     * @returns {Object} Summary object with cashBalance, receivables, payables
     */
    calculateSummary() {
        const receivedResult = this.db.exec(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE transaction_type = 'receivable' AND status = 'received'
        `);
        const totalReceived = receivedResult[0].values[0][0];

        const paidResult = this.db.exec(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE transaction_type = 'payable' AND status = 'paid'
        `);
        const totalPaid = paidResult[0].values[0][0];

        const receivablesResult = this.db.exec(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE transaction_type = 'receivable' AND status = 'pending'
        `);
        const pendingReceivables = receivablesResult[0].values[0][0];

        const payablesResult = this.db.exec(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE transaction_type = 'payable' AND status = 'pending'
        `);
        const pendingPayables = payablesResult[0].values[0][0];

        return {
            cashBalance: totalReceived - totalPaid,
            accountsReceivable: pendingReceivables,
            accountsPayable: pendingPayables
        };
    },

    /**
     * Check if there are any late payments in the completed transactions
     * @returns {Object} Object with lateReceivedAmount, latePaidAmount
     */
    checkLatePayments() {
        const lateReceivedResult = this.db.exec(`
            SELECT COALESCE(SUM(amount), 0) as total FROM transactions
            WHERE transaction_type = 'receivable'
            AND status = 'received'
            AND month_due IS NOT NULL
            AND month_paid IS NOT NULL
            AND month_paid > month_due
        `);
        const lateReceivedAmount = lateReceivedResult[0].values[0][0];

        const latePaidResult = this.db.exec(`
            SELECT COALESCE(SUM(amount), 0) as total FROM transactions
            WHERE transaction_type = 'payable'
            AND status = 'paid'
            AND month_due IS NOT NULL
            AND month_paid IS NOT NULL
            AND month_paid > month_due
        `);
        const latePaidAmount = latePaidResult[0].values[0][0];

        return {
            lateReceivedAmount,
            latePaidAmount,
            hasLateReceivables: lateReceivedAmount > 0,
            hasLatePayables: latePaidAmount > 0
        };
    },

    /**
     * Get monthly summary data (grouped by entry date)
     * @returns {Array} Array of monthly summary objects
     */
    getMonthlySummary() {
        const result = this.db.exec(`
            SELECT
                substr(entry_date, 1, 7) as month,
                SUM(CASE WHEN transaction_type = 'receivable' AND status = 'received' THEN amount ELSE 0 END) as received,
                SUM(CASE WHEN transaction_type = 'payable' AND status = 'paid' THEN amount ELSE 0 END) as paid,
                SUM(CASE WHEN transaction_type = 'receivable' AND status = 'pending' THEN amount ELSE 0 END) as pending_receivables,
                SUM(CASE WHEN transaction_type = 'payable' AND status = 'pending' THEN amount ELSE 0 END) as pending_payables,
                COUNT(*) as total_entries
            FROM transactions
            GROUP BY substr(entry_date, 1, 7)
            ORDER BY month DESC
        `);

        if (result.length === 0) return [];
        return this.rowsToObjects(result[0]);
    },

    /**
     * Get cash flow summary grouped by month_paid (when money actually moved)
     * Only includes completed transactions (paid/received), grouped by the month they were processed
     * @returns {Array} Array of cash flow summary objects
     */
    getCashFlowSummary() {
        const result = this.db.exec(`
            SELECT
                month_paid as month,
                SUM(CASE WHEN transaction_type = 'receivable' AND status = 'received' THEN amount ELSE 0 END) as cash_in,
                SUM(CASE WHEN transaction_type = 'payable' AND status = 'paid' THEN amount ELSE 0 END) as cash_out,
                COUNT(*) as total_entries
            FROM transactions
            WHERE month_paid IS NOT NULL
            AND status != 'pending'
            GROUP BY month_paid
            ORDER BY month DESC
        `);

        if (result.length === 0) return [];
        return this.rowsToObjects(result[0]);
    },

    /**
     * Get cash flow data broken down by category and month for spreadsheet view
     * @returns {Object} { months: string[], data: Object[] }
     */
    getCashFlowSpreadsheet() {
        // Get all distinct months from month_paid (sorted ASC)
        const monthsResult = this.db.exec(`
            SELECT DISTINCT month_paid as month FROM transactions
            WHERE month_paid IS NOT NULL AND status != 'pending'
            ORDER BY month ASC
        `);
        const months = monthsResult.length > 0 ? monthsResult[0].values.map(r => r[0]) : [];

        // Get per-category, per-month totals for completed transactions
        const dataResult = this.db.exec(`
            SELECT c.name as category_name, c.id as category_id,
                   t.transaction_type, t.month_paid as month,
                   SUM(t.amount) as total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.status != 'pending' AND t.month_paid IS NOT NULL
            GROUP BY c.id, t.month_paid, t.transaction_type
            ORDER BY c.cashflow_sort_order ASC, c.name ASC
        `);
        const data = dataResult.length > 0 ? this.rowsToObjects(dataResult[0]) : [];

        return { months, data };
    },

    /**
     * Get all transactions as flat data for CSV export
     * @returns {Array} Array of transaction objects with all fields
     */
    getTransactionsForExport() {
        const results = this.db.exec(`
            SELECT
                t.entry_date,
                c.name as category,
                t.transaction_type as type,
                t.amount,
                t.pretax_amount,
                t.status,
                t.month_due,
                t.month_paid,
                t.date_processed,
                t.payment_for_month,
                t.notes
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            ORDER BY t.entry_date DESC, t.id DESC
        `);

        if (results.length === 0) return [];
        return this.rowsToObjects(results[0]);
    },

    // ==================== PROFIT & LOSS ====================

    /**
     * Get P&L spreadsheet data (accrual-based: uses month_due, includes all statuses)
     * Revenue uses COALESCE(pretax_amount, amount) for receivable categories.
     * @returns {Object} { months, revenue, cogs, opex }
     */
    getPLSpreadsheet() {
        // Get all distinct months from month_due (accrual basis)
        const monthsResult = this.db.exec(`
            SELECT DISTINCT t.month_due as month FROM transactions t
            WHERE t.month_due IS NOT NULL
            ORDER BY month ASC
        `);
        const months = monthsResult.length > 0 ? monthsResult[0].values.map(r => r[0]) : [];

        // Revenue: receivable categories (not COGS, not hidden), using pretax_amount if available
        const revenueResult = this.db.exec(`
            SELECT c.id as category_id, c.name as category_name,
                   t.month_due as month,
                   SUM(COALESCE(t.pretax_amount, t.amount)) as total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.month_due IS NOT NULL
            AND t.transaction_type = 'receivable'
            AND c.is_cogs = 0
            AND c.show_on_pl != 1
            GROUP BY c.id, t.month_due
            ORDER BY c.cashflow_sort_order ASC, c.name ASC
        `);
        const revenue = revenueResult.length > 0 ? this.rowsToObjects(revenueResult[0]) : [];

        // COGS: is_cogs=1 categories (not hidden), accrual basis
        const cogsResult = this.db.exec(`
            SELECT c.id as category_id, c.name as category_name,
                   t.month_due as month,
                   SUM(t.amount) as total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.month_due IS NOT NULL
            AND c.is_cogs = 1
            AND c.show_on_pl != 1
            GROUP BY c.id, t.month_due
            ORDER BY c.cashflow_sort_order ASC, c.name ASC
        `);
        const cogs = cogsResult.length > 0 ? this.rowsToObjects(cogsResult[0]) : [];

        // OpEx: all payable categories that are not COGS, not depreciation, not hidden, accrual basis
        const opexResult = this.db.exec(`
            SELECT c.id as category_id, c.name as category_name,
                   t.month_due as month,
                   SUM(t.amount) as total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.month_due IS NOT NULL
            AND t.transaction_type = 'payable'
            AND c.is_cogs = 0
            AND c.is_depreciation = 0
            AND c.show_on_pl != 1
            GROUP BY c.id, t.month_due
            ORDER BY c.cashflow_sort_order ASC, c.name ASC
        `);
        const opex = opexResult.length > 0 ? this.rowsToObjects(opexResult[0]) : [];

        // Depreciation: categories flagged is_depreciation=1, shown regardless of show_on_pl
        // Values are manually entered via pl_overrides (no transaction aggregation)
        const depreciationResult = this.db.exec(`
            SELECT id as category_id, name as category_name
            FROM categories
            WHERE is_depreciation = 1
            ORDER BY cashflow_sort_order ASC, name ASC
        `);
        const depreciation = depreciationResult.length > 0 ? this.rowsToObjects(depreciationResult[0]) : [];

        return { months, revenue, cogs, opex, depreciation };
    },

    /**
     * Get P&L tax mode setting
     * @returns {string} 'corporate' or 'passthrough'
     */
    getPLTaxMode() {
        const result = this.db.exec("SELECT value FROM app_meta WHERE key = 'pl_tax_mode'");
        if (result.length === 0 || result[0].values.length === 0) {
            return 'corporate';
        }
        return result[0].values[0][0] || 'corporate';
    },

    /**
     * Set P&L tax mode setting
     * @param {string} mode - 'corporate' or 'passthrough'
     */
    setPLTaxMode(mode) {
        this.db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('pl_tax_mode', ?)", [mode]);
        this.autoSave();
    },

    // ==================== THEME SETTINGS ====================

    /**
     * Get theme preset name
     * @returns {string} Preset name (default, ocean, forest, sunset, midnight, custom)
     */
    getThemePreset() {
        const result = this.db.exec("SELECT value FROM app_meta WHERE key = 'theme_preset'");
        if (result.length === 0 || result[0].values.length === 0) return 'default';
        return result[0].values[0][0] || 'default';
    },

    /**
     * Set theme preset name
     * @param {string} name - Preset name
     */
    setThemePreset(name) {
        this.db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('theme_preset', ?)", [name]);
        this.autoSave();
    },

    /**
     * Get custom theme colors
     * @returns {Object|null} Color object {c1, c2, c3, c4} or null
     */
    getThemeColors() {
        const result = this.db.exec("SELECT value FROM app_meta WHERE key = 'theme_colors'");
        if (result.length === 0 || result[0].values.length === 0) return null;
        try {
            return JSON.parse(result[0].values[0][0]);
        } catch (e) {
            return null;
        }
    },

    /**
     * Set custom theme colors
     * @param {Object} colors - Color object {c1, c2, c3, c4}
     */
    setThemeColors(colors) {
        this.db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('theme_colors', ?)", [JSON.stringify(colors)]);
        this.autoSave();
    },

    /**
     * Get dark mode setting
     * @returns {boolean} True if dark mode enabled
     */
    getThemeDark() {
        const result = this.db.exec("SELECT value FROM app_meta WHERE key = 'theme_dark'");
        if (result.length === 0 || result[0].values.length === 0) return false;
        return result[0].values[0][0] === '1';
    },

    /**
     * Set dark mode setting
     * @param {boolean} isDark - True for dark mode
     */
    setThemeDark(isDark) {
        this.db.run("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('theme_dark', ?)", [isDark ? '1' : '0']);
        this.autoSave();
    },

    /**
     * Get all P&L overrides
     * @returns {Object} Map of "categoryId-month" => override_amount
     */
    getAllPLOverrides() {
        const results = this.db.exec('SELECT category_id, month, override_amount FROM pl_overrides');
        if (results.length === 0) return {};
        const overrides = {};
        this.rowsToObjects(results[0]).forEach(row => {
            overrides[`${row.category_id}-${row.month}`] = row.override_amount;
        });
        return overrides;
    },

    /**
     * Set a P&L override value for a category+month
     * @param {number} categoryId - Category ID (use -1 for income tax)
     * @param {string} month - Month (YYYY-MM)
     * @param {number|null} amount - Override amount (null to remove override)
     */
    setPLOverride(categoryId, month, amount) {
        if (amount === null || amount === '') {
            this.db.run('DELETE FROM pl_overrides WHERE category_id = ? AND month = ?', [categoryId, month]);
        } else {
            this.db.run(
                'INSERT OR REPLACE INTO pl_overrides (category_id, month, override_amount) VALUES (?, ?, ?)',
                [categoryId, month, parseFloat(amount)]
            );
        }
        this.autoSave();
    },

    // ==================== PERSISTENCE ====================

    /**
     * Auto-save to IndexedDB
     */
    autoSave: Utils.debounce(async function() {
        await Database.saveToIndexedDB();
    }, 500),

    /**
     * Save database to IndexedDB
     * @returns {Promise<void>}
     */
    async saveToIndexedDB() {
        const data = this.db.export();
        const uint8Array = new Uint8Array(data);

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.IDB_NAME, 1);

            request.onerror = () => reject(request.error);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.IDB_STORE)) {
                    db.createObjectStore(this.IDB_STORE);
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction([this.IDB_STORE], 'readwrite');
                const store = transaction.objectStore(this.IDB_STORE);

                const putRequest = store.put(uint8Array, this.IDB_KEY);
                putRequest.onsuccess = () => {
                    console.log('Database auto-saved to IndexedDB');
                    resolve();
                };
                putRequest.onerror = () => reject(putRequest.error);
            };
        });
    },

    /**
     * Load database from IndexedDB
     * @returns {Promise<Uint8Array|null>}
     */
    async loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.IDB_NAME, 1);

            request.onerror = () => reject(request.error);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.IDB_STORE)) {
                    db.createObjectStore(this.IDB_STORE);
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction([this.IDB_STORE], 'readonly');
                const store = transaction.objectStore(this.IDB_STORE);

                const getRequest = store.get(this.IDB_KEY);
                getRequest.onsuccess = () => {
                    resolve(getRequest.result || null);
                };
                getRequest.onerror = () => reject(getRequest.error);
            };
        });
    },

    /**
     * Export database to file
     * @returns {Blob} Database file blob
     */
    exportToFile() {
        const data = this.db.export();
        return new Blob([data], { type: 'application/x-sqlite3' });
    },

    /**
     * Import database from file
     * @param {ArrayBuffer} buffer - File content
     */
    async importFromFile(buffer) {
        const uint8Array = new Uint8Array(buffer);
        this.db = new this.SQL.Database(uint8Array);
        this.migrateSchema();
        await this.saveToIndexedDB();
    },

    // ==================== HELPERS ====================

    /**
     * Convert sql.js result rows to objects
     * @param {Object} result - sql.js result with columns and values
     * @returns {Array} Array of objects
     */
    rowsToObjects(result) {
        const { columns, values } = result;
        return values.map(row => {
            const obj = {};
            columns.forEach((col, index) => {
                obj[col] = row[index];
            });
            return obj;
        });
    }
};

// Export for use in other modules
window.Database = Database;
