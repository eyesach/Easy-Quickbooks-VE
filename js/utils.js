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
     * Generate array of YYYY-MM strings from start to end (inclusive)
     * @param {string} startMonth - Start month (YYYY-MM)
     * @param {string} endMonth - End month (YYYY-MM)
     * @returns {Array} Array of YYYY-MM strings
     */
    generateMonthRange(startMonth, endMonth) {
        const result = [];
        const [sy, sm] = startMonth.split('-').map(Number);
        const [ey, em] = endMonth.split('-').map(Number);
        let y = sy, m = sm;
        while (y < ey || (y === ey && m <= em)) {
            result.push(`${y}-${String(m).padStart(2, '0')}`);
            m++;
            if (m > 12) { m = 1; y++; }
        }
        return result;
    },

    /**
     * Filter months array by timeline boundaries
     * @param {Array} months - Array of YYYY-MM strings
     * @param {string|null} start - Timeline start month or null
     * @param {string|null} end - Timeline end month or null
     * @returns {Array} Filtered months
     */
    filterMonthsByTimeline(months, start, end) {
        return months.filter(m => {
            if (start && m < start) return false;
            if (end && m > end) return false;
            return true;
        });
    },

    /**
     * Get years that overlap a timeline range
     * @param {string|null} start - Timeline start (YYYY-MM) or null
     * @param {string|null} end - Timeline end (YYYY-MM) or null
     * @returns {Array} Array of year numbers
     */
    getYearsInTimeline(start, end) {
        if (!start && !end) return this.generateYearOptions();
        const startYear = start ? parseInt(start.split('-')[0]) : new Date().getFullYear() - 2;
        const endYear = end ? parseInt(end.split('-')[0]) : new Date().getFullYear() + 3;
        const years = [];
        for (let y = startYear; y <= endYear; y++) {
            years.push(y);
        }
        return years;
    },

    /**
     * Check if a month string is in the future (after current month)
     * @param {string} month - YYYY-MM string
     * @returns {boolean}
     */
    isFutureMonth(month) {
        return month > this.getCurrentMonth();
    },

    /**
     * Get the next month after the given month
     * @param {string} month - YYYY-MM string
     * @returns {string} Next month YYYY-MM string
     */
    nextMonth(month) {
        const [y, m] = month.split('-').map(Number);
        if (m === 12) return `${y + 1}-01`;
        return `${y}-${String(m + 1).padStart(2, '0')}`;
    },

    /**
     * Convert YYYY-MM to first day of month for date picker min
     * @param {string} month - YYYY-MM string
     * @returns {string} YYYY-MM-01
     */
    timelineToDateMin(month) {
        return month ? `${month}-01` : '';
    },

    /**
     * Convert YYYY-MM to last day of month for date picker max
     * @param {string} month - YYYY-MM string
     * @returns {string} YYYY-MM-{lastDay}
     */
    timelineToDateMax(month) {
        if (!month) return '';
        const [y, m] = month.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        return `${month}-${String(lastDay).padStart(2, '0')}`;
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
    },

    // ==================== COLOR HELPERS ====================

    /**
     * Convert hex color to HSL
     * @param {string} hex - Hex color (e.g., '#4a90a4')
     * @returns {{h: number, s: number, l: number}} HSL values (h: 0-360, s: 0-100, l: 0-100)
     */
    hexToHSL(hex) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s;
        const l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    },

    /**
     * Convert HSL values to hex color
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-100)
     * @param {number} l - Lightness (0-100)
     * @returns {string} Hex color string
     */
    hslToHex(h, s, l) {
        s /= 100;
        l /= 100;

        const a = s * Math.min(l, 1 - l);
        const f = (n) => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };

        return `#${f(0)}${f(8)}${f(4)}`;
    },

    /**
     * Adjust lightness of a hex color
     * @param {string} hex - Hex color
     * @param {number} amount - Lightness adjustment (-100 to 100)
     * @returns {string} Adjusted hex color
     */
    adjustLightness(hex, amount) {
        const hsl = this.hexToHSL(hex);
        hsl.l = Math.max(0, Math.min(100, hsl.l + amount));
        return this.hslToHex(hsl.h, hsl.s, hsl.l);
    },

    // ==================== AMORTIZATION & DEPRECIATION ====================

    /**
     * Compute a full amortization schedule from loan config.
     * Accepts { principal, annual_rate, term_months, payments_per_year, start_date }.
     * Backward compat: if term_years is provided instead of term_months, auto-convert.
     * @param {Object} config - Loan configuration
     * @returns {Array} Array of payment objects
     */
    computeAmortizationSchedule(config) {
        const { principal, annual_rate, payments_per_year, start_date } = config;
        const termMonths = config.term_months || (config.term_years ? config.term_years * 12 : 0);
        const termYears = termMonths / 12;
        const totalPayments = termYears * payments_per_year;
        const periodicRate = (annual_rate / 100) / payments_per_year;

        const round2 = (v) => Math.round(v * 100) / 100;

        let payment;
        if (periodicRate === 0) {
            payment = round2(principal / totalPayments);
        } else {
            payment = round2(principal * (periodicRate * Math.pow(1 + periodicRate, totalPayments)) /
                      (Math.pow(1 + periodicRate, totalPayments) - 1));
        }

        const schedule = [];
        let balance = round2(principal);
        const startDate = new Date(start_date + 'T00:00:00');
        const monthsBetween = 12 / payments_per_year;

        for (let i = 1; i <= totalPayments; i++) {
            const interest = round2(balance * periodicRate);
            let principalPart = round2(payment - interest);

            // Last payment: adjust to zero out balance exactly
            if (i === totalPayments) {
                principalPart = balance;
                // Recalculate final payment as principal + interest
            }

            balance = round2(balance - principalPart);
            if (balance < 0.01) balance = 0;

            const paymentDate = new Date(startDate);
            paymentDate.setMonth(paymentDate.getMonth() + Math.round(monthsBetween * i));
            const month = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;

            const actualPayment = (i === totalPayments) ? round2(principalPart + interest) : payment;

            schedule.push({
                number: i,
                month,
                payment: actualPayment,
                principal: principalPart,
                interest: interest,
                ending_balance: balance
            });
        }

        return schedule;
    },

    /**
     * Compute a depreciation schedule for a fixed asset.
     * Returns { [YYYY-MM]: monthlyDeprAmount } for each month in the asset's life.
     * @param {Object} asset - { purchase_cost, salvage_value, useful_life_months, purchase_date, dep_start_date, depreciation_method, is_depreciable }
     * @returns {Object} Map of month string to depreciation amount
     */
    computeDepreciationSchedule(asset) {
        if (!asset.is_depreciable || asset.depreciation_method === 'none') {
            return {};
        }

        const cost = parseFloat(asset.purchase_cost) || 0;
        const salvage = parseFloat(asset.salvage_value) || 0;
        const lifeMonths = parseInt(asset.useful_life_months) || 0;
        if (lifeMonths <= 0 || cost <= salvage) return {};

        const startStr = asset.dep_start_date || asset.purchase_date;
        if (!startStr) return {};

        const startDate = new Date(startStr + 'T00:00:00');
        // Depreciation begins the month after the start date
        startDate.setMonth(startDate.getMonth() + 1);

        const schedule = {};

        const round2 = (v) => Math.round(v * 100) / 100;

        if (asset.depreciation_method === 'double_declining') {
            const annualRate = 2 / (lifeMonths / 12);
            const monthlyRate = annualRate / 12;
            let bookValue = cost;

            for (let i = 0; i < lifeMonths; i++) {
                const d = new Date(startDate);
                d.setMonth(d.getMonth() + i);
                const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

                let depr = round2(bookValue * monthlyRate);
                // Don't depreciate below salvage
                if (bookValue - depr < salvage) {
                    depr = round2(bookValue - salvage);
                }
                if (depr < 0.01) break;

                schedule[month] = (schedule[month] || 0) + depr;
                bookValue -= depr;
            }
        } else {
            // straight_line (default)
            const monthlyDepr = round2((cost - salvage) / lifeMonths);

            for (let i = 0; i < lifeMonths; i++) {
                const d = new Date(startDate);
                d.setMonth(d.getMonth() + i);
                const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                schedule[month] = (schedule[month] || 0) + monthlyDepr;
            }
        }

        return schedule;
    },

    /**
     * Get a specific month's interest from a pre-computed amortization schedule.
     * @param {Array} schedule - Amortization schedule from computeAmortizationSchedule
     * @param {string} targetMonth - Month in YYYY-MM format
     * @returns {number} Interest for that month (summed if multiple payments in same month)
     */
    getMonthInterestFromSchedule(schedule, targetMonth) {
        return schedule
            .filter(p => p.month === targetMonth)
            .reduce((sum, p) => sum + p.interest, 0);
    },

    /**
     * Convert hex color to RGB string for use in rgba()
     * @param {string} hex - Hex color
     * @returns {string} RGB string (e.g., '74, 144, 164')
     */
    hexToRGBString(hex) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `${r}, ${g}, ${b}`;
    }
};

// Export for use in other modules
window.Utils = Utils;
