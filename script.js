import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
    getDatabase, ref, set, get, update, remove, push, onValue, child
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import {
    getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// === FIREBASE CONFIGURATION ===
const firebaseConfig = {
    apiKey: "AIzaSyCPxfOmmqsb0lOcLl10JiEobZx7RAzKaZI",
    authDomain: "catatannomer-f2924.firebaseapp.com",
    databaseURL: "https://catatannomer-f2924-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "catatannomer-f2924",
    storageBucket: "catatannomer-f2924.firebasestorage.app",
    messagingSenderId: "200096420187",
    appId: "1:200096420187:web:28197e768a1126e26a8a7e",
    measurementId: "G-VL0H92KSQ7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

// === GLOBAL STATE ===
window.currentUser = null;
window.pengaturan = {
    tahunAjaranAktif: "2026-2027",
    semesterAktif: "semester1"
};
window.appData = {
    guru: {},
    siswa: {},
    kelas: {},
    mapel: {},
    jadwal: {}
};

let currentCrud = '';
// Removed unsubscribeCallbacks

// Expose to global so inline event handlers work
window.toggleSidebar = toggleSidebar;
window.logout = logout;
window.loadJadwal = loadJadwal;
window.closeCrudModal = closeCrudModal;
window.simpanAbsensi = simpanAbsensi;
window.setAllHadir = setAllHadir;
window.loadRekapSiswa = loadRekapSiswa;
window.exportRekapSiswa = exportRekapSiswa;
window.loadRekapGuru = loadRekapGuru;
window.exportRekapGuru = exportRekapGuru;
window.simpanPengaturanSemester = simpanPengaturanSemester;
window.promptResetSemester = promptResetSemester;

// === INITIALIZATION ===
document.addEventListener("DOMContentLoaded", () => {
    // Hide splash screen after 1.5s
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 500); // Wait for transition
        }
    }, 1500);

    cekLoginStatus();
    loadPengaturan();

    // Setup Login Form
    document.getElementById("form-login").addEventListener("submit", handleLogin);

    // Setup CRUD Search
    document.getElementById("crud-search").addEventListener("input", (e) => renderCrudTable(currentCrud, e.target.value, document.getElementById("crud-filter").value));
    document.getElementById("crud-filter").addEventListener("change", (e) => renderCrudTable(currentCrud, document.getElementById("crud-search").value, e.target.value));
    
    // Add Buttons
    document.getElementById("btn-add-crud").addEventListener("click", () => openCrudModal(currentCrud));
    document.getElementById("btn-add-crud-mobile").addEventListener("click", () => openCrudModal(currentCrud));
    document.getElementById("crud-form").addEventListener("submit", handleCrudSubmit);

    // Setup Absensi Listeners
    document.getElementById('abs-tanggal').addEventListener('change', checkJadwalAbsensi);
    document.getElementById('abs-kelas').addEventListener('change', checkJadwalAbsensi);
    document.getElementById('abs-slot').addEventListener('change', checkJadwalAbsensi);
    document.getElementById('abs-guru-hadir').addEventListener('change', toggleGuruPengganti);
    document.getElementById('abs-btn-hapus').addEventListener('click', hapusAbsensiHarian);

    const fileImportSiswa = document.getElementById('file-import-siswa');
    if (fileImportSiswa) {
        document.getElementById('btn-import-siswa').addEventListener('click', () => fileImportSiswa.click());
        document.getElementById('btn-import-siswa-mobile').addEventListener('click', () => fileImportSiswa.click());
        fileImportSiswa.addEventListener('change', handleImportSiswa);
    }

    // Load defaults for rekap
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('rs-bulan').value = currentMonth;
    document.getElementById('rg-bulan').value = currentMonth;
    document.getElementById('abs-tanggal').value = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
});

// === AUTHENTICATION ===
function cekLoginStatus() {
    const savedUser = localStorage.getItem('absensiUser');
    if (savedUser) {
        window.currentUser = JSON.parse(savedUser);
        initApp();
    } else {
        showPage('page-login');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-login");
    const uname = document.getElementById("login-username").value;
    const pass = document.getElementById("login-password").value;

    if (!uname || !pass) return alert("Email dan Password wajib diisi!");

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    // Hardcoded Admin
    if (uname === 'admin@mts.com' && pass === 'admin123') {
        const adminData = {
            uid: 'admin_hardcoded',
            nama: 'Administrator',
            role: 'admin',
            username: 'admin@mts.com'
        };
        window.currentUser = adminData;
        localStorage.setItem('absensiUser', JSON.stringify(adminData));
        initApp();
        btn.innerHTML = 'Masuk';
        btn.disabled = false;
        return;
    }

    try {
        // Login via Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, uname, pass);
        const user = userCredential.user;

        // Ambil data role dari Realtime Database berdasarkan email (node guru)
        const guruRef = ref(db, 'guru');
        const snapshot = await get(guruRef);
        let loggedIn = false;
        let userData = null;
        let uid = null;

        if (snapshot.exists()) {
            const gurus = snapshot.val();
            for (const key in gurus) {
                if (gurus[key].email === user.email) {
                    loggedIn = true;
                    userData = {
                        uid: key,
                        guruId: key,
                        nama: gurus[key].nama,
                        role: 'guru',
                        email: gurus[key].email
                    };
                    uid = key;
                    break;
                }
            }
        }

        if (loggedIn) {
            userData.uid = uid;
            window.currentUser = userData;
            localStorage.setItem('absensiUser', JSON.stringify(userData));
            initApp();
        } else {
            await signOut(auth);
            Swal.fire('Gagal Login', 'Akun Anda belum memiliki akses/role di Realtime Database.', 'error');
        }
    } catch (error) {
        Swal.fire('Gagal Login', 'Email atau Password salah.', 'error');
    }

    btn.innerHTML = 'Masuk';
    btn.disabled = false;
}

async function logout() {
    try {
        await signOut(auth);
    } catch (e) { console.error(e); }
    localStorage.removeItem('absensiUser');
    window.currentUser = null;
    showPage('page-login');
}

// === APP INITIALIZATION ===
function initApp() {
    document.getElementById("page-login").classList.add("hidden");
    document.getElementById("app-wrapper").classList.remove("hidden");
    
    document.getElementById("sidebar-name").innerText = window.currentUser.nama;
    document.getElementById("sidebar-role").innerText = window.currentUser.role.toUpperCase();

    renderMenu();
    // Removed loadMasterData() since we now fetch on demand

    if (window.currentUser.role === 'admin') {
        navigate('admin-dashboard');
    } else {
        navigate('guru-dashboard');
    }
}

function loadPengaturan() {
    const pRef = ref(db, 'pengaturan');
    onValue(pRef, (snapshot) => {
        if(snapshot.exists()) {
            window.pengaturan = {...window.pengaturan, ...snapshot.val()};
            document.getElementById('header-semester-info').innerText = `TA: ${window.pengaturan.tahunAjaranAktif} | ${window.pengaturan.semesterAktif.toUpperCase()}`;
            
            if(document.getElementById('sem-tahun')) {
                document.getElementById('sem-tahun').value = window.pengaturan.tahunAjaranAktif;
                document.getElementById('sem-semester').value = window.pengaturan.semesterAktif;
            }
        }
    });
}

async function fetchMasterData(keys) {
    const promises = keys.map(key => get(ref(db, key)));
    const results = await Promise.all(promises);
    results.forEach((snapshot, index) => {
        window.appData[keys[index]] = snapshot.exists() ? snapshot.val() : {};
    });
}

// === NAVIGATION & UI ===
function showPage(pageId) {
    document.querySelectorAll('.page-content, #page-login').forEach(el => el.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
}

function renderMenu() {
    const menu = document.getElementById("nav-menu");
    const role = window.currentUser.role;
    let html = '';

    if (role === 'admin') {
        html += createMenuItem('admin-dashboard', 'fa-home', 'Dashboard');
        html += '<p class="px-3 mt-4 mb-2 text-xs font-semibold text-teal-300 uppercase">Data Master</p>';
        html += createMenuItem('crud-siswa', 'fa-user-graduate', 'Data Siswa');
        html += createMenuItem('crud-guru', 'fa-chalkboard-teacher', 'Data Guru');
        html += createMenuItem('crud-kelas', 'fa-users-class', 'Data Kelas');
        html += createMenuItem('crud-mapel', 'fa-book', 'Data Pelajaran');
        html += createMenuItem('jadwal', 'fa-calendar-alt', 'Jadwal Pelajaran');
        html += '<p class="px-3 mt-4 mb-2 text-xs font-semibold text-teal-300 uppercase">Akademik & Laporan</p>';
        html += createMenuItem('input-absensi', 'fa-check-square', 'Absensi Siswa');
        html += createMenuItem('rekap-siswa', 'fa-chart-bar', 'Rekap Siswa');
        html += createMenuItem('rekap-guru', 'fa-file-invoice-dollar', 'Rekap Guru & Gaji');
        html += createMenuItem('semester', 'fa-cogs', 'Manajemen Semester');
    } else if (role === 'guru') {
        html += createMenuItem('guru-dashboard', 'fa-home', 'Dashboard Guru');
        html += createMenuItem('input-absensi', 'fa-check-square', 'Isi Absensi');
        // Fitur Riwayat/Rekap Guru bisa ditambahkan di sini jika perlu
    }

    menu.innerHTML = html;
}

function createMenuItem(action, icon, text) {
    return `<a href="#" onclick="navigate('${action}'); return false;" class="menu-item flex items-center px-3 py-2 text-sm font-medium rounded-lg text-teal-100 hover:bg-teal-700 hover:text-white transition-colors" data-action="${action}">
        <i class="fas ${icon} w-6 text-center mr-2"></i> ${text}
    </a>`;
}

window.navigate = async function(action) {
    if(window.innerWidth <= 768 && document.getElementById('sidebar').classList.contains('open')) {
        toggleSidebar();
    }
    
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('bg-teal-900', 'text-white'));
    const activeItem = document.querySelector(`.menu-item[data-action="${action}"]`);
    if(activeItem) activeItem.classList.add('bg-teal-900', 'text-white');

    currentCrud = '';
    showLoading();

    try {
        if (action === 'admin-dashboard') {
            await fetchMasterData(['siswa', 'guru', 'kelas', 'mapel']);
            document.getElementById('header-title').innerText = 'Dashboard Admin';
            showPage('page-admin-dashboard');
            await loadAdminDashboard();
        } 
        else if (action.startsWith('crud-')) {
            const type = action.replace('crud-', '');
            currentCrud = type;
            const needed = [type];
            if (type === 'siswa') needed.push('kelas');
            await fetchMasterData(needed);

            const titles = {siswa: 'Data Siswa', guru: 'Data Guru', kelas: 'Data Kelas', mapel: 'Data Pelajaran'};
            document.getElementById('header-title').innerText = titles[type];
            showPage('page-crud');
            
            if (type === 'siswa') {
                document.getElementById('btn-import-siswa').classList.remove('hidden');
                document.getElementById('btn-import-siswa-mobile').classList.remove('hidden');
            } else {
                document.getElementById('btn-import-siswa').classList.add('hidden');
                document.getElementById('btn-import-siswa-mobile').classList.add('hidden');
            }
            
            document.getElementById('crud-search').value = '';
            setupCrudFilter(type);
            renderCrudTable(type);
        }
        else if (action === 'jadwal') {
            currentCrud = 'jadwal';
            await fetchMasterData(['kelas', 'mapel', 'guru', 'jadwal']);
            document.getElementById('header-title').innerText = 'Jadwal Pelajaran';
            showPage('page-jadwal');
            populateDropdowns();
            loadJadwal();
        }
        else if (action === 'input-absensi') {
            await fetchMasterData(['kelas', 'jadwal', 'mapel', 'guru', 'siswa']);
            document.getElementById('header-title').innerText = 'Input Absensi';
            showPage('page-input-absensi');
            populateDropdowns();
            document.getElementById('abs-info-area').classList.add('hidden');
            document.getElementById('abs-siswa-area').classList.add('hidden');
        }
        else if (action === 'rekap-siswa') {
            await fetchMasterData(['kelas', 'mapel', 'siswa']);
            document.getElementById('header-title').innerText = 'Rekap Kehadiran Siswa';
            showPage('page-rekap-siswa');
            populateDropdowns();
            document.getElementById('rs-body').innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500">Pilih filter dan klik Cari</td></tr>';
        }
        else if (action === 'rekap-guru') {
            await fetchMasterData(['guru']);
            document.getElementById('header-title').innerText = 'Rekap Guru & Gaji';
            showPage('page-rekap-guru');
            populateDropdowns();
            document.getElementById('rg-body').innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Pilih filter dan klik Cari</td></tr>';
        }
        else if (action === 'semester') {
            document.getElementById('header-title').innerText = 'Manajemen Semester';
            showPage('page-semester');
            loadLogs();
        }
        else if (action === 'guru-dashboard') {
            await fetchMasterData(['mapel', 'kelas', 'jadwal']);
            document.getElementById('header-title').innerText = 'Dashboard Guru';
            showPage('page-guru-dashboard');
            await loadGuruDashboard();
        }
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'Gagal memuat data dari server.', 'error');
    }

    Swal.close();
}

// === UTILS ===
async function writeLog(aksi, detail) {
    const logsRef = ref(db, 'logs');
    await push(logsRef, {
        aksi: aksi,
        userId: window.currentUser.uid,
        namaUser: window.currentUser.nama,
        waktu: Date.now(),
        detail: detail
    });
}

function showLoading() {
    Swal.fire({
        title: 'Memproses...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// === DASHBOARD ADMIN ===
async function loadAdminDashboard() {
    const _tAdmin = new Date();
    const today = new Date(_tAdmin.getTime() - _tAdmin.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    
    document.getElementById('dash-total-siswa').innerText = Object.keys(window.appData.siswa).length;
    document.getElementById('dash-total-guru').innerText = Object.keys(window.appData.guru).length;
    document.getElementById('dash-total-kelas').innerText = Object.keys(window.appData.kelas).length;
    document.getElementById('dash-total-mapel').innerText = Object.keys(window.appData.mapel).length;

    // Hitung absensi hari ini
    const absRef = ref(db, `absensiHarian/${today}`);
    const snapshot = await get(absRef);
    let hadir = 0, alfa = 0;
    let guruHadirSet = new Set();
    let guruPenggantiSet = new Set();
    
    if (snapshot.exists()) {
        const data = snapshot.val();
        for (const kelas in data) {
            for (const slot in data[kelas]) {
                const sesi = data[kelas][slot];
                if (sesi.guruHadir && sesi.guruId) guruHadirSet.add(sesi.guruId);
                if (sesi.guruPenggantiId) guruPenggantiSet.add(sesi.guruPenggantiId);
                
                if (sesi.siswa) {
                    for (const siswaId in sesi.siswa) {
                        if (sesi.siswa[siswaId] === 'H') hadir++;
                        if (sesi.siswa[siswaId] === 'A') alfa++;
                    }
                }
            }
        }
    }
    document.getElementById('dash-siswa-hadir').innerText = hadir;
    document.getElementById('dash-siswa-alfa').innerText = alfa;
    document.getElementById('dash-guru-mengajar').innerText = guruHadirSet.size;
    document.getElementById('dash-guru-pengganti').innerText = guruPenggantiSet.size;

    // Estimasi Gaji Bulan ini
    const rekapGuruRef = ref(db, `rekapGuruBulanan/${currentMonth}`);
    const rgSnap = await get(rekapGuruRef);
    let totalGaji = 0;
    if (rgSnap.exists()) {
        const rgData = rgSnap.val();
        for (const gid in rgData) {
            totalGaji += rgData[gid].totalGaji || 0;
        }
    }
    document.getElementById('dash-total-gaji').innerText = 'Rp ' + totalGaji.toLocaleString('id-ID');
}

// === DASHBOARD GURU ===
function getDayName(dateString) {
    const days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
    const d = new Date(dateString);
    return days[d.getDay()];
}

async function loadGuruDashboard() {
    document.getElementById('gdash-nama').innerText = window.currentUser.nama;
    const guruId = window.currentUser.guruId;
    if(!guruId) return;

    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const _tGuru = new Date();
    const today = new Date(_tGuru.getTime() - _tGuru.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const hariIni = getDayName(today);

    // Load rekap bulanan
    const rgRef = ref(db, `rekapGuruBulanan/${currentMonth}/${guruId}`);
    const rgSnap = await get(rgRef);
    if (rgSnap.exists()) {
        const data = rgSnap.val();
        document.getElementById('gdash-sesi').innerText = data.jumlahMengajar || 0;
        document.getElementById('gdash-absen').innerText = data.jumlahTidakHadir || 0;
        document.getElementById('gdash-pengganti').innerText = data.jumlahSebagaiPengganti || 0;
        document.getElementById('gdash-honor').innerText = 'Rp ' + (data.totalGaji || 0).toLocaleString('id-ID');
    } else {
        document.getElementById('gdash-sesi').innerText = 0;
        document.getElementById('gdash-absen').innerText = 0;
        document.getElementById('gdash-pengganti').innerText = 0;
        document.getElementById('gdash-honor').innerText = 'Rp 0';
    }

    // Load jadwal hari ini
    const listHtml = document.getElementById('gdash-jadwal-list');
    listHtml.innerHTML = '';
    const jadwalHariIni = window.appData.jadwal[hariIni];
    let adaJadwal = false;

    if (jadwalHariIni) {
        for (const kelasId in jadwalHariIni) {
            for (const slot in jadwalHariIni[kelasId]) {
                const item = jadwalHariIni[kelasId][slot];
                if (item.guruId === guruId) {
                    adaJadwal = true;
                    const mapelName = window.appData.mapel[item.mapelId]?.namaMapel || 'Unknown';
                    const kelasName = window.appData.kelas[kelasId]?.namaKelas || 'Unknown';
                    const slotNames = {slot1: 'Slot 1', slot2: 'Slot 2', slot3: 'Slot 3'};
                    
                    listHtml.innerHTML += `
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div>
                                <p class="font-bold text-gray-800">${mapelName}</p>
                                <p class="text-sm text-gray-500">Kelas ${kelasName}</p>
                            </div>
                            <div class="text-right">
                                <span class="inline-block bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full font-medium mb-1">${slotNames[slot]}</span>
                            </div>
                        </div>
                    `;
                }
            }
        }
    }

    if (!adaJadwal) {
        listHtml.innerHTML = '<p class="text-gray-500 text-center py-4">Tidak ada jadwal mengajar hari ini.</p>';
    }
}

// === CRUD MODULE (SISWA, GURU, KELAS, MAPEL) ===
function setupCrudFilter(type) {
    const filter = document.getElementById('crud-filter');
    if (type === 'siswa') {
        filter.classList.remove('hidden');
        let opts = '<option value="all">Semua Kelas</option>';
        for(let k in window.appData.kelas) opts += `<option value="${k}">${window.appData.kelas[k].namaKelas}</option>`;
        filter.innerHTML = opts;
    } else {
        filter.classList.add('hidden');
    }
}

function renderCrudTable(type, searchQuery = '', filterValue = 'all') {
    const thead = document.getElementById('crud-table-head');
    const tbody = document.getElementById('crud-table-body');
    const empty = document.getElementById('crud-empty-state');
    
    thead.innerHTML = '';
    tbody.innerHTML = '';
    
    const dataObj = window.appData[type];
    if (!dataObj || Object.keys(dataObj).length === 0) {
        empty.classList.remove('hidden');
        return;
    }

    let items = Object.keys(dataObj).map(k => ({id: k, ...dataObj[k]}));
    
    // Filter & Search
    if (searchQuery) {
        searchQuery = searchQuery.toLowerCase();
        items = items.filter(item => (item.nama || item.namaKelas || item.namaMapel || '').toLowerCase().includes(searchQuery));
    }
    if (type === 'siswa' && filterValue !== 'all') {
        items = items.filter(item => item.kelasId === filterValue);
    }

    if (items.length === 0) {
        empty.classList.remove('hidden');
        return;
    } else {
        empty.classList.add('hidden');
    }

    // Headers
    let headers = '';
    if (type === 'siswa') headers = '<th>NIS</th><th>Nama</th><th>Kelas</th><th>Status</th>';
    else if (type === 'guru') headers = '<th>Nama Guru</th><th>No HP</th><th>Honor/Sesi</th><th>Status</th>';
    else if (type === 'kelas') headers = '<th>Nama Kelas</th>';
    else if (type === 'mapel') headers = '<th>Nama Pelajaran</th>';
    
    headers = `<tr>${headers.split('<th>').filter(x=>x).map(x => `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${x}`).join('')}<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th></tr>`;
    thead.innerHTML = headers;

    // Rows
    let rows = '';
    items.forEach(item => {
        let cols = '';
        if (type === 'siswa') {
            const className = window.appData.kelas[item.kelasId]?.namaKelas || '-';
            const statusColor = item.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
            cols = `<td>${item.nis}</td><td>${item.nama}</td><td>${className}</td><td><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${item.status}</span></td>`;
        } else if (type === 'guru') {
            const statusColor = item.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
            cols = `<td>${item.nama}</td><td>${item.noHp || '-'}</td><td>Rp ${item.honorPerSesi}</td><td><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${item.status}</span></td>`;
        } else if (type === 'kelas') {
            cols = `<td>${item.namaKelas}</td>`;
        } else if (type === 'mapel') {
            cols = `<td>${item.namaMapel}</td>`;
        }

        const btnClass = "text-gray-400 hover:text-teal-600 mx-1 focus:outline-none";
        rows += `
            <tr class="hover:bg-gray-50">
                ${cols.replace(/<td>/g, '<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">')}
                <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="editCrudData('${type}', '${item.id}')" class="${btnClass}"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteCrudData('${type}', '${item.id}', '${item.nama || item.namaKelas || item.namaMapel}')" class="text-gray-400 hover:text-red-600 mx-1 focus:outline-none"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rows;
}

let editDataId = null;
function openCrudModal(type, data = null) {
    editDataId = data ? data.id : null;
    document.getElementById('crud-modal-title').innerText = data ? `Edit ${type}` : `Tambah ${type}`;
    const body = document.getElementById('crud-modal-body');
    
    let html = '';
    if (type === 'siswa') {
        const kOpts = Object.keys(window.appData.kelas).map(k => `<option value="${k}" ${data&&data.kelasId===k?'selected':''}>${window.appData.kelas[k].namaKelas}</option>`).join('');
        html = `
            <input type="text" id="m-nis" placeholder="NIS" required class="w-full border rounded p-2 mb-2" value="${data?data.nis:''}">
            <input type="text" id="m-nama" placeholder="Nama Lengkap" required class="w-full border rounded p-2 mb-2" value="${data?data.nama:''}">
            <select id="m-kelas" required class="w-full border rounded p-2 mb-2"><option value="">Pilih Kelas</option>${kOpts}</select>
            <select id="m-status" class="w-full border rounded p-2 mb-2"><option value="aktif" ${data&&data.status==='aktif'?'selected':''}>Aktif</option><option value="nonaktif" ${data&&data.status==='nonaktif'?'selected':''}>Non-Aktif</option></select>
        `;
    } else if (type === 'guru') {
        html = `
            <input type="text" id="m-nama" placeholder="Nama Guru" required class="w-full border rounded p-2 mb-2" value="${data?data.nama:''}">
            <input type="text" id="m-nohp" placeholder="No HP" class="w-full border rounded p-2 mb-2" value="${data?data.noHp||'':''}">
            <input type="number" id="m-honor" placeholder="Honor Per Sesi" required class="w-full border rounded p-2 mb-2" value="${data?data.honorPerSesi:25000}">
            <select id="m-status" class="w-full border rounded p-2 mb-2"><option value="aktif" ${data&&data.status==='aktif'?'selected':''}>Aktif</option><option value="nonaktif" ${data&&data.status==='nonaktif'?'selected':''}>Non-Aktif</option></select>
            ${!data ? `
                <div class="mt-4 pt-4 border-t border-gray-200">
                    <p class="text-sm font-medium text-gray-700 mb-2">Akun Login Guru</p>
                    <input type="email" id="m-email" placeholder="Email Guru" required class="w-full border rounded p-2 mb-2">
                    <input type="password" id="m-password" placeholder="Password" required class="w-full border rounded p-2 mb-2">
                </div>
            ` : ''}
        `;
    } else if (type === 'kelas') {
        html = `
            <select id="m-tingkat" required class="w-full border rounded p-2 mb-2">
                <option value="">Pilih Tingkat Kelas</option>
                <option value="7" ${data&&data.tingkat==='7'?'selected':''}>Kelas 7</option>
                <option value="8" ${data&&data.tingkat==='8'?'selected':''}>Kelas 8</option>
                <option value="9" ${data&&data.tingkat==='9'?'selected':''}>Kelas 9</option>
            </select>
            <input type="text" id="m-nama" placeholder="Nama Rombel (ex: A, B, C)" required class="w-full border rounded p-2" value="${data&&data.rombel?data.rombel:data?data.namaKelas:''}">
        `;
    } else if (type === 'mapel') {
        html = `<input type="text" id="m-nama" placeholder="Nama Pelajaran" required class="w-full border rounded p-2" value="${data?data.namaMapel:''}">`;
    }
    
    body.innerHTML = html;
    document.getElementById('crud-modal').classList.remove('hidden');
}

window.editCrudData = function(type, id) {
    const data = window.appData[type][id];
    data.id = id;
    openCrudModal(type, data);
}

window.deleteCrudData = function(type, id, nameDisplay) {
    Swal.fire({
        title: 'Hapus Data?',
        text: `Anda yakin ingin menghapus ${nameDisplay}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Ya, Hapus!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await remove(ref(db, `${type}/${id}`));
                writeLog('Hapus ' + type, `Menghapus data ${type} dengan nama/ID: ${nameDisplay}`);
                
                await fetchMasterData([type]);
                if (currentCrud === type) renderCrudTable(type);
                if (type === 'kelas') populateDropdowns();
                
                Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success');
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    });
}

function closeCrudModal() {
    document.getElementById('crud-modal').classList.add('hidden');
}

async function handleCrudSubmit(e) {
    e.preventDefault();
    const type = currentCrud;
    const isEdit = !!editDataId;
    const id = isEdit ? editDataId : (type==='kelas'?'kelas'+generateId():type==='mapel'?'mapel'+generateId():type==='siswa'?'siswa'+generateId():'guru'+generateId());
    
    let payload = {};
    if (type === 'siswa') {
        payload = {
            nis: document.getElementById('m-nis').value,
            nama: document.getElementById('m-nama').value,
            kelasId: document.getElementById('m-kelas').value,
            status: document.getElementById('m-status').value
        };
    } else if (type === 'guru') {
        payload = {
            nama: document.getElementById('m-nama').value,
            noHp: document.getElementById('m-nohp').value,
            honorPerSesi: parseInt(document.getElementById('m-honor').value),
            status: document.getElementById('m-status').value
        };
        if (isEdit) {
            const data = window.appData['guru'][id];
            payload.email = data.email;
        }
    } else if (type === 'kelas') {
        const tingkat = document.getElementById('m-tingkat').value;
        const rombel = document.getElementById('m-nama').value;
        payload = { tingkat: tingkat, rombel: rombel, namaKelas: `${tingkat} ${rombel}` };
    } else if (type === 'mapel') {
        payload = { namaMapel: document.getElementById('m-nama').value };
    }

    try {
        if (type === 'guru' && !isEdit) {
            // Register Firebase Auth User first
            const gEmail = document.getElementById('m-email').value;
            const gPass = document.getElementById('m-password').value;
            
            showLoading();
            const userCred = await createUserWithEmailAndPassword(secondaryAuth, gEmail, gPass);
            await signOut(secondaryAuth);
            
            // Re-assign id to use Auth UID instead of generating one, so it's tied properly
            // wait, we can just use the generated id or auth uid. Let's stick to generated id 
            // and save email. The login logic checks email, so it's fine.
            payload.email = gEmail;
        }
        await set(ref(db, `${type}/${id}`), payload);
        writeLog(isEdit ? 'Edit ' + type : 'Tambah ' + type, `Menyimpan data ${type}: ${payload.nama || payload.namaKelas || payload.namaMapel}`);
        closeCrudModal();
        
        await fetchMasterData([type]);
        if (currentCrud === type) renderCrudTable(type);
        if (type === 'kelas') populateDropdowns();
        
        Swal.fire({toast:true, position:'top-end', icon:'success', title:'Data tersimpan', showConfirmButton:false, timer:1500});
    } catch (error) {
        Swal.fire('Error', error.message, 'error');
    }
}

// === JADWAL PELAJARAN ===
function populateDropdowns() {
    const kOpts = '<option value="">Pilih Kelas</option>' + Object.keys(window.appData.kelas).map(k => `<option value="${k}">${window.appData.kelas[k].namaKelas}</option>`).join('');
    if(document.getElementById('jadwal-filter-kelas')) document.getElementById('jadwal-filter-kelas').innerHTML = kOpts;
    if(document.getElementById('abs-kelas')) document.getElementById('abs-kelas').innerHTML = kOpts;
    if(document.getElementById('rs-kelas')) document.getElementById('rs-kelas').innerHTML = kOpts;

    const mOpts = '<option value="all">Semua Pelajaran</option>' + Object.keys(window.appData.mapel).map(k => `<option value="${k}">${window.appData.mapel[k].namaMapel}</option>`).join('');
    if(document.getElementById('rs-mapel')) document.getElementById('rs-mapel').innerHTML = mOpts;

    const gOpts = '<option value="all">Semua Guru</option>' + Object.keys(window.appData.guru).map(k => `<option value="${k}">${window.appData.guru[k].nama}</option>`).join('');
    if(document.getElementById('rg-guru')) document.getElementById('rg-guru').innerHTML = gOpts;

    const gpOpts = '<option value="">-- Pilih Guru Pengganti --</option>' + Object.keys(window.appData.guru).map(k => `<option value="${k}">${window.appData.guru[k].nama}</option>`).join('');
    if(document.getElementById('abs-guru-pengganti')) document.getElementById('abs-guru-pengganti').innerHTML = gpOpts;
}

function loadJadwal() {
    const hari = document.getElementById('jadwal-filter-hari').value;
    const kelasId = document.getElementById('jadwal-filter-kelas').value;
    const container = document.getElementById('jadwal-container');
    
    if(!kelasId) {
        container.innerHTML = '<p class="text-center text-gray-500 py-4">Pilih kelas terlebih dahulu</p>';
        return;
    }

    const jData = (window.appData.jadwal[hari] && window.appData.jadwal[hari][kelasId]) || {};
    
    let html = '';
    const slots = ['slot1', 'slot2', 'slot3'];
    const slotNames = ['Slot 1', 'Slot 2', 'Slot 3'];
    
    const mapelOpts = '<option value="">Kosong</option>' + Object.keys(window.appData.mapel).map(k => `<option value="${k}">${window.appData.mapel[k].namaMapel}</option>`).join('');
    const guruOpts = '<option value="">Pilih Guru</option>' + Object.keys(window.appData.guru).filter(k=>window.appData.guru[k].status==='aktif').map(k => `<option value="${k}">${window.appData.guru[k].nama}</option>`).join('');

    slots.forEach((slot, idx) => {
        const sData = jData[slot] || {mapelId:'', guruId:''};
        html += `
            <div class="mb-4 border rounded-lg p-4 bg-gray-50">
                <h4 class="font-semibold text-teal-700 mb-3 border-b pb-2">${slotNames[idx]}</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs text-gray-500 mb-1">Mata Pelajaran</label>
                        <select id="j-${slot}-mapel" class="w-full border rounded p-2 text-sm focus:ring-teal-500">
                            ${mapelOpts.replace(`value="${sData.mapelId}"`, `value="${sData.mapelId}" selected`)}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 mb-1">Guru Pengajar</label>
                        <select id="j-${slot}-guru" class="w-full border rounded p-2 text-sm focus:ring-teal-500">
                            ${guruOpts.replace(`value="${sData.guruId}"`, `value="${sData.guruId}" selected`)}
                        </select>
                    </div>
                </div>
            </div>
        `;
    });

    html += `<button onclick="simpanJadwal('${hari}', '${kelasId}')" class="w-full bg-teal-700 text-white py-2 rounded-lg font-medium mt-2 hover:bg-teal-800">Simpan Jadwal</button>`;
    container.innerHTML = html;
}

window.simpanJadwal = async function(hari, kelasId) {
    const payload = {};
    ['slot1', 'slot2', 'slot3'].forEach(slot => {
        const m = document.getElementById(`j-${slot}-mapel`).value;
        const g = document.getElementById(`j-${slot}-guru`).value;
        if(m && g) {
            payload[slot] = { mapelId: m, guruId: g };
        }
    });

    try {
        await update(ref(db, `jadwal/${hari}/${kelasId}`), payload);
        await fetchMasterData(['jadwal']);
        Swal.fire({toast:true, position:'top-end', icon:'success', title:'Jadwal tersimpan', showConfirmButton:false, timer:1500});
        writeLog('Edit Jadwal', `Mengubah jadwal hari ${hari} kelas ${window.appData.kelas[kelasId].namaKelas}`);
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

// === INPUT ABSENSI ===
let activeAbsensiData = null; // To track if we are editing existing
async function checkJadwalAbsensi() {
    const tanggal = document.getElementById('abs-tanggal').value;
    const kelasId = document.getElementById('abs-kelas').value;
    const slot = document.getElementById('abs-slot').value;

    const infoArea = document.getElementById('abs-info-area');
    const siswaArea = document.getElementById('abs-siswa-area');
    const btnHapus = document.getElementById('abs-btn-hapus');

    if (!tanggal || !kelasId || !slot) {
        infoArea.classList.add('hidden');
        siswaArea.classList.add('hidden');
        return;
    }

    // 1. Cek apakah ada jadwal di hari tersebut
    const hari = getDayName(tanggal);
    const jadwalSlot = window.appData.jadwal[hari]?.[kelasId]?.[slot];

    if (!jadwalSlot) {
        infoArea.classList.add('hidden');
        siswaArea.classList.add('hidden');
        Swal.fire('Info', 'Tidak ada jadwal pelajaran di slot ini pada hari tersebut.', 'info');
        return;
    }

    const mapel = window.appData.mapel[jadwalSlot.mapelId]?.namaMapel || '-';
    const guru = window.appData.guru[jadwalSlot.guruId]?.nama || '-';
    
    // Auth Check for Guru: only allow their own classes unless admin
    if (window.currentUser.role === 'guru' && jadwalSlot.guruId !== window.currentUser.guruId) {
        Swal.fire('Akses Ditolak', 'Anda bukan guru pengajar utama untuk mata pelajaran ini di jadwal tersebut.', 'error');
        return;
    }

    document.getElementById('abs-info-mapel').innerText = `Pelajaran: ${mapel}`;
    document.getElementById('abs-info-guru').innerText = `Guru Utama: ${guru}`;
    infoArea.classList.remove('hidden');

    // 2. Cek apakah absensi sudah diinput sebelumnya
    const absRef = ref(db, `absensiHarian/${tanggal}/${kelasId}/${slot}`);
    const snapshot = await get(absRef);
    
    let isEditing = false;
    activeAbsensiData = null;

    if (snapshot.exists()) {
        isEditing = true;
        activeAbsensiData = snapshot.val();
        document.getElementById('abs-status-badge').innerText = 'Sudah Diisi';
        document.getElementById('abs-status-badge').className = 'px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800';
        
        document.getElementById('abs-guru-hadir').checked = activeAbsensiData.guruHadir;
        document.getElementById('abs-guru-pengganti').value = activeAbsensiData.guruPenggantiId || '';
        toggleGuruPengganti();

        if(window.currentUser.role === 'admin') btnHapus.classList.remove('hidden');
    } else {
        document.getElementById('abs-status-badge').innerText = 'Belum Diisi';
        document.getElementById('abs-status-badge').className = 'px-2 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-700';
        
        document.getElementById('abs-guru-hadir').checked = true;
        document.getElementById('abs-guru-pengganti').value = '';
        toggleGuruPengganti();
        btnHapus.classList.add('hidden');
    }

    // 3. Render Siswa List
    const tbody = document.getElementById('abs-siswa-list');
    let rows = '';
    
    const siswaInClass = Object.keys(window.appData.siswa)
        .map(k => ({id:k, ...window.appData.siswa[k]}))
        .filter(s => s.kelasId === kelasId && s.status === 'aktif')
        .sort((a,b) => a.nama.localeCompare(b.nama));

    siswaInClass.forEach(s => {
        const val = isEditing ? (activeAbsensiData.siswa[s.id] || 'H') : 'H';
        const colors = {H:'bg-green-100', S:'bg-yellow-100', I:'bg-blue-100', A:'bg-red-100'};
        
        rows += `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-900">${s.nama}</td>
                <td class="px-4 py-2 text-center">
                    <select id="abs-s-${s.id}" onchange="this.className='w-20 text-center border rounded p-1 text-xs font-bold focus:outline-none ' + (${JSON.stringify(colors)})[this.value]" class="w-20 text-center border rounded p-1 text-xs font-bold focus:outline-none ${colors[val]}">
                        <option value="H" ${val==='H'?'selected':''}>H - Hadir</option>
                        <option value="S" ${val==='S'?'selected':''}>S - Sakit</option>
                        <option value="I" ${val==='I'?'selected':''}>I - Izin</option>
                        <option value="A" ${val==='A'?'selected':''}>A - Alfa</option>
                    </select>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rows;
    siswaArea.classList.remove('hidden');
}

function toggleGuruPengganti() {
    const isHadir = document.getElementById('abs-guru-hadir').checked;
    const area = document.getElementById('abs-pengganti-area');
    if (isHadir) {
        area.classList.add('hidden');
        document.getElementById('abs-guru-pengganti').value = '';
    } else {
        area.classList.remove('hidden');
    }
}

function setAllHadir() {
    document.querySelectorAll('select[id^="abs-s-"]').forEach(el => {
        el.value = 'H';
        el.className = 'w-20 text-center border rounded p-1 text-xs font-bold focus:outline-none bg-green-100';
    });
}

async function simpanAbsensi() {
    const tanggal = document.getElementById('abs-tanggal').value;
    const kelasId = document.getElementById('abs-kelas').value;
    const slot = document.getElementById('abs-slot').value;
    const guruHadir = document.getElementById('abs-guru-hadir').checked;
    const guruPenggantiId = document.getElementById('abs-guru-pengganti').value;

    if (!guruHadir && !guruPenggantiId && window.currentUser.role === 'admin') {
         // Admin is allowed to submit without replacement (just absent)
    } else if (!guruHadir && !guruPenggantiId) {
        return Swal.fire('Peringatan', 'Jika guru utama tidak hadir, mohon pilih guru pengganti.', 'warning');
    }

    const hari = getDayName(tanggal);
    const jadwalSlot = window.appData.jadwal[hari][kelasId][slot];
    
    // Gabungkan data kehadiran siswa
    const siswaData = {};
    document.querySelectorAll('select[id^="abs-s-"]').forEach(el => {
        const sId = el.id.replace('abs-s-', '');
        siswaData[sId] = el.value;
    });

    const tb = tanggal.substring(0, 7); // yyyy-mm

    const payload = {
        tanggal: tanggal,
        tahunBulan: tb,
        semester: window.pengaturan.semesterAktif,
        tahunAjaran: window.pengaturan.tahunAjaranAktif,
        kelasId: kelasId,
        mapelId: jadwalSlot.mapelId,
        guruId: jadwalSlot.guruId,
        guruHadir: guruHadir,
        guruPenggantiId: guruPenggantiId || "",
        diinputOleh: window.currentUser.uid,
        waktuInput: Date.now(),
        keterangan: "",
        siswa: siswaData
    };

    showLoading();
    try {
        // Jika sedang edit, kurangi data lama dari rekap dulu
        if (activeAbsensiData) {
            await adjustRekap(activeAbsensiData, -1);
        }

        // Simpan absensi harian
        await set(ref(db, `absensiHarian/${tanggal}/${kelasId}/${slot}`), payload);
        
        // Tambahkan ke rekap
        await adjustRekap(payload, 1);
        
        writeLog('Input Absensi', `Input absensi kelas ${window.appData.kelas[kelasId].namaKelas} tgl ${tanggal} slot ${slot}`);
        Swal.fire('Berhasil', 'Data absensi tersimpan', 'success');
        checkJadwalAbsensi(); // reload UI
    } catch (error) {
        Swal.fire('Error', error.message, 'error');
    }
}

async function hapusAbsensiHarian() {
    if(!activeAbsensiData) return;
    
    Swal.fire({
        title: 'Hapus Absensi?',
        text: 'Ini akan mengurangi rekap siswa dan guru (gaji) secara otomatis.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus'
    }).then(async (result) => {
        if(result.isConfirmed) {
            showLoading();
            try {
                // Kurangi dari rekap
                await adjustRekap(activeAbsensiData, -1);
                // Hapus node
                await remove(ref(db, `absensiHarian/${activeAbsensiData.tanggal}/${activeAbsensiData.kelasId}/${document.getElementById('abs-slot').value}`));
                
                writeLog('Hapus Absensi', `Menghapus absensi tgl ${activeAbsensiData.tanggal} kelas ${activeAbsensiData.kelasId}`);
                Swal.fire('Terhapus', 'Absensi berhasil dihapus', 'success');
                checkJadwalAbsensi();
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    });
}

// core function to update RekapSiswaBulanan & RekapGuruBulanan safely
async function adjustRekap(absData, multiplier) {
    const tb = absData.tahunBulan;
    const kelasId = absData.kelasId;
    const mapelId = absData.mapelId;
    
    // 1. Update Rekap Siswa
    const rsRef = ref(db, `rekapSiswaBulanan/${tb}/${kelasId}`);
    const rsSnap = await get(rsRef);
    let rsData = rsSnap.exists() ? rsSnap.val() : {};

    for (const siswaId in absData.siswa) {
        const status = absData.siswa[siswaId]; // H, S, I, A
        if (!rsData[siswaId]) rsData[siswaId] = {};
        if (!rsData[siswaId][mapelId]) rsData[siswaId][mapelId] = { H:0, S:0, I:0, A:0 };
        
        rsData[siswaId][mapelId][status] += (1 * multiplier);
        // Ensure no negative values
        if (rsData[siswaId][mapelId][status] < 0) rsData[siswaId][mapelId][status] = 0;
    }
    await set(rsRef, rsData);

    // 2. Update Rekap Guru & Gaji
    const rgRef = ref(db, `rekapGuruBulanan/${tb}`);
    const rgSnap = await get(rgRef);
    let rgData = rgSnap.exists() ? rgSnap.val() : {};

    // Helper init
    const initGuru = (gId) => {
        if(!rgData[gId]) rgData[gId] = { jumlahMengajar:0, jumlahTidakHadir:0, jumlahSebagaiPengganti:0, honorPerSesi:0, totalGaji:0 };
        rgData[gId].honorPerSesi = window.appData.guru[gId]?.honorPerSesi || 0;
    };

    // Update Guru Utama
    const gUtamaId = absData.guruId;
    initGuru(gUtamaId);
    
    if (absData.guruHadir) {
        rgData[gUtamaId].jumlahMengajar += (1 * multiplier);
        rgData[gUtamaId].totalGaji += (rgData[gUtamaId].honorPerSesi * multiplier);
    } else {
        rgData[gUtamaId].jumlahTidakHadir += (1 * multiplier);
    }

    // Update Guru Pengganti
    if (absData.guruPenggantiId) {
        const gPenggantiId = absData.guruPenggantiId;
        initGuru(gPenggantiId);
        rgData[gPenggantiId].jumlahSebagaiPengganti += (1 * multiplier);
        rgData[gPenggantiId].totalGaji += (rgData[gPenggantiId].honorPerSesi * multiplier);
    }

    // Clean negative
    for(let gId in rgData) {
        if(rgData[gId].jumlahMengajar < 0) rgData[gId].jumlahMengajar = 0;
        if(rgData[gId].jumlahTidakHadir < 0) rgData[gId].jumlahTidakHadir = 0;
        if(rgData[gId].jumlahSebagaiPengganti < 0) rgData[gId].jumlahSebagaiPengganti = 0;
        if(rgData[gId].totalGaji < 0) rgData[gId].totalGaji = 0;
    }

    await set(rgRef, rgData);
}

// === REKAP SISWA ===
async function loadRekapSiswa() {
    const bulan = document.getElementById('rs-bulan').value;
    const kelasId = document.getElementById('rs-kelas').value;
    const mapelId = document.getElementById('rs-mapel').value;
    const tbody = document.getElementById('rs-body');

    if(!bulan || !kelasId) return Swal.fire('Info', 'Bulan dan Kelas wajib dipilih', 'info');

    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading...</td></tr>';

    const snap = await get(ref(db, `rekapSiswaBulanan/${bulan}/${kelasId}`));
    let html = '';
    
    if(snap.exists()) {
        const data = snap.val();
        // data structure: { siswaId: { mapelId: {H,S,I,A} } }
        
        // Prepare list for sorting
        let list = [];
        for (const sId in data) {
            for (const mId in data[sId]) {
                if (mapelId === 'all' || mapelId === mId) {
                    list.push({
                        nama: window.appData.siswa[sId]?.nama || 'Unknown',
                        kelas: window.appData.kelas[kelasId]?.namaKelas || '-',
                        mapel: window.appData.mapel[mId]?.namaMapel || '-',
                        rekap: data[sId][mId]
                    });
                }
            }
        }

        list.sort((a,b) => a.nama.localeCompare(b.nama));

        list.forEach(item => {
            html += `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-2">${item.nama}</td>
                    <td class="px-4 py-2">${item.kelas}</td>
                    <td class="px-4 py-2">${item.mapel}</td>
                    <td class="px-4 py-2 text-center text-green-600 font-bold">${item.rekap.H}</td>
                    <td class="px-4 py-2 text-center text-yellow-500 font-bold">${item.rekap.S}</td>
                    <td class="px-4 py-2 text-center text-blue-500 font-bold">${item.rekap.I}</td>
                    <td class="px-4 py-2 text-center text-red-500 font-bold">${item.rekap.A}</td>
                </tr>
            `;
        });
    }

    if(!html) html = '<tr><td colspan="7" class="text-center py-4 text-gray-500">Tidak ada data rekap ditemukan.</td></tr>';
    tbody.innerHTML = html;
}

function exportRekapSiswa(type) {
    if(type === 'pdf') {
        const doc = new window.jspdf.jsPDF();
        doc.text("Rekap Kehadiran Siswa", 14, 15);
        doc.autoTable({ html: '#table-rekap-siswa', startY: 20 });
        doc.save(`Rekap_Siswa_${document.getElementById('rs-bulan').value}.pdf`);
    } else {
        const wb = XLSX.utils.table_to_book(document.getElementById('table-rekap-siswa'), {sheet:"Rekap"});
        XLSX.writeFile(wb, `Rekap_Siswa_${document.getElementById('rs-bulan').value}.xlsx`);
    }
}

// === REKAP GURU ===
async function loadRekapGuru() {
    const bulan = document.getElementById('rg-bulan').value;
    const guruIdFilter = document.getElementById('rg-guru').value;
    const tbody = document.getElementById('rg-body');

    if(!bulan) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading...</td></tr>';

    const snap = await get(ref(db, `rekapGuruBulanan/${bulan}`));
    let html = '';
    
    if(snap.exists()) {
        const data = snap.val();
        
        let list = [];
        for (const gId in data) {
            if (guruIdFilter === 'all' || guruIdFilter === gId) {
                list.push({
                    nama: window.appData.guru[gId]?.nama || 'Unknown',
                    ...data[gId]
                });
            }
        }

        list.sort((a,b) => a.nama.localeCompare(b.nama));

        list.forEach(item => {
            html += `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-2">${item.nama}</td>
                    <td class="px-4 py-2 text-center text-teal-700 font-bold">${item.jumlahMengajar}</td>
                    <td class="px-4 py-2 text-center text-blue-600 font-bold">${item.jumlahSebagaiPengganti}</td>
                    <td class="px-4 py-2 text-center text-red-500 font-bold">${item.jumlahTidakHadir}</td>
                    <td class="px-4 py-2 text-right">Rp ${item.honorPerSesi.toLocaleString('id-ID')}</td>
                    <td class="px-4 py-2 text-right font-bold text-gray-800">Rp ${item.totalGaji.toLocaleString('id-ID')}</td>
                </tr>
            `;
        });
    }

    if(!html) html = '<tr><td colspan="6" class="text-center py-4 text-gray-500">Tidak ada data rekap ditemukan.</td></tr>';
    tbody.innerHTML = html;
}

function exportRekapGuru(type) {
    if(type === 'pdf') {
        const doc = new window.jspdf.jsPDF();
        doc.text("Rekap Guru dan Gaji", 14, 15);
        doc.autoTable({ html: '#table-rekap-guru', startY: 20 });
        doc.save(`Rekap_Guru_${document.getElementById('rg-bulan').value}.pdf`);
    } else {
        const wb = XLSX.utils.table_to_book(document.getElementById('table-rekap-guru'), {sheet:"Rekap"});
        XLSX.writeFile(wb, `Rekap_Guru_${document.getElementById('rg-bulan').value}.xlsx`);
    }
}

// === MANAJEMEN SEMESTER ===
async function simpanPengaturanSemester() {
    const ta = document.getElementById('sem-tahun').value;
    const sem = document.getElementById('sem-semester').value;
    
    if(!ta) return alert('Tahun ajaran tidak boleh kosong');

    try {
        await update(ref(db, 'pengaturan'), {
            tahunAjaranAktif: ta,
            semesterAktif: sem
        });
        writeLog('Pengaturan', `Mengubah TA menjadi ${ta} ${sem}`);
        Swal.fire('Berhasil', 'Pengaturan semester disimpan.', 'success');
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

function promptResetSemester() {
    Swal.fire({
        title: 'Ketik "HAPUS SEMESTER"',
        text: 'Ini akan mengarsipkan lalu mengosongkan seluruh data absensi dan rekap pada database aktif.',
        input: 'text',
        inputPlaceholder: 'HAPUS SEMESTER',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Eksekusi',
        preConfirm: (val) => {
            if(val !== 'HAPUS SEMESTER') Swal.showValidationMessage('Teks tidak sesuai');
        }
    }).then(async (result) => {
        if(result.isConfirmed) {
            showLoading();
            try {
                const ta = window.pengaturan.tahunAjaranAktif;
                const sem = window.pengaturan.semesterAktif;

                // 1. Ambil data saat ini
                const snapAbs = await get(ref(db, 'absensiHarian'));
                const snapRS = await get(ref(db, 'rekapSiswaBulanan'));
                const snapRG = await get(ref(db, 'rekapGuruBulanan'));

                const arsipPayload = {
                    absensiHarian: snapAbs.exists() ? snapAbs.val() : {},
                    rekapSiswaBulanan: snapRS.exists() ? snapRS.val() : {},
                    rekapGuruBulanan: snapRG.exists() ? snapRG.val() : {},
                    diarsipkanPada: Date.now(),
                    diarsipkanOleh: window.currentUser.nama
                };

                // 2. Simpan ke arsip
                await update(ref(db, `arsipAbsensi/${ta}/${sem}`), arsipPayload);

                // 3. Hapus data aktif
                await remove(ref(db, 'absensiHarian'));
                await remove(ref(db, 'rekapSiswaBulanan'));
                await remove(ref(db, 'rekapGuruBulanan'));

                writeLog('Reset Semester', `Mengarsipkan dan mereset data absensi ${ta} ${sem}`);
                
                Swal.fire('Sukses', 'Data semester berhasil diarsip dan direset.', 'success');
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    });
}

function loadLogs() {
    const logsRef = ref(db, 'logs');
    // Fetch last 10 logs (simplified client side sort for now)
    get(logsRef).then(snap => {
        let html = '';
        if(snap.exists()) {
            const data = snap.val();
            const list = Object.values(data).sort((a,b) => b.waktu - a.waktu).slice(0, 10);
            
            list.forEach(log => {
                const d = new Date(log.waktu).toLocaleString('id-ID');
                html += `
                    <tr>
                        <td class="px-4 py-3 whitespace-nowrap text-gray-500">${d}</td>
                        <td class="px-4 py-3 whitespace-nowrap font-medium">${log.namaUser}</td>
                        <td class="px-4 py-3 whitespace-nowrap text-teal-700">${log.aksi}</td>
                        <td class="px-4 py-3">${log.detail}</td>
                    </tr>
                `;
            });
        } else {
            html = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Belum ada aktivitas.</td></tr>';
        }
        document.getElementById('log-body').innerHTML = html;
    });
}

// === IMPORT EXCEL ===
async function handleImportSiswa(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const excelData = XLSX.utils.sheet_to_json(firstSheet);
            
            if (excelData.length === 0) {
                Swal.fire('Info', 'Data kosong atau format salah.', 'info');
                return;
            }

            let successCount = 0;
            let failCount = 0;
            const updates = {};
            
            // Buat map kelas untuk pencarian ID kelas berdasarkan nama
            const kelasMap = {};
            for (let id in window.appData.kelas) {
                kelasMap[window.appData.kelas[id].namaKelas.toLowerCase().trim()] = id;
            }

            excelData.forEach(row => {
                if (row.NIS && row.Nama && row.Kelas) {
                    const kelasName = String(row.Kelas).trim().toLowerCase();
                    const kelasId = kelasMap[kelasName];
                    
                    if (kelasId) {
                        const newId = 'siswa' + generateId();
                        updates['siswa/' + newId] = {
                            nis: String(row.NIS),
                            nama: String(row.Nama),
                            kelasId: kelasId,
                            status: row.Status ? String(row.Status).toLowerCase() : 'aktif'
                        };
                        successCount++;
                    } else {
                        failCount++;
                    }
                } else {
                    failCount++;
                }
            });

            if (Object.keys(updates).length > 0) {
                // Since this is a module, we can just use the globally scoped update & ref 
                // wait, update and ref are imported at the top of script.js, so they are available in this scope!
                const { update, ref } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js');
                const { getDatabase } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js');
                const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js');
                
                // Wait, update and ref are ALREADY imported at line 3! We can just use them!
                // But this file is a module, so they are in scope.
                
                // Wait, db is also defined at the top. So we can just use `update(ref(db), updates)`
                
                await update(ref(db), updates);
                await writeLog('import', `Import ${successCount} data siswa`);
                
                await fetchMasterData(['siswa']);
                
                Swal.fire('Berhasil', `Import sukses: ${successCount} siswa.<br>Gagal/Dilewati: ${failCount} baris (cek kolom atau Kelas tidak ditemukan).`, 'success');
                renderCrudTable('siswa');
            } else {
                Swal.fire('Gagal', 'Tidak ada data valid untuk diimport. Pastikan kolom NIS, Nama, Kelas tersedia dan nama Kelas sama persis dengan sistem.', 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Gagal memproses file Excel.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    document.getElementById('file-import-siswa').value = '';
}

