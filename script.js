const rowList = document.getElementById("row-list");
const addRowBtn = document.getElementById("add-row-btn");
const taipeiNowEl = document.getElementById("taipei-now");
const footerTimeEl = document.getElementById("footer-time");
const tagListEl = document.getElementById("tag-list");
const sortBtn = document.getElementById("sort-btn");
const copyAllBtn = document.getElementById("copy-all-btn");
const clearAllBtn = document.getElementById("clear-all-btn");
const nextMushroomNameEl = document.getElementById("next-mushroom-name");
const nextMushroomTimeEl = document.getElementById("next-mushroom-time");
const leadSecondsInput = document.getElementById("lead-seconds-input");
const leadAlertEnabledInput = document.getElementById("lead-alert-enabled");
const leadAlertSettingEl = document.getElementById("lead-alert-setting");
const frequentReminderEnabledInput = document.getElementById("frequent-reminder-enabled");
const systemNotificationEnabledInput = document.getElementById("system-notification-enabled");
const alertVolumeInput = document.getElementById("alert-volume-input");
const alertVolumeTextEl = document.getElementById("alert-volume-text");
const toastStackEl = document.getElementById("toast-stack");

const TAGS_STORAGE_KEY = "pikmin-mushroom-tags";
const ROWS_STORAGE_KEY = "pikmin-mushroom-rows";
const ALERT_SECONDS_STORAGE_KEY = "pikmin-mushroom-alert-seconds";
const ALERT_ENABLED_STORAGE_KEY = "pikmin-mushroom-alert-enabled";
const FREQUENT_REMINDER_ENABLED_STORAGE_KEY = "pikmin-mushroom-frequent-reminder-enabled";
const SYSTEM_NOTIFICATION_ENABLED_STORAGE_KEY = "pikmin-mushroom-system-notification-enabled";
const ALERT_VOLUME_STORAGE_KEY = "pikmin-mushroom-alert-volume";

const DEFAULT_ALERT_LEAD_SECONDS = 40;
const MIN_ALERT_LEAD_SECONDS = 1;
const MAX_ALERT_LEAD_SECONDS = 60;
const DEFAULT_ALERT_ENABLED = true;
const DEFAULT_FREQUENT_REMINDER_ENABLED = true;
const DEFAULT_SYSTEM_NOTIFICATION_ENABLED = false;
const DEFAULT_ALERT_VOLUME = 65;
const REMINDER_INTERVAL_SECONDS = 5;
const SOON_STATUS_WINDOW_SECONDS = 5 * 60;
// 想改成重生前幾秒開始高亮，就改這個數字（目前是 10 秒）
const PRE_RESPAWN_HIGHLIGHT_SECONDS = 10;

const floatingNextCardEl = document.getElementById("floating-next-card");
const floatingNextNameEl = document.getElementById("floating-next-name");
const floatingNextTimeEl = document.getElementById("floating-next-time");

const rows = [];
let tags = [];
let rowCreatedSeq = 0;
let alertLeadSeconds = loadAlertLeadSeconds();
let alertLeadEnabled = loadAlertLeadEnabled();
let frequentReminderEnabled = loadFrequentReminderEnabled();
let systemNotificationEnabled = loadSystemNotificationEnabled();
let alertVolume = loadAlertVolume();
let audioContext = null;
let audioUnlocked = false;
let audioHintShown = false;
let serviceWorkerRegistrationPromise = null;

function createRowData(createdSeq) {
    const finalCreatedSeq =
        typeof createdSeq === "number" ? createdSeq : ++rowCreatedSeq;

    rowCreatedSeq = Math.max(rowCreatedSeq, finalCreatedSeq);

    return {
        id: crypto.randomUUID(),
        createdSeq: finalCreatedSeq,
        targetTimestamp: null,
        respawnState: false,
        lastRespawnTimestamp: null,
        respawnTriggered: false,
        lastReminderBucket: null,
        leadAlertDismissed: false,
        activeReminderToast: null,
        systemLeadNotificationSent: false,
        respawnHighlightTimeoutId: null,
        elements: null,
    };
}

function pad(num) {
    return String(num).padStart(2, "0");
}

function formatDuration(totalSeconds) {
    const safe = Math.max(0, totalSeconds);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function secondsToParts(totalSeconds) {
    const safe = Math.max(0, totalSeconds);
    return {
        hours: Math.floor(safe / 3600),
        minutes: Math.floor((safe % 3600) / 60),
        seconds: safe % 60,
    };
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function sanitizeAlertLeadSeconds(value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return DEFAULT_ALERT_LEAD_SECONDS;
    }

    return clamp(Math.floor(parsed), MIN_ALERT_LEAD_SECONDS, MAX_ALERT_LEAD_SECONDS);
}

function sanitizeAlertVolume(value) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return DEFAULT_ALERT_VOLUME;
    }

    return clamp(Math.floor(parsed), 0, 100);
}

function getEffectiveAlertVolumePercent(value = alertVolume) {
    return sanitizeAlertVolume(value) * 2;
}

function updateRangeProgress(inputEl, value) {
    if (!inputEl) {
        return;
    }

    const min = Number(inputEl.min || 0);
    const max = Number(inputEl.max || 100);
    const sanitizedValue = Number.isFinite(Number(value)) ? Number(value) : min;
    const clampedValue = clamp(sanitizedValue, min, max);
    const progress = max === min ? 0 : ((clampedValue - min) / (max - min)) * 100;

    inputEl.style.setProperty("--range-progress", `${progress}%`);
}

function getTaipeiNow() {
    return new Date();
}

function formatTaipeiDateTime(date) {
    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);
}

function formatTaipeiTime(date) {
    return new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);
}

function loadTagsFromStorage() {
    try {
        const raw = localStorage.getItem(TAGS_STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((item) => String(item).trim())
            .filter((item) => item.length > 0);
    } catch {
        return [];
    }
}

function saveTagsToStorage() {
    try {
        localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
    } catch {
        // ignore
    }
}

function loadRowsFromStorage() {
    try {
        const raw = localStorage.getItem(ROWS_STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((item) => ({
                name: String(item.name || "").trim(),
                targetTimestamp:
                    typeof item.targetTimestamp === "number" ? item.targetTimestamp : null,
                respawnState: item.respawnState === true,
                lastRespawnTimestamp:
                    typeof item.lastRespawnTimestamp === "number"
                        ? item.lastRespawnTimestamp
                        : null,
                createdSeq:
                    typeof item.createdSeq === "number" ? item.createdSeq : undefined,
            }))
            .filter(
                (item) =>
                    item.name !== "" ||
                    item.targetTimestamp !== null ||
                    item.respawnState === true ||
                    typeof item.createdSeq === "number"
            );
    } catch {
        return [];
    }
}

function saveRowsToStorage() {
    try {
        const payload = rows.map((row) => ({
            name: row.elements.nameInput.value.trim(),
            targetTimestamp: row.targetTimestamp,
            respawnState: row.respawnState === true,
            lastRespawnTimestamp: row.lastRespawnTimestamp,
            createdSeq: row.createdSeq,
        }));

        localStorage.setItem(ROWS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // ignore
    }
}

function loadAlertLeadSeconds() {
    try {
        const raw = localStorage.getItem(ALERT_SECONDS_STORAGE_KEY);
        if (raw === null) {
            return DEFAULT_ALERT_LEAD_SECONDS;
        }

        return sanitizeAlertLeadSeconds(raw);
    } catch {
        return DEFAULT_ALERT_LEAD_SECONDS;
    }
}

function saveAlertLeadSeconds() {
    try {
        localStorage.setItem(ALERT_SECONDS_STORAGE_KEY, String(alertLeadSeconds));
    } catch {
        // ignore
    }
}

function loadAlertLeadEnabled() {
    try {
        const raw = localStorage.getItem(ALERT_ENABLED_STORAGE_KEY);
        if (raw === null) {
            return DEFAULT_ALERT_ENABLED;
        }

        return raw === "true";
    } catch {
        return DEFAULT_ALERT_ENABLED;
    }
}

function saveAlertLeadEnabled() {
    try {
        localStorage.setItem(ALERT_ENABLED_STORAGE_KEY, String(alertLeadEnabled));
    } catch {
        // ignore
    }
}

function loadFrequentReminderEnabled() {
    try {
        const raw = localStorage.getItem(FREQUENT_REMINDER_ENABLED_STORAGE_KEY);
        if (raw === null) {
            return DEFAULT_FREQUENT_REMINDER_ENABLED;
        }

        return raw === "true";
    } catch {
        return DEFAULT_FREQUENT_REMINDER_ENABLED;
    }
}

function saveFrequentReminderEnabled() {
    try {
        localStorage.setItem(
            FREQUENT_REMINDER_ENABLED_STORAGE_KEY,
            String(frequentReminderEnabled)
        );
    } catch {
        // ignore
    }
}

function loadSystemNotificationEnabled() {
    try {
        const raw = localStorage.getItem(SYSTEM_NOTIFICATION_ENABLED_STORAGE_KEY);
        if (raw === null) {
            return DEFAULT_SYSTEM_NOTIFICATION_ENABLED;
        }

        return raw === "true";
    } catch {
        return DEFAULT_SYSTEM_NOTIFICATION_ENABLED;
    }
}

function saveSystemNotificationEnabled() {
    try {
        localStorage.setItem(
            SYSTEM_NOTIFICATION_ENABLED_STORAGE_KEY,
            String(systemNotificationEnabled)
        );
    } catch {
        // ignore
    }
}

function loadAlertVolume() {
    try {
        const raw = localStorage.getItem(ALERT_VOLUME_STORAGE_KEY);
        if (raw === null) {
            return DEFAULT_ALERT_VOLUME;
        }

        return sanitizeAlertVolume(raw);
    } catch {
        return DEFAULT_ALERT_VOLUME;
    }
}

function saveAlertVolume() {
    try {
        localStorage.setItem(ALERT_VOLUME_STORAGE_KEY, String(alertVolume));
    } catch {
        // ignore
    }
}

function getInputSeconds(row) {
    const hours = Number(row.elements.hoursInput.value || 0);
    const minutes = Number(row.elements.minutesInput.value || 0);
    const seconds = Number(row.elements.secondsInput.value || 0);
    return Math.max(0, hours * 3600 + minutes * 60 + seconds);
}

function getRespawnTimestamp(row) {
    if (!row.targetTimestamp) {
        return null;
    }
    return row.targetTimestamp + 5 * 60 * 1000;
}

function getReminderTimestamp(row) {
    const respawnTimestamp = getRespawnTimestamp(row);
    if (!respawnTimestamp) {
        return null;
    }

    return respawnTimestamp - alertLeadSeconds * 1000;
}

function getRespawnText(row) {
    const respawnTimestamp = getRespawnTimestamp(row);
    if (!respawnTimestamp) {
        return "—";
    }
    return formatTaipeiTime(new Date(respawnTimestamp));
}

function getRemainingSecondsFromTarget(targetTimestamp) {
    if (!targetTimestamp) {
        return 0;
    }

    const diffMs = targetTimestamp - Date.now();
    return Math.max(0, Math.floor((diffMs + 999) / 1000));
}

function getSecondsUntilRespawn(row) {
    const respawnTimestamp = getRespawnTimestamp(row);
    if (!respawnTimestamp) {
        return null;
    }

    return getRemainingSecondsFromTarget(respawnTimestamp);
}

function isRowRespawned(row) {
    const respawnTimestamp = getRespawnTimestamp(row);
    return Number.isFinite(respawnTimestamp) && respawnTimestamp <= Date.now();
}

function getLeadReminderBucket(secondsUntilRespawn) {
    if (
        !Number.isFinite(secondsUntilRespawn) ||
        secondsUntilRespawn <= 0 ||
        secondsUntilRespawn > alertLeadSeconds
    ) {
        return null;
    }

    if (!frequentReminderEnabled) {
        return 1;
    }

    return Math.ceil(secondsUntilRespawn / REMINDER_INTERVAL_SECONDS);
}

function updateInputFieldsFromTarget(row) {
    if (!row.targetTimestamp) {
        row.elements.hoursInput.value = "";
        row.elements.minutesInput.value = "";
        row.elements.secondsInput.value = "";
        return;
    }

    const remainingSeconds = getRemainingSecondsFromTarget(row.targetTimestamp);
    const parts = secondsToParts(remainingSeconds);

    row.elements.hoursInput.value = parts.hours || "";
    row.elements.minutesInput.value = parts.minutes || "";
    row.elements.secondsInput.value = parts.seconds || "";
}

function hideActiveReminderToast(row) {
    if (!row || !row.activeReminderToast) {
        return;
    }

    hideToast(row.activeReminderToast, 220);
    row.activeReminderToast = null;
}

function clearRespawnHighlight(row) {
    if (!row) {
        return;
    }

    if (row.respawnHighlightTimeoutId) {
        window.clearTimeout(row.respawnHighlightTimeoutId);
        row.respawnHighlightTimeoutId = null;
    }

    row.elements?.wrapper?.classList.remove("is-respawn-highlight");
}

function shouldHighlightBeforeRespawn(row) {
    const secondsUntilRespawn = getSecondsUntilRespawn(row);

    return (
        Number.isFinite(secondsUntilRespawn) &&
        secondsUntilRespawn > 0 &&
        secondsUntilRespawn <= PRE_RESPAWN_HIGHLIGHT_SECONDS
    );
}

function updateRespawnHighlight(row) {
    if (!row?.elements?.wrapper) {
        return;
    }

    if (shouldHighlightBeforeRespawn(row)) {
        row.elements.wrapper.classList.add("is-respawn-highlight");
        return;
    }

    clearRespawnHighlight(row);
}

function isSystemNotificationSupported() {
    return typeof Notification !== "undefined" && window.isSecureContext;
}

function shouldShowSystemNotificationNow() {
    return document.visibilityState !== "visible" || !document.hasFocus();
}

function getNotificationIconUrl() {
    return new URL("./favicon.ico", window.location.href).href;
}

async function ensureNotificationServiceWorker() {
    if (!isSystemNotificationSupported() || !("serviceWorker" in navigator)) {
        return null;
    }

    if (!serviceWorkerRegistrationPromise) {
        serviceWorkerRegistrationPromise = navigator.serviceWorker
            .register("./sw.js")
            .then(() => navigator.serviceWorker.ready)
            .catch(() => null);
    }

    return serviceWorkerRegistrationPromise;
}

async function showSystemNotification(title, body, options = {}) {
    if (
        !systemNotificationEnabled ||
        !isSystemNotificationSupported() ||
        Notification.permission !== "granted" ||
        !shouldShowSystemNotificationNow()
    ) {
        return;
    }

    const notificationOptions = {
        body,
        icon: getNotificationIconUrl(),
        badge: getNotificationIconUrl(),
        tag: options.tag,
        renotify: Boolean(options.renotify),
        data: {
            url: window.location.href,
        },
    };

    try {
        const registration = await ensureNotificationServiceWorker();

        if (registration && typeof registration.showNotification === "function") {
            await registration.showNotification(title, notificationOptions);
            return;
        }

        const notification = new Notification(title, notificationOptions);
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    } catch (error) {
        console.warn("系統通知顯示失敗", error);
    }
}

function resetRowAlertState(row, options = {}) {
    const {
        alignToCurrentWindow = false,
        preserveDismissed = false,
    } = options;

    hideActiveReminderToast(row);
    clearRespawnHighlight(row);

    const secondsUntilRespawn = getSecondsUntilRespawn(row);
    const respawned = isRowRespawned(row);

    row.respawnTriggered = secondsUntilRespawn === null ? true : respawned;
    row.lastReminderBucket =
        alignToCurrentWindow && !respawned
            ? getLeadReminderBucket(secondsUntilRespawn)
            : null;
    row.systemLeadNotificationSent = Boolean(
        alignToCurrentWindow &&
        !respawned &&
        Number.isFinite(secondsUntilRespawn) &&
        secondsUntilRespawn > 0 &&
        secondsUntilRespawn <= alertLeadSeconds
    );

    if (!preserveDismissed || row.respawnTriggered) {
        row.leadAlertDismissed = false;
    }
}

function syncAllRowAlertStates(options = {}) {
    rows.forEach((row) => resetRowAlertState(row, options));
}

function clearRespawnedRowInputs(row, { skipSave = false, skipNextCardUpdate = false } = {}) {
    if (!row || !row.targetTimestamp || !isRowRespawned(row)) {
        return false;
    }

    hideActiveReminderToast(row);

    row.lastRespawnTimestamp = getRespawnTimestamp(row);
    row.targetTimestamp = null;
    row.respawnState = true;
    row.respawnTriggered = true;
    row.lastReminderBucket = null;
    row.leadAlertDismissed = false;
    row.systemLeadNotificationSent = false;

    updateInputFieldsFromTarget(row);
    updateRowDisplay(row);

    if (!skipNextCardUpdate) {
        updateNextMushroomCard();
    }

    if (!skipSave) {
        saveRowsToStorage();
    }

    return true;
}

function syncRowTimer(row) {
    const totalSeconds = getInputSeconds(row);

    // 使用者一旦開始重新編輯時間，就清除「已重生」保留狀態。
    row.respawnState = false;
    row.lastRespawnTimestamp = null;
    row.targetTimestamp = totalSeconds > 0 ? Date.now() + totalSeconds * 1000 : null;

    resetRowAlertState(row);
    updateRowDisplay(row);
    updateNextMushroomCard();
    saveRowsToStorage();
}

function getRowStatus(row) {
    if (row?.respawnState) {
        return {
            key: "respawned",
            label: "已重生",
        };
    }

    if (!row?.targetTimestamp) {
        return {
            key: "empty",
            label: "未設定",
        };
    }

    const secondsUntilRespawn = getSecondsUntilRespawn(row);

    if (isRowRespawned(row)) {
        return {
            key: "respawned",
            label: "已重生",
        };
    }

    if (
        secondsUntilRespawn !== null &&
        secondsUntilRespawn > 0 &&
        secondsUntilRespawn <= SOON_STATUS_WINDOW_SECONDS
    ) {
        return {
            key: "soon",
            label: "即將重生",
        };
    }

    return {
        key: "counting",
        label: "倒數中",
    };
}

function updateRowStatusUI(row) {
    if (!row?.elements?.statusBadge) {
        return;
    }

    const status = getRowStatus(row);
    row.elements.statusBadge.textContent = status.label;
    row.elements.statusBadge.className = `row-status-badge is-${status.key}`;
    row.elements.wrapper.dataset.rowStatus = status.key;
}

function updateRowDisplay(row) {
    updateRowStatusUI(row);
    updateRespawnHighlight(row);

    if (row.respawnState && !row.targetTimestamp) {
        row.elements.countdownBox.textContent = "00:00:00";
        row.elements.respawnBox.textContent = row.lastRespawnTimestamp
            ? formatTaipeiTime(new Date(row.lastRespawnTimestamp))
            : "—";
        return;
    }

    if (!row.targetTimestamp) {
        row.elements.countdownBox.textContent = "00:00:00";
        row.elements.respawnBox.textContent = "—";
        return;
    }

    const remainingSeconds = getRemainingSecondsFromTarget(row.targetTimestamp);

    row.elements.countdownBox.textContent = formatDuration(remainingSeconds);
    row.elements.respawnBox.textContent = getRespawnText(row);
}

function updateIndices() {
    rows.forEach((row, index) => {
        row.elements.indexEl.textContent = `${index + 1}.`;
        row.elements.removeBtn.disabled = rows.length === 1;
    });
}

function createNumberInput(placeholder) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.placeholder = placeholder;
    input.inputMode = "numeric";
    return input;
}

function flashButton(button, text) {
    const originalText = button.dataset.originalText || button.textContent;
    button.dataset.originalText = originalText;
    button.textContent = text;

    setTimeout(() => {
        button.textContent = originalText;
    }, 1200);
}

function getLatestCreatedRow() {
    if (rows.length === 0) {
        return null;
    }

    return rows.reduce((latest, current) => {
        if (!latest) return current;
        return current.createdSeq > latest.createdSeq ? current : latest;
    }, null);
}

function renderTags() {
    tagListEl.innerHTML = "";

    if (tags.length === 0) {
        const emptyEl = document.createElement("div");
        emptyEl.className = "empty-tags";
        emptyEl.textContent = "目前還沒有標籤";
        tagListEl.appendChild(emptyEl);
        return;
    }

    tags.forEach((tagName) => {
        const tagItem = document.createElement("div");
        tagItem.className = "tag-item";

        const tagBtn = document.createElement("button");
        tagBtn.type = "button";
        tagBtn.className = "tag-chip";
        tagBtn.textContent = tagName;

        tagBtn.addEventListener("click", () => {
            const latestRow = getLatestCreatedRow();
            if (!latestRow) return;

            latestRow.elements.nameInput.value = tagName;
            latestRow.elements.nameInput.focus();
            updateNextMushroomCard();
            saveRowsToStorage();
        });

        const removeTagBtn = document.createElement("button");
        removeTagBtn.type = "button";
        removeTagBtn.className = "tag-remove-btn";
        removeTagBtn.setAttribute("aria-label", `刪除標籤 ${tagName}`);
        removeTagBtn.textContent = "×";

        removeTagBtn.addEventListener("click", (event) => {
            event.stopPropagation();

            const confirmed = window.confirm(`確定要刪除標籤「${tagName}」嗎？`);
            if (!confirmed) return;

            removeTag(tagName);
        });

        tagItem.append(tagBtn, removeTagBtn);
        tagListEl.appendChild(tagItem);
    });
}

function addTag(name) {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const existedIndex = tags.findIndex((tag) => tag === trimmedName);
    if (existedIndex !== -1) {
        tags.splice(existedIndex, 1);
    }

    tags.unshift(trimmedName);
    saveTagsToStorage();
    renderTags();
}

function removeTag(name) {
    const index = tags.findIndex((tag) => tag === name);
    if (index === -1) return;

    tags.splice(index, 1);
    saveTagsToStorage();
    renderTags();
}

function sortRowsByRespawnTime() {
    const now = Date.now();

    rows.sort((a, b) => {
        const aRespawn = getRespawnTimestamp(a);
        const bRespawn = getRespawnTimestamp(b);

        const getRank = (respawn) => {
            if (respawn === null) return 2;
            if (respawn < now) return 1;
            return 0;
        };

        const aRank = getRank(aRespawn);
        const bRank = getRank(bRespawn);

        if (aRank !== bRank) {
            return aRank - bRank;
        }

        if (aRank === 0) {
            return aRespawn - bRespawn;
        }

        if (aRank === 1) {
            return bRespawn - aRespawn;
        }

        return a.createdSeq - b.createdSeq;
    });

    rows.forEach((row) => {
        rowList.appendChild(row.elements.wrapper);
    });

    updateIndices();
    updateNextMushroomCard();
    saveRowsToStorage();
}

async function copyText(text, button, successText = "已複製", failText = "失敗") {
    try {
        await navigator.clipboard.writeText(text);
        flashButton(button, successText);
    } catch {
        flashButton(button, failText);
    }
}

function getRowCopyText(row) {
    const name = row.elements.nameInput.value.trim() || "未命名蘑菇";
    const respawnText = getRespawnText(row);

    if (!respawnText || respawnText === "—") {
        return null;
    }

    return `${name}|推算重生時間：${respawnText}`;
}

function getNextUpcomingRow() {
    const now = Date.now();

    const upcomingRows = rows.filter((row) => {
        const respawnTimestamp = getRespawnTimestamp(row);
        return respawnTimestamp !== null && respawnTimestamp >= now;
    });

    if (upcomingRows.length === 0) {
        return null;
    }

    upcomingRows.sort((a, b) => getRespawnTimestamp(a) - getRespawnTimestamp(b));
    return upcomingRows[0];
}

function updateNextMushroomCard() {
    if (!nextMushroomNameEl || !nextMushroomTimeEl) {
        return;
    }

    const nextRow = getNextUpcomingRow();

    if (!nextRow) {
        nextMushroomNameEl.textContent = "地點：—";
        nextMushroomTimeEl.textContent = "重生時間：—（—）";

        if (floatingNextNameEl) {
            floatingNextNameEl.textContent = "地點：—";
        }
        if (floatingNextTimeEl) {
            floatingNextTimeEl.textContent = "重生：—（—）";
        }
        return;
    }

    const name = nextRow.elements.nameInput.value.trim() || "未命名蘑菇";
    const respawnTimestamp = getRespawnTimestamp(nextRow);
    const remainingSeconds = getRemainingSecondsFromTarget(respawnTimestamp);

    const timeText = formatTaipeiTime(new Date(respawnTimestamp));
    const remainText = formatDuration(remainingSeconds);

    nextMushroomNameEl.textContent = `地點：${name}`;
    nextMushroomTimeEl.textContent = `重生時間：${timeText}（${remainText}）`;

    if (floatingNextNameEl) {
        floatingNextNameEl.textContent = `地點：${name}`;
    }
    if (floatingNextTimeEl) {
        floatingNextTimeEl.textContent = `重生：${timeText}（${remainText}）`;
    }
}

function updateFloatingNextCardVisibility() {
    if (!floatingNextCardEl) return;

    if (window.scrollY > 120) {
        floatingNextCardEl.classList.add("is-visible");
    } else {
        floatingNextCardEl.classList.remove("is-visible");
    }
}

function ensureAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
        return null;
    }

    if (!audioContext) {
        audioContext = new AudioContextClass();
    }

    return audioContext;
}

async function unlockAudio() {
    const context = ensureAudioContext();
    if (!context) {
        return;
    }

    try {
        if (context.state === "suspended") {
            await context.resume();
        }
        audioUnlocked = context.state === "running";
    } catch {
        audioUnlocked = false;
    }
}

function registerAudioUnlockEvents() {
    const unlockOnce = async () => {
        await unlockAudio();

        if (audioUnlocked) {
            document.removeEventListener("pointerdown", unlockOnce);
            document.removeEventListener("keydown", unlockOnce);
            document.removeEventListener("touchstart", unlockOnce);
        }
    };

    document.addEventListener("pointerdown", unlockOnce, { passive: true });
    document.addEventListener("keydown", unlockOnce);
    document.addEventListener("touchstart", unlockOnce, { passive: true });
}

function hideToast(toast, exitMs = 650) {
    if (!toast || toast.dataset.hiding === "true") {
        return;
    }

    toast.dataset.hiding = "true";
    toast.classList.remove("is-shaking");
    toast.classList.add("is-hiding");

    window.setTimeout(() => {
        if (typeof toast._onRemoved === "function") {
            toast._onRemoved();
        }
        toast.remove();
    }, exitMs);
}

function showToast(title, message, variant = "info", options = {}) {
    if (!toastStackEl) {
        return null;
    }

    const {
        durationMs = 3200,
        exitMs = 650,
        shake = false,
        closable = false,
        onClose = null,
        onRemoved = null,
    } = options;

    const toast = document.createElement("div");
    toast.className = `toast toast-${variant}`;
    toast._onRemoved = onRemoved;

    const headEl = document.createElement("div");
    headEl.className = "toast-head";

    const titleEl = document.createElement("div");
    titleEl.className = "toast-title";
    titleEl.textContent = title;
    headEl.appendChild(titleEl);

    if (closable) {
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "toast-close-btn";
        closeBtn.setAttribute("aria-label", "關閉提醒");
        closeBtn.textContent = "×";
        closeBtn.addEventListener("click", () => {
            if (toast.dataset.hiding === "true") {
                return;
            }

            if (typeof onClose === "function") {
                onClose();
            }
            hideToast(toast, exitMs);
        });
        headEl.appendChild(closeBtn);
    }

    const messageEl = document.createElement("div");
    messageEl.className = "toast-message";
    messageEl.textContent = message;

    toast.append(headEl, messageEl);
    toastStackEl.appendChild(toast);

    while (toastStackEl.children.length > 4) {
        toastStackEl.firstElementChild.remove();
    }

    requestAnimationFrame(() => {
        toast.classList.add("is-visible");
    });

    if (shake) {
        window.setTimeout(() => {
            if (!toast.dataset.hiding) {
                toast.classList.add("is-shaking");
            }
        }, 360);
    }

    window.setTimeout(() => {
        hideToast(toast, exitMs);
    }, durationMs);

    return toast;
}

function playTone(startAt, frequency, duration, volume = 0.05) {
    const context = ensureAudioContext();
    if (!context || !audioUnlocked || alertVolume <= 0) {
        return;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const finalVolume = volume * (getEffectiveAlertVolumePercent() / 100);

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(finalVolume, startAt + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
}

function playAlertSound(kind) {
    const context = ensureAudioContext();
    if (!context || !audioUnlocked) {
        if (!audioHintShown) {
            audioHintShown = true;
            showToast("音效尚未啟用", "先點一下頁面，之後時間到就能播放提醒音效。", "info");
        }
        return;
    }

    const startAt = context.currentTime + 0.01;

    if (kind === "respawn") {
        playTone(startAt, 880, 0.16, 0.06);
        playTone(startAt + 0.22, 1174, 0.18, 0.065);
        playTone(startAt + 0.46, 1567, 0.24, 0.07);
        return;
    }

    playTone(startAt, 784, 0.14, 0.05);
    playTone(startAt + 0.18, 988, 0.16, 0.055);
}

function triggerReminderToast(row, secondsUntilRespawn) {
    const name = row.elements.nameInput.value.trim() || "未命名蘑菇";
    const respawnTimestamp = getRespawnTimestamp(row);
    const respawnTimeText = formatTaipeiTime(new Date(respawnTimestamp));

    hideActiveReminderToast(row);
    playAlertSound("reminder");
    row.activeReminderToast = showToast(
        `還有 ${secondsUntilRespawn} 秒：${name}`,
        `預計 ${respawnTimeText} 重生。\n按右上角 × 可停止這筆的提前提醒。`,
        "warning",
        {
            durationMs: Math.max(1600, Math.min(secondsUntilRespawn * 1000, REMINDER_INTERVAL_SECONDS * 1000 - 250)),
            shake: true,
            closable: true,
            onClose: () => {
                row.leadAlertDismissed = true;
                row.activeReminderToast = null;
            },
            onRemoved: () => {
                if (row.activeReminderToast) {
                    row.activeReminderToast = null;
                }
            },
        }
    );
}

function triggerLeadSystemNotification(row, secondsUntilRespawn) {
    const name = row.elements.nameInput.value.trim() || "未命名蘑菇";
    const respawnTimestamp = getRespawnTimestamp(row);

    if (!respawnTimestamp) {
        return;
    }

    const respawnTimeText = formatTaipeiTime(new Date(respawnTimestamp));
    showSystemNotification(
        `還有 ${secondsUntilRespawn} 秒：${name}`,
        `預計 ${respawnTimeText} 重生。`,
        { tag: `pikmin-lead-${row.id}` }
    );
}

function triggerRespawnToast(row) {
    const name = row.elements.nameInput.value.trim() || "未命名蘑菇";

    hideActiveReminderToast(row);
    playAlertSound("respawn");
    showToast(`${name} 已重生`, "可以準備重新挑戰這朵蘑菇了。", "success", {
        durationMs: 4200,
        shake: true,
    });
}

function triggerRespawnSystemNotification(row) {
    const name = row.elements.nameInput.value.trim() || "未命名蘑菇";
    showSystemNotification(`${name} 已重生`, "可以準備重新挑戰這朵蘑菇了。", {
        tag: `pikmin-respawn-${row.id}`,
        renotify: true,
    });
}

function updateLeadAlertSettingUI() {
    if (leadAlertEnabledInput) {
        leadAlertEnabledInput.checked = alertLeadEnabled;
    }

    if (leadSecondsInput) {
        leadSecondsInput.disabled = !alertLeadEnabled;
    }

    if (frequentReminderEnabledInput) {
        frequentReminderEnabledInput.checked = frequentReminderEnabled;
        frequentReminderEnabledInput.disabled = !alertLeadEnabled;
    }

    if (leadAlertSettingEl) {
        leadAlertSettingEl.classList.toggle("is-disabled", !alertLeadEnabled);
    }

    const frequentReminderSettingEl = document.getElementById("frequent-reminder-setting");
    if (frequentReminderSettingEl) {
        frequentReminderSettingEl.classList.toggle("is-disabled", !alertLeadEnabled);
    }
}

function updateAlertVolumeUI() {
    if (alertVolumeInput) {
        alertVolumeInput.value = String(alertVolume);
        updateRangeProgress(alertVolumeInput, alertVolume);
    }

    if (alertVolumeTextEl) {
        alertVolumeTextEl.textContent = `${getEffectiveAlertVolumePercent()}%`;
    }
}

function updateSystemNotificationSettingUI() {
    if (!systemNotificationEnabledInput) {
        return;
    }

    const isSupported = isSystemNotificationSupported();
    systemNotificationEnabledInput.checked = systemNotificationEnabled && isSupported;
    systemNotificationEnabledInput.disabled = !isSupported;

    const systemNotificationSettingEl = document.getElementById("system-notification-setting");
    if (systemNotificationSettingEl) {
        systemNotificationSettingEl.classList.toggle("is-disabled", !isSupported);

        if (!isSupported) {
            const reason = window.isSecureContext
                ? "目前瀏覽器不支援系統通知"
                : "系統通知需要 HTTPS 或 localhost";
            systemNotificationSettingEl.title = reason;
        } else if (Notification.permission === "denied") {
            systemNotificationSettingEl.title = "瀏覽器已封鎖通知，需到瀏覽器設定手動允許";
        } else {
            systemNotificationSettingEl.removeAttribute("title");
        }
    }
}

async function applySystemNotificationEnabled(value, { silent = false } = {}) {
    const wantsEnabled = Boolean(value);

    if (!wantsEnabled) {
        systemNotificationEnabled = false;
        saveSystemNotificationEnabled();
        updateSystemNotificationSettingUI();

        if (!silent) {
            showToast("系統通知已關閉", "之後不會再跳出作業系統通知。", "info");
        }
        return false;
    }

    if (!isSystemNotificationSupported()) {
        systemNotificationEnabled = false;
        saveSystemNotificationEnabled();
        updateSystemNotificationSettingUI();

        if (!silent) {
            const reason = window.isSecureContext
                ? "目前瀏覽器不支援這種系統通知。"
                : "系統通知需要在 HTTPS 網站或 localhost 下使用。";
            showToast("無法開啟系統通知", reason, "warning");
        }
        return false;
    }

    let permission = Notification.permission;

    if (permission !== "granted") {
        if (silent) {
            systemNotificationEnabled = false;
            saveSystemNotificationEnabled();
            updateSystemNotificationSettingUI();
            return false;
        }

        try {
            permission = await Notification.requestPermission();
        } catch {
            permission = "denied";
        }
    }

    if (permission !== "granted") {
        systemNotificationEnabled = false;
        saveSystemNotificationEnabled();
        updateSystemNotificationSettingUI();

        if (!silent) {
            if (permission === "denied") {
                showToast(
                    "系統通知未開啟",
                    "瀏覽器已封鎖通知，請到網址列或瀏覽器設定手動允許。",
                    "warning"
                );
            } else {
                showToast("系統通知未開啟", "您尚未允許通知權限。", "info");
            }
        }
        return false;
    }

    systemNotificationEnabled = true;
    saveSystemNotificationEnabled();
    updateSystemNotificationSettingUI();
    await ensureNotificationServiceWorker();

    if (!silent) {
        showToast(
            "系統通知已開啟",
            "當頁面不在前景時，提前提醒與已重生都會跳出系統通知。",
            "success"
        );
    }

    return true;
}

function checkAndFireAlerts() {
    rows.forEach((row) => {
        const secondsUntilRespawn = getSecondsUntilRespawn(row);

        if (secondsUntilRespawn === null) {
            hideActiveReminderToast(row);
            row.lastReminderBucket = null;
            return;
        }

        if (!row.respawnTriggered && secondsUntilRespawn <= 0) {
            row.respawnTriggered = true;
            row.lastReminderBucket = null;
            triggerRespawnToast(row);
            triggerRespawnSystemNotification(row);
            clearRespawnedRowInputs(row);
            return;
        }

        if (!alertLeadEnabled || row.leadAlertDismissed) {
            return;
        }

        const currentBucket = getLeadReminderBucket(secondsUntilRespawn);
        if (currentBucket === null) {
            if (secondsUntilRespawn > alertLeadSeconds) {
                row.lastReminderBucket = null;
            }
            return;
        }

        if (currentBucket !== row.lastReminderBucket) {
            const isFirstLeadNotification = row.lastReminderBucket === null;
            row.lastReminderBucket = currentBucket;
            triggerReminderToast(row, secondsUntilRespawn);

            if (isFirstLeadNotification && !row.systemLeadNotificationSent) {
                row.systemLeadNotificationSent = true;
                triggerLeadSystemNotification(row, secondsUntilRespawn);
            }
        }
    });
}

function applyAlertLeadSeconds(value, { silent = false } = {}) {
    alertLeadSeconds = sanitizeAlertLeadSeconds(value);

    if (leadSecondsInput) {
        leadSecondsInput.value = String(alertLeadSeconds);
    }

    saveAlertLeadSeconds();
    syncAllRowAlertStates({ alignToCurrentWindow: true, preserveDismissed: true });
    updateNextMushroomCard();

    if (!silent && alertLeadEnabled) {
        showToast("提前提醒已更新", `目前會在重生前 ${alertLeadSeconds} 秒提醒您。`, "info");
    }
}

function applyAlertLeadEnabled(value, { silent = false } = {}) {
    alertLeadEnabled = Boolean(value);
    saveAlertLeadEnabled();
    updateLeadAlertSettingUI();

    if (!alertLeadEnabled) {
        rows.forEach(hideActiveReminderToast);
    } else {
        syncAllRowAlertStates({ alignToCurrentWindow: true, preserveDismissed: true });
    }

    if (!silent) {
        if (alertLeadEnabled) {
            showToast("提前提醒已開啟", `會在重生前 ${alertLeadSeconds} 秒提醒您。`, "info");
        } else {
            showToast("提前提醒已關閉", "之後只會保留重生當下提醒。", "info");
        }
    }
}

function applyFrequentReminderEnabled(value, { silent = false } = {}) {
    frequentReminderEnabled = Boolean(value);
    saveFrequentReminderEnabled();
    syncAllRowAlertStates({ alignToCurrentWindow: true, preserveDismissed: true });
    updateLeadAlertSettingUI();

    if (!silent && alertLeadEnabled) {
        if (frequentReminderEnabled) {
            showToast("頻繁提醒已開啟", "提前提醒期間會每 5 秒提醒一次。", "info");
        } else {
            showToast("頻繁提醒已關閉", "提前提醒期間只會提醒一次。", "info");
        }
    }
}

function applyAlertVolume(value, { silent = false } = {}) {
    alertVolume = sanitizeAlertVolume(value);
    saveAlertVolume();
    updateAlertVolumeUI();

    if (!silent) {
        const volumeText = alertVolume === 0 ? "已靜音" : `目前音量 ${getEffectiveAlertVolumePercent()}%`;
        showToast("音效音量已更新", volumeText, "info");

        if (audioUnlocked && alertVolume > 0) {
            playAlertSound("reminder");
        }
    }
}

window.addEventListener("scroll", updateFloatingNextCardVisibility);
updateFloatingNextCardVisibility();

function addRow(initialData = {}) {
    const row = createRowData(initialData.createdSeq);

    const wrapper = document.createElement("div");
    wrapper.className = "mushroom-row";

    const indexEl = document.createElement("div");
    indexEl.className = "row-index";
    indexEl.textContent = `${rows.length + 1}.`;

    const rowMain = document.createElement("div");
    rowMain.className = "row-main";

    const nameField = document.createElement("div");
    nameField.className = "field";
    const nameLabelRow = document.createElement("div");
    nameLabelRow.className = "field-label-row";
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "地點";
    const statusBadge = document.createElement("span");
    statusBadge.className = "row-status-badge is-empty";
    statusBadge.textContent = "未設定";
    nameLabelRow.append(nameLabel, statusBadge);
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "例如：台北世家中庭帷幕";
    nameInput.value = initialData.name || "";
    nameField.append(nameLabelRow, nameInput);

    const timeField = document.createElement("div");
    timeField.className = "field";
    const timeLabel = document.createElement("label");
    timeLabel.textContent = "輸入剩餘時間";
    const timeInputs = document.createElement("div");
    timeInputs.className = "time-inputs";
    const hoursInput = createNumberInput("時");
    const minutesInput = createNumberInput("分");
    const secondsInput = createNumberInput("秒");
    timeInputs.append(hoursInput, minutesInput, secondsInput);
    timeField.append(timeLabel, timeInputs);

    const countdownField = document.createElement("div");
    countdownField.className = "field";
    const countdownLabel = document.createElement("label");
    countdownLabel.textContent = "目前剩餘時間";
    const countdownBox = document.createElement("div");
    countdownBox.className = "countdown-box";
    countdownBox.textContent = "00:00:00";
    countdownField.append(countdownLabel, countdownBox);

    const respawnField = document.createElement("div");
    respawnField.className = "field";
    const respawnLabel = document.createElement("label");
    respawnLabel.textContent = "推算重生時間（+5 分鐘）";
    const respawnBox = document.createElement("div");
    respawnBox.className = "respawn-box";
    respawnBox.textContent = "—";
    respawnField.append(respawnLabel, respawnBox);

    const actionField = document.createElement("div");
    actionField.className = "row-actions";

    const addTagBtn = document.createElement("button");
    addTagBtn.className = "btn-outline btn-add-tag";
    addTagBtn.textContent = "加入標籤";

    const rowActionsBottom = document.createElement("div");
    rowActionsBottom.className = "row-actions-bottom";

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn-outline";
    copyBtn.textContent = "複製";

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-outline";
    removeBtn.textContent = "刪除";

    rowActionsBottom.append(copyBtn, removeBtn);
    actionField.append(addTagBtn, rowActionsBottom);

    rowMain.append(nameField, timeField, countdownField, respawnField);
    wrapper.append(indexEl, rowMain, actionField);
    rowList.appendChild(wrapper);

    row.elements = {
        wrapper,
        indexEl,
        nameInput,
        hoursInput,
        minutesInput,
        secondsInput,
        countdownBox,
        respawnBox,
        statusBadge,
        addTagBtn,
        copyBtn,
        removeBtn,
    };

    row.targetTimestamp =
        typeof initialData.targetTimestamp === "number"
            ? initialData.targetTimestamp
            : null;
    row.respawnState = initialData.respawnState === true;
    row.lastRespawnTimestamp =
        typeof initialData.lastRespawnTimestamp === "number"
            ? initialData.lastRespawnTimestamp
            : null;

    updateInputFieldsFromTarget(row);
    resetRowAlertState(row, { alignToCurrentWindow: Boolean(initialData.targetTimestamp) });

    if (isRowRespawned(row)) {
        clearRespawnedRowInputs(row, { skipSave: true, skipNextCardUpdate: true });
    }

    nameInput.addEventListener("input", () => {
        updateNextMushroomCard();
        saveRowsToStorage();
    });

    [hoursInput, minutesInput, secondsInput].forEach((input) => {
        input.addEventListener("input", () => {
            if (Number(input.value) < 0) {
                input.value = "0";
            }
            syncRowTimer(row);
        });
    });

    addTagBtn.addEventListener("click", () => {
        const name = row.elements.nameInput.value.trim() || "未命名蘑菇";
        addTag(name);
        flashButton(addTagBtn, "已加入");
    });

    copyBtn.addEventListener("click", async () => {
        const text = getRowCopyText(row);
        if (!text) {
            flashButton(copyBtn, "沒有時間");
            return;
        }

        await copyText(text, copyBtn);
    });

    removeBtn.addEventListener("click", () => {
        const index = rows.findIndex((item) => item.id === row.id);
        if (index === -1 || rows.length === 1) {
            return;
        }

        rows.splice(index, 1);
        hideActiveReminderToast(row);
        clearRespawnHighlight(row);
        wrapper.remove();
        updateIndices();
        updateNextMushroomCard();
        saveRowsToStorage();
    });

    rows.push(row);
    updateIndices();
    updateRowDisplay(row);
    updateNextMushroomCard();
    saveRowsToStorage();
}

function restoreRowsFromStorage() {
    const savedRows = loadRowsFromStorage();

    if (savedRows.length === 0) {
        addRow();
        return;
    }

    savedRows.forEach((savedRow) => {
        addRow(savedRow);
    });
}

function clearAllRows() {
    const confirmed = window.confirm(
        "確定要清空整個蘑菇清單嗎？\n清空後目前所有蘑菇資料都會被移除。"
    );

    if (!confirmed) {
        return;
    }

    rows.forEach((row) => {
        hideActiveReminderToast(row);
        clearRespawnHighlight(row);
        row.elements.wrapper.remove();
    });
    rows.length = 0;

    localStorage.removeItem(ROWS_STORAGE_KEY);

    addRow();
    updateIndices();
    updateNextMushroomCard();

    if (clearAllBtn) {
        flashButton(clearAllBtn, "已清空");
    }
}

function updateClock() {
    const now = getTaipeiNow();
    taipeiNowEl.textContent = formatTaipeiDateTime(now);
    footerTimeEl.textContent = `現在時間：${formatTaipeiTime(now)}（台北時間）`;
}

function tick() {
    updateClock();
    rows.forEach(updateRowDisplay);
    checkAndFireAlerts();
    updateNextMushroomCard();
}

sortBtn.addEventListener("click", () => {
    sortRowsByRespawnTime();
    flashButton(sortBtn, "已排序");
});

copyAllBtn.addEventListener("click", async () => {
    const lines = rows
        .map((row) => getRowCopyText(row))
        .filter((text) => text !== null);

    if (lines.length === 0) {
        flashButton(copyAllBtn, "沒有可複製");
        return;
    }

    await copyText(lines.join("\n"), copyAllBtn);
});

if (clearAllBtn) {
    clearAllBtn.addEventListener("click", clearAllRows);
}

if (leadSecondsInput) {
    leadSecondsInput.addEventListener("change", () => {
        applyAlertLeadSeconds(leadSecondsInput.value);
    });

    leadSecondsInput.addEventListener("blur", () => {
        applyAlertLeadSeconds(leadSecondsInput.value, { silent: true });
    });
}

if (leadAlertEnabledInput) {
    leadAlertEnabledInput.addEventListener("change", () => {
        applyAlertLeadEnabled(leadAlertEnabledInput.checked);
    });
}

if (frequentReminderEnabledInput) {
    frequentReminderEnabledInput.addEventListener("change", () => {
        applyFrequentReminderEnabled(frequentReminderEnabledInput.checked);
    });
}

if (systemNotificationEnabledInput) {
    systemNotificationEnabledInput.addEventListener("change", async () => {
        await applySystemNotificationEnabled(systemNotificationEnabledInput.checked);
    });
}

if (alertVolumeInput) {
    alertVolumeInput.addEventListener("input", () => {
        updateAlertVolumeUIValueOnly(alertVolumeInput.value);
    });

    alertVolumeInput.addEventListener("change", () => {
        applyAlertVolume(alertVolumeInput.value);
    });
}

function updateAlertVolumeUIValueOnly(value) {
    const sanitized = sanitizeAlertVolume(value);

    if (alertVolumeInput) {
        updateRangeProgress(alertVolumeInput, sanitized);
    }

    if (alertVolumeTextEl) {
        alertVolumeTextEl.textContent = `${getEffectiveAlertVolumePercent(sanitized)}%`;
    }
}

addRowBtn.addEventListener("click", () => {
    addRow();
});

registerAudioUnlockEvents();
applyAlertLeadEnabled(alertLeadEnabled, { silent: true });
applyFrequentReminderEnabled(frequentReminderEnabled, { silent: true });
applyAlertLeadSeconds(alertLeadSeconds, { silent: true });
applyAlertVolume(alertVolume, { silent: true });
applySystemNotificationEnabled(systemNotificationEnabled, { silent: true });
tags = loadTagsFromStorage();
renderTags();
restoreRowsFromStorage();
tick();
setInterval(tick, 200);
