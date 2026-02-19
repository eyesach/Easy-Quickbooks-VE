/**
 * Main application logic for the Accounting Journal Calculator
 */

const App = {
    deleteTargetId: null,
    deleteCategoryTargetId: null,
    deleteFolderTargetId: null,
    folderCreatedFromCategory: false,
    pendingFileLoad: null,
    savedFileHandle: null,
    pendingInlineStatusChange: null, // {id, newStatus, selectElement}
    currentSortMode: 'entryDate',

    /**
     * Initialize the application
     */
    async init() {
        try {
            document.body.style.opacity = '0.5';

            await Database.init();

            // Set up initial UI state
            document.getElementById('entryDate').value = Utils.getTodayDate();

            // Populate dropdowns
            UI.populateYearDropdowns();
            UI.populatePaymentForMonthDropdown();

            // Load journal owner and update title
            const owner = Database.getJournalOwner();
            document.getElementById('journalOwner').value = owner;
            UI.updateJournalTitle(owner);

            // Load and render data
            this.refreshAll();

            // Set up event listeners
            this.setupEventListeners();

            document.body.style.opacity = '1';
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            document.body.style.opacity = '1';
            UI.showNotification('Failed to initialize application. Please refresh the page.', 'error');
        }
    },

    /**
     * Refresh all UI components
     */
    refreshAll() {
        this.refreshCategories();
        this.refreshTransactions();
        this.refreshSummary();
        // Refresh cash flow tab if it's currently visible
        const cashflowTab = document.getElementById('cashflowTab');
        if (cashflowTab && cashflowTab.style.display !== 'none') {
            this.refreshCashFlow();
        }
        // Refresh P&L tab if it's currently visible
        const pnlTab = document.getElementById('pnlTab');
        if (pnlTab && pnlTab.style.display !== 'none') {
            this.refreshPnL();
        }
    },

    /**
     * Refresh categories in dropdowns
     */
    refreshCategories() {
        const categories = Database.getCategories();
        UI.populateCategoryDropdown(categories);
        UI.populateFilterCategories(categories);
        UI.populateFilterFolders(Database.getFolders());
    },

    /**
     * Refresh transactions list
     */
    refreshTransactions() {
        const filters = this.getActiveFilters();
        const transactions = Database.getTransactions(filters);

        UI.renderTransactions(transactions, this.currentSortMode);

        const allTransactions = Database.getTransactions();
        const months = Utils.getUniqueMonths(allTransactions);
        UI.populateFilterMonths(months);
    },

    /**
     * Refresh summary calculations
     */
    refreshSummary() {
        const summary = Database.calculateSummary();
        UI.updateSummary(summary);
    },

    /**
     * Refresh cash flow spreadsheet tab
     */
    refreshCashFlow() {
        const data = Database.getCashFlowSpreadsheet();
        UI.renderCashFlowSpreadsheet(data);
        this.setupCashFlowDragDrop();
    },

    /**
     * Set up drag-and-drop for cashflow category rows
     */
    setupCashFlowDragDrop() {
        const container = document.getElementById('cashflowSpreadsheet');
        if (!container || container.dataset.dragSetup) return;
        container.dataset.dragSetup = '1';

        let draggedRow = null;

        container.addEventListener('dragstart', (e) => {
            const row = e.target.closest('tr[draggable="true"]');
            if (!row) return;
            draggedRow = row;
            row.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', row.dataset.categoryId);
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const row = e.target.closest('tr[draggable="true"]');
            if (!row || row === draggedRow || !draggedRow) return;
            if (row.dataset.section !== draggedRow.dataset.section) return;
            e.dataTransfer.dropEffect = 'move';
            container.querySelectorAll(`tr[data-section="${draggedRow.dataset.section}"].drag-over`)
                .forEach(r => r.classList.remove('drag-over'));
            row.classList.add('drag-over');
        });

        container.addEventListener('dragleave', (e) => {
            const row = e.target.closest('tr[draggable="true"]');
            if (row) row.classList.remove('drag-over');
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetRow = e.target.closest('tr[draggable="true"]');
            if (!targetRow || !draggedRow || targetRow === draggedRow) return;
            if (targetRow.dataset.section !== draggedRow.dataset.section) return;

            const parent = draggedRow.parentNode;
            parent.insertBefore(draggedRow, targetRow);

            const section = draggedRow.dataset.section;
            const rows = parent.querySelectorAll(`tr[data-section="${section}"]`);
            const orderList = [];
            rows.forEach((row, index) => {
                orderList.push({ id: parseInt(row.dataset.categoryId), sortOrder: index });
            });

            Database.updateCashflowSortOrder(orderList);
            targetRow.classList.remove('drag-over');
        });

        container.addEventListener('dragend', () => {
            if (draggedRow) {
                draggedRow.classList.remove('dragging');
                draggedRow = null;
            }
            container.querySelectorAll('.drag-over').forEach(r => r.classList.remove('drag-over'));
        });
    },

    /**
     * Refresh P&L spreadsheet
     */
    refreshPnL() {
        const plData = Database.getPLSpreadsheet();
        const overrides = Database.getAllPLOverrides();
        const taxMode = Database.getPLTaxMode();
        // Sync dropdown
        const taxModeSelect = document.getElementById('plTaxMode');
        if (taxModeSelect) taxModeSelect.value = taxMode;
        UI.renderProfitLossSpreadsheet(plData, overrides, taxMode);
        this.setupPnLCellEditing();
    },

    /**
     * Set up inline cell editing for P&L spreadsheet (only binds once)
     */
    setupPnLCellEditing() {
        const container = document.getElementById('pnlSpreadsheet');
        if (!container || container.dataset.pnlEditing) return;
        container.dataset.pnlEditing = '1';

        container.addEventListener('click', (e) => {
            const cell = e.target.closest('.pnl-editable');
            if (!cell || cell.querySelector('.pnl-cell-input')) return;

            const catId = parseInt(cell.dataset.catId);
            const month = cell.dataset.month;

            // Get current displayed value (strip currency formatting)
            const currentText = cell.textContent.replace(/[^0-9.\-]/g, '');
            const currentVal = parseFloat(currentText) || 0;

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'pnl-cell-input';
            input.step = '0.01';
            input.value = currentVal;

            cell.textContent = '';
            cell.appendChild(input);
            input.focus();
            input.select();

            const save = () => {
                const newVal = input.value.trim();
                if (newVal === '' || newVal === currentText) {
                    // No change or cleared - remove override if cleared
                    if (newVal === '') {
                        Database.setPLOverride(catId, month, null);
                    }
                } else {
                    Database.setPLOverride(catId, month, parseFloat(newVal));
                }
                this.refreshPnL();
            };

            input.addEventListener('blur', save);
            input.addEventListener('keydown', (ke) => {
                if (ke.key === 'Enter') {
                    ke.preventDefault();
                    input.blur();
                } else if (ke.key === 'Escape') {
                    ke.preventDefault();
                    // Cancel - just re-render without saving
                    this.refreshPnL();
                }
            });
        });
    },

    /**
     * Switch between Journal, Cash Flow, and P&L tabs
     * @param {string} tab - 'journal', 'cashflow', or 'pnl'
     */
    switchMainTab(tab) {
        document.querySelectorAll('.main-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        const journalTab = document.getElementById('journalTab');
        const cashflowTab = document.getElementById('cashflowTab');
        const pnlTab = document.getElementById('pnlTab');

        journalTab.style.display = 'none';
        cashflowTab.style.display = 'none';
        pnlTab.style.display = 'none';

        if (tab === 'cashflow') {
            cashflowTab.style.display = 'block';
            this.refreshCashFlow();
        } else if (tab === 'pnl') {
            pnlTab.style.display = 'block';
            this.refreshPnL();
        } else {
            journalTab.style.display = 'block';
        }
    },

    /**
     * Get active filter values
     * @returns {Object} Filter object
     */
    getActiveFilters() {
        return {
            type: document.getElementById('filterType').value || null,
            status: document.getElementById('filterStatus').value || null,
            month: document.getElementById('filterMonth').value || null,
            folderId: document.getElementById('filterFolder').value || null,
            categoryId: document.getElementById('filterCategory').value || null
        };
    },

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // ==================== ENTRY FORM ====================

        // Entry form submission
        document.getElementById('entryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // New Entry button - open empty form modal
        document.getElementById('newEntryBtn').addEventListener('click', () => {
            UI.resetForm(); // Reset first (this also closes modal)
            document.getElementById('entryDate').value = Utils.getTodayDate();
            document.getElementById('formTitle').textContent = 'Add New Entry';
            document.getElementById('submitBtn').textContent = 'Add Entry';
            UI.showModal('entryModal');
        });

        // Cancel edit button - close modal
        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            UI.resetForm();
        });

        // Transaction type radio change
        document.querySelectorAll('input[name="transactionType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                UI.updateStatusOptions(e.target.value);
                // Reset to pending when type changes
                document.getElementById('status').value = 'pending';
                UI.updateFormFieldVisibility('pending');
                // Show/hide pretax amount field
                const pretaxGroup = document.getElementById('pretaxAmountGroup');
                if (e.target.value === 'receivable') {
                    pretaxGroup.style.display = 'flex';
                } else {
                    pretaxGroup.style.display = 'none';
                    document.getElementById('pretaxAmount').value = '';
                }
            });
        });

        // Status change in form - show/hide dateProcessed and monthPaid
        document.getElementById('status').addEventListener('change', (e) => {
            UI.updateFormFieldVisibility(e.target.value);
        });

        // Date processed change - auto-fill month paid
        document.getElementById('dateProcessed').addEventListener('change', (e) => {
            if (e.target.value) {
                const [year, month] = e.target.value.split('-');
                document.getElementById('monthPaidMonth').value = month;
                document.getElementById('monthPaidYear').value = year;
            }
        });

        // Today button
        document.getElementById('todayBtn').addEventListener('click', () => {
            document.getElementById('entryDate').value = Utils.getTodayDate();
        });

        // Category change - auto-fill defaults and show/hide payment for month field
        document.getElementById('category').addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (!selectedOption || !selectedOption.value) return;

            // Auto-fill default amount if set and amount field is empty
            const defaultAmount = selectedOption.dataset.defaultAmount;
            const amountField = document.getElementById('amount');
            if (defaultAmount && (!amountField.value || amountField.value === '0')) {
                amountField.value = defaultAmount;
            }

            // Auto-fill default type if set
            const defaultType = selectedOption.dataset.defaultType;
            if (defaultType) {
                const typeRadio = document.querySelector(`input[name="transactionType"][value="${defaultType}"]`);
                if (typeRadio) {
                    typeRadio.checked = true;
                    UI.updateStatusOptions(defaultType);
                    document.getElementById('status').value = 'pending';
                    UI.updateFormFieldVisibility('pending');
                }
            }

            // Show/hide payment for month field
            if (selectedOption.dataset.isMonthly === '1') {
                UI.togglePaymentForMonth(true, selectedOption.textContent);
            } else {
                UI.togglePaymentForMonth(false);
            }
        });

        // ==================== JOURNAL OWNER ====================

        // Journal owner name change - save and update title
        const journalOwnerInput = document.getElementById('journalOwner');
        journalOwnerInput.addEventListener('input', Utils.debounce(() => {
            const owner = journalOwnerInput.value.trim();
            Database.setJournalOwner(owner);
            UI.updateJournalTitle(owner);
        }, 500));

        // Auto-size the owner input
        journalOwnerInput.addEventListener('input', () => {
            const length = journalOwnerInput.value.length;
            journalOwnerInput.style.width = Math.max(120, (length + 2) * 14) + 'px';
        });
        // Set initial width
        const initLength = journalOwnerInput.value.length;
        if (initLength > 0) {
            journalOwnerInput.style.width = Math.max(120, (initLength + 2) * 14) + 'px';
        }

        // ==================== CATEGORIES ====================

        // Add category button (from form)
        document.getElementById('addCategoryBtn').addEventListener('click', () => {
            this.openCategoryModal();
        });

        // Category form submission (handles both add and edit)
        document.getElementById('categoryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSaveCategory();
        });

        // Cancel category button
        document.getElementById('cancelCategoryBtn').addEventListener('click', () => {
            const wasEditing = !!document.getElementById('editingCategoryId').value;
            UI.hideModal('categoryModal');
            this.resetCategoryForm();
            if (wasEditing) {
                this.openManageCategories();
            }
        });

        // Manage Categories button
        document.getElementById('manageCategoriesBtn').addEventListener('click', () => {
            this.openManageCategories();
        });

        // Close manage categories
        document.getElementById('closeManageCategoriesBtn').addEventListener('click', () => {
            UI.hideModal('manageCategoriesModal');
        });

        // Add new category from manage modal
        document.getElementById('addNewCategoryFromManageBtn').addEventListener('click', () => {
            UI.hideModal('manageCategoriesModal');
            this.openCategoryModal();
        });

        // Add new folder from manage modal
        document.getElementById('addNewFolderBtn').addEventListener('click', () => {
            UI.hideModal('manageCategoriesModal');
            this.openFolderModal();
        });

        // Add folder from category modal (opens folder modal)
        document.getElementById('addFolderFromCategoryBtn').addEventListener('click', () => {
            this.folderCreatedFromCategory = true;
            UI.hideModal('categoryModal');
            this.openFolderModal();
        });

        // Enforce folder type on category default type
        document.getElementById('categoryFolder').addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const folderType = selectedOption ? selectedOption.dataset.folderType : null;
            const defaultTypeSelect = document.getElementById('categoryDefaultType');

            if (folderType && folderType !== 'none') {
                defaultTypeSelect.value = folderType;
                defaultTypeSelect.disabled = true;
            } else {
                defaultTypeSelect.disabled = false;
            }
        });

        // Category edit/delete clicks (delegated) - also handles folder clicks
        document.getElementById('categoriesList').addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-category-btn');
            const deleteBtn = e.target.closest('.delete-category-btn');
            const editFolderBtn = e.target.closest('.edit-folder-btn');
            const deleteFolderBtn = e.target.closest('.delete-folder-btn');
            const folderHeader = e.target.closest('.folder-header');

            if (editBtn && !editBtn.disabled) {
                this.handleEditCategory(parseInt(editBtn.dataset.id));
            } else if (deleteBtn && !deleteBtn.disabled) {
                this.handleDeleteCategory(parseInt(deleteBtn.dataset.id));
            } else if (editFolderBtn) {
                e.stopPropagation();
                this.handleEditFolder(parseInt(editFolderBtn.dataset.id));
            } else if (deleteFolderBtn) {
                e.stopPropagation();
                this.handleDeleteFolder(parseInt(deleteFolderBtn.dataset.id));
            } else if (folderHeader && !e.target.closest('.folder-actions')) {
                // Toggle folder collapse
                const folderId = folderHeader.dataset.folderId;
                const children = document.querySelector(`.folder-children[data-folder-id="${folderId}"]`);
                const toggle = folderHeader.querySelector('.folder-toggle');
                if (children) children.classList.toggle('collapsed');
                if (toggle) toggle.classList.toggle('collapsed');
            }
        });

        // Delete category confirmation
        document.getElementById('confirmDeleteCategoryBtn').addEventListener('click', () => {
            this.confirmDeleteCategory();
        });

        document.getElementById('cancelDeleteCategoryBtn').addEventListener('click', () => {
            UI.hideModal('deleteCategoryModal');
            this.deleteCategoryTargetId = null;
        });

        // Folder form submission
        document.getElementById('folderForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSaveFolder();
        });

        // Cancel folder button
        document.getElementById('cancelFolderBtn').addEventListener('click', () => {
            UI.hideModal('folderModal');
            if (this.folderCreatedFromCategory) {
                this.folderCreatedFromCategory = false;
                UI.showModal('categoryModal');
            }
        });

        // Delete folder confirmation
        document.getElementById('confirmDeleteFolderBtn').addEventListener('click', () => {
            this.confirmDeleteFolder();
        });

        document.getElementById('cancelDeleteFolderBtn').addEventListener('click', () => {
            UI.hideModal('deleteFolderModal');
            this.deleteFolderTargetId = null;
        });

        // ==================== TRANSACTIONS ====================

        // Transaction actions (edit/delete) - delegated
        document.getElementById('transactionsContainer').addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            const notesIndicator = e.target.closest('.notes-indicator');

            if (editBtn) {
                this.handleEditTransaction(parseInt(editBtn.dataset.id));
            } else if (deleteBtn) {
                this.handleDeleteTransaction(parseInt(deleteBtn.dataset.id));
            } else if (notesIndicator) {
                // Toggle notes tooltip on click
                const tooltip = document.getElementById('notesTooltip');
                if (tooltip.classList.contains('visible') && tooltip.textContent === notesIndicator.dataset.notes) {
                    UI.hideNotesTooltip();
                } else {
                    UI.showNotesTooltip(notesIndicator.dataset.notes, notesIndicator);
                }
            }
        });

        // Notes tooltip on hover
        document.getElementById('transactionsContainer').addEventListener('mouseover', (e) => {
            const notesIndicator = e.target.closest('.notes-indicator');
            if (notesIndicator) {
                UI.showNotesTooltip(notesIndicator.dataset.notes, notesIndicator);
            }
        });

        document.getElementById('transactionsContainer').addEventListener('mouseout', (e) => {
            const notesIndicator = e.target.closest('.notes-indicator');
            if (notesIndicator) {
                UI.hideNotesTooltip();
            }
        });

        // Inline status dropdown change
        document.getElementById('transactionsContainer').addEventListener('change', (e) => {
            if (e.target.classList.contains('status-select')) {
                const id = parseInt(e.target.dataset.id);
                const newStatus = e.target.value;
                this.handleInlineStatusChange(id, newStatus, e.target);
            }
        });

        // Delete transaction confirmation
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            this.confirmDelete();
        });

        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            UI.hideModal('deleteModal');
            this.deleteTargetId = null;
        });

        // ==================== MONTH PAID PROMPT (inline) ====================

        document.getElementById('confirmMonthPaidPromptBtn').addEventListener('click', () => {
            this.confirmMonthPaidPrompt();
        });

        document.getElementById('cancelMonthPaidPromptBtn').addEventListener('click', () => {
            this.cancelMonthPaidPrompt();
        });

        // ==================== FILTERS & SORT ====================

        // Sort mode change
        document.getElementById('sortMode').addEventListener('change', (e) => {
            this.currentSortMode = e.target.value;
            this.refreshTransactions();
        });

        ['filterType', 'filterStatus', 'filterMonth', 'filterCategory'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.refreshTransactions();
            });
        });

        // Folder filter - cascades to category filter
        document.getElementById('filterFolder').addEventListener('change', () => {
            const folderId = document.getElementById('filterFolder').value;
            const categories = Database.getCategories();

            // Filter category dropdown to show only categories in selected folder
            if (folderId === 'unfiled') {
                const unfiled = categories.filter(c => !c.folder_id);
                UI.populateFilterCategories(unfiled);
            } else if (folderId) {
                const folderCats = categories.filter(c => c.folder_id === parseInt(folderId));
                UI.populateFilterCategories(folderCats);
            } else {
                UI.populateFilterCategories(categories);
            }

            document.getElementById('filterCategory').value = '';
            this.refreshTransactions();
        });

        // ==================== SAVE / LOAD ====================

        document.getElementById('saveDbBtn').addEventListener('click', () => {
            this.handleSaveDatabase();
        });

        document.getElementById('saveAsDbBtn').addEventListener('click', () => {
            this.handleSaveAsDatabase();
        });

        document.getElementById('loadDbBtn').addEventListener('click', () => {
            document.getElementById('loadDbInput').click();
        });

        document.getElementById('loadDbInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.pendingFileLoad = e.target.files[0];
                UI.showModal('loadConfirmModal');
            }
        });

        document.getElementById('confirmLoadBtn').addEventListener('click', () => {
            this.confirmLoadDatabase();
        });

        document.getElementById('cancelLoadBtn').addEventListener('click', () => {
            UI.hideModal('loadConfirmModal');
            this.pendingFileLoad = null;
            document.getElementById('loadDbInput').value = '';
        });

        // Save As modal (fallback)
        document.getElementById('confirmSaveAsBtn').addEventListener('click', () => {
            this.confirmSaveAs();
        });

        document.getElementById('cancelSaveAsBtn').addEventListener('click', () => {
            UI.hideModal('saveAsModal');
        });

        // ==================== MAIN TABS ====================

        document.querySelectorAll('.main-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchMainTab(btn.dataset.tab);
            });
        });

        // P&L Tax Mode dropdown
        document.getElementById('plTaxMode').addEventListener('change', (e) => {
            Database.setPLTaxMode(e.target.value);
            this.refreshPnL();
        });

        // ==================== ADD FOLDER ENTRIES ====================

        document.getElementById('addFolderEntriesBtn').addEventListener('click', () => {
            this.openAddFolderEntriesModal();
        });

        document.getElementById('bulkFolder').addEventListener('change', () => {
            this.updateBulkStatusOptions();
            this.updateBulkPreview();
        });

        document.getElementById('bulkMonth').addEventListener('change', () => {
            this.updateBulkPreview();
        });

        document.getElementById('bulkYear').addEventListener('change', () => {
            this.updateBulkPreview();
        });

        document.getElementById('bulkStatus').addEventListener('change', (e) => {
            this.toggleBulkProcessedFields(e.target.value);
            this.updateBulkPreview();
        });

        document.getElementById('confirmBulkBtn').addEventListener('click', () => {
            this.confirmAddFolderEntries();
        });

        document.getElementById('cancelBulkBtn').addEventListener('click', () => {
            UI.hideModal('addFolderEntriesModal');
        });

        // ==================== EXPORT ====================

        document.getElementById('exportCsvBtn').addEventListener('click', () => {
            this.handleExportCsv();
        });

        // ==================== MODALS & KEYBOARD ====================

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    if (modal.id === 'entryModal') {
                        UI.resetForm();
                    } else {
                        UI.hideModal(modal.id);
                    }
                    // Cancel pending inline status change if month paid prompt is closed
                    if (modal.id === 'monthPaidPromptModal') {
                        this.cancelMonthPaidPrompt();
                    }
                }
            });
        });

        // Click outside tooltip to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.notes-indicator') && !e.target.closest('.notes-tooltip')) {
                UI.hideNotesTooltip();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModals = document.querySelectorAll('.modal.active');
                activeModals.forEach(modal => {
                    if (modal.id === 'entryModal') {
                        UI.resetForm();
                    } else {
                        UI.hideModal(modal.id);
                    }
                    if (modal.id === 'monthPaidPromptModal') {
                        this.cancelMonthPaidPrompt();
                    }
                });
                UI.hideNotesTooltip();
            }
        });
    },

    // ==================== FORM HANDLERS ====================

    /**
     * Handle form submission (add/edit transaction)
     */
    handleFormSubmit() {
        const data = UI.getFormData();
        const validation = UI.validateFormData(data);

        if (!validation.valid) {
            UI.showNotification(validation.message, 'error');
            return;
        }

        const editingId = document.getElementById('editingId').value;

        try {
            if (editingId) {
                Database.updateTransaction(parseInt(editingId), data);
                UI.showNotification('Transaction updated successfully', 'success');
            } else {
                Database.addTransaction(data);
                UI.showNotification('Transaction added successfully', 'success');
            }

            UI.resetForm(); // This also closes the entry modal
            this.refreshAll();
        } catch (error) {
            console.error('Error saving transaction:', error);
            UI.showNotification('Failed to save transaction', 'error');
        }
    },

    // ==================== CATEGORY HANDLERS ====================

    /**
     * Open category modal for adding (resets the form)
     */
    openCategoryModal() {
        this.resetCategoryForm();
        document.getElementById('categoryModalTitle').textContent = 'Add New Category';
        document.getElementById('saveCategoryBtn').textContent = 'Add Category';
        UI.populateFolderDropdown(Database.getFolders());
        document.getElementById('categoryDefaultType').disabled = false;
        UI.showModal('categoryModal');
        document.getElementById('categoryName').focus();
    },

    /**
     * Reset the category form
     */
    resetCategoryForm() {
        document.getElementById('categoryForm').reset();
        document.getElementById('editingCategoryId').value = '';
        document.getElementById('categoryDefaultAmount').value = '';
        document.getElementById('categoryDefaultType').value = '';
        document.getElementById('categoryDefaultType').disabled = false;
        document.getElementById('categoryFolder').value = '';
        document.getElementById('categoryShowOnPl').checked = false;
        document.getElementById('categoryCogs').checked = false;
        document.getElementById('categoryDepreciation').checked = false;
    },

    /**
     * Handle saving a category (add or edit)
     */
    handleSaveCategory() {
        const nameInput = document.getElementById('categoryName');
        const name = nameInput.value.trim();
        const isMonthly = document.getElementById('categoryMonthly').checked;
        const editingId = document.getElementById('editingCategoryId').value;

        const defaultAmountRaw = document.getElementById('categoryDefaultAmount').value;
        const defaultAmount = defaultAmountRaw ? parseFloat(defaultAmountRaw) : null;
        const defaultType = document.getElementById('categoryDefaultType').value || null;
        const folderIdRaw = document.getElementById('categoryFolder').value;
        const folderId = folderIdRaw ? parseInt(folderIdRaw) : null;

        const showOnPl = document.getElementById('categoryShowOnPl').checked;
        const isCogs = document.getElementById('categoryCogs').checked;
        const isDepreciation = document.getElementById('categoryDepreciation').checked;

        if (!name) {
            UI.showNotification('Please enter a category name', 'error');
            return;
        }

        try {
            if (editingId) {
                // Update existing category
                Database.updateCategory(parseInt(editingId), name, isMonthly, defaultAmount, defaultType, folderId, showOnPl, isCogs, isDepreciation);
                UI.showNotification('Category updated successfully', 'success');
            } else {
                // Add new category
                const newId = Database.addCategory(name, isMonthly, defaultAmount, defaultType, folderId, showOnPl, isCogs, isDepreciation);
                // Select the new category in the dropdown
                this.refreshCategories();
                document.getElementById('category').value = newId;

                if (isMonthly) {
                    UI.togglePaymentForMonth(true, name);
                }

                UI.showNotification('Category added successfully', 'success');
            }

            const wasEditing = !!editingId;
            UI.hideModal('categoryModal');
            this.resetCategoryForm();
            this.refreshCategories();

            // If we were editing (came from manage modal), re-open manage categories
            if (wasEditing || document.getElementById('manageCategoriesModal').classList.contains('active')) {
                this.openManageCategories();
            }
        } catch (error) {
            console.error('Error saving category:', error);
            if (error.message && error.message.includes('UNIQUE')) {
                UI.showNotification('A category with this name already exists', 'error');
            } else {
                UI.showNotification('Failed to save category', 'error');
            }
        }
    },

    /**
     * Open manage categories modal
     */
    openManageCategories() {
        const categories = Database.getCategories();
        UI.renderManageCategoriesList(categories);
        UI.showModal('manageCategoriesModal');
    },

    /**
     * Handle editing a category
     * @param {number} id - Category ID
     */
    handleEditCategory(id) {
        const category = Database.getCategoryById(id);
        if (!category) return;

        UI.hideModal('manageCategoriesModal');

        // Populate folder dropdown first
        UI.populateFolderDropdown(Database.getFolders());

        // Populate category form for editing
        document.getElementById('editingCategoryId').value = category.id;
        document.getElementById('categoryName').value = category.name;
        document.getElementById('categoryMonthly').checked = !!category.is_monthly;
        document.getElementById('categoryDefaultAmount').value = category.default_amount || '';
        document.getElementById('categoryDefaultType').value = category.default_type || '';
        document.getElementById('categoryFolder').value = category.folder_id || '';
        // P&L flags
        document.getElementById('categoryShowOnPl').checked = !!category.show_on_pl;
        document.getElementById('categoryCogs').checked = !!category.is_cogs;
        document.getElementById('categoryDepreciation').checked = !!category.is_depreciation;

        document.getElementById('categoryModalTitle').textContent = 'Edit Category';
        document.getElementById('saveCategoryBtn').textContent = 'Save Changes';

        // Enforce folder type on default type
        const defaultTypeSelect = document.getElementById('categoryDefaultType');
        if (category.folder_id) {
            const folderOption = document.querySelector(`#categoryFolder option[value="${category.folder_id}"]`);
            const folderType = folderOption ? folderOption.dataset.folderType : null;
            if (folderType && folderType !== 'none') {
                defaultTypeSelect.value = folderType;
                defaultTypeSelect.disabled = true;
            } else {
                defaultTypeSelect.disabled = false;
            }
        } else {
            defaultTypeSelect.disabled = false;
        }

        UI.showModal('categoryModal');
        document.getElementById('categoryName').focus();
    },

    /**
     * Handle deleting a category (show confirmation)
     * @param {number} id - Category ID
     */
    handleDeleteCategory(id) {
        const category = Database.getCategoryById(id);
        if (!category) return;

        this.deleteCategoryTargetId = id;
        document.getElementById('deleteCategoryMessage').textContent =
            `Are you sure you want to delete "${category.name}"?`;
        UI.showModal('deleteCategoryModal');
    },

    /**
     * Confirm and execute category delete
     */
    confirmDeleteCategory() {
        if (this.deleteCategoryTargetId) {
            try {
                const success = Database.deleteCategory(this.deleteCategoryTargetId);
                if (success) {
                    UI.showNotification('Category deleted', 'success');
                    this.refreshCategories();
                    // Refresh manage categories list
                    if (document.getElementById('manageCategoriesModal').classList.contains('active')) {
                        this.openManageCategories();
                    }
                } else {
                    UI.showNotification('Cannot delete category that is in use', 'error');
                }
            } catch (error) {
                console.error('Error deleting category:', error);
                UI.showNotification('Failed to delete category', 'error');
            }
        }

        UI.hideModal('deleteCategoryModal');
        this.deleteCategoryTargetId = null;
    },

    // ==================== FOLDER HANDLERS ====================

    /**
     * Open folder modal for adding
     */
    openFolderModal() {
        document.getElementById('folderForm').reset();
        document.getElementById('editingFolderId').value = '';
        document.getElementById('folderModalTitle').textContent = 'Add New Folder';
        document.getElementById('saveFolderBtn').textContent = 'Add Folder';
        document.querySelector('input[name="folderType"][value="none"]').checked = true;
        UI.showModal('folderModal');
        document.getElementById('folderName').focus();
    },

    /**
     * Handle saving a folder (add or edit)
     */
    handleSaveFolder() {
        const name = document.getElementById('folderName').value.trim();
        const editingId = document.getElementById('editingFolderId').value;
        const folderType = document.querySelector('input[name="folderType"]:checked').value;

        if (!name) {
            UI.showNotification('Please enter a folder name', 'error');
            return;
        }

        try {
            let newFolderId = null;
            if (editingId) {
                Database.updateFolder(parseInt(editingId), name, folderType);
                UI.showNotification('Folder updated', 'success');
            } else {
                newFolderId = Database.addFolder(name, folderType);
                UI.showNotification('Folder created', 'success');
            }

            UI.hideModal('folderModal');
            this.refreshCategories();

            // If folder was created from category modal, return there with folder pre-selected
            if (this.folderCreatedFromCategory && newFolderId) {
                this.folderCreatedFromCategory = false;
                UI.populateFolderDropdown(Database.getFolders());
                document.getElementById('categoryFolder').value = newFolderId;
                // Enforce the new folder's type on the category default type
                if (folderType && folderType !== 'none') {
                    document.getElementById('categoryDefaultType').value = folderType;
                    document.getElementById('categoryDefaultType').disabled = true;
                } else {
                    document.getElementById('categoryDefaultType').disabled = false;
                }
                UI.showModal('categoryModal');
            } else {
                this.folderCreatedFromCategory = false;
                this.openManageCategories();
            }
        } catch (error) {
            console.error('Error saving folder:', error);
            if (error.message && error.message.includes('UNIQUE')) {
                UI.showNotification('A folder with this name already exists', 'error');
            } else {
                UI.showNotification('Failed to save folder', 'error');
            }
        }
    },

    /**
     * Handle editing a folder
     * @param {number} id - Folder ID
     */
    handleEditFolder(id) {
        const folder = Database.getFolderById(id);
        if (!folder) return;

        document.getElementById('editingFolderId').value = folder.id;
        document.getElementById('folderName').value = folder.name;
        const typeRadio = document.querySelector(`input[name="folderType"][value="${folder.folder_type || 'payable'}"]`);
        if (typeRadio) typeRadio.checked = true;
        document.getElementById('folderModalTitle').textContent = 'Edit Folder';
        document.getElementById('saveFolderBtn').textContent = 'Save Changes';

        UI.showModal('folderModal');
        document.getElementById('folderName').focus();
    },

    /**
     * Handle deleting a folder (show confirmation)
     * @param {number} id - Folder ID
     */
    handleDeleteFolder(id) {
        const folder = Database.getFolderById(id);
        if (!folder) return;

        this.deleteFolderTargetId = id;
        document.getElementById('deleteFolderMessage').textContent =
            `Are you sure you want to delete "${folder.name}"? Categories in this folder will become unfiled.`;
        UI.showModal('deleteFolderModal');
    },

    /**
     * Confirm and execute folder delete
     */
    confirmDeleteFolder() {
        if (this.deleteFolderTargetId) {
            try {
                Database.deleteFolder(this.deleteFolderTargetId);
                UI.showNotification('Folder deleted', 'success');
                this.refreshCategories();

                if (document.getElementById('manageCategoriesModal').classList.contains('active')) {
                    this.openManageCategories();
                }
            } catch (error) {
                console.error('Error deleting folder:', error);
                UI.showNotification('Failed to delete folder', 'error');
            }
        }

        UI.hideModal('deleteFolderModal');
        this.deleteFolderTargetId = null;
    },

    // ==================== TRANSACTION HANDLERS ====================

    /**
     * Handle inline status change from table dropdown
     * @param {number} id - Transaction ID
     * @param {string} newStatus - New status value
     * @param {HTMLElement} selectElement - The select element
     */
    handleInlineStatusChange(id, newStatus, selectElement) {
        if (newStatus === 'pending') {
            // Reverting to pending - clear processed date and month paid
            try {
                Database.updateTransactionStatus(id, newStatus);
                selectElement.className = `status-select status-${newStatus}`;
                this.refreshSummary();
                this.refreshTransactions();
                if (document.getElementById('cashflowTab').style.display !== 'none') this.refreshCashFlow();
                if (document.getElementById('pnlTab').style.display !== 'none') this.refreshPnL();
                UI.showNotification('Status updated', 'success');
            } catch (error) {
                console.error('Error updating status:', error);
                UI.showNotification('Failed to update status', 'error');
                this.refreshTransactions();
            }
        } else {
            // Changing to paid/received - prompt for month paid
            this.pendingInlineStatusChange = { id, newStatus, selectElement };

            // Pre-fill with current month
            const currentMonth = Utils.getCurrentMonth();
            const [year, month] = currentMonth.split('-');
            document.getElementById('promptMonthPaidMonth').value = month;
            document.getElementById('promptMonthPaidYear').value = year;

            // Update prompt title
            const title = newStatus === 'paid' ? 'Month Paid' : 'Month Received';
            document.getElementById('monthPaidPromptTitle').textContent = title;

            UI.showModal('monthPaidPromptModal');
        }
    },

    /**
     * Confirm the month paid prompt for inline status change
     */
    confirmMonthPaidPrompt() {
        const promptMonth = document.getElementById('promptMonthPaidMonth').value;
        const promptYear = document.getElementById('promptMonthPaidYear').value;

        if (!promptMonth || !promptYear) {
            UI.showNotification('Please select both month and year', 'error');
            return;
        }

        const monthPaid = `${promptYear}-${promptMonth}`;

        if (this.pendingInlineStatusChange) {
            const { id, newStatus, selectElement } = this.pendingInlineStatusChange;
            try {
                Database.updateTransactionStatus(id, newStatus, monthPaid);
                selectElement.className = `status-select status-${newStatus}`;
                this.refreshSummary();
                this.refreshTransactions();
                if (document.getElementById('cashflowTab').style.display !== 'none') this.refreshCashFlow();
                if (document.getElementById('pnlTab').style.display !== 'none') this.refreshPnL();
                UI.showNotification('Status updated', 'success');
            } catch (error) {
                console.error('Error updating status:', error);
                UI.showNotification('Failed to update status', 'error');
                this.refreshTransactions();
            }
        }

        UI.hideModal('monthPaidPromptModal');
        this.pendingInlineStatusChange = null;
    },

    /**
     * Cancel the month paid prompt - revert the select
     */
    cancelMonthPaidPrompt() {
        if (this.pendingInlineStatusChange) {
            // Revert the select element to previous status
            this.refreshTransactions();
        }
        UI.hideModal('monthPaidPromptModal');
        this.pendingInlineStatusChange = null;
    },

    /**
     * Handle edit transaction
     * @param {number} id - Transaction ID
     */
    handleEditTransaction(id) {
        const transaction = Database.getTransactionById(id);
        if (transaction) {
            UI.populateFormForEdit(transaction);
        }
    },

    /**
     * Handle delete transaction (show confirmation)
     * @param {number} id - Transaction ID
     */
    handleDeleteTransaction(id) {
        this.deleteTargetId = id;
        UI.showModal('deleteModal');
    },

    /**
     * Confirm and execute delete
     */
    confirmDelete() {
        if (this.deleteTargetId) {
            try {
                Database.deleteTransaction(this.deleteTargetId);
                UI.showNotification('Transaction deleted', 'success');
                this.refreshAll();
            } catch (error) {
                console.error('Error deleting transaction:', error);
                UI.showNotification('Failed to delete transaction', 'error');
            }
        }

        UI.hideModal('deleteModal');
        this.deleteTargetId = null;
    },

    // ==================== ADD FOLDER ENTRIES ====================

    /**
     * Open the Add Folder Entries modal
     */
    openAddFolderEntriesModal() {
        const folders = Database.getFolders();
        const select = document.getElementById('bulkFolder');
        select.innerHTML = '<option value="">Select folder...</option>';
        folders.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = `${f.name} (${UI.capitalizeFirst(f.folder_type)})`;
            opt.dataset.folderType = f.folder_type;
            select.appendChild(opt);
        });

        // Populate year dropdowns
        const years = Utils.generateYearOptions();
        ['bulkYear', 'bulkMonthPaidYear'].forEach(selectId => {
            const yearSelect = document.getElementById(selectId);
            yearSelect.innerHTML = '<option value="">Year...</option>';
            years.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y;
                yearSelect.appendChild(opt);
            });
        });

        // Pre-fill with current month/year
        const currentMonth = Utils.getCurrentMonth();
        const [curYear, curMonth] = currentMonth.split('-');
        document.getElementById('bulkMonth').value = curMonth;
        document.getElementById('bulkYear').value = curYear;

        // Pre-fill entry date with today
        document.getElementById('bulkEntryDate').value = Utils.getTodayDate();

        // Reset status and hide processed fields
        document.getElementById('bulkStatus').innerHTML = '<option value="pending">Pending</option>';
        document.getElementById('bulkStatus').value = 'pending';
        this.toggleBulkProcessedFields('pending');

        // Reset preview and button
        document.getElementById('bulkPreview').innerHTML = '';
        document.getElementById('confirmBulkBtn').disabled = true;

        UI.showModal('addFolderEntriesModal');
    },

    /**
     * Update bulk status dropdown options based on selected folder type
     */
    updateBulkStatusOptions() {
        const select = document.getElementById('bulkFolder');
        const selectedOption = select.options[select.selectedIndex];
        const folderType = selectedOption ? selectedOption.dataset.folderType : null;
        const statusSelect = document.getElementById('bulkStatus');

        if (!folderType) {
            statusSelect.innerHTML = '<option value="pending">Pending</option>';
            statusSelect.value = 'pending';
            this.toggleBulkProcessedFields('pending');
            return;
        }

        if (folderType === 'receivable') {
            statusSelect.innerHTML = `
                <option value="pending">Pending</option>
                <option value="received">Received</option>
            `;
            document.getElementById('bulkMonthPaidLabel').textContent = 'Month Received';
        } else if (folderType === 'payable') {
            statusSelect.innerHTML = `
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
            `;
            document.getElementById('bulkMonthPaidLabel').textContent = 'Month Paid';
        } else {
            // 'none' type - show all options
            statusSelect.innerHTML = `
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="received">Received</option>
            `;
            document.getElementById('bulkMonthPaidLabel').textContent = 'Month Paid/Received';
        }

        statusSelect.value = 'pending';
        this.toggleBulkProcessedFields('pending');
    },

    /**
     * Show/hide date processed and month paid fields in bulk modal
     * @param {string} status - 'pending', 'paid', or 'received'
     */
    toggleBulkProcessedFields(status) {
        const dateProcessedGroup = document.getElementById('bulkDateProcessedGroup');
        const monthPaidGroup = document.getElementById('bulkMonthPaidGroup');

        if (status === 'pending') {
            dateProcessedGroup.style.display = 'none';
            monthPaidGroup.style.display = 'none';
            document.getElementById('bulkDateProcessed').value = '';
            document.getElementById('bulkMonthPaid').value = '';
            document.getElementById('bulkMonthPaidYear').value = '';
        } else {
            dateProcessedGroup.style.display = 'flex';
            monthPaidGroup.style.display = 'flex';
        }
    },

    /**
     * Update the bulk add preview when folder or month changes
     */
    updateBulkPreview() {
        const folderId = document.getElementById('bulkFolder').value;
        const month = document.getElementById('bulkMonth').value;
        const year = document.getElementById('bulkYear').value;
        const status = document.getElementById('bulkStatus').value;
        const preview = document.getElementById('bulkPreview');
        const confirmBtn = document.getElementById('confirmBulkBtn');

        if (!folderId) {
            preview.innerHTML = '';
            confirmBtn.disabled = true;
            return;
        }

        const categories = Database.getCategoriesByFolder(parseInt(folderId));
        const selectedOption = document.getElementById('bulkFolder').options[document.getElementById('bulkFolder').selectedIndex];
        const folderType = selectedOption.dataset.folderType || 'payable';

        if (categories.length === 0) {
            preview.innerHTML = '<div class="bulk-preview-empty">No categories in this folder. Add categories to this folder first.</div>';
            confirmBtn.disabled = true;
            return;
        }

        const monthDue = (month && year) ? `${year}-${month}` : null;
        const monthLabel = monthDue ? Utils.formatMonthDisplay(monthDue) : 'not set';
        const isNoneType = folderType === 'none';
        const folderTypeClass = folderType === 'receivable' ? 'type-receivable' : folderType === 'payable' ? 'type-payable' : 'type-none';
        const folderTypeLabel = isNoneType ? '' : ` &mdash; <span class="type-badge ${folderTypeClass}">${UI.capitalizeFirst(folderType)}</span>`;

        let html = `<div class="bulk-preview-header">${categories.length} entr${categories.length === 1 ? 'y' : 'ies'} will be created for ${monthLabel}${folderTypeLabel} &mdash; ${UI.capitalizeFirst(status)}</div>`;

        // Check for categories missing default amounts
        const missingAmounts = categories.filter(c => !c.default_amount);
        if (missingAmounts.length > 0) {
            html += `<div class="bulk-preview-warning">` +
                `${missingAmounts.length} categor${missingAmounts.length === 1 ? 'y is' : 'ies are'} missing a typical price. ` +
                `Those will use $0.00 as default. Edit categories to set defaults.</div>`;
        }

        categories.forEach(cat => {
            const amount = cat.default_amount || 0;
            const catType = isNoneType ? (cat.default_type || 'payable') : folderType;
            const catTypeClass = catType === 'receivable' ? 'type-receivable' : 'type-payable';
            html += `
                <div class="bulk-preview-item">
                    <span class="bulk-preview-name">${Utils.escapeHtml(cat.name)}</span>
                    <div class="bulk-preview-details">
                        <span class="type-badge ${catTypeClass}">${UI.capitalizeFirst(catType)}</span>
                        <span>${Utils.formatCurrency(amount)}</span>
                    </div>
                </div>
            `;
        });

        preview.innerHTML = html;
        confirmBtn.disabled = false;
    },

    /**
     * Confirm and create all folder entries
     */
    confirmAddFolderEntries() {
        const folderSelect = document.getElementById('bulkFolder');
        const folderId = parseInt(folderSelect.value);
        const month = document.getElementById('bulkMonth').value;
        const year = document.getElementById('bulkYear').value;
        const entryDate = document.getElementById('bulkEntryDate').value;
        const status = document.getElementById('bulkStatus').value;
        const dateProcessed = document.getElementById('bulkDateProcessed').value || null;
        const monthPaidMonth = document.getElementById('bulkMonthPaid').value;
        const monthPaidYear = document.getElementById('bulkMonthPaidYear').value;

        if (!folderId) {
            UI.showNotification('Please select a folder', 'error');
            return;
        }

        if (!entryDate) {
            UI.showNotification('Please enter a date recorded', 'error');
            return;
        }

        // Get folder type from selected option
        const selectedOption = folderSelect.options[folderSelect.selectedIndex];
        const folderType = selectedOption.dataset.folderType || 'payable';

        const monthDue = (month && year) ? `${year}-${month}` : null;
        const monthPaid = (status !== 'pending' && monthPaidMonth && monthPaidYear)
            ? `${monthPaidYear}-${monthPaidMonth}` : null;
        const categories = Database.getCategoriesByFolder(folderId);

        if (categories.length === 0) {
            UI.showNotification('No categories in this folder', 'error');
            return;
        }

        // Validate month paid if status is paid/received
        if (status !== 'pending' && !monthPaid) {
            UI.showNotification('Please select the month paid/received', 'error');
            return;
        }

        let count = 0;

        const isNoneType = folderType === 'none';

        try {
            categories.forEach(cat => {
                const amount = cat.default_amount || 0;
                const catType = isNoneType ? (cat.default_type || 'payable') : folderType;
                const paymentForMonth = cat.is_monthly ? monthDue : null;

                Database.addTransaction({
                    entry_date: entryDate,
                    category_id: cat.id,
                    item_description: null,
                    amount: amount,
                    transaction_type: catType,
                    status: status,
                    date_processed: (status !== 'pending') ? dateProcessed : null,
                    month_due: monthDue,
                    month_paid: (status !== 'pending') ? monthPaid : null,
                    payment_for_month: paymentForMonth,
                    notes: null
                });
                count++;
            });

            UI.hideModal('addFolderEntriesModal');
            this.refreshAll();
            UI.showNotification(`${count} entr${count === 1 ? 'y' : 'ies'} added successfully`, 'success');
        } catch (error) {
            console.error('Error adding folder entries:', error);
            UI.showNotification('Failed to add entries', 'error');
        }
    },

    // ==================== EXPORT ====================

    /**
     * Export all transactions as CSV
     */
    handleExportCsv() {
        const transactions = Database.getTransactionsForExport();

        if (transactions.length === 0) {
            UI.showNotification('No transactions to export', 'error');
            return;
        }

        const csv = UI.generateCsv(transactions);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

        const owner = document.getElementById('journalOwner').value.trim();
        const prefix = owner ? Utils.sanitizeFilename(owner) : 'accounting_journal';
        const date = new Date().toISOString().split('T')[0];
        const filename = `${prefix}_export_${date}.csv`;

        this.downloadBlob(blob, filename);
        UI.showNotification('CSV exported successfully', 'success');
    },

    // ==================== SAVE / LOAD ====================

    /**
     * Get the suggested filename for saving
     * @returns {string} Suggested filename
     */
    getSuggestedFilename() {
        const owner = document.getElementById('journalOwner').value.trim();
        if (owner) {
            return `${Utils.sanitizeFilename(owner)}_accounting_journal.db`;
        }
        return `accounting_journal_${new Date().toISOString().split('T')[0]}.db`;
    },

    /**
     * Handle save database (uses File System Access API if available, with saved handle)
     */
    async handleSaveDatabase() {
        const blob = Database.exportToFile();

        // If we have a saved file handle, try to reuse it
        if (this.savedFileHandle) {
            try {
                const writable = await this.savedFileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                UI.showNotification('Journal saved', 'success');
                return;
            } catch (e) {
                // Handle might be stale, fall through to picker
                this.savedFileHandle = null;
            }
        }

        // Try File System Access API
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: this.getSuggestedFilename(),
                    types: [{
                        description: 'Database Files',
                        accept: { 'application/x-sqlite3': ['.db'] }
                    }]
                });

                this.savedFileHandle = handle;
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                UI.showNotification('Journal saved', 'success');
                return;
            } catch (e) {
                if (e.name === 'AbortError') return; // User cancelled
                // Fall through to download
            }
        }

        // Fallback: regular download
        this.downloadBlob(blob, this.getSuggestedFilename());
        UI.showNotification('Database saved successfully', 'success');
    },

    /**
     * Handle save as (always prompts for new location)
     */
    async handleSaveAsDatabase() {
        const blob = Database.exportToFile();

        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: this.getSuggestedFilename(),
                    types: [{
                        description: 'Database Files',
                        accept: { 'application/x-sqlite3': ['.db'] }
                    }]
                });

                this.savedFileHandle = handle;
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                UI.showNotification('Journal saved', 'success');
            } catch (e) {
                if (e.name === 'AbortError') return;
                UI.showNotification('Failed to save', 'error');
            }
        } else {
            // Fallback: show save as modal for naming
            const owner = document.getElementById('journalOwner').value.trim();
            document.getElementById('saveAsName').value = owner
                ? `${Utils.sanitizeFilename(owner)}_accounting_journal`
                : `accounting_journal_${new Date().toISOString().split('T')[0]}`;
            UI.showModal('saveAsModal');
        }
    },

    /**
     * Confirm save as from modal (fallback)
     */
    confirmSaveAs() {
        const name = document.getElementById('saveAsName').value.trim();
        if (!name) {
            UI.showNotification('Please enter a file name', 'error');
            return;
        }

        const blob = Database.exportToFile();
        this.downloadBlob(blob, `${Utils.sanitizeFilename(name)}.db`);
        UI.hideModal('saveAsModal');
        UI.showNotification('Database saved successfully', 'success');
    },

    /**
     * Download a blob as a file
     * @param {Blob} blob - The file blob
     * @param {string} filename - The filename
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Confirm and load database from file
     */
    async confirmLoadDatabase() {
        if (!this.pendingFileLoad) return;

        try {
            const buffer = await this.pendingFileLoad.arrayBuffer();
            await Database.importFromFile(buffer);

            UI.hideModal('loadConfirmModal');
            this.pendingFileLoad = null;
            this.savedFileHandle = null; // Clear saved handle since we loaded a new file
            document.getElementById('loadDbInput').value = '';

            // Reload journal owner
            const owner = Database.getJournalOwner();
            document.getElementById('journalOwner').value = owner;
            UI.updateJournalTitle(owner);
            if (owner) {
                document.getElementById('journalOwner').style.width = Math.max(120, (owner.length + 2) * 14) + 'px';
            }

            // Repopulate year dropdowns (in case data spans different years)
            UI.populateYearDropdowns();

            this.refreshAll();
            UI.showNotification('Database loaded successfully', 'success');
        } catch (error) {
            console.error('Error loading database:', error);
            UI.showNotification('Failed to load database. The file may be corrupted.', 'error');
        }
    }
};

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for use in other modules
window.App = App;
