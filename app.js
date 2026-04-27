// ============================================================
//  app.js — La Panadería | Gestión de Productos
//  • Login con Supabase Auth (email + contraseña)
//  • Productos guardados en Supabase (acceso desde cualquier dispositivo)
//  • Sin Node.js — abre index.html directo en el navegador
// ============================================================

const { useState, useEffect, useCallback } = React;

// ── Supabase ─────────────────────────────────────────────────
const SUPABASE_URL  = "https://haflelflzxsedhjvgtwz.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZmxlbGZsenhzZWRoanZndHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNzcwNjEsImV4cCI6MjA5MjY1MzA2MX0.omCrb2D2iCleq7fFfPurS-89m_P6IGo1jhrG8Hg3uFM";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Categorías ───────────────────────────────────────────────
const CATEGORIES = [
  { id: "tortas",            label: "Tortas",            icon: "🎂", color: "#C8855A" },
  { id: "pies",              label: "Pies",              icon: "🥧", color: "#B5703F" },
  { id: "cheesecakes",       label: "Cheesecakes",       icon: "🍮", color: "#D4956A" },
  { id: "bocaditos_dulces",  label: "Bocaditos Dulces",  icon: "🍬", color: "#C97B8A" },
  { id: "bocaditos_salados", label: "Bocaditos Salados", icon: "🧀", color: "#8A9E6A" },
  { id: "panes",             label: "Panes",             icon: "🍞", color: "#C4924A" },
  { id: "Festivos",          label: "Festivos",          icon: "★", color: "#5AC867" }
];

const EMPTY_FORM = { name: "", price: "", qty: "1", category: "tortas" };
const fmt = val => "S/." + Number(val).toFixed(2);

// ════════════════════════════════════════════════════════════
//  PANTALLA DE LOGIN
// ════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [mode,     setMode]     = useState("login"); // "login" | "register"
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) { setError("Completa todos los campos."); return; }
    setLoading(true); setError("");
    try {
      let result;
      if (mode === "register") {
        result = await sb.auth.signUp({ email: email.trim(), password });
        if (result.error) throw result.error;
        setError("✓ Cuenta creada. Revisa tu email para confirmarla, luego inicia sesión.");
        setMode("login"); setLoading(false); return;
      } else {
        result = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        onLogin(result.data.session);
      }
    } catch(e) {
      setError(e.message || "Error al iniciar sesión.");
    }
    setLoading(false);
  }

  function handleKey(e) { if (e.key === "Enter") handleSubmit(); }

  return (
    <div className="login-bg">
      <div className="bg-pattern" />
      <div className="login-card">
        <div className="login-logo">🥐</div>
        <div className="login-title">La Panadería</div>
        <div className="login-sub">{mode === "login" ? "Inicia sesión para continuar" : "Crea tu cuenta"}</div>

        {error && (
          <div className={"login-msg " + (error.startsWith("✓") ? "login-msg-ok" : "login-msg-err")}>
            {error}
          </div>
        )}

        <label className="field-label">Correo electrónico</label>
        <input className="form-input" type="email" value={email}
               onChange={e => setEmail(e.target.value)} onKeyDown={handleKey}
               placeholder="tu@correo.com" autoFocus />

        <label className="field-label">Contraseña</label>
        <input className="form-input" type="password" value={password}
               onChange={e => setPassword(e.target.value)} onKeyDown={handleKey}
               placeholder="••••••••" />

        <button className="save-btn login-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? "Cargando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>

        <div className="login-switch">
          {mode === "login" ? (
            <span>¿No tienes cuenta? <button className="link-btn" onClick={() => { setMode("register"); setError(""); }}>Regístrate</button></span>
          ) : (
            <span>¿Ya tienes cuenta? <button className="link-btn" onClick={() => { setMode("login"); setError(""); }}>Inicia sesión</button></span>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  APP PRINCIPAL
// ════════════════════════════════════════════════════════════
function BakeryManager({ session, onLogout }) {
  const [products,  setProducts]  = useState([]);
  const [cart,      setCart]      = useState({});
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [editId,    setEditId]    = useState(null);
  const [deleteId,  setDeleteId]  = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [toast,     setToast]     = useState("");
  const [saving,    setSaving]    = useState(false);

  // ── Cargar productos desde Supabase ──────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: true });
    if (!error) setProducts(data || []);
    else showToast("Error al cargar productos: " + error.message);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  // ── Carrito ──────────────────────────────────────────────
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find(x => x.id === Number(id));
    return p ? sum + p.price * qty : sum;
  }, 0);
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  function toggleCart(pid) {
    setCart(prev => {
      if (prev[pid]) { const n = {...prev}; delete n[pid]; return n; }
      return {...prev, [pid]: 1};
    });
  }
  function adjustQty(pid, delta) {
    setCart(prev => {
      const next = (prev[pid] || 0) + delta;
      if (next <= 0) { const n = {...prev}; delete n[pid]; return n; }
      return {...prev, [pid]: next};
    });
  }
  function clearCart() { setCart({}); }

  // ── Formulario ───────────────────────────────────────────
  function openAdd()  { setForm(EMPTY_FORM); setEditId(null); setShowForm(true); }
  function openEdit(p) {
    setForm({ name: p.name, price: String(p.price), qty: String(p.qty), category: p.category });
    setEditId(p.id); setShowForm(true);
  }

  async function saveForm() {
    if (!form.name.trim() || !form.price || !form.qty) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      price: parseFloat(form.price),
      qty: parseInt(form.qty),
      category: form.category,
    };
    if (editId !== null) {
      const { error } = await sb.from("products").update(payload).eq("id", editId);
      if (error) { showToast("Error al guardar: " + error.message); setSaving(false); return; }
      showToast("✓ Producto actualizado");
    } else {
      const { error } = await sb.from("products").insert(payload);
      if (error) { showToast("Error al guardar: " + error.message); setSaving(false); return; }
      showToast("✓ Producto agregado");
    }
    await fetchProducts();
    setSaving(false); setShowForm(false); setForm(EMPTY_FORM); setEditId(null);
  }

  async function doDelete() {
    const { error } = await sb.from("products").delete().eq("id", deleteId);
    if (error) { showToast("Error al eliminar: " + error.message); return; }
    setCart(prev => { const n = {...prev}; delete n[deleteId]; return n; });
    await fetchProducts();
    setDeleteId(null);
    showToast("🗑️ Producto eliminado");
  }

  async function handleLogout() {
    await sb.auth.signOut();
    onLogout();
  }

  const visibleCats = activeTab === "all" ? CATEGORIES : CATEGORIES.filter(c => c.id === activeTab);
  const cartLines   = Object.entries(cart)
    .map(([id, qty]) => { const p = products.find(x => x.id === Number(id)); return p ? {...p, cartQty: qty} : null; })
    .filter(Boolean);

  // ── Render ───────────────────────────────────────────────
  return (
    <div>
      <div className="bg-pattern" />
      {toast && <div className="toast">{toast}</div>}

      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <span className="logo-icon">🥐</span>
          <div>
            <div className="logo-title">La Panadería</div>
            <div className="logo-sub">Gestión de Productos</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span className="user-badge">👤 {session.user.email}</span>
          <button className="add-btn" onClick={openAdd}>＋ Nuevo Producto</button>
          <button className="logout-btn" onClick={handleLogout} title="Cerrar sesión">⏻</button>
        </div>
      </header>

      {/* LAYOUT */}
      <div className="layout">
        <div className="main-col">

          {/* TABS */}
          <div className="tab-bar">
            <button className={"tab" + (activeTab === "all" ? " active" : "")} onClick={() => setActiveTab("all")}>Todos</button>
            {CATEGORIES.map(c => (
              <button key={c.id}
                className={"tab" + (activeTab === c.id ? " active" : "")}
                style={activeTab === c.id ? { borderColor: c.color, color: c.color } : {}}
                onClick={() => setActiveTab(c.id)}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>

          {/* LOADING */}
          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              Cargando productos...
            </div>
          )}

          {/* CATEGORÍAS */}
          {!loading && visibleCats.map(cat => {
            const items = products.filter(p => p.category === cat.id);
            if (items.length === 0) return null;
            return (
              <div key={cat.id} className="category-block">
                <div className="category-header" style={{ borderColor: cat.color }}>
                  <span className="cat-icon" style={{ background: cat.color }}>{cat.icon}</span>
                  <span className="cat-label" style={{ color: cat.color }}>{cat.label}</span>
                  <span className="cat-count">{items.length} productos</span>
                </div>
                <div className="product-list">
                  {items.map(p => {
                    const inCart = !!cart[p.id];
                    const cqty   = cart[p.id] || 0;
                    return (
                      <div key={p.id}
                           className={"card" + (inCart ? " in-cart" : "")}
                           style={inCart ? { borderLeftColor: cat.color, borderLeftWidth: 4 } : {}}>
                        <div className="card-row">
                          <span className={"check-box" + (inCart ? " checked" : "")}
                                style={{ background: inCart ? cat.color : "transparent", borderColor: inCart ? cat.color : "#d4b896" }}
                                onClick={() => toggleCart(p.id)}>
                            {inCart && <span className="check-mark">✓</span>}
                          </span>
                          <span className="card-name" onClick={() => toggleCart(p.id)}>{p.name}</span>
                          <span className="card-qty-label">×{p.qty}</span>
                          <span className="card-price" style={{ background: cat.color + "22", color: cat.color }}>
                            {fmt(p.price)}
                          </span>
                          <div className="card-actions">
                            <button className="action-btn" onClick={() => openEdit(p)} title="Editar">✏️</button>
                            <button className="action-btn" onClick={() => setDeleteId(p.id)} title="Eliminar">🗑️</button>
                          </div>
                        </div>
                        {inCart && (
                          <div className="qty-row">
                            <button className="qty-btn" style={{ borderColor: cat.color, color: cat.color }} onClick={() => adjustQty(p.id, -1)}>−</button>
                            <span className="qty-num" style={{ color: cat.color }}>{cqty}</span>
                            <button className="qty-btn" style={{ borderColor: cat.color, color: cat.color }} onClick={() => adjustQty(p.id, 1)}>＋</button>
                            <span className="line-total">{fmt(p.price * cqty)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {!loading && products.length === 0 && (
            <div className="empty-state">
              <div style={{ fontSize: 48, marginBottom: 8 }}>🍞</div>
              <div style={{ marginBottom: 12 }}>No hay productos todavía.</div>
              <button className="add-btn" onClick={openAdd}>＋ Agregar primer producto</button>
            </div>
          )}
        </div>

        {/* COLUMNA LATERAL */}
        <div className="side-col">
          <div className="cart-box">
            <div className="cart-header">
              <span className="cart-title">🧾 Resumen</span>
              {cartCount > 0 && <button className="clear-btn" onClick={clearCart}>Limpiar</button>}
            </div>
            {cartLines.length === 0 ? (
              <div className="empty-cart">
                <div className="empty-cart-icon">🛒</div>
                <div>Selecciona productos<br />para sumar precios</div>
              </div>
            ) : (
              <>
                <div className="cart-lines">
                  {cartLines.map(line => {
                    const cat = CATEGORIES.find(c => c.id === line.category);
                    return (
                      <div key={line.id} className="cart-line">
                        <div className="cart-line-name">
                          {cat?.icon} {line.name}
                          {line.cartQty > 1 && <span className="multi-qty"> ×{line.cartQty}</span>}
                        </div>
                        <div className="cart-line-price" style={{ color: cat?.color }}>
                          {fmt(line.price * line.cartQty)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="divider" />
                <div className="total-row">
                  <span className="total-label">Total</span>
                  <span className="total-amount">{fmt(cartTotal)}</span>
                </div>
                <div className="item-count-row">
                  {cartCount} producto{cartCount !== 1 ? "s" : ""} seleccionado{cartCount !== 1 ? "s" : ""}
                </div>
              </>
            )}
          </div>

          <div className="stats-box">
            <div className="stats-title">📦 Inventario</div>
            {CATEGORIES.map(cat => {
              const count = products.filter(p => p.category === cat.id).length;
              return (
                <div key={cat.id} className="stat-row">
                  <span>{cat.icon} {cat.label}</span>
                  <span className="stat-badge" style={{ background: cat.color + "22", color: cat.color }}>{count}</span>
                </div>
              );
            })}
            <div className="divider" />
            <div className="stat-row bold"><span>Total productos</span><span>{products.length}</span></div>
          </div>
        </div>
      </div>

      {/* MODAL: Agregar / Editar */}
      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editId ? "✏️ Editar Producto" : "➕ Nuevo Producto"}</div>
            <label className="field-label">Nombre del producto</label>
            <input className="form-input" value={form.name}
                   onChange={e => setForm({...form, name: e.target.value})}
                   onKeyDown={e => e.key === "Enter" && saveForm()}
                   placeholder="Ej: Torta de Chocolate" autoFocus />
            <div className="field-row">
              <div>
                <label className="field-label">Precio ($)</label>
                <input className="form-input" type="number" min="0" step="0.50"
                       value={form.price}
                       onChange={e => setForm({...form, price: e.target.value})}
                       onKeyDown={e => e.key === "Enter" && saveForm()}
                       placeholder="0.00" />
              </div>
              <div>
                <label className="field-label">Cantidad por unidad</label>
                <input className="form-input" type="number" min="1"
                       value={form.qty}
                       onChange={e => setForm({...form, qty: e.target.value})}
                       onKeyDown={e => e.key === "Enter" && saveForm()}
                       placeholder="1" />
              </div>
            </div>
            <label className="field-label">Categoría</label>
            <select className="form-input" value={form.category}
                    onChange={e => setForm({...form, category: e.target.value})}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="save-btn" onClick={saveForm} disabled={saving}>
                {saving ? "Guardando..." : editId ? "Guardar cambios" : "Agregar producto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar eliminación */}
      {deleteId !== null && (
        <div className="overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">🗑️ Eliminar producto</div>
            <p>¿Eliminar <strong>{products.find(p => p.id === deleteId)?.name}</strong>? Esta acción no se puede deshacer.</p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="delete-confirm-btn" onClick={doDelete}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  RAÍZ — maneja sesión
// ════════════════════════════════════════════════════════════
function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Verificar si ya hay sesión activa
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    // Escuchar cambios de sesión
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="login-bg">
        <div className="bg-pattern" />
        <div style={{ textAlign:"center", color:"#9a7050", fontSize:16 }}>
          <div className="spinner" style={{ margin:"0 auto 12px" }} />
          Cargando...
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  return <BakeryManager session={session} onLogout={() => setSession(null)} />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
