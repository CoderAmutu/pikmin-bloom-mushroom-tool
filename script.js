const rowList = document.getElementById("row-list");
const addRowBtn = document.getElementById("add-row-btn");
const taipeiNowEl = document.getElementById("taipei-now");
const footerTimeEl = document.getElementById("footer-time");
const kindModalEl = document.getElementById("kind-modal");
const kindModalBackdropEl = document.getElementById("kind-modal-backdrop");
const kindModalCloseBtn = document.getElementById("kind-modal-close");
const kindModalSubEl = document.getElementById("kind-modal-sub");
const kindModalPreviewEl = document.getElementById("kind-modal-preview");
const kindSizeListEl = document.getElementById("kind-size-list");
const kindTypeListEl = document.getElementById("kind-type-list");
const kindTypeHintEl = document.getElementById("kind-type-hint");
const kindClearBtn = document.getElementById("kind-clear-btn");
const kindDoneBtn = document.getElementById("kind-done-btn");
const sortBtn = document.getElementById("sort-btn");
const bottomSortBtn = document.getElementById("bottom-sort-btn");
const copyAllBtn = document.getElementById("copy-all-btn");
const clearAllBtn = document.getElementById("clear-all-btn");
const nextMushroomNameEl = document.getElementById("next-mushroom-name");
const nextMushroomTimeEl = document.getElementById("next-mushroom-time");
const nextMushroomOpenHintEl = document.getElementById("next-mushroom-open-hint");
const nextMushroomOpenNowDelayEl = document.getElementById("next-mushroom-open-now-delay");
const gameLoadSecondsInput = document.getElementById("game-load-seconds-input");
const refreshPeriodSecondsInput = document.getElementById("refresh-period-seconds-input");
const biasModeButtons = Array.from(document.querySelectorAll(".bias-mode-btn"));
const customBiasSecondsInput = document.getElementById("custom-bias-seconds-input");
const customBiasWrapperEl = document.getElementById("custom-bias-wrapper");
const measureLoadBtn = document.getElementById("measure-load-btn");
const leadSecondsInput = document.getElementById("lead-seconds-input");
const leadAlertEnabledInput = document.getElementById("lead-alert-enabled");
const leadAlertSettingEl = document.getElementById("lead-alert-setting");
const frequentReminderEnabledInput = document.getElementById("frequent-reminder-enabled");
const systemNotificationEnabledInput = document.getElementById("system-notification-enabled");
const alertVolumeInput = document.getElementById("alert-volume-input");
const alertVolumeTextEl = document.getElementById("alert-volume-text");
const toastStackEl = document.getElementById("toast-stack");
const syncStatusEl = document.getElementById("sync-status");
const rowSearchInput = document.getElementById("row-search-input");
const rowSearchClearBtn = document.getElementById("row-search-clear");
const rowSearchCountEl = document.getElementById("row-search-count");
const rowSearchEmptyEl = document.getElementById("row-search-empty");
const rowSearchBarEl = document.getElementById("row-search");
const floatingSearchEl = document.getElementById("floating-search");
const floatingSearchInput = document.getElementById("floating-search-input");
const floatingSearchClearBtn = document.getElementById("floating-search-clear");
const floatingSearchCountEl = document.getElementById("floating-search-count");

let customSortBtn = null;
let deferredInstallPrompt = null;
let installBtn = null;
let testModeBtn = null;
let testMode = false;

const WORKER_URL = "https://pikmin-push-worker.amutu-lab.workers.dev";
const VAPID_PUBLIC_KEY = "BECUpa1WhUmi9zqG6LCB6t_sXG0A8i_nU2kMd5npj5zRHWGWw9xXwZPPouxPOZzhxnCpS3BUH7wY4bSenxsuhvU";
const CLIENT_ID_STORAGE_KEY = "pikmin-mushroom-client-id";

const ROWS_STORAGE_KEY = "pikmin-mushroom-rows";
const ALERT_SECONDS_STORAGE_KEY = "pikmin-mushroom-alert-seconds";
const ALERT_ENABLED_STORAGE_KEY = "pikmin-mushroom-alert-enabled";
const FREQUENT_REMINDER_ENABLED_STORAGE_KEY = "pikmin-mushroom-frequent-reminder-enabled";
const SYSTEM_NOTIFICATION_ENABLED_STORAGE_KEY = "pikmin-mushroom-system-notification-enabled";
const ALERT_VOLUME_STORAGE_KEY = "pikmin-mushroom-alert-volume";
const SORT_MODE_STORAGE_KEY = "pikmin-mushroom-sort-mode";
const PROFILES_STORAGE_KEY = "pikmin-mushroom-profiles";
const OPTIMAL_OPEN_STORAGE_KEY = "pikmin-mushroom-optimal-open-settings";

// 蘑菇大小／種類：只是記錄用的標記，完全不影響倒數與重生推算。特殊蘑菇常有人趕在
// 被摧毀前才進去，時間會有誤差，標起來就知道哪幾顆的數字要抓寬一點。
const MUSHROOM_SIZES = ["小", "一般", "大", "巨大"];

// 種類分三組：活動 / 屬性 / 顏色。這個順序同時也是 modal 裡的三列排法。
const MUSHROOM_TYPE_GROUPS = [
    { key: "event", types: ["活動"] },
    { key: "element", types: ["火", "電", "水", "毒", "水晶"] },
    { key: "color", types: ["紅", "黃", "藍", "紫", "白", "粉", "灰", "冰"] },
];
const MUSHROOM_TYPES = MUSHROOM_TYPE_GROUPS.flatMap((group) => group.types);

const ALL_TYPE_GROUP_KEYS = MUSHROOM_TYPE_GROUPS.map((group) => group.key);

// 純顯示用。存進 localStorage 的一律是「火」這種原始字串，不要把 emoji 寫進資料裡。
const MUSHROOM_TYPE_ICONS = {
    活動: "🎉",
    火: "🔥",
    電: "⚡",
    水: "💧",
    毒: "☠️",
    水晶: "💎",
};

function getMushroomTypeIcon(type) {
    return MUSHROOM_TYPE_ICONS[type] || "";
}

// 遊戲規則：哪個大小能配哪幾組種類。forcedType 是選了那個大小就自動帶入的種類。
// 要跟著遊戲改規則，動這張表就好。
const MUSHROOM_SIZE_RULES = {
    小: {
        groups: ["color"],
        hint: "小蘑菇只有顏色，沒有屬性也不會是活動。",
    },
    一般: {
        groups: ALL_TYPE_GROUP_KEYS,
        hint: "",
    },
    大: {
        groups: ["element", "color"],
        hint: "活動蘑菇只有一般與巨大，沒有大。",
    },
    巨大: {
        groups: ["event"],
        forcedType: "活動",
        hint: "巨大蘑菇只會在活動出現，種類固定為活動。",
    },
};

// 還沒選大小時不限制，種類隨便挑。
const MUSHROOM_SIZE_RULE_ANY = { groups: ALL_TYPE_GROUP_KEYS, hint: "" };

function getSizeRule(size) {
    return MUSHROOM_SIZE_RULES[size] || MUSHROOM_SIZE_RULE_ANY;
}

function getTypeGroupKey(type) {
    const group = MUSHROOM_TYPE_GROUPS.find((item) => item.types.includes(type));
    return group ? group.key : null;
}

function isTypeAllowedForSize(type, size) {
    if (!type) {
        return true;
    }

    return getSizeRule(size).groups.includes(getTypeGroupKey(type));
}

const SORT_MODE_RESPAWN = "respawn";
const SORT_MODE_CUSTOM = "custom";

const DEFAULT_ALERT_LEAD_SECONDS = 90;
const MIN_ALERT_LEAD_SECONDS = 1;
const MAX_ALERT_LEAD_SECONDS = 300;
const DEFAULT_ALERT_ENABLED = true;
const DEFAULT_FREQUENT_REMINDER_ENABLED = true;
const DEFAULT_SYSTEM_NOTIFICATION_ENABLED = false;
const DEFAULT_ALERT_VOLUME = 65;
const REMINDER_INTERVAL_SECONDS = 5;
const SOON_STATUS_WINDOW_SECONDS = 5 * 60;
// 想改成重生前幾秒開始高亮，就改這個數字（目前是 10 秒）
const PRE_RESPAWN_HIGHLIGHT_SECONDS = 10;

// 「最後校正窗口」：被摧毀前這幾分鐘。摧毀後蘑菇從遊戲裡消失、再也讀不到時間，
// 所以要重新確認只能趁這段。進了窗口就一律提醒，不管資料多新——這一輪到重生
// 要跨快 10 分鐘（4 分鐘窗口 + 摧毀後 5 分鐘重生等待），多少會飄一點。
// 這個數字同時也是「有沒有校正過」的判準：inputAt 落在窗口內就算校正過。
const LAST_CALIBRATION_WINDOW_SECONDS = 4 * 60;

// 進了最後校正窗口要主動叫人，不能只靠那一列自己閃橘色——清單一長、又照重生時間
// 排序，正在窗口內的那列常常捲在畫面外，等發現時已經被摧毀了。
// 這兩個是「剩幾秒時響一次」：一進窗口先響，剩一分鐘再補最後一次。
const CALIBRATION_ALERT_STAGES = [LAST_CALIBRATION_WINDOW_SECONDS, 60];
// 浮動卡片最多列幾筆，超過的用「還有 N 筆」帶過，免得卡片長到蓋住整個畫面。
const MAX_FLOATING_CALIBRATION_ITEMS = 3;

// 「最佳開遊戲時機」校正：畫面刷新時間點 = gameLoadSeconds + refreshPeriodSeconds 之後，每 refreshPeriodSeconds 一次
const DEFAULT_GAME_LOAD_SECONDS = 4;
const DEFAULT_REFRESH_PERIOD_SECONDS = 8;
const DEFAULT_OPEN_BIAS_MODE = "conservative";
// 保守模式緩衝秒數：開太早會多等快一個刷新週期，開太晚頂多多等這幾秒，故意讓建議時機偏晚一點點
const DEFAULT_CONSERVATIVE_BIAS_SECONDS = 1;
const DEFAULT_CUSTOM_BIAS_SECONDS = 1;

const floatingNextCardEl = document.getElementById("floating-next-card");
const floatingNextNameEl = document.getElementById("floating-next-name");
const floatingNextTimeEl = document.getElementById("floating-next-time");
const floatingNextOpenHintEl = document.getElementById("floating-next-open-hint");
const floatingNextOpenNowDelayEl = document.getElementById("floating-next-open-now-delay");
const floatingCalibrationCardEl = document.getElementById("floating-calibration-card");
const floatingCalibrationTitleEl = document.getElementById("floating-calibration-title");
const floatingCalibrationListEl = document.getElementById("floating-calibration-list");

const rows = [];
// 大小／種類 modal 目前在編輯哪一列，關起來時是 null。
let kindModalRow = null;
let profiles = {};
let activeProfileName = null;
let rowCreatedSeq = 0;
let alertLeadSeconds = loadAlertLeadSeconds();
let alertLeadEnabled = loadAlertLeadEnabled();
let frequentReminderEnabled = loadFrequentReminderEnabled();
let systemNotificationEnabled = loadSystemNotificationEnabled();
let alertVolume = loadAlertVolume();
let currentSortMode = loadSortMode();
let optimalOpenSettings = loadOptimalOpenSettings();
let rowSearchQuery = "";
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
        customOrder: finalCreatedSeq,
        targetTimestamp: null,
        inputAt: null,
        mushroomSize: null,
        mushroomType: null,
        respawnState: false,
        lastRespawnTimestamp: null,
        respawnTriggered: false,
        // 這一輪的校正提醒已經響到第幾階段（對應 CALIBRATION_ALERT_STAGES 的長度）
        calibrationAlertStage: 0,
        lastReminderBucket: null,
        leadAlertDismissed: false,
        activeReminderToast: null,
        systemLeadNotificationSent: false,
        workerScheduleActive: false,
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

// --- 網路對時：用 Worker 回傳的伺服器時間校準本機時鐘 ---
// 工具跑在電腦、遊戲跑在手機，兩個時鐘會慢慢走開。這裡量出「伺服器精確時間
// 與本機時鐘的差」，用來把本機時刻換算成真實世界時刻。
const TIME_SYNC_ENDPOINT = `${WORKER_URL}/api/time`;
const TIME_SYNC_INTERVAL_MS = 3 * 60 * 1000;
// 對時被視為「過期」的時間：超過這麼久沒成功對時，指示器就轉為警示。
const TIME_SYNC_STALE_MS = TIME_SYNC_INTERVAL_MS * 2 + 30 * 1000;
let timeOffsetMs = 0; // 伺服器精確時間 − 本機 Date.now()
let lastTimeSyncLocalAt = 0; // 上次成功對時的本機時間（0 = 從未成功）
let lastTimeSyncOffsetMs = 0; // 上次成功對時量到的本機時鐘偏差

function getAccurateNow() {
    return Date.now() + timeOffsetMs;
}

// --- 時間基準：兩把尺，別搞混 ---
//
// 所有存在 row 上的時刻（targetTimestamp / inputAt / lastRespawnTimestamp）
// 一律是「本機時鐘基準」，也就是純 Date.now() 的值。
//
// 為什麼不存校正後的時刻？因為那會把「凍結當下的 offset」永久烤進去：
//     顯示剩餘 = (Date.now()_輸入 + offset_輸入 + D) − (Date.now()_現在 + offset_現在)
//              = (純本機倒數)  +  (offset_輸入 − offset_現在)   ← 後面這項就是誤差
// offset 每對一次時就抖一次，於是每列都被平移一次，越早輸入的列偏得越多。
// 尤其頁面剛開、第一次對時還沒回來時輸入的列，會永久帶著整個本機時鐘偏差。
//
// 皮克敏那邊是固定期限：看到還有 5 小時，就一定是 5 小時後被摧毀、再 5 分鐘重生。
// 真值是確定的，所以倒數框裡任何跳動都是工具自己造的雜訊。用同一把尺（本機時鐘）
// 頭尾相減，那一項誤差就直接消失，而本機時鐘幾小時內的漂移遠小於對時抖動。
//
// offset 只在兩個地方才該出現，都用「當下最新」的值，所以對時每改善一次估計就跟著修正：
//   1. 把時刻換算成幾點幾分顯示（要跟現實的鐘對齊）→ toAbsoluteTime()
//   2. 排給 Worker / Service Worker 的推播時間（對方活在真實世界時間）→ toAbsoluteTime()
function toAbsoluteTime(localTimestamp) {
    return Number.isFinite(localTimestamp) ? localTimestamp + timeOffsetMs : null;
}

// 本機基準的時刻 → 台北時間字串。顯示用的唯一入口，省得漏掉換算。
function formatLocalTimestampAsTaipei(localTimestamp) {
    const absolute = toAbsoluteTime(localTimestamp);
    return absolute === null ? "—" : formatTaipeiTime(new Date(absolute));
}

async function syncTimeOffset() {
    try {
        const t0 = Date.now();
        const res = await fetch(TIME_SYNC_ENDPOINT, { cache: "no-store" });
        const t1 = Date.now();
        if (!res.ok) return;

        const data = await res.json();
        if (typeof data.now !== "number") return;

        // 用往返時間的一半補償網路延遲，估算「回應抵達當下」的伺服器精確時間。
        const roundTripMs = t1 - t0;
        const estimatedServerNowAtT1 = data.now + roundTripMs / 2;
        timeOffsetMs = estimatedServerNowAtT1 - t1;
        lastTimeSyncLocalAt = t1;
        lastTimeSyncOffsetMs = timeOffsetMs;
        updateTimeSyncIndicator();
    } catch {
        // 抓不到就沿用前一次的校準值（初始為 0，即退回本機時鐘），不影響運作。
    }
}

function updateTimeSyncIndicator() {
    if (!syncStatusEl) {
        return;
    }

    if (lastTimeSyncLocalAt === 0) {
        syncStatusEl.className = "sync-status is-pending";
        syncStatusEl.textContent = "⏳ 對時中…";
        return;
    }

    const sinceLastSyncMs = Date.now() - lastTimeSyncLocalAt;
    if (sinceLastSyncMs > TIME_SYNC_STALE_MS) {
        syncStatusEl.className = "sync-status is-stale";
        syncStatusEl.textContent = "⚠ 對時可能過期，暫用本機時鐘";
        return;
    }

    // 本機時鐘偏差多大就顯示多少，讓你知道「工具正在幫你補掉這個誤差」。
    const absOffset = Math.abs(Math.round(lastTimeSyncOffsetMs));
    syncStatusEl.className = "sync-status is-ok";
    syncStatusEl.textContent =
        absOffset <= 50
            ? "✓ 已與伺服器對時（本機時鐘很準）"
            : `✓ 已與伺服器對時（本機時鐘偏差 ${absOffset} 毫秒，已自動校正）`;
}

function getTaipeiNow() {
    return new Date(getAccurateNow());
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

function sanitizeMushroomSize(value) {
    return MUSHROOM_SIZES.includes(value) ? value : null;
}

function sanitizeMushroomType(value) {
    return MUSHROOM_TYPES.includes(value) ? value : null;
}

function loadRowsFromStorage() {
    try {
        const raw = localStorage.getItem(ROWS_STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        // 這裡讀出來的時刻一律當成本機時鐘基準（見 toAbsoluteTime 上面那段說明）。
        // 舊版存的是校正後基準，兩者差一個「當初寫入時的 offset」。載入這一刻還沒對時
        // （timeOffsetMs 仍是 0），沒有資訊能把那個值反推回來，所以直接照原值讀進來：
        // 殘留的偏差就等於它本來就烤進去的那個，不會比改版前更糟，而且蘑菇幾小時內
        // 就會輪替掉，之後全部都是新基準。
        return parsed
            .map((item) => ({
                name: String(item.name || "").trim(),
                targetTimestamp:
                    typeof item.targetTimestamp === "number" ? item.targetTimestamp : null,
                inputAt: typeof item.inputAt === "number" ? item.inputAt : null,
                mushroomSize: sanitizeMushroomSize(item.mushroomSize),
                mushroomType: sanitizeMushroomType(item.mushroomType),
                respawnState: item.respawnState === true,
                lastRespawnTimestamp:
                    typeof item.lastRespawnTimestamp === "number"
                        ? item.lastRespawnTimestamp
                        : null,
                createdSeq:
                    typeof item.createdSeq === "number" ? item.createdSeq : undefined,
                customOrder:
                    typeof item.customOrder === "number" ? item.customOrder : undefined,
            }))
            .filter(
                (item) =>
                    item.name !== "" ||
                    item.targetTimestamp !== null ||
                    item.mushroomSize !== null ||
                    item.mushroomType !== null ||
                    item.respawnState === true ||
                    typeof item.createdSeq === "number" ||
                    typeof item.customOrder === "number"
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
            inputAt: row.inputAt,
            mushroomSize: row.mushroomSize,
            mushroomType: row.mushroomType,
            respawnState: row.respawnState === true,
            lastRespawnTimestamp: row.lastRespawnTimestamp,
            createdSeq: row.createdSeq,
            customOrder: row.customOrder,
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

// 校正值支援到小數點後兩位（例如碼表量到的 2.69 秒），因為「現在開啟遊戲！」
// 的觸發時機在背後是用帶小數的精確運算算的，小數會讓觸發點更貼近實測。
function roundTo2(n) {
    return Math.round(n * 100) / 100;
}

function sanitizeGameLoadSeconds(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_GAME_LOAD_SECONDS;
    }
    return clamp(roundTo2(parsed), 0, 60);
}

function sanitizeRefreshPeriodSeconds(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_REFRESH_PERIOD_SECONDS;
    }
    return clamp(roundTo2(parsed), 1, 60);
}

function sanitizeCustomBiasSeconds(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_CUSTOM_BIAS_SECONDS;
    }
    return clamp(roundTo2(parsed), 0, 30);
}

function sanitizeOpenBiasMode(value) {
    return value === "custom" ? value : "conservative";
}

function loadOptimalOpenSettings() {
    const defaults = {
        gameLoadSeconds: DEFAULT_GAME_LOAD_SECONDS,
        refreshPeriodSeconds: DEFAULT_REFRESH_PERIOD_SECONDS,
        biasMode: DEFAULT_OPEN_BIAS_MODE,
        customBiasSeconds: DEFAULT_CUSTOM_BIAS_SECONDS,
    };

    try {
        const raw = localStorage.getItem(OPTIMAL_OPEN_STORAGE_KEY);
        if (raw === null) {
            return defaults;
        }

        const parsed = JSON.parse(raw);
        return {
            gameLoadSeconds: sanitizeGameLoadSeconds(parsed.gameLoadSeconds),
            refreshPeriodSeconds: sanitizeRefreshPeriodSeconds(parsed.refreshPeriodSeconds),
            biasMode: sanitizeOpenBiasMode(parsed.biasMode),
            customBiasSeconds: sanitizeCustomBiasSeconds(parsed.customBiasSeconds),
        };
    } catch {
        return defaults;
    }
}

function saveOptimalOpenSettings() {
    try {
        localStorage.setItem(OPTIMAL_OPEN_STORAGE_KEY, JSON.stringify(optimalOpenSettings));
    } catch {
        // ignore
    }
}

function loadSortMode() {
    try {
        const raw = localStorage.getItem(SORT_MODE_STORAGE_KEY);
        return raw === SORT_MODE_CUSTOM ? SORT_MODE_CUSTOM : SORT_MODE_RESPAWN;
    } catch {
        return SORT_MODE_RESPAWN;
    }
}

function saveSortMode() {
    try {
        localStorage.setItem(SORT_MODE_STORAGE_KEY, currentSortMode);
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
    return row.targetTimestamp + (testMode ? 70 * 1000 : 5 * 60 * 1000);
}

function getReminderTimestamp(row) {
    const respawnTimestamp = getRespawnTimestamp(row);
    if (!respawnTimestamp) {
        return null;
    }

    return respawnTimestamp - alertLeadSeconds * 1000;
}

function getRespawnText(row) {
    return formatLocalTimestampAsTaipei(getRespawnTimestamp(row));
}

function getRemainingSecondsFromTarget(targetTimestamp) {
    if (!targetTimestamp) {
        return 0;
    }

    // 本機基準減本機時鐘：同一把尺，對時抖動進不來。
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

// 第一次刷新的時間點（開遊戲後幾秒看到那個畫面 + 之後的刷新週期）
function getFirstRefreshSeconds() {
    return optimalOpenSettings.gameLoadSeconds + optimalOpenSettings.refreshPeriodSeconds;
}

function getOpenBiasSeconds() {
    if (optimalOpenSettings.biasMode === "custom") {
        return optimalOpenSettings.customBiasSeconds;
    }
    return DEFAULT_CONSERVATIVE_BIAS_SECONDS;
}

// 建議在重生前幾秒開遊戲。刻意比理論最準的時機（第一次刷新秒數）少一點點，
// 因為開太早會錯過第一次刷新、多等快一個刷新週期；開太晚頂多多等這個緩衝秒數。
function getOptimalOpenLeadSeconds() {
    return Math.max(0, getFirstRefreshSeconds() - getOpenBiasSeconds());
}

// 精準對齊刷新的開遊戲時機不是只有一個瞬間：只要「開遊戲倒數重生剩餘秒數」
// 落在 baseLead, baseLead+P, baseLead+2P... 這個序列上都一樣準。序列裡最小的
// baseLead（最貼近重生）之後不會再有更早對齊的機會了；更大的值代表更早開，
// 誤差一樣小，但換來更多時間可以在遊戲裡找到蘑菇。
// 這個函式回傳「目前為止最近一次已經到達的對齊時機」的秒數值，往後只會維持
// 不變或往下跳到下一個更小的值，可以拿來判斷「是不是進入了新的一次機會」。
function getMostRecentOptimalOpenCheckpointLead(secondsUntilRespawn) {
    const baseLead = getOptimalOpenLeadSeconds();

    if (!Number.isFinite(secondsUntilRespawn) || secondsUntilRespawn <= baseLead) {
        return baseLead;
    }

    const period = optimalOpenSettings.refreshPeriodSeconds;
    const steps = Math.ceil((secondsUntilRespawn - baseLead) / period);
    return baseLead + steps * period;
}

// 如果「現在」開遊戲並持續開著，重生之後還要再等幾秒，畫面才會刷新確定看到。
// 注意：這裡刻意回傳「重生後的額外等待秒數」（0 ~ 刷新週期-1 之間），而不是
// 「從現在到看到結果的總秒數」——總秒數會因為每次都是假設「這一刻才開」而重新
// 起算一輪新的刷新排程，導致數字每 8 秒才跳一次、中間 8 秒都不會變。額外等待
// 秒數則會跟著時間流逝每秒平順遞減，不會卡住不動。
function getIfOpenNowGapSeconds(respawnTimestamp, now = Date.now()) {
    if (!respawnTimestamp) {
        return null;
    }

    const firstRefreshSeconds = getFirstRefreshSeconds();
    const period = optimalOpenSettings.refreshPeriodSeconds;
    const secondsUntilRespawn = (respawnTimestamp - now) / 1000;

    if (secondsUntilRespawn <= firstRefreshSeconds) {
        return Math.max(0, firstRefreshSeconds - secondsUntilRespawn);
    }

    const cyclesNeeded = Math.ceil((secondsUntilRespawn - firstRefreshSeconds) / period);
    const delaySeconds = firstRefreshSeconds + cyclesNeeded * period;
    return delaySeconds - secondsUntilRespawn;
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

// 蘑菇已經被摧毀（畫面倒數歸零），遊戲裡看不到它了。
function isRowDestroyed(row) {
    return Boolean(row?.targetTimestamp) && row.targetTimestamp <= Date.now();
}

// 最後校正窗口：摧毀前這幾分鐘。過了這個窗口就再也沒機會從遊戲讀到時間，
// 所以橘色提醒只在這段閃，倒數還久時不吵、摧毀後閃也沒用。
function isInLastCalibrationWindow(row) {
    if (!row?.targetTimestamp || isRowDestroyed(row)) {
        return false;
    }

    return (
        getRemainingSecondsFromTarget(row.targetTimestamp) <=
        LAST_CALIBRATION_WINDOW_SECONDS
    );
}

// 這一列現在是不是「該去重新確認」：在窗口內、還沒被摧毀、這輪也還沒校正過。
// 橘色高亮、浮動卡片、聲音提醒三邊都看這個，判斷才不會各說各話。
function needsCalibrationNow(row) {
    return isInLastCalibrationWindow(row) && !hasCalibratedBeforeDestroy(row);
}

// 依「還有多久被摧毀」排序，最急的排前面。
function getRowsNeedingCalibration() {
    return rows
        .filter(needsCalibrationNow)
        .sort((a, b) => a.targetTimestamp - b.targetTimestamp);
}

function getSecondsUntilDestroy(row) {
    if (!row?.targetTimestamp) {
        return null;
    }

    return getRemainingSecondsFromTarget(row.targetTimestamp);
}

// 這輪資料是不是在最後校正窗口內取得的（重新確認會把 inputAt 更新成當下）。
// 有校正過，輸入到重生之間最多差 窗口 + 重生等待，誤差壓得住；
// 沒有的話，摧毀後就只能照舊資料推算，重生時間可能有偏差。
function hasCalibratedBeforeDestroy(row) {
    if (!row?.targetTimestamp || !row.inputAt) {
        return false;
    }

    const leadMs = row.targetTimestamp - row.inputAt;
    return leadMs >= 0 && leadMs <= LAST_CALIBRATION_WINDOW_SECONDS * 1000;
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
    return new URL("./images/ICON_192.png", window.location.href).href;
}

function getNotificationBadgeUrl() {
    return new URL("./images/badge.svg", window.location.href).href;
}

function showInstallButton() {
    if (installBtn) {
        installBtn.style.display = "";
        return;
    }

    const bottomActions = document.querySelector(".bottom-actions");
    if (!bottomActions) return;

    installBtn = document.createElement("button");
    installBtn.className = "btn-outline";
    installBtn.textContent = "安裝應用程式";
    installBtn.addEventListener("click", async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (outcome === "accepted") {
            hideInstallButton();
        }
    });

    bottomActions.appendChild(installBtn);
}

function hideInstallButton() {
    if (installBtn) {
        installBtn.style.display = "none";
    }
}

function loadProfilesFromStorage() {
    try {
        const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || Array.isArray(parsed)) return {};
        const result = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof key === "string" && Array.isArray(value)) {
                result[key] = value.map(String).filter((s) => s.length > 0);
            }
        }
        return result;
    } catch {
        return {};
    }
}

function saveProfilesToStorage() {
    try {
        localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    } catch {
        // ignore
    }
}

function renderProfiles() {
    const profileListEl = document.getElementById("profile-list");
    if (!profileListEl) return;

    profileListEl.innerHTML = "";

    const names = Object.keys(profiles);
    if (names.length === 0) {
        const emptyEl = document.createElement("div");
        emptyEl.className = "empty-tags";
        emptyEl.textContent = "目前還沒有設定檔";
        profileListEl.appendChild(emptyEl);
        return;
    }

    names.forEach((name) => {
        const isActive = name === activeProfileName;

        const item = document.createElement("div");
        item.className = "profile-item" + (isActive ? " is-active" : "");

        const nameEl = document.createElement("span");
        nameEl.className = "profile-item-name";
        nameEl.textContent = name;

        const actions = document.createElement("div");
        actions.className = "profile-item-actions";

        if (isActive) {
            const badge = document.createElement("span");
            badge.className = "profile-active-badge";
            badge.textContent = "使用中";
            item.append(nameEl, badge, actions);
        } else {
            item.append(nameEl, actions);
        }

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "btn-outline btn-sm btn-add-tag";
        saveBtn.textContent = "儲存";
        saveBtn.addEventListener("click", () => {
            const names = rows
                .map((row) => row.elements.nameInput.value.trim())
                .filter((n) => n.length > 0);
            if (names.length === 0) {
                showToast("無法儲存", "請先輸入至少一個地點名稱。", "warning");
                return;
            }
            const confirmed = window.confirm(`確定要用目前地點清單覆蓋「${name}」設定檔嗎？`);
            if (!confirmed) return;
            profiles[name] = names;
            saveProfilesToStorage();
            renderProfiles();
            showToast(`已更新「${name}」`, `共 ${names.length} 個地點。`, "success");
        });

        const applyBtn = document.createElement("button");
        applyBtn.type = "button";
        applyBtn.className = "btn-outline btn-sm";
        applyBtn.textContent = "套用";
        applyBtn.disabled = isActive;
        applyBtn.addEventListener("click", () => applyProfile(name));

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn-outline btn-sm btn-danger-soft";
        deleteBtn.textContent = "刪除";
        deleteBtn.addEventListener("click", () => {
            const confirmed = window.confirm(`確定要刪除設定檔「${name}」嗎？`);
            if (!confirmed) return;
            delete profiles[name];
            if (activeProfileName === name) activeProfileName = null;
            saveProfilesToStorage();
            renderProfiles();
        });

        actions.append(saveBtn, applyBtn, deleteBtn);
        profileListEl.appendChild(item);
    });
}

function applyProfile(name) {
    const locationNames = profiles[name];
    if (!locationNames) return;

    const confirmed = window.confirm(
        `確定要套用「${name}」設定檔嗎？\n目前的地點清單與計時器都會被清除。`
    );
    if (!confirmed) return;

    closeKindModal();

    rows.forEach((row) => {
        hideActiveReminderToast(row);
        clearRespawnHighlight(row);
        postToSw({ type: "CANCEL_NOTIFICATION", rowId: row.id });
        maybeCancelWorkerSchedule(row);
        row.elements.wrapper.remove();
    });
    rows.length = 0;
    localStorage.removeItem(ROWS_STORAGE_KEY);

    const namesToAdd = locationNames.length > 0 ? locationNames : [""];
    namesToAdd.forEach((locationName) => addRow({ name: locationName }));

    if (currentSortMode === SORT_MODE_CUSTOM) {
        sortRowsByCustomOrder({ persistMode: false });
    } else {
        sortRowsByRespawnTime({ persistMode: false });
    }

    activeProfileName = name;
    updateIndices();
    updateNextMushroomCard();
    renderProfiles();
    showToast(`已套用「${name}」`, `已載入 ${locationNames.length} 個地點。`, "success");
}

function saveCurrentAsProfile() {
    const names = rows
        .map((row) => row.elements.nameInput.value.trim())
        .filter((name) => name.length > 0);

    if (names.length === 0) {
        showToast("無法儲存", "請先輸入至少一個地點名稱。", "warning");
        return;
    }

    const profileName = window.prompt("新增場所設定檔\n\n將目前的地點清單儲存為一個新的設定檔，方便之後一鍵切換。\n\n請輸入設定檔名稱（例如：公司、在家、外縣市）：");
    if (profileName === null) return;

    const trimmedName = profileName.trim();
    if (!trimmedName) {
        showToast("無法儲存", "設定檔名稱不能為空。", "warning");
        return;
    }

    if (profiles[trimmedName]) {
        const overwrite = window.confirm(`設定檔「${trimmedName}」已存在，確定要覆蓋嗎？`);
        if (!overwrite) return;
    }

    profiles[trimmedName] = names;
    saveProfilesToStorage();
    renderProfiles();
    showToast(`已儲存「${trimmedName}」`, `共 ${names.length} 個地點。`, "success");
}

function updateTestModeUI() {
    if (!testModeBtn) return;
    testModeBtn.textContent = testMode ? "測試模式：開" : "測試模式：關";
    testModeBtn.classList.toggle("is-active", testMode);
}

function toggleTestMode() {
    testMode = !testMode;
    updateTestModeUI();
    rows.forEach((row) => {
        if (row.elements?.respawnLabel) {
            row.elements.respawnLabel.textContent = testMode
                ? "推算重生時間（+70 秒）"
                : "推算重生時間（+5 分鐘）";
        }
    });
    syncAllRowAlertStates({ alignToCurrentWindow: false });
    rescheduleAllSwNotifications();
    showToast(
        testMode ? "測試模式已開啟" : "測試模式已關閉",
        testMode ? "重生時間改為 +70 秒，方便快速測試。" : "重生時間恢復為 +5 分鐘。",
        "info"
    );
}

function initServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        return;
    }
    if (!serviceWorkerRegistrationPromise) {
        serviceWorkerRegistrationPromise = navigator.serviceWorker
            .register("./sw.js")
            .then(() => navigator.serviceWorker.ready)
            .catch(() => null);
    }
}

function getOrCreateClientId() {
    let id = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
    }
    return id;
}

function urlBase64ToUint8Array(b64u) {
    const pad = "=".repeat((4 - (b64u.length % 4)) % 4);
    const raw = atob((b64u + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function subscribeToPushIfNeeded() {
    if (!("PushManager" in window)) return;
    const registration = await serviceWorkerRegistrationPromise;
    if (!registration) return;

    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
        try {
            sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
        } catch (e) {
            console.warn("Push 訂閱失敗", e);
            return;
        }
    }

    fetch(`${WORKER_URL}/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: getOrCreateClientId(), subscription: sub.toJSON() }),
    }).catch((e) => console.warn("無法儲存訂閱", e));
}

function sendWorkerSchedule(row) {
    if (!systemNotificationEnabled || Notification.permission !== "granted") return;
    const respawnTimestamp = getRespawnTimestamp(row);
    if (!respawnTimestamp || respawnTimestamp <= Date.now()) return;

    const name = row.elements.nameInput.value.trim() || "未命名蘑菇";
    const leadMs = alertLeadEnabled ? respawnTimestamp - alertLeadSeconds * 1000 : null;

    row.workerScheduleActive = true;
    fetch(`${WORKER_URL}/api/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            clientId: getOrCreateClientId(),
            rowId: row.id,
            // Worker 活在真實世界時間，這裡才把本機基準換算過去（套當下最新的 offset）。
            respawnTimestamp: toAbsoluteTime(respawnTimestamp),
            leadTimestamp: leadMs && leadMs > Date.now() ? toAbsoluteTime(leadMs) : null,
            name,
        }),
    }).catch((e) => console.warn("無法排程推播", e));
}

function cancelWorkerSchedule(rowId) {
    const clientId = getOrCreateClientId();
    fetch(`${WORKER_URL}/api/schedule/${clientId}/${rowId}`, {
        method: "DELETE",
    }).catch((e) => console.warn("無法取消推播排程", e));
}

// 只有「之前真的送過排程給 Worker」的蘑菇才需要送取消，避免每次編輯/切換設定
// 都對從沒排程過的蘑菇白白發一次 DELETE，浪費 KV 額度。
function maybeCancelWorkerSchedule(row) {
    if (!row.workerScheduleActive) {
        return;
    }
    row.workerScheduleActive = false;
    cancelWorkerSchedule(row.id);
}

function postToSw(message) {
    if (!serviceWorkerRegistrationPromise) return;
    serviceWorkerRegistrationPromise.then((registration) => {
        if (registration?.active) {
            registration.active.postMessage(message);
        }
    });
}

function getSwSchedulePayload(row) {
    if (!systemNotificationEnabled || Notification.permission !== "granted") return null;
    const respawnTimestamp = getRespawnTimestamp(row);
    if (!respawnTimestamp || respawnTimestamp <= Date.now()) return null;

    const name = row.elements.nameInput.value.trim() || "未命名蘑菇";
    const leadMs = alertLeadEnabled ? respawnTimestamp - alertLeadSeconds * 1000 : null;

    return {
        type: "SCHEDULE_NOTIFICATION",
        rowId: row.id,
        name,
        // Service Worker 跟頁面在同一台裝置、共用同一個 Date.now()，
        // 所以排程時間維持本機基準，setTimeout 的算式才不會被對時抖動影響。
        respawnTimestamp,
        leadTimestamp: leadMs && leadMs > Date.now() ? leadMs : null,
        // 只有「幾點重生」這行字要跟現實的鐘對齊，在這邊先換算好再送過去。
        respawnTimeText: formatLocalTimestampAsTaipei(respawnTimestamp),
        notificationUrl: window.location.href,
    };
}

function scheduleSwNotification(row) {
    const payload = getSwSchedulePayload(row);
    if (!payload) {
        postToSw({ type: "CANCEL_NOTIFICATION", rowId: row.id });
        maybeCancelWorkerSchedule(row);
        return;
    }
    // SW 負責提前通知，標記主執行緒不要重複發送
    if (payload.leadTimestamp) {
        row.systemLeadNotificationSent = true;
    }
    postToSw(payload);
    sendWorkerSchedule(row);
}

function rescheduleAllSwNotifications() {
    if (!systemNotificationEnabled || Notification.permission !== "granted") {
        postToSw({ type: "CANCEL_ALL_NOTIFICATIONS" });
        rows.forEach(maybeCancelWorkerSchedule);
        return;
    }
    rows.forEach(scheduleSwNotification);
}

async function ensureNotificationServiceWorker() {
    if (!isSystemNotificationSupported() || !("serviceWorker" in navigator)) {
        return null;
    }
    if (!serviceWorkerRegistrationPromise) {
        initServiceWorker();
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
        badge: getNotificationBadgeUrl(),
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

    // 新的一輪時間＝新的校正機會，提醒階段跟著歸零。alignToCurrentWindow 是還原
    // 既有資料（重整、排序）時用的：直接對齊現在的階段，才不會一開頁面就補響一輪。
    row.calibrationAlertStage = alignToCurrentWindow
        ? CALIBRATION_ALERT_STAGES.filter(
              (threshold) => (getSecondsUntilDestroy(row) ?? Infinity) <= threshold
          ).length
        : 0;

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
    row.inputAt = null;
    row.respawnState = true;
    row.respawnTriggered = true;
    row.lastReminderBucket = null;
    row.leadAlertDismissed = false;
    row.systemLeadNotificationSent = false;
    postToSw({ type: "CANCEL_NOTIFICATION", rowId: row.id });
    maybeCancelWorkerSchedule(row);

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
    // 用純本機時鐘凍結期限：這個數字之後不會再被任何對時結果動到。
    row.targetTimestamp = totalSeconds > 0 ? Date.now() + totalSeconds * 1000 : null;
    row.inputAt = row.targetTimestamp ? Date.now() : null;

    resetRowAlertState(row);
    updateRowDisplay(row);
    updateNextMushroomCard();
    saveRowsToStorage();
    scheduleSwNotification(row);
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

function updateInputAgeDisplay(row) {
    const el = row.elements?.inputAgeEl;
    const textEl = row.elements?.inputAgeText;
    const confirmBtn = row.elements?.confirmAgeBtn;
    const wrapper = row.elements?.wrapper;
    if (!el || !textEl) {
        return;
    }

    if (!row.targetTimestamp || !row.inputAt) {
        el.classList.add("is-hidden");
        el.classList.remove("is-aged", "is-uncalibrated");
        textEl.textContent = "";
        if (confirmBtn) confirmBtn.hidden = true;
        wrapper?.classList.remove("is-input-aged");
        return;
    }

    el.classList.remove("is-hidden");
    const ageMinutes = Math.floor((Date.now() - row.inputAt) / 60000);
    const ageText = ageMinutes < 1 ? "剛剛輸入" : `輸入於 ${ageMinutes} 分鐘前`;
    const destroyed = isRowDestroyed(row);

    // 要不要叫你去重新確認：進了最後校正窗口就一律提醒，不管資料多新。
    // 因為這一輪從現在到重生要跨快 10 分鐘（4 分鐘窗口 + 摧毀後 5 分鐘等重生），
    // 就算剛輸入不久，到重生時也可能飄個一秒，趁還看得到就再讀一次最穩。
    // 窗口外還來得及，現在吵沒意義；摧毀後已經來不及，吵了也補救不了。
    // 解除條件是「這一輪已經在窗口內校正過」——按下確認無誤會把 inputAt 更新成
    // 當下，隨即落進窗口內，提醒就收起來，不會按了又立刻跳回來。
    const needsCalibration = needsCalibrationNow(row);

    if (destroyed) {
        // 摧毀後蘑菇從遊戲裡消失，已經沒得再確認，所以不再叫人去確認，
        // 只把「這輪到底有沒有校正過」講清楚，讓你知道重生時間可不可以全信。
        const calibrated = hasCalibratedBeforeDestroy(row);
        el.classList.remove("is-aged");
        el.classList.toggle("is-uncalibrated", !calibrated);
        textEl.textContent = calibrated
            ? `${ageText}・摧毀前已重新確認過，重生時間可信`
            : `${ageText}・摧毀前沒有重新確認，重生時間可能有誤差`;
        if (confirmBtn) confirmBtn.hidden = true;
    } else if (needsCalibration) {
        el.classList.add("is-aged");
        el.classList.remove("is-uncalibrated");
        textEl.textContent = `${ageText}・最後校正機會，摧毀後就沒得確認了`;
        if (confirmBtn) confirmBtn.hidden = false;
    } else {
        // 窗口外只中性地報「輸入於幾分鐘前」，不上色、不出按鈕、不催你。
        el.classList.remove("is-aged", "is-uncalibrated");
        textEl.textContent = ageText;
        if (confirmBtn) confirmBtn.hidden = true;
    }

    // 橘色高亮閃爍，讓你不用讀字、看到在閃就知道該去重新確認。
    // 摧毀後才會出現的「重生前綠色高亮」跟這裡天生互斥，不必再判一次。
    wrapper?.classList.toggle("is-input-aged", needsCalibration);
}

function updateRowDisplay(row) {
    updateRowStatusUI(row);
    updateRespawnHighlight(row);
    updateInputAgeDisplay(row);

    if (row.respawnState && !row.targetTimestamp) {
        row.elements.countdownBox.textContent = "00:00:00";
        row.elements.respawnBox.textContent = formatLocalTimestampAsTaipei(
            row.lastRespawnTimestamp
        );
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

// —— 地點搜尋 ——
// 只是「畫面上的篩選」，不影響倒數、提醒與即將冒出來的蘑菇判斷。
function normalizeSearchText(text) {
    return String(text || "").trim().toLowerCase();
}

function getRowSearchTokens() {
    const query = normalizeSearchText(rowSearchQuery);
    if (!query) {
        return [];
    }

    return query.split(/\s+/).filter(Boolean);
}

function rowMatchesSearchTokens(row, tokens) {
    if (tokens.length === 0) {
        return true;
    }

    const name = normalizeSearchText(row.elements.nameInput.value);
    if (!name) {
        return false;
    }

    return tokens.every((token) => name.includes(token));
}

function applyRowSearchFilter() {
    if (!rowSearchInput) {
        return;
    }

    const tokens = getRowSearchTokens();
    const searching = tokens.length > 0;
    let matchedCount = 0;

    rows.forEach((row) => {
        const { wrapper, nameInput } = row.elements;
        const matched = rowMatchesSearchTokens(row, tokens);

        if (matched) {
            matchedCount += 1;
        }

        // 正在打字的那一列先留著，免得打到一半整列消失。
        const keepVisible = matched || !searching || wrapper.contains(document.activeElement);

        wrapper.classList.toggle("is-filtered-out", !keepVisible);
        wrapper.classList.toggle("is-search-hit", searching && matched);
        nameInput.classList.toggle("is-search-hit", searching && matched);
    });

    if (rowSearchClearBtn) {
        rowSearchClearBtn.classList.toggle("is-hidden", rowSearchQuery === "");
    }

    if (rowSearchCountEl) {
        rowSearchCountEl.textContent = searching
            ? `符合 ${matchedCount} / ${rows.length} 筆`
            : "";
    }

    if (rowSearchEmptyEl) {
        rowSearchEmptyEl.classList.toggle("is-hidden", !searching || matchedCount > 0);
        if (searching && matchedCount === 0) {
            rowSearchEmptyEl.textContent = `找不到符合「${rowSearchQuery.trim()}」的地點`;
        }
    }

    updateFloatingSearchUI(searching, matchedCount);
    updateFloatingSearchVisibility();
}

function updateFloatingSearchUI(searching, matchedCount) {
    if (floatingSearchInput && floatingSearchInput.value !== rowSearchQuery) {
        floatingSearchInput.value = rowSearchQuery;
    }

    if (floatingSearchClearBtn) {
        floatingSearchClearBtn.classList.toggle("is-hidden", rowSearchQuery === "");
    }

    if (floatingSearchCountEl) {
        floatingSearchCountEl.textContent = searching
            ? `符合 ${matchedCount} / ${rows.length} 筆${matchedCount > 0 ? "（Enter 跳到第一筆）" : ""}`
            : "Enter 可跳到第一筆符合的地點";
    }
}

function getFirstSearchMatchRow() {
    const tokens = getRowSearchTokens();
    if (tokens.length === 0) {
        return null;
    }

    return rows.find((row) => rowMatchesSearchTokens(row, tokens)) || null;
}

function scrollToFirstSearchMatch() {
    const row = getFirstSearchMatchRow();
    if (!row) {
        return false;
    }

    row.elements.wrapper.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
}

// 捲到看不到上面那條搜尋列時，右下角才浮出來；回到上面就收起來，不擋畫面。
function isFloatingSearchFocused() {
    return Boolean(
        floatingSearchEl && floatingSearchEl.contains(document.activeElement)
    );
}

function updateFloatingSearchVisibility() {
    if (!floatingSearchEl || !rowSearchBarEl) {
        return;
    }

    // 正在用浮動搜尋打字時，就算上面那條搜尋列跑進畫面也不能把它藏起來。
    // （篩掉列之後整頁會變短，捲動位置被瀏覽器拉回上面，
    //   這時若跟著隱藏，游標會消失、字就接不下去。）
    if (isFloatingSearchFocused()) {
        floatingSearchEl.classList.add("is-visible");
        return;
    }

    const rect = rowSearchBarEl.getBoundingClientRect();
    const barOutOfView = rect.bottom < 8 || rect.top > window.innerHeight - 8;

    floatingSearchEl.classList.toggle("is-visible", barOutOfView);
}

function setRowSearchQuery(value) {
    rowSearchQuery = String(value || "");

    if (rowSearchInput && rowSearchInput.value !== rowSearchQuery) {
        rowSearchInput.value = rowSearchQuery;
    }

    applyRowSearchFilter();
}

function initRowSearch() {
    if (rowSearchInput) {
        rowSearchInput.addEventListener("input", () => {
            setRowSearchQuery(rowSearchInput.value);
        });

        rowSearchInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                scrollToFirstSearchMatch();
                return;
            }

            if (event.key === "Escape" && rowSearchInput.value !== "") {
                event.preventDefault();
                setRowSearchQuery("");
            }
        });

        if (rowSearchClearBtn) {
            rowSearchClearBtn.addEventListener("click", () => {
                setRowSearchQuery("");
                rowSearchInput.focus();
            });
        }
    }

    if (floatingSearchInput) {
        floatingSearchInput.addEventListener("input", () => {
            setRowSearchQuery(floatingSearchInput.value);
        });

        floatingSearchInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                scrollToFirstSearchMatch();
                return;
            }

            if (event.key === "Escape" && floatingSearchInput.value !== "") {
                event.preventDefault();
                setRowSearchQuery("");
            }
        });
    }

    if (floatingSearchClearBtn) {
        floatingSearchClearBtn.addEventListener("click", () => {
            setRowSearchQuery("");
            if (floatingSearchInput) {
                floatingSearchInput.focus();
            }
        });
    }

    if (floatingSearchEl) {
        floatingSearchEl.addEventListener("focusout", () => {
            // 等焦點真的落定（可能是移到清除鈕）再判斷，避免點按鈕時被收掉。
            setTimeout(() => {
                if (!isFloatingSearchFocused()) {
                    updateFloatingSearchVisibility();
                }
            }, 0);
        });
    }

    applyRowSearchFilter();
    updateFloatingSearchVisibility();
}

function updateIndices() {
    normalizeCustomOrders();

    rows.forEach((row, index) => {
        row.elements.indexEl.textContent = `${index + 1}.`;
        row.elements.removeBtn.disabled = rows.length === 1;
    });

    applyRowSearchFilter();
}

// 數字輸入框在「有游標」時，滾輪會直接加減數字。
// 這裡把第一格滾動吃掉並讓輸入框失焦，之後就只是單純捲動畫面，不會改到剛輸入好的秒數。
function preventWheelNumberChange(input) {
    if (!input || input.dataset.noWheelSpin === "1") {
        return input;
    }

    input.dataset.noWheelSpin = "1";
    input.addEventListener(
        "wheel",
        (event) => {
            if (document.activeElement !== input) {
                return;
            }

            event.preventDefault();
            input.blur();
        },
        { passive: false }
    );

    return input;
}

function preventWheelNumberChangeForAllNumberInputs() {
    document
        .querySelectorAll('input[type="number"]')
        .forEach((input) => preventWheelNumberChange(input));
}

function createNumberInput(placeholder) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.placeholder = placeholder;
    input.inputMode = "numeric";
    preventWheelNumberChange(input);
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

// 「巨大」＋「火」→「巨大火蘑菇」。只選一半也能組出名字，兩邊都沒選就回傳 null。
function formatMushroomKindName(size, type) {
    if (!size && !type) {
        return null;
    }

    return `${size || ""}${type || ""}蘑菇`;
}

function getRowMushroomKindName(row) {
    return formatMushroomKindName(row.mushroomSize, row.mushroomType);
}

// 顯示在膠囊與預覽帶上的字串：屬性蘑菇前面掛個 emoji，掃一眼就分得出來。
function getRowMushroomKindLabel(row) {
    const kindName = getRowMushroomKindName(row);
    if (!kindName) {
        return null;
    }

    const icon = getMushroomTypeIcon(row.mushroomType);
    return icon ? `${icon} ${kindName}` : kindName;
}

function updateRowKindChip(row) {
    const chip = row.elements && row.elements.kindChip;
    if (!chip) return;

    const kindLabel = getRowMushroomKindLabel(row);

    chip.textContent = kindLabel || "未選擇大小／種類";
    chip.classList.toggle("is-empty", !kindLabel);
    chip.title = "點一下選擇蘑菇大小／種類";

    if (row.mushroomType) {
        chip.dataset.mushroomType = row.mushroomType;
    } else {
        delete chip.dataset.mushroomType;
    }
}

// rowsOfValues 是二維陣列，每個子陣列自成一列（種類要分活動／元素／顏色三列）。
function buildKindChipList(listEl, rowsOfValues, groupKey) {
    if (!listEl) return;

    listEl.innerHTML = "";

    rowsOfValues.forEach((values) => {
        const rowEl = document.createElement("div");
        rowEl.className = "kind-chip-row";

        values.forEach((value) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "kind-chip";
            chip.dataset.kindValue = value;
            chip.dataset.kindGroup = groupKey;

            const icon = groupKey === "mushroomType" ? getMushroomTypeIcon(value) : "";
            if (icon) {
                const iconEl = document.createElement("span");
                iconEl.className = "kind-chip-icon";
                iconEl.textContent = icon;
                chip.append(iconEl, document.createTextNode(value));
            } else {
                chip.textContent = value;
            }

            if (groupKey === "mushroomType") {
                chip.dataset.mushroomType = value;
            }

            chip.addEventListener("click", () => {
                applyMushroomKind(groupKey, value);
            });

            rowEl.appendChild(chip);
        });

        listEl.appendChild(rowEl);
    });
}

// 再點一次同一個選項＝取消它，不用另外找清除鍵。
function applyMushroomKind(groupKey, value) {
    if (!kindModalRow) return;

    const nextValue = kindModalRow[groupKey] === value ? null : value;

    if (groupKey === "mushroomType" && !isTypeAllowedForSize(value, kindModalRow.mushroomSize)) {
        return;
    }

    kindModalRow[groupKey] = nextValue;

    // 改了大小就順手把種類調成合法值：巨大自動跳到活動，其餘配不起來的直接清掉。
    if (groupKey === "mushroomSize") {
        const { forcedType } = getSizeRule(nextValue);

        if (forcedType) {
            kindModalRow.mushroomType = forcedType;
        } else if (!isTypeAllowedForSize(kindModalRow.mushroomType, nextValue)) {
            kindModalRow.mushroomType = null;
        }
    }

    saveRowsToStorage();
    updateRowKindChip(kindModalRow);
    syncKindModal();
}

function clearMushroomKind() {
    if (!kindModalRow) return;

    if (!kindModalRow.mushroomSize && !kindModalRow.mushroomType) {
        return;
    }

    kindModalRow.mushroomSize = null;
    kindModalRow.mushroomType = null;

    saveRowsToStorage();
    updateRowKindChip(kindModalRow);
    syncKindModal();
}

function syncKindModal() {
    if (!kindModalRow) return;

    if (kindModalSubEl) {
        const name = kindModalRow.elements.nameInput.value.trim();
        const index = rows.indexOf(kindModalRow);
        kindModalSubEl.textContent = `地點：${name || `第 ${index + 1} 筆（未命名）`}`;
    }

    const sizeRule = getSizeRule(kindModalRow.mushroomSize);

    [kindSizeListEl, kindTypeListEl].forEach((listEl) => {
        if (!listEl) return;

        Array.from(listEl.querySelectorAll(".kind-chip")).forEach((chip) => {
            const isActive =
                kindModalRow[chip.dataset.kindGroup] === chip.dataset.kindValue;
            chip.classList.toggle("is-active", isActive);
            chip.setAttribute("aria-pressed", String(isActive));

            if (chip.dataset.kindGroup === "mushroomType") {
                chip.disabled = !isTypeAllowedForSize(
                    chip.dataset.kindValue,
                    kindModalRow.mushroomSize
                );
            }
        });
    });

    if (kindTypeHintEl) {
        kindTypeHintEl.textContent = sizeRule.hint;
        kindTypeHintEl.classList.toggle("is-hidden", !sizeRule.hint);
    }

    const kindName = getRowMushroomKindLabel(kindModalRow);

    if (kindModalPreviewEl) {
        kindModalPreviewEl.textContent = kindName || "未選擇大小／種類";
        kindModalPreviewEl.classList.toggle("is-empty", !kindName);

        if (kindModalRow.mushroomType) {
            kindModalPreviewEl.dataset.mushroomType = kindModalRow.mushroomType;
        } else {
            delete kindModalPreviewEl.dataset.mushroomType;
        }
    }

    if (kindClearBtn) {
        kindClearBtn.disabled = !kindName;
    }
}

function openKindModal(row) {
    if (!kindModalEl || !row) return;

    kindModalRow = row;
    syncKindModal();
    kindModalEl.classList.remove("is-hidden");
    document.body.classList.add("is-modal-open");

    if (kindDoneBtn) {
        kindDoneBtn.focus();
    }
}

function closeKindModal() {
    if (!kindModalEl) return;

    kindModalRow = null;
    kindModalEl.classList.add("is-hidden");
    document.body.classList.remove("is-modal-open");
}

function initMushroomKindModal() {
    buildKindChipList(kindSizeListEl, [MUSHROOM_SIZES], "mushroomSize");
    buildKindChipList(
        kindTypeListEl,
        MUSHROOM_TYPE_GROUPS.map((group) => group.types),
        "mushroomType"
    );

    if (kindClearBtn) {
        kindClearBtn.addEventListener("click", clearMushroomKind);
    }

    [kindDoneBtn, kindModalCloseBtn, kindModalBackdropEl].forEach((el) => {
        if (el) {
            el.addEventListener("click", closeKindModal);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && kindModalRow) {
            closeKindModal();
        }
    });
}

function normalizeCustomOrders() {
    const orderedRows = [...rows].sort((a, b) => {
        const aOrder = Number.isFinite(a.customOrder) ? a.customOrder : Number.MAX_SAFE_INTEGER;
        const bOrder = Number.isFinite(b.customOrder) ? b.customOrder : Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }

        return a.createdSeq - b.createdSeq;
    });

    orderedRows.forEach((row, index) => {
        row.customOrder = index + 1;
    });
}

function renderRowsInCurrentArrayOrder() {
    rows.forEach((row) => {
        rowList.appendChild(row.elements.wrapper);
    });

    updateIndices();
    updateCustomSortInteractionUI();
    updateNextMushroomCard();
}

function updateSortButtonsUI() {
    if (sortBtn) {
        sortBtn.disabled = false;
        sortBtn.classList.toggle("is-active", currentSortMode === SORT_MODE_RESPAWN);
        sortBtn.setAttribute("aria-pressed", currentSortMode === SORT_MODE_RESPAWN ? "true" : "false");
    }

    if (bottomSortBtn) {
        bottomSortBtn.classList.toggle("is-active", currentSortMode === SORT_MODE_RESPAWN);
        bottomSortBtn.setAttribute("aria-pressed", currentSortMode === SORT_MODE_RESPAWN ? "true" : "false");
    }

    if (customSortBtn) {
        customSortBtn.disabled = false;
        customSortBtn.classList.toggle("is-active", currentSortMode === SORT_MODE_CUSTOM);
        customSortBtn.setAttribute("aria-pressed", currentSortMode === SORT_MODE_CUSTOM ? "true" : "false");
    }
}

function updateCustomSortInteractionUI() {
    rows.forEach((row) => {
        const indexEl = row.elements?.indexEl;
        const moveControls = row.elements?.moveControls;
        const moveUpBtn = row.elements?.moveUpBtn;
        const moveDownBtn = row.elements?.moveDownBtn;

        if (!indexEl) {
            return;
        }

        if (currentSortMode === SORT_MODE_CUSTOM) {
            indexEl.style.cursor = "pointer";
            indexEl.title = "自訂順序模式：點一下可調整這筆的位置";
            indexEl.setAttribute("role", "button");
            indexEl.setAttribute("tabindex", "0");

            if (moveControls) {
                moveControls.style.display = "grid";
            }

            if (moveUpBtn) {
                moveUpBtn.disabled = rows.length <= 1 || row.customOrder <= 1;
            }

            if (moveDownBtn) {
                moveDownBtn.disabled = rows.length <= 1 || row.customOrder >= rows.length;
            }
        } else {
            indexEl.style.cursor = "default";
            indexEl.removeAttribute("title");
            indexEl.removeAttribute("role");
            indexEl.removeAttribute("tabindex");

            if (moveControls) {
                moveControls.style.display = "none";
            }

            if (moveUpBtn) {
                moveUpBtn.disabled = true;
            }

            if (moveDownBtn) {
                moveDownBtn.disabled = true;
            }
        }
    });
}

function sortRowsByCustomOrder(options = {}) {
    const { persistMode = true } = options;

    normalizeCustomOrders();
    rows.sort((a, b) => {
        if (a.customOrder !== b.customOrder) {
            return a.customOrder - b.customOrder;
        }

        return a.createdSeq - b.createdSeq;
    });

    if (persistMode) {
        currentSortMode = SORT_MODE_CUSTOM;
        saveSortMode();
    }

    renderRowsInCurrentArrayOrder();
    updateSortButtonsUI();
    saveRowsToStorage();
}

function moveRowByCustomStep(row, step) {
    if (!row || rows.length <= 1 || currentSortMode !== SORT_MODE_CUSTOM) {
        return;
    }

    sortRowsByCustomOrder({ persistMode: false });

    const currentIndex = rows.findIndex((item) => item.id === row.id);
    if (currentIndex === -1) {
        return;
    }

    const targetIndex = clamp(currentIndex + step, 0, rows.length - 1);
    if (targetIndex === currentIndex) {
        return;
    }

    const sortedRows = [...rows];
    const [movedRow] = sortedRows.splice(currentIndex, 1);
    sortedRows.splice(targetIndex, 0, movedRow);
    sortedRows.forEach((item, index) => {
        item.customOrder = index + 1;
    });

    rows.sort((a, b) => {
        if (a.customOrder !== b.customOrder) {
            return a.customOrder - b.customOrder;
        }

        return a.createdSeq - b.createdSeq;
    });

    renderRowsInCurrentArrayOrder();
    saveRowsToStorage();
}

function promptCustomOrderMove(row) {
    if (currentSortMode !== SORT_MODE_CUSTOM || rows.length <= 1) {
        return;
    }

    sortRowsByCustomOrder({ persistMode: false });

    const currentIndex = rows.findIndex((item) => item.id === row.id);
    if (currentIndex === -1) {
        return;
    }

    const name = row.elements.nameInput.value.trim() || `第 ${currentIndex + 1} 筆`;
    const raw = window.prompt(
        `請輸入「${name}」要移到第幾位（1-${rows.length}）`,
        String(currentIndex + 1)
    );

    if (raw === null) {
        return;
    }

    const targetIndex = Number(raw);
    if (!Number.isFinite(targetIndex)) {
        showToast("未更新順序", "請輸入有效的數字位置。", "warning");
        return;
    }

    const clampedIndex = clamp(Math.floor(targetIndex), 1, rows.length) - 1;
    if (clampedIndex === currentIndex) {
        return;
    }

    const sortedRows = [...rows];
    const [movedRow] = sortedRows.splice(currentIndex, 1);
    sortedRows.splice(clampedIndex, 0, movedRow);
    sortedRows.forEach((item, index) => {
        item.customOrder = index + 1;
    });

    rows.sort((a, b) => {
        if (a.customOrder !== b.customOrder) {
            return a.customOrder - b.customOrder;
        }

        return a.createdSeq - b.createdSeq;
    });

    renderRowsInCurrentArrayOrder();
    saveRowsToStorage();
}

function ensureCustomSortButton() {
    if (!sortBtn || !sortBtn.parentElement) {
        return;
    }

    if (!customSortBtn) {
        const button = document.createElement("button");
        button.type = "button";
        button.id = "custom-sort-btn";
        button.className = "btn-outline";
        customSortBtn = button;
    }

    sortBtn.textContent = "依重生時間排序";
    sortBtn.title = "依重生時間排序";
    sortBtn.style.minWidth = "0";
    sortBtn.style.paddingLeft = "14px";
    sortBtn.style.paddingRight = "14px";

    customSortBtn.textContent = "依自訂順序排序";
    customSortBtn.title = "依自訂順序排序";
    customSortBtn.style.minWidth = "0";
    customSortBtn.style.paddingLeft = "14px";
    customSortBtn.style.paddingRight = "14px";

    let wrapper = document.getElementById("sort-mode-actions");
    if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.id = "sort-mode-actions";
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.justifyContent = "flex-start";
        wrapper.style.gap = "8px";
        wrapper.style.rowGap = "8px";
        wrapper.style.flexWrap = "wrap";
        wrapper.style.flex = "1 0 100%";
        wrapper.style.width = "100%";
        wrapper.style.marginTop = "4px";

        const label = document.createElement("span");
        label.textContent = "排序方式";
        label.style.fontSize = "13px";
        label.style.fontWeight = "800";
        label.style.color = "#58708a";
        label.style.whiteSpace = "nowrap";
        wrapper.appendChild(label);

        sortBtn.parentElement.insertBefore(wrapper, sortBtn);
    }

    if (sortBtn.parentElement !== wrapper) {
        wrapper.appendChild(sortBtn);
    }

    if (customSortBtn.parentElement !== wrapper) {
        wrapper.appendChild(customSortBtn);
    }
}

function sortRowsByRespawnTime(options = {}) {
    const { persistMode = true } = options;
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

    if (persistMode) {
        currentSortMode = SORT_MODE_RESPAWN;
        saveSortMode();
    }

    renderRowsInCurrentArrayOrder();
    updateSortButtonsUI();
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

function getOptimalOpenHintText(respawnTimestamp) {
    if (!respawnTimestamp) {
        return "建議開遊戲：—";
    }

    const baseLead = getOptimalOpenLeadSeconds();
    const rawSecondsUntilRespawn = (respawnTimestamp - Date.now()) / 1000;

    if (rawSecondsUntilRespawn <= baseLead) {
        return "現在開啟遊戲！（最後機會，重生前已經沒有更早的對齊時機了）";
    }

    const bias = getOpenBiasSeconds();
    const period = optimalOpenSettings.refreshPeriodSeconds;
    const mostRecentLead = getMostRecentOptimalOpenCheckpointLead(rawSecondsUntilRespawn);
    const nextCheckpointLead = mostRecentLead - period;
    // 安全視窗的「上緣」＝理論最準時機（倒數剛好對齊刷新的那一刻）。倒數文字
    // 數到這裡才切成「現在開啟遊戲！」，不會提早把視窗上緣那段時間也算進安
    // 全範圍，確保使用者一定會先看到「1」倒數完，才看到訊息切換。
    const windowTopLead = nextCheckpointLead + bias;

    // 這次機會的安全視窗正開著：現在按下去都還來得及對齊，視窗會維持
    // bias 秒之久，過了這個視窗還沒按，就會直接摔進下一輪的等待，不會有
    // 「越接近越好」這種漸進感。
    if (rawSecondsUntilRespawn <= windowTopLead) {
        if (nextCheckpointLead <= baseLead) {
            return "現在開啟遊戲！（最後機會，重生前已經沒有更早的對齊時機了）";
        }
        return `現在開啟遊戲！（這次機會重生前還有 ${Math.round(nextCheckpointLead)} 秒，時間充裕）`;
    }

    const windowTopTimestamp = respawnTimestamp - windowTopLead * 1000;
    // 跟「重生時間」倒數用同一顆函式、同一種無條件進位法，避免兩個倒數在同一秒內
    // 用不同瞬間跳動、看起來像是不同步。
    const secondsUntilCheckpoint = getRemainingSecondsFromTarget(windowTopTimestamp);

    // baseLead / period 可能是小數，但這裡是給人對照「整秒倒數」用的引導文字，
    // 所以四捨五入到整數顯示，精確的觸發仍由上面的安全視窗判斷處理。
    const baseLeadText = Math.round(baseLead);
    const periodText = Math.round(period);

    if (nextCheckpointLead <= baseLead) {
        return `最後開啟機會：還有 ${formatDuration(secondsUntilCheckpoint)}（倒數剩 ${baseLeadText} 秒時開）`;
    }

    return `最佳開啟時機：還有 ${formatDuration(secondsUntilCheckpoint)}（之後每 ${periodText} 秒還有一次機會，最後機會在倒數剩 ${baseLeadText} 秒時）`;
}

function getOpenNowDelayText(respawnTimestamp) {
    const gapSeconds = getIfOpenNowGapSeconds(respawnTimestamp);
    if (gapSeconds === null) {
        return "現在開啟：—";
    }

    // 跟 getRemainingSecondsFromTarget 用同一種無條件進位公式（把秒數當成毫秒代入），
    // 確保這行文字跟「重生時間」「最佳開啟時機」在同一個瞬間跳動。
    const roundedGap = Math.max(0, Math.floor((gapSeconds * 1000 + 999) / 1000));
    if (roundedGap <= 0) {
        return "現在開啟並保持開著：重生當下就會刷新看到";
    }

    return `現在開啟並保持開著：重生後約 ${roundedGap} 秒才會刷新看到`;
}

function updateNextMushroomCard() {
    if (!nextMushroomNameEl || !nextMushroomTimeEl) {
        return;
    }

    const nextRow = getNextUpcomingRow();

    if (!nextRow) {
        nextMushroomNameEl.textContent = "地點：—";
        nextMushroomTimeEl.textContent = "重生時間：—（—）";

        if (nextMushroomOpenHintEl) {
            nextMushroomOpenHintEl.textContent = "建議開遊戲：—";
        }
        if (nextMushroomOpenNowDelayEl) {
            nextMushroomOpenNowDelayEl.textContent = "現在開啟：—";
        }

        if (floatingNextNameEl) {
            floatingNextNameEl.textContent = "地點：—";
        }
        if (floatingNextTimeEl) {
            floatingNextTimeEl.textContent = "重生：—（—）";
        }
        if (floatingNextOpenHintEl) {
            floatingNextOpenHintEl.textContent = "建議開遊戲：—";
        }
        if (floatingNextOpenNowDelayEl) {
            floatingNextOpenNowDelayEl.textContent = "現在開啟：—";
        }
        return;
    }

    const name = nextRow.elements.nameInput.value.trim() || "未命名蘑菇";
    const respawnTimestamp = getRespawnTimestamp(nextRow);
    const remainingSeconds = getRemainingSecondsFromTarget(respawnTimestamp);

    const timeText = formatLocalTimestampAsTaipei(respawnTimestamp);
    const remainText = formatDuration(remainingSeconds);
    const openHintText = getOptimalOpenHintText(respawnTimestamp);
    const openNowDelayText = getOpenNowDelayText(respawnTimestamp);

    nextMushroomNameEl.textContent = `地點：${name}`;
    nextMushroomTimeEl.textContent = `重生時間：${timeText}（${remainText}）`;

    if (nextMushroomOpenHintEl) {
        nextMushroomOpenHintEl.textContent = openHintText;
    }
    if (nextMushroomOpenNowDelayEl) {
        nextMushroomOpenNowDelayEl.textContent = openNowDelayText;
    }

    if (floatingNextNameEl) {
        floatingNextNameEl.textContent = `地點：${name}`;
    }
    if (floatingNextTimeEl) {
        floatingNextTimeEl.textContent = `重生：${timeText}（${remainText}）`;
    }
    if (floatingNextOpenHintEl) {
        floatingNextOpenHintEl.textContent = openHintText;
    }
    if (floatingNextOpenNowDelayEl) {
        floatingNextOpenNowDelayEl.textContent = openNowDelayText;
    }
}

// 浮動「該重新確認」卡片。跟「即將冒出來」那張不同，它不管捲到哪都會出現——
// 會漏掉就是因為那一列捲在畫面外，只在捲動後才顯示就失去意義了。
let floatingCalibrationKey = "";

function updateFloatingCalibrationCard() {
    if (!floatingCalibrationCardEl || !floatingCalibrationListEl) {
        return;
    }

    const needyRows = getRowsNeedingCalibration();

    if (needyRows.length === 0) {
        floatingCalibrationCardEl.classList.add("is-hidden");
        floatingCalibrationListEl.innerHTML = "";
        floatingCalibrationKey = "";
        return;
    }

    floatingCalibrationCardEl.classList.remove("is-hidden");

    if (floatingCalibrationTitleEl) {
        floatingCalibrationTitleEl.textContent =
            needyRows.length > 1 ? `⚠ 該重新確認（${needyRows.length}）` : "⚠ 該重新確認";
    }

    const shownRows = needyRows.slice(0, MAX_FLOATING_CALIBRATION_ITEMS);

    // 名單沒變就只更新倒數字，不要每 200ms 重建一次 DOM（重建會吃掉點擊）。
    const key = shownRows.map((row) => row.id).join("|") + `/${needyRows.length}`;

    if (key !== floatingCalibrationKey) {
        floatingCalibrationKey = key;
        floatingCalibrationListEl.innerHTML = "";

        shownRows.forEach((row) => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "floating-calibration-item";
            item.dataset.rowId = row.id;

            const nameEl = document.createElement("span");
            nameEl.className = "floating-calibration-item-name";

            const timeEl = document.createElement("span");
            timeEl.className = "floating-calibration-item-time";

            item.append(nameEl, timeEl);
            item.addEventListener("click", () => {
                row.elements.wrapper.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            });

            floatingCalibrationListEl.appendChild(item);
        });

        if (needyRows.length > shownRows.length) {
            const moreEl = document.createElement("div");
            moreEl.className = "floating-calibration-more";
            moreEl.textContent = `還有 ${needyRows.length - shownRows.length} 筆`;
            floatingCalibrationListEl.appendChild(moreEl);
        }
    }

    shownRows.forEach((row, index) => {
        const item = floatingCalibrationListEl.children[index];
        if (!item) return;

        const name = row.elements.nameInput.value.trim() || "未命名蘑菇";
        item.querySelector(".floating-calibration-item-name").textContent = name;
        item.querySelector(".floating-calibration-item-time").textContent =
            formatDuration(getSecondsUntilDestroy(row) ?? 0);
        item.title = `${name}：再 ${formatDuration(
            getSecondsUntilDestroy(row) ?? 0
        )} 被摧毀，點一下跳到那一列`;
    });
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

    // 校正提醒故意用「下行」音，跟重生那組上行音一聽就分得開：
    // 上行＝要冒出來了，下行＝快消失了，趁現在。
    if (kind === "calibration") {
        playTone(startAt, 784, 0.18, 0.055);
        playTone(startAt + 0.22, 587, 0.2, 0.06);
        playTone(startAt + 0.46, 494, 0.26, 0.06);
        return;
    }

    playTone(startAt, 784, 0.14, 0.05);
    playTone(startAt + 0.18, 988, 0.16, 0.055);
}

function triggerReminderToast(row, secondsUntilRespawn) {
    const name = row.elements.nameInput.value.trim() || "未命名蘑菇";
    const respawnTimestamp = getRespawnTimestamp(row);
    const respawnTimeText = formatLocalTimestampAsTaipei(respawnTimestamp);
    const openHintText = getOptimalOpenHintText(respawnTimestamp);

    hideActiveReminderToast(row);
    playAlertSound("reminder");
    row.activeReminderToast = showToast(
        `還有 ${secondsUntilRespawn} 秒：${name}`,
        `預計 ${respawnTimeText} 重生。\n${openHintText}\n按右上角 × 可停止這筆的提前提醒。`,
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

function triggerCalibrationToast(row, secondsUntilDestroy) {
    const name = row.elements.nameInput.value.trim() || "未命名蘑菇";
    const isFinalCall = secondsUntilDestroy <= 60;

    playAlertSound("calibration");
    showToast(
        `${isFinalCall ? "⚠ 最後機會" : "⚠ 該重新確認"}：${name}`,
        `再 ${formatDuration(secondsUntilDestroy)} 就被摧毀，趁現在回遊戲讀一次剩餘時間。\n摧毀後就沒得確認，重生時間會有誤差。`,
        "warning",
        {
            // 比重生提醒停久一點：這種提醒錯過就真的沒了，不像重生還會再輪一次。
            durationMs: 9000,
            shake: true,
            closable: true,
        }
    );
}

function triggerLeadSystemNotification(row, secondsUntilRespawn) {
    const name = row.elements.nameInput.value.trim() || "未命名蘑菇";
    const respawnTimestamp = getRespawnTimestamp(row);

    if (!respawnTimestamp) {
        return;
    }

    const respawnTimeText = formatLocalTimestampAsTaipei(respawnTimestamp);
    const openHintText = getOptimalOpenHintText(respawnTimestamp);
    showSystemNotification(
        `還有 ${secondsUntilRespawn} 秒：${name}`,
        `預計 ${respawnTimeText} 重生。${openHintText}`,
        { tag: `pikmin-lead-${row.id}`, renotify: frequentReminderEnabled }
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
        postToSw({ type: "CANCEL_ALL_NOTIFICATIONS" });

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
    await subscribeToPushIfNeeded();
    rescheduleAllSwNotifications();

    if (!silent) {
        showToast(
            "系統通知已開啟",
            "當頁面不在前景時，提前提醒與已重生都會跳出系統通知。",
            "success"
        );
    }

    return true;
}

// 進了最後校正窗口就出聲＋跳提醒。分兩階段響（進窗口、剩一分鐘），中間不重複吵，
// 已經按過「確認無誤」的就完全不響。
function checkCalibrationAlerts() {
    rows.forEach((row) => {
        if (!needsCalibrationNow(row)) {
            return;
        }

        const secondsUntilDestroy = getSecondsUntilDestroy(row);
        if (secondsUntilDestroy === null) {
            return;
        }

        // 落在第幾階段：剩餘秒數每跨過一個門檻就多一階。
        const stage = CALIBRATION_ALERT_STAGES.filter(
            (threshold) => secondsUntilDestroy <= threshold
        ).length;

        if (stage > row.calibrationAlertStage) {
            row.calibrationAlertStage = stage;
            triggerCalibrationToast(row, secondsUntilDestroy);
        }
    });
}

function checkAndFireAlerts() {
    checkCalibrationAlerts();

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

            if (frequentReminderEnabled) {
                triggerLeadSystemNotification(row, secondsUntilRespawn);
            } else if (isFirstLeadNotification && !row.systemLeadNotificationSent) {
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

    rescheduleAllSwNotifications();

    if (!silent && alertLeadEnabled) {
        showToast("提前提醒已更新", `目前會在重生前 ${alertLeadSeconds} 秒提醒您。`, "info");
    }
}

function persistAlertLeadSecondsWhileTyping() {
    if (!leadSecondsInput) {
        return;
    }

    const rawValue = leadSecondsInput.value;

    if (rawValue === "") {
        return;
    }

    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue)) {
        return;
    }

    alertLeadSeconds = sanitizeAlertLeadSeconds(parsedValue);
    saveAlertLeadSeconds();
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

    rescheduleAllSwNotifications();

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

function updateOptimalOpenSettingUI() {
    if (gameLoadSecondsInput) {
        gameLoadSecondsInput.value = String(optimalOpenSettings.gameLoadSeconds);
    }
    if (refreshPeriodSecondsInput) {
        refreshPeriodSecondsInput.value = String(optimalOpenSettings.refreshPeriodSeconds);
    }
    biasModeButtons.forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.mode === optimalOpenSettings.biasMode);
    });
    if (customBiasSecondsInput) {
        customBiasSecondsInput.value = String(optimalOpenSettings.customBiasSeconds);
    }
    if (customBiasWrapperEl) {
        customBiasWrapperEl.classList.toggle("is-hidden", optimalOpenSettings.biasMode !== "custom");
    }
}

function applyOptimalOpenSettings(partial, { silent = false } = {}) {
    const merged = { ...optimalOpenSettings, ...partial };
    optimalOpenSettings = {
        gameLoadSeconds: sanitizeGameLoadSeconds(merged.gameLoadSeconds),
        refreshPeriodSeconds: sanitizeRefreshPeriodSeconds(merged.refreshPeriodSeconds),
        biasMode: sanitizeOpenBiasMode(merged.biasMode),
        customBiasSeconds: sanitizeCustomBiasSeconds(merged.customBiasSeconds),
    };

    saveOptimalOpenSettings();
    updateOptimalOpenSettingUI();
    updateNextMushroomCard();

    if (!silent) {
        showToast(
            "最佳開遊戲設定已更新",
            `建議在重生前 ${getOptimalOpenLeadSeconds()} 秒開遊戲。`,
            "info"
        );
    }
}

ensureCustomSortButton();

window.addEventListener("scroll", () => {
    updateFloatingNextCardVisibility();
    updateFloatingSearchVisibility();
});
window.addEventListener("resize", updateFloatingSearchVisibility);
updateFloatingNextCardVisibility();
updateFloatingSearchVisibility();

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
    const kindChip = document.createElement("button");
    kindChip.type = "button";
    kindChip.className = "mushroom-kind-chip is-empty";
    kindChip.textContent = "未選擇大小／種類";
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
    nameField.append(kindChip, nameLabelRow, nameInput);

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
    respawnLabel.textContent = testMode ? "推算重生時間（+70 秒）" : "推算重生時間（+5 分鐘）";
    const respawnBox = document.createElement("div");
    respawnBox.className = "respawn-box";
    respawnBox.textContent = "—";
    const inputAgeEl = document.createElement("div");
    inputAgeEl.className = "row-input-age is-hidden";
    const inputAgeText = document.createElement("span");
    inputAgeText.className = "row-input-age-text";
    const confirmAgeBtn = document.createElement("button");
    confirmAgeBtn.type = "button";
    confirmAgeBtn.className = "row-input-age-confirm";
    confirmAgeBtn.textContent = "✓ 確認無誤";
    confirmAgeBtn.hidden = true;
    inputAgeEl.append(inputAgeText, confirmAgeBtn);
    respawnField.append(respawnLabel, respawnBox);

    const actionField = document.createElement("div");
    actionField.className = "row-actions";

    const rowMoveControls = document.createElement("div");
    rowMoveControls.className = "row-actions-bottom";

    const moveUpBtn = document.createElement("button");
    moveUpBtn.className = "btn-outline";
    moveUpBtn.type = "button";
    moveUpBtn.textContent = "↑ 往前";
    moveUpBtn.title = "自訂順序往前移一位";

    const moveDownBtn = document.createElement("button");
    moveDownBtn.className = "btn-outline";
    moveDownBtn.type = "button";
    moveDownBtn.textContent = "↓ 往後";
    moveDownBtn.title = "自訂順序往後移一位";

    rowMoveControls.append(moveUpBtn, moveDownBtn);

    const rowActionsBottom = document.createElement("div");
    rowActionsBottom.className = "row-actions-bottom";

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn-outline";
    copyBtn.textContent = "複製";

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-outline";
    removeBtn.textContent = "刪除";

    rowActionsBottom.append(copyBtn, removeBtn);
    actionField.append(rowMoveControls, rowActionsBottom);

    rowMain.append(nameField, timeField, countdownField, respawnField, inputAgeEl);
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
        respawnLabel,
        inputAgeEl,
        inputAgeText,
        confirmAgeBtn,
        statusBadge,
        kindChip,
        moveControls: rowMoveControls,
        moveUpBtn,
        moveDownBtn,
        copyBtn,
        removeBtn,
    };

    row.targetTimestamp =
        typeof initialData.targetTimestamp === "number"
            ? initialData.targetTimestamp
            : null;
    row.inputAt =
        row.targetTimestamp && typeof initialData.inputAt === "number"
            ? initialData.inputAt
            : null;
    row.mushroomSize = sanitizeMushroomSize(initialData.mushroomSize);
    row.mushroomType = sanitizeMushroomType(initialData.mushroomType);
    row.respawnState = initialData.respawnState === true;
    row.lastRespawnTimestamp =
        typeof initialData.lastRespawnTimestamp === "number"
            ? initialData.lastRespawnTimestamp
            : null;
    row.customOrder =
        typeof initialData.customOrder === "number"
            ? initialData.customOrder
            : row.createdSeq;

    updateInputFieldsFromTarget(row);
    resetRowAlertState(row, { alignToCurrentWindow: Boolean(initialData.targetTimestamp) });

    if (isRowRespawned(row)) {
        clearRespawnedRowInputs(row, { skipSave: true, skipNextCardUpdate: true });
    }

    nameInput.addEventListener("input", () => {
        updateNextMushroomCard();
        applyRowSearchFilter();
        saveRowsToStorage();
    });

    // 離開輸入框時再篩一次：打字期間被暫留的列，這時才真的收起來。
    nameInput.addEventListener("blur", () => {
        applyRowSearchFilter();
    });

    kindChip.addEventListener("click", () => {
        openKindModal(row);
    });

    // 「確認無誤」：不用重新輸入時間，只把「上次確認時間」更新成現在，
    // 橘色提醒消失、重新計時 10 分鐘。
    confirmAgeBtn.addEventListener("click", () => {
        if (!row.targetTimestamp) {
            return;
        }
        row.inputAt = Date.now();
        updateRowDisplay(row);
        saveRowsToStorage();
        showToast("已確認資料無誤", "重新計時，橘色提醒先消失。", "info");
    });

    indexEl.addEventListener("click", () => {
        promptCustomOrderMove(row);
    });

    indexEl.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        event.preventDefault();
        promptCustomOrderMove(row);
    });

    moveUpBtn.addEventListener("click", () => {
        moveRowByCustomStep(row, -1);
    });

    moveDownBtn.addEventListener("click", () => {
        moveRowByCustomStep(row, 1);
    });

    [hoursInput, minutesInput, secondsInput].forEach((input) => {
        input.addEventListener("input", () => {
            if (Number(input.value) < 0) {
                input.value = "0";
            }
            syncRowTimer(row);
        });
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

        if (kindModalRow === row) {
            closeKindModal();
        }

        hideActiveReminderToast(row);
        clearRespawnHighlight(row);
        postToSw({ type: "CANCEL_NOTIFICATION", rowId: row.id });
        maybeCancelWorkerSchedule(row);
        wrapper.remove();
        normalizeCustomOrders();

        if (currentSortMode === SORT_MODE_CUSTOM) {
            sortRowsByCustomOrder({ persistMode: false });
        } else {
            updateIndices();
            updateCustomSortInteractionUI();
            updateNextMushroomCard();
        }

        saveRowsToStorage();
    });

    rows.push(row);
    updateRowKindChip(row);

    if (currentSortMode === SORT_MODE_CUSTOM) {
        sortRowsByCustomOrder({ persistMode: false });
    } else {
        updateIndices();
        updateCustomSortInteractionUI();
        updateRowDisplay(row);
        updateNextMushroomCard();
        saveRowsToStorage();
    }

    updateRowDisplay(row);
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

    closeKindModal();

    rows.forEach((row) => {
        hideActiveReminderToast(row);
        clearRespawnHighlight(row);
        postToSw({ type: "CANCEL_NOTIFICATION", rowId: row.id });
        maybeCancelWorkerSchedule(row);
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
    updateFloatingCalibrationCard();
    updateTimeSyncIndicator();
}

if (sortBtn) {
    sortBtn.addEventListener("click", () => {
        sortRowsByRespawnTime();
        flashButton(sortBtn, "已排序");
    });
}

if (bottomSortBtn) {
    bottomSortBtn.addEventListener("click", () => {
        sortRowsByRespawnTime();
        flashButton(bottomSortBtn, "已排序");
    });
}

if (customSortBtn) {
    customSortBtn.addEventListener("click", () => {
        const wasCustomMode = currentSortMode === SORT_MODE_CUSTOM;
        sortRowsByCustomOrder();
        flashButton(customSortBtn, "已排序");

        if (!wasCustomMode) {
            showToast("已切換為自訂順序排序", "現在可點左側編號，或用右側往前 / 往後調整位置。", "info");
        }
    });
}

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
    leadSecondsInput.addEventListener("input", () => {
        persistAlertLeadSecondsWhileTyping();
    });

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

if (gameLoadSecondsInput) {
    gameLoadSecondsInput.addEventListener("change", () => {
        applyOptimalOpenSettings({ gameLoadSeconds: gameLoadSecondsInput.value });
    });
    gameLoadSecondsInput.addEventListener("blur", () => {
        applyOptimalOpenSettings({ gameLoadSeconds: gameLoadSecondsInput.value }, { silent: true });
    });
}

if (refreshPeriodSecondsInput) {
    refreshPeriodSecondsInput.addEventListener("change", () => {
        applyOptimalOpenSettings({ refreshPeriodSeconds: refreshPeriodSecondsInput.value });
    });
    refreshPeriodSecondsInput.addEventListener("blur", () => {
        applyOptimalOpenSettings({ refreshPeriodSeconds: refreshPeriodSecondsInput.value }, { silent: true });
    });
}

biasModeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        applyOptimalOpenSettings({ biasMode: btn.dataset.mode });
    });
});

if (customBiasSecondsInput) {
    customBiasSecondsInput.addEventListener("change", () => {
        applyOptimalOpenSettings({ customBiasSeconds: customBiasSecondsInput.value });
    });
    customBiasSecondsInput.addEventListener("blur", () => {
        applyOptimalOpenSettings({ customBiasSeconds: customBiasSecondsInput.value }, { silent: true });
    });
}

// 「計時看到畫面」碼表：按一下開始、看到畫面再按一下停止，自動把秒數填進校正欄位。
// 量的是「經過多久」，所以用 performance.now()（單調時鐘，不受系統對時影響）。
let loadStopwatchStart = null;
let loadStopwatchRafId = null;

function stopLoadStopwatchTicker() {
    if (loadStopwatchRafId !== null) {
        cancelAnimationFrame(loadStopwatchRafId);
        loadStopwatchRafId = null;
    }
}

function updateMeasureLoadBtnLabel() {
    if (!measureLoadBtn) return;
    if (loadStopwatchStart === null) {
        measureLoadBtn.textContent = "⏱ 計時";
        measureLoadBtn.classList.remove("is-timing");
        return;
    }
    const elapsed = (performance.now() - loadStopwatchStart) / 1000;
    measureLoadBtn.textContent = `⏹ 停止 ${elapsed.toFixed(2)} 秒`;
    measureLoadBtn.classList.add("is-timing");
    loadStopwatchRafId = requestAnimationFrame(updateMeasureLoadBtnLabel);
}

function toggleLoadStopwatch() {
    if (loadStopwatchStart === null) {
        // 開始計時
        loadStopwatchStart = performance.now();
        updateMeasureLoadBtnLabel();
        return;
    }

    // 停止：算出經過秒數、填入「看到畫面秒數」並套用
    const elapsedSeconds = roundTo2((performance.now() - loadStopwatchStart) / 1000);
    loadStopwatchStart = null;
    stopLoadStopwatchTicker();
    updateMeasureLoadBtnLabel();

    applyOptimalOpenSettings({ gameLoadSeconds: elapsedSeconds });
    showToast("已量到看到畫面時間", `填入 ${elapsedSeconds.toFixed(2)} 秒。多量幾次取平均會更準。`, "info");
}

if (measureLoadBtn) {
    measureLoadBtn.addEventListener("click", toggleLoadStopwatch);
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
    // 搜尋中新增的空白列會被篩掉，所以先把搜尋條件清掉再新增。
    setRowSearchQuery("");
    addRow();
});

testModeBtn = document.getElementById("test-mode-btn");
if (testModeBtn) {
    testModeBtn.addEventListener("click", toggleTestMode);
}

const saveProfileBtn = document.getElementById("save-profile-btn");
if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", saveCurrentAsProfile);
}

initServiceWorker();
registerAudioUnlockEvents();

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallButton();
});

window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    hideInstallButton();
});
applyAlertLeadEnabled(alertLeadEnabled, { silent: true });
applyFrequentReminderEnabled(frequentReminderEnabled, { silent: true });
applyAlertLeadSeconds(alertLeadSeconds, { silent: true });
applyAlertVolume(alertVolume, { silent: true });
applySystemNotificationEnabled(systemNotificationEnabled, { silent: true });
applyOptimalOpenSettings(optimalOpenSettings, { silent: true });
initMushroomKindModal();
initRowSearch();
preventWheelNumberChangeForAllNumberInputs();
profiles = loadProfilesFromStorage();
renderProfiles();
restoreRowsFromStorage();
if (currentSortMode === SORT_MODE_CUSTOM) {
    sortRowsByCustomOrder({ persistMode: false });
} else {
    sortRowsByRespawnTime({ persistMode: false });
}
updateSortButtonsUI();
tick();
setInterval(tick, 200);

// 一載入就先對時，之後每隔一段時間再校準一次，讓本機時鐘的緩慢漂移能被追上。
// 抓不到時間端點（離線、或 Worker 還沒加這個端點）會自動退回本機時鐘，不影響運作。
syncTimeOffset();
setInterval(syncTimeOffset, TIME_SYNC_INTERVAL_MS);
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        syncTimeOffset();
    }
});
