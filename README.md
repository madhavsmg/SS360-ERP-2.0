# 🧭 SS360 ERP 2.0

**SS360 ERP 2.0** is a polished React prototype for **Siva Sai Tea Enterprises**. It brings the tea supply chain to life in a browser app, from supplier sourcing and warehouse stock to blending, sales, and shipping.

<p align="center">
  <img src="https://img.shields.io/badge/Vite-%5E6.3.1-blueviolet?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/React-%5E19.0-blue?style=flat-square&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/State-LocalStorage-yellow?style=flat-square&logo=browser&logoColor=white" alt="LocalStorage" />
  <img src="https://img.shields.io/badge/QR%20Tracking-enabled-brightgreen?style=flat-square" alt="QR Tracking" />
  <img src="https://img.shields.io/badge/License-MIT-black?style=flat-square" alt="License" />
</p>

---

## 🚀 Why SS360 ERP?

This app is a front-end first ERP experience designed to make tea enterprise workflows visible and actionable.

- ✅ Manage procurement, inventory, blends, sales, and shipping from one interface
- ✅ Keep stock, cost, and customer payment data in sync
- ✅ Prototype ERP logic without a backend, using an in-browser data model
- ✅ Explore traceability with raw lots, batch costing, and QR labels

---

## 🌟 What You’ll Find

- **Supplier / purchase order flows** with sample approval and receiving
- **Raw inventory** tracked by lot, location, and reorder thresholds
- **Blend production** that calculates true cost and profit margins
- **Sales/POS workflows** with customer ledger updates
- **Shipping updates** that move orders through Packed → Dispatched → Delivered

---

## 🧩 Core Modules

### 🧭 Dashboard

A single control panel for business health:

- Raw and finished inventory summaries
- Sales revenue and profit metrics
- Low-stock and open shipment alerts
- Visual profit ranking for recent orders

### 🤝 Suppliers

Procurement is built around supplier relationships and purchase orders:

- Add supplier profiles with terms and quality metrics
- Create purchase orders after sample approval
- Receive raw tea into inventory
- Track supplier outstanding balances

### 🧾 Customers

Use this module to manage buyers and payment behavior:

- Add customers with delivery and credit preferences
- Track outstanding invoices and credit exposure
- Review customer order history at a glance

### 📦 Inventory

Inventory is the hub of traceability:

- Manage raw tea lots and finished blend batches
- Search by supplier, variety, grade, SKU, or location
- Generate QR labels for stock items
- Scan QR payloads to jump to items instantly

### 🧪 Production

This module turns raw tea into finished blends:

- Create blend recipes from selected raw lots
- Enter packing, labor, and overhead costs
- Preview batch costing, revenue, margin, and expected profit
- Automatically reduce raw stock when a blend is produced

### 💳 Sales / POS

A compact sales interface for order entry and invoice generation:

- Sell finished blends or raw tea directly
- Pick customer, item, quantity, and shipping options
- Auto-calculate revenue and update inventory
- Create shipments for every sales order

### 🚚 Shipping

Track fulfillment through the final mile:

- View the active shipment queue
- Update status from Packed → Dispatched → Delivered
- Add transport mode, vehicle number, and delivery notes
- Keep order and shipment status linked automatically

---

## 🏗️ Architecture

The app is organized to be easy to navigate and extend:

- `src/App.jsx` — router and root layout
- `src/context/EnterpriseContext.jsx` — business state, rules, and persistence
- `src/modules/` — individual ERP module pages
- `src/components/sidebar.jsx` — main navigation menu
- `src/utils/formatters.js` — shared number and currency formatting
- `src/modules/ERP/erp.css` — core ERP styles

The app stores its state in browser `localStorage`, so your demo data is retained between sessions.

---

## 💻 Tech Stack

- React 19
- Vite 6
- React Router DOM
- Lucide React icons
- `qrcode` for label generation
- Browser `localStorage` persistence

---

## ▶️ Run Locally

```bash
npm install
npm run dev
```

Open the localhost URL shown by Vite and start exploring the ERP experience.

---

## 📌 Notes

- The application is a front-end prototype and does not require a backend to run.
- Seed data is loaded on first launch and saved in the browser.
- The `POS` menu simply reuses the Sales module as a point-of-sale flow.

---

## 🔮 Future Enhancements

Potential additions to make SS360 ERP even stronger:

- Authentication and role-based access control
- Backend integration with Node.js / Express / MongoDB
- Analytics dashboards and reporting
- Docker deployment and cloud sync with MongoDB Atlas
- Enhanced inventory traceability with barcode/QR scanning

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
