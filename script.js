const STORAGE_KEY = "poliklinik-plani-data";
const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// ---------- Yardımcı fonksiyonlar ----------
function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${AY_ADLARI[m - 1]} ${y}`;
}

function seedData() {
  const polyclinics = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Poliklinik ${i + 1}`,
  }));
  const doctors = Array.from({ length: 15 }, (_, i) => ({
    id: `d${i + 1}`,
    name: `Doktor ${i + 1}`,
    eligible: [],
  }));
  doctors[2].eligible = ["p1", "p2"];
  doctors[6].eligible = ["p4", "p5"];
  doctors[9].eligible = ["p7", "p8"];
  return { doctors, polyclinics, assignments: {} };
}

// ---------- Veri yükle / kaydet ----------
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Veri okunamadı:", e);
  }
  return seedData();
}

let data = loadData();
let currentMonth = monthKey(new Date());

function save() {
  const statusEl = document.getElementById("saveStatus");
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    statusEl.textContent = "Kayıtlı";
  } catch (e) {
    statusEl.textContent = "Kaydedilemedi";
    console.error("Veri kaydedilemedi:", e);
  }
}

// ---------- Sekme geçişi ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---------- Ay navigasyonu ----------
document.getElementById("prevMonth").addEventListener("click", () => {
  currentMonth = shiftMonth(currentMonth, -1);
  renderBoard();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  currentMonth = shiftMonth(currentMonth, 1);
  renderBoard();
});
document.getElementById("copyPrevBtn").addEventListener("click", () => {
  const prevKey = shiftMonth(currentMonth, -1);
  const prev = data.assignments[prevKey];
  if (!prev) return;
  data.assignments[currentMonth] = { ...prev };
  save();
  renderBoard();
});

// ---------- Doktor ekleme ----------
document.getElementById("addDoctorBtn").addEventListener("click", addDoctor);
document.getElementById("newDoctorName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDoctor();
});

function addDoctor() {
  const input = document.getElementById("newDoctorName");
  const name = input.value.trim();
  if (!name) return;
  data.doctors.push({ id: `d${Date.now()}`, name, eligible: [] });
  save();
  input.value = "";
  renderDoctors();
  renderBoard();
}

// ---------- Poliklinik ekleme ----------
document.getElementById("addPolyBtn").addEventListener("click", addPoly);
document.getElementById("newPolyName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addPoly();
});

function addPoly() {
  const input = document.getElementById("newPolyName");
  const name = input.value.trim();
  if (!name) return;
  data.polyclinics.push({ id: `p${Date.now()}`, name });
  save();
  input.value = "";
  renderPolyclinics();
  renderBoard();
}

// ---------- Render: Aylık Plan ----------
function renderBoard() {
  document.getElementById("monthLabel").textContent = monthLabel(currentMonth);
  const monthAssignments = data.assignments[currentMonth] || {};

  // Doktor atama listesi
  const listEl = document.getElementById("doctorAssignList");
  listEl.innerHTML = "";

  if (data.doctors.length === 0) {
    listEl.innerHTML = `<p style="padding:24px;text-align:center;color:var(--text-faint);font-size:14px;">
      Henüz doktor eklenmedi. "Doktorlar" sekmesinden ekleyebilirsin.</p>`;
  }

  data.doctors.forEach((doc) => {
    const restricted = doc.eligible.length > 0;
    const options = restricted
      ? data.polyclinics.filter((p) => doc.eligible.includes(p.id))
      : data.polyclinics;

    const row = document.createElement("div");
    row.className = "assign-row";

    const nameSpan = document.createElement("div");
    nameSpan.className = "doc-name";
    nameSpan.innerHTML = `<span class="${restricted ? "lock-icon" : "unlock-icon"}">${restricted ? "&#128274;" : "&#128275;"}</span> ${escapeHtml(doc.name)}`;

    const select = document.createElement("select");
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "— Atanmadı —";
    select.appendChild(noneOpt);
    options.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (monthAssignments[doc.id] === p.id) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      const ma = data.assignments[currentMonth] || {};
      if (select.value) {
        ma[doc.id] = select.value;
      } else {
        delete ma[doc.id];
      }
      data.assignments[currentMonth] = ma;
      save();
      renderBoard();
    });

    row.appendChild(nameSpan);
    row.appendChild(select);
    listEl.appendChild(row);
  });

  // Poliklinik panosu
  const boardEl = document.getElementById("polyBoard");
  boardEl.innerHTML = "";
  let emptyCount = 0;

  data.polyclinics.forEach((p) => {
    const assignedDocs = data.doctors.filter((d) => monthAssignments[d.id] === p.id);
    const isEmpty = assignedDocs.length === 0;
    if (isEmpty) emptyCount++;

    const card = document.createElement("div");
    card.className = "poly-card" + (isEmpty ? " empty" : "");

    const bar = document.createElement("div");
    bar.className = "poly-card-bar";

    const body = document.createElement("div");
    body.className = "poly-card-body";

    const nameEl = document.createElement("p");
    nameEl.className = "poly-card-name";
    nameEl.textContent = p.name;
    body.appendChild(nameEl);

    if (assignedDocs.length > 0) {
      const ul = document.createElement("ul");
      assignedDocs.forEach((d) => {
        const li = document.createElement("li");
        li.textContent = d.name;
        ul.appendChild(li);
      });
      body.appendChild(ul);
    } else {
      const p2 = document.createElement("p");
      p2.className = "poly-empty-text";
      p2.textContent = "Doktor atanmadı";
      body.appendChild(p2);
    }

    card.appendChild(bar);
    card.appendChild(body);
    boardEl.appendChild(card);
  });

  const warnEl = document.getElementById("emptyWarning");
  if (emptyCount > 0) {
    warnEl.hidden = false;
    warnEl.textContent = `${emptyCount} poliklinikte bu ay hiç doktor atanmamış.`;
  } else {
    warnEl.hidden = true;
  }
}

// ---------- Render: Doktorlar ----------
function renderDoctors() {
  const listEl = document.getElementById("doctorEditList");
  listEl.innerHTML = "";

  data.doctors.forEach((doc) => {
    const card = document.createElement("div");
    card.className = "doctor-card";

    const top = document.createElement("div");
    top.className = "doctor-card-top";

    const nameInput = document.createElement("input");
    nameInput.className = "name-input";
    nameInput.value = doc.name;
    nameInput.addEventListener("input", () => {
      doc.name = nameInput.value;
      save();
      renderBoard();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.innerHTML = "&#10005;";
    delBtn.title = "Doktoru sil";
    delBtn.addEventListener("click", () => {
      data.doctors = data.doctors.filter((d) => d.id !== doc.id);
      Object.values(data.assignments).forEach((ma) => delete ma[doc.id]);
      save();
      renderDoctors();
      renderBoard();
    });

    top.appendChild(nameInput);
    top.appendChild(delBtn);

    const hint = document.createElement("p");
    hint.className = "eligible-hint";
    hint.textContent = "Çalışabileceği poliklinikler (hiçbiri seçilmezse hepsinde çalışabilir)";

    const chipRow = document.createElement("div");
    chipRow.className = "chip-row";
    data.polyclinics.forEach((p) => {
      const chip = document.createElement("button");
      const active = doc.eligible.includes(p.id);
      chip.className = "chip" + (active ? " active" : "");
      chip.textContent = p.name;
      chip.addEventListener("click", () => {
        if (doc.eligible.includes(p.id)) {
          doc.eligible = doc.eligible.filter((x) => x !== p.id);
        } else {
          doc.eligible.push(p.id);
        }
        save();
        renderDoctors();
        renderBoard();
      });
      chipRow.appendChild(chip);
    });

    card.appendChild(top);
    card.appendChild(hint);
    card.appendChild(chipRow);
    listEl.appendChild(card);
  });
}

// ---------- Render: Poliklinikler ----------
function renderPolyclinics() {
  const listEl = document.getElementById("polyEditList");
  listEl.innerHTML = "";

  data.polyclinics.forEach((p) => {
    const row = document.createElement("div");
    row.className = "poly-edit-row";

    const nameInput = document.createElement("input");
    nameInput.className = "name-input";
    nameInput.value = p.name;
    nameInput.addEventListener("input", () => {
      p.name = nameInput.value;
      save();
      renderBoard();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.innerHTML = "&#10005;";
    delBtn.title = "Polikliniği sil";
    delBtn.addEventListener("click", () => {
      data.polyclinics = data.polyclinics.filter((x) => x.id !== p.id);
      data.doctors.forEach((d) => {
        d.eligible = d.eligible.filter((x) => x !== p.id);
      });
      Object.values(data.assignments).forEach((ma) => {
        Object.keys(ma).forEach((docId) => {
          if (ma[docId] === p.id) delete ma[docId];
        });
      });
      save();
      renderPolyclinics();
      renderDoctors();
      renderBoard();
    });

    row.appendChild(nameInput);
    row.appendChild(delBtn);
    listEl.appendChild(row);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Başlangıç ----------
renderBoard();
renderDoctors();
renderPolyclinics();
