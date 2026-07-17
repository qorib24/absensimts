const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

const additions = `
// === ABSENSI STAF ===
async function checkAbsenStafHariIni() {
    const t = new Date();
    const today = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const bulan = today.substring(0, 7);
    const stafId = window.currentUser.stafId || window.currentUser.uid;
    const sRef = ref(db, \`absensiStaf/\${bulan}/\${stafId}/\${today}\`);
    
    const snap = await get(sRef);
    const btn = document.getElementById('btn-absen-staf');
    const statusDiv = document.getElementById('staf-absensi-status');
    
    if (snap.exists()) {
        btn.disabled = true;
        btn.className = "bg-gray-400 text-white font-bold py-4 px-8 rounded-full shadow-md cursor-not-allowed";
        btn.innerHTML = '<i class="fas fa-check-circle mr-2 text-xl"></i> SUDAH ABSEN';
        statusDiv.innerHTML = '<p class="text-green-600 font-bold bg-green-100 py-2 px-4 rounded-lg inline-block">Anda sudah mencatat kehadiran hari ini.</p>';
    } else {
        btn.disabled = false;
        btn.className = "bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 px-8 rounded-full shadow-lg transform transition hover:scale-105";
        btn.innerHTML = '<i class="fas fa-fingerprint mr-2 text-xl"></i> HADIR HARI INI';
        statusDiv.innerHTML = '';
    }
}

window.absenStafHadir = async function() {
    try {
        showLoading();
        const t = new Date();
        const today = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        const bulan = today.substring(0, 7);
        const stafId = window.currentUser.stafId || window.currentUser.uid;
        
        const payload = {
            hadir: true,
            waktu: Date.now()
        };
        
        await set(ref(db, \`absensiStaf/\${bulan}/\${stafId}/\${today}\`), payload);
        writeLog('Absen Staf', \`Staf \${window.currentUser.nama} absen hadir hari ini\`);
        
        Swal.fire({icon: 'success', title: 'Berhasil', text: 'Kehadiran Anda berhasil dicatat!', showConfirmButton: false, timer: 1500});
        checkAbsenStafHariIni();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

window.loadRekapStaf = async function() {
    const bulan = document.getElementById('rstaf-bulan').value;
    const tbody = document.getElementById('rstaf-body');

    if(!bulan) return Swal.fire('Info', 'Bulan wajib diisi', 'info');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading...</td></tr>';

    const snap = await get(ref(db, \`absensiStaf/\${bulan}\`));
    let html = '';
    
    if(snap.exists()) {
        const data = snap.val();
        // data structure: { stafId: { tanggal: {hadir:true, waktu:123} } }
        
        for (const sId in window.appData.staf) {
            const stafInfo = window.appData.staf[sId];
            if (stafInfo.status !== 'aktif') continue;
            
            const hariHadir = data[sId] ? Object.keys(data[sId]).length : 0;
            const honorHari = stafInfo.honorHarian || 0;
            const totalGaji = hariHadir * honorHari;
            
            html += \`
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-2">\${stafInfo.nama}</td>
                    <td class="px-4 py-2">\${stafInfo.jabatan}</td>
                    <td class="px-4 py-2 text-center text-green-600 font-bold">\${hariHadir}</td>
                    <td class="px-4 py-2 text-right">Rp \${honorHari.toLocaleString('id-ID')}</td>
                    <td class="px-4 py-2 text-right font-bold text-teal-700">Rp \${totalGaji.toLocaleString('id-ID')}</td>
                </tr>
            \`;
        }
    }
    
    if(!html) html = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Tidak ada data rekap ditemukan.</td></tr>';
    tbody.innerHTML = html;
}

window.exportRekapStaf = function(type) {
    if(type === 'excel') {
        const wb = XLSX.utils.table_to_book(document.getElementById('table-rekap-staf'), {sheet:"Rekap Staf"});
        XLSX.writeFile(wb, \`Rekap_Gaji_Staf_\${document.getElementById('rstaf-bulan').value}.xlsx\`);
    }
}

// === GURU PENGGANTI KLAIM KELAS ===
window.populateDropdownsKlaim = function() {
    const kOpts = '<option value="">Pilih Kelas</option>' + Object.keys(window.appData.kelas).map(k => \`<option value="\${k}">\${window.appData.kelas[k].namaKelas}</option>\`).join('');
    if(document.getElementById('klaim-kelas-select')) document.getElementById('klaim-kelas-select').innerHTML = kOpts;
}

window.klaimKelas = function() {
    navigate('klaim-kelas');
}

window.lanjutKlaimKelas = async function() {
    const tanggal = document.getElementById('klaim-tanggal').value;
    const kelasId = document.getElementById('klaim-kelas-select').value;
    const slot = document.getElementById('klaim-slot').value;
    
    if(!tanggal || !kelasId || !slot) return Swal.fire('Info', 'Lengkapi semua isian', 'info');
    
    const hari = getDayName(tanggal);
    const jadwalSlot = window.appData.jadwal[hari]?.[kelasId]?.[slot];
    
    if (!jadwalSlot) {
        return Swal.fire('Error', 'Tidak ada jadwal pelajaran di kelas ini pada slot yang Anda pilih.', 'error');
    }
    
    // Check if original teacher is already absent or if it's already filled
    const absRef = ref(db, \`absensiHarian/\${tanggal}/\${kelasId}/\${slot}\`);
    const snap = await get(absRef);
    if(snap.exists()) {
        const d = snap.val();
        if(d.guruHadir) {
            return Swal.fire('Error', 'Guru utama sudah tercatat hadir untuk kelas ini!', 'error');
        }
        if(d.guruPenggantiId && d.guruPenggantiId !== window.currentUser.guruId) {
            return Swal.fire('Error', 'Kelas ini sudah diklaim oleh guru pengganti lain!', 'error');
        }
    }
    
    // Redirect to input absensi but prefill things
    navigate('input-absensi');
    
    setTimeout(() => {
        document.getElementById('abs-tanggal').value = tanggal;
        document.getElementById('abs-kelas').value = kelasId;
        document.getElementById('abs-slot').value = slot;
        checkJadwalAbsensi().then(() => {
            // Force set as Pengganti
            setTimeout(() => {
                const cbHadir = document.getElementById('abs-guru-hadir');
                if(cbHadir) {
                    cbHadir.checked = false;
                    toggleGuruPengganti();
                    document.getElementById('abs-guru-pengganti').value = window.currentUser.guruId;
                }
            }, 500);
        });
    }, 500);
}
`;

fs.writeFileSync('script.js', code + '\n' + additions, 'utf8');
console.log("Appended new functions to script.js");
