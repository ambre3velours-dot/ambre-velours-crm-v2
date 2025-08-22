
import React, { useEffect, useMemo, useState } from 'react';
class ErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(error) {
    return { err: error };
  }
  componentDidCatch(error, info) {
    console.error('UI Error:', error, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-semibold text-rose-600">
            Oups… une erreur s’est produite
          </h1>
          <pre className="text-xs whitespace-pre-wrap bg-rose-50 p-3 rounded">
            {String(this.state.err?.message || this.state.err)}
          </pre>
          <button
            onClick={() => this.setState({ err: null })}
            className="mt-3 px-3 py-1 rounded border"
          >
            Revenir
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Ambre & Velours — CRM + Ventes + Stock — Complet (localStorage)
 * Front-only : React + Tailwind CDN (déjà ajouté dans index.html)
 *
 * Modules inclus :
 * - Dashboard (KPI, mini-charts, pipeline, sous-seuil, relances)
 * - CRM Prospects/Clients (pipeline, tags, intérêts, valeur potentielle, relances)
 * - Commandes & paiements (devis → confirmé → livré) + COGS capturé à la confirmation + impression facture/BL
 * - Catalogue (prix Retail & Grossiste), Stocks (CMP), Mouvements
 * - Fournisseurs, Bons de commande (PO) avec frais (répartition unité/valeur) + Réception
 * - Retours & Avoirs (réintégration ou casse)
 * - Réassort (min/target + ROP simplifié) + suggestions
 * - Exports CSV (leads, produits, commandes)
 */

/* ===================== Utils & persistence ===================== */

const STORAGE_KEY = 'av-suite-v1';
const CURRENCY = 'FCFA';

const DEFAULT_STATUSES = ['Nouveau', 'Contacté', 'Qualifié', 'Gagné', 'Perdu'];
const DEFAULT_TAGS = ['Prospect', 'VIP', 'Fidèle', 'Influenceur', 'Grossiste'];
const DEFAULT_SOURCES = [
  'DM Instagram',
  'Commentaire',
  'Story',
  'Live',
  'WhatsApp',
  'Referral',
  'Boutique',
];

const TEMPLATES = [
  {
    name: 'Premier contact',
    text: "Bonjour ✨ Merci d'avoir écrit à Ambre & Velours. Dites-moi vos familles olfactives (floral, boisé, gourmand…) et l'occasion. Je vous propose 2–3 options et un test rapide. 😊",
  },
  {
    name: 'Relance douce',
    text: "Coucou, j'espère que vous allez bien 🌸 Aviez-vous eu le temps de réfléchir à votre parfum ? Je peux vous réserver le flacon jusqu'à ce soir et vous proposer une remise fidélité.",
  },
  {
    name: 'Confirmation commande',
    text: "Parfait ! Votre parfum est prêt 🧴✅. Récap: {produit} – {prix} FCFA. Livraison {mode} aujourd'hui/demain. Merci pour votre confiance !",
  },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function fmtMoney(n, cur = CURRENCY) {
  if (n === undefined || n === null || n === '') return '—';
  const v = Number(n) || 0;
  return v.toLocaleString('fr-FR') + ' ' + cur;
}
function sum(arr, f = (x) => x) {
  return arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
}
function toCSV(headers, rows) {
  const esc = (s) => '"' + String(s ?? '').replaceAll('"', '""') + '"';
  const lines = [headers.join(',')].concat(
    rows.map((r) => headers.map((h) => esc(r[h])).join(','))
  );
  return lines.join('\n');
}

function useLocalState() {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    const p1 = {
      id: uid(),
      sku: 'OJAR-WW-70',
      name: 'OJAR Wood Whisper 70ml',
      brand: 'OJAR',
      family: 'Ambré boisé',
      volume: 70,
      priceRetailTTC: 85000,
      priceWholesaleTTC: 78000,
      taxRate: 0.18,
      stock: 6,
      cmp: 42000,
      min: 3,
      target: 10,
      leadTimeDays: 14,
      moq: 6,
    };
    const p2 = {
      id: uid(),
      sku: 'XJ-EP-100',
      name: 'Xerjoff Erba Pura 100ml',
      brand: 'Xerjoff',
      family: 'Hespéridé gourmand',
      volume: 100,
      priceRetailTTC: 140000,
      priceWholesaleTTC: 125000,
      taxRate: 0.18,
      stock: 4,
      cmp: 70000,
      min: 2,
      target: 8,
      leadTimeDays: 21,
      moq: 4,
    };
    return {
      settings: {
        tva: 0.18,
        service_level_z: 1.65,
        reorder_window_days: 60,
        holding_rate: 0.25,
      },
      leads: [
        {
          id: uid(),
          name: 'Noura K.',
          ig: '@nourak_',
          city: 'Abidjan',
          source: 'DM Instagram',
          status: 'Contacté',
          tags: ['Prospect'],
          interests: [p1.name],
          value: 85000,
          nextFollowUp: todayISO(),
          notes:
            'Aime boisés/vanillés. Proposer Wood Whisper + Vanille Fatale.',
          createdAt: todayISO(),
        },
        {
          id: uid(),
          name: 'Yann B.',
          ig: '@yannbiz',
          city: 'Abidjan',
          source: 'Story',
          status: 'Qualifié',
          tags: ['VIP'],
          interests: ['YSL La Nuit de l’Homme'],
          value: 72000,
          nextFollowUp: todayISO(),
          notes: 'Parfum soir, sillage modéré.',
          createdAt: todayISO(),
        },
        {
          id: uid(),
          name: 'Aïcha D.',
          ig: '@aicha.fragrance',
          city: 'Cocody',
          source: 'Referral',
          status: 'Nouveau',
          tags: ['Influenceur'],
          interests: [p2.name],
          value: 140000,
          nextFollowUp: todayISO(),
          notes: 'Aime agrumes sucrés.',
          createdAt: todayISO(),
        },
      ],
      clients: [
        {
          id: uid(),
          name: 'Client Comptoir',
          tags: ['Retail'],
          city: 'Abidjan',
        },
      ],
      products: [p1, p2],
      orders: [
        {
          id: uid(),
          number: 'CMD-0001',
          date: todayISO(),
          clientName: 'Client Comptoir',
          status: 'Livrée',
          channel: 'Boutique',
          discount: 0,
          shipping: 2000,
          lines: [
            {
              id: uid(),
              productId: p1.id,
              name: p1.name,
              qty: 1,
              priceTTC: p1.priceRetailTTC,
              cogsUnit: p1.cmp, // COGS capturé
            },
          ],
          payments: [
            {
              mode: 'Espèces',
              amount: p1.priceRetailTTC + 2000,
              date: todayISO(),
            },
          ],
        },
      ],
      stockMoves: [],
      suppliers: [
        {
          id: uid(),
          name: 'Fournisseur Istanbul',
          contact: 'mehmet@exemple.com',
          leadDays: 14,
          moq: 6,
          currency: 'EUR',
        },
      ],
      pos: [],
      returns: [],
    };
  });

  useEffect(
    () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)),
    [state]
  );

  return [state, setState];
}

/* ===================== Small UI primitives ===================== */

function Badge({ children, tone = 'slate' }) {
  const color = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    violet: 'bg-violet-100 text-violet-700',
  }[tone];
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full ${color} whitespace-nowrap`}
    >
      {children}
    </span>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-0 top-8 mx-auto w-[min(980px,94vw)] rounded-2xl bg-white shadow-xl border">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} className="text-sm text-gray-500">
            Fermer
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 ${className}`}>
      {children}
    </div>
  );
}
function Sparkline({ data = [5, 8, 3, 9, 6, 10], h = 48 }) {
  const w = 160;
  const max = Math.max(1, ...data);
  const step = w / (data.length - 1 || 1);
  const pts = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={pts}
      />
    </svg>
  );
}
function ProgressRing({ value = 70, size = 72 }) {
  const radius = (size - 8) / 2,
    c = 2 * Math.PI * radius,
    offset = c * (1 - value / 100);
  return (
    <svg width={size} height={size} className="text-amber-600">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#eee"
        strokeWidth="8"
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth="8"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

function TextField({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <input
        type={type}
        className="w-full rounded-xl border px-3 py-2"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function NumberField({ label, value, onChange, step = '1' }) {
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <input
        type="number"
        step={step}
        className="w-full rounded-xl border px-3 py-2"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
function TextArea({ label, value, onChange, rows = 3 }) {
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <textarea
        rows={rows}
        className="w-full rounded-xl border px-3 py-2"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function DateField({ label, value, onChange }) {
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <input
        type="date"
        className="w-full rounded-xl border px-3 py-2"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <select
        className="w-full rounded-xl border px-3 py-2 bg-white"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {(options || []).map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>
            {o.label ?? o}
          </option>
        ))}
      </select>
    </label>
  );
}
function SelectField({ label, value, onChange, options }) {
  const safeValue = (options || []).includes(value)
    ? value
    : (options || [])[0] ?? '';
  return (
    <label className="block">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <select
        className="w-full rounded-xl border px-3 py-2 bg-white"
        value={safeValue}
        onChange={(e) => onChange(e.target.value)}
      >
        {(options || []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ===================== Stock helpers ===================== */

function recalcCMP(prevCMP, prevQty, recvQty, unitCost) {
  const totalCost = prevCMP * prevQty + unitCost * recvQty;
  const totalQty = prevQty + recvQty;
  return totalQty <= 0 ? 0 : totalCost / totalQty;
}
function allocFees(totalFee, lines, mode = 'per_unit') {
  if (!totalFee || totalFee <= 0)
    return lines.map((l) => ({ ...l, feeAlloc: 0 }));
  const sumQty = sum(lines, (l) => l.qty || 0);
  const sumVal = sum(lines, (l) => (l.unitCost || 0) * (l.qty || 0));
  return lines.map((l) => {
    const qty = Number(l.qty || 0);
    const val = Number(l.unitCost || 0) * qty;
    let alloc = 0;
    if (mode === 'per_unit') alloc = (qty / (sumQty || 1)) * totalFee;
    else alloc = (val / (sumVal || 1)) * totalFee;
    return { ...l, feeAlloc: alloc };
  });
}

/* ===================== App ===================== */

export default function App() {
  const [state, setState] = useLocalState();
  const [tab, setTab] = useState('dashboard');

  // Shortcuts
  const {
    leads,
    clients,
    products,
    orders,
    suppliers,
    pos,
    returns,
    stockMoves,
    settings,
  } = state;

  /* KPI */
  const stats = useMemo(() => {
    const ca = sum(
      orders,
      (o) =>
        sum(o.lines, (l) => (l.priceTTC || 0) * (l.qty || 0)) -
        (o.discount || 0) +
        (o.shipping || 0)
    );
    const cogs = sum(orders, (o) =>
      sum(o.lines, (l) => (l.cogsUnit || 0) * (l.qty || 0))
    );
    const units = sum(orders, (o) => sum(o.lines, (l) => l.qty || 0));
    const aov = orders.length ? ca / orders.length : 0;

    // top produits par CA
    const map = {};
    orders.forEach((o) =>
      (o.lines || []).forEach((l) => {
        map[l.productId] =
          (map[l.productId] || 0) + (l.priceTTC || 0) * (l.qty || 0);
      })
    );
    const top = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pid, val]) => ({
        name: products.find((p) => p.id === pid)?.name || '—',
        revenue: val,
      }));

    // 14 jours sparkline
    const days = 14;
    const arr = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayTotal = sum(
        orders.filter((o) => o.date === key),
        (o) => sum(o.lines, (l) => (l.priceTTC || 0) * (l.qty || 0))
      );
      arr.push(dayTotal);
    }

    return {
      ca,
      cogs,
      marge: ca - cogs,
      units,
      ordersCount: orders.length,
      aov,
      top,
      spark: arr,
    };
  }, [orders, products]);

  // Pipeline / relances
  const today = todayISO();
  const leadsDue = useMemo(
    () =>
      leads
        .filter((l) => l.nextFollowUp && l.nextFollowUp <= today)
        .sort((a, b) =>
          (a.nextFollowUp || '').localeCompare(b.nextFollowUp || '')
        ),
    [leads]
  );
  const pipelineValue = useMemo(
    () =>
      sum(
        leads.filter((l) =>
          ['Nouveau', 'Contacté', 'Qualifié'].includes(l.status)
        ),
        (l) => l.value || 0
      ),
    [leads]
  );
  const lowStock = useMemo(
    () => products.filter((p) => (p.stock || 0) <= (p.min || 0)),
    [products]
  );

  // Mutations
  function saveLead(ld) {
    setState((s) => ({
      ...s,
      leads: s.leads.some((x) => x.id === ld.id)
        ? s.leads.map((x) => (x.id === ld.id ? ld : x))
        : [ld, ...s.leads],
    }));
  }
  function delLead(id) {
    setState((s) => ({ ...s, leads: s.leads.filter((x) => x.id !== id) }));
  }
  function saveClient(c) {
    setState((s) => ({
      ...s,
      clients: s.clients.some((x) => x.id === c.id)
        ? s.clients.map((x) => (x.id === c.id ? c : x))
        : [c, ...s.clients],
    }));
  }
  function saveProduct(p) {
    setState((s) => ({
      ...s,
      products: s.products.some((x) => x.id === p.id)
        ? s.products.map((x) => (x.id === p.id ? p : x))
        : [p, ...s.products],
    }));
  }
  function addStockMove(m) {
    setState((s) => ({
      ...s,
      stockMoves: [{ ...m, id: uid() }, ...s.stockMoves],
    }));
  }
  function updateProductStockCost(productId, deltaQty, unitInCost) {
    setState((s) => {
      const products = s.products.map((p) => {
        if (p.id !== productId) return p;
        const prevQty = Number(p.stock || 0);
        if (deltaQty >= 0) {
          const newCMP = recalcCMP(
            Number(p.cmp || 0),
            prevQty,
            Number(deltaQty),
            Number(unitInCost || 0)
          );
          return { ...p, stock: prevQty + deltaQty, cmp: newCMP };
        } else {
          return { ...p, stock: Math.max(0, prevQty + deltaQty) };
        }
      });
      return { ...s, products };
    });
  }

  
  // Orders
  function saveOrder(o) {
    setState((s) => ({
      ...s,
      orders: s.orders.some((x) => x.id === o.id)
        ? s.orders.map((x) => (x.id === o.id ? o : x))
        : [o, ...s.orders],
    }));
  }
  function confirmOrder(o) {
    if (o.status !== 'Brouillon' && o.status !== 'Confirmée') return;
    // capture COGS au moment de la confirmation + décrément stock
    const mapP = Object.fromEntries(products.map((p) => [p.id, p]));
    const newLines = (o.lines || []).map((l) => ({
      ...l,
      cogsUnit: mapP[l.productId]?.cmp || 0,
    }));
    newLines.forEach((l) => {
      updateProductStockCost(l.productId, -Number(l.qty || 0), 0);
      addStockMove({
        date: todayISO(),
        productId: l.productId,
        type: 'sortie',
        qty: Number(l.qty || 0),
        unitCost: newLines.find((x) => x.id === l.id)?.cogsUnit || 0,
        ref: o.number,
      });
    });
    const next = { ...o, status: 'Confirmée', lines: newLines };
    saveOrder(next);
    alert('Commande confirmée ✔ (stock décrémenté)');
  }
// Encaisser un paiement sur une commande existante
function addPayment(orderId, mode, amount) {
  if (!amount || amount <= 0) return;
  setState((s) => ({
    ...s,
    orders: s.orders.map((o) =>
      o.id === orderId
        ? { ...o, payments: [...(o.payments || []), { mode, amount: Number(amount), date: todayISO() }] }
        : o
    ),
  }));
}

// Crédits manuels (sans ligne de produit stock) – compté dans le CA, COGS = 0
function createManualCredit({ clientName, date, amount, note }) {
  const o = {
    id: uid(),
    number: `CMD-${String(state.orders.length + 1).padStart(4, "0")}`,
    date: date || todayISO(),
    clientName: clientName || "Client",
    status: "Confirmée",
    channel: "Boutique",
    discount: 0,
    shipping: 0,
    lines: [
      { id: uid(), productId: null, name: note || "Crédit manuel", qty: 1, priceTTC: Number(amount || 0), cogsUnit: 0 },
    ],
    payments: [],
  };
  saveOrder(o);
  alert("Crédit manuel créé ✔");
}

  // Suppliers & POs
  function saveSupplier(sup) {
    setState((s) => ({
      ...s,
      suppliers: s.suppliers.some((x) => x.id === sup.id)
        ? s.suppliers.map((x) => (x.id === sup.id ? sup : x))
        : [sup, ...s.suppliers],
    }));
  }
  function savePO(po) {
    setState((s) => ({
      ...s,
      pos: s.pos.some((x) => x.id === po.id)
        ? s.pos.map((x) => (x.id === po.id ? po : x))
        : [po, ...s.pos],
    }));
  }
  function receivePO(po) {
    if (po.status === 'Reçu') return alert('PO déjà reçu');
    const feeTotal =
      Number(po.fees_shipping || 0) +
      Number(po.fees_customs || 0) +
      Number(po.fees_pack || 0);
    const linesAlloc = allocFees(
      feeTotal,
      po.lines || [],
      po.feeMode || 'per_unit'
    );
    linesAlloc.forEach((l) => {
      const qty = Number(l.qty || 0);
      const inCost =
        Number(l.unitCost || 0) + Number(l.feeAlloc || 0) / (qty || 1);
      updateProductStockCost(l.productId, qty, inCost);
      addStockMove({
        date: todayISO(),
        productId: l.productId,
        type: 'entrée',
        qty,
        unitCost: inCost,
        ref: po.number,
      });
    });
    savePO({ ...po, status: 'Reçu', receivedAt: todayISO() });
    alert('Réception enregistrée ✔');
  }

  // Returns
  function saveReturn(r) {
    setState((s) => ({
      ...s,
      returns: s.returns.some((x) => x.id === r.id)
        ? s.returns.map((x) => (x.id === r.id ? r : x))
        : [r, ...s.returns],
    }));
    const q = Number(r.qty || 0);
    if (q > 0) {
      if (r.restock) {
        updateProductStockCost(r.productId, q, 0);
        addStockMove({
          date: r.date,
          productId: r.productId,
          type: 'entrée',
          qty: q,
          unitCost: 0,
          ref: 'RET',
        });
      } else {
        updateProductStockCost(r.productId, -q, 0);
        addStockMove({
          date: r.date,
          productId: r.productId,
          type: 'ajustement',
          qty: -q,
          unitCost: 0,
          ref: 'Casse',
        });
      }
    }
  }

  // Réassort suggéré
  const suggestions = useMemo(() => {
    const days = Number(settings.reorder_window_days || 60);
    const cutoff = new Date(Date.now() - days * 86400000)
      .toISOString()
      .slice(0, 10);
    const sales = {};
    orders.forEach((o) => {
      if (o.date >= cutoff) {
        (o.lines || []).forEach((l) => {
          if (!l.productId) return;
          sales[l.productId] = (sales[l.productId] || 0) + Number(l.qty || 0);
        });
      }
    });
    return products.map((p) => {
      const sold = sales[p.id] || 0;
      const d = sold / Math.max(1, days); // demande / jour
      const L = Number(p.leadTimeDays || 14);
      const sigma = Math.sqrt(Math.max(0, d * (1 - d))); // simpliste
      const Z = Number(settings.service_level_z || 1.65);
      const SS = Z * sigma * Math.sqrt(L);
      const ROP = d * L + SS;
      const stock = Number(p.stock || 0);
      const min = Number(p.min || 0);
      const target = Number(p.target || Math.max(min * 2, 4));
      const suggested =
        stock <= min ? Math.max(0, Math.ceil(target - stock)) : 0;
      return { product: p, d, ROP, SS, suggested, soldWindow: sold };
    });
  }, [products, orders, settings]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-rose-500 text-white">
          <div className="mx-auto max-w-7xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold">Ambre & Velours</div>
              <div className="text-sm opacity-90">CRM • Ventes • Stock</div>
            </div>
            <nav className="flex flex-wrap gap-2">
              {[
                { k: 'dashboard', t: 'Dashboard' },
                { k: 'crm', t: 'CRM' },
                { k: 'orders', t: 'Commandes' },
                { k: 'catalog', t: 'Catalogue' },
                { k: 'suppliers', t: 'Fournisseurs' },
                { k: 'po', t: 'Bons de commande' },
                { k: 'returns', t: 'Retours' },
                { k: 'replenish', t: 'Réassort' },
                { k: "ar", t: "Crédits" },
                { k: 'mov', t: 'Mouvements' },
              ].map((it) => (
                <button
                  key={it.k}
                  onClick={() => setTab(it.k)}
                  className={`px-3 py-2 rounded-xl text-sm ${
                    tab === it.k
                      ? 'bg-white/20'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {it.t}
                </button>
              ))}
              <button
    onClick={() => setTab("ar")}
    className={`px-3 py-2 rounded-xl text-sm ${tab === "ar" ? "bg-white/20" : "bg-white/10 hover:bg-white/20"}`}
  >
    Crédits
  </button>
            </nav>
          </div>
        </div>

        <div className="mx-auto max-w-7xl p-5 space-y-6">
          {tab === 'dashboard' && (
            <Dashboard
              stats={stats}
              leads={leads}
              leadsDue={leadsDue}
              pipelineValue={pipelineValue}
              lowStock={lowStock}
              suggestions={suggestions}
            />
          )}
{tab === "ar" && (
  <Receivables
    orders={orders}
    products={products}
    onAddPayment={addPayment}
    onCreateCredit={createManualCredit}
  />
)}

          {tab === 'crm' && (
            <CRM leads={leads} onSave={saveLead} onDelete={delLead} />
          )}
          {tab === "ar" && (
  <Receivables
    orders={orders}
    products={products}
    onAddPayment={addPayment}
    onCreateCredit={createManualCredit}
  />
)}


          {tab === 'orders' && (
            <Orders
              orders={orders}
              products={products}
              onSave={saveOrder}
              onConfirm={confirmOrder}
            />
          )}

          {tab === 'catalog' && (
            <Catalog products={products} onSave={saveProduct} />
          )}

          {tab === 'suppliers' && (
            <Suppliers suppliers={suppliers} onSave={saveSupplier} />
          )}

          {tab === 'po' && (
            <POs
              pos={pos}
              products={products}
              suppliers={suppliers}
              onSavePO={savePO}
              onReceivePO={receivePO}
            />
          )}

          {tab === 'returns' && (
            <Returns
              products={products}
              returns={returns}
              onSave={saveReturn}
            />
          )}

          {tab === 'replenish' && <Replenish suggestions={suggestions} />}

          {tab === 'mov' && (
            <Movements moves={stockMoves} products={products} />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
function Receivables({ orders, products, onAddPayment, onCreateCredit }) {
  const [encaisse, setEncaisse] = useState(null); // {order, mode, amount}
  const [showCredit, setShowCredit] = useState(false);

  const rows = useMemo(() => {
    return orders
      .filter((o) => o.status !== "Annulée")
      .map((o) => {
        const subtotal = (o.lines || []).reduce((s, l) => s + (Number(l.priceTTC) || 0) * (Number(l.qty) || 0), 0);
        const total = subtotal - (o.discount || 0) + (o.shipping || 0);
        const paid = (o.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const rest = Math.max(0, total - paid);
        return { order: o, total, paid, rest };
      })
      .filter((r) => r.rest > 0)
      .sort((a, b) => b.rest - a.rest);
  }, [orders]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Crédits & Restes à payer</div>
        <button onClick={() => setShowCredit(true)} className="rounded-xl bg-black text-white px-4 py-2 text-sm">➕ Crédit manuel</button>
      </div>

      <div className="rounded-2xl border overflow-x-auto bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-3">Commande</th>
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3">Total</th>
              <th className="px-3 py-3">Payé</th>
              <th className="px-3 py-3">Reste</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ order, total, paid, rest }) => (
              <tr key={order.id} className="border-t">
                <td className="px-3 py-3">{order.number}</td>
                <td className="px-3 py-3">{order.clientName || "—"}</td>
                <td className="px-3 py-3">{fmtMoney(total)}</td>
                <td className="px-3 py-3">{fmtMoney(paid)}</td>
                <td className="px-3 py-3 font-medium">{fmtMoney(rest)}</td>
                <td className="px-3 py-3 text-right">
                  <button
                    className="px-3 py-1 rounded-lg border text-sm"
                    onClick={() => setEncaisse({ order, mode: "Espèces", amount: rest })}
                  >
                    Encaisser
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">Aucun reste à payer</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modale encaissement */}
      {encaisse && (
        <Modal open={!!encaisse} onClose={() => setEncaisse(null)} title={`Encaisser • ${encaisse.order.number}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select
              label="Mode"
              value={encaisse.mode}
              onChange={(v) => setEncaisse((e) => ({ ...e, mode: v }))}
              options={["Espèces", "Mobile Money", "Virement", "CB"]}
            />
            <NumberField
              label="Montant"
              value={encaisse.amount}
              onChange={(n) => setEncaisse((e) => ({ ...e, amount: n }))}
            />
            <div className="flex items-end">
              <button
                onClick={() => { onAddPayment(encaisse.order.id, encaisse.mode, encaisse.amount); setEncaisse(null); }}
                className="rounded-2xl bg-black text-white px-5 py-2 text-sm"
              >
                Valider
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modale crédit manuel */}
      {showCredit && (
        <Modal open={showCredit} onClose={() => setShowCredit(false)} title="Nouveau crédit manuel">
          <CreateCreditForm
            onCancel={() => setShowCredit(false)}
            onCreate={(payload) => { onCreateCredit(payload); setShowCredit(false); }}
          />
        </Modal>
      )}
    </div>
  );
}

function CreateCreditForm({ onCreate, onCancel }) {
  const [clientName, setClientName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("Crédit manuel");
  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <TextField label="Client" value={clientName} onChange={setClientName} />
        <DateField label="Date" value={date} onChange={setDate} />
        <NumberField label="Montant TTC" value={amount} onChange={setAmount} />
        <TextField label="Libellé" value={note} onChange={setNote} />
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => onCreate({ clientName, date, amount, note })} className="rounded-2xl bg-black text-white px-5 py-2 text-sm">Créer</button>
        <button onClick={onCancel} className="text-sm text-gray-600">Annuler</button>
      </div>
    </div>
  );
}


/* ===================== Dashboard ===================== */

function Dashboard({
  stats,
  leads,
  leadsDue,
  pipelineValue,
  lowStock,
  suggestions,
}) {
  const pipelineCounts = DEFAULT_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: leads.filter((l) => l.status === s).length }),
    {}
  );
  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <div className="text-sm text-gray-500">CA</div>
          <div className="text-2xl font-semibold">{fmtMoney(stats.ca)}</div>
          <Sparkline data={stats.spark} />
        </Card>
        <Card>
          <div className="text-sm text-gray-500">COGS</div>
          <div className="text-2xl font-semibold">{fmtMoney(stats.cogs)}</div>
          <Sparkline data={stats.spark.map((v) => v * 0.65)} />
        </Card>
        <Card>
          <div className="text-sm text-gray-500">Marge</div>
          <div className="text-2xl font-semibold">{fmtMoney(stats.marge)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.ca ? Math.round((stats.marge / stats.ca) * 100) : 0}%
          </div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">Commandes</div>
          <div className="text-2xl font-semibold">{stats.ordersCount}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500">Unités</div>
          <div className="text-2xl font-semibold">{stats.units}</div>
        </Card>
        <Card className="flex items-center gap-3">
          <ProgressRing
            value={Math.min(
              100,
              Math.round((stats.ca / (stats.ca + stats.cogs || 1)) * 100)
            )}
          />
          <div>
            <div className="text-sm text-gray-500">AOV</div>
            <div className="text-2xl font-semibold">{fmtMoney(stats.aov)}</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <div className="text-lg font-semibold mb-2">Pipeline prospects</div>
          <div className="grid grid-cols-2 gap-2">
            {DEFAULT_STATUSES.map((s) => (
              <div key={s} className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">{s}</div>
                <div className="text-xl font-semibold">
                  {pipelineCounts[s] || 0}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm text-gray-600">
            Valeur potentielle: <b>{fmtMoney(pipelineValue)}</b>
          </div>
        </Card>

        <Card>
          <div className="text-lg font-semibold mb-2">Sous seuil</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">Produit</th>
                <th>Stock</th>
                <th>Min</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-1 text-gray-800">{p.name}</td>
                  <td>{p.stock}</td>
                  <td>{p.min}</td>
                </tr>
              ))}
              {lowStock.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-gray-500">
                    Aucun
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card>
          <div className="text-lg font-semibold mb-2">
            À relancer aujourd'hui
          </div>
          <div className="space-y-2 max-h-48 overflow-auto pr-1">
            {leadsDue.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-xl border p-2"
              >
                <div>
                  <div className="font-medium text-sm">{l.name}</div>
                  <div className="text-xs text-gray-500">
                    {l.ig} • {l.status} • {l.nextFollowUp}
                  </div>
                </div>
                <a
                  className="text-xs text-blue-600 hover:underline"
                  href={
                    l.ig && l.ig.startsWith('@')
                      ? `https://instagram.com/${l.ig.slice(1)}`
                      : l.ig
                      ? `https://instagram.com/${l.ig}`
                      : undefined
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  DM ↗
                </a>
              </div>
            ))}
            {leadsDue.length === 0 && (
              <div className="text-sm text-gray-500">Rien à relancer</div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="text-lg font-semibold mb-2">Top produits (CA)</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">Produit</th>
                <th>CA</th>
              </tr>
            </thead>
            <tbody>
              {stats.top.map((t) => (
                <tr key={t.name} className="border-t">
                  <td className="py-1">{t.name}</td>
                  <td>{fmtMoney(t.revenue)}</td>
                </tr>
              ))}
              {stats.top.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-3 text-center text-gray-500">
                    Pas encore de ventes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card>
          <div className="text-lg font-semibold mb-2">Réassort suggéré</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">Produit</th>
                <th>ROP</th>
                <th>Stock</th>
                <th>Sugg.</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => (
                <tr key={s.product.id} className="border-t">
                  <td className="py-1">{s.product.name}</td>
                  <td>{Math.ceil(s.ROP)}</td>
                  <td>{s.product.stock}</td>
                  <td className="font-medium">{s.suggested}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

/* ===================== CRM ===================== */

function CRM({ leads, onSave, onDelete }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Tous');
  const [tag, setTag] = useState('Tous');
  const [followOnly, setFollowOnly] = useState(false);
  const [editing, setEditing] = useState(null);

  const today = todayISO();
  const filtered = useMemo(() => {
    let rows = [...leads];
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter((r) =>
        [
          r.name,
          r.ig,
          r.city,
          r.notes,
          (r.tags || []).join(','),
          (r.interests || []).join(','),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    if (status !== 'Tous') rows = rows.filter((r) => r.status === status);
    if (tag !== 'Tous') rows = rows.filter((r) => r.tags?.includes(tag));
    if (followOnly)
      rows = rows.filter((r) => r.nextFollowUp && r.nextFollowUp <= today);
    return rows.sort((a, b) =>
      (a.nextFollowUp || '').localeCompare(b.nextFollowUp || '')
    );
  }, [leads, query, status, tag, followOnly, today]);

  function exportCSV() {
    const headers = [
      'id',
      'name',
      'ig',
      'city',
      'source',
      'status',
      'tags',
      'interests',
      'value',
      'nextFollowUp',
      'notes',
      'createdAt',
    ];
    const rows = filtered.map((l) => ({
      id: l.id,
      name: l.name,
      ig: l.ig,
      city: l.city,
      source: l.source,
      status: l.status,
      tags: (l.tags || []).join('|'),
      interests: (l.interests || []).join('|'),
      value: l.value,
      nextFollowUp: l.nextFollowUp,
      notes: (l.notes || '').replaceAll('\n', ' '),
      createdAt: l.createdAt,
    }));
    const csv = toCSV(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Prospects & Clients</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setEditing({
                id: uid(),
                name: '',
                ig: '',
                city: '',
                source: DEFAULT_SOURCES[0], // "DM Instagram"
                status: DEFAULT_STATUSES[0], // "Nouveau"
                tags: [],
                interests: [],
                value: 0, // <-- nombre obligatoire
                nextFollowUp: todayISO(),
                notes: '',
                createdAt: todayISO(),
              })
            }
            className="rounded-xl bg-black text-white px-4 py-2 text-sm"
          >
            ➕ Nouveau
          </button>
          <button
            onClick={exportCSV}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            📑 Export CSV
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-3 md:p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (nom, @ig, tags, produits…)"
          className="flex-1 rounded-xl border px-3 py-2"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl border px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {['Tous', ...DEFAULT_STATUSES].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            className="rounded-xl border px-3 py-2"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            {['Tous', ...DEFAULT_TAGS].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={followOnly}
              onChange={(e) => setFollowOnly(e.target.checked)}
            />{' '}
            Suivi ⩽ aujourd'hui
          </label>
          <button
            className="rounded-xl border px-3 py-2 text-sm"
            onClick={() => {
              setQuery('');
              setStatus('Tous');
              setTag('Tous');
              setFollowOnly(false);
            }}
          >
            Réinitialiser
          </button>
        </div>
      </div>

      <div className="rounded-2xl border overflow-x-auto bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3">Statut</th>
              <th className="px-3 py-3">Tags</th>
              <th className="px-3 py-3">Intérêts</th>
              <th className="px-3 py-3">Prochain suivi</th>
              <th className="px-3 py-3">Valeur</th>
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-3">
                  <div className="font-medium">{r.name || '—'}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    {r.ig && (
                      <a
                        className="hover:underline"
                        href={
                          r.ig.startsWith('@')
                            ? `https://instagram.com/${r.ig.slice(1)}`
                            : `https://instagram.com/${r.ig}`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.ig}
                      </a>
                    )}
                    {r.city && <span>• {r.city}</span>}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Badge
                    tone={
                      {
                        Nouveau: 'blue',
                        Contacté: 'amber',
                        Qualifié: 'violet',
                        Gagné: 'green',
                        Perdu: 'rose',
                      }[r.status] || 'slate'
                    }
                  >
                    {r.status}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(r.tags || []).map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 max-w-[320px]">
                  <div
                    className="truncate"
                    title={(r.interests || []).join(', ')}
                  >
                    {(r.interests || []).join(', ') || '—'}
                  </div>
                </td>
                <td className="px-3 py-3">{r.nextFollowUp || '—'}</td>
                <td className="px-3 py-3">{fmtMoney(r.value || 0)}</td>
                <td className="px-3 py-3 text-gray-600">{r.source || '—'}</td>
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      className="px-3 py-1 rounded-lg border text-sm"
                      onClick={() => setEditing(r)}
                    >
                      ✏️
                    </button>
                    <button
                      className="px-3 py-1 rounded-lg border text-sm"
                      onClick={() => onDelete(r.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-10 text-center text-gray-500"
                >
                  Aucun résultat
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CRMFormModal
        value={editing}
        onClose={() => setEditing(null)}
        onSave={(v) => {
          onSave(v);
          setEditing(null);
        }}
      />

      <Card>
        <div className="text-sm font-medium mb-2">Templates DM</div>
        <div className="grid md:grid-cols-3 gap-2">
          {TEMPLATES.map((t) => (
            <div key={t.name} className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{t.name}</div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(t.text);
                    alert('Copié ✔');
                  }}
                  className="text-xs px-2 py-1 rounded-lg border"
                >
                  Copier
                </button>
              </div>
              <div className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                {t.text}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CRMFormModal({ value, onSave, onClose }) {
  const safe = React.useMemo(() => {
    if (!value) return null;
    return {
      id: value.id ?? uid(),
      name: value.name ?? '',
      ig: value.ig ?? '',
      city: value.city ?? '',
      source: value.source ?? DEFAULT_SOURCES[0],
      status: value.status ?? DEFAULT_STATUSES[0],
      tags: Array.isArray(value.tags) ? value.tags : [],
      interests: Array.isArray(value.interests) ? value.interests : [],
      value: Number.isFinite(Number(value.value)) ? Number(value.value) : 0,
      nextFollowUp: value.nextFollowUp ?? todayISO(),
      notes: value.notes ?? '',
      createdAt: value.createdAt ?? todayISO(),
    };
  }, [value]);

  const [tmp, setTmp] = useState(safe);
  useEffect(() => setTmp(safe), [safe]);
  if (!value || !tmp) return null;

  const set = (k, val) => setTmp((t) => ({ ...t, [k]: val }));

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-0 top-10 mx-auto w-[min(900px,94vw)] rounded-2xl bg-white shadow-xl border">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="text-lg font-semibold">
            {value?.id ? 'Modifier' : 'Nouveau'} prospect / client
          </div>
          <button onClick={onClose} className="text-sm text-gray-500">
            Fermer
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextField
            label="Nom"
            value={tmp.name}
            onChange={(t) => set('name', t)}
          />
          <TextField
            label="Instagram (@handle)"
            value={tmp.ig}
            onChange={(t) => set('ig', t)}
          />
          <TextField
            label="Ville"
            value={tmp.city}
            onChange={(t) => set('city', t)}
          />
          <SelectField
            label="Source"
            value={tmp.source}
            onChange={(t) => set('source', t)}
            options={DEFAULT_SOURCES}
          />
          <SelectField
            label="Statut"
            value={tmp.status}
            onChange={(t) => set('status', t)}
            options={DEFAULT_STATUSES}
          />
          <NumberField
            label="Valeur potentielle (FCFA)"
            value={tmp.value}
            onChange={(n) => set('value', n)}
          />
          <DateField
            label="Prochain suivi"
            value={tmp.nextFollowUp}
            onChange={(t) => set('nextFollowUp', t)}
          />
          <TextArea
            label="Notes"
            value={tmp.notes}
            onChange={(t) => set('notes', t)}
            rows={3}
          />
          <TagsEditor
            value={tmp.tags}
            onChange={(arr) => set('tags', arr)}
            all={DEFAULT_TAGS}
          />
          <InterestsEditor
            value={tmp.interests}
            onChange={(arr) => set('interests', arr)}
          />
        </div>

        <div className="p-4 flex items-center gap-3">
          <button
            onClick={() => onSave(tmp)}
            className="rounded-2xl bg-black text-white px-5 py-2 text-sm"
          >
            Enregistrer
          </button>
          <button onClick={onClose} className="text-sm text-gray-600">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
function TagsEditor({ value = [], onChange, all = [] }) {
  function toggle(t) {
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  }
  return (
    <div>
      <div className="text-sm text-gray-600 mb-1">Tags</div>
      <div className="flex flex-wrap gap-2">
        {all.map((t) => (
          <button
            key={t}
            onClick={() => toggle(t)}
            className={`px-3 py-1 rounded-full border text-sm ${
              value.includes(t) ? 'bg-black text-white' : 'bg-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
function InterestsEditor({ value = [], onChange }) {
  const [text, setText] = useState('');
  function add() {
    const v = text.trim();
    if (!v) return;
    onChange(value.includes(v) ? value : [...value, v]);
    setText('');
  }
  function remove(v) {
    onChange(value.filter((x) => x !== v));
  }
  return (
    <div>
      <div className="text-sm text-gray-600 mb-1">Intérêts (produits)</div>
      <div className="flex gap-2 mb-2">
        <input
          className="rounded-xl border px-3 py-2 flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex: OJAR Wood Whisper"
        />
        <button onClick={add} className="rounded-xl border px-3 py-2 text-sm">
          Ajouter
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-sm"
          >
            {v}
            <button onClick={() => remove(v)} className="text-amber-700">
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ===================== Orders ===================== */

function Orders({ orders, products, onSave, onConfirm }) {
  const [editing, setEditing] = useState(null);

  function newOrder() {
    setEditing({
      id: uid(),
      number: `CMD-${String(orders.length + 1).padStart(4, '0')}`,
      date: todayISO(),
      clientName: '',
      status: 'Brouillon',
      channel: 'Boutique',
      discount: 0,
      shipping: 0,
      lines: [],
      payments: [],
    });
  }

  function printInvoice(o) {
    const mapP = Object.fromEntries(products.map((p) => [p.id, p]));
    const rows = (o.lines || [])
      .map(
        (l) =>
          `<tr><td>${mapP[l.productId]?.sku || ''}</td><td>${
            l.name
          }</td><td class='right'>${l.qty}</td><td class='right'>${fmtMoney(
            l.priceTTC
          )}</td><td class='right'>${fmtMoney(
            (l.priceTTC || 0) * (l.qty || 0)
          )}</td></tr>`
      )
      .join('');
    const subtotal = sum(o.lines, (l) => (l.priceTTC || 0) * (l.qty || 0));
    const total = subtotal - (o.discount || 0) + (o.shipping || 0);
    const html = `
      <h1>Facture / BL ${o.number}</h1>
      <div class='muted'>Date: ${o.date} • Client: ${o.clientName || '—'}</div>
      <table><thead><tr><th>SKU</th><th>Produit</th><th class='right'>Qté</th><th class='right'>Prix u.</th><th class='right'>Total</th></tr></thead><tbody>${rows}</tbody></table>
      <div style='margin-top:10px'>Sous-total: ${fmtMoney(subtotal)}</div>
      <div>Remise: ${fmtMoney(o.discount || 0)}</div>
      <div>Livraison: ${fmtMoney(o.shipping || 0)}</div>
      <div style='margin-top:4px'><b>Total TTC: ${fmtMoney(total)}</b></div>
    `;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><meta charset='utf-8'><title>${o.number}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;padding:20px}h1{font-size:20px;margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ddd;padding:6px;font-size:12px}.right{text-align:right}.muted{color:#666}</style></head><body>${html}</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  }

  function exportCSV() {
    const headers = [
      'number',
      'date',
      'client',
      'status',
      'subtotal',
      'discount',
      'shipping',
      'total',
      'payments',
    ];
    const rows = orders.map((o) => {
      const subtotal = sum(o.lines, (l) => (l.priceTTC || 0) * (l.qty || 0));
      const total = subtotal - (o.discount || 0) + (o.shipping || 0);
      return {
        number: o.number,
        date: o.date,
        client: o.clientName || '—',
        status: o.status,
        subtotal: subtotal,
        discount: o.discount || 0,
        shipping: o.shipping || 0,
        total,
        payments: (o.payments || [])
          .map((p) => `${p.mode}:${p.amount}`)
          .join('|'),
      };
    });
    const csv = toCSV(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Commandes</div>
        <div className="flex items-center gap-2">
          <button
            onClick={newOrder}
            className="rounded-xl bg-black text-white px-4 py-2 text-sm"
          >
            ➕ Nouvelle
          </button>
          <button
            onClick={exportCSV}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            📑 Export CSV
          </button>
        </div>
      </div>

      <div className="rounded-2xl border overflow-x-auto bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-3">N°</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3">Statut</th>
              <th className="px-3 py-3">Lignes</th>
              <th className="px-3 py-3">Total</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const subtotal = sum(
                o.lines,
                (l) => (l.priceTTC || 0) * (l.qty || 0)
              );
              const total = subtotal - (o.discount || 0) + (o.shipping || 0);
              return (
                <tr key={o.id} className="border-t">
                  <td className="px-3 py-3 font-medium">{o.number}</td>
                  <td className="px-3 py-3">{o.date}</td>
                  <td className="px-3 py-3">{o.clientName || '—'}</td>
                  <td className="px-3 py-3">
                    <Badge
                      tone={
                        o.status === 'Livrée'
                          ? 'green'
                          : o.status === 'Confirmée'
                          ? 'blue'
                          : 'amber'
                      }
                    >
                      {o.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">{(o.lines || []).length}</td>
                  <td className="px-3 py-3">{fmtMoney(total)}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="px-3 py-1 rounded-lg border text-sm"
                        onClick={() => setEditing(o)}
                      >
                        Ouvrir
                      </button>
                      <button
                        className="px-3 py-1 rounded-lg border text-sm"
                        onClick={() => printInvoice(o)}
                      >
                        Imprimer
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <OrderModal
        value={editing}
        products={products}
        onSave={(o) => {
          onSave(o);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
        onConfirm={(o) => {
          onConfirm(o);
          setEditing(null);
        }}
      />
    </div>
  );
}

function OrderModal({ value, products, onSave, onConfirm, onClose }) {
  const [o, setO] = useState(value);
  useEffect(() => setO(value || null), [value]);
  if (!o) return null;

  const upd = (k, v) => setO((p) => ({ ...p, [k]: v }));
  const addLine = () =>
    setO((p) => ({
      ...p,
      lines: [
        ...(p.lines || []),
        {
          id: uid(),
          productId: products[0]?.id || null,
          name: products[0]?.name || 'Produit',
          qty: 1,
          priceTTC: products[0]?.priceRetailTTC || 0,
        },
      ],
    }));
  const updLine = (id, k, v) =>
    setO((p) => ({
      ...p,
      lines: (p.lines || []).map((l) => (l.id === id ? { ...l, [k]: v } : l)),
    }));
  const delLine = (id) =>
    setO((p) => ({ ...p, lines: (p.lines || []).filter((l) => l.id !== id) }));

  const subtotal = sum(o.lines, (l) => (l.priceTTC || 0) * (l.qty || 0));
  const total = subtotal - (o.discount || 0) + (o.shipping || 0);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-0 top-8 mx-auto w-[min(980px,94vw)] rounded-2xl bg-white shadow-xl border">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="text-lg font-semibold">Commande {o.number}</div>
          <button onClick={onClose} className="text-sm text-gray-500">
            Fermer
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <TextField
              label="Client"
              value={o.clientName}
              onChange={(t) => upd('clientName', t)}
            />
            <TextField
              label="Date"
              value={o.date}
              onChange={(t) => upd('date', t)}
            />
            <SelectField
              label="Statut"
              value={o.status}
              onChange={(t) => upd('status', t)}
              options={[
                'Brouillon',
                'Confirmée',
                'Préparée',
                'Livrée',
                'Annulée',
              ]}
            />
            <SelectField
              label="Canal"
              value={o.channel}
              onChange={(t) => upd('channel', t)}
              options={['Boutique', 'IG DM', 'WhatsApp', 'Grossiste']}
            />
          </div>

          <div className="rounded-2xl border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Lignes</div>
              <button
                onClick={addLine}
                className="rounded-lg border px-3 py-1 text-sm"
              >
                ➕ Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {(o.lines || []).map((l) => (
                <div
                  key={l.id}
                  className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end"
                >
                  <Select
                    label="Produit"
                    value={l.productId}
                    onChange={(v) => {
                      const p = products.find((x) => x.id === v);
                      updLine(l.id, 'productId', v);
                      updLine(l.id, 'name', p?.name || '');
                      updLine(l.id, 'priceTTC', p?.priceRetailTTC || 0);
                    }}
                    options={products.map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                  />
                  <NumberField
                    label="Qté"
                    value={l.qty}
                    onChange={(n) => updLine(l.id, 'qty', n)}
                  />
                  <NumberField
                    label="Prix u. TTC"
                    value={l.priceTTC}
                    onChange={(n) => updLine(l.id, 'priceTTC', n)}
                  />
                  <div className="text-sm text-gray-600">
                    <div className="mb-1">Sous-total</div>
                    <div className="font-medium">
                      {fmtMoney((l.priceTTC || 0) * (l.qty || 0))}
                    </div>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => delLine(l.id)}
                      className="text-sm text-gray-600 hover:text-rose-600"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
              {(o.lines || []).length === 0 && (
                <div className="text-sm text-gray-500">Aucune ligne</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <NumberField
              label="Remise (TTC)"
              value={o.discount}
              onChange={(n) => upd('discount', n)}
            />
            <NumberField
              label="Livraison (TTC)"
              value={o.shipping}
              onChange={(n) => upd('shipping', n)}
            />
            <div className="rounded-xl border p-3 flex items-center justify-between">
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-xl font-semibold">{fmtMoney(total)}</div>
            </div>
          </div>

          <div className="rounded-2xl border p-3">
            <div className="text-sm font-medium mb-2">Paiements</div>
            <PaymentsEditor
              value={o.payments || []}
              onChange={(arr) => upd('payments', arr)}
              total={total}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => onSave(o)}
              className="rounded-2xl bg-black text-white px-5 py-2 text-sm"
            >
              Enregistrer
            </button>
            {o.status !== 'Confirmée' && (
              <button
                onClick={() => onConfirm(o)}
                className="rounded-2xl bg-blue-600 text-white px-5 py-2 text-sm"
              >
                Confirmer & déduire stock
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentsEditor({ value = [], onChange, total }) {
  const [mode, setMode] = useState('Espèces');
  const [amount, setAmount] = useState(0);
  function add() {
    if (!amount) return;
    onChange([...(value || []), { mode, amount, date: todayISO() }]);
    setAmount(0);
  }
  const paid = sum(value, (p) => p.amount || 0);
  const remain = Math.max(0, (total || 0) - paid);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <select
          className="rounded-xl border px-3 py-2"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option>Espèces</option>
          <option>Mobile Money</option>
          <option>Virement</option>
          <option>CB</option>
        </select>
        <input
          type="number"
          className="rounded-xl border px-3 py-2"
          placeholder="Montant"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <button onClick={add} className="rounded-lg border px-3 py-2 text-sm">
          ➕ Ajouter
        </button>
      </div>
      <div className="text-sm text-gray-600">
        Payé: <b>{fmtMoney(paid)}</b> • Reste: <b>{fmtMoney(remain)}</b>
      </div>
      <div className="flex flex-wrap gap-2">
        {(value || []).map((p, i) => (
          <span key={i} className="text-xs rounded-full bg-slate-100 px-2 py-1">
            {p.mode}: {fmtMoney(p.amount)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ===================== Catalogue ===================== */

function Catalog({ products, onSave }) {
  const [editing, setEditing] = useState(null);

  function exportCSV() {
    const headers = [
      'sku',
      'name',
      'brand',
      'priceRetailTTC',
      'priceWholesaleTTC',
      'stock',
      'cmp',
      'min',
      'target',
      'leadTimeDays',
      'moq',
    ];
    const rows = products.map((p) => ({
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      priceRetailTTC: p.priceRetailTTC,
      priceWholesaleTTC: p.priceWholesaleTTC,
      stock: p.stock,
      cmp: p.cmp,
      min: p.min,
      target: p.target,
      leadTimeDays: p.leadTimeDays,
      moq: p.moq,
    }));
    const csv = toCSV(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Catalogue</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setEditing({
                id: uid(),
                sku: '',
                name: '',
                brand: '',
                priceRetailTTC: 0,
                priceWholesaleTTC: 0,
                taxRate: 0.18,
                stock: 0,
                cmp: 0,
                min: 0,
                target: 0,
                leadTimeDays: 14,
                moq: 0,
              })
            }
            className="rounded-xl bg-black text-white px-4 py-2 text-sm"
          >
            ➕ Produit
          </button>
          <button
            onClick={exportCSV}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            📑 Export CSV
          </button>
        </div>
      </div>

      <div className="rounded-2xl border overflow-x-auto bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-3">Produit</th>
              <th className="px-3 py-3">SKU</th>
              <th className="px-3 py-3">Retail TTC</th>
              <th className="px-3 py-3">Grossiste TTC</th>
              <th className="px-3 py-3">Stock</th>
              <th className="px-3 py-3">CMP</th>
              <th className="px-3 py-3">Min/Target</th>
              <th className="px-3 py-3">Lead (j)</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.brand}</div>
                </td>
                <td className="px-3 py-3">{p.sku}</td>
                <td className="px-3 py-3">{fmtMoney(p.priceRetailTTC)}</td>
                <td className="px-3 py-3">{fmtMoney(p.priceWholesaleTTC)}</td>
                <td className="px-3 py-3">{p.stock}</td>
                <td className="px-3 py-3">{fmtMoney(p.cmp)}</td>
                <td className="px-3 py-3">
                  {p.min} / {p.target}
                </td>
                <td className="px-3 py-3">{p.leadTimeDays}</td>
                <td className="px-3 py-3 text-right">
                  <button
                    className="px-3 py-1 rounded-lg border text-sm"
                    onClick={() => setEditing(p)}
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Produit">
        {editing && (
          <ProductForm
            value={editing}
            onSave={(v) => {
              onSave(v);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function ProductForm({ value, onSave, onCancel }) {
  const [v, setV] = useState(value);
  const U = (k, val) => setV((o) => ({ ...o, [k]: val }));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <TextField label="Nom" value={v.name} onChange={(t) => U('name', t)} />
      <TextField label="SKU" value={v.sku} onChange={(t) => U('sku', t)} />
      <TextField
        label="Marque"
        value={v.brand}
        onChange={(t) => U('brand', t)}
      />
      <NumberField
        label="Prix Retail TTC"
        value={v.priceRetailTTC}
        onChange={(n) => U('priceRetailTTC', n)}
      />
      <NumberField
        label="Prix Grossiste TTC"
        value={v.priceWholesaleTTC}
        onChange={(n) => U('priceWholesaleTTC', n)}
      />
      <NumberField
        label="TVA (0-1)"
        value={v.taxRate}
        step="0.01"
        onChange={(n) => U('taxRate', n)}
      />
      <NumberField
        label="Stock"
        value={v.stock}
        onChange={(n) => U('stock', n)}
      />
      <NumberField
        label="CMP (coût moyen)"
        value={v.cmp}
        onChange={(n) => U('cmp', n)}
      />
      <NumberField label="Min" value={v.min} onChange={(n) => U('min', n)} />
      <NumberField
        label="Stock cible"
        value={v.target}
        onChange={(n) => U('target', n)}
      />
      <NumberField
        label="Lead time (jours)"
        value={v.leadTimeDays}
        onChange={(n) => U('leadTimeDays', n)}
      />
      <NumberField label="MOQ" value={v.moq} onChange={(n) => U('moq', n)} />
      <div className="md:col-span-2 flex items-center gap-3 pt-2">
        <button
          onClick={() => onSave(v)}
          className="rounded-2xl bg-black text-white px-5 py-2 text-sm"
        >
          Enregistrer
        </button>
        <button onClick={onCancel} className="text-sm text-gray-600">
          Annuler
        </button>
      </div>
    </div>
  );
}

/* ===================== Suppliers & POs ===================== */

function Suppliers({ suppliers, onSave }) {
  const [editing, setEditing] = useState(null);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Fournisseurs</div>
        <button
          onClick={() =>
            setEditing({
              id: uid(),
              name: '',
              contact: '',
              leadDays: 14,
              moq: 0,
              currency: 'EUR',
            })
          }
          className="rounded-xl bg-black text-white px-4 py-2 text-sm"
        >
          ➕ Fournisseur
        </button>
      </div>
      <div className="rounded-2xl border overflow-x-auto bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-3">Nom</th>
              <th className="px-3 py-3">Contact</th>
              <th className="px-3 py-3">Lead (j)</th>
              <th className="px-3 py-3">MOQ</th>
              <th className="px-3 py-3">Devise</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-3 font-medium">{s.name}</td>
                <td className="px-3 py-3">{s.contact}</td>
                <td className="px-3 py-3">{s.leadDays}</td>
                <td className="px-3 py-3">{s.moq}</td>
                <td className="px-3 py-3">{s.currency}</td>
                <td className="px-3 py-3 text-right">
                  <button
                    className="px-3 py-1 rounded-lg border text-sm"
                    onClick={() => setEditing(s)}
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Fournisseur"
      >
        {editing && (
          <SupplierForm
            value={editing}
            onSave={(v) => {
              onSave(v);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
function SupplierForm({ value, onSave, onCancel }) {
  const [v, setV] = useState(value);
  const U = (k, val) => setV((o) => ({ ...o, [k]: val }));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <TextField label="Nom" value={v.name} onChange={(t) => U('name', t)} />
      <TextField
        label="Contact"
        value={v.contact}
        onChange={(t) => U('contact', t)}
      />
      <NumberField
        label="Lead time (jours)"
        value={v.leadDays}
        onChange={(n) => U('leadDays', n)}
      />
      <NumberField label="MOQ" value={v.moq} onChange={(n) => U('moq', n)} />
      <TextField
        label="Devise"
        value={v.currency}
        onChange={(t) => U('currency', t)}
      />
      <div className="md:col-span-2 flex items-center gap-3 pt-2">
        <button
          onClick={() => onSave(v)}
          className="rounded-2xl bg-black text-white px-5 py-2 text-sm"
        >
          Enregistrer
        </button>
        <button onClick={onCancel} className="text-sm text-gray-600">
          Annuler
        </button>
      </div>
    </div>
  );
}

function POs({ pos, products, suppliers, onSavePO, onReceivePO }) {
  const [editing, setEditing] = useState(null);

  function newPO() {
    setEditing({
      id: uid(),
      number: `PO-${String(pos.length + 1).padStart(4, '0')}`,
      date: todayISO(),
      supplierId: suppliers[0]?.id || null,
      status: 'Brouillon',
      feeMode: 'per_unit',
      fees_shipping: 0,
      fees_customs: 0,
      fees_pack: 0,
      lines: [],
    });
  }

  return (
    /* ⚠️ un SEUL parent pour tout le JSX */
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Bons de commande (PO)</div>
        <button
          onClick={newPO}
          className="rounded-xl bg-black text-white px-4 py-2 text-sm"
        >
          ➕ Nouveau PO
        </button>
      </div>

      {/* Tableau */}
      <div className="rounded-2xl border overflow-x-auto bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-3">N°</th>
              <th className="px-3 py-3">Fournisseur</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Lignes</th>
              <th className="px-3 py-3">Frais</th>
              <th className="px-3 py-3">Statut</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((po) => {
              const sup = suppliers.find((s) => s.id === po.supplierId);
              const fees =
                Number(po.fees_shipping || 0) +
                Number(po.fees_customs || 0) +
                Number(po.fees_pack || 0);
              return (
                <tr key={po.id} className="border-t">
                  <td className="px-3 py-3 font-medium">{po.number}</td>
                  <td className="px-3 py-3">{sup?.name || '—'}</td>
                  <td className="px-3 py-3">{po.date}</td>
                  <td className="px-3 py-3">{(po.lines || []).length}</td>
                  <td className="px-3 py-3">{fmtMoney(fees)}</td>
                  <td className="px-3 py-3">
                    <Badge
                      tone={
                        po.status === 'Reçu'
                          ? 'green'
                          : po.status === 'Commandé'
                          ? 'blue'
                          : 'amber'
                      }
                    >
                      {po.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        className="px-3 py-1 rounded-lg border text-sm"
                        onClick={() => setEditing(po)}
                      >
                        Ouvrir
                      </button>
                      <button
                        className="px-3 py-1 rounded-lg border text-sm"
                        onClick={() => printPO(po, suppliers, products)}
                      >
                        Imprimer
                      </button>
                      {po.status !== 'Reçu' && (
                        <button
                          className="px-3 py-1 rounded-lg border text-sm bg-green-600 text-white"
                          onClick={() => onReceivePO(po)}
                        >
                          Recevoir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal d’édition */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`PO ${editing?.number || ''}`}
      >
        {editing && (
          <POForm
            value={editing}
            suppliers={suppliers}
            products={products}
            onSave={(po) => {
              onSavePO(po);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function POForm({ value, suppliers, products, onSave }) {
  const [po, setPO] = useState(value);
  const supplierOpts = suppliers.map((s) => ({ value: s.id, label: s.name }));
  const productOpts = products.map((p) => ({ value: p.id, label: p.name }));
  const upd = (k, v) => setPO((o) => ({ ...o, [k]: v }));
  const addLine = () =>
    setPO((o) => ({
      ...o,
      lines: [
        ...(o.lines || []),
        {
          id: uid(),
          productId: productOpts[0]?.value || null,
          qty: 1,
          unitCost: 30000,
        },
      ],
    }));
  const updLine = (id, k, v) =>
    setPO((o) => ({
      ...o,
      lines: (o.lines || []).map((l) => (l.id === id ? { ...l, [k]: v } : l)),
    }));
  const delLine = (id) =>
    setPO((o) => ({ ...o, lines: (o.lines || []).filter((l) => l.id !== id) }));
  const fees =
    Number(po.fees_shipping || 0) +
    Number(po.fees_customs || 0) +
    Number(po.fees_pack || 0);
  const totalItems = sum(po.lines, (l) => (l.unitCost || 0) * (l.qty || 0));
  const grand = totalItems + fees;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Select
          label="Fournisseur"
          value={po.supplierId}
          onChange={(v) => upd('supplierId', v)}
          options={supplierOpts}
        />
        <TextField
          label="N° PO"
          value={po.number}
          onChange={(t) => upd('number', t)}
        />
        <TextField
          label="Date"
          value={po.date}
          onChange={(t) => upd('date', t)}
        />
      </div>
      <div className="rounded-2xl border p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Lignes</div>
          <button
            onClick={addLine}
            className="rounded-lg border px-3 py-1 text-sm"
          >
            ➕ Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {(po.lines || []).map((l) => (
            <div
              key={l.id}
              className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end"
            >
              <Select
                label="Produit"
                value={l.productId}
                onChange={(v) => updLine(l.id, 'productId', v)}
                options={productOpts}
              />
              <NumberField
                label="Qté"
                value={l.qty}
                onChange={(n) => updLine(l.id, 'qty', n)}
              />
              <NumberField
                label="Coût unitaire (entrée)"
                value={l.unitCost}
                onChange={(n) => updLine(l.id, 'unitCost', n)}
              />
              <div className="text-sm text-gray-600">
                <div className="mb-1">Sous-total</div>
                <div className="font-medium">
                  {fmtMoney((l.unitCost || 0) * (l.qty || 0))}
                </div>
              </div>
              <div className="text-right">
                <button
                  onClick={() => delLine(l.id)}
                  className="text-sm text-gray-600 hover:text-rose-600"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
          {(po.lines || []).length === 0 && (
            <div className="text-sm text-gray-500">Aucune ligne</div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <NumberField
          label="Frais transport"
          value={po.fees_shipping}
          onChange={(n) => upd('fees_shipping', n)}
        />
        <NumberField
          label="Frais douane"
          value={po.fees_customs}
          onChange={(n) => upd('fees_customs', n)}
        />
        <NumberField
          label="Frais packaging"
          value={po.fees_pack}
          onChange={(n) => upd('fees_pack', n)}
        />
        <Select
          label="Répartition frais"
          value={po.feeMode}
          onChange={(v) => upd('feeMode', v)}
          options={[
            { value: 'per_unit', label: 'Par unité' },
            { value: 'by_value', label: 'Par valeur' },
          ]}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Total articles: <b>{fmtMoney(totalItems)}</b> — Frais:{' '}
          <b>{fmtMoney(fees)}</b>
        </div>
        <div className="text-lg font-semibold">Total PO: {fmtMoney(grand)}</div>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => onSave({ ...po, status: po.status || 'Commandé' })}
          className="rounded-2xl bg-black text-white px-5 py-2 text-sm"
        >
          Enregistrer
        </button>
        <button
          onClick={() => printPO(po, suppliers, products)}
          className="text-sm rounded-xl border px-3 py-2"
        >
          Imprimer
        </button>
      </div>
    </div>
  );
}
function printPO(po, suppliers, products) {
  const sup = suppliers?.find?.((s) => s.id === po.supplierId);
  const mapP = Object.fromEntries((products || []).map((p) => [p.id, p]));
  const rows = (po.lines || [])
    .map(
      (l) =>
        `<tr><td>${mapP[l.productId]?.sku || ''}</td><td>${
          mapP[l.productId]?.name || ''
        }</td><td class='right'>${l.qty}</td><td class='right'>${fmtMoney(
          l.unitCost
        )}</td><td class='right'>${fmtMoney(
          (l.unitCost || 0) * (l.qty || 0)
        )}</td></tr>`
    )
    .join('');
  const fees =
    Number(po.fees_shipping || 0) +
    Number(po.fees_customs || 0) +
    Number(po.fees_pack || 0);
  const total = sum(po.lines, (l) => (l.unitCost || 0) * (l.qty || 0)) + fees;
  const html = `<h1>Bon de commande ${po.number}</h1><div class='muted'>Date: ${
    po.date
  } • Fournisseur: ${
    sup?.name || ''
  }</div><table><thead><tr><th>SKU</th><th>Produit</th><th class='right'>Qté</th><th class='right'>Coût u.</th><th class='right'>Sous-total</th></tr></thead><tbody>${rows}</tbody></table><div style='margin-top:10px'>Frais: ${fmtMoney(
    fees
  )}</div><div style='margin-top:4px'><b>Total: ${fmtMoney(total)}</b></div>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><meta charset='utf-8'><title>${po.number}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu;padding:20px}h1{font-size:20px;margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ddd;padding:6px;font-size:12px}.right{text-align:right}.muted{color:#666}</style></head><body>${html}</body></html>`
  );
  w.document.close();
  w.focus();
  w.print();
}

/* ===================== Returns ===================== */

function Returns({ products, returns, onSave }) {
  const [form, setForm] = useState({
    id: uid(),
    date: todayISO(),
    productId: products[0]?.id || null,
    qty: 1,
    reason: 'Défectueux',
    restock: true,
  });
  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold">Retours & Avoirs</div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-2xl border bg-white p-4">
        <Select
          label="Produit"
          value={form.productId}
          onChange={(v) => setForm((f) => ({ ...f, productId: v }))}
          options={products.map((p) => ({ value: p.id, label: p.name }))}
        />
        <NumberField
          label="Quantité"
          value={form.qty}
          onChange={(n) => setForm((f) => ({ ...f, qty: n }))}
        />
        <TextField
          label="Motif"
          value={form.reason}
          onChange={(t) => setForm((f) => ({ ...f, reason: t }))}
        />
        <Select
          label="Stock"
          value={form.restock ? 'oui' : 'non'}
          onChange={(v) => setForm((f) => ({ ...f, restock: v === 'oui' }))}
          options={[
            { value: 'oui', label: 'Réintégrer' },
            { value: 'non', label: 'Casse' },
          ]}
        />
        <div className="flex items-end">
          <button
            onClick={() => {
              onSave(form);
              setForm({ ...form, id: uid(), date: todayISO(), qty: 1 });
            }}
            className="rounded-xl bg-black text-white px-4 py-2 text-sm"
          >
            Enregistrer
          </button>
        </div>
      </div>

      <div className="rounded-2xl border overflow-x-auto bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Produit</th>
              <th className="px-3 py-3">Qté</th>
              <th className="px-3 py-3">Motif</th>
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r) => {
              const p = products.find((x) => x.id === r.productId);
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-3">{r.date}</td>
                  <td className="px-3 py-3">{p?.name || '—'}</td>
                  <td className="px-3 py-3">{r.qty}</td>
                  <td className="px-3 py-3">{r.reason}</td>
                  <td className="px-3 py-3">
                    {r.restock ? (
                      <Badge tone="green">Réintégré</Badge>
                    ) : (
                      <Badge tone="rose">Casse</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {returns.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  Aucun retour
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== Réassort ===================== */

function Replenish({ suggestions }) {
  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold">Réassort — Suggestions</div>
      <div className="rounded-2xl border overflow-x-auto bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-3">Produit</th>
              <th className="px-3 py-3">Vendus (fenêtre)</th>
              <th className="px-3 py-3">d (u./jour)</th>
              <th className="px-3 py-3">Lead (j)</th>
              <th className="px-3 py-3">ROP</th>
              <th className="px-3 py-3">Stock</th>
              <th className="px-3 py-3">Min/Target</th>
              <th className="px-3 py-3">Qté suggérée</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.product.id} className="border-t">
                <td className="px-3 py-3">{s.product.name}</td>
                <td className="px-3 py-3">{s.soldWindow}</td>
                <td className="px-3 py-3">{s.d.toFixed(2)}</td>
                <td className="px-3 py-3">{s.product.leadTimeDays}</td>
                <td className="px-3 py-3">{Math.ceil(s.ROP)}</td>
                <td className="px-3 py-3">{s.product.stock}</td>
                <td className="px-3 py-3">
                  {s.product.min}/{s.product.target}
                </td>
                <td className="px-3 py-3 font-medium">{s.suggested}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-500 px-1">
        Méthode simple (MVP) — EOQ & saisonnalité pourront être ajoutés ensuite.
      </div>
    </div>
  );
}

/* ===================== Mouvements ===================== */

function Movements({ moves, products }) {
  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold">Mouvements de stock</div>
      <div className="rounded-2xl border overflow-x-auto bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Produit</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Qté</th>
              <th className="px-3 py-3">Coût u.</th>
              <th className="px-3 py-3">Ref</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((m) => {
              const p = products.find((x) => x.id === m.productId);
              return (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-3">{m.date}</td>
                  <td className="px-3 py-3">{p?.name || '—'}</td>
                  <td className="px-3 py-3">{m.type}</td>
                  <td className="px-3 py-3">{m.qty}</td>
                  <td className="px-3 py-3">{fmtMoney(m.unitCost)}</td>
                  <td className="px-3 py-3">{m.ref}</td>
                </tr>
              );
            })}
            {moves.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  Aucun mouvement
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
