import { useMemo, useState } from 'react';
import { CheckCircle2, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useConfirmationDialog } from '../../components/ConfirmationDialog';
import { useEnterprise } from '../../context/EnterpriseContext';
import { formatKg, formatMoney } from '../../utils/formatters';
import {
  calculateCartTotal,
  calculateLineSubtotal,
  roundQuantity,
} from '../../utils/salesCalculations';
import {
  normalizeIndianMobile,
  sanitizeIndianMobileInput,
  validateOptionalIndianMobile,
} from '../../utils/businessValidation';
import { getMessageClassName } from '../../utils/messageTone';

const cartItemDefaults = {
  itemType: 'blend',
  itemId: '',
  kg: '',
  pricePerKg: '',
};

const paymentModes = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Credit'];

const newCustomerDefaults = {
  name: '',
  phone: '',
  city: '',
  state: '',
  address: '',
};

function getCartKey(itemType, itemId) {
  return `${itemType}:${itemId}`;
}

function getItemTypeLabel(itemType) {
  return itemType === 'raw' ? 'Raw tea' : 'Blend';
}

export default function SalesPage() {
  const { data, addCustomer, createSalesOrder, numberValue } = useEnterprise();
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerLookupMessage, setCustomerLookupMessage] = useState('');
  const [customerLookupTone, setCustomerLookupTone] = useState('info');
  const [customerMode, setCustomerMode] = useState('existing');
  const [newCustomer, setNewCustomer] = useState(newCustomerDefaults);
  const [cartForm, setCartForm] = useState(cartItemDefaults);
  const [cart, setCart] = useState([]);
  const [paymentMode, setPaymentMode] = useState('');
  const [message, setMessage] = useState('');
  const { confirmationDialog, requestConfirmation } = useConfirmationDialog();

  const allSaleItems = useMemo(
    () => [
      ...data.blendBatches.map((batch) => ({
        id: batch.id,
        itemType: 'blend',
        name: batch.productName,
        stockKg: batch.remainingKg,
        defaultPrice: batch.sellingPricePerKg,
      })),
      ...data.rawLots.map((lot) => ({
        id: lot.id,
        itemType: 'raw',
        name: `${lot.variety} ${lot.grade}`,
        stockKg: lot.remainingKg,
        defaultPrice: lot.costPerKg,
      })),
    ],
    [data.rawLots, data.blendBatches]
  );

  const saleItems = allSaleItems.filter((item) => item.itemType === cartForm.itemType);

  const selectedCustomer = data.customers.find((customer) => customer.id === selectedCustomerId);
  const selectedItem = allSaleItems.find(
    (item) => item.itemType === cartForm.itemType && item.id === cartForm.itemId
  );

  const cartTotal = calculateCartTotal(cart);
  const cartDue = paymentMode === 'Credit' ? cartTotal : 0;
  const projectedOutstanding = selectedCustomer
    ? numberValue(selectedCustomer.outstanding) + cartDue
    : customerMode === 'new'
      ? cartDue
      : 0;
  const selectedItemReservedKg = selectedItem
    ? getReservedCartKg(selectedItem.itemType, selectedItem.id)
    : 0;
  const selectedItemAvailableKg = selectedItem
    ? Math.max(numberValue(selectedItem.stockKg) - selectedItemReservedKg, 0)
    : 0;

  function updateCartForm(field, value) {
    setCartForm((current) => ({ ...current, [field]: value }));
  }

  function updateCustomerPhone(value) {
    const sanitizedPhone = sanitizeIndianMobileInput(value);
    setCustomerPhone(sanitizedPhone);

    if (customerMode === 'new') {
      setNewCustomer((current) => ({ ...current, phone: sanitizedPhone }));
    }
  }

  function updateNewCustomer(field, value) {
    const nextValue = field === 'phone' ? sanitizeIndianMobileInput(value) : value;
    setNewCustomer((current) => ({ ...current, [field]: nextValue }));

    if (field === 'phone') {
      setCustomerPhone(nextValue);
    }
  }

  function showCustomerLookupMessage(message, tone = 'info') {
    setCustomerLookupMessage(message);
    setCustomerLookupTone(tone);
  }

  function clearCustomerLookupMessage() {
    showCustomerLookupMessage('');
  }

  function getReservedCartKg(itemType, itemId) {
    return cart.reduce(
      (sum, item) =>
        item.itemType === itemType && item.itemId === itemId ? sum + numberValue(item.kg) : sum,
      0
    );
  }

  function getAvailableCartKg(itemType, itemId, currentCartItemId = '') {
    const stockItem = allSaleItems.find((item) => item.itemType === itemType && item.id === itemId);

    if (!stockItem) return 0;

    const reservedByOtherRows = cart.reduce((sum, item) => {
      if (item.id === currentCartItemId || item.itemType !== itemType || item.itemId !== itemId) {
        return sum;
      }

      return sum + numberValue(item.kg);
    }, 0);

    return Math.max(roundQuantity(numberValue(stockItem.stockKg) - reservedByOtherRows), 0);
  }

  function selectCustomer(customerId) {
    const customer = data.customers.find((currentCustomer) => currentCustomer.id === customerId);

    setSelectedCustomerId(customerId);
    setCustomerPhone(customer?.phone || '');
    clearCustomerLookupMessage();
    setCustomerMode('existing');
  }

  function findCustomerByPhone(phone) {
    const normalized = normalizeIndianMobile(phone || '');
    if (!normalized) return null;

    return data.customers.find(
      (customer) => normalizeIndianMobile(customer.phone || '') === normalized
    );
  }

  function handleFetchCustomer() {
    const phoneError = validateOptionalIndianMobile(customerPhone, 'Customer phone');

    if (!customerPhone) {
      showCustomerLookupMessage('Enter a valid phone number to fetch a customer.', 'warning');
      return;
    }

    if (phoneError) {
      setSelectedCustomerId('');
      setCustomerMode('new');
      setNewCustomer((current) => ({
        ...(customerMode === 'new' ? current : newCustomerDefaults),
        phone: customerPhone,
      }));
      showCustomerLookupMessage(`${phoneError} New customer mode opened.`, 'warning');
      return;
    }

    const customer = findCustomerByPhone(customerPhone);

    if (customer) {
      setSelectedCustomerId(customer.id);
      setCustomerMode('existing');
      setNewCustomer(newCustomerDefaults);
      showCustomerLookupMessage(
        `Customer found: ${customer.name}. Existing tab opened with saved details.`
      );
    } else {
      setSelectedCustomerId('');
      setCustomerMode('new');
      setNewCustomer({
        ...newCustomerDefaults,
        phone: normalizeIndianMobile(customerPhone),
      });
      showCustomerLookupMessage('Customer not found. New customer mode opened.', 'warning');
    }
  }

  function useNewCustomerMode() {
    setSelectedCustomerId('');
    setCustomerMode('new');
    clearCustomerLookupMessage();
    setNewCustomer((current) => ({
      ...current,
      phone: current.phone || customerPhone,
    }));
  }

  function useExistingCustomerMode() {
    setCustomerMode('existing');
    clearCustomerLookupMessage();
  }

  function addToCart() {
    if (!selectedItem) {
      setMessage('Select an item to add to cart.');
      return;
    }

    const kg = numberValue(cartForm.kg);
    const pricePerKg = numberValue(cartForm.pricePerKg);

    if (kg <= 0) {
      setMessage('Kg must be greater than zero.');
      return;
    }

    if (pricePerKg <= 0) {
      setMessage('Price per kg must be greater than zero.');
      return;
    }

    if (kg > selectedItem.stockKg) {
      setMessage(`Only ${formatKg(selectedItem.stockKg)} available for ${selectedItem.name}.`);
      return;
    }

    if (kg > selectedItemAvailableKg) {
      setMessage(
        `Only ${formatKg(selectedItemAvailableKg)} is still available for ${
          selectedItem.name
        } after current cart reservations.`
      );
      return;
    }

    const subtotal = calculateLineSubtotal({ kg, pricePerKg });
    const cartItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      itemId: cartForm.itemId,
      itemName: selectedItem.name,
      itemType: cartForm.itemType,
      kg,
      pricePerKg,
      subtotal,
    };

    setCart((current) => [...current, cartItem]);
    setCartForm(cartItemDefaults);
    setMessage(`Added ${selectedItem.name} to the cart.`);
  }

  function removeFromCart(cartItemId) {
    setCart((current) => current.filter((item) => item.id !== cartItemId));
  }

  function updateCartItemKg(cartItemId, nextValue) {
    const targetItem = cart.find((item) => item.id === cartItemId);

    if (!targetItem) {
      return;
    }

    if (nextValue === '') {
      setCart((current) =>
        current.map((item) =>
          item.id === cartItemId
            ? {
                ...item,
                kg: '',
                subtotal: 0,
              }
            : item
        )
      );
      return;
    }

    const requestedKg = roundQuantity(numberValue(nextValue));
    const availableKg = getAvailableCartKg(targetItem.itemType, targetItem.itemId, targetItem.id);

    if (requestedKg < 0) {
      return;
    }

    if (requestedKg === 0) {
      setCart((current) =>
        current.map((item) =>
          item.id === cartItemId
            ? {
                ...item,
                kg: nextValue,
                subtotal: 0,
              }
            : item
        )
      );
      return;
    }

    if (requestedKg > availableKg) {
      setMessage(`Only ${formatKg(availableKg)} is available for ${targetItem.itemName}.`);
    }

    const nextKg = Math.min(requestedKg, availableKg);

    setCart((current) =>
      current.map((item) =>
        item.id === cartItemId
          ? {
              ...item,
              kg: nextKg || '',
              subtotal: calculateLineSubtotal({ kg: nextKg, pricePerKg: item.pricePerKg }),
            }
          : item
      )
    );
  }

  function stepCartItemKg(cartItem, step) {
    const currentKg = numberValue(cartItem.kg);
    const nextKg = step > 0 ? currentKg + step : Math.max(currentKg + step, 0.01);

    updateCartItemKg(cartItem.id, String(nextKg));
  }

  function validateNewCustomerForm() {
    const phoneError = validateOptionalIndianMobile(
      newCustomer.phone || customerPhone,
      'Customer phone'
    );

    if (!newCustomer.name.trim()) {
      return 'Customer name is required for a new customer.';
    }

    if (!newCustomer.address.trim()) {
      return 'Customer address is required for a new customer.';
    }

    if (phoneError) {
      return phoneError;
    }

    return '';
  }

  function getNewCustomerForm() {
    const address = newCustomer.address.trim();
    const city = newCustomer.city.trim();
    const state = newCustomer.state.trim();

    return {
      name: newCustomer.name.trim(),
      type: 'Walk-in',
      phone: normalizeIndianMobile(newCustomer.phone || customerPhone),
      city,
      state,
      address,
      deliveryPreference: 'Customer pickup',
      creditLimit: '0',
    };
  }

  function getCartStockIssues() {
    const cartKgByItem = cart.reduce((items, item) => {
      const key = getCartKey(item.itemType, item.itemId);
      items.set(key, (items.get(key) || 0) + numberValue(item.kg));
      return items;
    }, new Map());

    return [...cartKgByItem.entries()]
      .map(([key, kg]) => {
        const [itemType, itemId] = key.split(':');
        const stockItem = allSaleItems.find(
          (item) => item.itemType === itemType && item.id === itemId
        );

        if (!stockItem) {
          return 'One cart item is no longer available in stock. Remove it and add it again.';
        }

        if (kg <= 0) {
          return `Enter a valid quantity for ${stockItem.name}.`;
        }

        if (kg > numberValue(stockItem.stockKg)) {
          return `${stockItem.name} has only ${formatKg(
            stockItem.stockKg
          )} available, but ${formatKg(kg)} is in the cart.`;
        }

        return '';
      })
      .filter(Boolean);
  }

  function completeSale() {
    const newCustomerError =
      !selectedCustomer && customerMode === 'new' ? validateNewCustomerForm() : '';
    const saleCustomerPreview =
      selectedCustomer ||
      (customerMode === 'new' && !newCustomerError
        ? {
            name: newCustomer.name.trim(),
            type: 'Walk-in',
            outstanding: 0,
          }
        : null);

    if (newCustomerError) {
      setMessage(newCustomerError);
      return;
    }

    if (!saleCustomerPreview) {
      setMessage('Select a customer before completing the sale.');
      return;
    }

    if (cart.length === 0) {
      setMessage('Add items to the cart before completing the sale.');
      return;
    }

    if (!paymentMode) {
      setMessage('Select a payment mode before completing the sale.');
      return;
    }

    const stockIssues = getCartStockIssues();

    if (stockIssues.length) {
      setMessage(stockIssues[0]);
      return;
    }

    requestConfirmation(
      {
        title: 'Complete sale and pack shipment?',
        description:
          paymentMode === 'Credit'
            ? 'This will create sales orders, reduce stock, add packed shipments, and post the balance to the customer ledger.'
            : 'This will create sales orders, reduce stock, add packed shipments, and mark the sale as paid.',
        details: [
          { label: 'Customer', value: saleCustomerPreview.name },
          { label: 'Items in cart', value: cart.length },
          { label: 'Total amount', value: formatMoney(cartTotal) },
          { label: 'Payment mode', value: paymentMode },
        ],
        confirmLabel: 'Complete Sale',
      },
      () => {
        try {
          const saleCustomer =
            selectedCustomer ||
            addCustomer({
              ...getNewCustomerForm(),
              phone: normalizeIndianMobile(newCustomer.phone || customerPhone),
            });

          cart.forEach((cartItem) => {
            const saleForm = {
              customerId: saleCustomer.id,
              customerSnapshot: saleCustomer,
              itemType: cartItem.itemType,
              itemId: cartItem.itemId,
              kg: cartItem.kg,
              pricePerKg: cartItem.pricePerKg,
              shippingCharge: '0',
              saleType: saleCustomer.type || 'Walk-in',
              paymentMode,
              transportMode: saleCustomer.deliveryPreference || '',
              note: `${paymentMode} sales cart sale`,
            };
            createSalesOrder(saleForm);
          });

          setMessage(
            `Sale completed for ${cart.length} item(s). Total: ${formatMoney(cartTotal)}.`
          );
          setCart([]);
          setPaymentMode('');
          setSelectedCustomerId('');
          setCustomerPhone('');
          setCustomerLookupMessage('');
          setCustomerMode('existing');
          setNewCustomer(newCustomerDefaults);
          setCartForm(cartItemDefaults);
        } catch (error) {
          setMessage(`Error: ${error.message}`);
        }
      }
    );
  }

  return (
    <section className="erp-page sales-module" data-testid="page-sales">
      <header className="erp-header">
        <div>
          <span className="erp-kicker">Sales</span>
          <h1>Point of Sale & Sales Register</h1>
          <p>
            Build customer carts from finished blends or raw tea stock, then update inventory,
            payment status, customer exposure, and shipments from one flow.
          </p>
        </div>
      </header>

      {message && (
        <p className={getMessageClassName(message)} data-testid="sales-message">
          {message}
        </p>
      )}

      <div className="erp-workspace sales-workspace">
        <div className="sales-main-column">
          <section className="erp-panel sales-cart-panel">
            <div className="erp-panel-title">
              <h2>Shopping Cart</h2>
            </div>

            <div className="erp-form-grid sales-cart-controls">
              <label>
                <span>Item type</span>
                <select
                  data-testid="sales-item-type-select"
                  value={cartForm.itemType}
                  onChange={(event) => {
                    updateCartForm('itemType', event.target.value);
                    updateCartForm('itemId', '');
                    updateCartForm('pricePerKg', '');
                  }}
                >
                  <option value="blend">Blended batch</option>
                  <option value="raw">Direct raw tea sale</option>
                </select>
              </label>

              <label className="sales-product-field">
                <span>Product</span>
                <select
                  data-testid="sales-product-select"
                  value={cartForm.itemId}
                  onChange={(event) => {
                    const item = saleItems.find(
                      (currentItem) => currentItem.id === event.target.value
                    );
                    updateCartForm('itemId', event.target.value);
                    updateCartForm('pricePerKg', item ? String(item.defaultPrice) : '');
                  }}
                >
                  <option value="">Select product</option>
                  {saleItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - {formatKg(item.stockKg)} available
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Quantity</span>
                <div className="erp-input-suffix-wrap">
                  <input
                    data-testid="sales-quantity-input"
                    min="0"
                    step="0.01"
                    type="number"
                    value={cartForm.kg}
                    onChange={(event) => updateCartForm('kg', event.target.value)}
                  />
                  <span className="erp-input-suffix">kg</span>
                </div>
              </label>

              <label>
                <span>Price / kg</span>
                <input
                  data-testid="sales-price-input"
                  min="0"
                  step="0.01"
                  type="number"
                  value={cartForm.pricePerKg}
                  onChange={(event) => updateCartForm('pricePerKg', event.target.value)}
                />
              </label>

              <button
                className="erp-button sales-action sales-action-add sales-cart-button"
                data-testid="sales-add-to-cart-button"
                type="button"
                onClick={addToCart}
              >
                <ShoppingCart size={15} />
                Add to Cart
              </button>
            </div>

            {selectedItem && (
              <p className="erp-muted-note">
                Available after current cart reservations: {formatKg(selectedItemAvailableKg)}.
              </p>
            )}

            <div className="erp-table table-sales-cart" data-testid="sales-cart-table">
              <div className="erp-row head">
                <span>Product</span>
                <span>Qty (kg)</span>
                <span>Price / kg</span>
                <span>Subtotal</span>
              </div>

              {cart.length === 0 ? (
                <div className="erp-empty-state sales-cart-empty">No items in cart.</div>
              ) : (
                cart.map((item) => (
                  <div className="erp-row" data-testid={`sales-cart-row-${item.id}`} key={item.id}>
                    <span className="sales-cart-product">
                      <span className="sales-cart-product-copy">
                        <strong>{item.itemName}</strong>
                        <small>
                          {getItemTypeLabel(item.itemType)} |{' '}
                          {getCartKey(item.itemType, item.itemId)}
                        </small>
                      </span>
                      <button
                        aria-label={`Remove ${item.itemName} from cart`}
                        className="sales-cart-remove-link"
                        title="Remove item"
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    </span>
                    <span>
                      <span className="sales-quantity-stepper">
                        <button
                          aria-label={`Decrease ${item.itemName} quantity`}
                          title="Decrease quantity"
                          type="button"
                          onClick={() => stepCartItemKg(item, -1)}
                        >
                          <Minus size={13} />
                        </button>
                        <input
                          aria-label={`${item.itemName} quantity in kg`}
                          inputMode="decimal"
                          min="0"
                          placeholder="kg"
                          step="0.01"
                          type="number"
                          value={item.kg}
                          onChange={(event) => updateCartItemKg(item.id, event.target.value)}
                        />
                        <button
                          aria-label={`Increase ${item.itemName} quantity`}
                          title="Increase quantity"
                          type="button"
                          onClick={() => stepCartItemKg(item, 1)}
                        >
                          <Plus size={13} />
                        </button>
                      </span>
                    </span>
                    <span>{formatMoney(item.pricePerKg)}</span>
                    <span className="erp-profit">{formatMoney(calculateLineSubtotal(item))}</span>
                  </div>
                ))
              )}
            </div>

            <div className="sales-cart-total sales-table-total">
              <span>Cart total</span>
              <strong>{formatMoney(cartTotal)}</strong>
            </div>
          </section>

          <section className="erp-panel">
            <div className="erp-panel-title">
              <h2>Sales Register</h2>
            </div>
            <div className="erp-table table-sales" data-testid="sales-register-table">
              <div className="erp-row head">
                <span>Order</span>
                <span>Kg</span>
                <span>Revenue</span>
                <span>Profit</span>
                <span>Status</span>
              </div>
              {data.salesOrders.length === 0 ? (
                <div className="erp-empty-state">No sales recorded yet.</div>
              ) : (
                data.salesOrders.map((order) => (
                  <div
                    className="erp-row"
                    data-testid={`sales-order-row-${order.id}`}
                    key={order.id}
                  >
                    <span>
                      <strong>{order.itemName}</strong>
                      <small>
                        {order.customerName} | {order.orderDate} | {order.paymentMode || 'Credit'}
                      </small>
                    </span>
                    <span>{formatKg(order.kg)}</span>
                    <span>{formatMoney(order.revenue)}</span>
                    <span className={order.profit >= 0 ? 'erp-profit' : 'erp-loss'}>
                      {formatMoney(order.profit)}
                    </span>
                    <span className="sales-status-stack">
                      <span
                        className={order.status === 'Delivered' ? 'erp-pill' : 'erp-pill warning'}
                      >
                        {order.status}
                      </span>
                      <small>
                        {order.paymentStatus ||
                          (numberValue(order.balanceDue) > 0 ? 'Due' : 'Paid')}
                      </small>
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="erp-action-stack sales-action-stack">
          <section className="erp-panel sales-customer-panel sales-preview-panel">
            <div className="erp-panel-title">
              <h2>Customer & Payment</h2>
            </div>

            <div className="sales-lookup-row">
              <label>
                <span>Phone lookup</span>
                <input
                  autoComplete="tel"
                  data-testid="sales-customer-phone-input"
                  inputMode="numeric"
                  maxLength="10"
                  pattern="[6-9][0-9]{9}"
                  placeholder="10-digit mobile"
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => updateCustomerPhone(event.target.value)}
                />
              </label>
              <button
                className="erp-button sales-action sales-action-fetch"
                data-testid="sales-fetch-customer-button"
                type="button"
                onClick={handleFetchCustomer}
              >
                <Search size={15} />
                Fetch
              </button>
            </div>

            {customerLookupMessage && (
              <p
                className={`sales-lookup-message sales-lookup-message--${customerLookupTone}`}
                data-testid="sales-lookup-message"
              >
                {customerLookupMessage}
              </p>
            )}

            <div className="sales-customer-mode">
              <button
                className={customerMode === 'existing' ? 'active' : ''}
                type="button"
                onClick={useExistingCustomerMode}
              >
                Existing
              </button>
              <button
                className={customerMode === 'new' ? 'active' : ''}
                type="button"
                onClick={useNewCustomerMode}
              >
                New
              </button>
            </div>

            {customerMode === 'existing' ? (
              <>
                <label>
                  <span>Customer</span>
                  <select
                    data-testid="sales-customer-select"
                    required
                    value={selectedCustomerId}
                    onChange={(event) => selectCustomer(event.target.value)}
                  >
                    <option value="">Select customer</option>
                    {data.customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} -{' '}
                        {[customer.city, customer.state].filter(Boolean).join(', ') ||
                          customer.address ||
                          'details pending'}
                      </option>
                    ))}
                  </select>
                </label>

                <dl className="erp-cost-list sales-customer-summary">
                  <div>
                    <dt>Customer</dt>
                    <dd>{selectedCustomer?.name || 'Not selected'}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{selectedCustomer?.phone || customerPhone || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt>City</dt>
                    <dd>{selectedCustomer?.city || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt>State</dt>
                    <dd>{selectedCustomer?.state || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt>Address</dt>
                    <dd>{selectedCustomer?.address || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt>Delivery</dt>
                    <dd>{selectedCustomer?.deliveryPreference || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt>Current due</dt>
                    <dd>{formatMoney(selectedCustomer?.outstanding)}</dd>
                  </div>
                  <div>
                    <dt>After sale</dt>
                    <dd>
                      {selectedCustomer ? formatMoney(projectedOutstanding) : 'Select customer'}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="sales-new-customer-form">
                <label>
                  <span>Name</span>
                  <input
                    autoComplete="name"
                    data-testid="sales-new-customer-name-input"
                    maxLength="80"
                    placeholder="Customer name"
                    value={newCustomer.name}
                    onChange={(event) => updateNewCustomer('name', event.target.value)}
                  />
                </label>
                <label>
                  <span>Phone</span>
                  <input
                    autoComplete="tel"
                    data-testid="sales-new-customer-phone-input"
                    inputMode="numeric"
                    maxLength="10"
                    pattern="[6-9][0-9]{9}"
                    placeholder="10-digit mobile"
                    type="tel"
                    value={newCustomer.phone || customerPhone}
                    onChange={(event) => updateNewCustomer('phone', event.target.value)}
                  />
                </label>
                <label>
                  <span>City</span>
                  <input
                    autoComplete="address-level2"
                    data-testid="sales-new-customer-city-input"
                    maxLength="60"
                    value={newCustomer.city}
                    onChange={(event) => updateNewCustomer('city', event.target.value)}
                  />
                </label>
                <label>
                  <span>State</span>
                  <input
                    autoComplete="address-level1"
                    data-testid="sales-new-customer-state-input"
                    maxLength="60"
                    placeholder="State"
                    value={newCustomer.state}
                    onChange={(event) => updateNewCustomer('state', event.target.value)}
                  />
                </label>
                <label>
                  <span>Address</span>
                  <textarea
                    autoComplete="street-address"
                    data-testid="sales-new-customer-address-input"
                    maxLength="180"
                    placeholder="Customer address"
                    rows="2"
                    value={newCustomer.address}
                    onChange={(event) => updateNewCustomer('address', event.target.value)}
                  />
                </label>
              </div>
            )}

            <label>
              <span>Payment mode</span>
              <select
                data-testid="sales-payment-mode-select"
                required
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
              >
                <option value="">Select payment mode</option>
                {paymentModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === 'Credit' ? 'Credit / customer ledger' : mode}
                  </option>
                ))}
              </select>
            </label>

            <div className="sales-cart-total sales-payment-total">
              <span>{paymentMode === 'Credit' ? 'Ledger due' : 'Paid now'}</span>
              <strong>{formatMoney(paymentMode === 'Credit' ? cartDue : cartTotal)}</strong>
            </div>

            <button
              className="erp-button sales-action sales-action-complete"
              data-testid="sales-complete-sale-button"
              disabled={
                cart.length === 0 ||
                !paymentMode ||
                (customerMode === 'existing' && !selectedCustomer)
              }
              type="button"
              onClick={completeSale}
            >
              <CheckCircle2 size={15} />
              Complete Sale
            </button>
          </section>
        </aside>
      </div>

      {confirmationDialog}
    </section>
  );
}
