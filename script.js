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

function daysInMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
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
  return { doctors, polyclinics, assignments: {}, surgeryDays: {} };
}

// ---------- Veri yükle / kaydet ----------
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.surgeryDays) parsed.surgeryDays = {};
      if (!parsed.assignments) parsed.assignments = {};
      // Eski format kontrolü: assignments[ay][doktorId] = "p1" (düz string) ise
      // yeni format (gün > poliklinik > [doktorId,...]) ile uyumsuz, temizle.
      let isOldFormat = false;
      for (const mk in parsed.assignments) {
        const ma = parsed.assignments[mk];
        for (const k in ma) {
          if (typeof ma[k] === "string") isOldFormat = true;
        }
      }
      if (isOldFormat) parsed.assignments = {};
      return parsed;
    }
  } catch (e) {
    console.error("Veri okunamadı:", e);
  }
  return seedData();
}

let data = loadData();
let currentMonth = monthKey(new Date());
let surgeryMonth = monthKey(new Date());

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

// ---------- Aylık Plan ay navigasyonu ----------
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
  data.assignments[currentMonth] = JSON.parse(JSON.stringify(prev));
  save();
  renderBoard();
});

// ---------- Ameliyat günleri ay navigasyonu ----------
document.getElementById("prevSurgeryMonth").addEventListener("click", () => {
  surgeryMonth = shiftMonth(surgeryMonth, -1);
  renderSurgery();
});
document.getElementById("nextSurgeryMonth").addEventListener("click", () => {
  surgeryMonth = shiftMonth(surgeryMonth, 1);
  renderSurgery();
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
  renderSurgery();
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

// ---------- Render: Aylık Plan (gün x poliklinik) ----------
function renderBoard() {
  document.getElementById("monthLabel").textContent = monthLabel(currentMonth);
  const gridEl = document.getElementById("assignCalendar");
  gridEl.innerHTML = "";

  if (!data.assignments[currentMonth]) data.assignments[currentMonth] = {};
  const monthData = data.assignments[currentMonth];
  const total = daysInMonth(currentMonth);
  const ayAdi = monthLabel(currentMonth).split(" ")[0];

  if (data.polyclinics.length === 0) {
    gridEl.innerHTML = `<p style="padding:24px;text-align:center;color:var(--text-faint);font-size:14px;">
      Henüz poliklinik eklenmedi. "Poliklinikler" sekmesinden ekleyebilirsin.</p>`;
    return;
  }

  for (let day = 1; day <= total; day++) {
    if (!monthData[String(day)]) monthData[String(day)] = {};
    const dayData = monthData[String(day)];

    const card = document.createElement("div");
    card.className = "assign-day";

    const num = document.createElement("p");
    num.className = "assign-day-num";
    num.textContent = `${day} ${ayAdi}`;
    card.appendChild(num);

    data.polyclinics.forEach((poly) => {
      const assignedIds = dayData[poly.id] || [];

      const row = document.createElement("div");
      row.className = "assign-poly-row";

      const label = document.createElement("p");
      label.className = "assign-poly-name";
      label.textContent = poly.name;
      row.appendChild(label);

      const chips = document.createElement("div");
      chips.className = "assign-chips";
      assignedIds.forEach((docId) => {
        const doc = data.doctors.find((d) => d.id === docId);
        if (!doc) return;
        const chip = document.createElement("span");
        chip.className = "assign-chip";
        const nameSpan = document.createElement("span");
        nameSpan.textContent = doc.name;
        const rm = document.createElement("button");
        rm.innerHTML = "&#10005;";
        rm.addEventListener("click", () => {
          dayData[poly.id] = assignedIds.filter((id) => id !== docId);
          save();
          renderBoard();
        });
        chip.appendChild(nameSpan);
        chip.appendChild(rm);
        chips.appendChild(chip);
      });
      row.appendChild(chips);

      const select = document.createElement("select");
      const defOpt = document.createElement("option");
      defOpt.value = "";
      defOpt.textContent = "+ Doktor ekle";
      select.appendChild(defOpt);
      data.doctors
        .filter((d) => {
          if (assignedIds.includes(d.id)) return false;
          if (d.eligible.length === 0) return true;
          return d.eligible.includes(poly.id);
        })
        .forEach((d) => {
          const opt = document.createElement("option");
          opt.value = d.id;
          opt.textContent = d.name;
          select.appendChild(opt);
        });
      select.addEventListener("change", () => {
        if (!select.value) return;
        const cur = dayData[poly.id] || [];
        dayData[poly.id] = [...cur, select.value];
        save();
        renderBoard();
      });
      row.appendChild(select);

      card.appendChild(row);
    });

    gridEl.appendChild(card);
  }
}

// ---------- Render: Ameliyat Günleri ----------
function renderSurgery() {
  document.getElementById("surgeryMonthLabel").textContent = monthLabel(surgeryMonth);
  const gridEl = document.getElementById("surgeryCalendar");
  gridEl.innerHTML = "";

  if (!data.surgeryDays[surgeryMonth]) data.surgeryDays[surgeryMonth] = {};
  const monthData = data.surgeryDays[surgeryMonth];
  const total = daysInMonth(surgeryMonth);
  const ayAdi = monthLabel(surgeryMonth).split(" ")[0];

  for (let day = 1; day <= total; day++) {
    const dayIds = monthData[String(day)] || [];
    const cell = document.createElement("div");
    cell.className = "surgery-day" + (dayIds.length > 0 ? " has-surgery" : "");

    const num = document.createElement("p");
    num.className = "surgery-day-num";
    num.textContent = `${day} ${ayAdi}`;
    cell.appendChild(num);

    const chips = document.createElement("div");
    chips.className = "surgery-day-chips";
    dayIds.forEach((docId) => {
      const doc = data.doctors.find((d) => d.id === docId);
      if (!doc) return;
      const chip = document.createElement("span");
      chip.className = "surgery-chip";
      const nameSpan = document.createElement("span");
      nameSpan.textContent = doc.name;
      const rm = document.createElement("button");
      rm.innerHTML = "&#10005;";
      rm.addEventListener("click", () => {
        monthData[String(day)] = dayIds.filter((id) => id !== docId);
        save();
        renderSurgery();
      });
      chip.appendChild(nameSpan);
      chip.appendChild(rm);
      chips.appendChild(chip);
    });
    cell.appendChild(chips);

    const select = document.createElement("select");
    const defOpt = document.createElement("option");
    defOpt.value = "";
    defOpt.textContent = "+ Doktor ekle";
    select.appendChild(defOpt);
    data.doctors
      .filter((d) => !dayIds.includes(d.id))
      .forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.name;
        select.appendChild(opt);
      });
    select.addEventListener("change", () => {
      if (!select.value) return;
      const cur = monthData[String(day)] || [];
      monthData[String(day)] = [...cur, select.value];
      save();
      renderSurgery();
    });
    cell.appendChild(select);

    gridEl.appendChild(cell);
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
      renderSurgery();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.innerHTML = "&#10005;";
    delBtn.title = "Doktoru sil";
    delBtn.addEventListener("click", () => {
      data.doctors = data.doctors.filter((d) => d.id !== doc.id);
      Object.values(data.assignments).forEach((monthData) => {
        Object.values(monthData).forEach((dayData) => {
          Object.keys(dayData).forEach((polyId) => {
            dayData[polyId] = dayData[polyId].filter((id) => id !== doc.id);
          });
        });
      });
      Object.values(data.surgeryDays).forEach((monthData) => {
        Object.keys(monthData).forEach((day) => {
          monthData[day] = monthData[day].filter((id) => id !== doc.id);
        });
      });
      save();
      renderDoctors();
      renderBoard();
      renderSurgery();
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
      Object.values(data.assignments).forEach((monthData) => {
        Object.values(monthData).forEach((dayData) => {
          delete dayData[p.id];
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

// ---------- Başlangıç ----------
renderBoard();
renderSurgery();
renderDoctors();
renderPolyclinics();
