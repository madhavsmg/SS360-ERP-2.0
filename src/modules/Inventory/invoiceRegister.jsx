import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, RotateCcw, Trash2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useConfirmationDialog } from '../../components/ConfirmationDialog';
import { useEnterprise } from '../../context/EnterpriseContext';
import { formatKg, formatMoney } from '../../utils/formatters';

const registerTabs = [
  { id: 'drafts', label: 'Drafts' },
  { id: 'approved', label: 'Approved' },
  { id: 'reverted', label: 'Reverted' },
  { id: 'needsCorrection', label: 'Needs Correction' },
];

function recordKey(item) {
  return `${item.type}:${item.record.id}`;
}

function statusClass(status) {
  if (status === 'Reverted' || status === 'Needs Correction') {
    return 'erp-pill warning';
  }

  if (status === 'Superseded') {
    return 'erp-pill neutral';
  }

  return 'erp-pill';
}

function invoiceTitle(invoice) {
  return invoice.invoiceNumber || invoice.id;
}

function draftTitle(draft) {
  return draft.invoice?.number || draft.sourceName || draft.id;
}

export default function InvoiceRegister() {
  const { data, deleteInvoiceDraft, getInvoiceReversalBlockers, revertInvoiceReceipt } =
    useEnterprise();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('approved');
  const [selectedKey, setSelectedKey] = useState('');
  const [message, setMessage] = useState('');
  const [revertReason, setRevertReason] = useState('');
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState('');
  const { confirmationDialog, requestConfirmation } = useConfirmationDialog();

  const recordsByTab = useMemo(() => {
    const invoiceDrafts = data.invoiceDrafts || [];
    const invoices = data.invoiceReceipts || [];
    const approvedInvoices = invoices.filter((invoice) => invoice.status === 'Approved');
    const revertedInvoices = invoices.filter((invoice) =>
      ['Reverted', 'Superseded'].includes(invoice.status)
    );
    const savedDrafts = invoiceDrafts.filter((draft) => draft.status !== 'Correction Draft');
    const correctionDrafts = invoiceDrafts.filter((draft) => draft.status === 'Correction Draft');
    const blockedApproved = approvedInvoices.filter(
      (invoice) => getInvoiceReversalBlockers(invoice.id).length > 0
    );

    return {
      drafts: savedDrafts.map((record) => ({ type: 'draft', record })),
      approved: approvedInvoices.map((record) => ({ type: 'invoice', record })),
      reverted: revertedInvoices.map((record) => ({ type: 'invoice', record })),
      needsCorrection: [
        ...correctionDrafts.map((record) => ({ type: 'draft', record })),
        ...blockedApproved.map((record) => ({ type: 'invoice', record })),
      ],
    };
  }, [data.invoiceDrafts, data.invoiceReceipts, getInvoiceReversalBlockers]);

  const activeRecords = recordsByTab[activeTab] || [];
  const selectedRecord =
    activeRecords.find((item) => recordKey(item) === selectedKey) || activeRecords[0] || null;

  useEffect(() => {
    const invoiceId = location.state?.invoiceId;

    if (!invoiceId || highlightedInvoiceId === invoiceId) {
      return;
    }

    setActiveTab('approved');
    setSelectedKey(`invoice:${invoiceId}`);
    setHighlightedInvoiceId(invoiceId);
  }, [highlightedInvoiceId, location.state]);

  useEffect(() => {
    if (!activeRecords.length) {
      setSelectedKey('');
      return;
    }

    if (!activeRecords.some((item) => recordKey(item) === selectedKey)) {
      setSelectedKey(recordKey(activeRecords[0]));
    }
  }, [activeRecords, selectedKey]);

  function handleDeleteDraft(draft) {
    requestConfirmation(
      {
        title: 'Delete stored invoice draft?',
        description:
          'This removes the saved draft from the review queue. Approved invoices and audit records are not affected.',
        details: [
          { label: 'Draft', value: draftTitle(draft) },
          { label: 'Vendor', value: draft.vendor?.name || 'Vendor pending' },
          { label: 'Payable', value: formatMoney(Number(draft.totals?.netTotal || 0)) },
        ],
        confirmLabel: 'Delete Draft',
        tone: 'danger',
      },
      () => {
        deleteInvoiceDraft(draft.id);
        setMessage(`${draftTitle(draft)} removed from stored drafts.`);
      }
    );
  }

  function handleRevert(invoice) {
    const reason = revertReason.trim();
    const blockers = getInvoiceReversalBlockers(invoice.id);

    if (!reason) {
      setMessage('Enter a reason before reverting the invoice approval.');
      return;
    }

    if (blockers.length) {
      setMessage(blockers.join(' '));
      return;
    }

    requestConfirmation(
      {
        title: 'Revert approved invoice?',
        description:
          'This will deactivate the posted stock lots, reduce the supplier payable balance, and create a correction draft.',
        details: [
          { label: 'Invoice', value: invoiceTitle(invoice) },
          { label: 'Supplier', value: invoice.supplierName },
          { label: 'Payable', value: formatMoney(invoice.netTotal) },
          { label: 'Reason', value: reason },
        ],
        confirmLabel: 'Revert Invoice',
        tone: 'danger',
      },
      () => {
        try {
          const correctionDraft = revertInvoiceReceipt(invoice.id, reason);
          setMessage(`${invoiceTitle(invoice)} reverted. A correction draft is ready for review.`);
          setRevertReason('');
          setActiveTab('needsCorrection');
          setSelectedKey(`draft:${correctionDraft.id}`);
        } catch (error) {
          setMessage(error.message);
        }
      }
    );
  }

  return (
    <>
      <div className="erp-summary-grid">
        <div className="erp-stat erp-kpi-stat stat-draft-queue">
          <span>Stored Drafts</span>
          <strong>{recordsByTab.drafts.length}</strong>
          <small>waiting for review</small>
        </div>
        <div className="erp-stat erp-kpi-stat stat-approved">
          <span>Approved</span>
          <strong>{recordsByTab.approved.length}</strong>
          <small>posted into inventory</small>
        </div>
        <div className="erp-stat erp-kpi-stat stat-reverted">
          <span>Reverted</span>
          <strong>{recordsByTab.reverted.length}</strong>
          <small>kept for audit</small>
        </div>
        <div
          className={`erp-stat erp-kpi-stat ${
            recordsByTab.needsCorrection.length > 0 ? 'stat-correction' : 'stat-approved'
          }`}
        >
          <span>Needs Correction</span>
          <strong>{recordsByTab.needsCorrection.length}</strong>
          <small>drafts or stock-locked invoices</small>
        </div>
      </div>

      {message && <p className="erp-message">{message}</p>}

      <div className="erp-workspace invoice-register-workspace">
        <section className="erp-panel">
          <div className="erp-panel-title">
            <div>
              <h2>Invoice Queue</h2>
              <p className="erp-muted-note">
                Review stored drafts, approved invoices, and corrections.
              </p>
            </div>
            <Link className="erp-button secondary" to="/inventory/intake">
              <FileText size={17} />
              New Intake
            </Link>
          </div>

          <div className="erp-tabs" role="tablist" aria-label="Invoice register queues">
            {registerTabs.map((tab) => (
              <button
                className={activeTab === tab.id ? 'erp-tab active' : 'erp-tab'}
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setMessage('');
                }}
              >
                {tab.label}
                <span className="inventory-tab-count">{recordsByTab[tab.id].length}</span>
              </button>
            ))}
          </div>

          <div className="invoice-register-list">
            {activeRecords.map((item) => {
              const key = recordKey(item);
              const record = item.record;
              const isDraft = item.type === 'draft';
              const blockers = isDraft ? [] : getInvoiceReversalBlockers(record.id);

              return (
                <button
                  className={
                    key === recordKey(selectedRecord || {})
                      ? 'invoice-list-row active'
                      : 'invoice-list-row'
                  }
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                >
                  <span>
                    <strong>{isDraft ? draftTitle(record) : invoiceTitle(record)}</strong>
                    <small>
                      {isDraft
                        ? record.vendor?.name || 'Vendor pending'
                        : `${record.supplierName} | ${formatMoney(record.netTotal)}`}
                    </small>
                  </span>
                  <span className={statusClass(isDraft ? record.status : record.status)}>
                    {isDraft && record.status === 'Correction Draft'
                      ? 'Correction'
                      : blockers.length
                        ? 'Stock Locked'
                        : record.status}
                  </span>
                </button>
              );
            })}
            {activeRecords.length === 0 && (
              <div className="erp-empty-state">No invoices in this queue.</div>
            )}
          </div>
        </section>

        <aside className="erp-panel invoice-detail-panel">
          {selectedRecord ? (
            selectedRecord.type === 'draft' ? (
              <DraftDetail draft={selectedRecord.record} onDelete={handleDeleteDraft} />
            ) : (
              <InvoiceDetail
                data={data}
                invoice={selectedRecord.record}
                onRevert={handleRevert}
                revertReason={revertReason}
                reversalBlockers={getInvoiceReversalBlockers(selectedRecord.record.id)}
                setRevertReason={setRevertReason}
              />
            )
          ) : (
            <p className="erp-muted-note">Select a queue item to inspect it.</p>
          )}
        </aside>
      </div>
      {confirmationDialog}
    </>
  );
}

function DraftDetail({ draft, onDelete }) {
  const lineItems = draft.items || [];

  return (
    <>
      <div className="erp-panel-title">
        <div>
          <h2>{draftTitle(draft)}</h2>
          <p className="erp-muted-note">{draft.vendor?.name || 'Vendor pending'}</p>
        </div>
        <span className={statusClass(draft.status)}>{draft.status}</span>
      </div>
      <dl className="erp-mini-list">
        <div>
          <dt>Invoice Date</dt>
          <dd>{draft.invoice?.date || 'Missing'}</dd>
        </div>
        <div>
          <dt>Stock Lines</dt>
          <dd>{lineItems.filter((item) => item.teaName).length}</dd>
        </div>
        <div>
          <dt>Payable</dt>
          <dd>{formatMoney(Number(draft.totals?.netTotal || 0))}</dd>
        </div>
      </dl>
      <div className="inventory-action-stack">
        <Link className="erp-button" to={`/inventory/intake?draftId=${draft.id}`}>
          Open Draft
        </Link>
        <button
          className="erp-button secondary danger"
          type="button"
          onClick={() => onDelete(draft)}
        >
          <Trash2 size={17} />
          Delete Draft
        </button>
      </div>
      <LineItemList items={lineItems} />
    </>
  );
}

function InvoiceDetail({
  data,
  invoice,
  onRevert,
  reversalBlockers,
  revertReason,
  setRevertReason,
}) {
  const correctionDraft = (data.invoiceDrafts || []).find(
    (draft) => draft.correctionOfInvoiceId === invoice.id
  );
  const rawLots = (invoice.rawLotIds || []).map((lotId) => {
    return data.rawLots.find((lot) => lot.id === lotId) || { id: lotId, status: 'Inactive' };
  });
  const canRevert = invoice.status === 'Approved' && reversalBlockers.length === 0;

  return (
    <>
      <div className="erp-panel-title">
        <div>
          <h2>{invoiceTitle(invoice)}</h2>
          <p className="erp-muted-note">{invoice.supplierName}</p>
        </div>
        <span className={statusClass(invoice.status)}>{invoice.status}</span>
      </div>
      <dl className="erp-mini-list">
        <div>
          <dt>Invoice Date</dt>
          <dd>{invoice.invoiceDate}</dd>
        </div>
        <div>
          <dt>Payable</dt>
          <dd>{formatMoney(invoice.netTotal)}</dd>
        </div>
        <div>
          <dt>Generated Lots</dt>
          <dd>{(invoice.rawLotIds || []).length}</dd>
        </div>
      </dl>

      {reversalBlockers.length > 0 && invoice.status === 'Approved' && (
        <div className="erp-message inventory-warning">
          <AlertTriangle size={17} />
          <span>{reversalBlockers.join(' ')}</span>
        </div>
      )}

      {invoice.status === 'Approved' && (
        <div className="invoice-revert-box">
          <label>
            <span>Revert reason</span>
            <textarea
              rows="3"
              value={revertReason}
              onChange={(event) => setRevertReason(event.target.value)}
              placeholder="Wrong quantity, vendor, tax value, or rate"
            />
          </label>
          <button
            className="erp-button secondary"
            disabled={!canRevert}
            type="button"
            onClick={() => onRevert(invoice)}
          >
            <RotateCcw size={17} />
            Revert & Create Correction
          </button>
        </div>
      )}

      {correctionDraft && (
        <Link className="erp-button" to={`/inventory/intake?draftId=${correctionDraft.id}`}>
          Open Correction Draft
        </Link>
      )}

      <section className="invoice-detail-section">
        <h3>Stock Impact</h3>
        <div className="erp-trace-list">
          {rawLots.map((lot) => (
            <div key={lot.id}>
              <strong>{lot.variety ? `${lot.variety} ${lot.grade}` : lot.id}</strong>
              <span>
                {lot.remainingKg !== undefined
                  ? `${formatKg(lot.remainingKg)} active | ${formatKg(lot.receivedKg)} received`
                  : 'inactive after reversal'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <LineItemList items={invoice.lineItems || []} />
    </>
  );
}

function LineItemList({ items }) {
  if (!items.length) {
    return <p className="erp-muted-note">No stock lines stored.</p>;
  }

  return (
    <section className="invoice-detail-section">
      <h3>Stock Lines</h3>
      <div className="erp-trace-list">
        {items.map((item) => (
          <div key={item.id || `${item.teaName}-${item.grade}`}>
            <strong>
              {item.teaName} {item.grade}
            </strong>
            <span>
              {formatKg(item.receivedKg)} | {formatMoney(item.ratePerKg)}/kg |{' '}
              {formatMoney(item.lineTotal || item.taxableValue)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
