const TOTVSStorage = (() => {
    const APP_STATE_KEY = 'TOTVS_REFRESH_2026_STATE_V3';
    const SESSION_KEY = 'TOTVS_REFRESH_2026_SESSION_V3';
    const LEGACY_PREFIX = 'TOTVS_REFRESH_2026_';
    const MANAGEMENT_KEY = 'TOTVS_REFRESH_2026_GESTAO_V1';
    const MASTER_RESET_SECRET = 'FieldTotvs2026';
    const TOTAL_PROJECT_GOAL = 1000;
    const ANALYST_GOAL = 250;

    const PROCESS_STEPS = [
        '1 FORMATAÇÃO E BIOS',
        '2 WINDOWS UPDATE',
        '3 ATIVAR ADM E SUBIR DRIVERS',
        '4 DOMINIO E ARGUS'
    ];

    function sha256(ascii) {
        const mathPow = Math.pow;
        const maxWord = mathPow(2, 32);
        const lengthProperty = 'length';
        let i;
        let j;
        let result = '';

        const words = [];
        const asciiBitLength = ascii[lengthProperty] * 8;
        const hash = [];
        const k = [];
        let primeCounter = k[lengthProperty];
        const isComposite = {};

        for (let candidate = 2; primeCounter < 64; candidate += 1) {
            if (!isComposite[candidate]) {
                for (i = 0; i < 313; i += candidate) {
                    isComposite[i] = candidate;
                }
                hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
                k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
                primeCounter += 1;
            }
        }

        ascii += '\x80';
        while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';

        for (i = 0; i < ascii[lengthProperty]; i += 1) {
            j = ascii.charCodeAt(i);
            words[i >> 2] |= j << (((3 - i) % 4) * 8);
        }

        words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
        words[words[lengthProperty]] = asciiBitLength;

        for (j = 0; j < words[lengthProperty];) {
            const w = words.slice(j, (j += 16));
            const oldHash = hash.slice(0);
            let a = hash[0];
            let b = hash[1];
            let c = hash[2];
            let d = hash[3];
            let e = hash[4];
            let f = hash[5];
            let g = hash[6];
            let h = hash[7];

            for (i = 0; i < 64; i += 1) {
                const i2 = i + j;
                let w15 = w[i - 15];
                let w2 = w[i - 2];
                const aSigma =
                    ((e >>> 6) | (e << 26)) ^
                    ((e >>> 11) | (e << 21)) ^
                    ((e >>> 25) | (e << 7));
                const choice = (e & f) ^ (~e & g);
                const temp1 = (h + aSigma + choice + k[i] + (w[i] = i < 16 ? w[i] : (
                    w[i - 16] +
                    ((((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3))) +
                    w[i - 7] +
                    ((((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10)))
                ) | 0)) | 0;
                const eSigma =
                    ((a >>> 2) | (a << 30)) ^
                    ((a >>> 13) | (a << 19)) ^
                    ((a >>> 22) | (a << 10));
                const majority = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (eSigma + majority) | 0;

                h = g;
                g = f;
                f = e;
                e = (d + temp1) | 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) | 0;
            }

            hash[0] = (hash[0] + a) | 0;
            hash[1] = (hash[1] + b) | 0;
            hash[2] = (hash[2] + c) | 0;
            hash[3] = (hash[3] + d) | 0;
            hash[4] = (hash[4] + e) | 0;
            hash[5] = (hash[5] + f) | 0;
            hash[6] = (hash[6] + g) | 0;
            hash[7] = (hash[7] + h) | 0;

            for (i = 0; i < 8; i += 1) {
                hash[i] = hash[i] | 0;
            }
        }

        for (i = 0; i < 8; i += 1) {
            for (j = 3; j + 1; j -= 1) {
                const bCode = (hash[i] >> (j * 8)) & 255;
                result += ((bCode < 16) ? 0 : '') + bCode.toString(16);
            }
        }
        return result;
    }

    function slugify(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function uid(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function todayBrInput() {
        const date = new Date();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${date.getFullYear()}-${month}-${day}`;
    }

    function isoToDateKey(value) {
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

    function formatDateTime(isoDate) {
        if (!isoDate) return '--';
        return new Date(isoDate).toLocaleString('pt-BR');
    }

    /* --------------------------- Credenciais de acesso ---------------------------
     * A senha nunca sai da maquina em texto: o que viaja no repositorio e um hash
     * com salt aleatorio e varias iteracoes (PBKDF2-SHA256 quando o navegador
     * suporta WebCrypto; SHA-256 iterado como reserva).
     *
     * O `passwordHash` antigo (SHA-256 puro, sem salt) continua aceito apenas para
     * compatibilidade e e REMOVIDO no primeiro login valido. Era exatamente isso
     * que fazia a senha padrao voltar a funcionar depois de uma troca.
     * -------------------------------------------------------------------------- */

    const PBKDF2_ITERATIONS = 150000;
    const ITERATED_SHA256_ROUNDS = 400;

    let credentialsUpgradedOnLogin = false;

    function supportsWebCrypto() {
        // O smoke test liga esta flag para usar o SHA-256 iterado (sincrono): sob o
        // --virtual-time-budget do validate.ps1 o PBKDF2 consome tempo de relogio
        // virtual e travava o relatorio. As telas da aplicacao seguem com PBKDF2.
        if (typeof window !== 'undefined' && window.__TOTVS_TEST_WEAK_HASH__) {
            return false;
        }
        return Boolean(
            typeof window !== 'undefined'
            && window.crypto
            && window.crypto.subtle
            && typeof window.crypto.subtle.deriveBits === 'function'
        );
    }

    function randomHex(byteLength) {
        const bytes = new Uint8Array(byteLength);
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(bytes);
        } else {
            for (let index = 0; index < byteLength; index += 1) {
                bytes[index] = Math.floor(Math.random() * 256);
            }
        }
        return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    function hexToBytes(hex) {
        const clean = String(hex || '').replace(/[^0-9a-f]/gi, '');
        const bytes = new Uint8Array(Math.floor(clean.length / 2));
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = parseInt(clean.substr(index * 2, 2), 16);
        }
        return bytes;
    }

    function bytesToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    function iteratedSha256(password, saltHex, rounds) {
        let value = `${saltHex}\u0000${password}`;
        const total = Math.max(1, Math.floor(Number(rounds) || 1));
        for (let index = 0; index < total; index += 1) {
            value = sha256(value);
        }
        return value;
    }

    async function pbkdf2Hash(password, saltHex, iterations) {
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(String(password || '')),
            'PBKDF2',
            false,
            ['deriveBits']
        );
        const bits = await window.crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: hexToBytes(saltHex),
                iterations: Math.max(1, Math.floor(Number(iterations) || PBKDF2_ITERATIONS)),
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );
        return bytesToHex(bits);
    }

    function normalizeCredentials(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }

        const hash = String(raw.hash || '').trim();
        const salt = String(raw.salt || '').trim();
        const algo = raw.algo === 'sha256-iter' ? 'sha256-iter'
            : (raw.algo === 'pbkdf2-sha256' ? 'pbkdf2-sha256' : '');

        if (!hash || !salt || !algo) {
            return null;
        }
        if (algo === 'pbkdf2-sha256' && !supportsWebCrypto()) {
            return null;
        }

        return {
            algo,
            iterations: Math.max(
                1,
                Math.floor(Number(raw.iterations) || (algo === 'pbkdf2-sha256' ? PBKDF2_ITERATIONS : ITERATED_SHA256_ROUNDS))
            ),
            salt,
            hash,
            updatedAt: raw.updatedAt || null
        };
    }

    async function createCredentials(password) {
        const secret = String(password || '');
        const salt = randomHex(16);

        if (supportsWebCrypto()) {
            return {
                algo: 'pbkdf2-sha256',
                iterations: PBKDF2_ITERATIONS,
                salt,
                hash: await pbkdf2Hash(secret, salt, PBKDF2_ITERATIONS),
                updatedAt: nowIso()
            };
        }

        return {
            algo: 'sha256-iter',
            iterations: ITERATED_SHA256_ROUNDS,
            salt,
            hash: iteratedSha256(secret, salt, ITERATED_SHA256_ROUNDS),
            updatedAt: nowIso()
        };
    }

    // Retorna { ok, error }. Nunca cai para a senha padrao quando existe credencial
    // cadastrada - era esse o furo que reabria o login antigo.
    async function checkPassword(user, password) {
        if (!user) {
            return { ok: false, error: 'Usuário não encontrado.' };
        }

        const raw = user.credentials;
        if (raw && typeof raw === 'object' && raw.hash && raw.salt) {
            if (raw.algo === 'pbkdf2-sha256' && !supportsWebCrypto()) {
                return {
                    ok: false,
                    error: 'Este navegador nao valida senha segura (PBKDF2). Use Chrome/Edge atualizado ou HTTPS.'
                };
            }
            const attempt = raw.algo === 'sha256-iter'
                ? iteratedSha256(String(password || ''), raw.salt, raw.iterations)
                : await pbkdf2Hash(String(password || ''), raw.salt, raw.iterations);
            return { ok: attempt === raw.hash };
        }

        if (user.passwordHash) {
            return { ok: user.passwordHash === sha256(String(password || '')) };
        }

        // Usuario sem nenhuma credencial: vale a senha inicial do projeto.
        return { ok: sha256(String(password || '')) === sha256(MASTER_RESET_SECRET) };
    }

    // Aplica a credencial vinda do repositorio somente quando ela e mais recente.
    function applyRemoteCredentials(user, remoteCredentials) {
        const normalized = normalizeCredentials(remoteCredentials);
        if (!user || !normalized) {
            return false;
        }

        const localTime = normalizeCredentials(user.credentials)
            ? new Date(user.credentials.updatedAt || 0).getTime()
            : 0;
        const remoteTime = new Date(normalized.updatedAt || 0).getTime();

        if (localTime && remoteTime <= localTime) {
            return false;
        }

        user.credentials = normalized;
        delete user.passwordHash;
        return true;
    }

    function getCredentialsSnapshot(user) {
        return normalizeCredentials(user && user.credentials) || null;
    }

    function createDefaultUsers() {
        const passwordHash = sha256(MASTER_RESET_SECRET);
        return [
            {
                id: 'user_manager',
                username: 'gerente',
                displayName: 'Gerente de Projeto',
                role: 'manager',
                passwordHash,
                active: true,
                createdAt: nowIso(),
                updatedAt: nowIso()
            },
            {
                id: 'user_isaque',
                username: 'isaque',
                displayName: 'Isaque',
                role: 'analyst',
                passwordHash,
                active: true,
                createdAt: nowIso(),
                updatedAt: nowIso()
            },
            {
                id: 'user_vinicius',
                username: 'vinicius',
                displayName: 'Vinicius',
                role: 'analyst',
                passwordHash,
                active: true,
                createdAt: nowIso(),
                updatedAt: nowIso()
            },
            {
                id: 'user_guilherme',
                username: 'guilherme',
                displayName: 'Guilherme',
                role: 'analyst',
                passwordHash,
                active: true,
                createdAt: nowIso(),
                updatedAt: nowIso()
            },
            {
                id: 'user_davi',
                username: 'davi',
                displayName: 'Davi',
                role: 'analyst',
                passwordHash,
                active: true,
                createdAt: nowIso(),
                updatedAt: nowIso()
            }
        ];
    }

    function createDefaultState() {
        return {
            version: '3.0.0',
            organization: {
                appName: 'TOTVS Field Refresh 2026',
                signature: 'DB4 Serv for Totvs by Isaque de Medeiros',
                totalGoal: TOTAL_PROJECT_GOAL,
                analystGoal: ANALYST_GOAL
            },
            datasets: [
                {
                    id: 'dataset_principal',
                    name: 'Operação Principal',
                    createdAt: nowIso()
                }
            ],
            activeDatasetId: 'dataset_principal',
            users: createDefaultUsers(),
            machines: [],
            deletedMachines: {},
            auditTrail: []
        };
    }

    function saveState(state) {
        localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
        return state;
    }

    function getUserById(state, userId) {
        return state.users.find((user) => user.id === userId) || null;
    }

    function getUserByUsername(state, username) {
        return state.users.find((user) => user.username === username) || null;
    }

    function getAnalystUsers(state) {
        return state.users.filter((user) => user.role === 'analyst' && user.active);
    }

    // Responsaveis que podem receber maquinas: os analistas e o proprio gerente
    // (quando ele registra no proprio nome).
    function getResponsibleUsers(state) {
        const analysts = getAnalystUsers(state);
        const managers = state.users.filter((user) => user.role === 'manager' && user.active);
        return analysts.concat(managers);
    }

    function getDatasetById(state, datasetId) {
        return state.datasets.find((dataset) => dataset.id === datasetId) || null;
    }

    function getSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.error('Erro ao ler sessão:', error);
            return null;
        }
    }

    function setSession(sessionData) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    function getCurrentUser(state) {
        const session = getSession();
        if (!session) return null;
        return getUserById(state, session.userId);
    }

    function ensureStateShape(state) {
        if (!state || typeof state !== 'object') {
            return saveState(createDefaultState());
        }

        state.version = state.version || '3.0.0';
        state.organization = state.organization || createDefaultState().organization;
        state.datasets = Array.isArray(state.datasets) && state.datasets.length
            ? state.datasets
            : createDefaultState().datasets;
        state.activeDatasetId = state.activeDatasetId || state.datasets[0].id;
        state.users = Array.isArray(state.users) && state.users.length
            ? state.users
            : createDefaultUsers();
        state.machines = Array.isArray(state.machines) ? state.machines : [];
        state.auditTrail = Array.isArray(state.auditTrail) ? state.auditTrail : [];

        // Registro de exclusoes (tombstones). O merge com o repositorio so sabe
        // somar por id, entao sem esta lista toda maquina apagada voltaria no
        // proximo pull -- inclusive vinda de um arquivo de analista desatualizado.
        state.deletedMachines = (state.deletedMachines && typeof state.deletedMachines === 'object')
            ? state.deletedMachines
            : {};

        state.users = state.users.map((user) => ({
            active: true,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            ...user
        }));

        state.machines = state.machines.map((machine) => normalizeMachine(state, machine));
        applyDeletions(state);
        return saveState(state);
    }

    function migrateLegacyState() {
        const datasetsRaw = localStorage.getItem(`${LEGACY_PREFIX}DATASETS_LIST`);
        const activeDatasetId = localStorage.getItem(`${LEGACY_PREFIX}ACTIVE_ID`);
        if (!datasetsRaw) {
            return null;
        }

        try {
            const defaultState = createDefaultState();
            const legacyDatasets = JSON.parse(datasetsRaw) || [];
            const datasets = legacyDatasets.length
                ? legacyDatasets.map((dataset) => ({
                    id: dataset.id,
                    name: dataset.name,
                    createdAt: dataset.createdAt || nowIso()
                }))
                : defaultState.datasets;

            const users = defaultState.users;
            const machines = [];

            datasets.forEach((dataset) => {
                const raw = localStorage.getItem(`${LEGACY_PREFIX}DATA_${dataset.id}`);
                if (!raw) return;
                const list = JSON.parse(raw) || [];

                list.forEach((machine) => {
                    const analystMatch = users.find((user) => user.displayName === machine.analyst) || users[1];
                    machines.push(normalizeMachine({
                        users,
                        activeDatasetId: dataset.id
                    }, {
                        ...machine,
                        datasetId: dataset.id,
                        analystId: analystMatch.id,
                        processDate: machine.processDate || todayBrInput()
                    }));
                });
            });

            return {
                ...defaultState,
                datasets,
                activeDatasetId: activeDatasetId || datasets[0].id,
                machines
            };
        } catch (error) {
            console.error('Falha ao migrar storage antigo:', error);
            return null;
        }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(APP_STATE_KEY);
            if (raw) {
                return ensureStateShape(JSON.parse(raw));
            }

            const legacyState = migrateLegacyState();
            if (legacyState) {
                return saveState(legacyState);
            }

            return saveState(createDefaultState());
        } catch (error) {
            console.error('Erro ao carregar estado:', error);
            return saveState(createDefaultState());
        }
    }

    function audit(state, action, actorId, details) {
        state.auditTrail.unshift({
            id: uid('audit'),
            action,
            actorId,
            details,
            createdAt: nowIso()
        });
        state.auditTrail = state.auditTrail.slice(0, 300);
    }

    function getAnalystName(state, analystId) {
        const user = getUserById(state, analystId);
        return user ? user.displayName : 'Sem analista';
    }

    function normalizeMachine(state, machine) {
        const currentStep = machine.currentStep && machine.currentStep !== 'CONCLUIDO'
            ? machine.currentStep
            : PROCESS_STEPS[Math.max(0, Math.min(PROCESS_STEPS.length - 1, machine.currentStepIndex || 0))];
        const currentStepIndex = machine.currentStep === 'CONCLUIDO'
            ? PROCESS_STEPS.length
            : Math.max(0, PROCESS_STEPS.indexOf(currentStep));
        const stepDurations = machine.stepDurations || {};
        const normalizedStepDurations = {};
        PROCESS_STEPS.forEach((step) => {
            normalizedStepDurations[step] = Number(stepDurations[step] || 0);
        });

        const analystId = machine.analystId || (getAnalystUsers(state)[0] ? getAnalystUsers(state)[0].id : 'user_isaque');

        // Status e datas derivadas.
        // "Preparada" = concluiu as 4 etapas da bancada (data automatica).
        // "Trocada"   = acao separada, com data propria escolhida pelo analista.
        const status = machine.status || 'PAUSADO';
        const completedAt = machine.completedAt || null;
        const preparedAt = machine.preparedAt
            || (status === 'CONCLUIDO' ? (completedAt || machine.updatedAt || null) : null);

        return {
            id: machine.id || uid('nb'),
            datasetId: machine.datasetId || state.activeDatasetId || 'dataset_principal',
            hostname: String(machine.hostname || '').toUpperCase(),
            analystId,
            brand: machine.brand || 'Dell',
            profile: machine.profile || 'Local',
            processDate: machine.processDate
                || isoToDateKey(machine.preparedAt || machine.createdAt)
                || todayBrInput(),
            currentStep: machine.currentStep === 'CONCLUIDO' ? 'CONCLUIDO' : currentStep,
            currentStepIndex,
            status,
            timerRunning: Boolean(machine.timerRunning),
            stepDurations: normalizedStepDurations,
            totalElapsedSeconds: Number(machine.totalElapsedSeconds || 0),
            hasError: Boolean(machine.hasError),
            errorDetails: machine.errorDetails || null,
            notes: machine.notes || '',
            manualEntry: Boolean(machine.manualEntry),
            manualEntryBy: machine.manualEntryBy || null,
            manualEntryAt: machine.manualEntryAt || null,
            history: Array.isArray(machine.history) ? machine.history : [],
            currentStepStartedAt: machine.currentStepStartedAt || nowIso(),
            lastTickAt: machine.lastTickAt || null,
            createdAt: machine.createdAt || nowIso(),
            updatedAt: machine.updatedAt || nowIso(),
            completedAt,
            preparedAt,
            swappedAt: machine.swappedAt || null,
            swappedBy: machine.swappedBy || null
        };
    }

    function getVisibleMachines(state, currentUser, datasetId = null) {
        const targetDatasetId = datasetId || state.activeDatasetId;
        const list = state.machines.filter((machine) => machine.datasetId === targetDatasetId);
        if (!currentUser || currentUser.role === 'manager') {
            return list;
        }
        return list.filter((machine) => machine.analystId === currentUser.id);
    }

    function getAllMachinesByDataset(state, datasetId = null) {
        const targetDatasetId = datasetId || state.activeDatasetId;
        return state.machines.filter((machine) => machine.datasetId === targetDatasetId);
    }

    /* --------------------- Merge com o repositorio (GitHub) --------------------- */

    function pickNewest(localItem, remoteItem) {
        const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
        const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0).getTime();
        return remoteTime > localTime ? { ...localItem, ...remoteItem } : localItem;
    }

    function mergeById(localList, remoteList) {
        const map = new Map();
        localList.forEach((item) => map.set(item.id, item));
        remoteList.forEach((remote) => {
            if (!remote || !remote.id) return;
            const local = map.get(remote.id);
            map.set(remote.id, local ? pickNewest(local, remote) : remote);
        });
        return Array.from(map.values());
    }

    /* -------------------------- Exclusoes (tombstones) -------------------------- */

    // Marca as maquinas como excluidas. E o unico jeito de uma exclusao sobreviver
    // ao merge: o merge so somaria o registro de volta na proxima leitura.
    function registerMachineDeletions(state, machines, actorId) {
        const deletedAt = nowIso();
        machines.forEach((machine) => {
            state.deletedMachines[machine.id] = {
                id: machine.id,
                hostname: machine.hostname,
                analystId: machine.analystId,
                deletedAt,
                deletedBy: actorId || null
            };
        });
        return state.deletedMachines;
    }

    // Absorve as exclusoes vindas do repositorio. Vale a mais recente por id,
    // para que uma exclusao feita em outra maquina chegue ate aqui.
    function mergeDeletions(state, remoteDeletions) {
        if (!remoteDeletions || typeof remoteDeletions !== 'object') {
            return 0;
        }

        let applied = 0;
        Object.keys(remoteDeletions).forEach((machineId) => {
            const remote = remoteDeletions[machineId];
            if (!remote || !remote.deletedAt) {
                return;
            }

            // Ja marcada como excluida aqui: nada a fazer.
            if (state.deletedMachines[machineId]) {
                return;
            }

            state.deletedMachines[machineId] = {
                id: machineId,
                hostname: remote.hostname || '',
                analystId: remote.analystId || '',
                deletedAt: remote.deletedAt,
                deletedBy: remote.deletedBy || null
            };
            applied += 1;
        });

        return applied;
    }

    // Tira do estado tudo que esta marcado como excluido. A exclusao sempre vence:
    // se a maquina reaparecer em qualquer arquivo (de analista ou do gerente),
    // ela e descartada de novo aqui. E isso que impede o apagado de voltar.
    function applyDeletions(state) {
        const before = state.machines.length;
        state.machines = state.machines.filter((machine) => !state.deletedMachines[machine.id]);
        return before - state.machines.length;
    }

    // Exclusoes que interessam a um analista (vai no arquivo individual dele).
    function getDeletionsForAnalyst(state, userId) {
        const result = {};

        Object.keys(state.deletedMachines || {}).forEach((machineId) => {
            const tombstone = state.deletedMachines[machineId];
            if (tombstone && tombstone.analystId === userId) {
                result[machineId] = tombstone;
            }
        });

        return result;
    }

    function mergeDatasets(state, remoteDatasets) {
        const list = Array.isArray(remoteDatasets) ? remoteDatasets : [];
        list.forEach((dataset) => {
            if (!dataset || !dataset.id) return;
            const exists = state.datasets.some((item) => item.id === dataset.id);
            if (!exists) {
                state.datasets.push({
                    id: dataset.id,
                    name: dataset.name || 'Lote importado',
                    createdAt: dataset.createdAt || nowIso()
                });
            }
        });
    }

    function mergeUsers(state, remoteUsers) {
        const list = Array.isArray(remoteUsers) ? remoteUsers : [];
        list.forEach((remote) => {
            if (!remote || !remote.id) return;
            const local = state.users.find((item) => item.id === remote.id);
            const remoteCredentials = remote.credentials || remote.password || null;

            if (!local) {
                // Usuario novo vindo do repositorio: aproveita a credencial quando ela
                // vier no payload; sem isso, entra com a senha inicial do projeto.
                const created = {
                    id: remote.id,
                    username: remote.username || remote.id,
                    displayName: remote.displayName || remote.username || 'Usuario',
                    role: remote.role === 'manager' ? 'manager' : 'analyst',
                    active: remote.active !== false,
                    createdAt: nowIso(),
                    updatedAt: remote.updatedAt || nowIso()
                };

                if (!applyRemoteCredentials(created, remoteCredentials)) {
                    created.passwordHash = sha256(MASTER_RESET_SECRET);
                }

                state.users.push(created);
                return;
            }

            // Dados cadastrais mais recentes vem do repositorio.
            const remoteTime = new Date(remote.updatedAt || 0).getTime();
            const localTime = new Date(local.updatedAt || 0).getTime();
            if (remoteTime > localTime) {
                local.displayName = remote.displayName || local.displayName;
                local.active = remote.active !== false;
                local.updatedAt = remote.updatedAt;
            }

            // A senha so muda quando a credencial remota e mais nova. Assim a troca
            // feita no notebook chega aqui, e a troca feita aqui nunca e rebaixada.
            applyRemoteCredentials(local, remoteCredentials);
        });
    }

    function mergeManagement(remote) {
        if (!remote) {
            return loadManagement();
        }

        const local = loadManagement();
        const remoteTime = new Date(remote.updatedAt || 0).getTime();
        const localTime = new Date(local.updatedAt || 0).getTime();

        // Somente o gerente escreve este arquivo, entao vale a versao mais recente.
        if (remoteTime <= localTime) {
            return local;
        }

        return saveManagement({
            adjustments: remote.adjustments || {},
            notes: remote.notes || {},
            frentes: remote.frentes || { ok: [], pd: [] }
        });
    }

    function mergeRemoteBundle(bundle, currentUser) {
        const state = loadState();
        const isManager = Boolean(currentUser && currentUser.role === 'manager');
        const sources = [];

        if (bundle && bundle.general) {
            sources.push(bundle.general);
        }
        if (bundle && Array.isArray(bundle.analysts)) {
            bundle.analysts.forEach((entry) => {
                if (entry && entry.data) sources.push(entry.data);
            });
        }

        const remoteMachines = [];
        sources.forEach((source) => {
            // Exclusoes primeiro: uma maquina apagada em outra maquina precisa
            // derrubar o registro antes de ele ser somado de volta aqui.
            mergeDeletions(state, source.deletedMachines);

            (Array.isArray(source.records) ? source.records : []).forEach((record) => {
                remoteMachines.push(normalizeMachine(state, record));
            });
            mergeDatasets(state, source.datasets);
        });

        // Analista absorve somente os proprios registros; o gerente absorve todos.
        const scopedRemote = isManager
            ? remoteMachines
            : remoteMachines.filter((machine) => machine.analystId === (currentUser ? currentUser.id : ''));

        const beforeCount = state.machines.length;
        state.machines = mergeById(state.machines, scopedRemote);
        const absorbed = state.machines.length - beforeCount;
        const removed = applyDeletions(state);

        // Credenciais viajam com o dono do arquivo: cada analista carrega a propria
        // senha no seu JSON, e o usuarios.json (escrito pelo gerente) carrega a de
        // todos - e assim que um reset feito pelo gerente chega nas outras maquinas.
        // Isso roda para qualquer perfil, inclusive ANTES do login.
        if (bundle && bundle.users && Array.isArray(bundle.users.users)) {
            mergeUsers(state, bundle.users.users);
        }

        if (bundle && Array.isArray(bundle.analysts)) {
            bundle.analysts.forEach((entry) => {
                const data = entry && entry.data;
                const owner = (data && data.user) || null;
                if (!owner || !owner.id) {
                    return;
                }
                const local = state.users.find((user) => user.id === owner.id);
                if (local) {
                    applyRemoteCredentials(local, data.credentials || owner.credentials || null);
                }
            });
        }

        if (isManager && bundle && bundle.management) {
            mergeManagement(bundle.management);
        }

        if (bundle && bundle.general && bundle.general.activeDatasetId) {
            const known = state.datasets.some((dataset) => dataset.id === bundle.general.activeDatasetId);
            if (known) {
                state.activeDatasetId = bundle.general.activeDatasetId;
            }
        }

        if (!state.datasets.some((dataset) => dataset.id === state.activeDatasetId)) {
            state.activeDatasetId = state.datasets[0].id;
        }

        audit(state, 'merge_remote', currentUser ? currentUser.id : null, {
            received: remoteMachines.length,
            applied: absorbed,
            removed
        });

        saveState(state);
        return {
            received: remoteMachines.length,
            applied: absorbed,
            removed,
            total: state.machines.length
        };
    }

    /* ------------------------ Configuracao de gestao ------------------------ */

    function emptyManagement() {
        return { adjustments: {}, notes: {}, frentes: { ok: [], pd: [] }, updatedAt: null };
    }

    function loadManagement() {
        try {
            const raw = localStorage.getItem(MANAGEMENT_KEY);
            if (!raw) {
                return emptyManagement();
            }

            const parsed = JSON.parse(raw);
            return {
                adjustments: parsed.adjustments || {},
                notes: parsed.notes || {},
                frentes: {
                    ok: (parsed.frentes && parsed.frentes.ok) || [],
                    pd: (parsed.frentes && parsed.frentes.pd) || []
                },
                updatedAt: parsed.updatedAt || null
            };
        } catch (error) {
            console.error('Falha ao ler a configuracao de gestao:', error);
            return emptyManagement();
        }
    }

    function saveManagement(management) {
        const source = management || {};
        const normalized = {
            adjustments: source.adjustments || {},
            notes: source.notes || {},
            frentes: {
                ok: (source.frentes && source.frentes.ok) || [],
                pd: (source.frentes && source.frentes.pd) || []
            },
            updatedAt: nowIso()
        };

        localStorage.setItem(MANAGEMENT_KEY, JSON.stringify(normalized));
        return normalized;
    }

    // Ajuste manual por dia e analista. O total exibido = derivado + ajuste.
    function setDayAdjustment(dateKey, analystId, analystName, values, actorId) {
        if (!dateKey) {
            throw new Error('Informe a data do lançamento.');
        }
        if (!analystId) {
            throw new Error('Informe o analista do lançamento.');
        }

        const management = loadManagement();
        if (!management.adjustments[dateKey]) {
            management.adjustments[dateKey] = {};
        }

        const prep = Number(values && values.prep ? values.prep : 0);
        const troca = Number(values && values.troca ? values.troca : 0);

        if (!prep && !troca) {
            delete management.adjustments[dateKey][analystId];
            if (!Object.keys(management.adjustments[dateKey]).length) {
                delete management.adjustments[dateKey];
            }
        } else {
            management.adjustments[dateKey][analystId] = {
                name: analystName || '',
                prep,
                troca
            };
        }

        saveManagement(management);

        const state = loadState();
        audit(state, 'management_adjustment', actorId, { dateKey, analystId, prep, troca });
        saveState(state);

        return management;
    }

    function setDailyNote(dateKey, note, actorId) {
        const management = loadManagement();
        const text = String(note || '').trim();

        if (text) {
            management.notes[dateKey] = text;
        } else {
            delete management.notes[dateKey];
        }

        saveManagement(management);

        const state = loadState();
        audit(state, 'management_note', actorId, { dateKey });
        saveState(state);

        return management;
    }

    function setFrentes(frentes, actorId) {
        const management = loadManagement();
        management.frentes = {
            ok: (frentes && frentes.ok) || [],
            pd: (frentes && frentes.pd) || []
        };
        saveManagement(management);

        const state = loadState();
        audit(state, 'management_frentes', actorId, {
            superado: management.frentes.ok.length,
            pendente: management.frentes.pd.length
        });
        saveState(state);

        return management;
    }

    function replaceManagement(management, actorId) {
        const saved = saveManagement(management || emptyManagement());
        const state = loadState();
        audit(state, 'management_import', actorId, { at: nowIso() });
        saveState(state);
        return saved;
    }

    async function login(username, password) {
        credentialsUpgradedOnLogin = false;
        const state = loadState();
        const user = getUserByUsername(state, username);

        if (!user) {
            throw new Error('Usuário não encontrado.');
        }
        if (!user.active) {
            throw new Error('Usuário inativo. Procure o gerente de projeto.');
        }

        const verdict = await checkPassword(user, password);
        if (verdict.error) {
            throw new Error(verdict.error);
        }
        if (!verdict.ok) {
            throw new Error('Senha incorreta.');
        }

        // Login valido com credencial antiga (SHA-256 puro): migra para o formato
        // forte e apaga o hash antigo, para a senha anterior deixar de funcionar.
        if (!normalizeCredentials(user.credentials)) {
            user.credentials = await createCredentials(password);
            delete user.passwordHash;
            user.updatedAt = nowIso();
            credentialsUpgradedOnLogin = true;
        }

        setSession({
            userId: user.id,
            loginAt: nowIso()
        });

        audit(state, 'login', user.id, { username: user.username, credentialsUpgraded: credentialsUpgradedOnLogin });
        saveState(state);
        return user;
    }

    function wasCredentialsUpgraded() {
        return credentialsUpgradedOnLogin;
    }

    function logout() {
        clearSession();
    }

    async function changeOwnPassword(userId, currentPassword, newPassword) {
        const state = loadState();
        const user = getUserById(state, userId);
        if (!user) {
            throw new Error('Usuário não encontrado.');
        }

        const verdict = await checkPassword(user, currentPassword);
        if (verdict.error) {
            throw new Error(verdict.error);
        }
        if (!verdict.ok) {
            throw new Error('Senha atual incorreta.');
        }

        user.credentials = await createCredentials(newPassword);
        delete user.passwordHash;
        user.updatedAt = nowIso();
        audit(state, 'change_password', userId, { scope: 'own' });
        saveState(state);
        return true;
    }

    async function resetUserPassword(managerUserId, targetUserId, masterSecret, newPassword) {
        const state = loadState();
        const manager = getUserById(state, managerUserId);
        if (!manager || manager.role !== 'manager') {
            throw new Error('Apenas o gerente pode resetar senhas.');
        }
        if (masterSecret !== MASTER_RESET_SECRET) {
            throw new Error('Senha mestra inválida.');
        }
        if (!newPassword || newPassword.length < 6) {
            throw new Error('A nova senha precisa ter ao menos 6 caracteres.');
        }

        const target = getUserById(state, targetUserId);
        if (!target) {
            throw new Error('Usuário alvo não encontrado.');
        }

        target.credentials = await createCredentials(newPassword);
        delete target.passwordHash;
        target.updatedAt = nowIso();
        audit(state, 'reset_password', managerUserId, { targetUserId });
        saveState(state);
        return true;
    }

    function createDataset(name, actorId) {
        const state = loadState();
        const actor = getUserById(state, actorId);
        if (!actor || actor.role !== 'manager') {
            throw new Error('Somente o gerente pode criar lotes.');
        }
        const dataset = {
            id: uid('dataset'),
            name: name.trim(),
            createdAt: nowIso()
        };
        state.datasets.push(dataset);
        state.activeDatasetId = dataset.id;
        audit(state, 'create_dataset', actorId, { datasetId: dataset.id, name: dataset.name });
        saveState(state);
        return dataset;
    }

    function setActiveDatasetId(datasetId) {
        const state = loadState();
        state.activeDatasetId = datasetId;
        saveState(state);
        return state;
    }

    function deleteDataset(datasetId, actorId) {
        const state = loadState();
        const actor = getUserById(state, actorId);
        if (!actor || actor.role !== 'manager') {
            throw new Error('Somente o gerente pode excluir lotes.');
        }
        if (state.datasets.length <= 1) {
            throw new Error('Não é possível excluir o único lote do sistema.');
        }

        registerMachineDeletions(
            state,
            state.machines.filter((machine) => machine.datasetId === datasetId),
            actorId
        );
        state.datasets = state.datasets.filter((dataset) => dataset.id !== datasetId);
        state.machines = state.machines.filter((machine) => machine.datasetId !== datasetId);
        if (state.activeDatasetId === datasetId) {
            state.activeDatasetId = state.datasets[0].id;
        }
        audit(state, 'delete_dataset', actorId, { datasetId });
        saveState(state);
    }

    function canEditMachine(user, machine) {
        if (!user) return false;
        return user.role === 'manager' || machine.analystId === user.id;
    }

    function resolveMachineStatus(step, timerRunning, hasError) {
        if (step === 'CONCLUIDO') {
            return 'CONCLUIDO';
        }
        if (timerRunning) {
            return 'EM_ANDAMENTO';
        }
        return hasError ? 'ERRO' : 'PAUSADO';
    }

    function withProcessedTimer(machine) {
        if (!machine.timerRunning || machine.status !== 'EM_ANDAMENTO' || !machine.lastTickAt) {
            return machine;
        }

        const now = Date.now();
        const lastTick = new Date(machine.lastTickAt).getTime();
        const deltaSeconds = Math.floor((now - lastTick) / 1000);

        if (deltaSeconds <= 0) {
            return machine;
        }

        // Copia profunda dos campos mutaveis para nao vazar alteracao no estado original.
        const updatedMachine = {
            ...machine,
            stepDurations: { ...machine.stepDurations },
            history: Array.isArray(machine.history) ? machine.history.slice() : []
        };
        const currentStep = updatedMachine.currentStep;
        if (currentStep !== 'CONCLUIDO') {
            updatedMachine.stepDurations[currentStep] = (updatedMachine.stepDurations[currentStep] || 0) + deltaSeconds;
        }
        updatedMachine.totalElapsedSeconds += deltaSeconds;
        updatedMachine.lastTickAt = new Date(now).toISOString();
        updatedMachine.updatedAt = updatedMachine.lastTickAt;
        return updatedMachine;
    }

    function processRunningTimers() {
        const state = loadState();
        let changed = false;
        state.machines = state.machines.map((machine) => {
            const processed = withProcessedTimer(machine);
            if (processed.updatedAt !== machine.updatedAt || processed.totalElapsedSeconds !== machine.totalElapsedSeconds) {
                changed = true;
            }
            return processed;
        });
        if (changed) {
            saveState(state);
        }
        return state;
    }

    function createHistoryEntry(action, actorId, note = '') {
        return {
            action,
            actorId,
            note,
            createdAt: nowIso()
        };
    }

    function buildManualTimes(payload) {
        const manualSeconds = payload.manualStepSeconds || {};
        const stepDurations = {};
        let total = 0;

        PROCESS_STEPS.forEach((step) => {
            const seconds = Math.max(0, Math.round(Number(manualSeconds[step] || 0)));
            stepDurations[step] = seconds;
            total += seconds;
        });

        return { stepDurations, total };
    }

    function createMachines(payload, actorId) {
        const state = processRunningTimers();
        const actor = getUserById(state, actorId);
        if (!actor) {
            throw new Error('Sessão inválida.');
        }

        const datasetId = state.activeDatasetId;
        const hostnames = payload.hostnames
            .split(/\r?\n/)
            .map((hostname) => hostname.trim().toUpperCase())
            .filter(Boolean);

        if (!hostnames.length) {
            throw new Error('Informe ao menos um hostname.');
        }

        const isManual = Boolean(payload.manualEntry);
        const manualTimes = isManual ? buildManualTimes(payload) : null;

        if (manualTimes && manualTimes.total <= 0) {
            throw new Error('No lançamento manual informe o tempo de ao menos uma etapa.');
        }

        const updatedItems = [];
        const createdItems = [];

        hostnames.forEach((hostname) => {
            const existing = state.machines.find((machine) => machine.datasetId === datasetId && machine.hostname === hostname);
            if (existing) {
                const nextStep = payload.step || existing.currentStep;
                const nextTimerRunning = !isManual && nextStep !== 'CONCLUIDO' && payload.autoStart;
                if (manualTimes) {
                    existing.stepDurations = { ...manualTimes.stepDurations };
                    existing.totalElapsedSeconds = manualTimes.total;
                    existing.manualEntry = true;
                    existing.manualEntryBy = actorId;
                    existing.manualEntryAt = nowIso();
                }
                const stepChanged = nextStep !== existing.currentStep;

                existing.analystId = payload.analystId;
                existing.brand = payload.brand;
                existing.profile = payload.profile;
                existing.processDate = payload.processDate;
                existing.notes = payload.notes;
                existing.hasError = payload.hasError;
                existing.errorDetails = payload.hasError ? { description: payload.errorDescription || 'Incidente registrado' } : null;
                existing.currentStep = nextStep;
                existing.currentStepIndex = nextStep === 'CONCLUIDO' ? PROCESS_STEPS.length : PROCESS_STEPS.indexOf(nextStep);
                existing.timerRunning = nextTimerRunning;
                existing.status = resolveMachineStatus(nextStep, nextTimerRunning, payload.hasError);
                existing.currentStepStartedAt = stepChanged ? nowIso() : existing.currentStepStartedAt;
                existing.lastTickAt = nextTimerRunning ? nowIso() : null;
                existing.completedAt = nextStep === 'CONCLUIDO' ? (existing.completedAt || nowIso()) : null;
                existing.preparedAt = nextStep === 'CONCLUIDO'
                    ? (existing.preparedAt || existing.completedAt)
                    : null;
                existing.updatedAt = nowIso();
                existing.history.unshift(createHistoryEntry(
                    isManual ? 'machine_updated_manual' : 'machine_updated',
                    actorId,
                    isManual ? 'Lançamento manual reaproveitado por hostname.' : 'Registro reaproveitado por hostname.'
                ));
                updatedItems.push(existing);
                return;
            }

            const currentStep = payload.step;
            const isDone = currentStep === 'CONCLUIDO';
            const machine = normalizeMachine(state, {
                id: uid('nb'),
                datasetId,
                hostname,
                analystId: payload.analystId,
                brand: payload.brand,
                profile: payload.profile,
                processDate: payload.processDate,
                currentStep,
                currentStepIndex: isDone ? PROCESS_STEPS.length : PROCESS_STEPS.indexOf(currentStep),
                status: resolveMachineStatus(currentStep, !isManual && !isDone && payload.autoStart, payload.hasError),
                stepDurations: manualTimes ? manualTimes.stepDurations : undefined,
                totalElapsedSeconds: manualTimes ? manualTimes.total : 0,
                manualEntry: isManual,
                manualEntryBy: isManual ? actorId : null,
                manualEntryAt: isManual ? nowIso() : null,
                timerRunning: !isManual && !isDone && payload.autoStart,
                hasError: payload.hasError,
                errorDetails: payload.hasError ? { description: payload.errorDescription || 'Incidente registrado' } : null,
                notes: payload.notes,
                currentStepStartedAt: nowIso(),
                lastTickAt: !isManual && !isDone && payload.autoStart ? nowIso() : null,
                history: [createHistoryEntry(
                    isManual ? 'machine_created_manual' : 'machine_created',
                    actorId,
                    isManual ? 'Lançamento manual com tempo digitado' : 'Cadastro inicial'
                )]
            });
            if (isDone) {
                machine.completedAt = nowIso();
                machine.preparedAt = machine.completedAt;
            }
            state.machines.unshift(machine);
            createdItems.push(machine);
        });

        audit(state, 'save_batch', actorId, {
            created: createdItems.length,
            updated: updatedItems.length,
            datasetId
        });
        saveState(state);

        return {
            createdItems,
            updatedItems
        };
    }

    function updateMachine(machineId, payload, actorId) {
        const state = processRunningTimers();
        const actor = getUserById(state, actorId);
        const machine = state.machines.find((item) => item.id === machineId);
        if (!machine) {
            throw new Error('Máquina não encontrada.');
        }
        if (!canEditMachine(actor, machine)) {
            throw new Error('Você não possui permissão para editar este registro.');
        }

        machine.analystId = payload.analystId;
        machine.brand = payload.brand;
        machine.profile = payload.profile;
        machine.processDate = payload.processDate;
        machine.notes = payload.notes;
        machine.hasError = payload.hasError;
        machine.errorDetails = payload.hasError ? { description: payload.errorDescription || 'Incidente registrado' } : null;

        if (payload.step !== machine.currentStep) {
            machine.currentStep = payload.step;
            machine.currentStepIndex = payload.step === 'CONCLUIDO' ? PROCESS_STEPS.length : PROCESS_STEPS.indexOf(payload.step);
            machine.currentStepStartedAt = nowIso();
        }

        if (payload.manualEntry) {
            const manualTimes = buildManualTimes(payload);
            if (manualTimes.total <= 0) {
                throw new Error('No lançamento manual informe o tempo de ao menos uma etapa.');
            }
            machine.stepDurations = manualTimes.stepDurations;
            machine.totalElapsedSeconds = manualTimes.total;
            machine.manualEntry = true;
            machine.manualEntryBy = actorId;
            machine.manualEntryAt = nowIso();
        }

        machine.timerRunning = (payload.step === 'CONCLUIDO' || payload.manualEntry) ? false : machine.timerRunning;
        machine.status = resolveMachineStatus(payload.step, machine.timerRunning, payload.hasError);
        machine.lastTickAt = machine.timerRunning ? nowIso() : null;
        machine.completedAt = payload.step === 'CONCLUIDO' ? (machine.completedAt || nowIso()) : null;
        machine.preparedAt = payload.step === 'CONCLUIDO' ? (machine.preparedAt || machine.completedAt) : null;

        machine.updatedAt = nowIso();
        machine.history.unshift(createHistoryEntry(
            payload.manualEntry ? 'machine_edited_manual' : 'machine_edited',
            actorId,
            payload.manualEntry ? 'Tempos ajustados no lançamento manual' : 'Edicao do registro'
        ));
        audit(state, 'edit_machine', actorId, { machineId });
        saveState(state);
        return machine;
    }

    function markMachinesSwapped(machineIds, swapDate, actorId) {
        const state = processRunningTimers();
        const actor = getUserById(state, actorId);
        if (!actor) {
            throw new Error('Sessão inválida.');
        }
        if (!Array.isArray(machineIds) || !machineIds.length) {
            throw new Error('Selecione ao menos uma máquina.');
        }

        const date = swapDate || todayBrInput();
        const swapped = [];
        const skipped = [];

        machineIds.forEach((machineId) => {
            const machine = state.machines.find((item) => item.id === machineId);
            if (!machine) {
                return;
            }
            if (!canEditMachine(actor, machine)) {
                skipped.push({ hostname: machine.hostname, reason: 'sem permissao' });
                return;
            }
            if (machine.swappedAt) {
                skipped.push({ hostname: machine.hostname, reason: 'ja trocada' });
                return;
            }
            if (machine.status !== 'CONCLUIDO') {
                skipped.push({ hostname: machine.hostname, reason: 'ainda nao preparada' });
                return;
            }

            machine.swappedAt = date;
            machine.swappedBy = actorId;
            machine.updatedAt = nowIso();
            machine.history.unshift(createHistoryEntry('machine_swapped', actorId, `Trocada em ${date}`));
            swapped.push(machine);
        });

        if (!swapped.length) {
            const motivo = skipped.length ? ` (${skipped[0].reason})` : '';
            throw new Error(`Nenhuma maquina elegivel para marcar como trocada${motivo}.`);
        }

        audit(state, 'swap_batch', actorId, { count: swapped.length, date, skipped: skipped.length });
        saveState(state);
        return { swapped, skipped, date };
    }

    function unmarkMachineSwapped(machineId, actorId) {
        const state = processRunningTimers();
        const actor = getUserById(state, actorId);
        const machine = state.machines.find((item) => item.id === machineId);
        if (!machine) {
            throw new Error('Máquina não encontrada.');
        }
        if (!canEditMachine(actor, machine)) {
            throw new Error('Você não possui permissão para alterar este registro.');
        }

        machine.swappedAt = null;
        machine.swappedBy = null;
        machine.updatedAt = nowIso();
        machine.history.unshift(createHistoryEntry('machine_swap_undone', actorId, 'Troca desfeita'));
        audit(state, 'swap_undo', actorId, { machineId });
        saveState(state);
        return machine;
    }

    function deleteMachine(machineId, actorId) {
        const state = loadState();
        const actor = getUserById(state, actorId);
        const machine = state.machines.find((item) => item.id === machineId);
        if (!machine) {
            throw new Error('Máquina não encontrada.');
        }
        if (!canEditMachine(actor, machine)) {
            throw new Error('Você não possui permissão para excluir este registro.');
        }

        registerMachineDeletions(state, [machine], actorId);
        state.machines = state.machines.filter((item) => item.id !== machineId);
        audit(state, 'delete_machine', actorId, { machineId, hostname: machine.hostname });
        saveState(state);
        return machine;
    }

    // Atualizacao em lote: usada pelo "selecionar todos" da tabela operacional.
    // Aplica somente os campos informados e registra tudo na trilha de auditoria.
    function bulkUpdateMachines(machineIds, patch, actorId) {
        const state = processRunningTimers();
        const actor = getUserById(state, actorId);
        if (!actor) {
            throw new Error('Sessão inválida.');
        }
        if (!Array.isArray(machineIds) || !machineIds.length) {
            throw new Error('Selecione ao menos uma máquina.');
        }

        const source = patch || {};
        const updated = [];
        const skipped = [];

        machineIds.forEach((machineId) => {
            const machine = state.machines.find((item) => item.id === machineId);
            if (!machine) {
                return;
            }
            if (!canEditMachine(actor, machine)) {
                skipped.push({ hostname: machine.hostname, reason: 'sem permissao' });
                return;
            }

            const changes = [];

            if (source.analystId && source.analystId !== machine.analystId) {
                if (!getUserById(state, source.analystId)) {
                    throw new Error('O analista escolhido para o lote não existe.');
                }
                machine.analystId = source.analystId;
                changes.push('analista');
            }
            if (source.brand && source.brand !== machine.brand) {
                machine.brand = source.brand;
                changes.push('fabricante');
            }
            if (source.profile && source.profile !== machine.profile) {
                machine.profile = source.profile;
                changes.push('perfil');
            }
            if (source.processDate && source.processDate !== machine.processDate) {
                machine.processDate = source.processDate;
                changes.push('data registrada');
            }
            if (typeof source.notes === 'string' && source.notes !== machine.notes) {
                machine.notes = source.notes;
                changes.push('observacao');
            }
            if (source.step && source.step !== machine.currentStep) {
                const step = source.step;
                machine.currentStep = step;
                machine.currentStepIndex = step === 'CONCLUIDO' ? PROCESS_STEPS.length : PROCESS_STEPS.indexOf(step);
                machine.currentStepStartedAt = nowIso();
                machine.timerRunning = step === 'CONCLUIDO' ? false : machine.timerRunning;
                machine.status = resolveMachineStatus(step, machine.timerRunning, machine.hasError);
                machine.completedAt = step === 'CONCLUIDO' ? (machine.completedAt || nowIso()) : null;
                machine.preparedAt = step === 'CONCLUIDO' ? (machine.preparedAt || machine.completedAt) : null;
                machine.lastTickAt = machine.timerRunning ? nowIso() : null;
                changes.push('etapa');
            }
            if (source.clearError && (machine.hasError || machine.status === 'ERRO')) {
                machine.hasError = false;
                machine.errorDetails = null;
                machine.status = resolveMachineStatus(machine.currentStep, machine.timerRunning, false);
                changes.push('incidente encerrado');
            }
            if (source.swapDate && !machine.swappedAt) {
                machine.swappedAt = source.swapDate;
                machine.swappedBy = actorId;
                changes.push('troca');
            }
            if (source.clearSwap && machine.swappedAt) {
                machine.swappedAt = null;
                machine.swappedBy = null;
                changes.push('troca desfeita');
            }

            if (!changes.length) {
                return;
            }

            machine.updatedAt = nowIso();
            machine.history.unshift(createHistoryEntry('machine_bulk_updated', actorId, `Lote: ${changes.join(', ')}`));
            updated.push(machine);
        });

        if (!updated.length) {
            const motivo = skipped.length
                ? ` (${skipped.length} sem permissão)`
                : ' (nenhuma alteração aplicável)';
            throw new Error(`Nenhuma máquina foi atualizada${motivo}.`);
        }

        audit(state, 'bulk_update', actorId, { count: updated.length, fields: Object.keys(source) });
        saveState(state);
        return { updated, skipped };
    }

    function bulkDeleteMachines(machineIds, actorId) {
        const state = processRunningTimers();
        const actor = getUserById(state, actorId);
        if (!actor) {
            throw new Error('Sessão inválida.');
        }
        if (!Array.isArray(machineIds) || !machineIds.length) {
            throw new Error('Selecione ao menos uma máquina.');
        }

        const deletable = state.machines.filter((machine) => (
            machineIds.indexOf(machine.id) !== -1 && canEditMachine(actor, machine)
        ));

        if (!deletable.length) {
            throw new Error('Nenhuma máquina selecionada pode ser excluída.');
        }

        registerMachineDeletions(state, deletable, actorId);
        const ids = deletable.map((machine) => machine.id);
        state.machines = state.machines.filter((machine) => ids.indexOf(machine.id) === -1);
        audit(state, 'bulk_delete', actorId, {
            count: deletable.length,
            hostnames: deletable.map((machine) => machine.hostname)
        });
        saveState(state);
        return { deleted: deletable, skipped: machineIds.length - deletable.length };
    }

    function startMachine(machineId, actorId) {
        const state = processRunningTimers();
        const actor = getUserById(state, actorId);
        const machine = state.machines.find((item) => item.id === machineId);
        if (!machine) throw new Error('Máquina não encontrada.');
        if (!canEditMachine(actor, machine)) throw new Error('Permissão insuficiente.');
        if (machine.currentStep === 'CONCLUIDO') throw new Error('Máquina já concluída.');

        machine.timerRunning = true;
        machine.status = 'EM_ANDAMENTO';
        machine.lastTickAt = nowIso();
        machine.updatedAt = nowIso();
        machine.history.unshift(createHistoryEntry('start_timer', actorId, machine.currentStep));
        audit(state, 'start_timer', actorId, { machineId });
        saveState(state);
        return machine;
    }

    function pauseMachine(machineId, actorId) {
        const state = processRunningTimers();
        const actor = getUserById(state, actorId);
        const machine = state.machines.find((item) => item.id === machineId);
        if (!machine) throw new Error('Máquina não encontrada.');
        if (!canEditMachine(actor, machine)) throw new Error('Permissão insuficiente.');

        machine.timerRunning = false;
        machine.status = machine.hasError ? 'ERRO' : 'PAUSADO';
        machine.lastTickAt = null;
        machine.updatedAt = nowIso();
        machine.history.unshift(createHistoryEntry('pause_timer', actorId, machine.currentStep));
        audit(state, 'pause_timer', actorId, { machineId });
        saveState(state);
        return machine;
    }

    function nextMachineStep(machineId, actorId) {
        const state = processRunningTimers();
        const actor = getUserById(state, actorId);
        const machine = state.machines.find((item) => item.id === machineId);
        if (!machine) throw new Error('Máquina não encontrada.');
        if (!canEditMachine(actor, machine)) throw new Error('Permissão insuficiente.');

        if (machine.currentStep === 'CONCLUIDO') {
            return machine;
        }

        const currentIndex = PROCESS_STEPS.indexOf(machine.currentStep);
        if (currentIndex >= PROCESS_STEPS.length - 1) {
            machine.currentStep = 'CONCLUIDO';
            machine.currentStepIndex = PROCESS_STEPS.length;
            machine.status = 'CONCLUIDO';
            machine.timerRunning = false;
            machine.lastTickAt = null;
            machine.completedAt = nowIso();
            machine.preparedAt = machine.completedAt;
        } else {
            machine.currentStep = PROCESS_STEPS[currentIndex + 1];
            machine.currentStepIndex = currentIndex + 1;
            machine.status = 'EM_ANDAMENTO';
            machine.timerRunning = true;
            machine.currentStepStartedAt = nowIso();
            machine.lastTickAt = nowIso();
        }

        machine.updatedAt = nowIso();
        machine.history.unshift(createHistoryEntry('next_step', actorId, machine.currentStep));
        audit(state, 'next_step', actorId, { machineId, nextStep: machine.currentStep });
        saveState(state);
        return machine;
    }

    function restoreFullBackup(jsonString, actorId = null) {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed || !Array.isArray(parsed.datasets) || !Array.isArray(parsed.users) || !Array.isArray(parsed.machines)) {
                throw new Error('Arquivo incompatível com o snapshot atual.');
            }

            // Seguranca: restaurar snapshot sobrescreve a base inteira, inclusive senhas.
            // Portanto somente o gerente autenticado pode executar esta operacao.
            const currentState = loadState();
            const actor = actorId ? getUserById(currentState, actorId) : null;
            if (!actor || actor.role !== 'manager') {
                throw new Error('Apenas o gerente pode restaurar um snapshot completo.');
            }

            const state = ensureStateShape(parsed);
            audit(state, 'restore_snapshot', actorId, { restoredAt: nowIso() });
            saveState(state);
            return state;
        } catch (error) {
            console.error('Falha ao restaurar backup:', error);
            throw error;
        }
    }

    function getSanitizedUsers(state) {
        return state.users.map((user) => ({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
            active: user.active,
            updatedAt: user.updatedAt
        }));
    }

    function getStateSummary(state) {
        return {
            version: state.version,
            organization: state.organization,
            datasets: state.datasets,
            activeDatasetId: state.activeDatasetId,
            counts: {
                users: state.users.length,
                machines: state.machines.length,
                auditTrail: state.auditTrail.length
            }
        };
    }

    return {
        ANALYST_GOAL,
        MASTER_RESET_SECRET,
        PROCESS_STEPS,
        TOTAL_PROJECT_GOAL,
        bulkDeleteMachines,
        bulkUpdateMachines,
        changeOwnPassword,
        createDataset,
        createMachines,
        deleteDataset,
        deleteMachine,
        formatDateTime,
        getAllMachinesByDataset,
        getAnalystName,
        getAnalystUsers,
        getCredentialsSnapshot,
        getCurrentUser,
        getDatasetById,
        getResponsibleUsers,
        getSanitizedUsers,
        getSession,
        getStateSummary,
        getUserById,
        getDeletionsForAnalyst,
        applyDeletions,
        applyRemoteCredentials,
        mergeDeletions,
        loadState,
        login,
        logout,
        loadManagement,
        markMachinesSwapped,
        mergeById,
        mergeManagement,
        mergeRemoteBundle,
        nextMachineStep,
        pauseMachine,
        processRunningTimers,
        resetUserPassword,
        replaceManagement,
        restoreFullBackup,
        saveState,
        setActiveDatasetId,
        setDailyNote,
        setDayAdjustment,
        setFrentes,
        startMachine,
        todayBrInput,
        unmarkMachineSwapped,
        updateMachine,
        getVisibleMachines,
        wasCredentialsUpgraded,
        sha256
    };
})();
