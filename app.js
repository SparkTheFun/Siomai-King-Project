const storageKey = 'siomai-king-pos-v1';
const productCategoryOrder = [
  'Siomai',
  'Dumplings',
  'Siopao',
  'Drinks',
  'Rice',
  'Candy & Snacks',
  'Other'
];
const inventoryWorksheetHeaders = [
  'ITEM', 'QTY', 'SRP', 'START INV', 'SOLD', 'TOTAL SOLD',
  'LEFT OVER', 'END INV', 'PETTY CASH', 'MONEY EARNED'
];
const originalDemoProducts = [
  { id: 'SK-001', name: 'Pork Siomai', cost: 35, price: 55, stock: 100, reorder: 20 },
  { id: 'SK-002', name: 'Beef Siomai', cost: 40, price: 65, stock: 80, reorder: 15 },
  { id: 'SK-003', name: 'Japanese Siomai', cost: 38, price: 60, stock: 80, reorder: 15 },
  { id: 'SK-004', name: 'Gulaman', cost: 10, price: 20, stock: 100, reorder: 20 },
  { id: 'SK-005', name: 'Chili Garlic', cost: 25, price: 40, stock: 50, reorder: 10 },
  { id: 'SK-006', name: 'Packaged Steamer Sets', cost: 120, price: 180, stock: 20, reorder: 5 }
];
const workbookPackCosts = {
  'Japanese Siomai': 38,
  'Pork Siomai': 35,
  'Beef Siomai': 40
};
function stockAboveReorder(product) {
  const packSize = product.packSize;
  const stock = Number.isSafeInteger(product.stock) && product.stock >= 0
    ? product.stock
    : 0;
  const reorder = Number.isSafeInteger(product.reorder) && product.reorder >= 0
    ? product.reorder
    : 0;
  const fullPacks = Math.floor(stock / packSize);
  const leftoverUnits = stock % packSize;
  return fullPacks > reorder
    ? stock
    : (reorder + 1) * packSize + leftoverUnits;
}
const receiptProducts = [
  ['SK-001', 'Japanese Siomai', 'Pack', 55, 3],
  ['SK-002', 'Pork Siomai', 'Pack', 45, 9],
  ['SK-003', 'Beef Siomai', 'Pack', 48, 0],
  ['SK-004', 'Chicken Siomai', 'Pack', 42, 0],
  ['SK-005', 'Sharksfin', 'Pack', 44, 0],
  ['SK-006', 'Gyoza White', 'Pack', 40, 0],
  ['SK-007', 'Jumbo Siopao', 'Pack', 40, 0],
  ['SK-008', 'B1T1 Siopao', 'Pack', 65, 0],
  ['SK-009', 'Java Rice', 'Cup', 68, 0],
  ['SK-010', 'Black Gulaman (Cup 20)', 'Cup', 20, 0],
  ['SK-011', 'Juice Powder', 'Pack', 0, 0],
  ['SK-012', 'Black Gulaman (Cup 15)', 'Cup', 15, 0],
  ['SK-013', 'Gulaman Jelly', 'Pack', 0, 0],
  ['SK-014', 'Rice', 'Cup', 20, 0],
  ['SK-015', 'Bottle Mineral', 'Pack', 25, 38],
  ['SK-016', 'Nips (11)', 'Pcs', 11, 0],
  ['SK-017', 'Nips (5)', 'Pcs', 5, 0],
  ['SK-018', 'Cloud', 'Pcs', 6, 0],
  ['SK-019', 'Mentos Mini', 'Pcs', 7, 0],
  ['SK-020', 'Choco Balls', 'Pcs', 5, 0],
  ['SK-021', 'Panda Balls', 'Pcs', 5, 0],
  ['SK-022', 'Mix Candies', 'Pcs', 2, 0],
  ['SK-023', 'Wiggles', 'Pcs', 5, 0]
].map(([id, name, unit, price, stock]) => {
  const isGulamanCup = name.includes('Black Gulaman (Cup');
  const cupSize = name.includes('Cup 15') ? 'Small' : 'Large';
  return {
    id,
    name: isGulamanCup ? `Gulaman - ${cupSize} Cup` : name,
    unit,
    cost: workbookPackCosts[name] || 0,
    price,
    comboPrice: 0,
    stock: stockAboveReorder({
      stock,
      packSize: name === 'Japanese Siomai' ? 30
        : name.includes('Siomai') ? 60
          : isGulamanCup ? 50 : 1,
      reorder: 0
    }),
    reorder: 0,
    packSize: name === 'Japanese Siomai' ? 30
      : name.includes('Siomai') ? 60
        : isGulamanCup ? 50 : 1,
    saleQty: name.includes('Siomai') ? 4 : 1,
    comboQty: 1,
    cupSize: isGulamanCup ? cupSize : '',
    totalSold: 0,
    soloSold: 0,
    comboSold: 0,
    comboUnitsUsed: 0,
    totalSales: 0
  };
});
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);
const money = amount => '₱' + Number(amount || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return {
    products: receiptProducts.map(product => ({
      ...product,
      category: inferProductCategory(product)
    })),
    expensesByDate: {},
    saleHistory: [],
    comboPrices: {},
    inventorySchemaVersion: 8
  };

  const state = JSON.parse(saved);
  const isUnchangedDemo = Array.isArray(state.products)
    && state.products.length === originalDemoProducts.length
    && state.products.every((product, index) =>
      Object.keys(originalDemoProducts[index]).every(key =>
        product[key] === originalDemoProducts[index][key])
    )
    && (!state.sales || state.sales.length === 0);

  if (isUnchangedDemo) state.products = receiptProducts.map(product => ({ ...product }));
  if (!Array.isArray(state.products)) state.products = receiptProducts.map(product => ({ ...product }));
  if ((state.inventorySchemaVersion || 0) < 3) {
    state.products.forEach(product => {
      if (product.name === 'Black Gulaman (Cup 15)') {
        product.name = 'Gulaman - Small Cup';
        product.cupSize = 'Small';
        product.unit = 'Cup';
        product.packSize = 60;
        product.saleQty = 1;
        product.comboQty = 1;
        product.comboPrice = Number(product.comboPrice || 0);
      } else if (product.name === 'Black Gulaman (Cup 20)') {
        product.name = 'Gulaman - Large Cup';
        product.cupSize = 'Large';
        product.unit = 'Cup';
        product.packSize = 60;
        product.saleQty = 1;
        product.comboQty = 1;
        product.comboPrice = Number(product.comboPrice || 0);
      }
    });
    if (!state.products.some(product => product.cupSize === 'Medium')) {
      state.products.push({
        id: 'SK-024',
        name: 'Gulaman - Medium Cup',
        unit: 'Cup',
        cost: 0,
        price: 0,
        comboPrice: 0,
        stock: 0,
        reorder: 0,
        packSize: 60,
        saleQty: 1,
        comboQty: 1,
        cupSize: 'Medium',
        totalSold: 0,
        soloSold: 0,
        comboSold: 0,
        totalSales: 0
      });
    }
    state.inventorySchemaVersion = 3;
  }
  if (state.inventorySchemaVersion < 4) {
    const previousLarge = state.products.find(product =>
      product.id === 'SK-024' && product.name === 'Gulaman - Large Cup'
    );
    if (previousLarge) {
      previousLarge.name = 'Gulaman - Medium Cup';
      previousLarge.cupSize = 'Medium';
    }
    const legacyLarge = state.products.find(product =>
      product.id === 'SK-010' && product.cupSize === 'Medium'
    );
    if (legacyLarge) {
      legacyLarge.name = 'Gulaman - Large Cup';
      legacyLarge.cupSize = 'Large';
    }
    if (!state.products.some(product => product.cupSize === 'Large')) {
      state.products.push({
        ...receiptProducts.find(product => product.cupSize === 'Large'),
        id: 'SK-025'
      });
    }
    if (!state.products.some(product => product.cupSize === 'Medium')) {
      state.products.push({
        ...receiptProducts.find(product => product.cupSize === 'Medium'),
        id: 'SK-026'
      });
    }
    state.inventorySchemaVersion = 4;
  }
  if (state.inventorySchemaVersion < 5) {
    state.products = state.products.filter(product =>
      product.cupSize !== 'Medium' && product.name !== 'Gulaman - Medium Cup'
    );
    state.products.forEach(product => {
      if (product.cupSize === 'Small' || product.cupSize === 'Large') {
        product.packSize = 50;
      }
    });
    state.inventorySchemaVersion = 5;
  }
  if (state.inventorySchemaVersion < 6) {
    state.products.forEach(product => {
      const packCost = workbookPackCosts[product.name];
      if (product.cost === 0 && Number.isFinite(packCost)) {
        product.cost = packCost;
      }
    });
    state.inventorySchemaVersion = 6;
  }
  if (state.inventorySchemaVersion < 7) {
    state.products.forEach(product => {
      const packSize = product.cupSize === 'Small' || product.cupSize === 'Large'
        ? 50
        : Number.isSafeInteger(product.packSize) && product.packSize > 0
          ? product.packSize
          : 1;
      product.stock = stockAboveReorder({ ...product, packSize });
    });
    state.inventorySchemaVersion = 7;
  }
  if (state.inventorySchemaVersion < 8) {
    state.products.forEach(product => {
      const gulamanSize = product.name.match(/^Gulaman\s*-\s*(Small|Large|Big)\s+Cup$/i)?.[1];
      const restoreSoloSales = gulamanSize
        && product.cupSize !== 'Small' && product.cupSize !== 'Large';
      const cupSize = gulamanSize
        ? gulamanSize.toLocaleLowerCase() === 'small' ? 'Small' : 'Large'
        : product.cupSize;
      if (cupSize === 'Small' || cupSize === 'Large') {
        product.name = `Gulaman - ${cupSize} Cup`;
        product.cupSize = cupSize;
        product.unit = 'Cup';
        product.packSize = 50;
        product.saleQty = 1;
        if (restoreSoloSales) {
          const totalSold = Number.isSafeInteger(product.totalSold) && product.totalSold > 0
            ? product.totalSold
            : 0;
          const comboSold = Number.isSafeInteger(product.comboSold) && product.comboSold > 0
            ? product.comboSold
            : 0;
          product.soloSold = Math.max(0, totalSold - comboSold);
        }
      }
    });
    state.inventorySchemaVersion = 8;
  }
  state.products = state.products.map(product => {
    const cupSize = ['Small', 'Large'].includes(product.cupSize) ? product.cupSize : '';
    const packSize = cupSize ? 50 : Number.isSafeInteger(product.packSize) && product.packSize > 0
      ? product.packSize
      : product.name === 'Japanese Siomai' ? 30 : product.name.includes('Siomai') ? 60 : 1;
    const saleQty = Number.isSafeInteger(product.saleQty) && product.saleQty > 0
      ? product.saleQty
      : product.name.includes('Siomai') ? 4 : 1;
    const stock = Number.isSafeInteger(product.packSize) && product.packSize > 0
      ? product.stock
      : product.stock * packSize;
    return {
      unit: 'Unit',
      ...product,
      category: product.category === 'Combo'
        ? 'Siopao'
        : productCategoryOrder.includes(product.category)
          ? product.category
          : inferProductCategory(product),
      packSize,
      saleQty,
      stock,
      cupSize,
      comboPrice: Number.isFinite(product.comboPrice) && product.comboPrice >= 0
        ? product.comboPrice
        : 0,
      comboQty: Number.isSafeInteger(product.comboQty) && product.comboQty > 0
        ? product.comboQty
        : 1,
      totalSold: Number.isSafeInteger(product.totalSold) && product.totalSold >= 0
        ? product.totalSold
        : 0,
      soloSold: Number.isSafeInteger(product.soloSold) && product.soloSold >= 0
        ? product.soloSold
        : 0,
      comboSold: Number.isSafeInteger(product.comboSold) && product.comboSold >= 0
        ? product.comboSold
        : 0,
      comboUnitsUsed: Number.isSafeInteger(product.comboUnitsUsed) && product.comboUnitsUsed >= 0
        ? product.comboUnitsUsed
        : 0,
      totalSales: Number.isFinite(product.totalSales) && product.totalSales >= 0
        ? product.totalSales
        : (Number.isSafeInteger(product.totalSold) && product.totalSold >= 0 ? product.totalSold : 0)
          * Number(product.price || 0)
    };
  });
  state.inventorySchemaVersion = 8;
  state.expensesByDate = state.expensesByDate && typeof state.expensesByDate === 'object'
    && !Array.isArray(state.expensesByDate)
    ? Object.fromEntries(Object.entries(state.expensesByDate).filter(([date, amount]) =>
      /^\d{4}-\d{2}-\d{2}$/.test(date)
      && Number.isFinite(amount) && amount >= 0
    ))
    : {};
  const legacyExpenses = Number.isFinite(state.expensesTotal) && state.expensesTotal >= 0
    ? state.expensesTotal
    : 0;
  const today = getLocalDateInputValue(new Date());
  if (legacyExpenses > 0 && state.expensesByDate[today] === undefined) {
    state.expensesByDate[today] = legacyExpenses;
  }
  delete state.expensesTotal;
  state.comboPrices = state.comboPrices && typeof state.comboPrices === 'object'
    && !Array.isArray(state.comboPrices)
    ? Object.fromEntries(Object.entries(state.comboPrices).filter(([, price]) =>
      Number.isFinite(price) && price > 0
    ))
    : {};
  state.saleHistory = Array.isArray(state.saleHistory)
    ? state.saleHistory.filter(sale =>
      sale && typeof sale.receiptNumber === 'string'
      && typeof sale.date === 'string'
      && typeof sale.productId === 'string'
      && typeof sale.productName === 'string'
      && Number.isSafeInteger(sale.quantity) && sale.quantity > 0
      && Number.isFinite(sale.price) && sale.price >= 0
      && Number.isFinite(sale.total) && sale.total >= 0
    )
    : [];
  return state;
}

function renderProductCategoryOptions() {
  $('#productCategory').innerHTML = productCategoryOrder.map(category =>
    `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
  ).join('');
}

const state = loadState();
const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
let currentLocalDate = getLocalDateInputValue(new Date());
let servingSaleIsValid = false;
let comboSaleIsValid = false;
let reviewedSaleMode = '';
let editingSaleReceiptNumber = '';
$('#recordsDate').value = getLocalDateInputValue(new Date());
save();

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2500);
}

function sortProductsByInventoryOrder(products) {
  return [...products].sort((first, second) => {
    const firstId = Number(first.id.match(/\d+$/)?.[0]);
    const secondId = Number(second.id.match(/\d+$/)?.[0]);
    const firstOrder = firstId === 15 ? 13.5 : firstId;
    const secondOrder = secondId === 15 ? 13.5 : secondId;
    if (Number.isFinite(firstOrder) && Number.isFinite(secondOrder)) return firstOrder - secondOrder;
    if (Number.isFinite(firstOrder)) return -1;
    if (Number.isFinite(secondOrder)) return 1;
    return first.name.localeCompare(second.name, undefined, { sensitivity: 'base', numeric: true });
  });
}

function getProductsInInventoryOrder(products = state.products) {
  return productCategoryOrder.flatMap(category =>
    sortProductsByInventoryOrder(products.filter(product => product.category === category))
  );
}

function inferProductCategory(product) {
  const name = product.name.toLocaleLowerCase();
  if (name.includes('siomai')) return 'Siomai';
  if (/sharksfin|gyoza/.test(name)) return 'Dumplings';
  if (/siopao/.test(name)) return 'Siopao';
  if (product.cupSize || /gulaman|juice|mineral|drink|water|beverage/.test(name)) return 'Drinks';
  if (/rice/.test(name)) return 'Rice';
  if (/candy|candies|nips|cloud|mentos|choco|panda balls|wiggles|snack/.test(name)) {
    return 'Candy & Snacks';
  }
  return 'Other';
}

function renderInventory() {
  const earningsDate = $('#recordsDate').value || getLocalDateInputValue(new Date());
  const search = $('#inventorySearch').value.trim().toLocaleLowerCase();
  const matchingProducts = state.products.filter(product =>
    `${product.id} ${product.name} ${product.unit}`.toLocaleLowerCase().includes(search)
  );
  const groups = productCategoryOrder.map(category => ({
    category,
    products: sortProductsByInventoryOrder(
      matchingProducts.filter(product => product.category === category)
    )
  })).filter(group => group.products.length);
  $('#inventoryBody').innerHTML = groups.map(group => `
    <tr class="inventory-category"><th colspan="8" scope="rowgroup">${escapeHtml(group.category)}<span>${group.products.length} ${group.products.length === 1 ? 'item' : 'items'}</span></th></tr>
    ${group.products.map(product => {
    const fullPacks = Math.floor(product.stock / product.packSize);
    const looseUnits = product.stock % product.packSize;
    const soldUnits = product.totalSold * product.saleQty;
    const dailyEarnings = getProductSalesForDate(product.id, earningsDate);
    const servingsPerPack = Math.floor(product.packSize / product.saleQty);
    const servingsLeft = Math.floor(product.stock / product.saleQty);
    const outOfStock = product.stock === 0;
    const low = !outOfStock && fullPacks <= product.reorder;
    const id = escapeHtml(product.id);
    const name = escapeHtml(product.name);
    const packDescription = product.cupSize
      ? `${product.packSize} ${product.cupSize.toLowerCase()} Gulaman cups / pack`
      : `${product.packSize} ${product.name.includes('Siomai') ? 'pieces' : escapeHtml(product.unit)} / pack`;
    const stockDescription = product.cupSize
      ? `${fullPacks} full ${product.cupSize.toLowerCase()} Gulaman pack${fullPacks === 1 ? '' : 's'} · ${looseUnits} leftover ${product.cupSize.toLowerCase()} Gulaman cups`
      : `${fullPacks} full packs · ${looseUnits} leftover ${product.name.includes('Siomai') ? 'pieces' : escapeHtml(product.unit).toLowerCase()}${product.name.includes('Siomai') ? ` · ${servingsLeft} servings` : ''}`;
    const priceDescription = product.cupSize
      ? `Solo ${money(product.price)}`
      : `${money(product.price)} / ${product.saleQty} ${product.name.includes('Siomai') ? 'pieces' : escapeHtml(product.unit).toLowerCase()}`;
    const soldDescription = product.cupSize
      ? `Solo: ${product.soloSold}<small class="subline">Combo: ${product.comboSold}</small>`
      : `${product.totalSold} servings · ${soldUnits} pieces`;
    const comboUsageDescription = product.comboUnitsUsed > 0
      ? `<small class="subline">Used in combos: ${product.comboUnitsUsed} ${product.cupSize ? 'cups' : product.name.includes('Siomai') ? 'pieces' : escapeHtml(product.unit.toLowerCase())}</small>`
      : '';
    return `<tr class="${outOfStock ? 'stock-out' : low ? 'stock-low' : ''}">
      <td><strong>${name}</strong><small class="subline">${id}${product.cupSize ? ` · ${escapeHtml(product.cupSize)} size` : ''}</small></td>
      <td>${packDescription}${product.cupSize ? '' : `<small class="subline">${servingsPerPack} servings in a full pack</small>`}</td>
      <td>${stockDescription}</td>
      <td>${priceDescription}</td>
      <td>${soldDescription}${comboUsageDescription}</td>
      <td><strong>${money(dailyEarnings)}</strong></td>
      <td class="${outOfStock || low ? 'danger' : 'ok'}">${outOfStock ? 'OUT OF STOCK' : low ? 'LOW STOCK' : 'IN STOCK'}</td>
      <td>
        <button type="button" class="icon-btn" data-adjust="${id}" aria-label="Adjust stock for ${name}" title="Adjust stock">↕</button>
        <button type="button" class="icon-btn" data-edit="${id}" aria-label="Edit ${name}" title="Edit">✎</button>
        <button type="button" class="icon-btn" data-delete="${id}" aria-label="Delete ${name}" title="Delete">×</button>
      </td>
    </tr>`;
  }).join('')}
  `).join('') || '<tr><td colspan="8">No matching products.</td></tr>';

  const outOfStockCount = matchingProducts.filter(product => product.stock === 0).length;
  const lowStockCount = matchingProducts.filter(product =>
    product.stock > 0 && Math.floor(product.stock / product.packSize) <= product.reorder
  ).length;
  const alertMessages = [];
  if (outOfStockCount) {
    alertMessages.push(`<strong>${outOfStockCount} ${outOfStockCount === 1 ? 'item is' : 'items are'} out of stock</strong>`);
  }
  if (lowStockCount) {
    alertMessages.push(`<strong>${lowStockCount} ${lowStockCount === 1 ? 'item needs' : 'items need'} reordering</strong>`);
  }
  $('#inventoryAlerts').classList.toggle('inventory-alerts-attention', alertMessages.length > 0);
  $('#inventoryAlerts').innerHTML = matchingProducts.length
    ? alertMessages.length
      ? `⚠ Stock alert: ${alertMessages.join(' · ')}. Highlighted rows need attention.`
      : '✓ No stock alerts. All matching items are above their reorder levels.'
    : 'No inventory items match this search.';

  document.querySelectorAll('[data-adjust]').forEach(button => {
    button.onclick = () => openStockDialog(button.dataset.adjust);
  });
  document.querySelectorAll('[data-edit]').forEach(button => {
    button.onclick = () => openProduct(button.dataset.edit);
  });
  document.querySelectorAll('[data-delete]').forEach(button => {
    button.onclick = () => deleteProduct(button.dataset.delete);
  });
}

function renderAll() {
  updateSaleModeView();
  renderCalculator();
  renderComboCalculator();
  renderBusinessTotals();
  renderInventory();
  renderSavedSales();
}

function updateSaleModeView() {
  const comboMode = $('#saleMode').value === 'combo';
  $('#servingsSalePanel').classList.toggle('hidden', comboMode);
  $('#comboSalePanel').classList.toggle('hidden', !comboMode);
  $('#calculatorFormula').textContent = comboMode
    ? 'Combo total = quantity sold × price per combo; each selected item deducts one sale unit.'
    : 'Available stock − (servings sold × units per serving)';
  updateSaleReviewButton();
}

function updateSaleReviewButton() {
  const comboMode = $('#saleMode').value === 'combo';
  $('#saleReviewBtn').disabled = comboMode ? !comboSaleIsValid : !servingSaleIsValid;
  $('#saleReviewBtn').textContent = comboMode ? 'Review Combo Sale' : 'Review Serving Sale';
}

function renderBusinessTotals() {
  const selectedDate = $('#recordsDate').value || getLocalDateInputValue(new Date());
  const allSales = getTotalSales(selectedDate);
  const expenses = getExpensesForDate(selectedDate);
  $('#expensesTotal').value = String(expenses);
  $('#allSalesTotal').textContent = money(allSales);
  $('#netSalesTotal').textContent = money(allSales - expenses);
}

function getSalesForDate(date) {
  return state.saleHistory.filter(sale =>
    getLocalDateInputValue(new Date(sale.date)) === date
  );
}

function getTotalSales(date) {
  return getSalesForDate(date).reduce((sum, sale) => sum + sale.total, 0);
}

function getProductSalesForDate(productId, date) {
  return getSalesForDate(date).reduce((sum, sale) =>
    !sale.isComboBundle && sale.productId === productId ? sum + sale.total : sum, 0);
}

function getExpensesForDate(date) {
  return state.expensesByDate[date] || 0;
}

function renderSavedSales() {
  const selectedDate = $('#recordsDate').value || new Date().toLocaleDateString('en-CA');
  const sales = state.saleHistory.filter(sale =>
    getLocalDateInputValue(new Date(sale.date)) === selectedDate
  ).sort((first, second) =>
    second.date.localeCompare(first.date)
  );
  $('#savedSalesCount').textContent = `${sales.length} ${sales.length === 1 ? 'receipt' : 'receipts'}`;
  $('#savedSalesBody').innerHTML = sales.map(sale => {
    const isBundle = sale.isComboBundle === true;
    const saleName = isBundle
      ? sale.productName
      : `${sale.productName}${sale.cupSize ? ` (${sale.cupSize})` : ''}`;
    const quantityLabel = isBundle
      ? `${sale.quantity} ${sale.quantity === 1 ? 'combo' : 'combos'}`
      : `${sale.quantity} ${sale.cupSize ? `${sale.saleType} cup${sale.quantity === 1 ? '' : 's'}` : `serving${sale.quantity === 1 ? '' : 's'}`}`;
    const dateLabel = new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(sale.date));
    const receiptId = escapeHtml(sale.receiptNumber);
    return `<tr>
      <td><strong>${receiptId}</strong><small class="saved-sale-meta">${escapeHtml(dateLabel)}</small></td>
      <td><span class="saved-sale-name">${escapeHtml(saleName)}</span><small class="saved-sale-meta">${isBundle ? 'Combo sale' : sale.cupSize ? `${escapeHtml(sale.saleType)} cup sale` : 'Serving sale'}</small></td>
      <td>${escapeHtml(quantityLabel)}</td>
      <td>${money(sale.price)}</td>
      <td><strong>${money(sale.total)}</strong></td>
      <td><button type="button" class="icon-btn" data-view-sale="${receiptId}" title="View receipt" aria-label="View receipt ${receiptId}">Receipt</button><button type="button" class="icon-btn" data-edit-sale="${receiptId}" title="Edit saved sale" aria-label="Edit sale ${receiptId}">Edit</button><button type="button" class="icon-btn danger" data-delete-sale="${receiptId}" title="Delete saved sale and reverse stock" aria-label="Delete sale ${receiptId}">Delete</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="6">No receipts recorded for this date.</td></tr>';
  document.querySelectorAll('[data-view-sale]').forEach(button => {
    button.onclick = () => viewSavedSale(button.dataset.viewSale);
  });
  document.querySelectorAll('[data-edit-sale]').forEach(button => {
    button.onclick = () => openSavedSaleEditor(button.dataset.editSale);
  });
  document.querySelectorAll('[data-delete-sale]').forEach(button => {
    button.onclick = () => deleteSavedSale(button.dataset.deleteSale);
  });
}

function getLocalDateInputValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function viewSavedSale(receiptNumber) {
  const sale = state.saleHistory.find(item => item.receiptNumber === receiptNumber);
  if (!sale) {
    toast('That saved receipt could not be found.');
    return;
  }
  showSavedSaleReceipt(sale);
}

function deleteSavedSale(receiptNumber) {
  const saleIndex = state.saleHistory.findIndex(item => item.receiptNumber === receiptNumber);
  if (saleIndex < 0) {
    toast('That saved sale could not be found.');
    return;
  }
  const sale = state.saleHistory[saleIndex];
  if (!confirm(`Delete receipt ${sale.receiptNumber} for ${sale.productName} and reverse its inventory and sales totals? This cannot be undone.`)) {
    return;
  }

  if (sale.isComboBundle) {
    const components = Array.isArray(sale.components) ? sale.components : [];
    const reversals = components.map(component => {
      const product = state.products.find(item => item.id === component.productId);
      return {
        component,
        product,
        stock: product ? product.stock + component.unitsSold : NaN,
        comboUnitsUsed: product ? product.comboUnitsUsed - component.unitsSold : NaN
      };
    });
    if (!reversals.length || reversals.some(({ component, product, stock, comboUnitsUsed }) =>
      !product || !Number.isSafeInteger(component.unitsSold) || component.unitsSold <= 0
      || !Number.isSafeInteger(stock) || !Number.isSafeInteger(comboUnitsUsed)
      || comboUnitsUsed < 0
    )) {
      toast('Cannot delete this combo receipt because one or more component products are missing or have invalid stock records.');
      return;
    }
    reversals.forEach(({ product, stock, comboUnitsUsed }) => {
      product.stock = stock;
      product.comboUnitsUsed = comboUnitsUsed;
    });
  } else {
    const product = state.products.find(item => item.id === sale.productId);
    if (product) {
      const stock = product.stock + sale.unitsSold;
      const totalSold = product.totalSold - sale.quantity;
      const totalSales = product.totalSales - sale.total;
      const cupSold = sale.saleType === 'combo' ? product.comboSold : product.soloSold;
      if (!Number.isSafeInteger(stock) || !Number.isSafeInteger(totalSold) || totalSold < 0
        || !Number.isFinite(totalSales) || totalSales < -Number.EPSILON
        || (sale.cupSize && (!Number.isSafeInteger(cupSold - sale.quantity)
          || cupSold - sale.quantity < 0))) {
        toast('Cannot delete this receipt because its inventory totals cannot be safely reversed.');
        return;
      }
      product.stock = stock;
      product.totalSold = totalSold;
      product.totalSales = Math.max(0, totalSales);
      if (sale.cupSize && sale.saleType === 'combo') {
        product.comboSold -= sale.quantity;
      } else if (sale.cupSize) {
        product.soloSold -= sale.quantity;
      }
    }
  }

  state.saleHistory.splice(saleIndex, 1);
  save();
  renderAll();
  toast(`Receipt ${sale.receiptNumber} deleted. Inventory and sales totals reversed.`);
}

function showSavedSaleReceipt(sale) {
  const date = new Date(sale.date);
  $('#receiptNumber').textContent = sale.receiptNumber;
  $('#receiptDate').textContent = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
  if (sale.isComboBundle) {
    $('#receiptItems').innerHTML = `
      <div class="receipt-item">
        <strong>${escapeHtml(sale.productName)}</strong>
        <span>${sale.quantity} ${sale.quantity === 1 ? 'combo' : 'combos'} × ${money(sale.price)}</span>
        <small>${(sale.components || []).map(component =>
          `${escapeHtml(component.name)}: ${component.unitsSold} ${escapeHtml(component.stockUnit)}`
        ).join('<br>')}</small>
        <strong>${money(sale.total)}</strong>
      </div>
    `;
    $('#receiptStock').textContent = `Stock after sale: ${(sale.components || []).map(component =>
      `${component.name} ${component.stockAfter} ${component.stockUnit}`
    ).join(' · ')}`;
  } else {
    const stockUnit = sale.stockUnit || 'units';
    const unitLabel = sale.unitsSold === 1
      ? stockUnit.replace(/s$/, '')
      : stockUnit;
    $('#receiptItems').innerHTML = `
      <div class="receipt-item">
        <strong>${escapeHtml(sale.productName)}${sale.cupSize ? ` (${escapeHtml(sale.cupSize)})` : ''}</strong>
        <span>${sale.quantity} ${sale.cupSize ? escapeHtml(sale.saleType) + ' sale(s)' : 'serving(s)'} × ${money(sale.price)}</span>
        <small>${sale.unitsSold} ${escapeHtml(unitLabel)} (${sale.unitsPerSale} per sale)</small>
        <strong>${money(sale.total)}</strong>
      </div>
    `;
    const product = state.products.find(item => item.id === sale.productId);
    const packSize = sale.packSize || product?.packSize || 1;
    const remaining = Number.isSafeInteger(sale.stockAfter) ? sale.stockAfter : product?.stock;
    const packLabel = sale.cupSize ? `${sale.cupSize.toLowerCase()} Gulaman pack` : 'pack';
    const leftoverLabel = sale.cupSize ? `${sale.cupSize.toLowerCase()} Gulaman cups` : stockUnit;
    $('#receiptStock').textContent = Number.isSafeInteger(remaining)
      ? `Stock after sale: ${remaining} ${stockUnit} · ${Math.floor(remaining / packSize)} full ${packLabel}${Math.floor(remaining / packSize) === 1 ? '' : 's'} + ${remaining % packSize} leftover ${leftoverLabel}`
      : 'Current product is no longer in inventory.';
  }
  $('#receiptTotal').textContent = money(sale.total);
  $('#salesReceiptDialog').showModal();
}

function updateExpenses() {
  if ($('#expensesTotal').value.trim() === '') {
    $('#allSalesTotal').textContent = '—';
    $('#netSalesTotal').textContent = '—';
    return;
  }
  const amount = Number($('#expensesTotal').value);
  if (!Number.isFinite(amount) || amount < 0) {
    $('#allSalesTotal').textContent = '—';
    $('#netSalesTotal').textContent = '—';
    return;
  }
  const selectedDate = $('#recordsDate').value || getLocalDateInputValue(new Date());
  if (amount === 0) delete state.expensesByDate[selectedDate];
  else state.expensesByDate[selectedDate] = amount;
  save();
  renderBusinessTotals();
}

function saleUnits(product, type) {
  return type === 'combo' && product.cupSize ? product.comboQty : product.saleQty;
}

function salePrice(product, type) {
  return type === 'combo' && product.cupSize ? product.comboPrice : product.price;
}

function getComboProducts() {
  const rice = state.products.find(product =>
    product.category === 'Rice' && product.name.toLocaleLowerCase() === 'java rice'
  );
  const siomai = getProductsInInventoryOrder().filter(product =>
    product.category === 'Siomai'
  );
  const dumplings = getProductsInInventoryOrder().filter(product =>
    product.category === 'Dumplings'
  );
  const gulaman = getProductsInInventoryOrder().filter(product =>
    product.category === 'Drinks' && ['Small', 'Large'].includes(product.cupSize)
  ).sort((first, second) =>
    ['Small', 'Large'].indexOf(first.cupSize) - ['Small', 'Large'].indexOf(second.cupSize)
  );
  return { rice, siomai, dumplings, gulaman };
}

function getSelectedComboProducts() {
  const { rice, siomai, dumplings, gulaman } = getComboProducts();
  const fillingType = $('#comboFillingType').value;
  const fillings = fillingType === 'Siomai' ? siomai : dumplings;
  const filling = fillings.find(product => product.id === $('#comboFilling').value);
  const drink = gulaman.find(product => product.id === $('#comboGulaman').value);
  return {
    rice,
    filling,
    fillingType,
    gulaman: drink,
    availableFillings: fillings,
    availableGulaman: gulaman
  };
}

function comboUnitsPerSale(product) {
  if (product.id === $('#comboFilling').value) {
    return Number($('#comboFillingQty').value);
  }
  return product.saleQty;
}

function comboPriceKey({ rice, filling, gulaman }) {
  return [
    rice?.id || '',
    filling?.id || '',
    $('#comboFillingQty').value,
    gulaman?.id || ''
  ].join(':');
}

function refreshComboPrice() {
  const selection = getSelectedComboProducts();
  const key = comboPriceKey(selection);
  if ($('#comboPrice').dataset.comboKey !== key) {
    $('#comboPrice').dataset.comboKey = key;
    $('#comboPrice').value = state.comboPrices[key] === undefined
      ? ''
      : String(state.comboPrices[key]);
  }
}

function renderComboCalculator() {
  const { rice, siomai, dumplings, gulaman } = getComboProducts();
  const fillingType = $('#comboFillingType').value;
  const fillings = fillingType === 'Siomai' ? siomai : dumplings;
  const previousFilling = $('#comboFilling').value;
  const previousGulaman = $('#comboGulaman').value;
  $('#comboFillingLabel').firstChild.textContent = fillingType === 'Siomai' ? 'Siomai' : 'Dumpling';
  $('#comboFilling').innerHTML = fillings.map(product =>
    `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)}</option>`
  ).join('');
  $('#comboGulaman').innerHTML = gulaman.map(product =>
    `<option value="${escapeHtml(product.id)}">${escapeHtml(product.cupSize)} Gulaman</option>`
  ).join('');
  if (fillings.some(product => product.id === previousFilling)) {
    $('#comboFilling').value = previousFilling;
  }
  if (gulaman.some(product => product.id === previousGulaman)) {
    $('#comboGulaman').value = previousGulaman;
  }
  const comboAvailable = Boolean(rice && fillings.length && gulaman.length);
  $('#comboFillingType').disabled = !siomai.length && !dumplings.length;
  $('#comboFilling').disabled = !fillings.length;
  $('#comboFillingQty').disabled = !fillings.length;
  $('#comboGulaman').disabled = !gulaman.length;
  $('#comboQuantity').disabled = !comboAvailable;
  $('#comboPrice').disabled = !comboAvailable;
  refreshComboPrice();
  calculateComboSale();
}

function changeComboFillingType() {
  const { siomai } = getComboProducts();
  const previousFillingType = $('#comboFillingType').value;
  renderComboCalculator();
  if (previousFillingType === 'Siomai' && siomai.length) {
    const selected = siomai.find(product => product.id === $('#comboFilling').value);
    $('#comboFillingQty').value = String(selected?.saleQty || 4);
  } else {
    $('#comboFillingQty').value = '1';
  }
  refreshComboPrice();
  calculateComboSale();
}

function getComboSale() {
  const selection = getSelectedComboProducts();
  const quantity = Number($('#comboQuantity').value);
  const price = Number($('#comboPrice').value);
  const components = [selection.rice, selection.filling, selection.gulaman];
  const unitsPerCombo = Object.fromEntries(components.filter(Boolean).map(product =>
    [product.id, comboUnitsPerSale(product)]
  ));
  const validComponents = components.every(product => product
    && Number.isSafeInteger(product.stock)
    && Number.isSafeInteger(unitsPerCombo[product.id])
    && unitsPerCombo[product.id] > 0);
  const quantityValid = Number.isSafeInteger(quantity) && quantity > 0;
  const priceValid = Number.isFinite(price) && price > 0;
  const stockValid = validComponents && quantityValid && components.every(product =>
    Number.isSafeInteger(quantity * unitsPerCombo[product.id])
    && quantity * unitsPerCombo[product.id] <= product.stock
    && Number.isSafeInteger(product.comboUnitsUsed + quantity * unitsPerCombo[product.id])
  );
  const total = quantity * price;
  return {
    ...selection,
    components,
    unitsPerCombo,
    quantity,
    price,
    total,
    valid: Boolean(selection.rice && selection.filling && selection.gulaman
      && quantityValid && priceValid && stockValid && Number.isFinite(total))
  };
}

function calculateComboSale() {
  const sale = getComboSale();
  if (sale.components.some(product => !product)) {
    const missing = [];
    if (!sale.rice) missing.push('Java Rice is missing from the Rice category.');
    if (!sale.availableFillings.length) {
      missing.push(`Add ${sale.fillingType.toLocaleLowerCase()} products to inventory.`);
    }
    if (!sale.availableGulaman.length) missing.push('Add Small or Large Gulaman to inventory.');
    $('#comboDetails').textContent = missing.join(' ');
    $('#comboStatus').textContent = 'The selected combo items are not available.';
    comboSaleIsValid = false;
    updateSaleReviewButton();
    return;
  }
  const componentSummary = sale.components.map(product => {
    const units = sale.quantity * sale.unitsPerCombo[product.id];
    const stockUnit = product.cupSize
      ? 'cups'
      : ['Dumplings', 'Siomai'].includes(product.category)
        ? 'pieces'
        : product.unit.toLocaleLowerCase();
    const stockUnitLabel = product.stock === 1
      ? stockUnit.replace(/s$/, '')
      : stockUnit.endsWith('s') ? stockUnit : `${stockUnit}s`;
    return `${product.name}: ${product.stock} ${stockUnitLabel} available, ${units} used`;
  }).join(' · ');
  $('#comboDetails').textContent = `${componentSummary}. Combo total: ${money(sale.total)}.`;
  const insufficientStock = sale.components.find(product =>
    Number.isSafeInteger(sale.quantity) && sale.quantity > 0
    && sale.quantity * sale.unitsPerCombo[product.id] > product.stock
  );
  if (insufficientStock) {
    $('#comboStatus').textContent = `Not enough ${insufficientStock.name} stock for that quantity.`;
  } else if (!Number.isSafeInteger(sale.quantity) || sale.quantity <= 0) {
    $('#comboStatus').textContent = 'Enter a whole number of combos greater than zero.';
  } else if (!Number.isFinite(sale.price) || sale.price <= 0) {
    $('#comboStatus').textContent = 'Enter a combo price greater than zero.';
  } else if (!Number.isFinite(sale.total)) {
    $('#comboStatus').textContent = 'The combo total is too large.';
  } else {
    $('#comboStatus').textContent = `Ready to record. This price is saved for the selected ${sale.fillingType.toLocaleLowerCase()}, piece quantity, and Gulaman size.`;
  }
  comboSaleIsValid = sale.valid;
  updateSaleReviewButton();
}

function setProductMode() {
  const isCup = $('#productMode').value === 'cup';
  $('#cupOptions').classList.toggle('hidden', !isCup);
  $('#productComboQty').disabled = !isCup;
  $('#productCupSize').disabled = !isCup;
  $('#productSaleQtyLabel').classList.toggle('hidden', isCup);
  $('#productPriceLabel').firstChild.textContent = isCup ? 'Solo cup price' : 'SRP per Serving';
  $('#productPackSizeLabel').firstChild.textContent =
    isCup ? 'Cups per pack' : 'Pieces / Units in one pack';
  $('#productPackSizeHelp').textContent =
    'Each Small or Large Gulaman pack contains 50 cups.';
  $('#productPackSizeHelp').classList.toggle('hidden', !isCup);
  $('#productStockPacksLabel').firstChild.textContent =
    isCup ? `Full ${$('#productCupSize').value.toLowerCase()} Gulaman packs` : 'Full packs';
  $('#productStockLooseLabel').firstChild.textContent =
    isCup ? `Leftover ${$('#productCupSize').value.toLowerCase()} Gulaman cups` : 'Leftover pieces / units';
  if (isCup) {
    $('#productUnit').value = 'Cup';
    $('#productPackSize').value = '50';
    $('#productSaleQty').value = '1';
  }
  $('#productPackSize').readOnly = isCup;
}

function renderCalculator() {
  servingSaleIsValid = false;
  const search = $('#calcProduct');
  const products = getProductsInInventoryOrder();
  const selectedId = products.some(product => product.id === search.dataset.productId)
    ? search.dataset.productId
    : products[0]?.id || '';
  const selectedProduct = products.find(product => product.id === selectedId);
  renderProductPickerOptions(products);
  search.dataset.productId = selectedId;
  search.value = selectedProduct ? `${selectedProduct.name} (${selectedProduct.id})` : '';
  const product = selectedProduct;
  const inputs = ['#calcPacks', '#calcLoose', '#calcServings', '#calcSrp', '#calcSaleType'];
  inputs.forEach(selector => { $(selector).disabled = !product; });
  search.disabled = !product;
  if (!product) {
    $('#calcDetails').textContent = 'Add a product to start calculating servings.';
    $('#calcStatus').textContent = 'No products available.';
    ['#calcPiecesLeft', '#calcServingsLeft', '#calcPacksLeft', '#calcLooseLeft'].forEach(selector => {
      $(selector).textContent = '0';
    });
    $('#calcSalesTotal').textContent = money(0);
    updateSaleReviewButton();
    return;
  }

  $('#calcPacks').value = String(Math.floor(product.stock / product.packSize));
  $('#calcLoose').value = String(product.stock % product.packSize);
  $('#calcServings').value = '0';
  $('#calcSaleTypeLabel').classList.toggle('hidden', !product.cupSize);
  $('#calcSaleType').value = 'solo';
  $('#calcSrp').value = String(product.price);
  const isSiomai = product.name.includes('Siomai');
  $('#calcPacksLabel').firstChild.textContent =
    product.cupSize ? `Full ${product.cupSize.toLowerCase()} Gulaman packs` : 'Full packs';
  $('#calcPacksHelp').textContent = product.cupSize
    ? `Number of full ${product.cupSize.toLowerCase()} Gulaman packs.`
    : 'Number of full packs.';
  $('#calcPiecesLabel').textContent = product.cupSize
    ? 'Cups remaining after sales'
    : 'Pieces / units remaining after sales';
  $('#calcServingsLeftLabel').textContent = product.cupSize
    ? 'Cups you can still sell'
    : 'Servings you can still sell';
  $('#calcPacksLeftLabel').textContent = product.cupSize
    ? `Full ${product.cupSize.toLowerCase()} Gulaman packs remaining`
    : 'Full packs remaining';
  $('#calculatorFormula').textContent = product.cupSize
    ? 'Available cups − (solo or combo sales × cups used per sale)'
    : 'Available stock − (servings sold × units per serving)';
  $('#calcLooseLabel').firstChild.textContent = isSiomai
    ? 'Leftover pieces'
    : product.cupSize ? `Leftover ${product.cupSize.toLowerCase()} Gulaman cups` : `Leftover ${product.unit.toLowerCase()}s`;
  $('#calcLooseHelp').textContent = isSiomai
    ? `Pieces left outside full ${product.packSize}-piece packs.`
    : product.cupSize
      ? `${product.cupSize} Gulaman cups left outside full ${product.packSize}-cup packs.`
      : `${product.unit} units left outside full packs.`;
  $('#calcLooseResultLabel').textContent = isSiomai
    ? 'Leftover pieces remaining'
    : product.cupSize ? `Leftover ${product.cupSize.toLowerCase()} Gulaman cups remaining` : 'Leftover units remaining';
  $('#calcServings').parentElement.firstChild.textContent =
    product.cupSize ? 'Cups sold' : 'Servings sold';
  $('#calcServings').nextElementSibling.textContent = product.cupSize
    ? 'Enter solo cups or combo cups sold.'
    : `One serving uses ${product.saleQty} ${isSiomai ? 'pieces' : product.unit.toLowerCase()}.`;
  updateCalculatorSaleType();
  calculateInventory();
}

function renderProductPickerOptions(products, query = '') {
  const list = $('#calcProductOptions');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = products.filter(product =>
    `${product.name} ${product.id}`.toLocaleLowerCase().includes(normalizedQuery)
  );
  list.innerHTML = matches.map((product, index) =>
    `<span id="calcProductOption${index}" class="product-picker-option" role="option" aria-selected="${product.id === $('#calcProduct').dataset.productId}" data-product-id="${escapeHtml(product.id)}">${escapeHtml(product.name)} <small>${escapeHtml(product.id)}</small></span>`
  ).join('') || '<span class="product-picker-empty">No matching products.</span>';
  list.querySelectorAll('[data-product-id]').forEach(option => {
    option.onmousedown = event => event.preventDefault();
    option.onclick = () => selectCalculatorProduct(option.dataset.productId);
  });
  $('#calcProduct').setAttribute('aria-activedescendant', '');
}

function setProductPickerOpen(isOpen, query = $('#calcProduct').value) {
  const search = $('#calcProduct');
  const list = $('#calcProductOptions');
  const toggle = $('#calcProductToggle');
  list.hidden = !isOpen;
  search.setAttribute('aria-expanded', String(isOpen));
  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.setAttribute('aria-label', isOpen ? 'Hide product choices' : 'Show product choices');
  if (isOpen) {
    renderProductPickerOptions(getProductsInInventoryOrder(), query);
  } else {
    search.setAttribute('aria-activedescendant', '');
  }
}

function selectCalculatorProduct(id) {
  const search = $('#calcProduct');
  const product = state.products.find(item => item.id === id);
  if (!product) return;
  search.dataset.productId = product.id;
  setProductPickerOpen(false);
  renderCalculator();
}

function moveProductPickerActiveOption(direction) {
  const list = $('#calcProductOptions');
  const options = [...list.querySelectorAll('[role="option"]')];
  if (!options.length) return;
  const activeId = $('#calcProduct').getAttribute('aria-activedescendant');
  const currentIndex = options.findIndex(option => option.id === activeId);
  const nextIndex = currentIndex < 0
    ? direction > 0 ? 0 : options.length - 1
    : (currentIndex + direction + options.length) % options.length;
  const nextOption = options[nextIndex];
  $('#calcProduct').setAttribute('aria-activedescendant', nextOption.id);
  options.forEach(option => option.classList.toggle('active', option === nextOption));
  nextOption.scrollIntoView({ block: 'nearest' });
}

function updateCalculatorSaleType() {
  const product = state.products.find(item => item.id === $('#calcProduct').dataset.productId);
  if (!product) return;
  const type = product.cupSize ? $('#calcSaleType').value : 'solo';
  if (product.cupSize) {
    $('#calcServings').parentElement.firstChild.textContent =
      type === 'combo' ? 'Number of combo sales' : 'Solo cups sold';
    $('#calcServings').nextElementSibling.textContent =
      type === 'combo'
        ? `Each combo uses ${product.comboQty} ${product.cupSize.toLowerCase()} cup(s).`
        : 'Enter the number of individual cups sold.';
    $('#calcServingsLeftLabel').textContent =
      type === 'combo' ? 'Combos you can still sell' : 'Solo cups you can still sell';
    $('#calcSrp').parentElement.firstChild.textContent =
      type === 'combo' ? 'Combo price' : 'Solo cup price';
    $('#calcSrp').nextElementSibling.textContent =
      type === 'combo' ? 'The amount charged for one combo.' : 'The amount charged for one solo cup.';
    $('#calcSaleTypeHelp').textContent =
      `One ${type} sale uses ${saleUnits(product, type)} ${product.cupSize.toLowerCase()} cup(s).`;
  } else {
    $('#calcServings').parentElement.firstChild.textContent = 'Servings sold';
    $('#calcServings').nextElementSibling.textContent =
      `One serving uses ${product.saleQty} ${product.name.includes('Siomai') ? 'pieces' : product.unit.toLowerCase()}.`;
    $('#calcServingsLeftLabel').textContent = 'Servings you can still sell';
    $('#calcSrp').parentElement.firstChild.textContent = 'Price per serving';
    $('#calcSrp').nextElementSibling.textContent = 'The amount charged for one serving.';
  }
}

function calculateInventory() {
  const product = state.products.find(item => item.id === $('#calcProduct').dataset.productId);
  if (!product) return renderCalculator();
  const isSiomai = product.name.includes('Siomai');

  const packs = Number($('#calcPacks').value);
  const loose = Number($('#calcLoose').value);
  const servings = Number($('#calcServings').value);
  const type = product.cupSize ? $('#calcSaleType').value : 'solo';
  const unitsPerSale = saleUnits(product, type);
  const srp = Number($('#calcSrp').value);
  const priceConfigured = !product.cupSize || srp > 0;
  const valuesValid = Number.isSafeInteger(packs) && packs >= 0
    && Number.isSafeInteger(loose) && loose >= 0 && loose < product.packSize
    && Number.isSafeInteger(servings) && servings >= 0
    && Number.isFinite(srp) && srp >= 0;
  if (!valuesValid) {
    ['#calcPiecesLeft', '#calcServingsLeft', '#calcPacksLeft', '#calcLooseLeft'].forEach(selector => {
      $(selector).textContent = '—';
    });
    $('#calcSalesTotal').textContent = '—';
    $('#calcDetails').textContent = product.cupSize
      ? `One pack contains ${product.packSize} ${product.cupSize.toLowerCase()} Gulaman cups.`
      : `One pack contains ${product.packSize} pieces; one serving uses ${product.saleQty} pieces.`;
    $('#calcStatus').textContent = 'Enter valid whole-number stock and servings.';
    servingSaleIsValid = false;
    updateSaleReviewButton();
    return;
  }

  const startingPieces = packs * product.packSize + loose;
  const piecesSold = servings * unitsPerSale;
  const piecesLeft = startingPieces - piecesSold;
  const totalSales = servings * srp;
  const calculationValid = Number.isSafeInteger(startingPieces)
    && Number.isSafeInteger(piecesSold)
    && piecesSold <= startingPieces
    && Number.isFinite(totalSales)
    && priceConfigured;
  if (!calculationValid) {
    $('#calcPiecesLeft').textContent = '—';
    $('#calcServingsLeft').textContent = '—';
    $('#calcPacksLeft').textContent = '—';
    $('#calcLooseLeft').textContent = '—';
    $('#calcSalesTotal').textContent = money(totalSales);
    $('#calcDetails').textContent = product.cupSize
      ? `One pack contains ${product.packSize} ${product.cupSize.toLowerCase()} Gulaman cups.`
      : `One pack contains ${product.packSize} pieces; one serving uses ${product.saleQty} pieces.`;
    $('#calcStatus').textContent = piecesSold > startingPieces
      ? 'Sales exceed the available stock.'
      : 'Enter a price greater than zero for this cup sale.';
    servingSaleIsValid = false;
    updateSaleReviewButton();
    return;
  }

  const packsLeft = Math.floor(piecesLeft / product.packSize);
  const looseLeft = piecesLeft % product.packSize;
  $('#calcPiecesLeft').textContent = String(piecesLeft);
  $('#calcServingsLeft').textContent = String(Math.floor(piecesLeft / unitsPerSale));
  $('#calcPacksLeft').textContent = String(packsLeft);
  $('#calcLooseLeft').textContent = String(looseLeft);
  $('#calcSalesTotal').textContent = money(totalSales);
  $('#calcDetails').textContent = product.cupSize
    ? `${packs} ${product.cupSize.toLowerCase()} Gulaman pack${packs === 1 ? '' : 's'} × ${product.packSize} cups + ${loose} leftover cups − (${servings} ${type} sales × ${unitsPerSale} cup) = ${piecesLeft} cups left.`
    : `${packs} pack(s) × ${product.packSize} pcs + ${loose} leftover ${isSiomai ? 'pieces' : escapeHtml(product.unit.toLowerCase())} − (${servings} servings × ${unitsPerSale} pcs) = ${piecesLeft} pcs left.`;
  $('#calcStatus').textContent = servings > 0
    ? product.cupSize ? `Ready to record ${type} cup sales.` : 'Ready to record. The entered SRP will be saved for this product.'
    : product.cupSize
      ? `Enter ${type === 'combo' ? 'combos' : 'solo cups'} sold to calculate the total.`
      : 'Enter servings sold to calculate the sale total.';
  servingSaleIsValid = servings > 0;
  updateSaleReviewButton();
}

function selectCalculatorSaleType() {
  const product = state.products.find(item => item.id === $('#calcProduct').dataset.productId);
  if (!product) return;
  const type = product.cupSize ? $('#calcSaleType').value : 'solo';
  $('#calcSrp').value = String(salePrice(product, type));
  updateCalculatorSaleType();
  calculateInventory();
}

function openSaleReview() {
  editingSaleReceiptNumber = '';
  reviewedSaleMode = $('#saleMode').value;
  const isCombo = reviewedSaleMode === 'combo';
  $('#saleReviewTitle').textContent = isCombo ? 'Review Combo Sale' : 'Review Serving Sale';
  $('#saleReviewQuantityLabel').firstChild.textContent = isCombo ? 'Combos sold' : 'Servings sold';
  $('#saleReviewPriceLabel').firstChild.textContent = isCombo ? 'Price per combo' : 'Price per serving';
  $('#saleReviewQuantity').value = isCombo ? $('#comboQuantity').value : $('#calcServings').value;
  $('#saleReviewPrice').value = isCombo ? $('#comboPrice').value : $('#calcSrp').value;
  $('#saleReviewPrice').min = isCombo || state.products.find(product =>
    product.id === $('#calcProduct').dataset.productId
  )?.cupSize ? '0.01' : '0';
  updateSaleReview();
  $('#saleReviewDialog').showModal();
}

function openSavedSaleEditor(receiptNumber) {
  const sale = state.saleHistory.find(item => item.receiptNumber === receiptNumber);
  if (!sale) {
    toast('That saved sale could not be found.');
    return;
  }
  editingSaleReceiptNumber = receiptNumber;
  reviewedSaleMode = sale.isComboBundle ? 'combo' : 'serving';
  $('#saleReviewTitle').textContent = 'Edit Saved Sale';
  $('#saleReviewQuantityLabel').firstChild.textContent = sale.isComboBundle ? 'Combos sold' : 'Servings sold';
  $('#saleReviewPriceLabel').firstChild.textContent = sale.isComboBundle ? 'Price per combo' : 'Price per serving';
  $('#saleReviewPrice').min = sale.isComboBundle || sale.cupSize ? '0.01' : '0';
  $('#saleReviewQuantity').value = String(sale.quantity);
  $('#saleReviewPrice').value = String(sale.price);
  $('#saleReviewDescription').textContent = `${sale.productName} · ${sale.receiptNumber}`;
  updateSaleReview();
  $('#saleReviewDialog').showModal();
}

function updateSaleReview() {
  const quantity = Number($('#saleReviewQuantity').value);
  const price = Number($('#saleReviewPrice').value);
  const quantityValid = Number.isSafeInteger(quantity) && quantity > 0;
  const priceValid = $('#saleReviewPrice').value.trim() !== ''
    && Number.isFinite(price) && price >= Number($('#saleReviewPrice').min);
  const total = quantity * price;
  let components = [];
  let stockValid = quantityValid && priceValid && Number.isFinite(total);
  let description = '';
  let status = '';

  if (editingSaleReceiptNumber) {
    const sale = state.saleHistory.find(item =>
      item.receiptNumber === editingSaleReceiptNumber
    );
    if (!sale) {
      stockValid = false;
      status = 'This saved sale is no longer available.';
    } else if (sale.isComboBundle) {
      const components = Array.isArray(sale.components) ? sale.components : [];
      if (!components.length) {
        stockValid = false;
        status = 'This saved combo has no component stock details and cannot be edited.';
      }
      const changedComponents = components.map(component => {
        const product = state.products.find(item => item.id === component.productId);
        const oldUnits = component.unitsSold;
        const unitsPerCombo = Number.isSafeInteger(oldUnits / sale.quantity)
          ? oldUnits / sale.quantity
          : 0;
        const newUnits = quantityValid ? quantity * unitsPerCombo : 0;
        const remaining = product ? product.stock + oldUnits - newUnits : NaN;
        return { component, product, oldUnits, newUnits, remaining };
      });
      if (changedComponents.some(item => !item.product || !Number.isSafeInteger(item.remaining)
        || item.remaining < 0 || !Number.isSafeInteger(item.product.comboUnitsUsed - item.oldUnits + item.newUnits))) {
        stockValid = false;
        status = 'A combo item is missing or would have insufficient stock after this correction.';
      }
      $('#saleReviewComponents').innerHTML = changedComponents.map(({ component, product, oldUnits, newUnits, remaining }) =>
        `<div class="sale-review-component"><span>${escapeHtml(component.name)}: ${product ? product.stock : 'Unavailable'} + ${oldUnits} reversed − ${newUnits} corrected ${escapeHtml(component.stockUnit)}</span><strong>${Number.isSafeInteger(remaining) && remaining >= 0 ? `${remaining} left` : 'Cannot apply correction'}</strong></div>`
      ).join('');
    } else {
      const product = state.products.find(item => item.id === sale.productId);
      const oldUnits = sale.unitsSold;
      const newUnits = quantityValid ? quantity * sale.unitsPerSale : 0;
      const remaining = product ? product.stock + oldUnits - newUnits : NaN;
      if (!product || !Number.isSafeInteger(newUnits) || !Number.isSafeInteger(remaining)
        || remaining < 0
        || !Number.isSafeInteger(product.totalSold - sale.quantity + quantity)
        || !Number.isFinite(product.totalSales - sale.total + total)
        || (sale.cupSize && sale.saleType === 'combo'
          && !Number.isSafeInteger(product.comboSold - sale.quantity + quantity))
        || (sale.cupSize && sale.saleType !== 'combo'
          && !Number.isSafeInteger(product.soloSold - sale.quantity + quantity))) {
        stockValid = false;
        status = 'The corrected quantity would leave insufficient stock or invalid totals.';
      }
      const stockUnit = sale.stockUnit || 'units';
      $('#saleReviewComponents').innerHTML = `<div class="sale-review-component"><span>${escapeHtml(sale.productName)}: ${product ? product.stock : 'Unavailable'} + ${oldUnits} reversed − ${newUnits} corrected ${escapeHtml(stockUnit)}</span><strong>${Number.isSafeInteger(remaining) && remaining >= 0 ? `${remaining} left` : 'Cannot apply correction'}</strong></div>`;
    }
  } else if (reviewedSaleMode === 'combo') {
    const sale = getSelectedComboProducts();
    components = [sale.rice, sale.filling, sale.gulaman];
    description = `Combo: ${components.filter(Boolean).map(product => product.name).join(' + ')}`;
    if (components.some(product => !product)) {
      stockValid = false;
      status = 'Java Rice, a Siomai or dumpling, and a Gulaman size are required for this combo.';
    }
    if (stockValid) {
      stockValid = components.every(product => {
        const unitsPerCombo = comboUnitsPerSale(product);
        return Number.isSafeInteger(unitsPerCombo) && unitsPerCombo > 0
          && Number.isSafeInteger(quantity * unitsPerCombo)
          && quantity * unitsPerCombo <= product.stock
          && Number.isSafeInteger(product.comboUnitsUsed + quantity * unitsPerCombo);
      });
      if (!stockValid) status = 'Not enough component stock for this quantity.';
    }
    $('#saleReviewComponents').innerHTML = components.filter(Boolean).map(product => {
      const units = quantityValid ? quantity * comboUnitsPerSale(product) : 0;
      const remaining = product.stock - units;
      const unit = product.cupSize
        ? 'cups'
        : ['Dumplings', 'Siomai'].includes(product.category)
          ? 'pieces'
          : product.unit.toLocaleLowerCase();
      const unitLabel = units === 1 || unit.endsWith('s') ? unit : `${unit}s`;
      return `<div class="sale-review-component"><span>${escapeHtml(product.name)}: ${product.stock} − ${units} ${escapeHtml(unitLabel)}</span><strong>${Number.isSafeInteger(remaining) && remaining >= 0 ? `${remaining} left` : 'Not enough stock'}</strong></div>`;
    }).join('');
  } else {
    const product = state.products.find(item => item.id === $('#calcProduct').dataset.productId);
    const packs = Number($('#calcPacks').value);
    const loose = Number($('#calcLoose').value);
    const type = product?.cupSize ? $('#calcSaleType').value : 'solo';
    const unitsPerSale = product ? saleUnits(product, type) : 0;
    const stockBefore = product ? packs * product.packSize + loose : NaN;
    const units = quantityValid ? quantity * unitsPerSale : 0;
    const stockAfter = stockBefore - units;
    description = product ? `${product.name} · ${type === 'combo' ? 'Combo cup sale' : product.cupSize ? 'Solo cup sale' : 'Serving sale'}` : '';
    components = product ? [product] : [];
    stockValid = Boolean(product && quantityValid && priceValid
      && Number.isSafeInteger(packs) && packs >= 0
      && Number.isSafeInteger(loose) && loose >= 0 && loose < product.packSize
      && Number.isSafeInteger(units)
      && units <= stockBefore
      && Number.isSafeInteger(product.totalSold + quantity)
      && Number.isFinite(product.totalSales + quantity * price)
      && (type !== 'solo' || !product.cupSize || Number.isSafeInteger(product.soloSold + quantity))
      && (type !== 'combo' || !product.cupSize || Number.isSafeInteger(product.comboSold + quantity))
      && Number.isFinite(total));
    if (!product) status = 'Choose a product before reviewing this sale.';
    else if (stockBefore !== product.stock) status = `Entered stock count (${stockBefore}) differs from saved stock (${product.stock}). Confirming will use the entered count and update stock after the sale.`;
    else if (!stockValid) status = 'Check the quantity, price, and available stock.';
    if (product) {
      const unit = product.cupSize
        ? 'cups'
        : product.name.toLocaleLowerCase().includes('siomai')
          ? 'pieces'
          : product.unit.toLocaleLowerCase();
      $('#saleReviewComponents').innerHTML = `<div class="sale-review-component"><span>${escapeHtml(product.name)}: ${Number.isSafeInteger(stockBefore) ? stockBefore : '—'} − ${units} ${escapeHtml(unit)}</span><strong>${Number.isSafeInteger(stockAfter) && stockAfter >= 0 ? `${stockAfter} left` : 'Not enough stock'}</strong></div>`;
    } else {
      $('#saleReviewComponents').innerHTML = '';
    }
  }

  if (!status && stockValid) status = editingSaleReceiptNumber
    ? 'Review the correction. Inventory and this receipt will update when confirmed.'
    : 'Check the sale details and stock impact, then confirm to save.';
  if (!quantityValid) status = 'Enter a whole-number quantity greater than zero.';
  else if (!priceValid) status = `Enter a price of at least ${money(Number($('#saleReviewPrice').min))}.`;
  else if (!Number.isFinite(total)) status = 'The sale total is too large.';
  $('#saleReviewDescription').textContent = description;
  $('#saleReviewStatus').textContent = status;
  $('#saleReviewTotal').textContent = Number.isFinite(total) ? money(total) : '—';
  $('#confirmSaleBtn').disabled = !stockValid;
}

function confirmReviewedSale() {
  updateSaleReview();
  if ($('#confirmSaleBtn').disabled) return;
  const quantity = Number($('#saleReviewQuantity').value);
  const price = Number($('#saleReviewPrice').value);
  let saved = false;
  if (editingSaleReceiptNumber) {
    saved = saveEditedSale(editingSaleReceiptNumber, quantity, price);
  } else if (reviewedSaleMode === 'combo') {
    $('#comboQuantity').value = String(quantity);
    $('#comboPrice').value = String(price);
    $('#saleReviewDialog').close();
    saved = recordComboSale();
  } else {
    $('#calcServings').value = String(quantity);
    $('#calcSrp').value = String(price);
    $('#saleReviewDialog').close();
    saved = recordCalculatorSale();
  }
  if (saved && $('#saleReviewDialog').open) $('#saleReviewDialog').close();
}

function saveEditedSale(receiptNumber, quantity, price) {
  const sale = state.saleHistory.find(item => item.receiptNumber === receiptNumber);
  if (!sale) {
    toast('That saved sale could not be found.');
    editingSaleReceiptNumber = '';
    return false;
  }
  const total = quantity * price;
  if (!Number.isSafeInteger(quantity) || quantity <= 0
    || !Number.isFinite(price) || price < 0 || !Number.isFinite(total)) {
    toast('Enter a valid quantity and price for this saved sale.');
    return false;
  }
  if (sale.isComboBundle) {
    const corrections = (sale.components || []).map(component => {
      const product = state.products.find(item => item.id === component.productId);
      const unitsPerCombo = component.unitsSold / sale.quantity;
      const unitsSold = quantity * unitsPerCombo;
      const stock = product ? product.stock + component.unitsSold - unitsSold : NaN;
      return { component, product, unitsPerCombo, unitsSold, stock };
    });
    if (!corrections.length || corrections.some(({ product, component, unitsPerCombo, unitsSold, stock }) =>
      !product || !Number.isSafeInteger(unitsPerCombo) || unitsPerCombo <= 0
      || !Number.isSafeInteger(unitsSold) || !Number.isSafeInteger(stock) || stock < 0
      || !Number.isSafeInteger(product.comboUnitsUsed - component.unitsSold + unitsSold)
    )) {
      toast('The saved combo cannot be corrected with the current stock.');
      return false;
    }
    corrections.forEach(({ component, product, unitsSold, stock }) => {
      product.stock = stock;
      product.comboUnitsUsed += unitsSold - component.unitsSold;
      component.stockAfter = component.stockBefore - unitsSold;
      component.unitsSold = unitsSold;
    });
  } else {
    const product = state.products.find(item => item.id === sale.productId);
    const unitsSold = quantity * sale.unitsPerSale;
    const stock = product ? product.stock + sale.unitsSold - unitsSold : NaN;
    const totalSold = product ? product.totalSold - sale.quantity + quantity : NaN;
    const totalSales = product ? product.totalSales - sale.total + total : NaN;
    const cupSold = sale.saleType === 'combo' ? product?.comboSold : product?.soloSold;
    if (!product || !Number.isSafeInteger(unitsSold) || !Number.isSafeInteger(stock)
      || stock < 0 || !Number.isSafeInteger(totalSold) || totalSold < 0
      || !Number.isFinite(totalSales) || totalSales < 0
      || (sale.cupSize && (!Number.isSafeInteger(cupSold - sale.quantity + quantity)
        || cupSold - sale.quantity + quantity < 0))) {
      toast('The saved sale cannot be corrected with the current stock or totals.');
      return false;
    }
    product.stock = stock;
    product.totalSold = totalSold;
    product.totalSales = totalSales;
    if (sale.cupSize && sale.saleType === 'combo') {
      product.comboSold += quantity - sale.quantity;
    } else if (sale.cupSize) {
      product.soloSold += quantity - sale.quantity;
    }
    sale.unitsSold = unitsSold;
    sale.stockAfter = sale.stockBefore - unitsSold;
  }
  sale.quantity = quantity;
  sale.price = price;
  sale.total = total;
  editingSaleReceiptNumber = '';
  save();
  renderAll();
  toast(`Receipt ${sale.receiptNumber} updated. Inventory and sales totals corrected.`);
  return true;
}

function returnToSaleEditor() {
  const quantity = $('#saleReviewQuantity').value;
  const price = $('#saleReviewPrice').value;
  $('#saleReviewDialog').close();
  if (editingSaleReceiptNumber) {
    editingSaleReceiptNumber = '';
    return;
  }
  if (reviewedSaleMode === 'combo') {
    $('#comboQuantity').value = quantity;
    $('#comboPrice').value = price;
    calculateComboSale();
  } else {
    $('#calcServings').value = quantity;
    $('#calcSrp').value = price;
    calculateInventory();
  }
}

function recordCalculatorSale() {
  const product = state.products.find(item => item.id === $('#calcProduct').dataset.productId);
  if (!product) return false;
  const packs = Number($('#calcPacks').value);
  const loose = Number($('#calcLoose').value);
  const servings = Number($('#calcServings').value);
  const srp = Number($('#calcSrp').value);
  const type = product.cupSize ? $('#calcSaleType').value : 'solo';
  const unitsPerSale = saleUnits(product, type);
  const piecesSold = servings * unitsPerSale;
  const piecesAvailable = packs * product.packSize + loose;
  if (!Number.isSafeInteger(packs) || packs < 0
    || !Number.isSafeInteger(loose) || loose < 0 || loose >= product.packSize
    || !Number.isSafeInteger(servings) || servings <= 0
    || !Number.isFinite(srp) || srp < 0
    || (product.cupSize && srp === 0)
    || !Number.isSafeInteger(piecesAvailable)
    || !Number.isSafeInteger(piecesSold) || piecesSold > piecesAvailable
    || !Number.isSafeInteger(product.totalSold + servings)
    || !Number.isFinite(product.totalSales + servings * srp)
    || (type === 'solo' && !Number.isSafeInteger(product.soloSold + servings))
    || (type === 'combo' && !Number.isSafeInteger(product.comboSold + servings))) {
    toast('Check the stock and serving quantities before recording.');
    return false;
  }
  product.totalSold += servings;
  if (type === 'combo' && product.cupSize) {
    product.comboSold += servings;
    product.comboPrice = srp;
  } else if (product.cupSize) {
    product.soloSold += servings;
    product.price = srp;
  } else {
    product.price = srp;
  }
  const saleTotal = servings * srp;
  const recordedAt = new Date();
  const transaction = {
    receiptNumber: createReceiptNumber(recordedAt),
    date: recordedAt.toISOString(),
    productId: product.id,
    productName: product.name,
    category: product.category,
    cupSize: product.cupSize,
    saleType: type,
    quantity: servings,
    unitsSold: piecesSold,
    unitsPerSale,
    stockUnit: product.cupSize ? 'cups' : product.name.includes('Siomai') ? 'pieces' : product.unit,
    price: srp,
    total: saleTotal,
    stockBefore: piecesAvailable,
    stockAfter: piecesAvailable - piecesSold,
    packSize: product.packSize
  };
  product.stock = transaction.stockAfter;
  product.totalSales += saleTotal;
  state.saleHistory.push(transaction);
  save();
  renderAll();
  toast(`Recorded ${servings} ${product.cupSize ? type + ' cups' : 'servings'} of ${product.name}: ${piecesSold} units sold, ${money(saleTotal)} total. View the receipt in Records of the Day.`);
  return true;
}

function recordComboSale() {
  const sale = getComboSale();
  if (!sale.valid) {
    calculateComboSale();
    return false;
  }
  const components = sale.components.map(product => {
    const unitsPerCombo = sale.unitsPerCombo[product.id];
    const unitsSold = sale.quantity * unitsPerCombo;
    return {
      product,
      productId: product.id,
      name: product.name,
      unitsSold,
      unitsPerCombo,
      stockUnit: product.cupSize
        ? 'cups'
        : ['Dumplings', 'Siomai'].includes(product.category)
          ? 'pieces'
          : product.unit.toLocaleLowerCase(),
      stockBefore: product.stock,
      stockAfter: product.stock - unitsSold
    };
  });
  const recordedAt = new Date();
  const transaction = {
    receiptNumber: createReceiptNumber(recordedAt),
    date: recordedAt.toISOString(),
    productId: 'COMBO',
    productName: components.map(component => component.name).join(' + '),
    category: 'Combo',
    saleType: `Rice + ${sale.fillingType} + Gulaman`,
    isComboBundle: true,
    quantity: sale.quantity,
    unitsSold: sale.quantity,
    unitsPerSale: 1,
    stockUnit: 'combos',
    price: sale.price,
    total: sale.total,
    stockBefore: '',
    stockAfter: '',
    components: components.map(({ product: _product, ...component }) => component)
  };
  components.forEach(({ product, unitsSold, stockAfter }) => {
    product.stock = stockAfter;
    product.comboUnitsUsed += unitsSold;
  });
  state.comboPrices[comboPriceKey(sale)] = sale.price;
  state.saleHistory.push(transaction);
  save();
  renderAll();
  toast(`Recorded ${sale.quantity} ${sale.quantity === 1 ? 'combo' : 'combos'} for ${money(sale.total)}. View the receipt in Records of the Day.`);
  return true;
}

function createReceiptNumber(date) {
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('');
  const timePart = [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0')
  ].join('');
  const sequence = String(state.saleHistory.length + 1).padStart(4, '0');
  return `SK-${datePart}-${timePart}-${sequence}`;
}

function printSalesReceipt() {
  const printArea = document.createElement('section');
  printArea.id = 'printReceipt';
  printArea.append($('#salesReceipt').cloneNode(true));
  document.body.append(printArea);
  document.body.classList.add('printing-receipt');
  const cleanup = () => {
    document.body.classList.remove('printing-receipt');
    printArea.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 1000);
}

function openStockDialog(id) {
  const product = state.products.find(item => item.id === id);
  $('#stockProductId').value = product.id;
  $('#stockDialogTitle').textContent = 'Adjust Stock Count';
  $('#stockProductSummary').textContent =
    product.cupSize
      ? `${product.name}: one pack contains ${product.packSize} ${product.cupSize.toLowerCase()} Gulaman cups.`
      : `${product.name}: one pack contains ${product.packSize} pcs/units.`;
  $('#stockPacksLabel').firstChild.textContent =
    product.cupSize ? `Full ${product.cupSize.toLowerCase()} Gulaman packs` : 'Full packs';
  $('#stockLooseLabel').firstChild.textContent =
    product.cupSize ? `Leftover ${product.cupSize.toLowerCase()} Gulaman cups` : product.name.includes('Siomai')
      ? 'Leftover pieces'
      : `Leftover ${product.unit.toLowerCase()}s`;
  $('#stockPacks').value = String(Math.floor(product.stock / product.packSize));
  $('#stockLoose').value = String(product.stock % product.packSize);
  $('#stockDialog').showModal();
}

function saveStock(event) {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const product = state.products.find(item => item.id === $('#stockProductId').value);
  const packs = Number($('#stockPacks').value);
  const loose = Number($('#stockLoose').value);
  if (!product || !Number.isSafeInteger(packs) || packs < 0
    || !Number.isSafeInteger(loose) || loose < 0
    || loose >= product.packSize) {
    toast('Enter valid whole-number pack and leftover-unit counts.');
    return;
  }
  const quantity = packs * product.packSize + loose;
  if (!Number.isSafeInteger(quantity)) {
    toast('That stock quantity is too large.');
    return;
  }
  product.stock = quantity;
  save();
  $('#stockDialog').close();
  renderAll();
  toast(`${product.name} stock updated.`);
}

function openProduct(id = '') {
  const product = state.products.find(item => item.id === id);
  renderProductCategoryOptions();
  $('#dialogTitle').textContent = product ? 'Edit Product' : 'Add Product';
  $('#editId').value = product?.id || '';
  $('#productId').value = product?.id || '';
  $('#productId').disabled = Boolean(product);
  $('#productName').value = product?.name || '';
  $('#productCategory').value = product?.category || (product ? inferProductCategory(product) : 'Siomai');
  $('#productUnit').value = product?.unit || '';
  $('#productCost').value = product?.cost ?? 0;
  $('#productPackSize').value = product?.packSize
    ?? (product?.name === 'Japanese Siomai' ? 30 : product?.name?.includes('Siomai') ? 60 : 1);
  $('#productSaleQty').value = product?.saleQty
    ?? (product?.name?.includes('Siomai') ? 4 : 1);
  $('#productPrice').value = product?.price ?? 0;
  $('#productMode').value = product?.cupSize ? 'cup' : 'regular';
  $('#productCupSize').value = product?.cupSize || 'Small';
  $('#productComboQty').value = product?.comboQty ?? 1;
  $('#productStockPacks').value = product
    ? Math.floor(product.stock / product.packSize)
    : 0;
  $('#productStockLoose').value = product ? product.stock % product.packSize : 0;
  $('#productReorder').value = product?.reorder ?? 0;
  setProductMode();
  $('#productDialog').showModal();
}

function deleteProduct(id) {
  const product = state.products.find(item => item.id === id);
  if (!confirm(`Delete ${product.name} from inventory?`)) return;
  state.products = state.products.filter(item => item.id !== id);
  save();
  renderAll();
  toast('Product deleted.');
}

function saveProduct(event) {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const editingId = $('#editId').value;
  const id = editingId || $('#productId').value.trim();
  const stockPacks = Number($('#productStockPacks').value);
  const stockLoose = Number($('#productStockLoose').value);
  const cupSize = $('#productMode').value === 'cup' ? $('#productCupSize').value : '';
  const packSize = cupSize ? 50 : Number($('#productPackSize').value);
  const stock = stockPacks * packSize + stockLoose;
  const product = {
    id,
    name: $('#productName').value.trim(),
    category: $('#productCategory').value,
    unit: $('#productUnit').value.trim(),
    cost: Number($('#productCost').value),
    packSize,
    saleQty: cupSize ? 1 : Number($('#productSaleQty').value),
    comboQty: cupSize ? Number($('#productComboQty').value) : 1,
    comboPrice: cupSize
      ? state.products.find(item => item.id === editingId)?.comboPrice ?? 0
      : 0,
    cupSize,
    price: Number($('#productPrice').value),
    stock,
    reorder: Number($('#productReorder').value)
  };
  if (state.products.some(item => item.id === id && item.id !== editingId)) {
    toast('That item ID is already in use.');
    return;
  }
  if (!product.id || !product.name || !product.unit
    || !productCategoryOrder.includes(product.category)
    || !Number.isFinite(product.cost) || product.cost < 0
    || !Number.isFinite(product.price) || product.price < 0
    || !Number.isSafeInteger(product.packSize) || product.packSize <= 0
    || !Number.isSafeInteger(product.saleQty) || product.saleQty <= 0
    || !Number.isSafeInteger(product.comboQty) || product.comboQty <= 0
    || !Number.isSafeInteger(stockPacks) || stockPacks < 0
    || !Number.isSafeInteger(stockLoose) || stockLoose < 0
    || stockLoose >= product.packSize
    || !Number.isSafeInteger(stock) || stock < 0
    || !Number.isSafeInteger(product.reorder) || product.reorder < 0) {
    toast('Enter valid product details before saving.');
    return;
  }
  const existing = state.products.find(item => item.id === editingId);
  if (existing) Object.assign(existing, product);
  else {
    product.totalSold = 0;
    product.soloSold = 0;
    product.comboSold = 0;
    product.comboUnitsUsed = 0;
    product.totalSales = 0;
  }
  if (!existing) state.products.push(product);
  save();
  $('#productDialog').close();
  renderAll();
  toast('Product saved.');
}

function getInventoryReport(date) {
  const reportSales = getSalesForDate(date);
  const inventoryGroups = productCategoryOrder.map(category => ({
    category,
    products: sortProductsByInventoryOrder(
      state.products.filter(product => product.category === category)
    ).map(product => {
      return {
        name: product.name,
        quantity: product.unit,
        price: product.price,
        sold: reportSales.reduce((total, sale) => total
          + (sale.isComboBundle
            ? (sale.components || []).reduce((componentTotal, component) =>
              componentTotal + (component.productId === product.id ? component.unitsSold : 0), 0)
            : sale.productId === product.id ? sale.unitsSold : 0), 0),
        earnings: getProductSalesForDate(product.id, date),
        leftOver: product.stock % product.packSize,
        endingStock: Math.floor(product.stock / product.packSize)
      };
    })
  })).filter(group => group.products.length);
  return {
    title: 'Siomai King Inventory',
    date,
    inventoryGroups,
    expenses: getExpensesForDate(date),
    productEarnings: inventoryGroups
      .flatMap(group => group.products)
      .reduce((total, product) => total + product.earnings, 0),
    comboEarnings: reportSales.reduce((total, sale) =>
      sale.isComboBundle ? total + sale.total : total, 0),
    totalSales: reportSales.reduce((total, sale) => total + sale.total, 0)
  };
}

function openReportDialog() {
  const today = new Date();
  $('#reportDate').value = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');
  $('#reportDialog').showModal();
}

function getReportDetails() {
  const date = $('#reportDate').value;
  if (!date) {
    toast('Enter a report date first.');
    return null;
  }
  return getInventoryReport(date);
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function getReportFileName(report, extension) {
  const safeName = report.title.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLocaleLowerCase() || 'inventory-report';
  return `${safeName}-${report.date}.${extension}`;
}

function renderReportContents(report) {
  return `
    <header class="worksheet-header">
      <div><span>DATE:</span> ${escapeHtml(report.date)}</div>
    </header>
    <table class="inventory-worksheet">
      <thead><tr>${inventoryWorksheetHeaders.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${report.inventoryGroups.map(group => `
        <tr class="worksheet-category"><th colspan="${inventoryWorksheetHeaders.length}">${escapeHtml(group.category)}</th></tr>
        ${group.products.map((product, index) => `<tr class="${index % 2 === 0 ? 'worksheet-shaded' : ''}">
          <td>${escapeHtml(product.name)}</td>
          <td>${escapeHtml(product.quantity)}</td>
          <td>${escapeHtml(money(product.price))}</td>
          <td></td>
          <td></td>
          <td>${escapeHtml(product.sold)}</td>
          <td>${escapeHtml(product.leftOver)}</td>
          <td>${escapeHtml(product.endingStock)}</td>
          <td></td>
          <td>${escapeHtml(money(product.earnings))}</td>
        </tr>`).join('')}
      `).join('')}</tbody>
    </table>
    <div class="worksheet-notes">
      <div><strong>SIOMAI TRAY -</strong><span></span><strong>GARLIC -</strong><span></span></div>
    </div>
    <footer class="worksheet-footer">
      <section><strong>PANUKLI</strong><span></span></section>
      <section><strong>PRODUCT EARNINGS</strong><span>${escapeHtml(money(report.productEarnings))}</span></section>
      <section><strong>COMBO EARNINGS</strong><span>${escapeHtml(money(report.comboEarnings))}</span></section>
      <section><strong>EXPENSES</strong><span>${escapeHtml(money(report.expenses))}</span></section>
      <section><strong>TOTAL SALES</strong><span>${escapeHtml(money(report.totalSales))}</span></section>
    </footer>
  `;
}

async function saveReportFile(blob, suggestedName, description, mimeType, extension, successMessage) {
  let browserDownload = false;
  if (location.protocol !== 'file:' && window.showSaveFilePicker) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName,
        types: [{
          description,
          accept: { [mimeType]: [`.${extension}`] }
        }]
      });
      const writable = await fileHandle.createWritable();
      await writable.write(await blob.arrayBuffer());
      await writable.close();
      const savedFile = await fileHandle.getFile();
      if (savedFile.size !== blob.size) {
        throw new Error(`Saved ${savedFile.size} bytes; expected ${blob.size}.`);
      }
    } catch (error) {
      if (error.name === 'AbortError') return false;
      toast(`Could not save the report: ${error.message}`);
      return false;
    }
  } else {
    browserDownload = true;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    document.body.append(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }
  $('#reportDialog').close();
  toast(browserDownload
    ? `${suggestedName} download started. Check your browser Downloads.`
    : successMessage);
  return true;
}

async function downloadInventoryReport() {
  const report = getReportDetails();
  if (!report) return;
  const rows = [
    ['', '', '', '', '', '', '', 'DATE:', report.date],
    inventoryWorksheetHeaders,
    ...report.inventoryGroups.flatMap(group => [
      [group.category],
      ...group.products.map(product => [
        product.name,
        product.quantity,
        product.price,
        '',
        '',
        product.sold,
        product.leftOver,
        product.endingStock,
        '',
        money(product.earnings)
      ])
    ]),
    [],
    ['SIOMAI TRAY -', '', 'GARLIC -'],
    [],
    [
      'PANUKLI', '',
      'PRODUCT EARNINGS', money(report.productEarnings),
      'COMBO EARNINGS', money(report.comboEarnings),
      'EXPENSES', money(report.expenses),
      'TOTAL SALES', money(report.totalSales)
    ]
  ];
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  await saveReportFile(
    blob,
    getReportFileName(report, 'csv'),
    'Excel-compatible CSV',
    'text/csv',
    'csv',
    'Excel-compatible report saved. Open the CSV file in Excel.'
  );
}

async function downloadWordReport() {
  const report = getReportDetails();
  if (!report) return;
  const documentContent = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(report.title)}</title>
  <style>
    @page{size:landscape;margin:8mm}
    body{font-family:Arial,sans-serif;color:#111}
    .worksheet-header{display:flex;justify-content:flex-end;margin-bottom:5px;font-size:9pt}
    .worksheet-header span{font-weight:bold}
    .inventory-worksheet{width:100%;border-collapse:collapse;table-layout:fixed}
    .inventory-worksheet th,.inventory-worksheet td{border:1px solid #111;padding:4px;text-align:left;font-size:8pt}
    .inventory-worksheet thead th{background:#eee;text-align:center}
    .inventory-worksheet thead th:nth-child(1){width:21%}
    .inventory-worksheet thead th:nth-child(2){width:6%}
    .inventory-worksheet thead th:nth-child(3){width:7%}
    .inventory-worksheet thead th:nth-child(4){width:9%}
    .inventory-worksheet thead th:nth-child(5){width:8%}
    .inventory-worksheet thead th:nth-child(6){width:9%}
    .inventory-worksheet thead th:nth-child(7){width:8%}
    .inventory-worksheet thead th:nth-child(8){width:8%}
    .inventory-worksheet thead th:nth-child(9){width:9%}
    .inventory-worksheet thead th:nth-child(10){width:15%}
    .inventory-worksheet .worksheet-shaded td{background:#ddd}
    .inventory-worksheet .worksheet-category th{background:#111;color:#fff;text-align:center;text-transform:uppercase}
    .worksheet-notes{height:68px;border:1px solid #111;border-top:0;padding:8px}
    .worksheet-notes>div{display:flex;align-items:center;gap:24px}
    .worksheet-notes span{display:inline-block;width:100px;border-bottom:1px solid #777}
    .worksheet-footer{display:grid;grid-template-columns:repeat(5,1fr)}
    .worksheet-footer section{height:100px;border:1px solid #111;display:flex;flex-direction:column;align-items:center;padding:8px}
    .worksheet-footer strong{font-size:12pt}
    .worksheet-footer span{margin-top:auto;font-size:11pt}
  </style>
</head>
<body>
  ${renderReportContents(report)}
</body>
</html>`;
  const blob = new Blob(['\uFEFF', documentContent], { type: 'application/msword;charset=utf-8' });
  await saveReportFile(
    blob,
    getReportFileName(report, 'doc'),
    'Microsoft Word document',
    'application/msword',
    'doc',
    'Word-compatible report saved. Open the DOC file in Microsoft Word.'
  );
}

function printInventoryReport() {
  const report = getReportDetails();
  if (!report) return;
  const printArea = document.createElement('section');
  printArea.id = 'printReport';
  printArea.innerHTML = renderReportContents(report);
  document.body.append(printArea);
  document.body.classList.add('printing-report');
  $('#reportDialog').close();
  const cleanup = () => {
    if (!printArea.isConnected) return;
    document.body.classList.remove('printing-report');
    printArea.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 1000);
}

let quickCalculatorValue = '0';
let quickCalculatorFirstOperand = null;
let quickCalculatorOperator = null;
let quickCalculatorWaitingForOperand = false;

function updateQuickCalculator(value, status = '') {
  quickCalculatorValue = value;
  $('#quickCalculatorDisplay').textContent = value;
  $('#quickCalculatorStatus').textContent = status;
}

function calculateQuickResult(left, right, operator) {
  if (operator === 'add') return left + right;
  if (operator === 'subtract') return left - right;
  if (operator === 'multiply') return left * right;
  if (operator === 'divide') return right === 0 ? null : left / right;
  return null;
}

function formatQuickResult(value) {
  if (!Number.isFinite(value)) return null;
  return String(Number(value.toPrecision(12)));
}

function updateCurrentDateTime() {
  const now = new Date();
  const today = getLocalDateInputValue(now);
  const dateOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  };
  const timeOptions = {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  };
  $('#currentDate').dateTime = now.toISOString();
  $('#currentDate').textContent = new Intl.DateTimeFormat('en-PH', dateOptions).format(now);
  $('#currentTime').dateTime = now.toISOString();
  $('#currentTime').textContent = new Intl.DateTimeFormat('en-PH', timeOptions).format(now);
  if (today !== currentLocalDate) {
    const previousDate = currentLocalDate;
    currentLocalDate = today;
    renderInventory();
    if ($('#recordsDate').value === previousDate) {
      $('#recordsDate').value = today;
      renderCalculator();
      renderBusinessTotals();
      renderSavedSales();
    }
  }
}

function handleQuickCalculatorKey(key) {
  if (/^\d$/.test(key)) {
    const nextValue = quickCalculatorWaitingForOperand || quickCalculatorValue === '0'
      ? key
      : quickCalculatorValue + key;
    if (nextValue.length > 16) return;
    quickCalculatorWaitingForOperand = false;
    updateQuickCalculator(nextValue);
    return;
  }

  if (key === 'decimal') {
    if (quickCalculatorWaitingForOperand) {
      quickCalculatorWaitingForOperand = false;
      updateQuickCalculator('0.');
    } else if (!quickCalculatorValue.includes('.')) {
      updateQuickCalculator(`${quickCalculatorValue}.`);
    }
    return;
  }

  if (key === 'clear') {
    quickCalculatorFirstOperand = null;
    quickCalculatorOperator = null;
    quickCalculatorWaitingForOperand = false;
    updateQuickCalculator('0');
    return;
  }

  if (key === 'backspace') {
    if (quickCalculatorWaitingForOperand) return;
    const shortened = quickCalculatorValue.length > 1
      ? quickCalculatorValue.slice(0, -1)
      : '0';
    quickCalculatorWaitingForOperand = false;
    updateQuickCalculator(shortened === '-' ? '0' : shortened);
    return;
  }

  if (['add', 'subtract', 'multiply', 'divide'].includes(key)) {
    const currentOperand = Number(quickCalculatorValue);
    if (quickCalculatorOperator && quickCalculatorFirstOperand !== null
      && !quickCalculatorWaitingForOperand) {
      const result = calculateQuickResult(
        quickCalculatorFirstOperand,
        currentOperand,
        quickCalculatorOperator
      );
      const formatted = result === null ? null : formatQuickResult(result);
      if (formatted === null) {
        updateQuickCalculator(quickCalculatorValue, result === null
          ? 'Cannot divide by zero.'
          : 'Result is too large to display.');
        return;
      }
      updateQuickCalculator(formatted);
      quickCalculatorFirstOperand = Number(formatted);
    } else {
      quickCalculatorFirstOperand = currentOperand;
    }
    quickCalculatorOperator = key;
    quickCalculatorWaitingForOperand = true;
    return;
  }

  if (key === 'equals' && quickCalculatorOperator && quickCalculatorFirstOperand !== null) {
    const rightOperand = quickCalculatorWaitingForOperand
      ? quickCalculatorFirstOperand
      : Number(quickCalculatorValue);
    const result = calculateQuickResult(
      quickCalculatorFirstOperand,
      rightOperand,
      quickCalculatorOperator
    );
    const formatted = result === null ? null : formatQuickResult(result);
    if (formatted === null) {
      updateQuickCalculator(quickCalculatorValue, result === null
        ? 'Cannot divide by zero.'
        : 'Result is too large to display.');
      return;
    }
    quickCalculatorFirstOperand = null;
    quickCalculatorOperator = null;
    quickCalculatorWaitingForOperand = true;
    updateQuickCalculator(formatted);
  }
}

document.querySelector('.quick-calculator-keys').addEventListener('click', event => {
  const button = event.target.closest('[data-calculator-key]');
  if (button) handleQuickCalculatorKey(button.dataset.calculatorKey);
});

document.addEventListener('keydown', event => {
  if (event.target.matches('input, select, textarea, [contenteditable="true"]')) return;
  const keys = {
    '+': 'add',
    '-': 'subtract',
    '*': 'multiply',
    '/': 'divide',
    '=': 'equals',
    Enter: 'equals',
    '.': 'decimal',
    Escape: 'clear',
    Backspace: 'backspace'
  };
  const action = /^\d$/.test(event.key) ? event.key : keys[event.key];
  if (action) {
    event.preventDefault();
    handleQuickCalculatorKey(action);
  }
});

$('#addProductBtn').onclick = () => openProduct();
$('#inventorySearch').oninput = renderInventory;
$('#productMode').onchange = setProductMode;
$('#productCupSize').onchange = setProductMode;
$('#calcProduct').onfocus = () => {
  const selected = state.products.find(item => item.id === $('#calcProduct').dataset.productId);
  if (selected && $('#calcProduct').value === `${selected.name} (${selected.id})`) {
    $('#calcProduct').select();
    setProductPickerOpen(true, '');
  } else {
    setProductPickerOpen(true);
  }
};
$('#calcProduct').oninput = () => {
  setProductPickerOpen(true);
};
$('#calcProduct').onkeydown = event => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if ($('#calcProductOptions').hidden) setProductPickerOpen(true);
    moveProductPickerActiveOption(event.key === 'ArrowDown' ? 1 : -1);
  } else if (event.key === 'Enter' && !$('#calcProductOptions').hidden) {
    event.preventDefault();
    const activeId = $('#calcProduct').getAttribute('aria-activedescendant');
    const activeOption = activeId
      ? document.getElementById(activeId)
      : $('#calcProductOptions [role="option"]');
    if (activeOption) selectCalculatorProduct(activeOption.dataset.productId);
  } else if (event.key === 'Escape') {
    setProductPickerOpen(false);
    const selected = state.products.find(item => item.id === $('#calcProduct').dataset.productId);
    $('#calcProduct').value = selected ? `${selected.name} (${selected.id})` : '';
  }
};
$('#calcProduct').onblur = event => {
  if (event.relatedTarget === $('#calcProductToggle')) return;
  setTimeout(() => {
    setProductPickerOpen(false);
    const selected = state.products.find(item => item.id === $('#calcProduct').dataset.productId);
    $('#calcProduct').value = selected ? `${selected.name} (${selected.id})` : '';
  }, 100);
};
$('#calcProductToggle').onclick = () => {
  const isOpen = $('#calcProductOptions').hidden;
  if (isOpen) {
    $('#calcProduct').focus();
    setProductPickerOpen(true, '');
  } else {
    setProductPickerOpen(false);
  }
};
$('#calcProduct').onchange = () => {
  const search = $('#calcProduct');
  const query = search.value.trim().toLocaleLowerCase();
  const product = getProductsInInventoryOrder().find(item =>
    `${item.name} (${item.id})`.toLocaleLowerCase() === query
      || item.id.toLocaleLowerCase() === query
  );
  if (product) selectCalculatorProduct(product.id);
};
$('#calcSaleType').onchange = selectCalculatorSaleType;
['#calcPacks', '#calcLoose', '#calcServings', '#calcSrp'].forEach(selector => {
  $(selector).oninput = calculateInventory;
});
$('#saleMode').onchange = () => {
  updateSaleModeView();
};
$('#saleReviewBtn').onclick = openSaleReview;
$('#recordsDate').onchange = () => {
  renderCalculator();
  renderBusinessTotals();
  renderSavedSales();
  renderInventory();
};
$('#saleReviewQuantity').oninput = updateSaleReview;
$('#saleReviewPrice').oninput = updateSaleReview;
$('#confirmSaleBtn').onclick = confirmReviewedSale;
$('#backToSaleBtn').onclick = returnToSaleEditor;
$('#comboFillingType').onchange = changeComboFillingType;
$('#comboFilling').onchange = () => {
  refreshComboPrice();
  calculateComboSale();
};
$('#comboGulaman').onchange = () => {
  refreshComboPrice();
  calculateComboSale();
};
$('#comboFillingQty').oninput = () => {
  refreshComboPrice();
  calculateComboSale();
};
['#comboQuantity', '#comboPrice'].forEach(selector => {
  $(selector).oninput = calculateComboSale;
});
$('#closeReceiptBtn').onclick = () => $('#salesReceiptDialog').close();
$('#printReceiptBtn').onclick = printSalesReceipt;
$('#expensesTotal').oninput = updateExpenses;
$('#productForm').onsubmit = saveProduct;
$('#stockForm').onsubmit = saveStock;
$('#exportBtn').onclick = openReportDialog;
$('#printReportBtn').onclick = printInventoryReport;
$('#downloadReportBtn').onclick = downloadInventoryReport;
$('#downloadWordReportBtn').onclick = downloadWordReport;

let deferred;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferred = event;
  $('#installBtn').classList.remove('hidden');
});
$('#installBtn').onclick = async () => {
  if (!deferred) return;
  await deferred.prompt();
  deferred = null;
};
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
updateCurrentDateTime();
setInterval(updateCurrentDateTime, 1000);
renderAll();
