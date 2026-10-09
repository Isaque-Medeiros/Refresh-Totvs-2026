const TOTVSApp = (() => {
    const runtime = {
        state: null,
        currentUser: null,
        visibleMachines: [],
        timerViewInterval: null,
        localClockInterval: null,
        toastTimeout: null,
        entryCardTouched: false,
        checklistMachineId: null
    };

    const MANUAL_STEP_INPUTS = [
        { input: 'inputManualStep1', step: '1 FORMATAÇÃO E BIOS' },
        { input: 'inputManualStep2', step: '2 WINDOWS UPDATE' },
        { input: 'inputManualStep3', step: '3 ATIVAR ADM E SUBIR DRIVERS' },
        { input: 'inputManualStep4', step: '4 DOMINIO E ARGUS' }
    ];

    function el(id) {
        return document.getElementById(id);
    }

    function bySelector(selector) {
        return Array.from(document.querySelectorAll(selector));
    }

    function slugify(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function now() {
        return new Date();
    }

    function syncState(processTimers = false) {
        runtime.state = processTimers
            ? TOTVSStorage.processRunningTimers()
            : TOTVSStorage.loadState();
        runtime.currentUser = TOTVSStorage.getCurrentUser(runtime.state);
        runtime.visibleMachines = runtime.currentUser
            ? TOTVSStorage.getVisibleMachines(runtime.state, runtime.currentUser)
            : [];
    }

    function formatDuration(seconds) {
        const total = Number(seconds || 0);
        const hrs = Math.floor(total / 3600);
        const mins = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function getLiveMachine(machine) {
        if (!machine || !machine.timerRunning || machine.status !== 'EM_ANDAMENTO' || !machine.lastTickAt) {
            return machine;
        }

        const deltaSeconds = Math.max(0, Math.floor((Date.now() - new Date(machine.lastTickAt).getTime()) / 1000));
        if (!deltaSeconds) {
            return machine;
        }

        const stepDurations = { ...machine.stepDurations };
        if (!TOTVSStorage.isStepFinished(machine.currentStep)) {
            stepDurations[machine.currentStep] = Number(stepDurations[machine.currentStep] || 0) + deltaSeconds;
        }

        return {
            ...machine,
            stepDurations,
            totalElapsedSeconds: Number(machine.totalElapsedSeconds || 0) + deltaSeconds
        };
    }

    function showToast(message, icon = 'i') {
        const toast = el('toastNotification');
        const iconEl = el('toastIcon');
        const messageEl = el('toastMessage');
        if (!toast || !iconEl || !messageEl) {
            return;
        }

        iconEl.innerText = icon;
        messageEl.innerText = message;
        toast.classList.add('show');

        if (runtime.toastTimeout) {
            clearTimeout(runtime.toastTimeout);
        }

        runtime.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    function updateLocalClock() {
        const timeEl = el('localLiveClock');
        const dateEl = el('localLiveDate');
        const current = now();
        if (timeEl) {
            timeEl.innerText = current.toLocaleTimeString('pt-BR');
        }
        if (dateEl) {
            dateEl.innerText = current.toLocaleDateString('pt-BR');
        }
    }

    function startLocalClock() {
        updateLocalClock();
        if (runtime.localClockInterval) {
            clearInterval(runtime.localClockInterval);
        }
        runtime.localClockInterval = setInterval(updateLocalClock, 1000);
    }

    function getDataset() {
        return TOTVSStorage.getDatasetById(runtime.state, runtime.state.activeDatasetId);
    }

    function getDatasetLabel() {
        const dataset = getDataset();
        return dataset ? dataset.name : 'Operacao Principal';
    }

    function getScopeSummary() {
        if (!runtime.currentUser) {
            return 'Sem sessao ativa.';
        }

        if (runtime.currentUser.role === 'manager') {
            return 'Gerente com acesso aos dados gerais e aos arquivos individuais de todos os analistas.';
        }

        return `Analista com acesso restrito aos registros do usuario ${runtime.currentUser.displayName}.`;
    }

    function setRoleVisibility() {
        const isManager = runtime.currentUser && runtime.currentUser.role === 'manager';
        bySelector('.manager-only').forEach((node) => {
            node.classList.toggle('hidden-by-role', !isManager);
        });

        const generalExportBtn = el('btnDownloadGeneralJson');
        if (generalExportBtn) {
            generalExportBtn.classList.toggle('hidden', !isManager);
        }
    }

    function populateLoginUsers() {
        syncState();
        const select = el('loginUsername');
        if (!select) {
            return;
        }

        const users = runtime.state.users.filter((user) => user.active);
        select.innerHTML = users
            .map((user) => `<option value="${user.username}">${user.displayName} (${user.username})</option>`)
            .join('');
    }

    function ownerLabel(user) {
        return user.role === 'manager' ? `${user.displayName} (gerente)` : user.displayName;
    }

    function keepCurrentValue(select, html) {
        const previous = select.value;
        select.innerHTML = html;
        if (previous && Array.from(select.options).some((option) => option.value === previous)) {
            select.value = previous;
        }
    }

    function populateAnalystOptions() {
        const analysts = TOTVSStorage.getAnalystUsers(runtime.state);
        const owners = TOTVSStorage.getResponsibleUsers(runtime.state);
        const selectAnalyst = el('selectAnalyst');
        const filterAnalyst = el('filterAnalyst');
        const reportAnalyst = el('reportAnalystSelect');
        const resetTarget = el('resetTargetUser');
        const isManager = runtime.currentUser && runtime.currentUser.role === 'manager';

        if (selectAnalyst) {
            keepCurrentValue(selectAnalyst, owners
                .map((owner) => `<option value="${owner.id}">${ownerLabel(owner)}</option>`)
                .join(''));
        }

        if (filterAnalyst) {
            const analystOptions = isManager
                ? ['<option value="ALL">Todos os responsáveis</option>', ...owners.map((owner) => `<option value="${owner.id}">${ownerLabel(owner)}</option>`)]
                : [`<option value="${runtime.currentUser.id}">${runtime.currentUser.displayName}</option>`];
            keepCurrentValue(filterAnalyst, analystOptions.join(''));
        }

        if (reportAnalyst) {
            const reportOptions = runtime.currentUser.role === 'manager'
                ? ['<option value="ALL">Todos os analistas</option>', ...analysts.map((analyst) => `<option value="${analyst.id}">${analyst.displayName}</option>`)]
                : [`<option value="${runtime.currentUser.id}">${runtime.currentUser.displayName}</option>`];
            reportAnalyst.innerHTML = reportOptions.join('');
        }

        if (resetTarget) {
            resetTarget.innerHTML = analysts
                .map((analyst) => `<option value="${analyst.id}">${analyst.displayName}</option>`)
                .join('');
        }

        const exportAnalyst = el('selectExportAnalyst');
        if (exportAnalyst) {
            exportAnalyst.innerHTML = analysts.length
                ? analysts
                    .map((analyst) => `<option value="${analyst.id}">${analyst.displayName}</option>`)
                    .join('')
                : '<option value="">Nenhum analista cadastrado</option>';
        }

        populateFilterOptions(owners);
    }

    // Opcoes de status/ordenacao e do analista do lote. Ficam aqui para que as
    // duas telas usem exatamente a mesma lista (TOTVSFilters).
    function populateFilterOptions(owners) {
        const statusSelect = el('filterStatus');
        if (statusSelect) {
            keepCurrentValue(statusSelect, TOTVSFilters.statusOptionsHtml(statusSelect.value || 'ALL'));
        }

        const sortSelect = el('sortMachines');
        if (sortSelect) {
            keepCurrentValue(sortSelect, TOTVSFilters.sortOptionsHtml(sortSelect.value || 'updatedAt'));
        }

        const bulkAnalyst = el('selectBulkAnalyst');
        if (bulkAnalyst) {
            const list = Array.from(owners || TOTVSStorage.getResponsibleUsers(runtime.state));
            keepCurrentValue(bulkAnalyst, ['<option value="">(não alterar)</option>', ...list
                .map((owner) => `<option value="${owner.id}">${ownerLabel(owner)}</option>`)].join(''));
        }
    }

    function populateDatasetSelect() {
        const select = el('selectDataset');
        if (!select) {
            return;
        }

        select.innerHTML = runtime.state.datasets
            .map((dataset) => `<option value="${dataset.id}">${dataset.name}</option>`)
            .join('');
        select.value = runtime.state.activeDatasetId;
    }

    function applyUserDefaultsToForm() {
        const selectAnalyst = el('selectAnalyst');
        if (!selectAnalyst || !runtime.currentUser) {
            return;
        }

        if (runtime.currentUser.role === 'manager') {
            selectAnalyst.disabled = false;
        } else {
            selectAnalyst.value = runtime.currentUser.id;
            selectAnalyst.disabled = true;
        }
    }

    function resetForm() {
        const form = el('machineForm');
        if (!form) {
            return;
        }

        form.reset();
        el('editMachineId').value = '';
        el('inputHostnames').disabled = false;
        el('inputHostnames').rows = 3;
        el('inputProcessDate').value = TOTVSStorage.todayBrInput();
        el('checkAutoStartTimer').checked = true;
        el('errorDetailsContainer').classList.add('hidden');
        el('containerAutoTimer').classList.remove('hidden');
        el('checkManualEntry').checked = false;
        MANUAL_STEP_INPUTS.forEach((entry) => {
            el(entry.input).value = '';
        });
        el('manualTimesContainer').classList.add('hidden');
        updateManualTotal();
        el('submitBtnText').innerText = 'Salvar / adicionar maquinas';
        el('btnSubmitForm').classList.remove('btn-primary');
        el('btnSubmitForm').classList.add('btn-success');

        applyUserDefaultsToForm();
    }

    function getManualStepSeconds() {
        const seconds = {};
        MANUAL_STEP_INPUTS.forEach((entry) => {
            const minutes = Number(el(entry.input).value || 0);
            seconds[entry.step] = Math.max(0, Math.round(minutes * 60));
        });
        return seconds;
    }

    function getManualTotalSeconds() {
        return MANUAL_STEP_INPUTS.reduce((sum, entry) => {
            return sum + Math.max(0, Math.round(Number(el(entry.input).value || 0) * 60));
        }, 0);
    }

    function updateManualTotal() {
        const label = el('manualTotalLabel');
        if (label) {
            label.innerText = formatDuration(getManualTotalSeconds());
        }
    }

    function toggleManualTimeFields() {
        const isManual = el('checkManualEntry').checked;
        el('manualTimesContainer').classList.toggle('hidden', !isManual);
        el('containerAutoTimer').classList.toggle('hidden', isManual);

        if (isManual) {
            el('checkAutoStartTimer').checked = false;
        } else {
            el('checkAutoStartTimer').checked = true;
            MANUAL_STEP_INPUTS.forEach((entry) => {
                el(entry.input).value = '';
            });
        }

        updateManualTotal();
    }

    function openLoginView() {
        el('loginView').classList.remove('hidden');
        el('appView').classList.add('hidden');
        populateLoginUsers();
        el('loginPassword').value = '';
    }

    function openAppView() {
        el('loginView').classList.add('hidden');
        el('appView').classList.remove('hidden');
        refreshApp(true);

        if (TOTVSGithubSync.isConfigured()) {
            pullNow(true);
        } else {
            pullPublished(true);
        }
    }

    function updateSessionLabels() {
        el('sessionRoleLabel').innerText = runtime.currentUser.role === 'manager' ? 'Gerente' : 'Analista';
        el('sessionUserLabel').innerText = runtime.currentUser.displayName;
        el('activeDatasetLabel').innerText = getDatasetLabel();
        el('workspaceSummaryLabel').innerText = getDatasetLabel();
        el('userScopeSummary').innerText = getScopeSummary();
        el('tableScopeHint').innerText = runtime.currentUser.role === 'manager'
            ? 'Voce acompanha o lote inteiro com controle global.'
            : 'Voce visualiza e opera apenas os seus registros.';
    }

    function updateHero() {
        const metrics = TOTVSReports.calculateMetrics(runtime.state, runtime.visibleMachines);
        const done = metrics.doneCount;
        const total = metrics.total;

        el('heroGreeting').innerText = runtime.currentUser.role === 'manager'
            ? `Ola, ${runtime.currentUser.displayName}`
            : `Operacao individual de ${runtime.currentUser.displayName}`;
        el('heroDescription').innerText = runtime.currentUser.role === 'manager'
            ? `O lote ${getDatasetLabel()} esta com ${done} concluidas de ${total} visiveis no painel atual.`
            : `Acompanhe o seu fluxo no lote ${getDatasetLabel()}, com tempos por etapa, incidentes e produtividade individual.`;
    }

    function filterContext() {
        return {
            analystName: (machine) => TOTVSStorage.getAnalystName(runtime.state, machine.analystId)
        };
    }

    function valueOf(id, fallback) {
        const node = el(id);
        return node ? node.value : fallback;
    }

    function readFilterOptions() {
        return {
            search: valueOf('searchFilter', ''),
            spon: valueOf('filterSpon', ''),
            analystId: valueOf('filterAnalyst', 'ALL') || 'ALL',
            status: valueOf('filterStatus', 'ALL') || 'ALL',
            brand: valueOf('filterBrand', 'ALL') || 'ALL',
            profile: valueOf('filterProfile', 'ALL') || 'ALL',
            dateFrom: valueOf('filterDateFrom', ''),
            dateTo: valueOf('filterDateTo', ''),
            dateField: 'processDate',
            sortKey: valueOf('sortMachines', 'updatedAt') || 'updatedAt',
            sortDirection: valueOf('sortDirection', 'desc') || 'desc'
        };
    }

    function getFilteredMachines() {
        return TOTVSFilters.filterAndSort(runtime.visibleMachines, readFilterOptions(), filterContext());
    }

    function activeFilterChips() {
        const options = readFilterOptions();
        const chips = [];

        if (String(options.search || '').trim()) {
            chips.push(`busca "${String(options.search).trim()}"`);
        }
        if (String(options.spon || '').trim()) {
            chips.push(`SPON "${String(options.spon).trim().toUpperCase()}"`);
        }
        if (options.analystId !== 'ALL') {
            chips.push(`responsável: ${TOTVSStorage.getAnalystName(runtime.state, options.analystId)}`);
        }
        if (options.status !== 'ALL') {
            const label = (TOTVSFilters.STATUS_OPTIONS.filter((item) => item.value === options.status)[0] || {}).label;
            chips.push(`status: ${label || options.status}`);
        }
        if (options.brand !== 'ALL') {
            chips.push(`fabricante: ${options.brand}`);
        }
        if (options.profile !== 'ALL') {
            chips.push(`perfil: ${options.profile}`);
        }
        if (options.dateFrom || options.dateTo) {
            chips.push(`registrada ${options.dateFrom || '...'} → ${options.dateTo || '...'}`);
        }

        return chips;
    }

    function updateFilterSummary() {
        const label = el('filterSummary');
        if (!label) {
            return;
        }

        const chips = activeFilterChips();
        const sortLabel = (TOTVSFilters.SORT_OPTIONS
            .filter((item) => item.key === valueOf('sortMachines', 'updatedAt'))[0] || {}).label || 'última atualização';
        const direction = valueOf('sortDirection', 'desc') === 'asc' ? 'crescente' : 'decrescente';

        label.innerText = chips.length
            ? `Filtros ativos: ${chips.join(' · ')} | ordem: ${sortLabel} (${direction})`
            : `Sem filtros aplicados | ordem: ${sortLabel} (${direction})`;
    }

    function setDateRange(from, to) {
        const fromNode = el('filterDateFrom');
        const toNode = el('filterDateTo');
        if (fromNode) fromNode.value = from || '';
        if (toNode) toNode.value = to || '';
        renderTable();
    }

    function quickRangeKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function applyQuickRange(kind) {
        const today = new Date();

        if (kind === 'today') {
            setDateRange(quickRangeKey(today), quickRangeKey(today));
        } else if (kind === 'yesterday') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            setDateRange(quickRangeKey(yesterday), quickRangeKey(yesterday));
        } else if (kind === 'last7') {
            const start = new Date(today);
            start.setDate(start.getDate() - 6);
            setDateRange(quickRangeKey(start), quickRangeKey(today));
        } else if (kind === 'month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            setDateRange(quickRangeKey(start), quickRangeKey(today));
        } else {
            setDateRange('', '');
        }

        showToast('Filtro de data aplicado.', 'ok');
    }

    function clearFilters() {
        ['searchFilter', 'filterSpon', 'filterDateFrom', 'filterDateTo'].forEach((id) => {
            const node = el(id);
            if (node) node.value = '';
        });

        ['filterStatus', 'filterBrand', 'filterProfile'].forEach((id) => {
            const node = el(id);
            if (node) node.value = 'ALL';
        });

        const analyst = el('filterAnalyst');
        if (analyst && Array.from(analyst.options).some((option) => option.value === 'ALL')) {
            analyst.value = 'ALL';
        }

        const sort = el('sortMachines');
        if (sort) sort.value = 'updatedAt';
        const direction = el('sortDirection');
        if (direction) direction.value = 'desc';

        renderTable();
        showToast('Filtros limpos.', 'ok');
    }

    function renderKpis() {
        const machines = runtime.visibleMachines;
        const total = machines.length;
        const done = machines.filter((machine) => machine.status === 'CONCLUIDO').length;
        const awaiting = machines.filter((machine) => machine.status === 'AGUARDANDO_CHECKLIST').length;
        const wip = machines.filter((machine) => machine.status === 'EM_ANDAMENTO').length;
        const errors = machines.filter((machine) => machine.hasError || machine.status === 'ERRO').length;
        const donePercent = total ? Math.round((done / total) * 100) : 0;

        el('kpiTotalMachines').innerText = String(total);
        el('kpiWipMachines').innerText = String(wip);
        el('kpiDoneMachines').innerText = String(done);
        el('kpiErrorMachines').innerText = String(errors);
        el('kpiDonePercent').innerText = `${donePercent}% concluido`;
        el('kpiTotalSub').innerText = `${runtime.currentUser.role === 'manager' ? 'Registros do lote atual' : 'Seus registros no lote atual'}`;

        if (el('kpiAwaitingMachines')) {
            el('kpiAwaitingMachines').innerText = String(awaiting);
        }
        if (el('kpiAwaitingSub')) {
            el('kpiAwaitingSub').innerText = `${awaiting} pendente(s) de revisão final`;
        }

        el('kpiBarTotal').style.width = `${Math.min((total / TOTVSStorage.TOTAL_PROJECT_GOAL) * 100, 100)}%`;
        el('kpiBarWip').style.width = total ? `${(wip / total) * 100}%` : '0%';
        el('kpiBarDone').style.width = `${donePercent}%`;
        el('kpiBarErrors').style.width = total ? `${(errors / total) * 100}%` : '0%';
        if (el('kpiBarAwaiting')) {
            el('kpiBarAwaiting').style.width = total ? `${(awaiting / total) * 100}%` : '0%';
        }
    }

    function buildBrandProfile(machine) {
        const brandClass = `badge-brand-${String(machine.brand || '').toLowerCase()}`;
        const profileClass = `badge-profile-${String(machine.profile || '').toLowerCase()}`;
        return `
            <div class="action-btns">
                <span class="badge ${brandClass}">${machine.brand}</span>
                <span class="badge ${profileClass}">${machine.profile}</span>
            </div>
        `;
    }

    function getSelectedMachineIds() {
        return bySelector('[data-select-machine-id]')
            .filter((node) => node.checked)
            .map((node) => node.getAttribute('data-select-machine-id'));
    }

    function updateBulkBar() {
        const bar = el('bulkSwapBar');
        if (!bar) {
            return;
        }

        const selected = getSelectedMachineIds();
        bar.classList.toggle('hidden', !selected.length);

        const label = el('bulkCountLabel');
        if (label) {
            label.innerText = `${selected.length} máquina(s) selecionada(s)`;
        }
    }

    // Mantem o checkbox do cabecalho coerente com as linhas visiveis.
    function syncSelectAllState() {
        const selectAll = el('selectAllMachines');
        if (!selectAll) {
            return;
        }

        const nodes = bySelector('[data-select-machine-id]');
        const checked = nodes.filter((node) => node.checked).length;
        selectAll.checked = nodes.length > 0 && checked === nodes.length;
        selectAll.indeterminate = checked > 0 && checked < nodes.length;
    }

    function setFilteredSelection(checked) {
        bySelector('[data-select-machine-id]').forEach((node) => {
            node.checked = checked;
        });
        syncSelectAllState();
        updateBulkBar();
        showToast(
            checked ? 'Todas as máquinas filtradas foram selecionadas.' : 'Seleção dos filtrados removida.',
            'ok'
        );
    }

    function clearSelection() {
        bySelector('[data-select-machine-id]').forEach((node) => {
            node.checked = false;
        });
        syncSelectAllState();
        updateBulkBar();
    }

    function openBulkEditModal() {
        const ids = getSelectedMachineIds();
        if (!ids.length) {
            showToast('Selecione ao menos uma máquina na tabela.', '!');
            return;
        }

        el('bulkEditSummary').innerText = `${ids.length} máquina(s) selecionada(s) nesta edição.`;
        el('bulkEditMsg').innerText = '';

        ['inputBulkProcessDate', 'inputBulkSwapDate', 'inputBulkNotes'].forEach((id) => {
            el(id).value = '';
        });
        ['selectBulkAnalyst', 'selectBulkBrand', 'selectBulkProfile', 'selectBulkStep'].forEach((id) => {
            el(id).value = '';
        });
        el('checkBulkClearError').checked = false;
        el('checkBulkClearSwap').checked = false;

        openModal('modalBulkEdit');
    }

    function buildBulkPatch() {
        const patch = {};

        const analystId = el('selectBulkAnalyst').value;
        if (analystId) patch.analystId = analystId;
        const brand = el('selectBulkBrand').value;
        if (brand) patch.brand = brand;
        const profile = el('selectBulkProfile').value;
        if (profile) patch.profile = profile;
        const step = el('selectBulkStep').value;
        if (step) patch.step = step;
        const processDate = el('inputBulkProcessDate').value;
        if (processDate) patch.processDate = processDate;
        const swapDate = el('inputBulkSwapDate').value;
        if (swapDate) patch.swapDate = swapDate;
        const notes = el('inputBulkNotes').value.trim();
        if (notes) patch.notes = notes;
        if (el('checkBulkClearError').checked) patch.clearError = true;
        if (el('checkBulkClearSwap').checked) patch.clearSwap = true;

        return patch;
    }

    function applyBulkEdit() {
        const ids = getSelectedMachineIds();
        if (!ids.length) {
            showToast('Selecione ao menos uma máquina na tabela.', '!');
            return;
        }

        const patch = buildBulkPatch();
        if (!Object.keys(patch).length) {
            el('bulkEditMsg').innerText = 'Informe ao menos um campo para aplicar (os vazios são ignorados).';
            return;
        }

        try {
            const result = TOTVSStorage.bulkUpdateMachines(ids, patch, runtime.currentUser.id);
            closeModal('modalBulkEdit');
            refreshApp(true);
            scheduleSyncAfterChange();

            const extra = result.skipped.length ? ` (${result.skipped.length} ignorada(s))` : '';
            showToast(`${result.updated.length} máquina(s) atualizada(s) em lote${extra}.`, 'ok');
        } catch (error) {
            el('bulkEditMsg').innerText = error.message;
            showToast(error.message, '!');
        }
    }

    function deleteSelectedMachines() {
        const ids = getSelectedMachineIds();
        if (!ids.length) {
            showToast('Selecione ao menos uma máquina na tabela.', '!');
            return;
        }

        if (!window.confirm(`Excluir ${ids.length} máquina(s) selecionada(s)? A ação remove os registros de todos os painéis.`)) {
            return;
        }

        try {
            const result = TOTVSStorage.bulkDeleteMachines(ids, runtime.currentUser.id);
            refreshApp(true);
            scheduleSyncAfterChange();
            showToast(`${result.deleted.length} máquina(s) excluída(s).`, 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    /* --------------------- Card de entrada (perfil gerente) --------------------- */

    function setEntryCardCollapsed(collapsed) {
        const card = el('workflowEntryCard');
        const button = el('btnToggleEntryCard');
        if (!card || !button) {
            return;
        }

        card.classList.toggle('is-collapsed', collapsed);
        button.setAttribute('aria-expanded', String(!collapsed));
        button.innerText = collapsed ? 'Abrir' : 'Recolher';
    }

    function toggleEntryCard() {
        const card = el('workflowEntryCard');
        if (!card) {
            return;
        }
        runtime.entryCardTouched = true;
        setEntryCardCollapsed(!card.classList.contains('is-collapsed'));
    }

    function applyEntryCardRole() {
        const isManager = runtime.currentUser && runtime.currentUser.role === 'manager';
        const title = el('entryCardTitle');
        const hint = el('entryCardHint');

        if (title) {
            title.innerText = isManager
                ? 'Entrada de máquinas (gestão)'
                : 'Entrada de Máquinas e Controle de Etapas';
        }
        if (hint) {
            hint.innerText = isManager
                ? 'Card do analista, recolhido por padrão: abra apenas quando precisar lançar por alguém.'
                : 'Cadastre uma ou várias máquinas por linha.';
        }

        if (isManager && !runtime.entryCardTouched) {
            setEntryCardCollapsed(true);
        }
    }

    function markSelectedAsSwapped() {
        const ids = getSelectedMachineIds();
        if (!ids.length) {
            showToast('Selecione ao menos uma maquina na tabela.', '!');
            return;
        }

        const swapDate = el('inputSwapDate').value || TOTVSStorage.todayBrInput();

        try {
            const result = TOTVSStorage.markMachinesSwapped(ids, swapDate, runtime.currentUser.id);
            refreshApp(true);
            scheduleSyncAfterChange();

            const extra = result.skipped.length
                ? ` (${result.skipped.length} ignorada(s): ${result.skipped[0].reason})`
                : '';
            showToast(`${result.swapped.length} maquina(s) trocada(s) em ${result.date}${extra}.`, 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    function swapSingleMachine(machineId) {
        try {
            const result = TOTVSStorage.markMachinesSwapped(
                [machineId],
                el('inputSwapDate').value || TOTVSStorage.todayBrInput(),
                runtime.currentUser.id
            );
            refreshApp(true);
            scheduleSyncAfterChange();
            showToast(`${result.swapped[0].hostname} marcada como trocada.`, 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    function unswapSingleMachine(machineId) {
        try {
            const machine = TOTVSStorage.unmarkMachineSwapped(machineId, runtime.currentUser.id);
            refreshApp(true);
            scheduleSyncAfterChange();
            showToast(`Troca de ${machine.hostname} desfeita.`, 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    function buildStatus(machine) {
        if (machine.swappedAt) {
            return '<span class="badge badge-status-swapped">Trocada</span>';
        }
        if (machine.hasError || machine.status === 'ERRO') {
            return '<span class="badge badge-status-err">Incidente</span>';
        }
        if (machine.status === 'AGUARDANDO_CHECKLIST') {
            return '<span class="badge badge-status-check">Aguardando checklist</span>';
        }
        if (machine.status === 'CONCLUIDO') {
            return '<span class="badge badge-status-done">Concluido</span>';
        }
        if (machine.status === 'PAUSADO') {
            return '<span class="badge badge-status-pause">Pausado</span>';
        }
        return '<span class="badge badge-status-wip">Em andamento</span>';
    }

    function buildActionButtons(machine) {
        const canEdit = runtime.currentUser.role === 'manager' || machine.analystId === runtime.currentUser.id;
        if (!canEdit) {
            return '<span class="helper-text">Somente leitura</span>';
        }

        const buttons = [];
        if (machine.swappedAt) {
            buttons.push(`<button type="button" class="btn-action-swap" data-action="unswap" data-machine-id="${machine.id}">Desfazer troca</button>`);
        } else if (machine.status === 'CONCLUIDO') {
            buttons.push(`<button type="button" class="btn-action-swap" data-action="swap" data-machine-id="${machine.id}">Trocada</button>`);
        }

        if (machine.status === 'AGUARDANDO_CHECKLIST') {
            buttons.push(`<button type="button" class="btn-timer-ctrl btn-timer-next" data-action="checklist" data-machine-id="${machine.id}">Checklist</button>`);
        } else if (!TOTVSStorage.isStepFinished(machine.currentStep)) {
            if (machine.timerRunning) {
                buttons.push(`<button type="button" class="btn-timer-ctrl" data-action="pause" data-machine-id="${machine.id}">Pausar</button>`);
            } else {
                buttons.push(`<button type="button" class="btn-timer-ctrl" data-action="start" data-machine-id="${machine.id}">Iniciar</button>`);
            }
            buttons.push(`<button type="button" class="btn-timer-ctrl btn-timer-next" data-action="next" data-machine-id="${machine.id}">Proximo</button>`);
        }
        buttons.push(`<button type="button" class="btn-action-edit" data-action="edit" data-machine-id="${machine.id}">Editar</button>`);
        buttons.push(`<button type="button" class="btn-action-del" data-action="delete" data-machine-id="${machine.id}">Excluir</button>`);
        return `<div class="action-btns">${buttons.join('')}</div>`;
    }

    function renderTable() {
        const tbody = el('machinesTableBody');
        const list = getFilteredMachines();
        tbody.innerHTML = '';

        el('tableCountLabel').innerText = `Exibindo ${list.length} de ${runtime.visibleMachines.length} registros`;
        updateFilterSummary();

        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 32px; color: var(--text-muted);">Nenhum registro encontrado para os filtros atuais.</td></tr>';
            syncSelectAllState();
            return;
        }

        list.forEach((machine, index) => {
            const liveMachine = getLiveMachine(machine);
            const tr = document.createElement('tr');
            if (liveMachine.status === 'CONCLUIDO') {
                tr.classList.add('row-completed');
            } else if (liveMachine.status === 'AGUARDANDO_CHECKLIST') {
                tr.classList.add('row-awaiting');
            }
            if (liveMachine.hasError || liveMachine.status === 'ERRO') {
                tr.classList.add('row-error');
            }

            const analystName = TOTVSStorage.getAnalystName(runtime.state, liveMachine.analystId);
            const stepSeconds = TOTVSStorage.isStepFinished(liveMachine.currentStep)
                ? 0
                : Number(liveMachine.stepDurations[liveMachine.currentStep] || 0);

            tr.innerHTML = `
                <td class="cell-select"><input type="checkbox" data-select-machine-id="${liveMachine.id}" aria-label="Selecionar ${liveMachine.hostname}"> ${index + 1}</td>
                <td>${liveMachine.processDate || '--'}</td>
                <td class="font-mono">${liveMachine.hostname}</td>
                <td>${analystName}</td>
                <td>${buildBrandProfile(liveMachine)}</td>
                <td>${liveMachine.currentStep}</td>
                <td><span class="timer-pill ${liveMachine.timerRunning ? 'running' : 'paused'}" data-step-timer="${liveMachine.id}">${formatDuration(stepSeconds)}</span></td>
                <td><span class="timer-pill ${liveMachine.status === 'CONCLUIDO' ? 'done' : (liveMachine.status === 'AGUARDANDO_CHECKLIST' ? 'awaiting' : '')}" data-total-timer="${liveMachine.id}">${formatDuration(liveMachine.totalElapsedSeconds)}</span></td>
                <td>${TOTVSStorage.formatDateTime(liveMachine.updatedAt)}</td>
                <td>${buildStatus(liveMachine)}</td>
                <td>${buildActionButtons(liveMachine)}</td>
            `;

            tr.addEventListener('dblclick', () => {
                if (runtime.currentUser.role === 'manager' || liveMachine.analystId === runtime.currentUser.id) {
                    openEditMachine(liveMachine.id);
                }
            });

            tbody.appendChild(tr);
        });

        syncSelectAllState();
    }

    function renderTimerCellsOnly() {
        const filtered = getFilteredMachines();
        filtered.forEach((machine) => {
            const liveMachine = getLiveMachine(machine);
            const stepNode = document.querySelector(`[data-step-timer="${machine.id}"]`);
            const totalNode = document.querySelector(`[data-total-timer="${machine.id}"]`);
            if (stepNode) {
                const stepSeconds = TOTVSStorage.isStepFinished(liveMachine.currentStep)
                    ? 0
                    : Number(liveMachine.stepDurations[liveMachine.currentStep] || 0);
                stepNode.innerText = formatDuration(stepSeconds);
            }
            if (totalNode) {
                totalNode.innerText = formatDuration(liveMachine.totalElapsedSeconds);
            }
        });
    }

    function startViewTimers() {
        if (runtime.timerViewInterval) {
            clearInterval(runtime.timerViewInterval);
        }
        runtime.timerViewInterval = setInterval(() => {
            if (!runtime.currentUser) {
                return;
            }
            renderTimerCellsOnly();
        }, 1000);
    }

    function refreshApp(processTimers = false) {
        syncState(processTimers);
        if (!runtime.currentUser) {
            openLoginView();
            return;
        }

        populateAnalystOptions();
        populateDatasetSelect();
        setRoleVisibility();
        applyEntryCardRole();
        updateSessionLabels();
        updateHero();
        renderKpis();
        renderTable();
        resetForm();
        if (el('inputSwapDate') && !el('inputSwapDate').value) {
            el('inputSwapDate').value = TOTVSStorage.todayBrInput();
        }
        updateBulkBar();
    }

    function getFormPayload() {
        const hostnames = el('inputHostnames').value.trim();
        const analystId = runtime.currentUser.role === 'manager'
            ? el('selectAnalyst').value
            : runtime.currentUser.id;
        const payload = {
            hostnames,
            analystId,
            brand: el('selectBrand').value,
            profile: el('selectProfile').value,
            processDate: el('inputProcessDate').value || TOTVSStorage.todayBrInput(),
            step: el('selectStep').value,
            manualEntry: el('checkManualEntry').checked,
            manualStepSeconds: getManualStepSeconds(),
            autoStart: el('checkManualEntry').checked ? false : el('checkAutoStartTimer').checked,
            hasError: el('checkHasError').checked,
            errorDescription: el('inputErrorDesc').value.trim(),
            notes: el('inputNotes').value.trim()
        };

        if (!payload.hostnames) {
            throw new Error('Informe ao menos um hostname.');
        }
        if (!payload.analystId) {
            throw new Error('Selecione um analista responsavel.');
        }
        if (payload.manualEntry && getManualTotalSeconds() <= 0) {
            throw new Error('No lançamento manual informe o tempo de ao menos uma etapa.');
        }
        if (payload.hasError && !payload.errorDescription) {
            throw new Error('Descreva o incidente tecnico.');
        }

        return payload;
    }

    async function handleLogin(event) {
        event.preventDefault();
        const username = el('loginUsername').value;
        const password = el('loginPassword').value;

        try {
            await TOTVSStorage.login(username, password);
            const upgraded = TOTVSStorage.wasCredentialsUpgraded();
            syncState();
            openAppView();
            showToast(`Sessão iniciada para ${runtime.currentUser.displayName}.`, 'ok');

            if (upgraded) {
                // Credencial migrada do formato antigo: envia para o repositorio para
                // que as outras maquinas recebam exatamente esta senha.
                scheduleSyncAfterChange();
            }
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    function handleLogout() {
        TOTVSStorage.logout();
        syncState();
        openLoginView();
        showToast('Sessao encerrada.', 'ok');
    }

    function handleMachineSubmit(event) {
        event.preventDefault();

        try {
            const payload = getFormPayload();
            const editMachineId = el('editMachineId').value;
            if (editMachineId) {
                TOTVSStorage.updateMachine(editMachineId, payload, runtime.currentUser.id);
                showToast('Registro atualizado com sucesso.', 'ok');
            } else {
                const result = TOTVSStorage.createMachines(payload, runtime.currentUser.id);
                const totalProcessed = result.createdItems.length + result.updatedItems.length;
                showToast(`${totalProcessed} registro(s) processado(s) com sucesso.`, 'ok');
            }
            refreshApp(true);
            scheduleSyncAfterChange();
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    function openEditMachine(machineId) {
        syncState(true);
        const machine = runtime.visibleMachines.find((item) => item.id === machineId);
        if (!machine) {
            showToast('Registro nao encontrado para edicao.', '!');
            return;
        }

        el('editMachineId').value = machine.id;
        el('inputHostnames').value = machine.hostname;
        el('inputHostnames').disabled = true;
        el('inputHostnames').rows = 1;
        el('selectAnalyst').value = machine.analystId;
        el('selectBrand').value = machine.brand;
        el('selectProfile').value = machine.profile;
        el('inputProcessDate').value = machine.processDate || TOTVSStorage.todayBrInput();
        el('selectStep').value = machine.currentStep;
        el('checkAutoStartTimer').checked = machine.timerRunning;
        el('checkHasError').checked = Boolean(machine.hasError);
        el('inputErrorDesc').value = machine.errorDetails ? (machine.errorDetails.description || '') : '';
        el('inputNotes').value = machine.notes || '';

        el('containerAutoTimer').classList.add('hidden');
        el('checkManualEntry').checked = Boolean(machine.manualEntry);
        MANUAL_STEP_INPUTS.forEach((entry) => {
            const seconds = Number(machine.stepDurations[entry.step] || 0);
            el(entry.input).value = seconds > 0 ? String(Math.round(seconds / 60)) : '';
        });
        el('manualTimesContainer').classList.toggle('hidden', !machine.manualEntry);
        updateManualTotal();
        el('errorDetailsContainer').classList.toggle('hidden', !machine.hasError);
        el('submitBtnText').innerText = 'Salvar alteracoes';
        el('btnSubmitForm').classList.remove('btn-success');
        el('btnSubmitForm').classList.add('btn-primary');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function deleteMachine(machineId) {
        const machine = runtime.visibleMachines.find((item) => item.id === machineId);
        if (!machine) {
            showToast('Registro nao encontrado.', '!');
            return;
        }

        if (!window.confirm(`Excluir o hostname ${machine.hostname}?`)) {
            return;
        }

        try {
            TOTVSStorage.deleteMachine(machineId, runtime.currentUser.id);
            refreshApp(true);
            scheduleSyncAfterChange();
            showToast(`Registro ${machine.hostname} excluido.`, 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    function startMachineTimer(machineId) {
        try {
            TOTVSStorage.startMachine(machineId, runtime.currentUser.id);
            refreshApp(true);
            scheduleSyncAfterChange();
            showToast('Cronometro iniciado.', 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    function pauseMachineTimer(machineId) {
        try {
            TOTVSStorage.pauseMachine(machineId, runtime.currentUser.id);
            refreshApp(true);
            scheduleSyncAfterChange();
            showToast('Cronometro pausado.', 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    function nextMachineStep(machineId) {
        try {
            TOTVSStorage.nextMachineStep(machineId, runtime.currentUser.id);
            refreshApp(true);
            scheduleSyncAfterChange();
            showToast('Etapa avancada com sucesso.', 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    function handleTableActions(event) {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }

        const machineId = button.getAttribute('data-machine-id');
        const action = button.getAttribute('data-action');

        if (action === 'start') {
            startMachineTimer(machineId);
        } else if (action === 'pause') {
            pauseMachineTimer(machineId);
        } else if (action === 'next') {
            nextMachineStep(machineId);
        } else if (action === 'edit') {
            openEditMachine(machineId);
        } else if (action === 'swap') {
            swapSingleMachine(machineId);
        } else if (action === 'unswap') {
            unswapSingleMachine(machineId);
        } else if (action === 'checklist') {
            openChecklistModal(machineId);
        } else if (action === 'delete') {
            deleteMachine(machineId);
        }
    }

    function handleDatasetChange() {
        TOTVSStorage.setActiveDatasetId(el('selectDataset').value);
        refreshApp(true);
        scheduleSyncAfterChange();
        showToast(`Lote ativo alterado para ${getDatasetLabel()}.`, 'ok');
    }

    function createDataset() {
        const name = el('inputNewDatasetName').value.trim();
        if (!name) {
            showToast('Informe um nome para o novo lote.', '!');
            return;
        }

        try {
            TOTVSStorage.createDataset(name, runtime.currentUser.id);
            el('inputNewDatasetName').value = '';
            refreshApp(true);
            scheduleSyncAfterChange();
            showToast('Novo lote criado com sucesso.', 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    function deleteActiveDataset() {
        if (!window.confirm(`Excluir o lote ${getDatasetLabel()} e todos os seus registros?`)) {
            return;
        }

        try {
            TOTVSStorage.deleteDataset(runtime.state.activeDatasetId, runtime.currentUser.id);
            refreshApp(true);
            scheduleSyncAfterChange();
            showToast('Lote excluido com sucesso.', 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    function openModal(modalId) {
        const modal = el(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    function closeModal(modalId) {
        const modal = el(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    function updateReportPreview() {
        const select = el('reportAnalystSelect');
        const preview = el('txtReportPreview');
        if (!select || !preview) {
            return;
        }

        preview.value = TOTVSImporterExporter.exportToWhatsAppReport(
            runtime.state,
            runtime.visibleMachines,
            runtime.currentUser,
            select.value
        );

        TOTVSReports.renderAnalystCharts(runtime.state, runtime.visibleMachines, runtime.currentUser, select.value);
    }

    function activateDefaultReportTab() {
        const buttons = bySelector('.tab-btn').filter((button) => !button.classList.contains('hidden-by-role'));
        if (!buttons.length) {
            return;
        }

        // Se a aba ativa padrao estiver escondida para o perfil, ativa a primeira visivel.
        if (buttons.some((button) => button.classList.contains('active'))) {
            return;
        }

        buttons[0].click();
    }

    function openReportsModal() {
        syncState(true);
        setRoleVisibility();
        TOTVSReports.renderReportsModal(runtime.state, runtime.visibleMachines, runtime.currentUser);
        updateReportPreview();
        activateDefaultReportTab();
        openModal('modalReports');
    }

    function writePrintArea(html) {
        const printArea = el('printArea');
        if (!printArea) {
            return;
        }

        printArea.innerHTML = html;

        const cleanup = () => {
            printArea.innerHTML = '';
            window.removeEventListener('afterprint', cleanup);
        };

        window.addEventListener('afterprint', cleanup);
        window.print();

        // Fallback para navegadores que nao disparam afterprint (ex: kiosk-printing).
        setTimeout(cleanup, 5000);
    }

    function printGeneralReport() {
        if (runtime.currentUser.role !== 'manager') {
            showToast('O relatorio geral e exclusivo do gerente.', '!');
            return;
        }

        syncState(true);
        const metrics = TOTVSReports.calculateMetrics(runtime.state, runtime.visibleMachines);
        const html = TOTVSReports.buildPrintableGeneralReport(runtime.state, metrics, runtime.visibleMachines);
        writePrintArea(html);
    }

    function printAnalystReport() {
        syncState(true);
        const selectedAnalystId = el('reportAnalystSelect').value;
        if (runtime.currentUser.role === 'manager' && selectedAnalystId === 'ALL') {
            showToast('Selecione um analista especifico para o relatorio individual.', '!');
            return;
        }
        const analystId = selectedAnalystId === 'ALL' ? runtime.currentUser.id : selectedAnalystId;
        const html = TOTVSReports.buildPrintableAnalystReport(runtime.state, runtime.visibleMachines, analystId);
        writePrintArea(html);
    }

    function printGeneralCharts() {
        if (runtime.currentUser.role !== 'manager') {
            showToast('Os graficos gerais sao exclusivos do gerente.', '!');
            return;
        }

        syncState(true);
        const metrics = TOTVSReports.calculateMetrics(runtime.state, runtime.visibleMachines);
        const html = TOTVSReports.buildPrintableGeneralCharts(runtime.state, metrics, runtime.visibleMachines);
        writePrintArea(html);
    }

    function printAnalystCharts() {
        if (runtime.currentUser.role !== 'manager') {
            showToast('Os graficos por analista sao exclusivos do gerente.', '!');
            return;
        }

        syncState(true);
        const selectedAnalystId = el('reportAnalystSelect').value;
        if (selectedAnalystId === 'ALL') {
            showToast('Selecione um analista especifico para imprimir os graficos.', '!');
            return;
        }

        const html = TOTVSReports.buildPrintableAnalystCharts(runtime.state, runtime.visibleMachines, selectedAnalystId);
        writePrintArea(html);
    }

    function downloadGeneralJson() {
        if (runtime.currentUser.role !== 'manager') {
            showToast('Somente o gerente pode baixar o arquivo geral.', '!');
            return;
        }

        syncState(true);
        TOTVSImporterExporter.downloadJson('dados-gerais.json', TOTVSGithubSync.buildGeneralPayload(runtime.state));
        showToast('dados-gerais.json exportado.', 'ok');
    }

    function downloadMyJson() {
        syncState(true);
        const filename = `analista-${slugify(runtime.currentUser.username)}.json`;
        TOTVSImporterExporter.downloadJson(filename, TOTVSGithubSync.buildUserPayload(runtime.state, runtime.currentUser));
        showToast('Arquivo individual exportado.', 'ok');
    }

    function downloadUsersJson() {
        if (runtime.currentUser.role !== 'manager') {
            showToast('Somente o gerente pode baixar usuarios.json.', '!');
            return;
        }

        syncState();
        TOTVSImporterExporter.downloadJson('usuarios.json', TOTVSGithubSync.buildUsersPayload(runtime.state));
        showToast('usuarios.json exportado.', 'ok');
    }

    function downloadSnapshot() {
        if (runtime.currentUser.role !== 'manager') {
            showToast('Somente o gerente pode baixar o snapshot completo.', '!');
            return;
        }

        syncState(true);
        TOTVSImporterExporter.downloadJson('snapshot-completo.json', TOTVSImporterExporter.buildFullSnapshot(runtime.state));
        showToast('Snapshot completo exportado.', 'ok');
    }

    function restoreSnapshot(file) {
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                TOTVSStorage.restoreFullBackup(event.target.result, runtime.currentUser ? runtime.currentUser.id : null);
                refreshApp(true);
                showToast('Snapshot restaurado com sucesso.', 'ok');
            } catch (error) {
                showToast(error.message || 'Falha ao restaurar o snapshot.', '!');
            }
        };
        reader.readAsText(file);
        el('fileRestoreBackup').value = '';
    }

    async function copySheets() {
        try {
            const content = TOTVSImporterExporter.exportToTSV(runtime.state, getFilteredMachines().map(getLiveMachine));
            await navigator.clipboard.writeText(content);
            showToast('Conteudo copiado para planilha.', 'ok');
        } catch (error) {
            showToast('Nao foi possivel copiar para a area de transferencia.', '!');
        }
    }

    async function copyWhatsapp() {
        try {
            const analystFilter = el('filterAnalyst').value || 'ALL';
            const content = TOTVSImporterExporter.exportToWhatsAppReport(
                runtime.state,
                getFilteredMachines().map(getLiveMachine),
                runtime.currentUser,
                analystFilter
            );
            await navigator.clipboard.writeText(content);
            showToast('Resumo copiado para envio.', 'ok');
        } catch (error) {
            showToast('Nao foi possivel copiar o resumo.', '!');
        }
    }

    async function copyReportText() {
        try {
            await navigator.clipboard.writeText(el('txtReportPreview').value);
            showToast('Texto do relatorio copiado.', 'ok');
        } catch (error) {
            showToast('Nao foi possivel copiar o relatorio.', '!');
        }
    }

    function selectReportText() {
        const preview = el('txtReportPreview');
        preview.focus();
        preview.select();
    }

    function toggleErrorField() {
        el('errorDetailsContainer').classList.toggle('hidden', !el('checkHasError').checked);
    }

    async function changeOwnPassword(event) {
        event.preventDefault();

        const currentPassword = el('inputCurrentPassword').value;
        const newPassword = el('inputNewPassword').value;
        const confirmPassword = el('inputConfirmPassword').value;

        if (!newPassword || newPassword.length < 6) {
            showToast('A nova senha precisa ter ao menos 6 caracteres.', '!');
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast('As senhas informadas nao conferem.', '!');
            return;
        }

        try {
            await TOTVSStorage.changeOwnPassword(runtime.currentUser.id, currentPassword, newPassword);
            el('ownPasswordForm').reset();
            scheduleSyncAfterChange();
            showToast('Sua senha foi atualizada e já sincroniza com as outras máquinas.', 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    async function resetUserPassword(event) {
        event.preventDefault();

        try {
            await TOTVSStorage.resetUserPassword(
                runtime.currentUser.id,
                el('resetTargetUser').value,
                el('inputMasterSecret').value,
                el('inputResetPassword').value
            );
            el('resetPasswordForm').reset();
            scheduleSyncAfterChange();
            showToast('Senha do usuario redefinida.', 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    /* -------------------- Sincronizacao automatica (GitHub) -------------------- */

    function renderGithubStatus(status) {
        const box = el('ghStatusBox');
        const text = el('ghStatusText');
        const lastLabel = el('ghLastSyncLabel');

        if (!box || !text) {
            return;
        }

        box.classList.remove('is-ok', 'is-error', 'is-syncing');
        if (status.status === 'ok') {
            box.classList.add('is-ok');
        } else if (status.status === 'error') {
            box.classList.add('is-error');
        } else if (status.status === 'syncing') {
            box.classList.add('is-syncing');
        }

        const pendingLabel = status.pending ? ` (${status.pending} na fila)` : '';
        text.innerText = status.configured
            ? `${status.message}${pendingLabel}`
            : 'Sincronizacao nao configurada. Preencha os campos acima.';

        if (lastLabel) {
            lastLabel.innerText = status.lastSyncAt
                ? `Ultima sincronizacao: ${TOTVSStorage.formatDateTime(status.lastSyncAt)}`
                : 'Ultima sincronizacao: nunca';
        }

        renderSyncChip(status);
    }

    // "Quadradinho" no topo: deixa claro, num olhar, se a maquina esta vinculada
    // ao GitHub ou nao. Sem vinculo, o botao "Clique para sincronizar" aparece.
    function syncChipState(status) {
        if (!status.configured) {
            return { cls: 'is-off', label: 'Não vinculado' };
        }
        if (status.status === 'syncing') {
            return { cls: 'is-syncing', label: 'Sincronizando...' };
        }
        if (status.status === 'error') {
            return { cls: 'is-error', label: 'Falha na sincronização' };
        }
        if (status.verified) {
            return { cls: 'is-on', label: 'Vinculado' };
        }
        return { cls: 'is-pending', label: 'Verificando vínculo...' };
    }

    function renderSyncChip(status) {
        const chip = el('syncChip');
        if (!chip) {
            return;
        }
        const info = syncChipState(status);
        chip.classList.remove('is-on', 'is-off', 'is-error', 'is-syncing', 'is-pending');
        chip.classList.add(info.cls);

        const label = chip.querySelector('[data-sync-label]');
        if (label) {
            label.innerText = info.label;
        }
        const detail = chip.querySelector('[data-sync-detail]');
        if (detail) {
            detail.innerText = status.lastSyncAt
                ? `Último envio: ${TOTVSStorage.formatDateTime(status.lastSyncAt)}`
                : 'Nenhum envio ainda';
        }

        const retry = el('btnSyncRetry');
        if (retry) {
            const showRetry = info.cls === 'is-error' || info.cls === 'is-off' || info.cls === 'is-pending';
            retry.classList.toggle('hidden', !showRetry);
        }
    }

    // Executado na abertura do painel: vincula automaticamente quando ainda nao ha
    // configuracao e valida a conexao. Devolve true quando ficou vinculado.
    async function bootstrapAutoLink(quiet = true) {
        try {
            const applied = await TOTVSGithubSync.ensureConfigured();
            if (!applied || !TOTVSGithubSync.isConfigured()) {
                renderGithubStatus(TOTVSGithubSync.getStatus());
                return false;
            }

            await TOTVSGithubSync.testConnection();
            TOTVSGithubSync.markSuccess('Vinculado automaticamente ao repositório do GitHub.');
            renderGithubStatus(TOTVSGithubSync.getStatus());
            if (runtime.currentUser) {
                pullNow(true);
            }
            return true;
        } catch (error) {
            TOTVSGithubSync.markError(error.message || 'Falha ao vincular automaticamente.');
            renderGithubStatus(TOTVSGithubSync.getStatus());
            if (!quiet) {
                showToast(error.message, '!');
            }
            return false;
        }
    }

    // Botao "Clique para sincronizar": re-tenta; se falhar de novo, cai no fluxo
    // manual (modal de configuracao) que ja existia.
    async function retryAutoLink() {
        TOTVSGithubSync.markBusy('Tentando vincular novamente...');
        renderGithubStatus(TOTVSGithubSync.getStatus());

        try {
            if (!TOTVSGithubSync.isConfigured()) {
                await TOTVSGithubSync.ensureConfigured();
            }
            const info = await TOTVSGithubSync.testConnection();
            TOTVSGithubSync.markSuccess(`Conectado em ${info.fullName}. Enviando dados...`);
            renderGithubStatus(TOTVSGithubSync.getStatus());
            showToast('Sincronização vinculada com sucesso.', 'ok');

            syncState(true);
            await TOTVSGithubSync.enqueue(async () => {
                await TOTVSGithubSync.syncNow(runtime.state, runtime.currentUser);
                TOTVSGithubSync.markSuccess('Dados enviados para o GitHub.');
            });
            renderGithubStatus(TOTVSGithubSync.getStatus());
        } catch (error) {
            TOTVSGithubSync.markError(error.message);
            renderGithubStatus(TOTVSGithubSync.getStatus());
            showToast('Não foi possível sincronizar. Abrindo a configuração manual.', '!');
            openSyncModal();
        }
    }

    function loadGithubConfigIntoForm() {
        const config = TOTVSGithubSync.getConfig();
        if (config) {
            el('ghOwner').value = config.owner || '';
            el('ghRepo').value = config.repo || '';
            el('ghBranch').value = config.branch || 'main';
            el('ghToken').value = config.token || '';
            el('ghAutoSync').checked = Boolean(config.autoSync);
        }
        renderGithubStatus(TOTVSGithubSync.getStatus());
    }

    function openSyncModal() {
        loadGithubConfigIntoForm();
        openModal('modalSync');
    }

    function saveGithubConfig() {
        const owner = el('ghOwner').value.trim();
        const repo = el('ghRepo').value.trim();
        const token = el('ghToken').value.trim();

        if (!owner || !repo || !token) {
            showToast('Informe usuario, repositorio e token.', '!');
            return;
        }

        TOTVSGithubSync.saveConfig({
            owner,
            repo,
            branch: el('ghBranch').value.trim() || 'main',
            token,
            autoSync: el('ghAutoSync').checked
        });

        renderGithubStatus(TOTVSGithubSync.getStatus());
        showToast('Configuracao do GitHub salva.', 'ok');
    }

    async function testGithubConnection() {
        TOTVSGithubSync.markBusy('Testando conexao com o GitHub...');
        renderGithubStatus(TOTVSGithubSync.getStatus());

        try {
            const info = await TOTVSGithubSync.testConnection();
            TOTVSGithubSync.markSuccess(`Conectado em ${info.fullName} (branch padrao: ${info.defaultBranch}).`);
            showToast('Conexao com o GitHub validada.', 'ok');
        } catch (error) {
            TOTVSGithubSync.markError(error.message);
            showToast(error.message, '!');
        }

        renderGithubStatus(TOTVSGithubSync.getStatus());
    }

    function scheduleSyncAfterChange() {
        if (!TOTVSGithubSync.isConfigured()) {
            return;
        }

        TOTVSGithubSync.scheduleAutoSync(async () => {
            const freshState = TOTVSStorage.processRunningTimers();
            const user = TOTVSStorage.getCurrentUser(freshState);
            if (!user) {
                return;
            }
            await TOTVSGithubSync.syncNow(freshState, user);
            TOTVSGithubSync.markSuccess(`Dados enviados para o GitHub como ${user.username}.`);
        });
    }

    async function pushNow() {
        if (!TOTVSGithubSync.isConfigured()) {
            showToast('Configure a sincronizacao antes de enviar.', '!');
            return;
        }

        syncState(true);
        TOTVSGithubSync.markBusy('Enviando dados para o GitHub...');
        renderGithubStatus(TOTVSGithubSync.getStatus());

        await TOTVSGithubSync.enqueue(async () => {
            await TOTVSGithubSync.syncNow(runtime.state, runtime.currentUser);
            TOTVSGithubSync.markSuccess(`Envio concluido por ${runtime.currentUser.displayName}.`);
        });

        const status = TOTVSGithubSync.getStatus();
        renderGithubStatus(status);
        showToast(
            status.status === 'error' ? status.message : 'Sincronizacao de envio finalizada.',
            status.status === 'error' ? '!' : 'ok'
        );
    }

    async function pullNow(silent = false) {
        if (!TOTVSGithubSync.isConfigured()) {
            if (!silent) {
                showToast('Configure a sincronizacao antes de baixar.', '!');
            }
            return;
        }

        TOTVSGithubSync.markBusy('Baixando dados do GitHub...');
        renderGithubStatus(TOTVSGithubSync.getStatus());

        try {
            const bundle = await TOTVSGithubSync.fetchBundle();
            const result = TOTVSStorage.mergeRemoteBundle(bundle, runtime.currentUser);
            refreshApp(true);

            const message = `GitHub sincronizado: ${result.received} registro(s) recebido(s), ${result.applied} novo(s).`;
            TOTVSGithubSync.markSuccess(message);
            if (!silent) {
                showToast(message, 'ok');
            }
        } catch (error) {
            TOTVSGithubSync.markError(error.message);
            if (!silent) {
                showToast(error.message, '!');
            }
        }

        renderGithubStatus(TOTVSGithubSync.getStatus());
    }

    async function pullPublished(silent = true) {
        try {
            const bundle = await TOTVSGithubSync.fetchPublishedBundle();
            if (!bundle) {
                return;
            }

            const result = TOTVSStorage.mergeRemoteBundle(bundle, runtime.currentUser);
            refreshApp(true);

            if (!silent) {
                showToast(`Dados publicados carregados: ${result.applied} novo(s) registro(s).`, 'ok');
            }
        } catch (error) {
            // Leitura publica indisponivel: segue apenas com os dados locais.
        }
    }

    /* ------------------------------- Checklist final ------------------------------- */

    const CHECKLIST_CHECK_IDS = ['chkCertMicrosoft', 'chkTreillix', 'chkHpDrivers', 'chkWindowsUpdate'];

    function openChecklistModal(machineId) {
        syncState(true);
        openModal('modalChecklist');
        el('checklistSponSearch').value = '';
        el('checklistResult').innerHTML = '<p class="helper-text">Digite o SPON da máquina para consultar.</p>';
        el('checklistPanel').classList.add('hidden');
        runtime.checklistMachineId = null;

        if (machineId) {
            const machine = runtime.visibleMachines.find((item) => item.id === machineId);
            if (machine) {
                el('checklistSponSearch').value = machine.hostname;
                renderChecklistResult(machine.hostname);
            }
        }
    }

    function searchChecklistSpon() {
        renderChecklistResult(el('checklistSponSearch').value);
    }

    function renderChecklistResult(term) {
        const needle = String(term || '').trim().toUpperCase();
        const box = el('checklistResult');
        el('checklistPanel').classList.add('hidden');
        runtime.checklistMachineId = null;

        if (!needle) {
            box.innerHTML = '<p class="helper-text">Digite o SPON da máquina para consultar.</p>';
            return;
        }

        const matches = runtime.visibleMachines.filter((machine) => (
            String(machine.hostname || '').toUpperCase().includes(needle)
        ));

        if (!matches.length) {
            box.innerHTML = `<p class="helper-text">Nenhuma máquina encontrada para "${needle}".</p>`;
            return;
        }

        box.innerHTML = matches.slice(0, 8).map((machine) => {
            let action = '<span class="helper-text">Ainda não está aguardando checklist</span>';
            if (machine.status === 'AGUARDANDO_CHECKLIST') {
                action = `<button type="button" class="btn btn-primary btn-sm" data-checklist-start="${machine.id}">Realizar checklist final</button>`;
            } else if (machine.status === 'CONCLUIDO') {
                action = '<span class="badge badge-status-done">Checklist já aprovado</span>';
            }
            return `
                <div class="checklist-hit">
                    <div class="checklist-hit-main">
                        <strong class="font-mono">${machine.hostname}</strong>
                        <span class="helper-text">${machine.currentStep}</span>
                    </div>
                    ${buildStatus(machine)}
                    ${action}
                </div>
            `;
        }).join('');
    }

    function startChecklist(machineId) {
        const machine = runtime.visibleMachines.find((item) => item.id === machineId);
        if (!machine) {
            showToast('Máquina não encontrada.', '!');
            return;
        }
        runtime.checklistMachineId = machineId;
        el('checklistMachineLabel').innerText = `${machine.hostname} · ${machine.currentStep}`;
        CHECKLIST_CHECK_IDS.forEach((id) => {
            if (el(id)) {
                el(id).checked = false;
            }
        });
        el('checklistPanel').classList.remove('hidden');
        updateChecklistSubmitState();
    }

    function updateChecklistSubmitState() {
        const allChecked = CHECKLIST_CHECK_IDS.every((id) => el(id) && el(id).checked);
        const button = el('btnSubmitChecklist');
        if (button) {
            button.disabled = !allChecked;
        }
        const msg = el('checklistMsg');
        if (msg) {
            msg.innerText = allChecked
                ? 'Tudo certo! Confirme para concluir a máquina.'
                : 'Marque os 4 itens para liberar o envio.';
        }
    }

    function submitChecklist() {
        if (!runtime.checklistMachineId) {
            showToast('Selecione uma máquina primeiro.', '!');
            return;
        }

        try {
            TOTVSStorage.completeMachineChecklist(runtime.checklistMachineId, {
                microsoftCert: el('chkCertMicrosoft').checked,
                trellix: el('chkTreillix').checked,
                hpDrivers: el('chkHpDrivers').checked,
                windowsUpdate: el('chkWindowsUpdate').checked
            }, runtime.currentUser.id);

            refreshApp(true);
            scheduleSyncAfterChange();
            closeModal('modalChecklist');
            showToast('Checklist final aprovado. Máquina concluída!', 'ok');
        } catch (error) {
            showToast(error.message, '!');
        }
    }

    /* ------------------------------ Consulta de SPON ------------------------------
     * Le os dados do repositorio (fonte publica ou autenticada) sem misturar no estado
     * operacional. Todos os perfis consultam; o responsavel so aparece ao gerente.
     * --------------------------------------------------------------------------- */

    function openSponLookup() {
        el('sponLookupInput').value = '';
        el('sponLookupResult').innerHTML = '<p class="helper-text">Digite o SPON e clique em Consultar.</p>';
        openModal('modalSponLookup');
    }

    async function lookupSpon() {
        const box = el('sponLookupResult');
        const needle = String(el('sponLookupInput').value || '').trim();

        if (!needle) {
            box.innerHTML = '<p class="helper-text">Informe o SPON da máquina.</p>';
            return;
        }

        box.innerHTML = '<p class="helper-text">Consultando o repositório...</p>';

        try {
            const bundle = TOTVSGithubSync.isConfigured()
                ? await TOTVSGithubSync.fetchBundle()
                : await TOTVSGithubSync.fetchPublishedBundle();

            if (!bundle) {
                box.innerHTML = '<p class="helper-text">Não foi possível ler os dados do repositório agora. Tente novamente.</p>';
                return;
            }

            const found = TOTVSStorage.findMachinesInBundle(bundle, needle);
            if (!found.length) {
                box.innerHTML = `<p class="helper-text">Nenhuma máquina encontrada para "${needle}".</p>`;
                return;
            }

            const state = TOTVSStorage.loadState();
            box.innerHTML = found.slice(0, 10).map((machine) => renderSponDetails(state, machine)).join('');
        } catch (error) {
            box.innerHTML = `<p class="helper-text">Falha na consulta: ${error.message}</p>`;
        }
    }

    function renderSponDetails(state, machine) {
        const details = TOTVSStorage.getMachineDetailsForViewer(state, machine, runtime.currentUser);

        const stepRows = TOTVSStorage.PROCESS_STEPS.map((step) => {
            const seconds = Number((details.stepDurations || {})[step] || 0);
            return `
                <li class="spon-step">
                    <span>${step}</span>
                    <span class="font-mono">${seconds > 0 ? formatDuration(seconds) : '--:--:--'}</span>
                </li>
            `;
        }).join('');

        const incident = details.hasError
            ? `<div class="spon-alert">${(details.errorDetails && details.errorDetails.description) || 'Incidente registrado'}</div>`
            : '<span class="helper-text">Nenhum problema registrado.</span>';

        const checklist = details.checklist && details.checklist.doneAt
            ? TOTVSStorage.CHECKLIST_ITEMS
                .filter((item) => details.checklist[item.key])
                .map((item) => item.label)
                .join(' · ')
            : 'Pendente';

        const ownerLine = details.analystName
            ? `<span class="spon-owner">Responsável: <strong>${details.analystName}</strong></span>`
            : '<span class="spon-owner helper-text">Responsável oculto (visível ao gerente)</span>';

        const timeline = details.timeline.length
            ? details.timeline.slice(0, 12).map((entry) => `
                <li>
                    <span class="font-mono">${TOTVSStorage.formatDateTime(entry.createdAt)}</span>
                    <span>${entry.action}${entry.note ? ` · ${entry.note}` : ''}</span>
                    ${entry.actorName ? `<span class="helper-text">por ${entry.actorName}</span>` : ''}
                </li>
            `).join('')
            : '<li class="helper-text">Sem histórico registrado.</li>';

        return `
            <article class="spon-card">
                <header class="spon-card-head">
                    <div>
                        <strong class="font-mono">${details.hostname}</strong>
                        <span class="helper-text">${details.brand} · ${details.profile}</span>
                    </div>
                    ${buildStatus(machine)}
                </header>
                <div class="spon-meta">
                    <span>Data registrada: ${details.processDate || '--'}</span>
                    <span>Tempo total: <strong class="font-mono">${formatDuration(details.totalElapsedSeconds)}</strong></span>
                    ${ownerLine}
                </div>
                <h5>Procedimento por etapa</h5>
                <ul class="spon-steps">${stepRows}</ul>
                <h5>Problemas encontrados</h5>
                ${incident}
                <h5>Checklist final</h5>
                <p class="helper-text">${checklist}</p>
                ${details.notes ? `<h5>Observações</h5><p class="helper-text">${details.notes}</p>` : ''}
                <h5>Linha do tempo</h5>
                <ul class="spon-timeline">${timeline}</ul>
            </article>
        `;
    }

    function downloadAnalystJson() {
        if (runtime.currentUser.role !== 'manager') {
            showToast('Somente o gerente pode baixar o arquivo de outro analista.', '!');
            return;
        }

        syncState(true);
        const analyst = TOTVSStorage.getUserById(runtime.state, el('selectExportAnalyst').value);
        if (!analyst) {
            showToast('Selecione um analista valido.', '!');
            return;
        }

        const filename = `analista-${slugify(analyst.username)}.json`;
        const payload = TOTVSGithubSync.buildUserPayload(runtime.state, analyst);
        TOTVSImporterExporter.downloadJson(filename, payload);
        showToast(`Arquivo individual de ${analyst.displayName} exportado.`, 'ok');
    }

    function downloadAllAnalysts() {
        if (runtime.currentUser.role !== 'manager') {
            showToast('Somente o gerente pode baixar os arquivos individuais.', '!');
            return;
        }

        syncState(true);
        const analysts = TOTVSStorage.getAnalystUsers(runtime.state);
        if (!analysts.length) {
            showToast('Nenhum analista cadastrado.', '!');
            return;
        }

        analysts.forEach((analyst, position) => {
            setTimeout(() => {
                TOTVSGithubSync.markBusy(`Preparando pacote de ${analyst.displayName}...`);
                TOTVSImporterExporter.downloadJson(
                    `analista-${slugify(analyst.username)}.json`,
                    TOTVSGithubSync.buildUserPayload(runtime.state, analyst)
                );
            }, position * 500);
        });

        showToast(`${analysts.length} arquivo(s) individual(is) em download.`, 'ok');
    }

    function openManagementPanel() {
        if (runtime.currentUser.role !== 'manager') {
            showToast('O painel de gestao e exclusivo do gerente.', '!');
            return;
        }

        window.open('gestao.html', '_blank');
    }

    function bindFilters() {
        [
            'searchFilter',
            'filterSpon',
            'filterAnalyst',
            'filterStatus',
            'filterBrand',
            'filterProfile',
            'filterDateFrom',
            'filterDateTo',
            'sortMachines',
            'sortDirection'
        ].forEach((id) => {
            const node = el(id);
            if (!node) {
                return;
            }
            node.addEventListener('input', renderTable);
            node.addEventListener('change', renderTable);
        });
    }

    function bindTabButtons() {
        bySelector('.tab-btn').forEach((button) => {
            button.addEventListener('click', () => {
                bySelector('.tab-btn').forEach((item) => item.classList.remove('active'));
                bySelector('.tab-content').forEach((item) => item.classList.remove('active'));
                button.classList.add('active');
                el(button.getAttribute('data-tab')).classList.add('active');
            });
        });
    }

    function bindModalClose() {
        bySelector('[data-close-modal]').forEach((button) => {
            button.addEventListener('click', () => {
                closeModal(button.getAttribute('data-close-modal'));
            });
        });

        bySelector('.modal-backdrop').forEach((backdrop) => {
            backdrop.addEventListener('click', (event) => {
                if (event.target === backdrop) {
                    backdrop.classList.remove('active');
                }
            });
        });
    }

    function bindEvents() {
        el('loginForm').addEventListener('submit', handleLogin);
        el('btnLogout').addEventListener('click', handleLogout);
        el('machineForm').addEventListener('submit', handleMachineSubmit);
        el('btnResetForm').addEventListener('click', resetForm);
        el('checkHasError').addEventListener('change', toggleErrorField);
        el('checkManualEntry').addEventListener('change', toggleManualTimeFields);
        MANUAL_STEP_INPUTS.forEach((entry) => {
            el(entry.input).addEventListener('input', updateManualTotal);
        });
        el('machinesTableBody').addEventListener('click', handleTableActions);
        el('machinesTableBody').addEventListener('change', (event) => {
            if (event.target.matches('[data-select-machine-id]')) {
                syncSelectAllState();
                updateBulkBar();
            }
        });
        el('selectAllMachines').addEventListener('change', (event) => {
            setFilteredSelection(event.target.checked);
        });
        el('btnSelectAllFiltered').addEventListener('click', () => setFilteredSelection(true));
        el('btnClearFilters').addEventListener('click', clearFilters);
        el('chipToday').addEventListener('click', () => applyQuickRange('today'));
        el('chipYesterday').addEventListener('click', () => applyQuickRange('yesterday'));
        el('chipLast7').addEventListener('click', () => applyQuickRange('last7'));
        el('chipThisMonth').addEventListener('click', () => applyQuickRange('month'));
        el('chipFormToday').addEventListener('click', () => {
            el('inputProcessDate').value = TOTVSStorage.todayBrInput();
        });
        el('chipFormYesterday').addEventListener('click', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            el('inputProcessDate').value = quickRangeKey(yesterday);
        });
        el('btnToggleEntryCard').addEventListener('click', toggleEntryCard);
        el('btnOpenBulkEdit').addEventListener('click', openBulkEditModal);
        el('btnApplyBulkEdit').addEventListener('click', applyBulkEdit);
        el('btnBulkDelete').addEventListener('click', deleteSelectedMachines);
        el('btnMarkSwapped').addEventListener('click', markSelectedAsSwapped);
        el('btnClearSelection').addEventListener('click', clearSelection);
        el('btnOpenManagement').addEventListener('click', openManagementPanel);
        el('selectDataset').addEventListener('change', handleDatasetChange);
        el('btnCreateDataset').addEventListener('click', createDataset);
        el('btnDeleteDataset').addEventListener('click', deleteActiveDataset);
        el('btnOpenReports').addEventListener('click', openReportsModal);
        el('btnOpenSyncModal').addEventListener('click', openSyncModal);
        el('btnOpenPasswordModal').addEventListener('click', () => openModal('modalPassword'));
        el('btnPrintGeneralReport').addEventListener('click', printGeneralReport);
        el('btnPrintAnalystReport').addEventListener('click', printAnalystReport);
        el('btnPrintGeneralCharts').addEventListener('click', printGeneralCharts);
        el('btnPrintAnalystCharts').addEventListener('click', printAnalystCharts);
        el('btnDownloadGeneralJson').addEventListener('click', downloadGeneralJson);
        el('btnDownloadMyJson').addEventListener('click', downloadMyJson);
        el('btnDownloadUsersJson').addEventListener('click', downloadUsersJson);
        el('btnDownloadSnapshot').addEventListener('click', downloadSnapshot);
        el('fileRestoreBackup').addEventListener('change', (event) => restoreSnapshot(event.target.files[0]));
        el('btnCopyForSheets').addEventListener('click', copySheets);
        el('btnCopyForWhatsapp').addEventListener('click', copyWhatsapp);
        el('btnSelectTxtReport').addEventListener('click', selectReportText);
        el('btnCopyTxtReport').addEventListener('click', copyReportText);
        el('ownPasswordForm').addEventListener('submit', changeOwnPassword);
        el('resetPasswordForm').addEventListener('submit', resetUserPassword);
        el('reportAnalystSelect').addEventListener('change', updateReportPreview);
        el('btnGhSaveConfig').addEventListener('click', saveGithubConfig);
        el('btnGhTest').addEventListener('click', testGithubConnection);
        el('btnGhPush').addEventListener('click', pushNow);
        el('btnGhPull').addEventListener('click', () => pullNow(false));
        el('btnGhPublished').addEventListener('click', () => pullPublished(false));
        el('btnDownloadAnalystJson').addEventListener('click', downloadAnalystJson);
        el('btnDownloadAllAnalysts').addEventListener('click', downloadAllAnalysts);
        el('ghAutoSync').addEventListener('change', () => {
            const config = TOTVSGithubSync.getConfig();
            if (!config) {
                return;
            }
            TOTVSGithubSync.saveConfig({ ...config, autoSync: el('ghAutoSync').checked });
            renderGithubStatus(TOTVSGithubSync.getStatus());
        });

        // Checklist final.
        el('btnOpenChecklist').addEventListener('click', () => openChecklistModal());
        el('btnChecklistSearch').addEventListener('click', searchChecklistSpon);
        el('checklistSponSearch').addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                searchChecklistSpon();
            }
        });
        el('checklistResult').addEventListener('click', (event) => {
            const button = event.target.closest('[data-checklist-start]');
            if (button) {
                startChecklist(button.getAttribute('data-checklist-start'));
            }
        });
        CHECKLIST_CHECK_IDS.forEach((id) => {
            if (el(id)) {
                el(id).addEventListener('change', updateChecklistSubmitState);
            }
        });
        el('btnSubmitChecklist').addEventListener('click', submitChecklist);

        // Consulta de SPON.
        el('btnOpenSponLookup').addEventListener('click', openSponLookup);
        el('btnSponLookup').addEventListener('click', lookupSpon);
        el('sponLookupInput').addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                lookupSpon();
            }
        });

        // Botao de re-vinculo do chip de sincronizacao.
        const syncRetryBtn = el('btnSyncRetry');
        if (syncRetryBtn) {
            syncRetryBtn.addEventListener('click', retryAutoLink);
        }

        bindFilters();
        bindTabButtons();
        bindModalClose();
    }

    // Antes de mostrar o login, tenta trazer as credenciais publicadas: assim a senha
    // trocada em outra maquina ja vale aqui e a senha padrao deixa de voltar.
    async function syncCredentialsBeforeLogin() {
        try {
            if (TOTVSGithubSync.isConfigured()) {
                const bundle = await TOTVSGithubSync.fetchBundle();
                TOTVSStorage.mergeRemoteBundle(bundle, null);
                return;
            }

            const bundle = await TOTVSGithubSync.fetchPublishedBundle();
            if (bundle) {
                TOTVSStorage.mergeRemoteBundle(bundle, null);
            }
        } catch (error) {
            // Offline ou repositorio indisponivel: segue com o estado local.
            console.warn('Credenciais remotas indisponiveis:', error.message);
        }
    }

    async function initSession() {
        syncState(true);
        if (runtime.currentUser) {
            openAppView();
            return;
        }

        await syncCredentialsBeforeLogin();
        syncState();
        openLoginView();
    }

    async function init() {
        TOTVSGithubSync.init();
        TOTVSGithubSync.onStatus(renderGithubStatus);
        startLocalClock();
        bindEvents();
        renderGithubStatus(TOTVSGithubSync.getStatus());
        // Vincula automaticamente ao GitHub quando ainda nao ha configuracao.
        // Nao bloqueia a tela: a validacao da conexao roda em segundo plano.
        bootstrapAutoLink();
        await initSession();
        startViewTimers();
        console.log('TOTVS Field Refresh 2026 inicializado.');
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        deleteMachine,
        nextMachineStep,
        openEditMachine,
        pauseMachineTimer,
        startMachineTimer
    };
})();
