import {
  BarChart3,
  Boxes,
  Factory,
  LayoutDashboard,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navigationItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/suppliers', label: 'Suppliers', icon: ReceiptText },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/production', label: 'Production', icon: Factory },
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/shipping', label: 'Shipping', icon: Truck },
  { to: '/pos', label: 'POS', icon: PackageCheck },
];

export default function Sidebar() {
  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <img className="app-brand-mark" src="/circle%20logo%20ss%20tea.png" alt="SS-360 Tea logo" />
        <div>
          <strong>SS-360</strong>
          <span>Tea Enterprise ERP</span>
        </div>
      </div>

      <nav className="app-nav" aria-label="Primary navigation">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              className={({ isActive }) => (isActive ? 'app-nav-link active' : 'app-nav-link')}
              end={item.to === '/'}
              key={item.to}
              to={item.to}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={2.1} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="app-sidebar-footer">
        <img className="app-sidebar-footer-icon" src="/vite.svg" alt="Vite" />
        <span>Built with Vite · Local ERP workspace</span>
      </div>
    </aside>
  );
}
