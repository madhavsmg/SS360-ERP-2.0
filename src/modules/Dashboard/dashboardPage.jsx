import { useEnterprise } from '../../context/EnterpriseContext';
import { formatKg, formatMoney } from '../../utils/formatters';

export default function DashboardPage() {
  const { data, metrics } = useEnterprise();
  const maxProfit = Math.max(...data.salesOrders.map((order) => order.profit), 1);
  const topOrders = data.salesOrders.slice(0, 5);
  const lowLots = data.rawLots.filter((lot) => lot.remainingKg <= lot.reorderKg);
  const pendingShipments = data.shipments.filter((shipment) => shipment.status !== 'Delivered');

  return (
    <section className="erp-page">
      <header className="erp-header">
        <div>
          <span className="erp-kicker">SS-360 Control Room</span>
          <h1>Siva Sai Tea ERP</h1>
          <p>
            Supplier purchasing, raw stock, blending, sales, shipping, and profit stay connected
            from one dashboard.
          </p>
        </div>
      </header>

      <div className="erp-summary-grid">
        <div className="erp-stat">
          <span>Raw Tea Stock</span>
          <strong>{formatKg(metrics.rawKg)}</strong>
          <small>{formatMoney(metrics.rawValue)} at cost</small>
        </div>
        <div className="erp-stat">
          <span>Finished Products</span>
          <strong>{formatKg(metrics.finishedKg)}</strong>
          <small>{formatMoney(metrics.finishedValue)} at cost</small>
        </div>
        <div className="erp-stat">
          <span>Sales Revenue</span>
          <strong>{formatMoney(metrics.salesRevenue)}</strong>
          <small>{formatMoney(metrics.salesProfit)} profit</small>
        </div>
        <div className="erp-stat">
          <span>Open Work</span>
          <strong>{metrics.pendingPurchaseOrders + metrics.openShipments}</strong>
          <small>{metrics.lowRawLots} low-stock raw lots</small>
        </div>
      </div>

      <div className="erp-workspace">
        <div className="erp-panel">
          <div className="erp-panel-title">
            <h2>Profit By Recent Orders</h2>
          </div>
          <div className="erp-chart-bars">
            {topOrders.map((order) => (
              <div className="erp-bar-row" key={order.id}>
                <span>{order.itemName}</span>
                <div className="erp-bar-track">
                  <div
                    className="erp-bar-fill"
                    style={{ width: `${Math.max((order.profit / maxProfit) * 100, 4)}%` }}
                  />
                </div>
                <strong>{formatMoney(order.profit)}</strong>
              </div>
            ))}
          </div>
        </div>

        <aside className="erp-panel">
          <div className="erp-panel-title">
            <h2>Alerts</h2>
          </div>
          <div className="erp-trace-list">
            {lowLots.map((lot) => (
              <div key={lot.id}>
                <strong>{lot.variety} is low</strong>
                <span>
                  {formatKg(lot.remainingKg)} left in {lot.location}
                </span>
              </div>
            ))}
            {pendingShipments.map((shipment) => (
              <div key={shipment.id}>
                <strong>{shipment.status} shipment</strong>
                <span>
                  {shipment.customerName} to {shipment.destination}
                </span>
              </div>
            ))}
            {lowLots.length === 0 && pendingShipments.length === 0 && (
              <div>
                <strong>No urgent alerts</strong>
                <span>Stock, production, and deliveries look steady.</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
