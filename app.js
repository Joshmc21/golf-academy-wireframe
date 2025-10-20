// === PART 1: CORE SETUP & AUTH ===

// --- Supabase Setup ---
const SUPABASE_URL = "https://syecffopasrwkjonwvdk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZWNmZm9wYXNyd2tqb253dmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NDgzNTYsImV4cCI6MjA3MzUyNDM1Nn0.JYAD7NaPrZWxTa_V2-jwQI_Kh7p4GaSKFRv65G7Czqs";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Globals ---
let session = null;

// === Utility Helpers ===
const fmt = (n) => (n == null ? "–" : Number(n).toFixed(1));
const toast = (msg) => alert(msg);
const spark = (arr, w = 200, h = 40, cls = "spark") =>
  `<svg class="${cls}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
     ${arr
       .map(
         (v, i, a) =>
           i === 0
             ? ""
             : `<line x1="${((i - 1) / (a.length - 1)) * w}"
                      y1="${h - (a[i - 1] / Math.max(...a)) * h}"
                      x2="${(i / (a.length - 1)) * w}"
                      y2="${h - (v / Math.max(...a)) * h}"
                      stroke="currentColor" stroke-width="2"/>`
       )
       .join("")}
   </svg>`;

// === AUTH SYSTEM ===
async function initAuth() {
  // 1️⃣ Try to restore session
  const { data } = await supabase.auth.getSession();
  session = data?.session ?? null;
  updateAuthUI();

  // 2️⃣ If already logged in, load golfer
  if (session?.user?.id) {
    console.log("✅ Restored session for:", session.user.id);
    const golfer = await loadGolferFromDB(session.user.id);
    if (golfer) renderGolferDashboard(golfer);
  }

  // 3️⃣ React to login/logout events
  supabase.auth.onAuthStateChange(async (_event, sess) => {
    session = sess;
    updateAuthUI();
    if (session?.user?.id) {
      console.log("✅ Logged in, loading golfer for", session.user.id);
      const golfer = await loadGolferFromDB(session.user.id);
      if (golfer) renderGolferDashboard(golfer);
    } else {
      console.warn("Logged out.");
      document.querySelector("main").innerHTML = "";
    }
  });
}

// === Update UI based on auth ===
function updateAuthUI() {
  const loggedIn = !!session;
  const main = document.querySelector("main");
  const loginSheet = document.getElementById("loginSheet");
  const loginSplash = document.getElementById("login-splash");
  const btnShowLoginPanel = document.getElementById("btnShowLogin");
  const btnLogout = document.getElementById("btnLogout");

  if (loggedIn) {
    if (loginSheet) loginSheet.style.display = "none";
    if (loginSplash) loginSplash.style.display = "none";

  if (main) {
      main.style.display = "block";
      setTimeout(() => main.classList.add("visible"), 50);
    }
  } else {
    if (main) {
      main.style.display = "none";
      main.classList.remove("visible");
    }
  }
    if (loginSheet) loginSheet.style.display = "flex";
    if (loginSplash) loginSplash.style.display = "flex";
}

// === LOGIN / LOGOUT HANDLERS ===
async function loginWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function logout() {
  await supabase.auth.signOut();
}

function showLoginSheet(show) {
  const el = document.getElementById("loginSheet");
  if (el) el.style.display = show ? "flex" : "none";
}

// === Wire UI Buttons ===
window.addEventListener("DOMContentLoaded", () => {
  const btnShowLoginPanel = document.getElementById("btnShowLoginPanel");
  const btnCancelLogin = document.getElementById("btnCancelLogin");
  const btnDoLogin = document.getElementById("btnDoLogin");
  const btnLogout = document.getElementById("btnLogout");

  btnShowLoginPanel?.addEventListener("click", () => showLoginSheet(true));
  btnCancelLogin?.addEventListener("click", () => showLoginSheet(false));
  btnDoLogin?.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPass").value.trim();
    const msg = document.getElementById("loginMsg");
    msg.textContent = "";
    try {
      await loginWithEmail(email, pass);
      showLoginSheet(false);

      document.getElementById('login-splash').style.display = 'none';
      document.getElementById('appContainer').style.display = 'block';
      navTo('dashboard');

    } catch (err) {
      msg.textContent = err.message || "Login failed";
      console.error("Login error:", err);
    }
  });
  btnLogout?.addEventListener("click", logout);

  initAuth();
});


// === PART 2: LOAD DATA + RENDER DASHBOARD ===

// === Load golfer and performance data from Supabase ===
async function loadGolferFromDB(userId) {
  if (!userId) {
    console.warn("⚠️ loadGolferFromDB called without valid userId");
    return null;
  }

  try {
    console.log("📡 Fetching golfer data for:", userId);

    // Base profile
    const { data: base, error: baseErr } = await supabase
      .from("golfers")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (baseErr) throw baseErr;

    // SG (per quarter)
    const { data: sgRows, error: sgErr } = await supabase
      .from("sg_quarter")
      .select("d, total, tee, approach, short, putting")
      .eq("user_id", userId)
      .order("d", { ascending: true });
    if (sgErr) console.warn("SG fetch issue:", sgErr);

    // Physical
    const { data: physRows, error: physErr } = await supabase
      .from("phys_quarter")
      .select("d, chs, ball, cmj, bj, height, weight")
      .eq("user_id", userId)
      .order("d", { ascending: true });
    if (physErr) console.warn("Physical fetch issue:", physErr);

    // Coach ratings
    const { data: rateRows, error: rateErr } = await supabase
      .from("coach_ratings")
      .select("d, holing, short, wedge, flight, plan")
      .eq("user_id", userId)
      .order("d", { ascending: true });
    if (rateErr) console.warn("Ratings fetch issue:", rateErr);

    // Attendance
    const { data: attRows, error: attErr } = await supabase
      .from("attendance")
      .select("d, group_sess, one1")
      .eq("user_id", userId)
      .order("d", { ascending: true });
    if (attErr) console.warn("Attendance fetch issue:", attErr);

    console.log("✅ Golfer + performance data loaded.");

    // Return combined golfer object
    return {
      id: userId,
      name: base?.name || "Unknown Golfer",
      hi: base?.hi || 0,
      dob: base?.dob || null,
      next_update: base?.next_update || null,
      sg: sgRows || [],
      phys: physRows || [],
      ratings: rateRows || [],
      attendance: attRows || [],
    };
  } catch (err) {
    console.error("❌ loadGolferFromDB failed:", err);
    return null;
  }
}

window.loadGolferFromDB = loadGolferFromDB;

// === Render Golfer Dashboard ===
function renderGolferDashboard(golfer) {
  const main = document.querySelector("main");
  if (!golfer || !main) {
    console.warn("⚠️ No golfer or <main> found for rendering.");
    return;
  }

  // Defensive defaults
  const sgData = Array.isArray(golfer.sg) ? golfer.sg : [];
  const physData = Array.isArray(golfer.phys) ? golfer.phys : [];
  const ratingsData = Array.isArray(golfer.ratings) ? golfer.ratings : [];
  const attendanceData = Array.isArray(golfer.attendance) ? golfer.attendance : [];

  const sgTotals = sgData.map((s) => s.total || 0);
  const golferName = golfer.name ? golfer.name.split(" ")[0] : "Golfer";
  const nextUpdate = golfer.next_update || "TBD";

  main.innerHTML = `
    <section class="dashboard">
      <h1>Welcome, ${golferName}</h1>
      <div class="card">
        Next update due: <strong>${nextUpdate}</strong>
      </div>

      <div class="grid grid-3">
        <div class="card" onclick="navTo('hi-detail')" title="Handicap detail">
          <div class="kpi">${fmt(golfer.hi || 0)}</div>
          <div class="muted">Handicap Index</div>
        </div>

        <div class="card" onclick="navTo('sg-detail')" title="Strokes Gained detail">
          <div class="sparkwrap">${spark(sgTotals, 280, 48, "spark")}</div>
          <div class="muted">Strokes Gained (${sgTotals.length} records)</div>
        </div>

        <div class="card" onclick="navTo('physical-detail')" title="Physical performance">
          <div class="kpi">${fmt(physData.length || 0)}</div>
          <div class="muted">Physical Metrics</div>
        </div>

        <div class="card" onclick="navTo('coach-ratings-detail')" title="Coach ratings">
          <div class="kpi">${fmt(ratingsData.length || 0)}</div>
          <div class="muted">Coach Ratings</div>
        </div>

        <div class="card" onclick="navTo('attendance-detail')" title="Attendance">
          <div class="kpi">${fmt(attendanceData.length || 0)}</div>
          <div class="muted">Attendance</div>
        </div>
      </div>
    </section>
  `;
}

window.renderGolferDashboard = renderGolferDashboard;

// === PART 3: NAVIGATION + OTHER PAGES + EXTRAS ===

// === Simple SPA navigation handler ===
function navTo(page) {
  const main = document.querySelector("main");
  if (!main) return;

  switch (page) {
    case "hi-detail":
      main.innerHTML = `
        <h1>Handicap Index</h1>
        <p>Detailed view coming soon.</p>
        <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
      `;
      break;

    case "sg-detail":
      main.innerHTML = `
        <h1>Strokes Gained</h1>
        <p>Breakdown of SG per category over time.</p>
        <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
      `;
      break;

    case "physical-detail":
      main.innerHTML = `
        <h1>Physical Metrics</h1>
        <p>Speed, jump, and strength tracking data.</p>
        <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
      `;
      break;

    case "coach-ratings-detail":
      main.innerHTML = `
        <h1>Coach Ratings</h1>
        <p>Feedback from your coach over each quarter.</p>
        <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
      `;
      break;

    case "attendance-detail":
      main.innerHTML = `
        <h1>Attendance</h1>
        <p>Group sessions and one-to-one attendance data.</p>
        <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
      `;
      break;

    case "coach":
      main.innerHTML = `
        <h1>Coach Dashboard</h1>
        <p>View and manage players under your supervision.</p>
        <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
      `;
      break;

    case "admin":
      main.innerHTML = `
        <h1>Admin Panel</h1>
        <p>Manage golfers, sessions, and analytics system-wide.</p>
        <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
      `;
      break;

    case "correlations":
      main.innerHTML = `
        <h1>Correlations</h1>
        <p>Discover relationships between training variables.</p>
        <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
      `;
      break;

    case "trends":
      main.innerHTML = `
        <h1>Performance Trends</h1>
        <p>Visualise improvements and regressions across metrics.</p>
        <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
      `;
      break;

    default:
      renderGolferDashboard(currentGolfer);
      break;
  }
}

// Keep track of current golfer globally
let currentGolfer = null;

// Wrap renderGolferDashboard to update global golfer reference
const originalRender = renderGolferDashboard;
renderGolferDashboard = function (golfer) {
  currentGolfer = golfer;
  originalRender(golfer);
};

// === Easter Egg Button ===
function renderEggButton() {
  const egg = document.createElement("button");
  egg.textContent = "🥚";
  egg.id = "eggButton";
  egg.style.position = "fixed";
  egg.style.bottom = "12px";
  egg.style.right = "12px";
  egg.style.opacity = "0.3";
  egg.style.border = "none";
  egg.style.background = "transparent";
  egg.style.cursor = "pointer";

  egg.addEventListener("click", () => {
    alert("🐣 You found the hidden Easter Egg!");
  });

  document.body.appendChild(egg);
}
window.renderEggButton = renderEggButton;
renderEggButton();

// === Register Service Worker (optional) ===
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").then(
    () => console.log("✅ Service Worker registered"),
    (err) => console.warn("⚠️ Service Worker registration failed:", err)
  );
}

// === Final Log ===
console.log("✅ App.js loaded and initialized successfully.");
