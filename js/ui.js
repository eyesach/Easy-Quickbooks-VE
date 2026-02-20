/**
 * UI rendering module for the Accounting Journal Calculator
 */

const UI = {
    /**
     * Update summary cards with calculated values and late payment shading
     * @param {Object} summary - Summary object with cashBalance, receivables, payables
     */
    updateSummary(summary) {
        document.getElementById('cashBalance').textContent =
            Utils.formatCurrency(summary.cashBalance);
        document.getElementById('accountsReceivable').textContent =
            Utils.formatCurrency(summary.accountsReceivable);
        document.getElementById('accountsPayable').textContent =
            Utils.formatCurrency(summary.accountsPayable);

        // Check for late payments and apply shading
        const lateInfo = Database.checkLatePayments();
        const cashCard = document.getElementById('cashBalanceCard');
        const receivablesCard = document.getElementById('receivablesCard');
        const payablesCard = document.getElementById('payablesCard');
        const lateIndicator = document.getElementById('cashBalanceLate');

        // Reset
        cashCard.classList.remove('has-late');
        receivablesCard.classList.remove('has-late');
        payablesCard.classList.remove('has-late');
        lateIndicator.style.display = 'none';

        if (lateInfo.hasLateReceivables || lateInfo.hasLatePayables) {
            cashCard.classList.add('has-late');
            lateIndicator.style.display = 'block';

            const parts = [];
            if (lateInfo.hasLateReceivables) {
                parts.push(`${Utils.formatCurrency(lateInfo.lateReceivedAmount)} received late`);
            }
            if (lateInfo.hasLatePayables) {
                parts.push(`${Utils.formatCurrency(lateInfo.latePaidAmount)} paid late`);
            }
            lateIndicator.textContent = parts.join(', ');
        }

        if (lateInfo.hasLateReceivables) {
            receivablesCard.classList.add('has-late');
        }
        if (lateInfo.hasLatePayables) {
            payablesCard.classList.add('has-late');
        }
    },

    /**
     * Populate all year dropdown selects
     * @param {Object} [timeline] - Optional {start, end} to constrain years
     */
    populateYearDropdowns(timeline) {
        const years = (timeline && (timeline.start || timeline.end))
            ? Utils.getYearsInTimeline(timeline.start, timeline.end)
            : Utils.generateYearOptions();
        const yearSelects = [
            'monthDueYear',
            'monthPaidYear',
            'promptMonthPaidYear'
        ];

        yearSelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;
            const currentValue = select.value;
            select.innerHTML = '<option value="">Year...</option>';
            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                select.appendChild(option);
            });
            if (currentValue) select.value = currentValue;
        });
    },

    /**
     * Update the journal title display based on owner name
     * @param {string} owner - Owner/company name
     */
    updateJournalTitle(owner) {
        const suffix = document.getElementById('journalSuffix');
        if (owner && owner.trim()) {
            suffix.textContent = "'s Accounting Journal";
            document.title = `${owner.trim()}'s Accounting Journal`;
        } else {
            suffix.textContent = "Accounting Journal";
            document.title = 'Accounting Journal';
        }
    },

    /**
     * Populate category dropdown with folder grouping (optgroups)
     * @param {Array} categories - Array of category objects (with folder_name, folder_id)
     * @param {string} selectId - ID of the select element
     */
    populateCategoryDropdown(categories, selectId = 'category') {
        const select = document.getElementById(selectId);
        const currentValue = select.value;

        select.innerHTML = '<option value="">Select category...</option>';

        // Group categories by folder
        const folders = {};
        const unfiled = [];

        categories.forEach(cat => {
            if (cat.folder_id && cat.folder_name) {
                if (!folders[cat.folder_name]) {
                    folders[cat.folder_name] = [];
                }
                folders[cat.folder_name].push(cat);
            } else {
                unfiled.push(cat);
            }
        });

        // Add folder optgroups
        const folderNames = Object.keys(folders).sort();
        folderNames.forEach(folderName => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = folderName;
            folders[folderName].forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                option.dataset.isMonthly = cat.is_monthly ? '1' : '0';
                option.dataset.defaultAmount = cat.default_amount || '';
                option.dataset.defaultType = cat.default_type || '';
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        });

        // Add unfiled categories
        unfiled.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            option.dataset.isMonthly = cat.is_monthly ? '1' : '0';
            option.dataset.defaultAmount = cat.default_amount || '';
            option.dataset.defaultType = cat.default_type || '';
            select.appendChild(option);
        });

        if (currentValue) {
            select.value = currentValue;
        }
    },

    /**
     * Populate payment for month dropdown
     */
    populatePaymentForMonthDropdown() {
        const select = document.getElementById('paymentForMonth');
        const months = Utils.generateMonthOptions();

        select.innerHTML = '<option value="">Select month...</option>';

        months.forEach(({ value, label }) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
        });
    },

    /**
     * Show/hide payment for month field based on category
     * @param {boolean} show - Whether to show the field
     * @param {string} categoryName - Name of the category for labeling
     */
    togglePaymentForMonth(show, categoryName = '') {
        const group = document.getElementById('paymentForGroup');
        if (show) {
            group.style.display = 'flex';
            const label = group.querySelector('label');
            if (categoryName) {
                label.textContent = `${categoryName} for`;
            } else {
                label.textContent = 'Payment For';
            }
        } else {
            group.style.display = 'none';
            document.getElementById('paymentForMonth').value = '';
        }
    },

    /**
     * Update form field visibility based on status
     * Shows/hides dateProcessed and monthPaid groups
     * @param {string} status - 'pending', 'paid', or 'received'
     */
    updateFormFieldVisibility(status) {
        const dateProcessedGroup = document.getElementById('dateProcessedGroup');
        const monthPaidGroup = document.getElementById('monthPaidGroup');

        if (status === 'pending') {
            dateProcessedGroup.style.display = 'none';
            monthPaidGroup.style.display = 'none';
            // Clear values when switching to pending
            document.getElementById('dateProcessed').value = '';
            document.getElementById('monthPaidMonth').value = '';
            document.getElementById('monthPaidYear').value = '';
        } else {
            dateProcessedGroup.style.display = 'flex';
            monthPaidGroup.style.display = 'flex';
        }
    },

    /**
     * Populate filter category dropdown (with folder optgroups)
     * @param {Array} categories - Array of category objects
     */
    populateFilterCategories(categories) {
        const select = document.getElementById('filterCategory');
        const currentValue = select.value;
        select.innerHTML = '<option value="">All Categories</option>';

        // Group categories by folder
        const folders = {};
        const unfiled = [];

        categories.forEach(cat => {
            if (cat.folder_id && cat.folder_name) {
                if (!folders[cat.folder_name]) {
                    folders[cat.folder_name] = [];
                }
                folders[cat.folder_name].push(cat);
            } else {
                unfiled.push(cat);
            }
        });

        const folderNames = Object.keys(folders).sort();
        folderNames.forEach(folderName => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = folderName;
            folders[folderName].forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        });

        unfiled.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });

        if (currentValue) {
            select.value = currentValue;
        }
    },

    /**
     * Populate filter folder dropdown
     * @param {Array} folders - Array of folder objects
     */
    populateFilterFolders(folders) {
        const select = document.getElementById('filterFolder');
        const currentValue = select.value;
        select.innerHTML = '<option value="">All Folders</option>';

        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = folder.name;
            select.appendChild(option);
        });

        // Add "Unfiled" option
        const unfiledOption = document.createElement('option');
        unfiledOption.value = 'unfiled';
        unfiledOption.textContent = 'Unfiled';
        select.appendChild(unfiledOption);

        if (currentValue) {
            select.value = currentValue;
        }
    },

    /**
     * Populate filter month dropdown
     * @param {Array} months - Array of month strings (YYYY-MM)
     */
    populateFilterMonths(months) {
        const select = document.getElementById('filterMonth');
        select.innerHTML = '<option value="">All Months</option>';

        months.forEach(month => {
            const option = document.createElement('option');
            option.value = month;
            option.textContent = Utils.formatMonthDisplay(month);
            select.appendChild(option);
        });
    },

    /**
     * Render transactions table grouped by the selected sort mode
     * @param {Array} transactions - Array of transaction objects
     * @param {string} sortMode - 'entryDate', 'monthDue', or 'category'
     */
    renderTransactions(transactions, sortMode = 'entryDate') {
        const container = document.getElementById('transactionsContainer');

        if (transactions.length === 0) {
            container.innerHTML = '<p class="empty-state">No transactions yet. Add your first entry above.</p>';
            return;
        }

        let grouped;
        let formatHeader;

        switch (sortMode) {
            case 'monthDue':
                grouped = Utils.groupByMonthDue(transactions);
                formatHeader = (key) => key === 'No Due Date' ? 'No Due Date' : Utils.formatMonthDisplay(key);
                break;
            case 'category':
                grouped = Utils.groupByCategory(transactions);
                formatHeader = (key) => key;
                break;
            case 'entryDate':
            default:
                grouped = Utils.groupByMonth(transactions);
                formatHeader = (key) => Utils.formatMonthDisplay(key);
                break;
        }

        let html = '';

        for (const [key, groupTransactions] of Object.entries(grouped)) {
            html += `
                <div class="month-group">
                    <div class="month-header">${formatHeader(key)}</div>
                    <table class="transaction-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Due</th>
                                <th>Status</th>
                                <th>Processed</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${groupTransactions.map(t => this.renderTransactionRow(t)).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    /**
     * Render a single transaction row
     * @param {Object} t - Transaction object
     * @returns {string} HTML string
     */
    renderTransactionRow(t) {
        const isOverdue = Utils.isOverdue(t.month_due, t.status);
        const statusClass = isOverdue ? 'status-overdue' : `status-${t.status}`;
        const amountClass = t.transaction_type === 'receivable' ? 'amount-receivable' : 'amount-payable';
        const typeClass = `type-${t.transaction_type}`;

        // Status dropdown options based on transaction type
        const statusOptions = t.transaction_type === 'receivable'
            ? ['pending', 'received']
            : ['pending', 'paid'];

        const statusDropdown = `
            <select class="status-select ${statusClass}" data-id="${t.id}">
                ${statusOptions.map(s => `
                    <option value="${s}" ${t.status === s ? 'selected' : ''}>
                        ${this.capitalizeFirst(s)}
                    </option>
                `).join('')}
            </select>
        `;

        // Late payment info
        const isPaidLate = Utils.isPaidLate(t.month_due, t.month_paid);
        const lateInfo = isPaidLate
            ? `<span class="late-info">in ${Utils.formatMonthShort(t.month_paid)}</span>`
            : '';

        // Category name with payment for month if applicable
        let categoryDisplay = Utils.escapeHtml(t.category_name || 'Unknown');
        if (t.payment_for_month) {
            categoryDisplay += `<span class="payment-for-label"> for ${Utils.formatMonthShort(t.payment_for_month)}</span>`;
        }

        // Notes indicator icon (shown only when notes exist)
        const notesIcon = t.notes ? `
            <span class="notes-indicator" data-notes="${Utils.escapeHtml(t.notes)}">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
            </span>
        ` : '';

        // Month due display
        const monthDueDisplay = t.month_due
            ? `<span class="month-due-badge ${isOverdue ? 'overdue' : ''}">${Utils.formatMonthShort(t.month_due)}</span>`
            : '-';

        // Processed date display
        const processedDisplay = t.date_processed ? Utils.formatDateShort(t.date_processed) : '-';

        // Row class for late payment shade
        const rowClass = isPaidLate ? 'late-payment-row' : '';

        return `
            <tr data-id="${t.id}" class="${rowClass}">
                <td>${Utils.formatDateShort(t.entry_date)}</td>
                <td>${categoryDisplay} ${notesIcon}</td>
                <td>
                    <span class="type-badge ${typeClass}">
                        ${this.capitalizeFirst(t.transaction_type)}
                    </span>
                </td>
                <td class="${amountClass}">${Utils.formatCurrency(t.amount)}</td>
                <td>${monthDueDisplay}</td>
                <td>
                    ${statusDropdown}
                    ${lateInfo}
                </td>
                <td>${processedDisplay}</td>
                <td class="actions-cell">
                    <button class="btn-icon edit-btn" data-id="${t.id}" title="Edit">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon delete-btn" data-id="${t.id}" title="Delete">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    },

    /**
     * Render a single category item HTML
     * @param {Object} cat - Category object
     * @returns {string} HTML string
     */
    renderCategoryItem(cat) {
        const usageCount = Database.getCategoryUsageCount(cat.id);
        const monthlyBadge = cat.is_monthly
            ? '<span class="category-badge monthly">Monthly</span>'
            : '';
        const defaultTypeBadge = cat.default_type
            ? `<span class="category-badge default-type">${this.capitalizeFirst(cat.default_type)}</span>`
            : '';
        const defaultAmountBadge = cat.default_amount
            ? `<span class="category-badge default-amount">${Utils.formatCurrency(cat.default_amount)}</span>`
            : '';
        const plBadge = cat.show_on_pl
            ? '<span class="category-badge pl">Hidden</span>'
            : '';
        const cogsBadge = cat.is_cogs
            ? '<span class="category-badge cogs">COGS</span>'
            : '';
        const deprBadge = cat.is_depreciation
            ? '<span class="category-badge depr">Depr.</span>'
            : '';
        const salesTaxBadge = cat.is_sales_tax
            ? '<span class="category-badge sales-tax">Sales Tax</span>'
            : '';

        return `
            <div class="category-item" data-id="${cat.id}">
                <div class="category-info">
                    <span class="category-name">${Utils.escapeHtml(cat.name)} ${monthlyBadge} ${defaultTypeBadge} ${defaultAmountBadge} ${plBadge} ${cogsBadge} ${deprBadge} ${salesTaxBadge}</span>
                    <span class="category-meta">${usageCount} transaction${usageCount !== 1 ? 's' : ''}</span>
                </div>
                <div class="category-actions">
                    <button class="btn-icon always-visible edit-category-btn" data-id="${cat.id}" title="Edit">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon always-visible delete-category-btn" data-id="${cat.id}" title="Delete"
                            ${usageCount > 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Render the manage categories list in the modal with folder structure
     * @param {Array} categories - Array of category objects
     */
    renderManageCategoriesList(categories) {
        const container = document.getElementById('categoriesList');
        const folders = Database.getFolders();

        if (categories.length === 0 && folders.length === 0) {
            container.innerHTML = '<p class="empty-state">No categories yet.</p>';
            return;
        }

        // Group categories by folder
        const folderMap = {};
        const unfiled = [];

        categories.forEach(cat => {
            if (cat.folder_id) {
                if (!folderMap[cat.folder_id]) folderMap[cat.folder_id] = [];
                folderMap[cat.folder_id].push(cat);
            } else {
                unfiled.push(cat);
            }
        });

        let html = '';

        // Render folders
        folders.forEach(folder => {
            const folderCats = folderMap[folder.id] || [];
            html += `
                <div class="folder-group" data-folder-id="${folder.id}">
                    <div class="folder-header" data-folder-id="${folder.id}">
                        <div class="folder-header-left">
                            <svg class="folder-toggle" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path d="M6 9l6 6 6-6"></path>
                            </svg>
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                            ${Utils.escapeHtml(folder.name)} <span class="type-badge type-${folder.folder_type || 'payable'}">${this.capitalizeFirst(folder.folder_type || 'payable')}</span> <span class="category-meta">(${folderCats.length})</span>
                        </div>
                        <div class="folder-actions">
                            <button class="btn-icon always-visible edit-folder-btn" data-id="${folder.id}" title="Edit Folder">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-icon always-visible delete-folder-btn" data-id="${folder.id}" title="Delete Folder">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="folder-children" data-folder-id="${folder.id}">
                        ${folderCats.map(cat => this.renderCategoryItem(cat)).join('')}
                        ${folderCats.length === 0 ? '<p class="empty-state" style="padding:8px 12px;font-size:0.8rem;">No categories in this folder</p>' : ''}
                    </div>
                </div>
            `;
        });

        // Render unfiled categories
        if (unfiled.length > 0) {
            if (folders.length > 0) {
                html += '<div class="unfiled-header">Unfiled</div>';
            }
            unfiled.forEach(cat => {
                html += this.renderCategoryItem(cat);
            });
        }

        container.innerHTML = html;
    },

    /**
     * Populate the folder dropdown in category modal
     * @param {Array} folders - Array of folder objects
     * @param {string} selectId - ID of the select element
     */
    populateFolderDropdown(folders, selectId = 'categoryFolder') {
        const select = document.getElementById(selectId);
        const currentValue = select.value;

        select.innerHTML = '<option value="">No Folder</option>';

        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = `${folder.name} (${this.capitalizeFirst(folder.folder_type || 'payable')})`;
            option.dataset.folderType = folder.folder_type || 'payable';
            select.appendChild(option);
        });

        if (currentValue) {
            select.value = currentValue;
        }
    },

    /**
     * Render the cash flow spreadsheet table (categories as rows, months as columns)
     * @param {Object} spreadsheetData - { months: string[], data: Object[] } from getCashFlowSpreadsheet()
     * @param {Object} [cfOverrides] - Map of "categoryId-month" => override_amount
     * @param {string} [currentMonth] - Current month YYYY-MM (for projection styling)
     */
    renderCashFlowSpreadsheet(spreadsheetData, cfOverrides, currentMonth) {
        const container = document.getElementById('cashflowSpreadsheet');
        const { months, data } = spreadsheetData;
        cfOverrides = cfOverrides || {};

        if (months.length === 0) {
            container.innerHTML = '<p class="empty-state">No completed transactions yet.</p>';
            return;
        }

        // Group data by category_id and type using Map (preserves insertion order from DB)
        const receivableCatMap = new Map();
        const payableCatMap = new Map();

        data.forEach(row => {
            const target = row.transaction_type === 'receivable' ? receivableCatMap : payableCatMap;
            if (!target.has(row.category_id)) {
                target.set(row.category_id, { name: row.category_name, months: {} });
            }
            const catData = target.get(row.category_id);
            catData.months[row.month] = (catData.months[row.month] || 0) + row.total;
        });

        // Entries ordered by DB sort (cashflow_sort_order ASC, name ASC) - Map preserves insertion order
        const receivableEntries = Array.from(receivableCatMap.entries());
        const payableEntries = Array.from(payableCatMap.entries());

        // Helpers (defined before totals so projections are reflected in subtotals)
        const fmtMonth = (m) => Utils.formatMonthShort(m);
        const fmtAmt = (amt) => Utils.formatCurrency(amt);
        const isFuture = (m) => currentMonth && m > currentMonth;

        const getCFVal = (catId, month, computed) => {
            const key = `${catId}-${month}`;
            return (key in cfOverrides) ? cfOverrides[key] : computed;
        };
        const isCFOverridden = (catId, month) => `${catId}-${month}` in cfOverrides;

        const computeCFProjectedAvg = (catMonths) => {
            if (!currentMonth) return 0;
            const pastValues = months.filter(m => !isFuture(m)).map(m => catMonths[m] || 0).filter(v => v > 0);
            return pastValues.length > 0 ? pastValues.reduce((a, b) => a + b, 0) / pastValues.length : 0;
        };

        // Effective value for a category in a month (with projection + override)
        const getEffectiveVal = (catId, catData, m) => {
            const raw = catData.months[m] || 0;
            const fallback = isFuture(m) && raw === 0 ? computeCFProjectedAvg(catData.months) : raw;
            return getCFVal(catId, m, fallback);
        };

        // Calculate per-month totals (using effective projected/override values)
        const monthReceipts = {};
        const monthPayments = {};
        months.forEach(m => {
            monthReceipts[m] = 0;
            monthPayments[m] = 0;
        });

        receivableEntries.forEach(([catId, catData]) => {
            months.forEach(m => {
                monthReceipts[m] += getEffectiveVal(catId, catData, m);
            });
        });

        payableEntries.forEach(([catId, catData]) => {
            months.forEach(m => {
                monthPayments[m] += getEffectiveVal(catId, catData, m);
            });
        });

        // Calculate running beginning balance (ending balance of previous month)
        const beginningBalance = {};
        let runningBalance = 0;
        months.forEach(m => {
            beginningBalance[m] = runningBalance;
            runningBalance += monthReceipts[m] - monthPayments[m];
        });

        let html = '<table class="cashflow-table"><thead><tr>';
        html += '<th></th>';
        months.forEach(m => {
            const futureClass = isFuture(m) ? ' cashflow-future-header' : '';
            const badge = isFuture(m) ? ' <span class="projected-badge">P</span>' : '';
            html += `<th class="${futureClass}">${fmtMonth(m)}${badge}</th>`;
        });
        html += '<th>Total</th>';
        html += '</tr></thead><tbody>';

        // Beginning Cash Balance row
        html += '<tr class="cashflow-subtotal"><td>Beginning Cash Balance</td>';
        months.forEach(m => { html += `<td>${fmtAmt(beginningBalance[m])}</td>`; });
        html += `<td></td></tr>`;

        // CASH RECEIPTS section header
        html += '<tr class="cashflow-section-header"><td colspan="' + (months.length + 2) + '">Cash Receipts</td></tr>';

        // Individual receivable category rows
        receivableEntries.forEach(([catId, catData]) => {
            let rowTotal = 0;
            html += `<tr draggable="true" data-category-id="${catId}" data-section="receivable">`;
            html += '<td class="cashflow-indent cashflow-drag-handle">' + Utils.escapeHtml(catData.name) + '</td>';
            months.forEach(m => {
                const amt = getEffectiveVal(catId, catData, m);
                rowTotal += amt;
                const overClass = isCFOverridden(catId, m) ? ' pnl-overridden' : '';
                const projClass = isFuture(m) && !isCFOverridden(catId, m) ? ' cashflow-projected' : '';
                const editClass = isFuture(m) ? ' cf-editable' : '';
                html += `<td class="amount-receivable${overClass}${projClass}${editClass}" data-cat-id="${catId}" data-month="${m}">${amt ? fmtAmt(amt) : ''}</td>`;
            });
            html += `<td class="amount-receivable">${fmtAmt(rowTotal)}</td></tr>`;
        });

        if (receivableEntries.length === 0) {
            html += '<tr><td class="cashflow-indent" style="color:var(--color-text-muted);font-style:italic;">No receipts</td>';
            months.forEach(() => { html += '<td></td>'; });
            html += '<td></td></tr>';
        }

        // Total Cash Receipts subtotal
        let totalAllReceipts = 0;
        html += '<tr class="cashflow-subtotal"><td>Total Cash Receipts</td>';
        months.forEach(m => {
            totalAllReceipts += monthReceipts[m];
            html += `<td class="amount-receivable">${fmtAmt(monthReceipts[m])}</td>`;
        });
        html += `<td class="amount-receivable">${fmtAmt(totalAllReceipts)}</td></tr>`;

        // Beginning Balance + Receipts subtotal
        html += '<tr class="cashflow-subtotal"><td>Beginning Balance + Receipts</td>';
        months.forEach(m => {
            html += `<td>${fmtAmt(beginningBalance[m] + monthReceipts[m])}</td>`;
        });
        html += '<td></td></tr>';

        // CASH PAYMENTS section header
        html += '<tr class="cashflow-section-header"><td colspan="' + (months.length + 2) + '">Cash Payments</td></tr>';

        // Individual payable category rows
        payableEntries.forEach(([catId, catData]) => {
            let rowTotal = 0;
            html += `<tr draggable="true" data-category-id="${catId}" data-section="payable">`;
            html += '<td class="cashflow-indent cashflow-drag-handle">' + Utils.escapeHtml(catData.name) + '</td>';
            months.forEach(m => {
                const amt = getEffectiveVal(catId, catData, m);
                rowTotal += amt;
                const overClass = isCFOverridden(catId, m) ? ' pnl-overridden' : '';
                const projClass = isFuture(m) && !isCFOverridden(catId, m) ? ' cashflow-projected' : '';
                const editClass = isFuture(m) ? ' cf-editable' : '';
                html += `<td class="amount-payable${overClass}${projClass}${editClass}" data-cat-id="${catId}" data-month="${m}">${amt ? fmtAmt(amt) : ''}</td>`;
            });
            html += `<td class="amount-payable">${fmtAmt(rowTotal)}</td></tr>`;
        });

        if (payableEntries.length === 0) {
            html += '<tr><td class="cashflow-indent" style="color:var(--color-text-muted);font-style:italic;">No payments</td>';
            months.forEach(() => { html += '<td></td>'; });
            html += '<td></td></tr>';
        }

        // Total Cash Payments subtotal
        let totalAllPayments = 0;
        html += '<tr class="cashflow-subtotal"><td>Total Cash Payments</td>';
        months.forEach(m => {
            totalAllPayments += monthPayments[m];
            html += `<td class="amount-payable">${fmtAmt(monthPayments[m])}</td>`;
        });
        html += `<td class="amount-payable">${fmtAmt(totalAllPayments)}</td></tr>`;

        // Ending Cash Balance total row
        html += '<tr class="cashflow-total"><td>Ending Cash Balance</td>';
        months.forEach(m => {
            const ending = beginningBalance[m] + monthReceipts[m] - monthPayments[m];
            html += `<td>${fmtAmt(ending)}</td>`;
        });
        const netTotal = totalAllReceipts - totalAllPayments;
        html += `<td>${fmtAmt(netTotal)}</td></tr>`;

        // Net Cash Inflow (Outflow) row
        html += '<tr class="cashflow-subtotal"><td>Net Cash Inflow (Outflow)</td>';
        months.forEach(m => {
            const netCash = monthReceipts[m] - monthPayments[m];
            const colorClass = netCash >= 0 ? 'amount-receivable' : 'amount-payable';
            html += `<td class="${colorClass}">${fmtAmt(netCash)}</td>`;
        });
        const totalNetCash = totalAllReceipts - totalAllPayments;
        const totalNetClass = totalNetCash >= 0 ? 'amount-receivable' : 'amount-payable';
        html += `<td class="${totalNetClass}">${fmtAmt(totalNetCash)}</td></tr>`;

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    /**
     * Render the Profit & Loss spreadsheet (VE format, accrual-based)
     * @param {Object} plData - { months, revenue, cogs, opex } from getPLSpreadsheet()
     * @param {Object} overrides - Map of "categoryId-month" => override_amount
     * @param {string} taxMode - 'corporate' (21%) or 'passthrough' ($0)
     * @param {string} [currentMonth] - Current month YYYY-MM (for projection styling)
     */
    renderProfitLossSpreadsheet(plData, overrides, taxMode, currentMonth) {
        const container = document.getElementById('pnlSpreadsheet');
        const { months, revenue, cogs, opex, depreciation, assetDeprByMonth, loanInterestByMonth } = plData;

        if (months.length === 0) {
            container.innerHTML = '<p class="empty-state">No transactions with a month due yet.</p>';
            return;
        }

        const fmtMonth = (m) => Utils.formatMonthShort(m);
        const fmtAmt = (amt) => Utils.formatCurrency(amt);
        const colSpan = months.length + 2;

        // Helper to get value (override or computed)
        const getVal = (catId, month, computed) => {
            const key = `${catId}-${month}`;
            return (key in overrides) ? overrides[key] : computed;
        };

        const isOverridden = (catId, month) => {
            return `${catId}-${month}` in overrides;
        };

        // Color helper for negative values
        const negStyle = (val) => val >= 0 ? '' : ' style="color:var(--color-payable)"';

        // Group data by category_id using Map (preserves insertion order from DB)
        const groupByCategory = (rows) => {
            const map = new Map();
            rows.forEach(row => {
                if (!map.has(row.category_id)) {
                    map.set(row.category_id, { name: row.category_name, months: {} });
                }
                map.get(row.category_id).months[row.month] = row.total;
            });
            return Array.from(map.entries());
        };

        const revenueEntries = groupByCategory(revenue);
        const cogsEntries = groupByCategory(cogs);
        const opexEntries = groupByCategory(opex);

        // Helper: check if month is projected (future)
        const isFuture = (m) => currentMonth && m > currentMonth;

        // Compute projected averages per category from past months
        const computeProjectedAvg = (catMonths) => {
            if (!currentMonth) return 0;
            const pastValues = months.filter(m => !isFuture(m)).map(m => catMonths[m] || 0).filter(v => v > 0);
            return pastValues.length > 0 ? pastValues.reduce((a, b) => a + b, 0) / pastValues.length : 0;
        };

        // Start building table
        let html = '<table class="pnl-table"><thead><tr>';
        html += '<th></th>';
        months.forEach(m => {
            const futureClass = isFuture(m) ? ' pnl-future-header' : '';
            const badge = isFuture(m) ? ' <span class="projected-badge">P</span>' : '';
            html += `<th class="${futureClass}">${fmtMonth(m)}${badge}</th>`;
        });
        html += '<th>Total</th>';
        html += '</tr></thead><tbody>';

        // ===== REVENUE =====
        html += `<tr class="pnl-section-header"><td colspan="${colSpan}">Revenue</td></tr>`;

        const monthRevenue = {};
        months.forEach(m => { monthRevenue[m] = 0; });

        revenueEntries.forEach(([catId, catData]) => {
            let rowTotal = 0;
            const projAvg = computeProjectedAvg(catData.months);
            html += `<tr class="pnl-indent"><td>${Utils.escapeHtml(catData.name)}</td>`;
            months.forEach(m => {
                const computed = catData.months[m] || 0;
                const fallback = isFuture(m) && computed === 0 ? projAvg : computed;
                const val = getVal(catId, m, fallback);
                monthRevenue[m] += val;
                rowTotal += val;
                const overriddenClass = isOverridden(catId, m) ? ' pnl-overridden' : '';
                const projClass = isFuture(m) && !isOverridden(catId, m) ? ' pnl-projected' : '';
                html += `<td class="pnl-editable${overriddenClass}${projClass}" data-cat-id="${catId}" data-month="${m}">${fmtAmt(val)}</td>`;
            });
            html += `<td>${fmtAmt(rowTotal)}</td></tr>`;
        });

        // Total Revenue
        let totalRevenue = 0;
        html += '<tr class="pnl-subtotal"><td>Total Revenue</td>';
        months.forEach(m => {
            totalRevenue += monthRevenue[m];
            html += `<td>${fmtAmt(monthRevenue[m])}</td>`;
        });
        html += `<td>${fmtAmt(totalRevenue)}</td></tr>`;

        // ===== COST OF GOODS SOLD =====
        html += `<tr class="pnl-section-header"><td colspan="${colSpan}">Cost of Goods Sold</td></tr>`;

        const monthCogs = {};
        months.forEach(m => { monthCogs[m] = 0; });

        cogsEntries.forEach(([catId, catData]) => {
            let rowTotal = 0;
            const projAvg = computeProjectedAvg(catData.months);
            html += `<tr class="pnl-indent"><td>${Utils.escapeHtml(catData.name)}</td>`;
            months.forEach(m => {
                const computed = catData.months[m] || 0;
                const fallback = isFuture(m) && computed === 0 ? projAvg : computed;
                const val = getVal(catId, m, fallback);
                monthCogs[m] += val;
                rowTotal += val;
                const overriddenClass = isOverridden(catId, m) ? ' pnl-overridden' : '';
                const projClass = isFuture(m) && !isOverridden(catId, m) ? ' pnl-projected' : '';
                html += `<td class="pnl-editable${overriddenClass}${projClass}" data-cat-id="${catId}" data-month="${m}">${fmtAmt(val)}</td>`;
            });
            html += `<td>${fmtAmt(rowTotal)}</td></tr>`;
        });

        // Total COGS
        let totalCogs = 0;
        html += '<tr class="pnl-subtotal"><td>Total Cost of Goods Sold</td>';
        months.forEach(m => {
            totalCogs += monthCogs[m];
            html += `<td>${fmtAmt(monthCogs[m])}</td>`;
        });
        html += `<td>${fmtAmt(totalCogs)}</td></tr>`;

        // ===== GROSS PROFIT =====
        let totalGP = 0;
        html += '<tr class="pnl-total"><td>Gross Profit</td>';
        months.forEach(m => {
            const gp = monthRevenue[m] - monthCogs[m];
            totalGP += gp;
            html += `<td${negStyle(gp)}>${fmtAmt(gp)}</td>`;
        });
        html += `<td${negStyle(totalGP)}>${fmtAmt(totalGP)}</td></tr>`;

        // Gross Margin %
        html += '<tr class="pnl-percentage"><td>Gross Margin %</td>';
        months.forEach(m => {
            const gp = monthRevenue[m] - monthCogs[m];
            const pct = monthRevenue[m] ? ((gp / monthRevenue[m]) * 100).toFixed(1) + '%' : '-';
            html += `<td>${pct}</td>`;
        });
        const totalGPPct = totalRevenue ? ((totalGP / totalRevenue) * 100).toFixed(1) + '%' : '-';
        html += `<td>${totalGPPct}</td></tr>`;

        // ===== OPERATING EXPENSES =====
        html += `<tr class="pnl-section-header"><td colspan="${colSpan}">Operating Expenses</td></tr>`;

        const monthOpex = {};
        months.forEach(m => { monthOpex[m] = 0; });

        opexEntries.forEach(([catId, catData]) => {
            let rowTotal = 0;
            const projAvg = computeProjectedAvg(catData.months);
            html += `<tr class="pnl-indent"><td>${Utils.escapeHtml(catData.name)}</td>`;
            months.forEach(m => {
                const computed = catData.months[m] || 0;
                const fallback = isFuture(m) && computed === 0 ? projAvg : computed;
                const val = getVal(catId, m, fallback);
                monthOpex[m] += val;
                rowTotal += val;
                const overriddenClass = isOverridden(catId, m) ? ' pnl-overridden' : '';
                const projClass = isFuture(m) && !isOverridden(catId, m) ? ' pnl-projected' : '';
                html += `<td class="pnl-editable${overriddenClass}${projClass}" data-cat-id="${catId}" data-month="${m}">${fmtAmt(val)}</td>`;
            });
            html += `<td>${fmtAmt(rowTotal)}</td></tr>`;
        });

        // Depreciation rows (manual input only — values come from pl_overrides)
        depreciation.forEach(cat => {
            let rowTotal = 0;
            html += `<tr class="pnl-indent"><td>${Utils.escapeHtml(cat.category_name)}</td>`;
            months.forEach(m => {
                const val = getVal(cat.category_id, m, 0);
                monthOpex[m] += val;
                rowTotal += val;
                const overriddenClass = isOverridden(cat.category_id, m) ? ' pnl-overridden' : '';
                html += `<td class="pnl-editable${overriddenClass}" data-cat-id="${cat.category_id}" data-month="${m}">${fmtAmt(val)}</td>`;
            });
            html += `<td>${fmtAmt(rowTotal)}</td></tr>`;
        });

        // Computed: Depreciation from Fixed Assets tab
        if (assetDeprByMonth && Object.keys(assetDeprByMonth).length > 0) {
            let rowTotal = 0;
            html += '<tr class="pnl-indent pnl-computed-row"><td>Depreciation (Fixed Assets)</td>';
            months.forEach(m => {
                const val = assetDeprByMonth[m] || 0;
                monthOpex[m] += val;
                rowTotal += val;
                html += `<td>${fmtAmt(val)}</td>`;
            });
            html += `<td>${fmtAmt(rowTotal)}</td></tr>`;
        }

        // Computed: Interest Expense from Loans
        if (loanInterestByMonth && Object.keys(loanInterestByMonth).length > 0) {
            let rowTotal = 0;
            html += '<tr class="pnl-indent pnl-computed-row"><td>Interest Expense (Loans)</td>';
            months.forEach(m => {
                const val = loanInterestByMonth[m] || 0;
                monthOpex[m] += val;
                rowTotal += val;
                html += `<td>${fmtAmt(val)}</td>`;
            });
            html += `<td>${fmtAmt(rowTotal)}</td></tr>`;
        }

        // Total Operating Expenses
        let totalOpex = 0;
        html += '<tr class="pnl-subtotal"><td>Total Operating Expenses</td>';
        months.forEach(m => {
            totalOpex += monthOpex[m];
            html += `<td>${fmtAmt(monthOpex[m])}</td>`;
        });
        html += `<td>${fmtAmt(totalOpex)}</td></tr>`;

        // ===== NET INCOME (LOSS) BEFORE TAXES =====
        let totalNIBT = 0;
        html += '<tr class="pnl-total"><td>Net Income (Loss) Before Taxes</td>';
        months.forEach(m => {
            const nibt = monthRevenue[m] - monthCogs[m] - monthOpex[m];
            totalNIBT += nibt;
            html += `<td${negStyle(nibt)}>${fmtAmt(nibt)}</td>`;
        });
        html += `<td${negStyle(totalNIBT)}>${fmtAmt(totalNIBT)}</td></tr>`;

        // ===== INCOME TAX =====
        const monthTax = {};
        if (taxMode === 'corporate') {
            // Corporate: 21% of Net Income Before Taxes (only when positive)
            months.forEach(m => {
                const nibt = monthRevenue[m] - monthCogs[m] - monthOpex[m];
                const autoTax = nibt > 0 ? nibt * 0.21 : 0;
                monthTax[m] = getVal(-1, m, autoTax);
            });
        } else {
            // Pass-through: $0
            months.forEach(m => { monthTax[m] = 0; });
        }

        let totalTax = 0;
        const taxLabel = taxMode === 'passthrough'
            ? 'Income Tax (pass-through to owners)'
            : 'Income Tax (21%)';
        html += `<tr class="pnl-indent"><td>${taxLabel}</td>`;
        months.forEach(m => {
            totalTax += monthTax[m];
            if (taxMode === 'passthrough') {
                html += '<td style="text-align:center;">&mdash;</td>';
            } else {
                const overriddenClass = isOverridden(-1, m) ? ' pnl-overridden' : '';
                html += `<td class="pnl-editable${overriddenClass}" data-cat-id="-1" data-month="${m}">${fmtAmt(monthTax[m])}</td>`;
            }
        });
        if (taxMode === 'passthrough') {
            html += '<td style="text-align:center;">&mdash;</td></tr>';
        } else {
            html += `<td>${fmtAmt(totalTax)}</td></tr>`;
        }

        // ===== NET INCOME (LOSS) AFTER TAXES =====
        let totalNIAT = 0;
        html += '<tr class="pnl-total"><td>Net Income (Loss) After Taxes</td>';
        months.forEach(m => {
            const niat = monthRevenue[m] - monthCogs[m] - monthOpex[m] - monthTax[m];
            totalNIAT += niat;
            html += `<td${negStyle(niat)}>${fmtAmt(niat)}</td>`;
        });
        html += `<td${negStyle(totalNIAT)}>${fmtAmt(totalNIAT)}</td></tr>`;

        // ===== CUMULATIVE NET INCOME =====
        let cumulative = 0;
        html += '<tr class="pnl-cumulative"><td>Cumulative Net Income (Loss)</td>';
        months.forEach(m => {
            const niat = monthRevenue[m] - monthCogs[m] - monthOpex[m] - monthTax[m];
            cumulative += niat;
            html += `<td${negStyle(cumulative)}>${fmtAmt(cumulative)}</td>`;
        });
        html += `<td>${fmtAmt(cumulative)}</td></tr>`;

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    /**
     * Render the Balance Sheet
     * @param {Object} data - Balance sheet data from App.refreshBalanceSheet()
     */
    renderBalanceSheet(data) {
        const container = document.getElementById('balanceSheetContent');
        const fmtAmt = (amt) => Utils.formatCurrency(amt);
        const monthLabel = Utils.formatMonthDisplay(data.asOfMonth);

        const isProjected = Utils.isFutureMonth(data.asOfMonth);
        const projLabel = isProjected ? ' <span class="bs-projected-label">Projected</span>' : '';
        let html = `<div class="bs-date-label" style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:12px;">As of ${monthLabel}${projLabel}</div>`;

        html += '<table class="bs-table"><tbody>';

        // ===== ASSETS =====
        html += '<tr class="bs-section-header"><td colspan="2">Assets</td></tr>';

        // Current Assets
        html += '<tr class="bs-subsection"><td colspan="2">Current Assets</td></tr>';
        html += `<tr class="bs-indent"><td>Cash</td><td>${fmtAmt(data.cash)}</td></tr>`;
        html += `<tr class="bs-indent"><td>Accounts Receivable</td><td>${fmtAmt(data.ar)}</td></tr>`;
        if (data.arByCategory && data.arByCategory.length > 0) {
            data.arByCategory.forEach(cat => {
                html += `<tr class="bs-detail-indent"><td>${Utils.escapeHtml(cat.category_name)}</td><td>${fmtAmt(cat.total)}</td></tr>`;
            });
        }

        const totalCurrentAssets = data.cash + data.ar;
        html += `<tr class="bs-subtotal"><td>Total Current Assets</td><td>${fmtAmt(totalCurrentAssets)}</td></tr>`;

        // Fixed Assets
        html += '<tr class="bs-subsection"><td colspan="2">Fixed Assets</td></tr>';
        if (data.assetDetails.length === 0) {
            html += '<tr class="bs-indent"><td style="color:var(--color-text-muted);font-style:italic;">No fixed assets</td><td></td></tr>';
        } else {
            data.assetDetails.forEach(asset => {
                html += `<tr class="bs-indent"><td>${Utils.escapeHtml(asset.name)}</td><td>${fmtAmt(asset.purchase_cost)}</td></tr>`;
            });
        }

        html += `<tr class="bs-indent"><td>Total Fixed Assets (Cost)</td><td>${fmtAmt(data.totalFixedAssetCost)}</td></tr>`;
        html += `<tr class="bs-indent"><td>Less: Accumulated Depreciation</td><td>(${fmtAmt(data.totalAccumDepr)})</td></tr>`;
        html += `<tr class="bs-subtotal"><td>Net Fixed Assets</td><td>${fmtAmt(data.netFixedAssets)}</td></tr>`;

        // Total Assets
        html += `<tr class="bs-total"><td>Total Assets</td><td>${fmtAmt(data.totalAssets)}</td></tr>`;

        // Spacer
        html += '<tr><td colspan="2" style="padding:8px;"></td></tr>';

        // ===== LIABILITIES =====
        html += '<tr class="bs-section-header"><td colspan="2">Liabilities</td></tr>';

        // Current Liabilities
        html += '<tr class="bs-subsection"><td colspan="2">Current Liabilities</td></tr>';
        html += `<tr class="bs-indent"><td>Accounts Payable</td><td>${fmtAmt(data.ap)}</td></tr>`;
        if (data.apByCategory && data.apByCategory.length > 0) {
            data.apByCategory.forEach(cat => {
                html += `<tr class="bs-detail-indent"><td>${Utils.escapeHtml(cat.category_name)}</td><td>${fmtAmt(cat.total)}</td></tr>`;
            });
        }
        html += `<tr class="bs-indent"><td>Sales Tax Payable</td><td>${fmtAmt(data.salesTaxPayable)}</td></tr>`;

        const totalCurrentLiabilities = data.ap + data.salesTaxPayable;
        html += `<tr class="bs-subtotal"><td>Total Current Liabilities</td><td>${fmtAmt(totalCurrentLiabilities)}</td></tr>`;

        // Long-Term Liabilities
        if (data.loanDetails && data.loanDetails.length > 0) {
            html += '<tr class="bs-subsection"><td colspan="2">Long-Term Liabilities</td></tr>';
            data.loanDetails.forEach(loan => {
                if (loan.balance > 0) {
                    html += `<tr class="bs-indent"><td>${Utils.escapeHtml(loan.name)}</td><td>${fmtAmt(loan.balance)}</td></tr>`;
                }
            });
            if (data.totalLoanBalance > 0) {
                html += `<tr class="bs-indent" style="font-weight:500;"><td>Total Loans Payable</td><td>${fmtAmt(data.totalLoanBalance)}</td></tr>`;
            }
        }

        html += `<tr class="bs-subtotal"><td>Total Liabilities</td><td>${fmtAmt(data.totalLiabilities)}</td></tr>`;

        // Spacer
        html += '<tr><td colspan="2" style="padding:4px;"></td></tr>';

        // ===== STOCKHOLDERS' EQUITY =====
        html += '<tr class="bs-section-header"><td colspan="2">Stockholders\' Equity</td></tr>';
        html += `<tr class="bs-indent"><td>Common Stock</td><td>${fmtAmt(data.commonStock)}</td></tr>`;
        html += `<tr class="bs-indent"><td>Additional Paid-In Capital</td><td>${fmtAmt(data.apic)}</td></tr>`;
        html += `<tr class="bs-indent"><td>Retained Earnings</td><td>${fmtAmt(data.retainedEarnings)}</td></tr>`;
        html += `<tr class="bs-subtotal"><td>Total Stockholders' Equity</td><td>${fmtAmt(data.totalEquity)}</td></tr>`;

        // Total Liabilities + Equity
        html += `<tr class="bs-total"><td>Total Liabilities + Equity</td><td>${fmtAmt(data.totalLiabilitiesAndEquity)}</td></tr>`;

        html += '</tbody></table>';

        // Validation
        if (data.isBalanced) {
            html += '<div class="bs-validation balanced">Balanced &mdash; Assets = Liabilities + Equity</div>';
        } else {
            const diff = data.totalAssets - data.totalLiabilitiesAndEquity;
            html += `<div class="bs-validation unbalanced">Unbalanced &mdash; Difference: ${fmtAmt(Math.abs(diff))}</div>`;
        }

        container.innerHTML = html;
    },

    /**
     * Render the Fixed Assets tab with list/detail layout
     * @param {Array} assets - Array of asset objects
     * @param {number|null} selectedAssetId - Currently selected asset ID
     */
    renderFixedAssetsTab(assets, selectedAssetId) {
        const fmtAmt = (amt) => Utils.formatCurrency(amt);

        // Summary cards
        let totalCost = 0, totalAccumDepr = 0;
        assets.forEach(asset => {
            totalCost += asset.purchase_cost;
            const schedule = Utils.computeDepreciationSchedule(asset);
            const currentMonth = Utils.getCurrentMonth();
            let accumDepr = 0;
            Object.entries(schedule).forEach(([m, amt]) => {
                if (m <= currentMonth) accumDepr += amt;
            });
            asset._accumDepr = accumDepr;
            asset._nbv = asset.purchase_cost - accumDepr;
            totalAccumDepr += accumDepr;
        });

        const summaryContainer = document.getElementById('assetsSummaryCards');
        summaryContainer.innerHTML = `
            <div class="assets-summary-card"><span class="assets-summary-label">Total Cost</span><span class="assets-summary-value">${fmtAmt(totalCost)}</span></div>
            <div class="assets-summary-card"><span class="assets-summary-label">Accum. Depreciation</span><span class="assets-summary-value amount-payable">${fmtAmt(totalAccumDepr)}</span></div>
            <div class="assets-summary-card"><span class="assets-summary-label">Net Book Value</span><span class="assets-summary-value">${fmtAmt(totalCost - totalAccumDepr)}</span></div>
        `;

        // Left panel: asset list
        const listPanel = document.getElementById('assetsListPanel');
        if (assets.length === 0) {
            listPanel.innerHTML = '<p class="empty-state">No fixed assets yet. Click "+ Add Asset" to begin.</p>';
        } else {
            listPanel.innerHTML = assets.map(asset => {
                const selected = asset.id === selectedAssetId ? ' selected' : '';
                const methodLabel = asset.depreciation_method === 'none' ? 'Non-depreciable'
                    : asset.depreciation_method === 'double_declining' ? 'DDB' : 'SL';
                return `<div class="asset-list-item${selected}" data-id="${asset.id}">
                    <div class="asset-list-name">${Utils.escapeHtml(asset.name)}</div>
                    <div class="asset-list-meta">${fmtAmt(asset.purchase_cost)} &middot; ${methodLabel}</div>
                    <div class="asset-list-actions">
                        <button class="btn-icon edit-asset-btn" data-id="${asset.id}" title="Edit">&#9998;</button>
                        <button class="btn-icon delete-asset-btn" data-id="${asset.id}" title="Delete">&times;</button>
                    </div>
                </div>`;
            }).join('');
        }

        // Right panel: selected asset detail
        const detailPanel = document.getElementById('assetsDetailPanel');
        const selectedAsset = assets.find(a => a.id === selectedAssetId);
        if (!selectedAsset) {
            detailPanel.innerHTML = '<p class="empty-state">Select an asset to view its depreciation schedule.</p>';
            return;
        }

        const schedule = Utils.computeDepreciationSchedule(selectedAsset);
        const scheduleEntries = Object.entries(schedule).sort((a, b) => a[0].localeCompare(b[0]));

        let html = `<div class="asset-detail-header">
            <h4>${Utils.escapeHtml(selectedAsset.name)}</h4>
            <div class="asset-detail-meta">
                <span>Cost: ${fmtAmt(selectedAsset.purchase_cost)}</span>
                <span>Salvage: ${fmtAmt(selectedAsset.salvage_value || 0)}</span>
                <span>Life: ${selectedAsset.useful_life_months} mo</span>
                <span>Purchased: ${Utils.formatDate(selectedAsset.purchase_date)}</span>
            </div>
        </div>`;

        if (scheduleEntries.length === 0) {
            html += '<p class="empty-state">This asset is non-depreciable.</p>';
        } else {
            html += '<div class="asset-depr-table-wrapper"><table class="asset-depr-table"><thead><tr>';
            html += '<th>Month</th><th>Depreciation</th><th>Accumulated</th><th>Net Book Value</th>';
            html += '</tr></thead><tbody>';

            let accumDepr = 0;
            scheduleEntries.forEach(([month, depr]) => {
                accumDepr += depr;
                const nbv = selectedAsset.purchase_cost - accumDepr;
                html += `<tr>
                    <td>${Utils.formatMonthShort(month)}</td>
                    <td>${fmtAmt(depr)}</td>
                    <td>${fmtAmt(accumDepr)}</td>
                    <td>${fmtAmt(nbv)}</td>
                </tr>`;
            });

            html += '</tbody></table></div>';
        }

        if (selectedAsset.notes) {
            html += `<div class="asset-detail-notes">Notes: ${Utils.escapeHtml(selectedAsset.notes)}</div>`;
        }

        detailPanel.innerHTML = html;
    },

    /**
     * Render the equity section in the Assets & Equity tab
     * @param {Object} equityConfig - Equity configuration
     */
    renderEquitySection(equityConfig) {
        const fmtAmt = (amt) => Utils.formatCurrency(amt);
        const round2 = (v) => Math.round(v * 100) / 100;

        const commonStock = round2(equityConfig.common_stock_par * equityConfig.common_stock_shares);
        const apicVal = round2(equityConfig.apic || 0);
        const totalEquity = round2(commonStock + apicVal);

        const panel = document.getElementById('equityDisplayPanel');

        if (totalEquity === 0 && !equityConfig.common_stock_shares) {
            panel.innerHTML = '<p class="empty-state">No equity configured. Click "Edit Equity" to set up seed money and APIC.</p>';
            return;
        }

        const seedStatus = this._equityStatusBadge(equityConfig.seed_expected_date, equityConfig.seed_received_date);
        const apicStatus = this._equityStatusBadge(equityConfig.apic_expected_date, equityConfig.apic_received_date);

        let html = '<table class="equity-display-table"><thead><tr>';
        html += '<th>Item</th><th>Amount</th><th>Expected</th><th>Received</th><th>Status</th>';
        html += '</tr></thead><tbody>';

        html += `<tr>
            <td>Seed Money (Common Stock)</td>
            <td>${fmtAmt(commonStock)}</td>
            <td>${equityConfig.seed_expected_date ? Utils.formatDate(equityConfig.seed_expected_date) : '—'}</td>
            <td>${equityConfig.seed_received_date ? Utils.formatDate(equityConfig.seed_received_date) : '—'}</td>
            <td>${seedStatus}</td>
        </tr>`;

        if (apicVal > 0) {
            html += `<tr>
                <td>Additional Paid-In Capital</td>
                <td>${fmtAmt(apicVal)}</td>
                <td>${equityConfig.apic_expected_date ? Utils.formatDate(equityConfig.apic_expected_date) : '—'}</td>
                <td>${equityConfig.apic_received_date ? Utils.formatDate(equityConfig.apic_received_date) : '—'}</td>
                <td>${apicStatus}</td>
            </tr>`;
        }

        html += `<tr class="equity-total-row">
            <td><strong>Total Stockholders' Equity</strong></td>
            <td><strong>${fmtAmt(totalEquity)}</strong></td>
            <td colspan="3"></td>
        </tr>`;

        html += '</tbody></table>';

        // Detail line
        if (equityConfig.common_stock_shares) {
            html += `<div class="equity-detail-line">${equityConfig.common_stock_shares.toLocaleString()} shares at ${fmtAmt(equityConfig.common_stock_par)} par value</div>`;
        }

        panel.innerHTML = html;
    },

    _equityStatusBadge(expectedDate, receivedDate) {
        if (receivedDate) {
            return '<span class="status-received">Received</span>';
        } else if (expectedDate) {
            return '<span class="status-pending">Pending</span>';
        }
        return '<span class="status-none">—</span>';
    },

    /**
     * Render the Loans tab with list/detail layout
     * @param {Array} loans - Array of loan objects
     * @param {number|null} selectedLoanId - Currently selected loan ID
     */
    renderLoansTab(loans, selectedLoanId) {
        const fmtAmt = (amt) => Utils.formatCurrency(amt);

        // Left panel: loan list
        const listPanel = document.getElementById('loanListPanel');
        if (loans.length === 0) {
            listPanel.innerHTML = '<p class="empty-state">No loans yet. Click "+ Add Loan" to begin.</p>';
        } else {
            listPanel.innerHTML = loans.map(loan => {
                const selected = loan.id === selectedLoanId ? ' selected' : '';
                return `<div class="loan-list-item${selected}" data-id="${loan.id}">
                    <div class="loan-list-name">${Utils.escapeHtml(loan.name)}</div>
                    <div class="loan-list-meta">${fmtAmt(loan.principal)} &middot; ${loan.annual_rate}%</div>
                    <div class="loan-list-actions">
                        <button class="btn-icon edit-loan-btn" data-id="${loan.id}" title="Edit">&#9998;</button>
                        <button class="btn-icon delete-loan-btn" data-id="${loan.id}" title="Delete">&times;</button>
                    </div>
                </div>`;
            }).join('');
        }

        // Right panel: selected loan detail
        const detailPanel = document.getElementById('loanDetailPanel');
        const selectedLoan = loans.find(l => l.id === selectedLoanId);
        if (!selectedLoan) {
            detailPanel.innerHTML = '<p class="empty-state">Select a loan to view its amortization schedule.</p>';
            return;
        }

        const skippedPayments = Database.getSkippedPayments(selectedLoan.id);
        const schedule = Utils.computeAmortizationSchedule({
            principal: selectedLoan.principal,
            annual_rate: selectedLoan.annual_rate,
            term_months: selectedLoan.term_months,
            payments_per_year: selectedLoan.payments_per_year,
            start_date: selectedLoan.start_date
        }, skippedPayments);

        const totalInterest = schedule.filter(p => !p.skipped).reduce((sum, p) => sum + p.interest, 0);
        const totalPaid = schedule.filter(p => !p.skipped).reduce((sum, p) => sum + p.payment, 0);
        const skippedCount = schedule.filter(p => p.skipped).length;
        const termYears = (selectedLoan.term_months / 12).toFixed(1);

        let html = '<div class="loan-summary">';
        html += `<div class="loan-summary-item"><div class="loan-summary-label">Principal</div><div class="loan-summary-value">${fmtAmt(selectedLoan.principal)}</div></div>`;
        html += `<div class="loan-summary-item"><div class="loan-summary-label">Rate</div><div class="loan-summary-value">${selectedLoan.annual_rate}%</div></div>`;
        html += `<div class="loan-summary-item"><div class="loan-summary-label">Term</div><div class="loan-summary-value">${termYears} yr</div></div>`;
        html += `<div class="loan-summary-item"><div class="loan-summary-label">Payment</div><div class="loan-summary-value">${fmtAmt(schedule[0]?.payment || 0)}</div></div>`;
        html += `<div class="loan-summary-item"><div class="loan-summary-label">Total Interest</div><div class="loan-summary-value amount-payable">${fmtAmt(totalInterest)}</div></div>`;
        html += `<div class="loan-summary-item"><div class="loan-summary-label">Total Paid</div><div class="loan-summary-value">${fmtAmt(totalPaid)}</div></div>`;
        if (skippedCount > 0) {
            html += `<div class="loan-summary-item"><div class="loan-summary-label">Skipped</div><div class="loan-summary-value amount-payable">${skippedCount}</div></div>`;
        }
        html += '</div>';

        html += '<div class="loan-table-wrapper"><table class="loan-table"><thead><tr>';
        html += '<th>#</th><th>Date</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Balance</th><th></th>';
        html += '</tr></thead><tbody>';

        schedule.forEach(p => {
            const skippedClass = p.skipped ? ' class="loan-payment-skipped"' : '';
            html += `<tr${skippedClass}>`;
            html += `<td>${p.number}</td>`;
            html += `<td>${Utils.formatMonthShort(p.month)}</td>`;
            html += `<td>${p.skipped ? '—' : fmtAmt(p.payment)}</td>`;
            html += `<td>${p.skipped ? '—' : fmtAmt(p.principal)}</td>`;
            html += `<td class="amount-payable">${fmtAmt(p.interest)}</td>`;
            html += `<td>${fmtAmt(p.ending_balance)}</td>`;
            html += `<td><button class="btn-icon loan-skip-btn" data-loan-id="${selectedLoan.id}" data-payment="${p.number}" title="${p.skipped ? 'Restore payment' : 'Skip payment'}">${p.skipped ? '&#8634;' : '&times;'}</button></td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';

        if (selectedLoan.notes) {
            html += `<div class="loan-detail-notes">Notes: ${Utils.escapeHtml(selectedLoan.notes)}</div>`;
        }

        detailPanel.innerHTML = html;
    },

    /**
     * Generate CSV string from transaction data
     * @param {Array} transactions - Array of transaction objects for export
     * @returns {string} CSV string
     */
    generateCsv(transactions) {
        const headers = [
            'Entry Date',
            'Category',
            'Type',
            'Amount',
            'Pretax Amount',
            'Status',
            'Month Due',
            'Month Paid',
            'Date Processed',
            'Payment For',
            'Notes'
        ];

        const escapeCsvField = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        const rows = transactions.map(t => [
            t.entry_date || '',
            t.category || '',
            t.type || '',
            t.amount || 0,
            t.pretax_amount || '',
            t.status || '',
            t.month_due ? Utils.formatMonthShort(t.month_due) : '',
            t.month_paid ? Utils.formatMonthShort(t.month_paid) : '',
            t.date_processed || '',
            t.payment_for_month ? Utils.formatMonthShort(t.payment_for_month) : '',
            t.notes || ''
        ]);

        const csvLines = [
            headers.map(escapeCsvField).join(','),
            ...rows.map(row => row.map(escapeCsvField).join(','))
        ];

        return csvLines.join('\n');
    },

    /**
     * Show the notes tooltip near the target element
     * @param {string} notes - The notes text
     * @param {HTMLElement} target - The element to position near
     */
    showNotesTooltip(notes, target) {
        const tooltip = document.getElementById('notesTooltip');
        tooltip.textContent = notes;
        tooltip.classList.add('visible');

        const rect = target.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.bottom + 8) + 'px';

        // Keep tooltip on screen
        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.right > window.innerWidth) {
            tooltip.style.left = (window.innerWidth - tooltipRect.width - 16) + 'px';
        }
        if (tooltipRect.bottom > window.innerHeight) {
            tooltip.style.top = (rect.top - tooltipRect.height - 8) + 'px';
        }
    },

    /**
     * Hide the notes tooltip
     */
    hideNotesTooltip() {
        const tooltip = document.getElementById('notesTooltip');
        tooltip.classList.remove('visible');
    },

    /**
     * Show modal
     * @param {string} modalId - ID of the modal element
     */
    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    /**
     * Hide modal
     * @param {string} modalId - ID of the modal element
     */
    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    /**
     * Reset the entry form
     */
    resetForm() {
        document.getElementById('entryForm').reset();
        document.getElementById('editingId').value = '';
        document.getElementById('entryDate').value = Utils.getTodayDate();
        document.getElementById('formTitle').textContent = 'Add New Entry';
        document.getElementById('submitBtn').textContent = 'Add Entry';

        // Reset radio buttons
        document.querySelector('input[name="transactionType"][value="receivable"]').checked = true;

        // Update status dropdown for receivable type
        this.updateStatusOptions('receivable');

        // Reset status to pending and update field visibility
        document.getElementById('status').value = 'pending';
        this.updateFormFieldVisibility('pending');

        // Hide payment for month field
        this.togglePaymentForMonth(false);

        // Hide and clear pretax amount
        document.getElementById('pretaxAmountGroup').style.display = 'none';
        document.getElementById('pretaxAmount').value = '';

        // Clear month due/paid selects
        document.getElementById('monthDueMonth').value = '';
        document.getElementById('monthDueYear').value = '';
        document.getElementById('monthPaidMonth').value = '';
        document.getElementById('monthPaidYear').value = '';

        // Close the entry modal
        this.hideModal('entryModal');
    },

    /**
     * Populate form for editing
     * @param {Object} transaction - Transaction object
     */
    populateFormForEdit(transaction) {
        document.getElementById('editingId').value = transaction.id;
        document.getElementById('entryDate').value = transaction.entry_date;
        document.getElementById('category').value = transaction.category_id;
        document.getElementById('amount').value = transaction.amount;
        document.getElementById('dateProcessed').value = transaction.date_processed || '';
        document.getElementById('notes').value = transaction.notes || '';

        // Set transaction type radio
        const typeRadio = document.querySelector(`input[name="transactionType"][value="${transaction.transaction_type}"]`);
        if (typeRadio) typeRadio.checked = true;

        // Update status options for the transaction type
        this.updateStatusOptions(transaction.transaction_type);
        document.getElementById('status').value = transaction.status;

        // Update field visibility based on status
        this.updateFormFieldVisibility(transaction.status);

        // Set month due (split YYYY-MM into parts)
        if (transaction.month_due) {
            const [dueYear, dueMonth] = transaction.month_due.split('-');
            document.getElementById('monthDueMonth').value = dueMonth;
            document.getElementById('monthDueYear').value = dueYear;
        } else {
            document.getElementById('monthDueMonth').value = '';
            document.getElementById('monthDueYear').value = '';
        }

        // Set month paid (split YYYY-MM into parts)
        if (transaction.month_paid) {
            const [paidYear, paidMonth] = transaction.month_paid.split('-');
            document.getElementById('monthPaidMonth').value = paidMonth;
            document.getElementById('monthPaidYear').value = paidYear;
        } else {
            document.getElementById('monthPaidMonth').value = '';
            document.getElementById('monthPaidYear').value = '';
        }

        // Handle pretax amount
        const pretaxGroup = document.getElementById('pretaxAmountGroup');
        if (transaction.transaction_type === 'receivable') {
            pretaxGroup.style.display = 'flex';
            document.getElementById('pretaxAmount').value = transaction.pretax_amount || '';
        } else {
            pretaxGroup.style.display = 'none';
            document.getElementById('pretaxAmount').value = '';
        }

        // Handle payment for month if category is monthly
        if (transaction.category_is_monthly) {
            this.togglePaymentForMonth(true, transaction.category_name);
            document.getElementById('paymentForMonth').value = transaction.payment_for_month || '';
        } else {
            this.togglePaymentForMonth(false);
        }

        // Update form title and button
        document.getElementById('formTitle').textContent = 'Edit Entry';
        document.getElementById('submitBtn').textContent = 'Update Entry';

        // Open entry modal
        this.showModal('entryModal');
    },

    /**
     * Update status dropdown options based on transaction type
     * @param {string} type - 'receivable' or 'payable'
     */
    updateStatusOptions(type) {
        const statusSelect = document.getElementById('status');
        const currentValue = statusSelect.value;

        if (type === 'receivable') {
            statusSelect.innerHTML = `
                <option value="pending">Pending</option>
                <option value="received">Received</option>
            `;
        } else {
            statusSelect.innerHTML = `
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
            `;
        }

        if (currentValue === 'pending') {
            statusSelect.value = 'pending';
        }
    },

    /**
     * Get form data (combines month/year selects into YYYY-MM format)
     * @returns {Object} Form data object
     */
    getFormData() {
        const transactionType = document.querySelector('input[name="transactionType"]:checked').value;
        const paymentForGroup = document.getElementById('paymentForGroup');
        const paymentForMonth = paymentForGroup.style.display !== 'none'
            ? document.getElementById('paymentForMonth').value || null
            : null;

        // Combine month due month + year
        const dueMonth = document.getElementById('monthDueMonth').value;
        const dueYear = document.getElementById('monthDueYear').value;
        const month_due = (dueMonth && dueYear) ? `${dueYear}-${dueMonth}` : null;

        // Combine month paid month + year
        const paidMonth = document.getElementById('monthPaidMonth').value;
        const paidYear = document.getElementById('monthPaidYear').value;
        const month_paid = (paidMonth && paidYear) ? `${paidYear}-${paidMonth}` : null;

        const status = document.getElementById('status').value;

        // Pretax amount (only when visible / receivable)
        const pretaxGroup = document.getElementById('pretaxAmountGroup');
        const pretaxAmount = (pretaxGroup && pretaxGroup.style.display !== 'none')
            ? Utils.parseAmount(document.getElementById('pretaxAmount').value) || null
            : null;

        return {
            entry_date: document.getElementById('entryDate').value,
            category_id: parseInt(document.getElementById('category').value),
            amount: Utils.parseAmount(document.getElementById('amount').value),
            pretax_amount: pretaxAmount,
            transaction_type: transactionType,
            status: status,
            date_processed: (status !== 'pending') ? (document.getElementById('dateProcessed').value || null) : null,
            month_due: month_due,
            month_paid: (status !== 'pending') ? month_paid : null,
            payment_for_month: paymentForMonth,
            notes: document.getElementById('notes').value.trim() || null
        };
    },

    /**
     * Validate form data
     * @param {Object} data - Form data
     * @returns {Object} Validation result {valid: boolean, message: string}
     */
    validateFormData(data) {
        if (!data.entry_date) {
            return { valid: false, message: 'Entry date is required' };
        }
        if (!data.category_id) {
            return { valid: false, message: 'Please select a category' };
        }
        if (!data.amount || data.amount <= 0) {
            return { valid: false, message: 'Please enter a valid amount' };
        }
        // Require month paid when status is paid or received
        if (data.status !== 'pending' && !data.month_paid) {
            return { valid: false, message: 'Month paid/received is required when status is not pending' };
        }
        return { valid: true };
    },

    /**
     * Show notification message
     * @param {string} message - Message to show
     * @param {string} type - 'success', 'error', or 'info'
     */
    showNotification(message, type = 'info') {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Trigger reflow then add visible class for CSS transition
        notification.offsetHeight;
        notification.classList.add('visible');

        setTimeout(() => {
            notification.classList.remove('visible');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    /**
     * Capitalize first letter
     * @param {string} str - String to capitalize
     * @returns {string} Capitalized string
     */
    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
};

// Export for use in other modules
window.UI = UI;
