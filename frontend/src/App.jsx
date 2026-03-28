import { useState, useEffect } from "react";
import Login from "./Login";
import Signup from "./Signup";

function getAvailable(lot) {
  if (lot.spaces && lot.spaces.length > 0) {
    return lot.spaces.filter((s) => !s.occupied).length;
  }
  return lot.availableSpaces ?? 0;
}

function isPeakHour() {
  const h = new Date().getHours();
  return h >= 8 && h < 18;
}

function getTypeIcon(type) {
  if (type === "ev") return "⚡";
  if (type === "accessible") return "♿";
  return null;
}

// Reserve Modal
function ReserveModal({ space, lot, onClose, onConfirm }) {
  const [hours, setHours] = useState(2);
  const peak = isPeakHour();
  const rate = peak ? lot.peakRate : lot.baseRate;
  const total = (rate * hours).toFixed(2);

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Reserve a Space</span>
          <button onClick={onClose} style={s.closeBtn}>
            ✕
          </button>
        </div>

        <div style={s.modalBody}>
          <div style={s.spaceTag}>
            {getTypeIcon(space.type) && <span>{getTypeIcon(space.type)} </span>}
            {space.label}
          </div>
          <div style={s.modalLotName}>{lot.name}</div>
          <div style={s.modalLotAddr}>{lot.location}</div>

          <hr style={s.hr} />

          <div style={s.rateRow}>
            <span style={s.rateLabel}>
              {peak ? "⚠ Peak hours" : "Off-peak hours"}
            </span>
            <span
              style={{ ...s.rateValue, color: peak ? "#e07b00" : "#16a34a" }}
            >
              ${rate.toFixed(2)} / hr
            </span>
          </div>

          <div style={s.fieldLabel}>Duration</div>
          <div style={s.stepperRow}>
            <button
              style={s.stepBtn}
              onClick={() => setHours(Math.max(1, hours - 1))}
            >
              −
            </button>
            <span style={s.stepVal}>{hours} hr</span>
            <button
              style={s.stepBtn}
              onClick={() => setHours(Math.min(24, hours + 1))}
            >
              +
            </button>
          </div>

          <div style={s.totalRow}>
            <span style={s.totalLabel}>Total</span>
            <span style={s.totalValue}>${total}</span>
          </div>
        </div>

        <div style={s.modalFooter}>
          <button style={s.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            style={s.confirmBtn}
            onClick={() => onConfirm(space, hours, total)}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

//  Toast
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, []);
  return <div style={s.toast}>{message}</div>;
}

//  Space Cell
function SpaceCell({ space, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const available = !space.occupied;
  const bg = available ? (hovered ? "#dcfce7" : "#f0fdf4") : "#fef2f2";
  const border = available ? (hovered ? "#16a34a" : "#bbf7d0") : "#fecaca";
  const textColor = available ? "#15803d" : "#ef4444";

  return (
    <div
      style={{
        ...s.cell,
        background: bg,
        border: `1px solid ${border}`,
        color: textColor,
        cursor: available ? "pointer" : "not-allowed",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => available && onSelect(space)}
      title={available ? `Reserve ${space.label}` : "Occupied"}
    >
      <span style={s.cellLabel}>{space.label}</span>
      {getTypeIcon(space.type) && (
        <span style={s.cellIcon}>{getTypeIcon(space.type)}</span>
      )}
      <span style={{ fontSize: 9, opacity: 0.5 }}>
        {available ? "free" : "taken"}
      </span>
    </div>
  );
}

// Lot Card
function LotCard({ lot, selected, onClick }) {
  const avail = getAvailable(lot);
  const pct = Math.round((avail / lot.totalSpaces) * 100);
  const barColor = pct > 50 ? "#16a34a" : pct > 20 ? "#ca8a04" : "#dc2626";

  return (
    <div
      style={{ ...s.lotCard, ...(selected ? s.lotCardActive : {}) }}
      onClick={onClick}
    >
      <div style={s.lotCardRow}>
        <span style={s.lotCardName}>{lot.name}</span>
        <span style={{ ...s.lotCardCount, color: barColor }}>
          {avail}/{lot.totalSpaces}
        </span>
      </div>
      <div style={s.lotCardAddr}>{lot.location}</div>
      <div style={s.progressBg}>
        <div
          style={{ ...s.progressFill, width: `${pct}%`, background: barColor }}
        />
      </div>
      <div style={s.lotCardRates}>
        <span>${lot.baseRate.toFixed(2)}/hr base</span>
        <span style={{ color: "#e07b00" }}>
          ${lot.peakRate.toFixed(2)}/hr peak
        </span>
      </div>
    </div>
  );
}

// ─App
export default function App() {
  // initialize with empty array, need HTTP GET API call to retrieve info
  const [lots, setLots] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState(1);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [toast, setToast] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [tab, setTab] = useState(
    () => localStorage.getItem("spotfree_tab") || "map",
  );

  // ─Auth state (localStorage instead of Firebase)
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("spotfree_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [authTab, setAuthTab] = useState("login");
  const [ready, setReady] = useState(false);

  // Mark app as ready after first render to prevent blank flash
  useEffect(() => {
    setReady(true);
  }, []);

  // useEffect for fetching all of the lots
  // this runs once, when the App first loads
  // calls the parking lot service to get the JSON array of all the lots and their data, and puts it into state
  useEffect(() => {
    fetch("http://localhost:8001/lots")
      .then((res) => res.json())
      .then((data) => {
        // Backend uses snake_case, frontend expects camelCase
        // so the fields need to be mapped
        // the different rates from pricing service
        const rates = {
          1: { baseRate: 3.0, peakRate: 6.0 },
          2: { baseRate: 2.0, peakRate: 4.5 },
          3: { baseRate: 5.0, peakRate: 8.0 },
        };
        const mapped = data.map((lot) => ({
          id: lot.id,
          name: lot.name,
          location: lot.location,
          totalSpaces: lot.total_spaces,
          availableSpaces: lot.available_spaces,
          baseRate: rates[lot.id]?.baseRate ?? 3.0,
          peakRate: rates[lot.id]?.peakRate ?? 6.0,
          spaces: [], // loaded separately
        }));
        setLots(mapped);
        if (mapped.length > 0) setSelectedLotId(mapped[0].id);
      });
  }, []); // empty [] at the end means run once (don't re-run)

  // use effect for if the selectedLotId changes, so if the user clicks a different lot in the sidebar
  // the if statement prevents it running before a lot is selected
  useEffect(() => {
    if (!selectedLotId || lots.length === 0) return;
    fetch(`http://localhost:8001/lots/${selectedLotId}/spaces`)
      .then((res) => res.json())
      .then((data) => {
        const mapped = data.map((sp) => ({
          id: sp.id,
          label: sp.space_number,
          occupied: sp.is_occupied,
          type: sp.space_type,
        }));
        // this update finds the right lot in the array and attaches the spaces to it
        setLots((prev) =>
          prev.map((lot) =>
            lot.id === selectedLotId
              ? {
                  ...lot,
                  spaces: mapped,
                  availableSpaces: mapped.filter((sp) => !sp.occupied).length,
                }
              : lot,
          ),
        );
      });
  }, [selectedLotId]);

  // useEffect for reservations to get the reservations of a user
  useEffect(() => {
    if (!user) return;
    fetch(`http://localhost:8002/reservations/user/${user.id}`)
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((data) => {
        if (!data || data.length === 0) return;
        const mapped = data.map((r) => ({
          id: r.id,
          space: r.space_number,
          lot: r.lot_name,
          hours: Math.round(
            (new Date(r.end_time) - new Date(r.start_time)) / 3600000,
          ),
          total: r.total_price,
          time: new Date(r.start_time).toLocaleTimeString(),
        }));
        setReservations(mapped);
      })
      .catch(() => {});
  }, [user]);

  // fetching the rates for the lots
  useEffect(() => {
    Promise.all([
      fetch("http://localhost:8001/lots").then((r) => r.json()),
      fetch("http://localhost:8003/price/lots").then((r) => r.json()),
    ]).then(([lotsData, ratesData]) => {
      const ratesMap = {};
      ratesData.forEach((r) => {
        ratesMap[r.lot_id] = { baseRate: r.base_rate, peakRate: r.peak_rate };
      });
      const mapped = lotsData.map((lot) => ({
        id: lot.id,
        name: lot.name,
        location: lot.location,
        totalSpaces: lot.total_spaces,
        availableSpaces: lot.available_spaces,
        baseRate: ratesMap[lot.id]?.baseRate ?? 3.0,
        peakRate: ratesMap[lot.id]?.peakRate ?? 6.0,
        spaces: [],
      }));
      setLots(mapped);
      if (mapped.length > 0) setSelectedLotId(mapped[0].id);
    });
  }, []);

  function handleLogin(userData) {
    localStorage.setItem("spotfree_user", JSON.stringify(userData));
    setUser(userData);
    setToast(null); // to ensure previous logout message doesnt show again on next login
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("spotfree_user");
    setUser(null);
    setToast("Logged out successfully");
  };

  const currentLot =
    lots.find((l) => l.id === selectedLotId) || lots[0] || null;
  const totalAvail = lots.reduce((sum, l) => sum + getAvailable(l), 0);
  const totalSpaces = lots.reduce((sum, l) => sum + l.totalSpaces, 0);
  const peak = isPeakHour();

  async function handleConfirm(space, hours, total) {
    const now = new Date();
    const end = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const response = await fetch("http://localhost:8002/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        space_id: space.id,
        start_time: now.toISOString(),
        end_time: end.toISOString(),
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      setToast(`Booking failed: ${err.detail}`);
      return;
    }

    setLots((prev) =>
      prev.map((lot) => {
        if (lot.id !== currentLot.id) return lot;

        const updatedSpaces = lot.spaces.map((sp) =>
          sp.id === space.id ? { ...sp, occupied: true } : sp,
        );

        return {
          ...lot,
          spaces: updatedSpaces,
          availableSpaces: updatedSpaces.filter((sp) => !sp.occupied).length,
        };
      }),
    );
    fetch(`http://localhost:8002/reservations/user/${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        const mapped = data.map((r) => ({
          id: r.id,
          space: r.space_number,
          lot: r.lot_name,
          hours: Math.round(
            (new Date(r.end_time) - new Date(r.start_time)) / 3600000,
          ),
          total: r.total_price,
          time: new Date(r.start_time).toLocaleTimeString(),
        }));
        setReservations(mapped);
      });
    setSelectedSpace(null);
    setToast(`Reserved ${space.label} at ${currentLot.name} — $${total}`);
  }

  // function for a user to cancel a reservation they made
  // the db entry needs to be removed and the space needs to be available again
  async function handleCancel(reservationId) {
    const response = await fetch(
      `http://localhost:8002/reservations/${reservationId}`,
      {
        method: "DELETE",
      },
    );
    if (response.ok) {
      setReservations((prev) => prev.filter((r) => r.id !== reservationId));
      setToast("Reservation cancelled");
      fetch(`http://localhost:8001/lots/${selectedLotId}/spaces`)
        .then((res) => res.json())
        .then((data) => {
          const mapped = data.map((sp) => ({
            id: sp.id,
            label: sp.space_number,
            occupied: sp.is_occupied,
            type: sp.space_type,
          }));
          setLots((prev) =>
            prev.map((lot) =>
              lot.id === selectedLotId
                ? {
                    ...lot,
                    spaces: mapped,
                    availableSpaces: mapped.filter((sp) => !sp.occupied).length,
                  }
                : lot,
            ),
          );
        });
    } else {
      setToast("Failed to cancel reservation");
    }
  }

  // Prevent blank flash on first render
  if (!ready) return null;

  // If user is not logged in, show login/signup UI
  if (!user) {
    return (
      <div style={s.authRoot}>
        <div style={s.authWrapper}>
          <div style={s.logoAuth}>
            <div style={s.logoMark}>S</div>
            <span style={s.logoText}>SpotFree</span>
          </div>

          <div style={s.authBox}>
            {authTab === "login" ? (
              <>
                <Login onLogin={handleLogin} />
                <p style={s.authToggle}>
                  Don't have an account?
                  <button
                    style={s.authLinkBtn}
                    onClick={() => setAuthTab("signup")}
                  >
                    Sign Up
                  </button>
                </p>
              </>
            ) : (
              <>
                <Signup onLogin={handleLogin} />
                <p style={s.authToggle}>
                  Already have an account?
                  <button
                    style={s.authLinkBtn}
                    onClick={() => setAuthTab("login")}
                  >
                    Login
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // loading guard for the UI
  if (!currentLot) return <div style={{ padding: 40 }}>Loading...</div>;

  // Main app UI
  return (
    <div style={s.root}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.logo}>
          <div style={s.logoMark}>S</div>
          <span style={s.logoText}>SpotFree</span>
        </div>

        {/* Logged-in user info */}
        <div style={s.userInfo}>
          <span>
            Welcome, {user.name} ({user.email})
          </span>
          <button style={s.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>

        {/* Stats */}
        <div style={s.headerStats}>
          <div style={s.stat}>
            <span style={s.statNum}>{totalAvail}</span>
            <span style={s.statLabel}>Available</span>
          </div>
          <div style={s.statDivider} />
          <div style={s.stat}>
            <span style={s.statNum}>{totalSpaces - totalAvail}</span>
            <span style={s.statLabel}>Occupied</span>
          </div>
          <div style={s.statDivider} />
          <div style={s.stat}>
            <span style={{ ...s.statNum, color: peak ? "#e07b00" : "#16a34a" }}>
              {peak ? "Peak" : "Off-Peak"}
            </span>
            <span style={s.statLabel}>Pricing</span>
          </div>
        </div>

        {/* Navigation */}
        <nav style={s.nav}>
          <button
            style={{ ...s.navBtn, ...(tab === "map" ? s.navBtnActive : {}) }}
            onClick={() => {
              setTab("map");
              localStorage.setItem("spotfree_tab", "map");
            }}
          >
            Map
          </button>
          <button
            style={{
              ...s.navBtn,
              ...(tab === "reservations" ? s.navBtnActive : {}),
            }}
            onClick={() => {
              setTab("reservations");
              localStorage.setItem("spotfree_tab", "reservations");
            }}
          >
            My Reservations
            {reservations.length > 0 && (
              <span style={s.navBadge}>{reservations.length}</span>
            )}
          </button>
        </nav>
      </header>

      <main style={s.main}>
        {tab === "map" ? (
          <>
            {/* Sidebar */}
            <aside style={s.sidebar}>
              <p style={s.sidebarHeading}>Parking Lots</p>
              {lots.map((lot) => (
                <LotCard
                  key={lot.id}
                  lot={lot}
                  selected={selectedLotId === lot.id}
                  onClick={() => setSelectedLotId(lot.id)}
                />
              ))}
              <div style={s.legend}>
                <p style={s.legendHeading}>Legend</p>
                <div style={s.legendRow}>
                  <span
                    style={{
                      ...s.legendSwatch,
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                    }}
                  />{" "}
                  Available
                </div>
                <div style={s.legendRow}>
                  <span
                    style={{
                      ...s.legendSwatch,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                    }}
                  />{" "}
                  Occupied
                </div>
                <div style={s.legendRow}>
                  <span style={s.legendIcon}>⚡</span> EV Charging
                </div>
                <div style={s.legendRow}>
                  <span style={s.legendIcon}>♿</span> Accessible
                </div>
              </div>
            </aside>

            {/* Grid */}
            <section style={s.content}>
              <div style={s.contentHeader}>
                <div>
                  <h2 style={s.contentTitle}>{currentLot.name}</h2>
                  <p style={s.contentSub}>
                    {currentLot.location} · {getAvailable(currentLot)} of{" "}
                    {currentLot.totalSpaces} spaces available
                  </p>
                </div>
                <div
                  style={{
                    ...s.rateChip,
                    borderColor: peak ? "#fed7aa" : "#bbf7d0",
                    color: peak ? "#e07b00" : "#16a34a",
                  }}
                >
                  {peak ? "⚠ Peak" : "✓ Off-Peak"} — $
                  {peak
                    ? currentLot.peakRate.toFixed(2)
                    : currentLot.baseRate.toFixed(2)}
                  /hr
                </div>
              </div>
              <div style={s.grid}>
                {currentLot.spaces.map((space) => (
                  <SpaceCell
                    key={space.id}
                    space={space}
                    onSelect={setSelectedSpace}
                  />
                ))}
              </div>
              <p style={s.gridHint}>
                Click a green space to make a reservation
              </p>
            </section>
          </>
        ) : (
          <section style={s.resPage}>
            <h2 style={s.resPageTitle}>My Reservations</h2>
            {reservations.length === 0 ? (
              <div style={s.emptyState}>
                <p style={s.emptyText}>No reservations yet.</p>
                <button
                  style={s.confirmBtn}
                  onClick={() => {
                    setTab("map");
                    localStorage.setItem("spotfree_tab", "map");
                  }}
                >
                  Find a Space
                </button>
              </div>
            ) : (
              <div style={s.resList}>
                {reservations.map((r) => (
                  <div key={r.id} style={s.resCard}>
                    <div>
                      <div style={s.resSpace}>{r.space}</div>
                      <div style={s.resLot}>{r.lot}</div>
                      <div style={s.resTime}>Booked at {r.time}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={s.resDuration}>{r.hours} hr</div>
                      <div style={s.resTotal}>${r.total}</div>
                      <div style={s.resStatus}>Active</div>
                      <button
                        onClick={() => handleCancel(r.id)}
                        style={s.cancelResBtn}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Modals */}
      {selectedSpace && (
        <ReserveModal
          space={selectedSpace}
          lot={currentLot}
          onClose={() => setSelectedSpace(null)}
          onConfirm={handleConfirm}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

// Styles
const s = {
  root: {
    minHeight: "100vh",
    background: "#fff",
    color: "#111",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 28px",
    height: 60,
    borderBottom: "1px solid #e5e7eb",
    background: "#fff",
    gap: 24,
    flexShrink: 0,
  },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoMark: {
    width: 30,
    height: 30,
    background: "#16a34a",
    color: "#fff",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 15,
  },
  logoText: { fontSize: 16, fontWeight: 700, color: "#111" },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 13,
    color: "#6b7280",
  },
  logoutBtn: {
    padding: "5px 12px",
    borderRadius: 6,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#6b7280",
    fontSize: 12,
    cursor: "pointer",
  },
  headerStats: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "0 20px",
  },
  statNum: { fontSize: 18, fontWeight: 700, color: "#16a34a" },
  statLabel: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  statDivider: { width: 1, height: 28, background: "#e5e7eb" },
  nav: { display: "flex", gap: 6 },
  navBtn: {
    background: "none",
    border: "1px solid #e7ebe5",
    color: "#6b7280",
    padding: "6px 14px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.2s ease",
  },
  navBtnActive: {
    borderColor: "#16a34a",
    color: "#16a34a",
    background: "#f0fdf4",
  },
  navBadge: {
    background: "#16a34a",
    color: "#fff",
    borderRadius: 10,
    padding: "1px 6px",
    fontSize: 11,
    fontWeight: 600,
  },
  main: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: {
    width: 260,
    background: "#fafafa",
    borderRight: "1px solid #e5e7eb",
    padding: 20,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sidebarHeading: {
    fontSize: 11,
    fontWeight: 600,
    color: "#9ca3af",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  lotCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 12,
    cursor: "pointer",
  },
  lotCardActive: { borderColor: "#16a34a", background: "#f0fdf4" },
  lotCardRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  lotCardName: { fontSize: 13, fontWeight: 600, color: "#111" },
  lotCardCount: { fontSize: 13, fontWeight: 700 },
  lotCardAddr: { fontSize: 11, color: "#9ca3af", marginBottom: 8 },
  progressBg: {
    height: 4,
    background: "#e5e7eb",
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: { height: "100%", borderRadius: 2 },
  lotCardRates: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#6b7280",
  },
  legend: { marginTop: "auto", paddingTop: 16, borderTop: "1px solid #e5e7eb" },
  legendHeading: {
    fontSize: 11,
    fontWeight: 600,
    color: "#9ca3af",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  legendRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
  },
  legendSwatch: { width: 16, height: 16, borderRadius: 4, flexShrink: 0 },
  legendIcon: { width: 16, textAlign: "center", fontSize: 13 },
  content: { flex: 1, padding: 28, overflowY: "auto" },
  contentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  contentTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111",
    marginBottom: 4,
  },
  contentSub: { fontSize: 13, color: "#6b7280" },
  rateChip: {
    fontSize: 12,
    fontWeight: 500,
    border: "1px solid",
    borderRadius: 6,
    padding: "6px 12px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
    gap: 8,
  },
  cell: {
    height: 76,
    borderRadius: 6,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    userSelect: "none",
  },
  cellLabel: { fontSize: 12, fontWeight: 600 },
  cellIcon: { fontSize: 11 },
  gridHint: {
    marginTop: 20,
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modal: {
    background: "#fff",
    borderRadius: 10,
    width: 340,
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 18px",
    borderBottom: "1px solid #e5e7eb",
  },
  modalTitle: { fontSize: 14, fontWeight: 600, color: "#111" },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#9ca3af",
    cursor: "pointer",
    fontSize: 16,
  },
  modalBody: { padding: "18px 18px 12px" },
  spaceTag: {
    display: "inline-block",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#16a34a",
    borderRadius: 6,
    padding: "4px 12px",
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 10,
  },
  modalLotName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#111",
    marginBottom: 2,
  },
  modalLotAddr: { fontSize: 12, color: "#9ca3af", marginBottom: 14 },
  hr: { border: "none", borderTop: "1px solid #e5e7eb", marginBottom: 14 },
  rateRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  rateLabel: { fontSize: 12, color: "#6b7280" },
  rateValue: { fontSize: 15, fontWeight: 700 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 8,
  },
  stepperRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    color: "#111",
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  stepVal: {
    fontSize: 18,
    fontWeight: 600,
    color: "#111",
    minWidth: 48,
    textAlign: "center",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "10px 14px",
  },
  totalLabel: { fontSize: 12, color: "#6b7280" },
  totalValue: { fontSize: 22, fontWeight: 700, color: "#16a34a" },
  modalFooter: {
    display: "flex",
    gap: 8,
    padding: "12px 18px",
    borderTop: "1px solid #e5e7eb",
  },
  cancelBtn: {
    flex: 1,
    padding: "10px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    color: "#6b7280",
  },
  confirmBtn: {
    flex: 1,
    padding: "10px",
    background: "#16a34a",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
  },
  toast: {
    position: "fixed",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#111",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 13,
    zIndex: 200,
    whiteSpace: "nowrap",
  },
  resPage: {
    flex: 1,
    padding: 40,
    maxWidth: 640,
    margin: "0 auto",
    width: "100%",
  },
  resPageTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: "1px solid #e5e7eb",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    paddingTop: 60,
  },
  emptyText: { color: "#9ca3af", fontSize: 14 },
  resList: { display: "flex", flexDirection: "column", gap: 10 },
  resCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "14px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resSpace: {
    fontSize: 17,
    fontWeight: 700,
    color: "#16a34a",
    marginBottom: 2,
  },
  resLot: { fontSize: 13, color: "#111", marginBottom: 2 },
  resTime: { fontSize: 11, color: "#9ca3af" },
  resDuration: { fontSize: 12, color: "#6b7280", marginBottom: 2 },
  resTotal: { fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 4 },
  resStatus: {
    fontSize: 11,
    fontWeight: 600,
    color: "#16a34a",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 4,
    padding: "2px 25px",
    display: "inline-block",
  },

  cancelResBtn: {
    marginTop: 8,
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid #fecaca",
    background: "#fff",
    color: "#dc2626",
    fontSize: 12,
    cursor: "pointer",
    marginLeft: "5px",
  },

  authRoot: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f9fafb",
  },
  authWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
  },
  logoAuth: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  authBox: {
    width: 380,
    padding: 36,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
    textAlign: "center",
  },
  authToggle: {
    marginTop: 22,
    fontSize: 13,
    color: "#6b7280",
  },
  authLinkBtn: {
    border: "none",
    background: "none",
    color: "#16a34a",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    marginLeft: 6,
  },
};
