document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    let incomes = JSON.parse(localStorage.getItem('incomes')) || [];
    let categories = JSON.parse(localStorage.getItem('categories')) || ['Food', 'Transport', 'Bills', 'Groceries', 'Cloths', 'Outside Food', 'Snacks', 'Others'];
    let currentTheme = localStorage.getItem('theme') || 'light';

    let expenseChart;
    let trendChart;
    let currentChartType = 'pie';
    let editMode = { type: null, id: null };

    // --- DOM ELEMENT REFERENCES ---
    const body = document.body;
    const expenseForm = document.getElementById('expense-form');
    const incomeForm = document.getElementById('income-form');
    const transactionList = document.getElementById('transaction-list');
    const chartTypeSelect = document.getElementById('chart-type-select');
    const filterStartDate = document.getElementById('filter-start-date');
    const filterEndDate = document.getElementById('filter-end-date');
    
    // --- NEW DOM REFS ---
    const themeCheckbox = document.getElementById('theme-checkbox');
    const settingsBtn = document.getElementById('settings-btn');
    const categoryModal = document.getElementById('category-modal');
    const closeModalBtn = document.querySelector('.close-btn');
    const categoryList = document.getElementById('category-list');
    const addCategoryForm = document.getElementById('add-category-form');
    const newCategoryNameInput = document.getElementById('new-category-name');
    const expenseCategorySelect = document.getElementById('expense-category');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const summaryIncomeEl = document.getElementById('summary-income');
    const summaryExpensesEl = document.getElementById('summary-expenses');
    const summaryBalanceEl = document.getElementById('summary-balance');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const transactionForms = document.querySelectorAll('.transaction-form');

    // --- HELPER FUNCTIONS ---
    const getTodayDateString = () => new Date().toISOString().split('T')[0];

    const saveToLocalStorage = () => {
        localStorage.setItem('expenses', JSON.stringify(expenses));
        localStorage.setItem('incomes', JSON.stringify(incomes));
        localStorage.setItem('categories', JSON.stringify(categories));
        localStorage.setItem('theme', currentTheme);
    };

    const getFilteredData = () => {
        const startDate = filterStartDate.value;
        const endDate = filterEndDate.value;
        
        const filterFunction = (item) => {
            if (!item.date) return false;
            const itemDate = new Date(item.date);
            const start = startDate ? new Date(startDate) : null;
            let end = endDate ? new Date(endDate) : null;
            if (end) end.setHours(23, 59, 59, 999);
            
            if (start && end) return itemDate >= start && itemDate <= end;
            if (start) return itemDate >= start;
            if (end) return itemDate <= end;
            return true;
        };

        return {
            filteredExpenses: expenses.filter(filterFunction),
            filteredIncomes: incomes.filter(filterFunction)
        };
    };

    // --- RENDER FUNCTIONS ---
    const renderAll = () => {
        const { filteredExpenses, filteredIncomes } = getFilteredData();
        const allTransactions = [...filteredExpenses, ...filteredIncomes];

        renderTransactionList(allTransactions);
        renderSummary(filteredIncomes, filteredExpenses);
        renderExpenseChart(filteredExpenses);
        renderTrendChart(); // Uses all data, not filtered
        saveToLocalStorage();
    };

    const renderTransactionList = (transactions) => {
        transactionList.innerHTML = '';
        if (transactions.length === 0) {
            transactionList.innerHTML = '<p style="text-align:center;">No transactions for the selected period.</p>';
            return;
        }

        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        transactions.forEach(item => {
            const isExpense = 'category' in item;
            const li = document.createElement('li');
            li.className = `transaction-item ${isExpense ? 'expense' : 'income'}`;
            li.innerHTML = `
                <div class="transaction-details">
                    <div>
                        <span class="date-badge">${item.date}</span>
                        ${isExpense ? `<span class="category-badge">${item.category}</span>` : ''}
                        ${item.description}
                    </div>
                    <span class="transaction-amount ${isExpense ? 'expense-color' : 'income-color'}">
                        ${isExpense ? '-' : '+'}₹${item.amount.toFixed(2)}
                    </span>
                </div>
                <div class="transaction-actions">
                    <button onclick="window.editTransaction('${item.id}', '${isExpense ? 'expense' : 'income'}')" title="Edit">✏️</button>
                    <button onclick="window.deleteTransaction('${item.id}', '${isExpense ? 'expense' : 'income'}')" title="Delete">🗑️</button>
                </div>
            `;
            transactionList.appendChild(li);
        });
    };
    
    const renderSummary = (incomes, expenses) => {
        const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
        const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
        const balance = totalIncome - totalExpenses;

        summaryIncomeEl.textContent = `₹${totalIncome.toFixed(2)}`;
        summaryExpensesEl.textContent = `₹${totalExpenses.toFixed(2)}`;
        summaryBalanceEl.textContent = `₹${balance.toFixed(2)}`;
        summaryBalanceEl.className = balance >= 0 ? 'income-color' : 'expense-color';
    };

    const renderExpenseChart = (expensesToRender) => {
        if (expenseChart) expenseChart.destroy();
        const spendingByCategory = expensesToRender.reduce((acc, expense) => {
            acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
            return acc;
        }, {});

        const labels = Object.keys(spendingByCategory);
        const data = Object.values(spendingByCategory);
        const totalExpenses = data.reduce((sum, val) => sum + val, 0);

        if (labels.length === 0) return;

        expenseChart = new Chart(document.getElementById('expense-chart').getContext('2d'), {
            type: currentChartType,
            data: { labels, datasets: [{ label: 'Expenses', data, backgroundColor: ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', '#34495e', '#1abc9c', '#e67e22'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: getComputedStyle(body).getPropertyValue('--text-color') } }, tooltip: { callbacks: { label: c => `${c.label}: ₹${c.raw.toFixed(2)} (${totalExpenses > 0 ? (c.raw/totalExpenses*100).toFixed(1) : 0}%)` } } } }
        });
    };

    const renderTrendChart = () => {
        if (trendChart) trendChart.destroy();
        
        const allData = [...expenses, ...incomes].sort((a,b) => new Date(a.date) - new Date(b.date));
        const monthlyData = allData.reduce((acc, item) => {
            const month = item.date.substring(0, 7); // YYYY-MM
            if (!acc[month]) acc[month] = { income: 0, expense: 0 };
            'category' in item ? acc[month].expense += item.amount : acc[month].income += item.amount;
            return acc;
        }, {});
        
        const labels = Object.keys(monthlyData).sort();
        if (labels.length === 0) return;

        const incomeData = labels.map(m => monthlyData[m].income);
        const expenseData = labels.map(m => monthlyData[m].expense);

        trendChart = new Chart(document.getElementById('trend-chart').getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Income', data: incomeData, borderColor: 'var(--income-color)', tension: 0.1, fill: false },
                    { label: 'Expenses', data: expenseData, borderColor: 'var(--expense-color)', tension: 0.1, fill: false }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { labels: { color: getComputedStyle(body).getPropertyValue('--text-color') } } } }
        });
    };

    const populateCategoryDropdown = () => {
        expenseCategorySelect.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    };

    const renderCategoriesInModal = () => {
        categoryList.innerHTML = categories.map(cat => `
            <div class="category-item">
                <span>${cat}</span>
                <button data-category="${cat}">Delete</button>
            </div>
        `).join('');
    };

    // --- FORM & TRANSACTION HANDLING ---
    const resetForm = (form) => {
        form.reset();
        form.querySelector('input[type="hidden"]').value = '';
        form.querySelector('input[type="date"]').value = getTodayDateString();
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = form.id === 'expense-form' ? 'Add Expense' : 'Add Income';
        submitBtn.classList.remove('edit-mode');
        editMode = { type: null, id: null };
    };

    expenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('expense-id').value;
        const newExpense = {
            id: id || `exp-${Date.now()}`,
            date: document.getElementById('expense-date').value,
            category: document.getElementById('expense-category').value,
            description: document.getElementById('expense-desc').value,
            amount: parseFloat(document.getElementById('expense-amount').value)
        };
        if (id) {
            expenses = expenses.map(exp => exp.id === id ? newExpense : exp);
        } else {
            expenses.push(newExpense);
        }
        resetForm(expenseForm);
        renderAll();
    });

    incomeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('income-id').value;
        const newIncome = {
            id: id || `inc-${Date.now()}`,
            date: document.getElementById('income-date').value,
            description: document.getElementById('income-desc').value,
            amount: parseFloat(document.getElementById('income-amount').value)
        };
        if (id) {
            incomes = incomes.map(inc => inc.id === id ? newIncome : inc);
        } else {
            incomes.push(newIncome);
        }
        resetForm(incomeForm);
        renderAll();
    });

    window.editTransaction = (id, type) => {
        const item = type === 'expense' ? expenses.find(i => i.id === id) : incomes.find(i => i.id === id);
        if (!item) return;

        const form = type === 'expense' ? expenseForm : incomeForm;
        const formIdPrefix = type === 'expense' ? 'expense' : 'income';
        
        switchTab(type);

        document.getElementById(`${formIdPrefix}-id`).value = item.id;
        document.getElementById(`${formIdPrefix}-date`).value = item.date;
        document.getElementById(`${formIdPrefix}-desc`).value = item.description;
        document.getElementById(`${formIdPrefix}-amount`).value = item.amount;
        if (type === 'expense') {
            document.getElementById('expense-category').value = item.category;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Update ' + type.charAt(0).toUpperCase() + type.slice(1);
        submitBtn.classList.add('edit-mode');
        
        form.scrollIntoView({ behavior: 'smooth' });
    };

    window.deleteTransaction = (id, type) => {
        if (confirm(`Are you sure you want to delete this ${type}?`)) {
            if (type === 'expense') {
                expenses = expenses.filter(i => i.id !== id);
            } else {
                incomes = incomes.filter(i => i.id !== id);
            }
            renderAll();
        }
    };
    
    // --- EVENT LISTENERS ---
    document.getElementById('filter-btn').addEventListener('click', renderAll);
    document.getElementById('reset-filter-btn').addEventListener('click', () => {
        filterStartDate.value = '';
        filterEndDate.value = '';
        renderAll();
    });

    chartTypeSelect.addEventListener('change', (e) => {
        currentChartType = e.target.value;
        renderAll();
    });

    // Theme Toggle
    const applyTheme = (theme) => {
        body.classList.remove('light-mode', 'dark-mode');
        body.classList.add(`${theme}-mode`);
        themeCheckbox.checked = theme === 'dark';
        currentTheme = theme;
        renderAll(); // Re-render charts with new theme colors
    };
    themeCheckbox.addEventListener('change', () => {
        applyTheme(themeCheckbox.checked ? 'dark' : 'light');
    });

    // Category Modal
    settingsBtn.addEventListener('click', () => {
        renderCategoriesInModal();
        categoryModal.style.display = 'block';
    });
    closeModalBtn.addEventListener('click', () => categoryModal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target == categoryModal) categoryModal.style.display = 'none';
    });
    addCategoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newCat = newCategoryNameInput.value.trim();
        if (newCat && !categories.find(c => c.toLowerCase() === newCat.toLowerCase())) {
            categories.push(newCat);
            newCategoryNameInput.value = '';
            renderCategoriesInModal();
            populateCategoryDropdown();
            saveToLocalStorage();
        } else {
            alert('Category already exists or is empty.');
        }
    });
    categoryList.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const catToDelete = e.target.dataset.category;
            if (expenses.some(exp => exp.category === catToDelete)) {
                alert(`Cannot delete "${catToDelete}" as it is currently used in one or more expenses. Please re-assign those expenses first.`);
                return;
            }
            if (confirm(`Are you sure you want to delete the category "${catToDelete}"?`)) {
                categories = categories.filter(cat => cat !== catToDelete);
                renderCategoriesInModal();
                populateCategoryDropdown();
                saveToLocalStorage();
            }
        }
    });

    // Export to CSV
    exportCsvBtn.addEventListener('click', () => {
        const { filteredExpenses, filteredIncomes } = getFilteredData();
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Type,Date,Category,Description,Amount\r\n";
        
        filteredIncomes.forEach(item => {
            csvContent += `Income,${item.date},N/A,"${item.description}",${item.amount}\r\n`;
        });
        filteredExpenses.forEach(item => {
            csvContent += `Expense,${item.date},${item.category},"${item.description}",${item.amount}\r\n`;
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "transactions.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Tab Switching
    const switchTab = (targetTab) => {
         tabBtns.forEach(btn => btn.classList.remove('active'));
         document.querySelector(`.tab-btn[data-form="${targetTab}"]`).classList.add('active');
         transactionForms.forEach(form => form.classList.remove('active'));
         document.getElementById(`${targetTab}-form`).classList.add('active');
    };
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.form));
    });

    // --- INITIALIZATION ---
    applyTheme(currentTheme);
    populateCategoryDropdown();
    document.getElementById('expense-date').value = getTodayDateString();
    document.getElementById('income-date').value = getTodayDateString();
    renderAll();
});