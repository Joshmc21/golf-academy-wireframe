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
    .select('id, user_id, dob, hi, next_update, name')
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
    .select('id, d, total, tee, approach, short, putting, user_id')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (sgErr) console.error('loadGolferFromDB sg error:', sgErr);

  // 5) Coach ratings (assume column "rating")
  const { data: ratingRows, error: ratingErr } = await supabase
    .from('coach_ratings')
    .select('id, d, holing, short, wedge, flight, plan, user_id')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (ratingErr) console.error('loadGolferFromDB coach_ratings error:', ratingErr);

  // 6) Attendance (assume a row per attendance event)
  const { data: attendanceRows, error: attendanceErr } = await supabase
    .from('attendance')
    .select('id, d, group_sess, one1, user_id')
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
    total: toNum(r.total),
    tee: toNum(r.tee),
    approach: toNum(r.approach),
    short: toNum(r.short),
    putting: toNum(r.putting)
  }));

  const ratings = (ratingRows || []).map(r => {
    const values = [r.holing, r.short, r.wedge, r.flight, r.plan]
      .map(toNum)
      .filter(v => v != null);
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return avg;
  }).filter(v => v != null);

  const attendance = (attendanceRows || []).map(r => ({
    id: r.id,
    d: r.d,
    group_s: toNum(r.group_s),
    one1: toNum(r.one1),
  }));

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
      renderHIDetail(currentGolfer);
      break;

    case "sg-detail":
      renderSGDetail(currentGolfer);
      break;

    case "physical-detail":
      renderPhysicalDetail(currentGolfer);
      break;

    case "coach-ratings-detail":
      renderCoachRatingsDetail(currentGolfer);
      break;

    case "attendance-detail":
      renderAttendanceDetail(currentGolfer);
      break;

    default:
      renderGolferDashboard(currentGolfer);
  }
}

function renderHIDetail(golfer) {
  const main = document.querySelector("main");

  if (!golfer) {
    main.innerHTML = `
      <h1>Handicap Index</h1>
      <p>No golfer data available.</p>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    `;
    return;
  }

  // Defensive default
  const hi = golfer.hi ?? "—";

  // Optionally, if you have historical HI data later, 
  // you could map and display trends here.
  main.innerHTML = `
    <section>
      <h1>Handicap Index</h1>
      <p>Your current handicap index and improvement tracking.</p>
      
      <div class="card big">
        <div class="kpi">${fmt(hi)}</div>
        <div class="muted">Current Handicap Index</div>
      </div>

      <p style="margin-top:1em;">
        This represents your current performance-based handicap index as of your latest update.
      </p>

      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    </section>
  `;
}


function renderSGDetail(golfer) {
  const main = document.querySelector("main");
  if (!golfer || !golfer.sg?.length) {
    main.innerHTML = `
      <h1>Strokes Gained</h1>
      <p>No SG data available.</p>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    `;
    return;
  }

  const rows = golfer.sg.map(s => `
    <tr>
      <td>${s.d}</td>
      <td>${fmt(s.total)}</td>
      <td>${fmt(s.putting)}</td>
      <td>${fmt(s.tee)}</td>
      <td>${fmt(s.approach)}</td>
      <td>${fmt(s.short)}</td>
    </tr>
  `).join("");

  main.innerHTML = `
    <section>
      <h1>Strokes Gained</h1>
      <table class="data-table">
        <thead>
          <tr><th>Cycle</th><th>Total</th><th>Putting</th><th>Tee</th><th>Approach</th><th>Short</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    </section>
  `;
}

function renderPhysicalDetail(golfer) {
  const main = document.querySelector("main");
  if (!golfer || !golfer.phys?.length) {
    main.innerHTML = `
      <h1>Physical Metrics</h1>
      <p>No physical data available.</p>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    `;
    return;
  }

  const rows = golfer.phys.map(p => `
    <tr>
      <td>${p.d}</td>
      <td>${fmt(p.chs)}</td>
      <td>${fmt(p.ball)}</td>
      <td>${fmt(p.cmj)}</td>
      <td>${fmt(p.bj)}</td>
      <td>${fmt(p.height)}</td>
      <td>${fmt(p.weight)}</td>
    </tr>
  `).join("");

  main.innerHTML = `
    <section>
      <h1>Physical Metrics</h1>
      <table class="data-table">
        <thead>
          <tr><th>Cycle</th><th>CHS</th><th>Ball</th><th>CMJ</th><th>BJ</th><th>Height</th><th>Weight</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    </section>
  `;
}

function renderCoachRatingsDetail(golfer) {
  const main = document.querySelector("main");
  if (!golfer || !golfer.ratings?.length) {
    main.innerHTML = `
      <h1>Coach Ratings</h1>
      <p>No coach rating data available.</p>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    `;
    return;
  }

  const rows = golfer.ratings.map((r, i) => `
    <tr>
      <td>Cycle ${i + 1}</td>
      <td>${fmt(r)}</td>
    </tr>
  `).join("");

  main.innerHTML = `
    <section>
      <h1>Coach Ratings</h1>
      <table class="data-table">
        <thead><tr><th>Cycle</th><th>Average Rating</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    </section>
  `;
}

function renderAttendanceDetail(golfer) {
  const main = document.querySelector("main");
  if (!golfer || !golfer.attendance?.length) {
    main.innerHTML = `
      <h1>Attendance</h1>
      <p>No attendance data available.</p>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    `;
    return;
  }

  const rows = golfer.attendance.map(a => `
    <tr>
      <td>${a.d}</td>
      <td>${fmt(a.group_s)}</td>
      <td>${fmt(a.one1)}</td>
    </tr>
  `).join("");

  main.innerHTML = `
    <section>
      <h1>Attendance</h1>
      <table class="data-table">
        <thead><tr><th>Cycle</th><th>Group Sessions</th><th>1:1 Sessions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    </section>
  `;
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


// === PART 4: ADVANCED VIEWS (Compare, Correlations, Trends, Admin) ===

// --- Simple utilities reused from old version ---
function avg(arr) {
  if (!arr || !arr.length) return 0;
  const valid = arr.filter(x => typeof x === 'number' && !isNaN(x));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function stddev(arr) {
  const m = avg(arr);
  const variance = avg(arr.map(x => (x - m) ** 2));
  return Math.sqrt(variance);
}

function pearson(x, y) {
  if (!x || !y || x.length !== y.length) return 0;
  const mx = avg(x), my = avg(y);
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const den = Math.sqrt(x.reduce((s, xi) => s + (xi - mx) ** 2, 0)) *
              Math.sqrt(y.reduce((s, yi) => s + (yi - my) ** 2, 0));
  return den ? num / den : 0;
}

// --- Compare Page ---
function renderComparePage() {
  const main = document.querySelector("main");
  if (!currentGolfer) return (main.innerHTML = "<p>No golfer loaded.</p>");
  
  main.innerHTML = `
    <section>
      <h1>Compare Metrics</h1>
      <p>Compare your average stats with peers or targets.</p>
      <div class="grid grid-2">
        <div class="card"><strong>Average CHS:</strong> ${fmt(avg(currentGolfer.phys.map(x => x.chs)))}</div>
        <div class="card"><strong>Average SG Total:</strong> ${fmt(avg(currentGolfer.sg.map(x => x.total)))}</div>
        <div class="card"><strong>Average CMJ:</strong> ${fmt(avg(currentGolfer.phys.map(x => x.cmj)))}</div>
        <div class="card"><strong>Average Putting:</strong> ${fmt(avg(currentGolfer.sg.map(x => x.putting)))}</div>
      </div>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    </section>
  `;
}

// --- Correlations Page ---
function renderCorrelationsPage() {
  const main = document.querySelector("main");
  if (!currentGolfer) return (main.innerHTML = "<p>No golfer loaded.</p>");
  
  const sg = currentGolfer.sg || [];
  const phys = currentGolfer.phys || [];

  const corrCHS = pearson(
    phys.map(x => x.chs),
    sg.map(x => x.total)
  );

  const corrCMJ = pearson(
    phys.map(x => x.cmj),
    sg.map(x => x.total)
  );

  main.innerHTML = `
    <section>
      <h1>Correlations</h1>
      <p>See how your physical performance links to golf performance.</p>
      <table class="table">
        <tr><th>Metric</th><th>Correlation with SG Total</th></tr>
        <tr><td>Club Head Speed (CHS)</td><td>${fmt(corrCHS)}</td></tr>
        <tr><td>CMJ Jump</td><td>${fmt(corrCMJ)}</td></tr>
      </table>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    </section>
  `;
}

// --- Trends Page ---
function renderTrendsPage() {
  const main = document.querySelector("main");
  if (!currentGolfer) return (main.innerHTML = "<p>No golfer loaded.</p>");
  
  const sg = currentGolfer.sg || [];
  const phys = currentGolfer.phys || [];

  const sgTrend = sg.length > 1 ? sg[sg.length - 1].total - sg[0].total : 0;
  const chsTrend = phys.length > 1 ? phys[phys.length - 1].chs - phys[0].chs : 0;

  main.innerHTML = `
    <section>
      <h1>Performance Trends</h1>
      <p>Progress over time based on first and last records.</p>
      <div class="grid grid-2">
        <div class="card">
          <strong>Strokes Gained:</strong><br>
          ${fmt(sgTrend)} (${fmt(sg[0]?.total)} → ${fmt(sg.at(-1)?.total)})
        </div>
        <div class="card">
          <strong>Club Head Speed (CHS):</strong><br>
          ${fmt(chsTrend)} (${fmt(phys[0]?.chs)} → ${fmt(phys.at(-1)?.chs)})
        </div>
      </div>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    </section>
  `;
}

// --- Admin Page ---
function renderAdminPage() {
  const main = document.querySelector("main");
  main.innerHTML = `
    <section>
      <h1>Admin Dashboard</h1>
      <p>Manage golfers, data cycles, and compliance here.</p>
      <div class="grid grid-3">
        <div class="card" onclick="renderAdminUsers()">👤 Users</div>
        <div class="card" onclick="renderAdminCycles()">📅 Cycles</div>
        <div class="card" onclick="renderAdminCompliance()">✅ Compliance</div>
      </div>
      <button onclick="renderGolferDashboard(currentGolfer)">⬅️ Back</button>
    </section>
  `;
}

function renderAdminUsers() {
  const main = document.querySelector("main");
  main.innerHTML = `
    <section>
      <h1>All Golfers</h1>
      <p>Future: Pull full golfer list from Supabase 'golfers' table.</p>
      <button onclick="renderAdminPage()">⬅️ Back</button>
    </section>
  `;
}

function renderAdminCycles() {
  const main = document.querySelector("main");
  main.innerHTML = `
    <section>
      <h1>Cycles Management</h1>
      <p>Define or edit training cycles and update schedules.</p>
      <button onclick="renderAdminPage()">⬅️ Back</button>
    </section>
  `;
}

function renderAdminCompliance() {
  const main = document.querySelector("main");
  main.innerHTML = `
    <section>
      <h1>Compliance Overview</h1>
      <p>See who's overdue for performance updates.</p>
      <button onclick="renderAdminPage()">⬅️ Back</button>
    </section>
  `;
}

// --- Navigation Hook Additions ---
function navTo(view) {
  console.log("Navigating to:", view);
  switch (view) {
    case "hi-detail": renderHIDetail(currentGolfer); break;
    case "sg-detail": renderSGDetail(currentGolfer); break;
    case "physical-detail": renderPhysicalDetail(currentGolfer); break;
    case "coach-ratings-detail": renderRatingsDetail(currentGolfer); break;
    case "attendance-detail": renderAttendanceDetail(currentGolfer); break;
    case "compare": renderComparePage(); break;
    case "correlations": renderCorrelationsPage(); break;
    case "trends": renderTrendsPage(); break;
    case "admin": renderAdminPage(); break;
    default: renderGolferDashboard(currentGolfer);
  }
}
window.navTo = navTo;
