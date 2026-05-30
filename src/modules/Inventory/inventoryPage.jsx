import { Boxes, ClipboardList, FileSearch } from 'lucide-react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import InventoryStock from './inventoryStock';
import InvoiceIntake from './invoiceIntake';
import InvoiceRegister from './invoiceRegister';

const inventoryTabs = [
  {
    to: '/inventory',
    label: 'Stock Ledger',
    description: 'Raw lots, blended batches, QR labels',
    icon: Boxes,
    end: true,
  },
  {
    to: '/inventory/intake',
    label: 'Invoice Intake',
    description: 'OCR, human review, approval',
    icon: FileSearch,
  },
  {
    to: '/inventory/invoices',
    label: 'Invoice Register',
    description: 'Drafts, approvals, reversals',
    icon: ClipboardList,
  },
];

export default function InventoryPage() {
  return (
    <section className="erp-page inventory-module" data-testid="page-inventory">
      <header className="erp-header inventory-header">
        <div>
          <span className="erp-kicker">Inventory</span>
          <h1>Stock Control & Invoice Operations</h1>
          <p>
            Inventory opens on live stock first, while invoice ingestion and correction queues stay
            in their own focused workspaces.
          </p>
        </div>
      </header>

      <nav className="inventory-subnav erp-no-print" aria-label="Inventory sections">
        {inventoryTabs.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              className={({ isActive }) =>
                isActive ? 'inventory-subnav-link active' : 'inventory-subnav-link'
              }
              data-testid={`inventory-subnav-${item.label
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')}`}
              end={item.end}
              key={item.to}
              to={item.to}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={2.1} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </NavLink>
          );
        })}
      </nav>

      <Routes>
        <Route index element={<InventoryStock />} />
        <Route path="intake" element={<InvoiceIntake />} />
        <Route path="invoices" element={<InvoiceRegister />} />
        <Route path="*" element={<Navigate replace to="/inventory" />} />
      </Routes>
    </section>
  );
}
