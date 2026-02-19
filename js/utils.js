/**
 * Utility functions for the Accounting Journal Calculator
 */

const Utils = {
    /**
     * Format a number as currency (USD)
     * @param {number} amount - The amount to format
     * @returns {string} Formatted currency string
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    },

    /**
     * Format a date as MM/DD/YYYY
     * @param {string} dateStr - Date string (YYYY-MM-DD)
     * @returns {string} Formatted date string
     */
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        });
    },

    /**
     * Format a date as short format (MM/DD)
     * @param {string} dateStr - Date string (YYYY-MM-DD)
     * @returns {string} Formatted short date string
     */
    formatDateShort(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric'
        });
    },

    /**
     * Get today's date in YYYY-MM-DD format
     * @returns {string} Today's date
     */
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    },

    /**
     * Get current month in YYYY-MM format
     * @returns {string} Current month
     */
    getCurrentMonth() {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    },

    /**
     * Extract month (YYYY-MM) from a date string
     * @param {string} dateStr - Date string (YYYY-MM-DD)
     * @returns {string} Month in YYYY-MM format
     */
    getMonthFromDate(dateStr) {
        if (!dateStr) return null;
        return dateStr.substring(0, 7);
    },

    /**
     * Format a month string to display format (e.g., "OCTOBER 2024")
     * @param {string} monthStr - Month string (YYYY-MM)
     * @returns {string} Formatted month string
     */
    formatMonthDisplay(monthStr) {
        if (!monthStr) return '';
        const [year, month] = monthStr.split('-');
        const date = new Date(year, parseInt(month) - 1, 1);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        }).toUpperCase();
    },

    /**
     * Format a month string to short display format (e.g., "Jan 2024")
     * @param {string} monthStr - Month string (YYYY-MM)
     * @returns {string} Formatted month string
     */
    formatMonthShort(monthStr) {
        if (!monthStr) return '';
        const [year, month] = monthStr.split('-');
        const date = new Date(year, parseInt(month) - 1, 1);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric'
        });
    },

    /**
     * Generate an array of month options (past 12 months + next 12 months)
     * @returns {Array} Array of {value: 'YYYY-MM', label: 'Month Year'} objects
     */
    generateMonthOptions() {
        const options = [];
        const today = new Date();

        for (let i = -12; i <= 12; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const label = date.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            });
            options.push({ value, label });
        }

        return options;
    },

    /**
     * Generate year options for dropdowns (2 years past to 3 years future)
     * @returns {Array} Array of year numbers
     */
    generateYearOptions() {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear - 2; y <= currentYear + 3; y++) {
            years.push(y);
        }
        return years;
    },

    /**
     * Check if payment was late (paid after due month)
     * @param {string} monthDue - Month due (YYYY-MM)
     * @param {string} monthPaid - Month paid (YYYY-MM)
     * @returns {boolean} True if paid late
     */
    isPaidLate(monthDue, monthPaid) {
        if (!monthDue || !monthPaid) return false;
        return monthPaid > monthDue;
    },

    /**
     * Check if a transaction is overdue
     * @param {string} monthDue - Month due (YYYY-MM)
     * @param {string} status - Transaction status
     * @returns {boolean} True if overdue
     */
    isOverdue(monthDue, status) {
        if (!monthDue || status === 'paid' || status === 'received') {
            return false;
        }
        const currentMonth = this.getCurrentMonth();
        return monthDue < currentMonth;
    },

    /**
     * Parse a numeric string to a float
     * @param {string|number} value - Value to parse
     * @returns {number} Parsed float
     */
    parseAmount(value) {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    },

    /**
     * Generate a unique ID for temporary use
     * @returns {string} Unique ID
     */
    generateTempId() {
        return 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    },

    /**
     * Debounce a function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Sort transactions by date (newest first)
     * @param {Array} transactions - Array of transactions
     * @returns {Array} Sorted transactions
     */
    sortByDate(transactions) {
        return [...transactions].sort((a, b) => {
            const dateA = a.entry_date || '';
            const dateB = b.entry_date || '';
            return dateB.localeCompare(dateA);
        });
    },

    /**
     * Group transactions by month
     * @param {Array} transactions - Array of transactions
     * @returns {Object} Transactions grouped by month
     */
    groupByMonth(transactions) {
        const groups = {};

        transactions.forEach(transaction => {
            const month = this.getMonthFromDate(transaction.entry_date) || 'Unknown';
            if (!groups[month]) {
                groups[month] = [];
            }
            groups[month].push(transaction);
        });

        const sortedGroups = {};
        Object.keys(groups)
            .sort((a, b) => b.localeCompare(a))
            .forEach(key => {
                sortedGroups[key] = groups[key];
            });

        return sortedGroups;
    },

    /**
     * Group transactions by month due
     * @param {Array} transactions - Array of transactions
     * @returns {Object} Transactions grouped by month due
     */
    groupByMonthDue(transactions) {
        const groups = {};

        transactions.forEach(transaction => {
            const month = transaction.month_due || 'No Due Date';
            if (!groups[month]) {
                groups[month] = [];
            }
            groups[month].push(transaction);
        });

        const sortedGroups = {};
        Object.keys(groups)
            .sort((a, b) => {
                if (a === 'No Due Date') return 1;
                if (b === 'No Due Date') return -1;
                return b.localeCompare(a);
            })
            .forEach(key => {
                sortedGroups[key] = groups[key];
            });

        return sortedGroups;
    },

    /**
     * Group transactions by category
     * @param {Array} transactions - Array of transactions
     * @returns {Object} Transactions grouped by category name
     */
    groupByCategory(transactions) {
        const groups = {};

        transactions.forEach(transaction => {
            const category = transaction.category_name || 'Uncategorized';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(transaction);
        });

        const sortedGroups = {};
        Object.keys(groups)
            .sort((a, b) => a.localeCompare(b))
            .forEach(key => {
                sortedGroups[key] = groups[key];
            });

        return sortedGroups;
    },

    /**
     * Get unique months from transactions
     * @param {Array} transactions - Array of transactions
     * @returns {Array} Array of unique months (YYYY-MM format)
     */
    getUniqueMonths(transactions) {
        const months = new Set();
        transactions.forEach(t => {
            const month = this.getMonthFromDate(t.entry_date);
            if (month) months.add(month);
        });
        return Array.from(months).sort((a, b) => b.localeCompare(a));
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Sanitize a string for use as a filename
     * @param {string} str - String to sanitize
     * @returns {string} Sanitized string
     */
    sanitizeFilename(str) {
        if (!str) return '';
        return str.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
    }
};

// Export for use in other modules
window.Utils = Utils;
