const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

// 1. window.appData
code = code.replace(
    /window\.appData = \{([\s\S]*?)mapel: \{\},\s*jadwal: \{\}\s*\};/,
    `window.appData = {$1mapel: {},\n    jadwal: {},\n    staf: {}\n};`
);

// 2. Login logic
code = code.replace(
    /if \(loggedIn\) \{\s*userData\.uid = uid;/,
    `
        if (!loggedIn) {
            const stafRef = ref(db, 'staf');
            const sSnap = await get(stafRef);
            if (sSnap.exists()) {
                const stafs = sSnap.val();
                for (const key in stafs) {
                    if (stafs[key].email === user.email) {
                        loggedIn = true;
                        const r = (stafs[key].jabatan || '').toLowerCase().includes('admin') ? 'admin' : 'staf';
                        userData = {
                            uid: key,
                            stafId: key,
                            nama: stafs[key].nama,
                            role: r,
                            jabatan: stafs[key].jabatan,
                            email: stafs[key].email
                        };
                        uid = key;
                        break;
                    }
                }
            }
        }
        if (loggedIn) {
            userData.uid = uid;`
);

// update login guru role assignment
code = code.replace(
    /role: 'guru',\s*email: gurus\[key\]\.email/,
    `role: 'guru',\n                        tipe: gurus[key].tipe || 'tetap',\n                        email: gurus[key].email`
);

// 3. initApp
code = code.replace(
    /if \(window\.currentUser\.role === 'admin'\) \{\s*navigate\('admin-dashboard'\);\s*\} else \{\s*navigate\('guru-dashboard'\);\s*\}/,
    `if (window.currentUser.role === 'admin') {
        navigate('admin-dashboard');
    } else if (window.currentUser.role === 'staf') {
        navigate('absensi-staf');
    } else {
        navigate('guru-dashboard');
    }`
);

// 4. renderMenu
code = code.replace(
    /html \+= createMenuItem\('crud-mapel', 'fa-book', 'Data Pelajaran'\);/,
    `html += createMenuItem('crud-mapel', 'fa-book', 'Data Pelajaran');\n        html += createMenuItem('crud-staf', 'fa-user-tie', 'Data Staf');`
);
code = code.replace(
    /html \+= createMenuItem\('rekap-guru', 'fa-file-invoice-dollar', 'Rekap Guru & Gaji'\);/,
    `html += createMenuItem('rekap-guru', 'fa-file-invoice-dollar', 'Rekap Guru & Gaji');\n        html += createMenuItem('rekap-staf', 'fa-file-invoice-dollar', 'Rekap Staf & Gaji');\n        html += createMenuItem('absensi-staf', 'fa-fingerprint', 'Absensi Kehadiran Saya');`
);
code = code.replace(
    /\} else if \(role === 'guru'\) \{([\s\S]*?)\}/,
    `} else if (role === 'staf') {
        html += createMenuItem('absensi-staf', 'fa-fingerprint', 'Absensi Kehadiran Saya');
    } else if (role === 'guru') {$1}`
);
code = code.replace(
    /html \+= createMenuItem\('input-absensi', 'fa-check-square', 'Isi Absensi'\);/,
    `if (window.currentUser.tipe === 'pengganti') { html += createMenuItem('klaim-kelas', 'fa-hand-paper', 'Ambil Kelas Pengganti'); }\n        html += createMenuItem('input-absensi', 'fa-check-square', 'Isi Absensi');`
);

// 5. navigate() modifications
code = code.replace(
    /const titles = \{siswa: 'Data Siswa', guru: 'Data Guru', kelas: 'Data Kelas', mapel: 'Data Pelajaran'\};/,
    `const titles = {siswa: 'Data Siswa', guru: 'Data Guru', kelas: 'Data Kelas', mapel: 'Data Pelajaran', staf: 'Data Staf'};`
);

let navAdds = `
        else if (action === 'rekap-staf') {
            await fetchMasterData(['staf']);
            document.getElementById('header-title').innerText = 'Rekap Staf & Gaji';
            showPage('page-rekap-staf');
            document.getElementById('rstaf-body').innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Pilih filter dan klik Cari</td></tr>';
        }
        else if (action === 'absensi-staf') {
            document.getElementById('header-title').innerText = 'Absensi Kehadiran';
            showPage('page-absensi-staf');
            if (typeof checkAbsenStafHariIni === 'function') await checkAbsenStafHariIni();
        }
        else if (action === 'klaim-kelas') {
            await fetchMasterData(['kelas', 'mapel', 'jadwal']);
            document.getElementById('header-title').innerText = 'Ambil Kelas Pengganti';
            showPage('page-klaim-kelas');
            if (typeof populateDropdownsKlaim === 'function') populateDropdownsKlaim();
        }
`;
code = code.replace(
    /else if \(action === 'rekap-guru'\) \{/,
    navAdds.trim() + '\n        else if (action === \'rekap-guru\') {'
);

// 6. renderCrudTable updates
code = code.replace(
    /else if \(type === 'kelas'\) headers = '<th>Nama Kelas<\/th>';/,
    `else if (type === 'kelas') headers = '<th>Nama Kelas</th>';\n    else if (type === 'staf') headers = '<th>Nama Staf</th><th>Jabatan</th><th>Honor/Hari</th><th>Status</th>';`
);

code = code.replace(
    /else if \(type === 'kelas'\) \{([\s\S]*?)cols = `<td>\$\{item.namaKelas\}<\/td>`;/,
    `else if (type === 'kelas') {\n            $1cols = \`<td>\${item.namaKelas}</td>\`;\n        } else if (type === 'staf') {\n            const statusColor = item.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';\n            cols = \`<td>\${item.nama}</td><td>\${item.jabatan}</td><td>Rp \${item.honorHarian}</td><td><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full \${statusColor}">\${item.status}</span></td>\`;`
);

// 7. openCrudModal updates
code = code.replace(
    /<input type="text" id="m-nama" placeholder="Nama Guru" required class="w-full border rounded p-2 mb-2" value="\$\{data\?data\.nama:''\}">/,
    `<input type="text" id="m-nama" placeholder="Nama Guru" required class="w-full border rounded p-2 mb-2" value="\${data?data.nama:''}">\n            <select id="m-tipe" class="w-full border rounded p-2 mb-2"><option value="tetap" \${data&&data.tipe==='tetap'?'selected':''}>Guru Tetap</option><option value="pengganti" \${data&&data.tipe==='pengganti'?'selected':''}>Guru Pengganti</option></select>`
);

code = code.replace(
    /else if \(type === 'kelas'\) \{/,
    `} else if (type === 'staf') {\n        html = \`\n            <input type="text" id="m-nama" placeholder="Nama Staf" required class="w-full border rounded p-2 mb-2" value="\${data?data.nama:''}">\n            <input type="text" id="m-jabatan" placeholder="Jabatan (ex: Kepala Sekolah, TU)" required class="w-full border rounded p-2 mb-2" value="\${data?data.jabatan:''}">\n            <input type="number" id="m-honor" placeholder="Honor Harian" required class="w-full border rounded p-2 mb-2" value="\${data?data.honorHarian:50000}">\n            <select id="m-status" class="w-full border rounded p-2 mb-2"><option value="aktif" \${data&&data.status==='aktif'?'selected':''}>Aktif</option><option value="nonaktif" \${data&&data.status==='nonaktif'?'selected':''}>Non-Aktif</option></select>\n            \${!data ? \`\n                <div class="mt-4 pt-4 border-t border-gray-200">\n                    <p class="text-sm font-medium text-gray-700 mb-2">Akun Login Staf</p>\n                    <input type="email" id="m-email" placeholder="Email Staf" required class="w-full border rounded p-2 mb-2">\n                    <input type="password" id="m-password" placeholder="Password" required class="w-full border rounded p-2 mb-2">\n                </div>\n            \` : ''}\n        \`;\n    } else if (type === 'kelas') {`
);

// 8. handleCrudSubmit
code = code.replace(
    /const id = isEdit \? editDataId : \(type==='kelas'\?'kelas'\+generateId\(\):type==='mapel'\?'mapel'\+generateId\(\):type==='siswa'\?'siswa'\+generateId\(\):'guru'\+generateId\(\)\);/,
    `const id = isEdit ? editDataId : (type==='kelas'?'kelas'+generateId():type==='mapel'?'mapel'+generateId():type==='siswa'?'siswa'+generateId():type==='staf'?'staf'+generateId():'guru'+generateId());`
);

code = code.replace(
    /} else if \(type === 'kelas'\) \{/,
    `} else if (type === 'staf') {
        payload = {
            nama: document.getElementById('m-nama').value,
            jabatan: document.getElementById('m-jabatan').value,
            honorHarian: parseInt(document.getElementById('m-honor').value),
            status: document.getElementById('m-status').value
        };
        if (isEdit) {
            const data = window.appData['staf'][id];
            payload.email = data.email;
        }
    } else if (type === 'kelas') {`
);

code = code.replace(
    /honorPerSesi: parseInt\(document\.getElementById\('m-honor'\)\.value\),/,
    `tipe: document.getElementById('m-tipe').value,
            honorPerSesi: parseInt(document.getElementById('m-honor').value),`
);

code = code.replace(
    /if \(type === 'guru' && !isEdit\) \{/,
    `if ((type === 'guru' || type === 'staf') && !isEdit) {`
);

fs.writeFileSync('script.js', code, 'utf8');
console.log("Patched script.js");
