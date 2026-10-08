const TOTVSImporterExporter = (() => {
    function formatTimeFriendly(seconds) {
        const total = Number(seconds || 0);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        if (hours > 0) {
            return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
        }
        return `${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }

    function getAnalystName(state, machine) {
        return TOTVSStorage.getAnalystName(state, machine.analystId);
    }

    function exportToTSV(state, machines) {
        const headers = [
            'Data',
            'Hostname',
            'Analista',
            'Fabricante',
            'Perfil',
            'Status',
            'Etapa Atual',
            'Tempo Total',
            'Tempo 1 - BIOS',
            'Tempo 2 - Windows Update',
            'Tempo 3 - ADM e Drivers',
            'Tempo 4 - Dominio e Argus',
            'Possui Erro',
            'Descricao Erro',
            'Observacoes',
            'Atualizado Em'
        ];

        const rows = machines.map((machine) => [
            machine.processDate || '',
            machine.hostname || '',
            getAnalystName(state, machine),
            machine.brand || '',
            machine.profile || '',
            machine.status || '',
            machine.currentStep || '',
            formatTimeFriendly(machine.totalElapsedSeconds),
            formatTimeFriendly(machine.stepDurations['1 FORMATAÇÃO E BIOS']),
            formatTimeFriendly(machine.stepDurations['2 WINDOWS UPDATE']),
            formatTimeFriendly(machine.stepDurations['3 ATIVAR ADM E SUBIR DRIVERS']),
            formatTimeFriendly(machine.stepDurations['4 DOMINIO E ARGUS']),
            machine.hasError ? 'SIM' : 'NAO',
            machine.errorDetails ? (machine.errorDetails.description || '') : '',
            (machine.notes || '').replace(/\t|\r?\n/g, ' '),
            TOTVSStorage.formatDateTime(machine.updatedAt)
        ].join('\t'));

        return [headers.join('\t'), ...rows].join('\r\n');
    }

    function exportToWhatsAppReport(state, machines, currentUser, selectedAnalystId = 'ALL') {
        const filtered = selectedAnalystId === 'ALL'
            ? machines
            : machines.filter((machine) => machine.analystId === selectedAnalystId);

        const done = filtered.filter((machine) => machine.status === 'CONCLUIDO').length;
        const wip = filtered.filter((machine) => machine.status === 'EM_ANDAMENTO').length;
        const paused = filtered.filter((machine) => machine.status === 'PAUSADO').length;
        const errors = filtered.filter((machine) => machine.hasError || machine.status === 'ERRO').length;
        const dataset = TOTVSStorage.getDatasetById(state, state.activeDatasetId);

        let text = '*TOTVS FIELD REFRESH 2026 - RELATORIO OPERACIONAL*\n';
        text += `_Emitido em ${new Date().toLocaleString('pt-BR')}_\n`;
        text += `*Lote:* ${dataset ? dataset.name : 'Principal'}\n`;
        text += `*Perfil emissor:* ${currentUser.displayName}\n`;
        text += `--------------------------------------------------\n`;
        text += `• Total: *${filtered.length}*\n`;
        text += `• Em andamento: *${wip}*\n`;
        text += `• Concluidas: *${done}*\n`;
        text += `• Pausadas: *${paused}*\n`;
        text += `• Incidentes: *${errors}*\n`;
        text += `--------------------------------------------------\n\n`;

        if (!filtered.length) {
            text += '_Nenhum registro encontrado._';
            return text;
        }

        filtered.forEach((machine, index) => {
            text += `${index + 1}. *${machine.hostname}* | ${getAnalystName(state, machine)}\n`;
            text += `   Data: ${machine.processDate || '--'}\n`;
            text += `   Etapa: ${machine.currentStep}\n`;
            text += `   Status: ${machine.status}\n`;
            text += `   Tempo total: ${formatTimeFriendly(machine.totalElapsedSeconds)}\n`;
            text += `   BIOS: ${formatTimeFriendly(machine.stepDurations['1 FORMATAÇÃO E BIOS'])}\n`;
            text += `   Windows Update: ${formatTimeFriendly(machine.stepDurations['2 WINDOWS UPDATE'])}\n`;
            text += `   ADM/Drivers: ${formatTimeFriendly(machine.stepDurations['3 ATIVAR ADM E SUBIR DRIVERS'])}\n`;
            text += `   Dominio/Argus: ${formatTimeFriendly(machine.stepDurations['4 DOMINIO E ARGUS'])}\n`;
            if (machine.hasError && machine.errorDetails) {
                text += `   Erro: ${machine.errorDetails.description}\n`;
            }
            if (machine.notes) {
                text += `   Obs: ${machine.notes}\n`;
            }
            text += '\n';
        });

        text += 'DB4 Serv for Totvs by Isaque de Medeiros';
        return text;
    }

    function buildGeneralExport(state) {
        const dataset = TOTVSStorage.getDatasetById(state, state.activeDatasetId);
        const machines = TOTVSStorage.getAllMachinesByDataset(state);
        return {
            version: state.version,
            exportedAt: new Date().toISOString(),
            organization: state.organization,
            dataset,
            deletedMachines: state.deletedMachines || {},
            summary: TOTVSReports.calculateMetrics(state, machines),
            records: machines.map((machine) => ({
                id: machine.id,
                hostname: machine.hostname,
                analyst: getAnalystName(state, machine),
                brand: machine.brand,
                profile: machine.profile,
                processDate: machine.processDate,
                currentStep: machine.currentStep,
                status: machine.status,
                totalElapsedSeconds: machine.totalElapsedSeconds,
                stepDurations: machine.stepDurations,
                hasError: machine.hasError,
                errorDetails: machine.errorDetails,
                notes: machine.notes,
                createdAt: machine.createdAt,
                updatedAt: machine.updatedAt,
                completedAt: machine.completedAt
            }))
        };
    }

    function buildUserExport(state, userId) {
        const targetUser = TOTVSStorage.getUserById(state, userId);
        const machines = TOTVSStorage
            .getAllMachinesByDataset(state)
            .filter((machine) => machine.analystId === userId);

        return {
            exportedAt: new Date().toISOString(),
            organization: state.organization,
            user: targetUser ? {
                id: targetUser.id,
                username: targetUser.username,
                displayName: targetUser.displayName,
                role: targetUser.role
            } : null,
            summary: TOTVSReports.calculateMetrics(state, machines),
            records: machines
        };
    }

    function buildUsersExport(state) {
        return {
            exportedAt: new Date().toISOString(),
            organization: state.organization,
            users: TOTVSStorage.getSanitizedUsers(state)
        };
    }

    function buildFullSnapshot(state) {
        return {
            version: state.version,
            exportedAt: new Date().toISOString(),
            organization: state.organization,
            datasets: state.datasets,
            activeDatasetId: state.activeDatasetId,
            users: state.users,
            machines: state.machines,
            deletedMachines: state.deletedMachines || {},
            auditTrail: state.auditTrail
        };
    }

    function downloadJson(filename, data) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    return {
        buildFullSnapshot,
        buildGeneralExport,
        buildUserExport,
        buildUsersExport,
        downloadJson,
        exportToTSV,
        exportToWhatsAppReport,
        formatTimeFriendly
    };
})();
