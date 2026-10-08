/*
 * TOTVS Field Refresh 2026 - Filtros e ordenacao (modulo puro)
 * ---------------------------------------------------------------------------
 * Sem acesso ao DOM de proposito: as duas telas (operacional e gestao) usam a
 * mesma regra, cada uma com a sua interface. Assim a busca por SPON, o intervalo
 * de datas e a ordenacao se comportam exatamente igual nos dois paineis.
 *
 * O contexto recebido e: { analystName(machine) -> texto }
 */
const TOTVSFilters = (() => {
    const SORT_OPTIONS = [
        { key: 'updatedAt', label: 'Última atualização' },
        { key: 'processDate', label: 'Data registrada' },
        { key: 'preparedAt', label: 'Preparada em' },
        { key: 'hostname', label: 'Hostname (SPON)' },
        { key: 'analyst', label: 'Analista' },
        { key: 'step', label: 'Etapa atual' },
        { key: 'status', label: 'Status' },
        { key: 'totalTime', label: 'Tempo total' }
    ];

    const STATUS_OPTIONS = [
        { value: 'ALL', label: 'Todos os status' },
        { value: 'PREPARADA', label: 'Preparada (aguardando troca)' },
        { value: 'TROCADA', label: 'Trocada' },
        { value: 'EM_ANDAMENTO', label: 'Em andamento' },
        { value: 'PAUSADO', label: 'Pausado' },
        { value: 'CONCLUIDO', label: 'Concluída (preparada)' },
        { value: 'ERRO', label: 'Incidente' }
    ];

    const STATUS_LABELS = {
        PREPARADA: 'Preparada',
        TROCADA: 'Trocada',
        EM_ANDAMENTO: 'Em andamento',
        PAUSADO: 'Pausado',
        ERRO: 'Incidente'
    };

    function toDateKey(value) {
        if (!value) {
            return null;
        }
        const raw = String(value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            return raw;
        }
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${date.getFullYear()}-${month}-${day}`;
    }

    function analystNameOf(machine, context) {
        if (context && typeof context.analystName === 'function') {
            return context.analystName(machine) || '';
        }
        return '';
    }

    function isPrepared(machine) {
        return Boolean(machine) && (machine.status === 'CONCLUIDO' || Boolean(machine.preparedAt));
    }

    // Chave unica de status, usada tanto no filtro quanto na ordenacao.
    function statusKey(machine) {
        if (!machine) return 'PAUSADO';
        if (machine.swappedAt) return 'TROCADA';
        if (machine.hasError || machine.status === 'ERRO') return 'ERRO';
        if (machine.status === 'CONCLUIDO') return 'PREPARADA';
        if (machine.status === 'EM_ANDAMENTO') return 'EM_ANDAMENTO';
        return 'PAUSADO';
    }

    function statusLabel(machine) {
        return STATUS_LABELS[statusKey(machine)] || 'Pausado';
    }

    function matchesSearch(machine, analystName, term) {
        const needle = String(term || '').trim().toLowerCase();
        if (!needle) {
            return true;
        }

        const haystack = [
            machine.hostname,
            analystName,
            machine.currentStep,
            machine.status,
            machine.brand,
            machine.profile,
            machine.processDate || '',
            machine.notes || '',
            machine.errorDetails ? (machine.errorDetails.description || '') : ''
        ].join(' ').toLowerCase();

        return haystack.includes(needle);
    }

    function matchesSpon(machine, term) {
        const needle = String(term || '').trim().toLowerCase();
        if (!needle) {
            return true;
        }
        return String(machine.hostname || '').toLowerCase().includes(needle);
    }

    function matchesStatus(machine, statusFilter) {
        if (!statusFilter || statusFilter === 'ALL') {
            return true;
        }
        if (statusFilter === 'CONCLUIDO') {
            return machine.status === 'CONCLUIDO';
        }
        return statusKey(machine) === statusFilter;
    }

    function dateKeyFor(machine, field) {
        if (field === 'preparedAt') {
            return toDateKey(machine.processDate) || toDateKey(machine.preparedAt);
        }
        if (field === 'updatedAt') {
            return toDateKey(machine.updatedAt);
        }
        return toDateKey(machine.processDate);
    }

    function applyFilters(machines, options, context) {
        const config = options || {};
        const list = Array.isArray(machines) ? machines : [];
        const field = config.dateField || 'processDate';

        return list.filter((machine) => {
            const analystName = analystNameOf(machine, context);
            const key = dateKeyFor(machine, field);

            if (config.analystId && config.analystId !== 'ALL' && machine.analystId !== config.analystId) {
                return false;
            }
            if (config.brand && config.brand !== 'ALL' && machine.brand !== config.brand) {
                return false;
            }
            if (config.profile && config.profile !== 'ALL' && machine.profile !== config.profile) {
                return false;
            }
            if (!matchesStatus(machine, config.status)) {
                return false;
            }
            if (!matchesSpon(machine, config.spon)) {
                return false;
            }
            if (!matchesSearch(machine, analystName, config.search)) {
                return false;
            }
            if (config.dateFrom && (!key || key < config.dateFrom)) {
                return false;
            }
            if (config.dateTo && (!key || key > config.dateTo)) {
                return false;
            }

            return true;
        });
    }

    function compareText(left, right) {
        return String(left || '').localeCompare(String(right || ''), 'pt-BR', { numeric: true });
    }

    function comparatorFor(sortKey, context) {
        switch (sortKey) {
            case 'hostname':
                return (left, right) => compareText(left.hostname, right.hostname);
            case 'analyst':
                return (left, right) => compareText(analystNameOf(left, context), analystNameOf(right, context));
            case 'step':
                return (left, right) => compareText(left.currentStep, right.currentStep);
            case 'status':
                return (left, right) => compareText(statusKey(left), statusKey(right));
            case 'totalTime':
                return (left, right) => Number(left.totalElapsedSeconds || 0) - Number(right.totalElapsedSeconds || 0);
            case 'processDate':
                return (left, right) => compareText(
                    dateKeyFor(left, 'processDate') || '',
                    dateKeyFor(right, 'processDate') || ''
                );
            case 'preparedAt':
                return (left, right) => compareText(
                    dateKeyFor(left, 'preparedAt') || toDateKey(left.preparedAt) || '',
                    dateKeyFor(right, 'preparedAt') || toDateKey(right.preparedAt) || ''
                );
            case 'updatedAt':
            default:
                return (left, right) => new Date(left.updatedAt || left.createdAt || 0).getTime()
                    - new Date(right.updatedAt || right.createdAt || 0).getTime();
        }
    }

    function sortMachines(machines, sortKey, direction, context) {
        const list = (Array.isArray(machines) ? machines : []).slice();
        const compare = comparatorFor(sortKey || 'updatedAt', context);
        const factor = direction === 'asc' ? 1 : -1;

        // Empate resolvido por hostname para a lista ficar sempre estavel.
        return list.sort((left, right) => {
            const result = compare(left, right);
            if (result !== 0) {
                return result * factor;
            }
            return compareText(left.hostname, right.hostname);
        });
    }

    function filterAndSort(machines, options, context) {
        const config = options || {};
        return sortMachines(
            applyFilters(machines, config, context),
            config.sortKey || 'updatedAt',
            config.sortDirection || 'desc',
            context
        );
    }

    function summarize(machines) {
        const summary = {
            total: 0,
            prepared: 0,
            swapped: 0,
            waitingSwap: 0,
            inProgress: 0,
            paused: 0,
            errors: 0,
            hosts: []
        };

        (Array.isArray(machines) ? machines : []).forEach((machine) => {
            summary.total += 1;
            summary.hosts.push(machine.hostname);

            if (isPrepared(machine)) {
                summary.prepared += 1;
            }
            if (machine.swappedAt) {
                summary.swapped += 1;
            } else if (isPrepared(machine)) {
                summary.waitingSwap += 1;
            }
            if (machine.hasError || machine.status === 'ERRO') {
                summary.errors += 1;
            }
            if (machine.status === 'EM_ANDAMENTO') {
                summary.inProgress += 1;
            }
            if (machine.status === 'PAUSADO') {
                summary.paused += 1;
            }
        });

        return summary;
    }

    // Blocos de <option> prontos, usados pelas duas telas.
    function sortOptionsHtml(selected) {
        return SORT_OPTIONS.map((option) => (
            `<option value="${option.key}"${option.key === selected ? ' selected' : ''}>${option.label}</option>`
        )).join('');
    }

    function statusOptionsHtml(selected) {
        return STATUS_OPTIONS.map((option) => (
            `<option value="${option.value}"${option.value === selected ? ' selected' : ''}>${option.label}</option>`
        )).join('');
    }

    return {
        SORT_OPTIONS,
        STATUS_OPTIONS,
        applyFilters,
        dateKeyFor,
        filterAndSort,
        isPrepared,
        matchesSearch,
        matchesSpon,
        matchesStatus,
        sortMachines,
        sortOptionsHtml,
        statusKey,
        statusLabel,
        statusOptionsHtml,
        summarize,
        toDateKey
    };
})();
