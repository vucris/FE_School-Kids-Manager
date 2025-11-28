<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Tooltip from 'primevue/tooltip';

import Swal from 'sweetalert2';

import AttendanceTabs from '@/components/attendance/AttendanceTabs.vue';
import { fetchClassesLite } from '@/service/classService.js';
import { fetchAttendanceList, bulkUpdateAttendance } from '@/service/attendanceService.js';
import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser, getCurrentUsername, fetchCurrentUsername } from '@/service/authService.js';

/* Enum và cột hiển thị (KHỚP BE AttendanceStatus) */
const STATUS = {
    PRESENT: { key: 'PRESENT', label: 'Đi học', color: 'green' },
    ABSENT: { key: 'ABSENT', label: 'Vắng', color: 'rose' },
    LATE: { key: 'LATE', label: 'Đi muộn', color: 'amber' },
    EARLY_LEAVE: { key: 'EARLY_LEAVE', label: 'Về sớm', color: 'sky' },
    UNDEFINED: { key: 'UNDEFINED', label: 'Chưa xác định', color: 'slate' }
};

const statusCols = [STATUS.PRESENT, STATUS.ABSENT, STATUS.LATE, STATUS.EARLY_LEAVE, STATUS.UNDEFINED];

const auth = useAuthStore();

/* Lấy username đăng nhập giống với màn Thực đơn */
const checkedByUser = ref('system');
async function ensureUsername() {
    const fromStore = getUsernameFromUser(auth?.user);
    if (fromStore) {
        checkedByUser.value = fromStore;
        return;
    }
    const fromLocal = getCurrentUsername();
    if (fromLocal) {
        checkedByUser.value = fromLocal;
        return;
    }
    const fromApi = await fetchCurrentUsername();
    checkedByUser.value = fromApi || 'system';
}
watch(
    () => auth.user,
    () => {
        ensureUsername();
    },
    { immediate: true }
);

/* Lớp */
const classes = ref([]); // [{ id, name }]
const selectedClassId = ref(null);

const day = ref(new Date());
const keyword = ref('');
const filterStatus = ref('ALL');

/** loading: overlay */
const loading = ref(false);
const saving = ref(false);
const rows = ref([]); // [{ studentId, studentName, className, status, hasPermission, checkedBy, checkTime, note }]
const dirty = reactive(new Set()); // track các dòng thay đổi để lưu

const counts = computed(() => {
    const c = {
        total: rows.value.length,
        permissionCount: rows.value.filter((r) => !!r.hasPermission).length
    };
    for (const col of statusCols) {
        c[col.key] = rows.value.filter((r) => (r.status || 'UNDEFINED') === col.key).length;
    }
    return c;
});

/** Toast */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true
});

async function loadClasses() {
    const lite = await fetchClassesLite(); // [{ value, label }]
    classes.value = lite.map((c) => ({
        id: c.value,
        name: c.label
    }));
    if (!selectedClassId.value && classes.value.length) {
        selectedClassId.value = classes.value[0].id;
    }
}

/** Tải danh sách điểm danh */
async function loadData() {
    if (!selectedClassId.value || !day.value) return;

    loading.value = true;
    dirty.clear();
    try {
        const list = await fetchAttendanceList({
            classId: selectedClassId.value,
            date: day.value,
            status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
            keyword: keyword.value || undefined
        });
        rows.value = list.map((r) => ({
            ...r,
            status: r.status || 'UNDEFINED',
            hasPermission: r.hasPermission ?? false
        }));
        swalToast.fire({ icon: 'success', title: 'Đã tải dữ liệu' });
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được điểm danh'
        });
    } finally {
        loading.value = false;
    }
}

const filteredRows = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    const st = filterStatus.value;
    return rows.value.filter((r) => {
        const okQ = !q || (r.studentName || '').toLowerCase().includes(q);
        const okS = st === 'ALL' || (r.status || 'UNDEFINED') === st;
        return okQ && okS;
    });
});

function setStatus(row, newStatus) {
    if (row.status === newStatus) return;
    row.status = newStatus;
    row.checkTime = new Date().toISOString();
    row.checkedBy = checkedByUser.value;
    dirty.add(row.studentId);
}

/** bulk set = gán tất cả HS (đang lọc) sang 1 trạng thái */
function bulkSet(newStatus) {
    for (const r of filteredRows.value) {
        if ((r.status || 'UNDEFINED') !== newStatus) {
            setStatus(r, newStatus);
        }
    }
}

/* ===== Có phép: toggle + bulk ===== */
function togglePermission(row) {
    row.hasPermission = !row.hasPermission;
    dirty.add(row.studentId);
}
function setAllPermission(on) {
    filteredRows.value.forEach((r) => {
        r.hasPermission = !!on;
        dirty.add(r.studentId);
    });
}

/* ===== Dropdown ở header cho từng cột ===== */
const showStatusMenu = reactive({
    PRESENT: false,
    ABSENT: false,
    LATE: false,
    EARLY_LEAVE: false,
    UNDEFINED: false
});
const showPermMenu = ref(false);

function closeAllMenus() {
    Object.keys(showStatusMenu).forEach((k) => {
        showStatusMenu[k] = false;
    });
    showPermMenu.value = false;
}

function toggleStatusMenu(key) {
    const willOpen = !showStatusMenu[key];
    closeAllMenus();
    if (willOpen) showStatusMenu[key] = true;
}

function onClickStatusMenu(key, action) {
    if (action === 'all') {
        // gán tất cả HS (đang lọc) sang trạng thái này
        filteredRows.value.forEach((r) => {
            if ((r.status || 'UNDEFINED') !== key) {
                setStatus(r, key);
            }
        });
    } else if (action === 'clear') {
        // chỉ những HS đang ở trạng thái này => về UNDEFINED
        filteredRows.value.forEach((r) => {
            if ((r.status || 'UNDEFINED') === key) {
                r.status = 'UNDEFINED';
                r.checkTime = null;
                r.checkedBy = null;
                dirty.add(r.studentId);
            }
        });
    }
    showStatusMenu[key] = false;
}

function togglePermMenu() {
    const willOpen = !showPermMenu.value;
    closeAllMenus();
    showPermMenu.value = willOpen;
}
function onClickSelectAllPermission(on) {
    setAllPermission(on);
    showPermMenu.value = false;
}

/* click ngoài để đóng menu */
function onWindowClick() {
    closeAllMenus();
}

async function onSave() {
    if (!selectedClassId.value) {
        swalToast.fire({ icon: 'info', title: 'Chưa chọn lớp' });
        return;
    }
    if (!dirty.size) {
        swalToast.fire({ icon: 'info', title: 'Không có thay đổi để lưu' });
        return;
    }
    saving.value = true;
    try {
        const dirtyRows = rows.value.filter((r) => dirty.has(r.studentId));
        await bulkUpdateAttendance({
            classId: selectedClassId.value,
            date: day.value,
            checkedBy: checkedByUser.value,
            items: dirtyRows.map((r) => ({
                studentId: r.studentId,
                status: r.status,
                note: r.note ?? '',
                hasPermission: r.hasPermission
            }))
        });

        dirty.clear();
        swalToast.fire({ icon: 'success', title: 'Đã lưu điểm danh' });
        await loadData();
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Lưu điểm danh thất bại'
        });
    } finally {
        saving.value = false;
    }
}

/* Enter để lưu (trừ khi đang gõ trong input) */
function onKeydown(e) {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    onSave();
}

/* Auto load khi đổi lớp / ngày / filter */
watch(selectedClassId, () => {
    loadData();
});
watch(day, () => {
    loadData();
});
watch(filterStatus, () => {
    loadData();
});

onMounted(async () => {
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('click', onWindowClick);
    await ensureUsername();
    await loadClasses();
    await loadData();
});
onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('click', onWindowClick);
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-10 py-6 space-y-5 relative">
        <!-- Tabs: Đến / Về / Đơn xin nghỉ -->
        <AttendanceTabs />

        <!-- Loading overlay -->
        <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm">
            <i class="fa-solid fa-spinner fa-spin mr-2"></i>
            Đang tải dữ liệu điểm danh...
        </div>

        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-user-check text-2xl text-primary"></i>
                <div>
                    <div class="text-2xl font-extrabold tracking-tight text-slate-800">Điểm danh đến</div>
                    <div class="text-slate-500 text-sm">Ngày: {{ day ? new Date(day).toLocaleDateString('vi-VN') : '' }}</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <Tag severity="info" :value="`Người điểm danh: ${checkedByUser}`" />
                <Button class="btn-ghost" icon="fa-solid fa-rotate mr-2" label="Tải lại" :disabled="loading" @click.stop="loadData" />
                <Button class="btn-success" icon="fa-solid fa-floppy-disk mr-2" :label="saving ? 'Đang lưu...' : 'Lưu (Enter)'" :disabled="saving" @click.stop="onSave" />
            </div>
        </div>

        <!-- Filters -->
        <Card class="card-soft ring-1 ring-slate-100">
            <template #content>
                <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div class="md:col-span-2">
                        <label class="label">Chọn lớp</label>
                        <Dropdown v-model="selectedClassId" :options="classes" optionLabel="name" optionValue="id" class="w-full" placeholder="Chọn lớp" />
                    </div>
                    <div>
                        <label class="label">Ngày</label>
                        <Calendar v-model="day" :manualInput="false" class="w-full" showIcon dateFormat="dd/mm/yy" />
                    </div>
                    <div>
                        <label class="label">Trạng thái</label>
                        <Dropdown
                            v-model="filterStatus"
                            class="w-full"
                            :options="[
                                { label: 'Tất cả', value: 'ALL' },
                                ...Object.values(STATUS).map((s) => ({
                                    label: s.label,
                                    value: s.key
                                }))
                            ]"
                            optionLabel="label"
                            optionValue="value"
                        />
                    </div>
                    <div>
                        <label class="label">Tìm kiếm</label>
                        <InputText v-model="keyword" class="w-full" placeholder="Tên học sinh" />
                    </div>
                </div>
            </template>
        </Card>

        <!-- Status header with counts + bulk -->
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-slate-700 font-semibold mr-1"> Tổng {{ counts.total }} học sinh </span>
            <template v-for="s in Object.values(STATUS)" :key="s.key">
                <button v-tooltip.top="`Đặt tất cả là ${s.label}`" class="chip" :class="`chip-${s.color}`" @click="bulkSet(s.key)">
                    <i class="fa-solid fa-circle mr-1 text-[10px]"></i>
                    {{ s.label }} ({{ counts[s.key] || 0 }})
                </button>
            </template>
            <span class="text-xs text-slate-500 ml-1">
                • Có phép: <b>{{ counts.permissionCount }}</b>
            </span>
        </div>

        <!-- Table -->
        <div class="overflow-auto rounded-2xl ring-1 ring-slate-200 bg-white shadow-sm">
            <table class="min-w-full">
                <thead class="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                    <tr>
                        <th class="th w-12">#</th>
                        <th class="th min-w-[220px]">Học sinh</th>
                        <th class="th min-w-[160px]">Lớp</th>

                        <!-- 5 cột trạng thái -->
                        <th v-for="col in statusCols" :key="col.key" class="th text-center">
                            <div class="th-label-menu" @click.stop>
                                <span>
                                    {{ col.label }}
                                    ({{ counts[col.key] || 0 }})
                                </span>
                                <button type="button" class="th-arrow-btn" @click.stop="toggleStatusMenu(col.key)">
                                    <i class="fa-solid" :class="showStatusMenu[col.key] ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                                </button>

                                <div v-if="showStatusMenu[col.key]" class="th-menu" @click.stop>
                                    <button type="button" class="th-menu-item" @click="onClickStatusMenu(col.key, 'all')">Chọn tất cả</button>
                                    <button type="button" class="th-menu-item" @click="onClickStatusMenu(col.key, 'clear')">Bỏ chọn tất cả</button>
                                </div>
                            </div>
                        </th>

                        <!-- Cột CÓ PHÉP giống các cột còn lại -->
                        <th class="th min-w-[120px] text-center">
                            <div class="th-label-menu" @click.stop>
                                <span>Có phép ({{ counts.permissionCount }})</span>
                                <button type="button" class="th-arrow-btn" @click.stop="togglePermMenu">
                                    <i class="fa-solid" :class="showPermMenu ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                                </button>

                                <div v-if="showPermMenu" class="th-menu" @click.stop>
                                    <button type="button" class="th-menu-item" @click="onClickSelectAllPermission(true)">Chọn tất cả</button>
                                    <button type="button" class="th-menu-item" @click="onClickSelectAllPermission(false)">Bỏ chọn tất cả</button>
                                </div>
                            </div>
                        </th>

                        <th class="th min-w-[200px]">Thời gian</th>
                        <th class="th min-w-[240px]">Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(r, idx) in filteredRows" :key="r.studentId" class="hover:bg-slate-50 transition">
                        <td class="td text-slate-500">{{ idx + 1 }}</td>
                        <td class="td font-medium text-slate-800">
                            {{ r.studentName }}
                        </td>
                        <td class="td text-slate-700">{{ r.className }}</td>

                        <!-- 5 trạng thái -->
                        <td v-for="col in statusCols" :key="col.key" class="td text-center">
                            <button class="dot" :class="[`dot-${col.color}`, (r.status || 'UNDEFINED') === col.key ? 'dot-active' : '']" @click="setStatus(r, col.key)" :title="col.label" />
                        </td>

                        <!-- Cột Có phép = dot giống các cột trên -->
                        <td class="td text-center">
                            <button v-tooltip.top="r.hasPermission ? 'Bỏ đánh dấu có phép' : 'Đánh dấu có phép'" class="dot dot-perm" :class="{ 'dot-active': r.hasPermission }" @click.stop="togglePermission(r)" />
                        </td>

                        <!-- Thời gian -->
                        <td class="td">
                            <div v-if="(r.status || 'UNDEFINED') !== 'UNDEFINED'" class="flex flex-wrap items-center gap-2 text-slate-700">
                                <Tag severity="success" value="Đã điểm danh" />
                                <span class="text-sm">
                                    <i class="fa-regular fa-clock mr-1"></i>
                                    {{ r.checkTime ? new Date(r.checkTime).toLocaleString('vi-VN') : '' }}
                                </span>
                                <span v-if="r.checkedBy" class="text-xs text-slate-500"> • Bởi {{ r.checkedBy }} </span>
                            </div>
                            <div v-else class="text-slate-400 text-sm italic">Chưa có</div>
                        </td>

                        <!-- Ghi chú -->
                        <td class="td">
                            <InputText v-model="r.note" class="w-full" placeholder="Ghi chú..." @input="dirty.add(r.studentId)" />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script>
export default {
    directives: { tooltip: Tooltip }
};
</script>

<style scoped>
.label {
    display: inline-block;
    margin-bottom: 6px;
    font-weight: 700;
    color: #334155;
}
.card-soft {
    border-radius: 16px;
    background: linear-gradient(180deg, #ffffff, #fafafa);
}
.btn-success {
    background: linear-gradient(135deg, #059669, #10b981);
    color: #fff;
    border: 0;
}
.btn-ghost {
    background: #f1f5f9;
    color: #334155;
    border: 0;
}
.th {
    padding: 12px;
    text-align: left;
    color: #334155;
    font-weight: 700;
    border-bottom: 1px solid #e5e7eb;
}
.td {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
}

/* Header label + arrow + menu */
.th-label-menu {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
}
.th-arrow-btn {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: #6b7280;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}
.th-arrow-btn:hover {
    background: #e5e7eb;
}
.th-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: #ffffff;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    box-shadow:
        0 10px 15px -3px rgba(15, 23, 42, 0.2),
        0 4px 6px -4px rgba(15, 23, 42, 0.12);
    padding: 4px 0;
    min-width: 140px;
    z-index: 30;
}
.th-menu-item {
    width: 100%;
    padding: 6px 12px;
    font-size: 13px;
    text-align: left;
    border: none;
    background: transparent;
    cursor: pointer;
    color: #374151;
}
.th-menu-item:hover {
    background: #f3f4f6;
}

/* Status chip (bulk) */
.chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
}
.chip-green {
    background: #ecfdf5;
    color: #065f46;
    border-color: #a7f3d0;
}
.chip-amber {
    background: #fffbeb;
    color: #92400e;
    border-color: #fde68a;
}
.chip-rose {
    background: #fff1f2;
    color: #9f1239;
    border-color: #fecdd3;
}
.chip-sky {
    background: #ecfeff;
    color: #0c4a6e;
    border-color: #bae6fd;
}
.chip-slate {
    background: #f8fafc;
    color: #334155;
    border-color: #e2e8f0;
}

/* Selectable colored dots */
.dot {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    border: 2px solid currentColor;
    background: transparent;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
}
.dot::after {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: transparent;
}
.dot-active::after {
    background: currentColor;
}

.dot-green {
    color: #10b981;
}
.dot-amber {
    color: #f59e0b;
}
.dot-rose {
    color: #ef4444;
}
.dot-sky {
    color: #0ea5e9;
}
.dot-slate {
    color: #94a3b8;
}

/* Dot cho cột CÓ PHÉP */
.dot-perm {
    color: #8b5cf6; /* tím để phân biệt với các trạng thái khác */
}
</style>
