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


// ==== INIT SYSTEM ====
async function initAuth() {
  // 1️⃣ Try to restore session
  const { data } = await supabase.auth.getSession();
  session = data?.session ?? null;
  updateAuthUI();

  // 2️⃣ If already logged in, load golfer
  if (session?.user?.id) {
    console.log("🟢 Restored session for:", session.user.id);
    const golfer = await loadGolferFromDB(session.user.id);
    if (golfer) {
      setTimeout(() => {
        const main = document.querySelector("main");
        if (main) renderGolferDashboard(golfer);
        else console.warn("Main not ready yet when trying to render dashboard");
      }, 200);
    }
  }

  // 3️⃣ React to login/logout events
  supabase.auth.onAuthStateChange(async (_event, sess) => {
    session = sess;
    updateAuthUI();

    if (session?.user?.id) {
      console.log("🟢 Logged in, loading golfer for:", session.user.id);
      const golfer = await loadGolferFromDB(session.user.id);
      if (golfer) {
        setTimeout(() => {
          const main = document.querySelector("main");
          if (main) renderGolferDashboard(golfer);
          else console.warn("Main not ready yet when trying to render dashboard");
        }, 200);
      }
    } else {
      console.log("🔴 Logged out.");
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
    if (loginSheet) loginSheet.style.display = "flex";
    if (loginSplash) loginSplash.style.display = "flex";
  }
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
  const btnShowLoginPanel = document.getElementById("btnShowLogin");
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

// === Load golfer + related performance data (defensive, typed) ===
async function loadGolferFromDB(userId) {
  if (!userId) return null;

  // 1) Base golfer row (name is optional; we fall back to profiles)
  const { data: golferRow, error: golferErr } = await supabase
    .from('golfers')
    .select('id, user_id, name, hi, next_update')
    .eq('user_id', userId)
    .maybeSingle();

  if (golferErr) {
    console.error('loadGolferFromDB fatal (golfers):', golferErr);
    return null;
  }
  if (!golferRow) {
    console.warn('No golfer row for this user_id.');
    return null;
  }

  // 2) Profiles (optional – only if you keep names there)
  let profileName = null;
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();
  if (!profileErr && profileRow && profileRow.full_name) profileName = profileRow.full_name;

  // 3) Phys quarter (your screenshot shows columns: id, d, chs, ball, cmj, bj, height, weight, user_id)
  const { data: physRows, error: physErr } = await supabase
    .from('phys_quarter')
    .select('id, d, chs, ball, cmj, bj, height, weight, user_id')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (physErr) console.error('loadGolferFromDB phys error:', physErr);

  // 4) SG quarter (adjust column names if yours differ)
  // expected: sg_total, sg_putting, sg_tee, sg_approach, sg_short, d, user_id
  const { data: sgRows, error: sgErr } = await supabase
    .from('sg_quarter')
    .select('id, d, sg_total, sg_putting, sg_tee, sg_approach, sg_short, user_id')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (sgErr) console.error('loadGolferFromDB sg error:', sgErr);

  // 5) Coach ratings (assume column "rating")
  const { data: ratingRows, error: ratingErr } = await supabase
    .from('coach_ratings')
    .select('id, rating, created_at, user_id')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (ratingErr) console.error('loadGolferFromDB coach_ratings error:', ratingErr);

  // 6) Attendance (assume a row per attendance event)
  const { data: attendanceRows, error: attendanceErr } = await supabase
    .from('attendance')
    .select('id, date, user_id')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (attendanceErr) console.error('loadGolferFromDB attendance error:', attendanceErr);

  // Defensive: coerce numeric fields so later math is correct
  const toNum = v => (v == null || v === '' ? null : Number(v));

  const phys = (physRows || []).map(r => ({
    id: r.id,
    d: r.d,
    chs: toNum(r.chs),
    ball: toNum(r.ball),
    cmj: toNum(r.cmj),
    bj: toNum(r.bj),
    height: toNum(r.height),
    weight: toNum(r.weight)
  }));

  const sg = (sgRows || []).map(r => ({
    id: r.id,
    d: r.d,
    total: toNum(r.sg_total),
    putting: toNum(r.sg_putting),
    tee: toNum(r.sg_tee),
    approach: toNum(r.sg_approach),
    short: toNum(r.sg_short)
  }));

  const ratings = (ratingRows || []).map(r => toNum(r.rating)).filter(v => v != null);
  const attendance = attendanceRows || [];

  const result = {
    id: golferRow.id,
    user_id: golferRow.user_id,
    name: golferRow.name || profileName || null,
    hi: toNum(golferRow.hi),
    next_update: golferRow.next_update || null,
    phys,
    sg,
    ratings,
    attendance
  };

  console.log('Golfer + performance data loaded.', result);
  return result;
}

window.loadGolferFromDB = loadGolferFromDB;

// === Render Golfer Dashboard ===
function renderGolferDashboard(golfer) {
  currentGolfer = golfer;
  const main = document.querySelector("main");
  if (!golfer || !main) {
    console.warn("⚠️ No golfer or <main> found for rendering.");
    return;
  }

  // Defensive helpers
  const last = (arr) => (Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null);
  const avg = (arr) => {
    const nums = (arr || []).filter((v) => typeof v === "number" && !isNaN(v));
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  };
  const fmt1 = (n) => (n == null ? "—" : Number(n).toFixed(1));

  // Extract data safely
  const sgData = Array.isArray(golfer.sg) ? golfer.sg : [];
  const physData = Array.isArray(golfer.phys) ? golfer.phys : [];
  const ratingsData = Array.isArray(golfer.ratings) ? golfer.ratings : [];
  const attendanceData = Array.isArray(golfer.attendance) ? golfer.attendance : [];

  // Build metrics
  const sgTotals = sgData.map((s) => s.total || 0);
  const sgLatest = last(sgData);
  const sgLatestTotal = fmt1(sgLatest?.total);

  const physLatest = last(physData);
  const physCHS = fmt1(physLatest?.chs); // clubhead speed
  const physBall = fmt1(physLatest?.ball);

  const coachAvg = fmt1(avg(ratingsData));
  const attendCount = attendanceData.length;
  const hiValue = fmt1(golfer.hi);

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
          <div class="kpi">${hiValue}</div>
          <div class="muted">Handicap Index</div>
        </div>

        <div class="card" onclick="navTo('sg-detail')" title="Strokes Gained detail">
          <div class="sparkwrap">${spark(sgTotals, 280, 48, "spark")}</div>
          <div class="muted">Strokes Gained (${sgTotals.length} records) – Latest: ${sgLatestTotal}</div>
        </div>

        <div class="card" onclick="navTo('physical-detail')" title="Physical performance">
          <div class="kpi">${physCHS}</div>
          <div class="muted">Clubhead Speed (latest)</div>
        </div>

        <div class="card" onclick="navTo('coach-ratings-detail')" title="Coach ratings">
          <div class="kpi">${coachAvg}</div>
          <div class="muted">Avg Coach Rating</div>
        </div>

        <div class="card" onclick="navTo('attendance-detail')" title="Attendance">
          <div class="kpi">${fmt1(attendCount)}</div>
          <div class="muted">Sessions Attended</div>
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
