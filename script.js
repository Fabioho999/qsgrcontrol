let currentSort = { key: null, order: 'asc' };
let currentPage = 1;
const rowsPerPage = 10;

function formatDateTimeLocalToDisplay(dtLocal) {
    const [date, time] = dtLocal.split('T');
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year} ${time}`;
}

function generateJustificativa(mission) {
    // Gera justificativa no formato solicitado pelo usuário
    const { evento, finalidade, destino } = mission;
    const amparoLegal = `Amparo legal: Decreto nº 11.002, de 20 de maio de 2022, e Diretriz do CMS.`;
    return `Evento: ${finalidade}
Atividade do Evento: Participar da/do ${finalidade}
Descrição: Participar da/do ${finalidade} na cidade de ${destino}
${amparoLegal}
Pré-Autorização conforme ${evento}`;
}

function readFileAsDataURL(fileInput) {
    return new Promise(resolve => {
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const maxFileSize = 2 * 1024 * 1024;
            if (file.size > maxFileSize) {
                alert('O arquivo excede o tamanho máximo permitido de 2 MB.');
                resolve('');
                return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        } else {
            resolve('');
        }
    });
}

function saveMissionsToStorage(missions) {
    try {
        localStorage.setItem('missions', JSON.stringify(missions));
    } catch { /* localStorage indisponível */ }
}
function loadMissionsFromStorage() {
    try {
        const data = localStorage.getItem('missions');
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function assignSequences() {
    const missions = loadMissionsFromStorage();
    const sorted = [...missions].sort((a, b) => a.dataIda.localeCompare(b.dataIda));
    const yearCount = {};
    const seqMap = {};
    sorted.forEach(m => {
        const year = m.dataIda.split('T')[0].split('-')[0];
        yearCount[year] = (yearCount[year] || 0) + 1;
        seqMap[m.id] = String(yearCount[year]).padStart(2, '00');
    });
    return seqMap;
}

function clearTable() {
    document.querySelector('#missionsTable tbody').innerHTML = '';
}

function calculateDays(start, end) {
    const date1 = new Date(start);
    const date2 = new Date(end);
    return Math.ceil((date2 - date1) / (1000 * 60 * 60 * 24));
}

function statusColor(status) {
    switch (status) {
        case 'Confeccionada': return 'status-confeccionada';
        case 'Assinada Cmt': return 'status-assinada';
        case 'Escaneada': return 'status-escaneada';
        case 'Enviada para Bda': return 'status-enviada';
        case 'Corrigir': return 'status-corrigir';
        case 'Ordem de Saque': return 'status-ordem';
        default: return '';
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function alertPending() {
    const missions = loadMissionsFromStorage();
    const now = new Date();
    const overdue = missions.some(m => m.status === 'Corrigir' && ((now - new Date(m.dataRetorno)) / (1000 * 60 * 60 * 24) > 3));
    if (overdue) alert('Há QSGRs em status "Corrigir" há mais de 3 dias.');
}

function paginate(data) {
    const totalPages = Math.ceil(data.length / rowsPerPage);
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return { pageData: data.slice(start, end), totalPages };
}

function renderPagination(totalPages) {
    const container = document.getElementById('pagination');
    container.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.classList.add('active');
        btn.addEventListener('click', () => { currentPage = i; refreshTable(); });
        container.appendChild(btn);
    }
}

function addMissionToTable(mission) {
    const tbody = document.querySelector('#missionsTable tbody');
    const tr = document.createElement('tr');
    const displayIda = formatDateTimeLocalToDisplay(mission.dataIda);
    const displayRet = formatDateTimeLocalToDisplay(mission.dataRetorno);
    const diffDays = calculateDays(mission.dataIda, mission.dataRetorno);
// transformar lista em array caso não esteja
const militaresArray = mission.militaresArray || mission.militares.split('\n').map(m => m.trim()).filter(m => m);
    const previewCount = 5;
    const previewList = militaresArray.slice(0, previewCount);
    const restanteCount = militaresArray.length - previewCount;
    const previewHtml = previewList.join('<br>');
    let militaresCellContent = previewHtml;
    if (restanteCount > 0) {
        militaresCellContent += `<br><button class="button-small show-all" data-id="${mission.id}">+${restanteCount} restantes</button>`;
    }
    const boletimIcon = mission.boletimFileData ? `<a href="${mission.boletimFileData}" download="boletim_${mission.id}.pdf">📄</a>` : '';
    const signedIcon = mission.signedQsgrFileData ? `<a href="${mission.signedQsgrFileData}" download="qsgr_assinada_${mission.id}.pdf">📜</a>` : '';
    const statusCls = statusColor(mission.status);
    tr.innerHTML = `
        <td>${mission.seq}</td>
        <td>${displayIda}</td>
        <td>${displayRet}</td>
        <td>${diffDays}</td>
        <td>${mission.diexNumber || ''}</td>
        <td>${mission.finalidade}</td>
        <td>${mission.destino}</td>
        <td class="militares-cell">${militaresCellContent}</td>
        <td>${mission.evento}</td>
        <td><select class="status-select ${statusCls}">
            <option value="Confeccionada" ${mission.status==='Confeccionada'?'selected':''}>Confeccionada</option>
            <option value="Assinada Cmt" ${mission.status==='Assinada Cmt'?'selected':''}>Assinada Cmt</option>
            <option value="Escaneada" ${mission.status==='Escaneada'?'selected':''}>Escaneada</option>
            <option value="Enviada para Bda" ${mission.status==='Enviada para Bda'?'selected':''}>Enviada para Bda</option>
            <option value="Corrigir" ${mission.status==='Corrigir'?'selected':''}>Corrigir</option>
            <option value="Ordem de Saque" ${mission.status==='Ordem de Saque'?'selected':''}>Ordem de Saque</option>
        </select></td>
        <td>${boletimIcon}</td>
        <td>${signedIcon}</td>
        <td>
            <button class="button-secondary button-small" onclick="viewJustificativa('${mission.id}')" aria-label="Visualizar justificativa">Justificativa</button>
            <button class="button-secondary button-small" onclick="editMission('${mission.id}')" aria-label="Editar missão">Editar</button>
            <button class="button-danger button-small" onclick="deleteMission('${mission.id}')" aria-label="Excluir missão">Excluir</button>
        </td>
    `;
    tr.querySelector('.status-select').addEventListener('change', (e) => {
        const newStatus = e.target.value;
        const missions = loadMissionsFromStorage();
        const idx = missions.findIndex(m => m.id === mission.id);
        if (idx > -1) {
            missions[idx].status = newStatus;
            saveMissionsToStorage(missions);
            refreshTable();
        }
    });
    tbody.appendChild(tr);
}

function sortData(data) {
    if (!currentSort.key) return data;
    return data.sort((a, b) => {
        let valA = a[currentSort.key];
        let valB = b[currentSort.key];
        if (currentSort.key === 'dias') {
            valA = calculateDays(a.dataIda, a.dataRetorno);
            valB = calculateDays(b.dataIda, b.dataRetorno);
        }
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        return valA < valB ? (currentSort.order === 'asc' ? -1 : 1) : valA > valB ? (currentSort.order === 'asc' ? 1 : -1) : 0;
    });
}

function refreshTable(filteredMissions) {
    clearTable();
    alertPending();
    const seqMap = assignSequences();
    let data = filteredMissions || loadMissionsFromStorage();
    currentPage = 1;
    data.forEach(m => { m.seq = seqMap[m.id] || '00'; });
    data = sortData(data);
    const { pageData, totalPages } = paginate(data);
    pageData.forEach(m => addMissionToTable(m));
    renderPagination(totalPages);
}

function applyFilters() {
    let missions = loadMissionsFromStorage();
    const startDate = document.getElementById('filterStart').value;
    const endDate = document.getElementById('filterEnd').value;
    const destinoFilter = document.getElementById('filterDestino').value.toLowerCase();
    const militarFilter = document.getElementById('filterMilitar').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    if (startDate) {
        const startMs = new Date(startDate + 'T00:00').getTime();
        missions = missions.filter(m => new Date(m.dataIda).getTime() >= startMs);
    }
    if (endDate) {
        const endMs = new Date(endDate + 'T23:59').getTime();
        missions = missions.filter(m => new Date(m.dataRetorno).getTime() <= endMs);
    }
    if (destinoFilter) missions = missions.filter(m => m.destino.toLowerCase().includes(destinoFilter));
    if (militarFilter) missions = missions.filter(m => m.militares.toLowerCase().includes(militarFilter));
    if (statusFilter) missions = missions.filter(m => m.status === statusFilter);
    refreshTable(missions);
}

function clearFilters() {
    document.getElementById('filterStart').value = '';
    document.getElementById('filterEnd').value = '';
    document.getElementById('filterDestino').value = '';
    document.getElementById('filterMilitar').value = '';
    document.getElementById('filterStatus').value = '';
    refreshTable();
}

function exportToCsv() {
    const missions = loadMissionsFromStorage();
    if (missions.length === 0) { alert('Nenhuma missão para exportar.'); return; }
    const seqMap = assignSequences();
    let csvContent = 'Seq;Data Ida;Data Retorno;Dias;DIEX nº;Finalidade;Destino;Militares;Evento;Status;Boletim Texto;QSGR Assinada;Observações\n';
    const sorted = [...missions].sort((a, b) => a.dataIda.localeCompare(b.dataIda));
    sorted.forEach(m => {
        const seq = seqMap[m.id] || '00';
        const displayIda = formatDateTimeLocalToDisplay(m.dataIda);
        const displayRet = formatDateTimeLocalToDisplay(m.dataRetorno);
        const diffDays = calculateDays(m.dataIda, m.dataRetorno);
        const diex = m.diexNumber || '';
        const militaresBr = m.militaresArray ? m.militaresArray.join(' | ') : m.militares.replace(/\n/g, ' | ');
        const boletimTxt = m.boletimText ? m.boletimText.replace(/\n/g, ' | ') : '';
        const signedTxt = m.signedQsgrFileData ? 'Sim' : '';
        const obs = m.observacoes ? m.observacoes.replace(/\n/g, ' | ') : '';
        csvContent += `${seq};${displayIda};${displayRet};${diffDays};${diex};${m.finalidade};${m.destino};${militaresBr};${m.evento};${m.status};${boletimTxt};${signedTxt};${obs}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'missions_qsgr.csv'; a.click(); URL.revokeObjectURL(url);
}

function deleteMission(id) {
    if (!confirm('Deseja realmente excluir esta missão?')) return;
    let missions = loadMissionsFromStorage();
    missions = missions.filter(m => m.id !== id);
    saveMissionsToStorage(missions);
    refreshTable();
}

function editMission(id) {
    const missions = loadMissionsFromStorage();
    const mission = missions.find(m => m.id === id);
    if (!mission) return;
    document.getElementById('modalTitle').textContent = 'Editar Missão';
    document.getElementById('missionId').value = mission.id;
    document.getElementById('dataIda').value = mission.dataIda;
    document.getElementById('dataRetorno').value = mission.dataRetorno;
    document.getElementById('diexNumber').value = mission.diexNumber || '';
    document.getElementById('finalidade').value = mission.finalidade;
    document.getElementById('destino').value = mission.destino;
    document.getElementById('militares').value = mission.militares;
    document.getElementById('evento').value = mission.evento;
    document.getElementById('status').value = mission.status;
    document.getElementById('boletimText').value = mission.boletimText || '';
    document.getElementById('observacoes').value = mission.observacoes || '';
    document.getElementById('boletimFile').value = '';
    document.getElementById('signedQsgrFile').value = '';
    openModal();
}

function viewJustificativa(id) {
    const missions = loadMissionsFromStorage();
    const mission = missions.find(m => m.id === id);
    if (!mission) return;
    const justificativa = generateJustificativa(mission);
    const justificativaWindow = window.open('', '_blank');
    if (!justificativaWindow) return;
    justificativaWindow.document.title = 'Justificativa QSGR';

    // Add styles
    const style = justificativaWindow.document.createElement('style');
    style.textContent = `
        body { font-family: Arial, sans-serif; padding: 2rem; }
        h2 { text-align: center; }
        pre { background: #f4f4f4; padding: 1rem; border-radius: 4px; white-space: pre-wrap; }
        button { margin-top: 1rem; display: block; margin-left: auto; margin-right: auto; }
    `;
    justificativaWindow.document.head.appendChild(style);

    // Add content
    const h2 = justificativaWindow.document.createElement('h2');
    h2.textContent = 'Justificativa QSGR';
    justificativaWindow.document.body.appendChild(h2);

    const pre = justificativaWindow.document.createElement('pre');
    pre.textContent = justificativa;
    justificativaWindow.document.body.appendChild(pre);

    // Add save button
    const saveBtn = justificativaWindow.document.createElement('button');
    saveBtn.textContent = 'Salvar Justificativa';
    saveBtn.onclick = function() {
        const blob = new Blob([justificativa], { type: 'text/plain;charset=utf-8' });
        const url = justificativaWindow.URL.createObjectURL(blob);
        const a = justificativaWindow.document.createElement('a');
        a.href = url;
        a.download = 'justificativa_qsgr.txt';
        justificativaWindow.document.body.appendChild(a);
        a.click();
        justificativaWindow.URL.revokeObjectURL(url);
        justificativaWindow.document.body.removeChild(a);
    };
    justificativaWindow.document.body.appendChild(saveBtn);

    justificativaWindow.focus();
}

const modalOverlay = document.getElementById('modalOverlay');
const openModalBtn = document.getElementById('openModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const headers = document.querySelectorAll('#missionsTable th[data-key]');

function openModal() {
    modalOverlay.style.display = 'flex';
    modalOverlay.setAttribute('aria-hidden', 'false');
}
function closeModal() {
    document.getElementById('missionForm').reset();
    document.getElementById('missionId').value = '';
    document.getElementById('modalTitle').textContent = 'Cadastrar Missão';
    modalOverlay.style.display = 'none';
    modalOverlay.setAttribute('aria-hidden', 'true');
}
openModalBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

headers.forEach(th => {
    th.addEventListener('click', () => {
        const key = th.getAttribute('data-key');
        if (currentSort.key === key) {
            currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.key = key;
            currentSort.order = 'asc';
        }
        headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(currentSort.order === 'asc' ? 'sort-asc' : 'sort-desc');
        refreshTable();
    });
});

async function handleFormSubmit(event) {
    event.preventDefault();
    const idField = document.getElementById('missionId').value;
    const dataIda = document.getElementById('dataIda').value;
    const dataRetorno = document.getElementById('dataRetorno').value;
    const diexNumber = document.getElementById('diexNumber').value.trim();
    const finalidade = document.getElementById('finalidade').value.trim();
    const destino = document.getElementById('destino').value.trim();
    const militaresText = document.getElementById('militares').value.trim();
    const militaresArray = militaresText.split('\n').map(m => m.trim()).filter(m => m);
    const evento = document.getElementById('evento').value;
    const status = document.getElementById('status').value;
    const boletimText = document.getElementById('boletimText').value.trim();
    const observacoes = document.getElementById('observacoes').value.trim();
    const boletimFileInput = document.getElementById('boletimFile');
    const signedFileInput = document.getElementById('signedQsgrFile');

    if (!dataIda || !dataRetorno || !finalidade || !destino || militaresArray.length === 0 || !evento || !status) {
        alert('Preencha todos os campos obrigatórios.');
        return;
    }
    if (new Date(dataIda) >= new Date(dataRetorno)) {
        alert('A data de ida deve ser anterior à data de retorno.');
        return;
    }

    const missions = loadMissionsFromStorage();
    const baseMissionObj = {
        id: idField || crypto.randomUUID(),
        dataIda,
        dataRetorno,
        diexNumber,
        finalidade,
        destino,
        militares: militaresText, // texto bruto
        militaresArray,            // array de militares
        evento,
        status,
        boletimText,
        observacoes,
        boletimFileData: '',
        signedQsgrFileData: ''
    };

    baseMissionObj.boletimFileData = await readFileAsDataURL(boletimFileInput);
    baseMissionObj.signedQsgrFileData = await readFileAsDataURL(signedFileInput);

    if (idField) {
        const index = missions.findIndex(m => m.id === idField);
        missions[index] = baseMissionObj;
        showToast('Missão atualizada com sucesso!');
    } else {
        missions.push(baseMissionObj);
        showToast('Missão cadastrada com sucesso!');
    }
    saveMissionsToStorage(missions);
    closeModal();
    refreshTable();
}

document.getElementById('missionForm').addEventListener('submit', handleFormSubmit);
document.getElementById('applyFilterBtn').addEventListener('click', applyFilters);
document.getElementById('clearFilterBtn').addEventListener('click', clearFilters);
document.getElementById('exportCsvBtn').addEventListener('click', exportToCsv);

document.addEventListener('DOMContentLoaded', () => {
    refreshTable();
    // Listener para botões '+X restantes' que exibem a lista completa
    document.body.addEventListener('click', (e) => {
        if (e.target.matches('.show-all')) {
            const id = e.target.getAttribute('data-id');
            const missions = loadMissionsFromStorage();
            const mission = missions.find(m => m.id === id);
            if (!mission) return;
            alert('Lista completa de militares:\n' + mission.militaresArray.join('\n'));
        }
    });
});
