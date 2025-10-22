// --- Supabase Setup ---
const SUPABASE_URL = "https://syecffopasrwkjonwvdk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5ZWNmZm9wYXNyd2tqb253dmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NDgzNTYsImV4cCI6MjA3MzUyNDM1Nn0.JYAD7NaPrZWxTa_V2-jwQI_Kh7p4GaSKFRv65G7Czqs";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let session = null;
let currentGolfer = null;

// === INIT AUTH ===
async function initAuth() {
  const { data } = await supabase.auth.getSession();
  session = data?.session ?? null;
  updateAuthUI();

  if (session?.user?.id) {
    const golfer = await loadGolferFromDB(session.user.id);
    if (golfer) {
      renderGolferDashboard(golfer);
    }
  }

  supabase.auth.onAuthStateChange(async (_event, sess) => {
    session = sess;
    updateAuthUI();

    if (session?.user?.id) {
      const golfer = await loadGolferFromDB(session.user.id);
      if (golfer) {
        renderGolferDashboard(golfer);
      }
    } else {
      document.getElementById("appContainer").innerHTML = "";
      document.getElementById("login-splash").style.display = "flex";
    }
  });
}

// === UPDATE UI ON LOGIN ===
function updateAuthUI() {
  const splash = document.getElementById("login-splash");
  const main = document.getElementById("appContainer");
  if (session?.user) {
    splash.style.display = "none";
    main.style.display = "block";
  } else {
    splash.style.display = "flex";
    main.style.display = "none";
  }
}

// === LOAD GOLFER DATA ===
async function loadGolferFromDB(userId) {
  if (!userId) return null;
  try {
    const { data: base, error } = await supabase
      .from("golfers")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error) throw error;

    const { data: sg } = await supabase
      .from("sg_quarter")
      .select("*")
      .eq("user_id", userId);
    const { data: phys } = await supabase
      .from("phys_quarter")
      .select("*")
      .eq("user_id", userId);
    const { data: ratings } = await supabase
      .from("coach_ratings")
      .select("*")
      .eq("user_id", userId);
    const { data: attendance } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId);

    return { ...base, sg, phys, ratings, attendance };
  } catch (err) {
    console.error("loadGolferFromDB error:", err);
    return null;
  }
}

// === NAVIGATION HANDLER ===
function navTo(page) {
  if (!currentGolfer) return;
  switch (page) {
    case "hi-detail":
      renderHandicapDetail(currentGolfer);
      break;
    case "sg-detail":
      renderSGDetail(currentGolfer);
      break;
    case "physical-detail":
      renderPhysicalDetail(currentGolfer);
      break;
    case "coach-ratings-detail":
      renderCoachRatings(currentGolfer);
      break;
    case "attendance-detail":
      renderAttendance(currentGolfer);
      break;
    case "compare":
      renderCompare(currentGolfer);
      break;
    case "correlations":
      renderCorrelations(currentGolfer);
      break;
    case "trends":
      renderTrends(currentGolfer);
      break;
    case "coach":
      renderCoachDashboard();
      break;
    case "admin":
      renderAdminDashboard();
      break;
    default:
      renderGolferDashboard(currentGolfer);
  }
}

// === GOLFER DASHBOARD ===
function renderGolferDashboard(g) {
  currentGolfer = g;
  const main = document.getElementById("appContainer");
  if (!g || !main) return;

  const sgTotals = g.sg?.map((s) => s.total || 0) || [];
  const golferName = g.name ? g.name.split(" ")[0] : "Golfer";
  const nextUpdate = g.next_update || "TBD";

  main.innerHTML = `
    <section class="dashboard">
      <h1>Welcome, ${golferName}</h1>
      <div class="card">
        Next update due: <strong>${nextUpdate}</strong>
      </div>

      <div class="grid grid-3">
        <div class="card" onclick="navTo('hi-detail')">
          <div class="kpi">${fmt(g.hi || 0)}</div>
          <div class="muted">Handicap Index</div>
        </div>
        <div class="card" onclick="navTo('sg-detail')">
          <div class="sparkwrap">${spark(sgTotals, 280, 48, "spark")}</div>
          <div class="muted">Strokes Gained (${sgTotals.length} records)</div>
        </div>
        <div class="card" onclick="navTo('physical-detail')">
          <div class="kpi">${g.phys?.length || 0}</div>
          <div class="muted">Physical Metrics</div>
        </div>
        <div class="card" onclick="navTo('coach-ratings-detail')">
          <div class="kpi">${g.ratings?.length || 0}</div>
          <div class="muted">Coach Ratings</div>
        </div>
        <div class="card" onclick="navTo('attendance-detail')">
          <div class="kpi">${g.attendance?.length || 0}</div>
          <div class="muted">Attendance</div>
        </div>
      </div>

      <div class="grid grid-2 mt">
        <button onclick="navTo('compare')">Compare</button>
        <button onclick="navTo('correlations')">Correlations</button>
        <button onclick="navTo('trends')">Trends</button>
      </div>
    </section>
  `;
}

// === DETAIL VIEWS ===
function renderHandicapDetail(g) {
  document.getElementById("appContainer").innerHTML = `
    <section>
      <h2>Handicap History</h2>
      <div>${trendChart(g.sg?.map((x) => x.total || 0), "Handicap Trend")}</div>
      <button onclick="navTo('dashboard')">Back</button>
    </section>`;
}

function renderSGDetail(g) {
  const sg = g.sg || [];
  const main = document.getElementById("appContainer");
  main.innerHTML = `
    <section>
      <h2>Strokes Gained Breakdown</h2>
      <div>${trendChart(sg.map((x) => x.total), "Total SG")}</div>
      <table>
        <tr><th>Date</th><th>Total</th><th>Tee</th><th>Approach</th><th>Short</th><th>Putting</th></tr>
        ${sg
          .map(
            (r) =>
              `<tr><td>${r.d}</td><td>${fmt(r.total)}</td><td>${fmt(
                r.tee
              )}</td><td>${fmt(r.approach)}</td><td>${fmt(
                r.short
              )}</td><td>${fmt(r.putting)}</td></tr>`
          )
          .join("")}
      </table>
      <button onclick="navTo('dashboard')">Back</button>
    </section>`;
}

function renderPhysicalDetail(g) {
  const phys = g.phys || [];
  document.getElementById("appContainer").innerHTML = `
    <section>
      <h2>Physical Metrics</h2>
      <div>${trendChart(phys.map((x) => x.cmj || 0), "CMJ Over Time")}</div>
      <table>
        <tr><th>Date</th><th>CHS</th><th>Ball</th><th>CMJ</th><th>BJ</th></tr>
        ${phys
          .map(
            (r) =>
              `<tr><td>${r.d}</td><td>${fmt(r.chs)}</td><td>${fmt(
                r.ball
              )}</td><td>${fmt(r.cmj)}</td><td>${fmt(r.bj)}</td></tr>`
          )
          .join("")}
      </table>
      <button onclick="navTo('dashboard')">Back</button>
    </section>`;
}

function renderCoachRatings(g) {
  const data = g.ratings || [];
  document.getElementById("appContainer").innerHTML = `
    <section>
      <h2>Coach Ratings</h2>
      <table>
        <tr><th>Date</th><th>Holing</th><th>Short</th><th>Wedge</th><th>Flight</th><th>Plan</th></tr>
        ${data
          .map(
            (r) =>
              `<tr><td>${r.d}</td><td>${fmt(r.holing)}</td><td>${fmt(
                r.short
              )}</td><td>${fmt(r.wedge)}</td><td>${fmt(
                r.flight
              )}</td><td>${fmt(r.plan)}</td></tr>`
          )
          .join("")}
      </table>
      <button onclick="navTo('dashboard')">Back</button>
    </section>`;
}

function renderAttendance(g) {
  const data = g.attendance || [];
  document.getElementById("appContainer").innerHTML = `
    <section>
      <h2>Attendance Records</h2>
      <table>
        <tr><th>Date</th><th>Group</th><th>1:1</th></tr>
        ${data
          .map(
            (r) =>
              `<tr><td>${r.d}</td><td>${r.group_sess || 0}</td><td>${
                r.one1 || 0
              }</td></tr>`
          )
          .join("")}
      </table>
      <button onclick="navTo('dashboard')">Back</button>
    </section>`;
}

// === ANALYSIS PAGES ===
function renderCompare(g) {
  document.getElementById("appContainer").innerHTML = `
    <section>
      <h2>Performance Comparison</h2>
      <div>${scatterSVG(g.sg || [], g.phys || [], "SG vs Physical")}</div>
      <button onclick="navTo('dashboard')">Back</button>
    </section>`;
}

function renderCorrelations(g) {
  document.getElementById("appContainer").innerHTML = `
    <section>
      <h2>Correlations</h2>
      <div>${scatterSVG(g.sg || [], g.phys || [], "SG vs CMJ")}</div>
      <button onclick="navTo('dashboard')">Back</button>
    </section>`;
}

function renderTrends(g) {
  document.getElementById("appContainer").innerHTML = `
    <section>
      <h2>Trends</h2>
      <div>${trendChart(g.sg?.map((x) => x.total || 0), "Strokes Gained Trend")}</div>
      <div>${trendChart(g.phys?.map((x) => x.cmj || 0), "CMJ Trend")}</div>
      <button onclick="navTo('dashboard')">Back</button>
    </section>`;
}

// === COACH / ADMIN ===
function renderCoachDashboard() {
  document.getElementById("appContainer").innerHTML = `
    <section>
      <h2>Coach Dashboard</h2>
      <p>Player summaries and ratings appear here.</p>
      <button onclick="navTo('dashboard')">Back</button>
    </section>`;
}

function renderAdminDashboard() {
  document.getElementById("appContainer").innerHTML = `
    <section>
      <h2>Admin Dashboard</h2>
      <p>System metrics and management tools.</p>
      <button onclick="navTo('dashboard')">Back</button>
    </section>`;
}

// === UTILITIES ===
function fmt(v) {
  return (v || v === 0) ? Number(v).toFixed(1) : "-";
}

function spark(values, w, h) {
  if (!values.length) return "<svg></svg>";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const step = w / (values.length - 1);
  const pts = values
    .map(
      (v, i) => `${i * step},${h - ((v - min) / (max - min || 1)) * h}`
    )
    .join(" ");
  return `<svg width="${w}" height="${h}"><polyline fill="none" stroke="#4caf50" stroke-width="2" points="${pts}" /></svg>`;
}

function scatterSVG(sg, phys, title) {
  if (!sg.length || !phys.length) return `<div>No data for ${title}</div>`;
  const pts = sg
    .map((s, i) => {
      const cmj = phys[i]?.cmj || 0;
      return `<circle cx="${s.total * 10}" cy="${100 - cmj}" r="3" fill="#2196f3"/>`;
    })
    .join("");
  return `<svg width="300" height="120">${pts}</svg>`;
}

function trendChart(data, label) {
  if (!data.length) return `<div>No ${label} data</div>`;
  const w = 300,
    h = 120;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const step = w / (data.length - 1);
  const pts = data
    .map(
      (v, i) => `${i * step},${h - ((v - min) / (max - min || 1)) * h}`
    )
    .join(" ");
  return `<svg width="${w}" height="${h}"><polyline fill="none" stroke="#f39c12" stroke-width="2" points="${pts}" /></svg>`;
}

// === START APP ===
window.addEventListener("DOMContentLoaded", initAuth);
