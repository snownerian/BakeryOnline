// ============================================================
//  app.js — La Panadería | Gestión de Productos
//  • Login con Supabase Auth
//  • Fotos opcionales por producto
//  • Buscador con filtro en vista principal + navegación teclado
// ============================================================

const { useState, useEffect, useCallback, useRef } = React;

const SUPABASE_URL  = "https://haflelflzxsedhjvgtwz.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZmxlbGZsenhzZWRoanZndHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNzcwNjEsImV4cCI6MjA5MjY1MzA2MX0.omCrb2D2iCleq7fFfPurS-89m_P6IGo1jhrG8Hg3uFM";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const BUCKET = "product-images";

const CATEGORIES = [
  { id: "tortas",            label: "Tortas",            icon: "🎂", color: "#C8855A" },
  { id: "pies",              label: "Pies",              icon: "🥧", color: "#B5703F" },
  { id: "cheesecakes",       label: "Cheesecakes",       icon: "🍮", color: "#D4956A" },
  { id: "bocaditos_dulces",  label: "Bocaditos Dulces",  icon: "🍬", color: "#C97B8A" },
  { id: "bocaditos_salados", label: "Bocaditos Salados", icon: "🧀", color: "#8A9E6A" },
  { id: "panes",             label: "Panes",             icon: "🍞", color: "#C4924A" },
  { id: "Festivos",          label: "Festivos",          icon: "★",  color: "#5AC867" }
  { id: "Kekes",             label: "Kekes",             icon: "★",  color: "#eb7a10" },
];

const EMPTY_FORM = { name: "", price: "", qty: "1", category: "tortas", image_url: "" };
const fmt = val => "S/." + Number(val).toFixed(2);

// Normaliza texto para búsqueda (quita tildes, minúsculas)
function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ════════════════════════════════════════════════════════════
//  LOGIN
// ════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [mode,     setMode]     = useState("login");
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
    } catch(e) { setError(e.message || "Error al iniciar sesión."); }
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
        {error && <div className={"login-msg " + (error.startsWith("✓") ? "login-msg-ok" : "login-msg-err")}>{error}</div>}
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
          {mode === "login"
            ? <span>¿No tienes cuenta? <button className="link-btn" onClick={() => { setMode("register"); setError(""); }}>Regístrate</button></span>
            : <span>¿Ya tienes cuenta? <button className="link-btn" onClick={() => { setMode("login"); setError(""); }}>Inicia sesión</button></span>
          }
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  APP PRINCIPAL
// ════════════════════════════════════════════════════════════
function BakeryManager({ session, onLogout }) {
  const [products,     setProducts]     = useState([]);
  const [cart,         setCart]         = useState({});
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [editId,       setEditId]       = useState(null);
  const [deleteId,     setDeleteId]     = useState(null);
  const [activeTab,    setActiveTab]    = useState("all");
  const [toast,        setToast]        = useState("");
  const [saving,       setSaving]       = useState(false);
  const [imageFile,    setImageFile]    = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [lightbox,     setLightbox]     = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);

  // ── Estados del buscador ─────────────────────────────────
  const [query,        setQuery]        = useState("");
  const [focusedIdx,   setFocusedIdx]   = useState(-1); // índice global de la lista filtrada
  const searchRef = useRef(null);

  // ── Cargar productos ─────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: true });
    if (!error) setProducts(data || []);
    else showToast("Error al cargar: " + error.message);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 2500); }

  // ── Lógica de búsqueda ───────────────────────────────────
  const isSearching = query.trim().length > 0;

  // Lista plana de productos filtrados (para navegación con teclado)
  const filteredProducts = isSearching
    ? products.filter(p => normalize(p.name).includes(normalize(query.trim())))
    : products;

  // Reset índice cuando cambia la búsqueda
  useEffect(() => { setFocusedIdx(-1); }, [query]);

  function handleSearchKey(e) {
    if (!isSearching) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx(i => Math.min(i + 1, filteredProducts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = focusedIdx >= 0 ? filteredProducts[focusedIdx] : filteredProducts[0];
      if (target) toggleCart(target.id);
    } else if (e.key === "Escape") {
      setQuery("");
      searchRef.current?.blur();
    }
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
  function openAdd() {
    setForm(EMPTY_FORM); setEditId(null);
    setImageFile(null); setImagePreview(""); setShowForm(true);
  }
  function openEdit(p) {
    setForm({ name: p.name, price: String(p.price), qty: String(p.qty), category: p.category, image_url: p.image_url || "" });
    setEditId(p.id); setImageFile(null); setImagePreview(p.image_url || ""); setShowForm(true);
  }
  function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file); setImagePreview(URL.createObjectURL(file));
  }
  function removeImage() {
    setImageFile(null); setImagePreview(""); setForm(prev => ({ ...prev, image_url: "" }));
  }
  async function uploadImage(productId) {
    if (!imageFile) return form.image_url || null;
    setUploadingImg(true);
    const ext  = imageFile.name.split(".").pop();
    const path = `${productId}_${Date.now()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, imageFile, { upsert: true });
    setUploadingImg(false);
    if (error) { showToast("Error al subir foto: " + error.message); return null; }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveForm() {
    if (!form.name.trim() || !form.price || !form.qty) return;
    setSaving(true);
    if (editId === null) {
      const { data, error } = await sb.from("products").insert({
        name: form.name.trim(), price: parseFloat(form.price),
        qty: parseInt(form.qty), category: form.category,
      }).select().single();
      if (error) { showToast("Error: " + error.message); setSaving(false); return; }
      const imageUrl = await uploadImage(data.id);
      if (imageUrl) await sb.from("products").update({ image_url: imageUrl }).eq("id", data.id);
      showToast("✓ Producto agregado");
    } else {
      const imageUrl = await uploadImage(editId);
      const { error } = await sb.from("products").update({
        name: form.name.trim(), price: parseFloat(form.price),
        qty: parseInt(form.qty), category: form.category, image_url: imageUrl,
      }).eq("id", editId);
      if (error) { showToast("Error: " + error.message); setSaving(false); return; }
      showToast("✓ Producto actualizado");
    }
    await fetchProducts();
    setSaving(false); setShowForm(false); setForm(EMPTY_FORM);
    setEditId(null); setImageFile(null); setImagePreview("");
  }

  async function doDelete() {
    const p = products.find(x => x.id === deleteId);
    if (p?.image_url) {
      const parts = p.image_url.split(`${BUCKET}/`);
      if (parts[1]) await sb.storage.from(BUCKET).remove([parts[1]]);
    }
    const { error } = await sb.from("products").delete().eq("id", deleteId);
    if (error) { showToast("Error al eliminar: " + error.message); return; }
    setCart(prev => { const n = {...prev}; delete n[deleteId]; return n; });
    await fetchProducts();
    setDeleteId(null); showToast("🗑️ Producto eliminado");
  }

  async function handleLogout() { await sb.auth.signOut(); onLogout(); }

  // Categorías visibles según tab Y búsqueda
  const tabCats = activeTab === "all" ? CATEGORIES : CATEGORIES.filter(c => c.id === activeTab);

  // Para cada categoría, qué productos mostrar
  function getItemsForCat(catId) {
    return isSearching
      ? filteredProducts.filter(p => p.category === catId)
      : products.filter(p => p.category === catId);
  }

  // Índice global de un producto dentro de filteredProducts (para highlight con teclado)
  function globalIdx(pid) {
    return filteredProducts.findIndex(p => p.id === pid);
  }

  const cartLines = Object.entries(cart)
    .map(([id, qty]) => { const p = products.find(x => x.id === Number(id)); return p ? {...p, cartQty: qty} : null; })
    .filter(Boolean);

  const totalFiltered = isSearching ? filteredProducts.length : null;

  // ── Render ───────────────────────────────────────────────
  return (
    <div>
      <div className="bg-pattern" />
      {toast && <div className="toast">{toast}</div>}

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="overlay" onClick={() => setLightbox("")}>
          <div className="lightbox-box" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightbox("")}>✕</button>
            <img src={lightbox} className="lightbox-img" alt="Foto del producto" />
          </div>
        </div>
      )}

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

          {/* ── BUSCADOR ── */}
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              ref={searchRef}
              className="search-input"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder="Buscar producto... (↑↓ navegar, Enter para agregar al carrito)"
            />
            {isSearching && (
              <button className="search-clear" onClick={() => setQuery("")} title="Limpiar">✕</button>
            )}
          </div>

          {/* Contador de resultados */}
          {isSearching && (
            <div className="search-results-label">
              {totalFiltered === 0
                ? "Sin resultados para \"" + query + "\""
                : totalFiltered + " producto" + (totalFiltered !== 1 ? "s" : "") + " encontrado" + (totalFiltered !== 1 ? "s" : "") + " · ↑↓ navegar · Enter agregar"
              }
            </div>
          )}

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

          {loading && (
            <div className="loading-state">
              <div className="spinner" /> Cargando productos...
            </div>
          )}

          {/* CATEGORÍAS CON PRODUCTOS FILTRADOS */}
          {!loading && tabCats.map(cat => {
            const items = getItemsForCat(cat.id);
            if (items.length === 0) return null;
            return (
              <div key={cat.id} className="category-block">
                <div className="category-header" style={{ borderColor: cat.color }}>
                  <span className="cat-icon" style={{ background: cat.color }}>{cat.icon}</span>
                  <span className="cat-label" style={{ color: cat.color }}>{cat.label}</span>
                  <span className="cat-count">{items.length} producto{items.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="product-list">
                  {items.map(p => {
                    const inCart    = !!cart[p.id];
                    const cqty      = cart[p.id] || 0;
                    const gIdx      = globalIdx(p.id);
                    const isFocused = isSearching && gIdx === focusedIdx;
                    return (
                      <div key={p.id}
                           className={"card" + (inCart ? " in-cart" : "") + (isFocused ? " search-focused" : "")}
                           style={inCart ? { borderLeftColor: cat.color, borderLeftWidth: 4 } : {}}>
                        <div className="card-row">
                          <span className={"check-box" + (inCart ? " checked" : "")}
                                style={{ background: inCart ? cat.color : "transparent", borderColor: inCart ? cat.color : "#d4b896" }}
                                onClick={() => toggleCart(p.id)}>
                            {inCart && <span className="check-mark">✓</span>}
                          </span>
                          <span className="card-name" onClick={() => toggleCart(p.id)}>
                            {isSearching ? highlightMatch(p.name, query) : p.name}
                          </span>
                          <span className="card-qty-label">×{p.qty}</span>
                          <span className="card-price" style={{ background: cat.color + "22", color: cat.color }}>
                            {fmt(p.price)}
                          </span>
                          {p.image_url && (
                            <button className="photo-btn" onClick={() => setLightbox(p.image_url)} title="Ver foto">📷</button>
                          )}
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
              <div style={{ fontSize:48, marginBottom:8 }}>🍞</div>
              <div style={{ marginBottom:12 }}>No hay productos todavía.</div>
              <button className="add-btn" onClick={openAdd}>＋ Agregar primer producto</button>
            </div>
          )}

          {!loading && isSearching && totalFiltered === 0 && (
            <div className="empty-state">
              <div style={{ fontSize:36, marginBottom:8 }}>🔍</div>
              <div>Sin resultados para <strong>"{query}"</strong></div>
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
                <label className="field-label">Precio (S/.)</label>
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
            <label className="field-label">Foto del producto (opcional)</label>
            {imagePreview ? (
              <div className="image-preview-box">
                <img src={imagePreview} className="image-preview" alt="Preview" />
                <button className="remove-image-btn" onClick={removeImage}>✕ Quitar foto</button>
              </div>
            ) : (
              <label className="image-upload-label">
                <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display:"none" }} />
                <span>📷 Seleccionar foto</span>
              </label>
            )}
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="save-btn" onClick={saveForm} disabled={saving || uploadingImg}>
                {uploadingImg ? "Subiendo foto..." : saving ? "Guardando..." : editId ? "Guardar cambios" : "Agregar producto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Eliminar */}
      {deleteId !== null && (
        <div className="overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth:360 }} onClick={e => e.stopPropagation()}>
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

// Resalta la parte del nombre que coincide con la búsqueda
function highlightMatch(name, query) {
  const norm     = normalize(name);
  const normQ    = normalize(query.trim());
  const idx      = norm.indexOf(normQ);
  if (idx === -1) return name;
  return (
    <span>
      {name.slice(0, idx)}
      <span className="search-highlight">{name.slice(idx, idx + query.trim().length)}</span>
      {name.slice(idx + query.trim().length)}
    </span>
  );
}

// ════════════════════════════════════════════════════════════
//  RAÍZ
// ════════════════════════════════════════════════════════════
function App() {
  const [session,  setSession]  = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => { setSession(session); });
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

  if (!session) return <LoginScreen onLogin={setSession} />;
  return <BakeryManager session={session} onLogout={() => setSession(null)} />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
