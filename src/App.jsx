import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { EnterpriseProvider } from './context/EnterpriseContext';
import DashboardPage from './modules/Dashboard/dashboardPage';
import SuppliersPage from './modules/Suppliers/suppliersPage';
import CustomersPage from './modules/Customers/customersPage';
import InventoryPage from './modules/Inventory/inventoryPage';
import ProductionPage from './modules/Production/productionPage';
import SalesPage from './modules/Sales/salesPage';
import ShippingPage from './modules/Shipping/shippingPage';
import POSPage from './modules/POS/posPage';
import Sidebar from './components/sidebar';
import './modules/ERP/erp.css';

function App() {
  return (
    <EnterpriseProvider>
      <Router>
        <div className="app-shell">
          <Sidebar />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/production" element={<ProductionPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/shipping" element={<ShippingPage />} />
              <Route path="/pos" element={<POSPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </EnterpriseProvider>
  );
}

export default App;
