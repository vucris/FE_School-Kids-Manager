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

import { fetchClassesLite } from '@/service/classService.js';
import { fetchAttendanceList, updateAttendanceStatus } from '@/service/attendanceService.js';
import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser, getCurrentUsername, fetchCurrentUsername } from '@/service/authService.js';

/* Enum và cột hiển thị (khớp BE AttendanceStatus) */
const STATUS = {
    PRESENT: { key: 'PRESENT', label: 'Đi học', color: 'green' },
    EXCUSED: { key: 'EXCUSED', label: 'Có phép', color: 'amber' },
    UNEXCUSED: { key: 'UNEXCUSED', label: 'Không phép', color: 'rose' },
    EARLY_LEAVE: { key: 'EARLY_LEAVE', label: 'Đột xuất', color: 'sky' },
    UNKNOWN: { key: 'UNKNOWN', label: 'Chưa xác định', color: 'slate' },
    HOLIDAY: { key: 'HOLIDAY', label: 'Nghỉ lễ', color: 'violet' },
    DEFERRED: { key: 'DEFERRED', label: 'Bảo lưu', color: 'orange' }
};
const statusCols = [STATUS.PRESENT, STATUS.EXCUSED, STATUS.UNEXCUSED, STATUS.EARLY_LEAVE, STATUS.UNKNOWN, STATUS.HOLIDAY, STATUS.DEFERRED];

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
const classes = ref([]);
/** selectedClassId: chỉ giữ id lớp */
const selectedClassId = ref(null);

const day = ref(new Date());
const keyword = ref('');
const filterStatus = ref('ALL');

const loading = ref(false);
const saving = ref(false);
const rows = ref([]); // [{studentId, studentName, className, status, checkedBy, checkTime, note}]
const dirty = reactive(new Set()); // track các dòng thay đổi để lưu

const counts = computed(() => {
    const c = { total: rows.value.length };
    for (const col of statusCols) c[col.key] = rows.value.filter((r) => (r.status || 'UNKNOWN') === col.key).length;
    return c;
});

/** Toast – bỏ heightAuto khi toast */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true
});

function toYMD(d) {
    const dt = d instanceof Date ? d : new Date(d);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

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

async function loadData() {
    if (!selectedClassId.value || !day.value) {
        swalToast.fire({ icon: 'info', title: 'Chọn lớp và ngày' });
        return;
    }
    loading.value = true;
    dirty.clear();
    try {
        const list = await fetchAttendanceList({
            classId: selectedClassId.value,
            date: toYMD(day.value),
            status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
            keyword: keyword.value || undefined
        });
        rows.value = list.map((r) => ({
            ...r,
            status: r.status || 'UNKNOWN'
        }));
        swalToast.fire({ icon: 'success', title: 'Đã tải dữ liệu' });
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Không tải được điểm danh' });
    } finally {
        loading.value = false;
    }
}

const filteredRows = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    const st = filterStatus.value;
    return rows.value.filter((r) => {
        const okQ = !q || (r.studentName || '').toLowerCase().includes(q);
        const okS = st === 'ALL' || (r.status || 'UNKNOWN') === st;
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

function bulkSet(newStatus) {
    for (const r of filteredRows.value) {
        if ((r.status || 'UNKNOWN') !== newStatus) {
            setStatus(r, newStatus);
        }
    }
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
        const dateStr = toYMD(day.value);
        for (const studentId of Array.from(dirty)) {
            const row = rows.value.find((x) => x.studentId === studentId);
            if (!row) continue;
            await updateAttendanceStatus({
                studentId: row.studentId,
                classId: selectedClassId.value,
                date: dateStr,
                status: row.status,
                note: row.note ?? '',
                checkedBy: checkedByUser.value
            });
        }
        dirty.clear();
        swalToast.fire({ icon: 'success', title: 'Đã lưu điểm danh' });
        await loadData();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Lưu điểm danh thất bại' });
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

onMounted(async () => {
    window.addEventListener('keydown', onKeydown);
    await ensureUsername();
    await loadClasses();
    await loadData();
});
onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-10 py-6 space-y-5">
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
                <Button class="btn-ghost" icon="fa-solid fa-rotate mr-2" label="Tải lại" :disabled="loading" @click="loadData" />
                <Button class="btn-success" icon="fa-solid fa-floppy-disk mr-2" :label="saving ? 'Đang lưu...' : 'Lưu (Enter)'" :disabled="saving" @click="onSave" />
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
                        <Dropdown v-model="filterStatus" class="w-full" :options="[{ label: 'Tất cả', value: 'ALL' }, ...Object.values(STATUS).map((s) => ({ label: s.label, value: s.key }))]" optionLabel="label" optionValue="value" />
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
            <span class="text-slate-700 font-semibold mr-1">Tổng {{ counts.total }} học sinh</span>
            <template v-for="s in Object.values(STATUS)" :key="s.key">
                <button v-tooltip.top="`Đặt tất cả là ${s.label}`" class="chip" :class="`chip-${s.color}`" @click="bulkSet(s.key)">
                    <i class="fa-solid fa-circle mr-1 text-[10px]"></i>
                    {{ s.label }} ({{ counts[s.key] || 0 }})
                </button>
            </template>
        </div>

        <!-- Table -->
        <div class="overflow-auto rounded-2xl ring-1 ring-slate-200 bg-white shadow-sm">
            <table class="min-w-full">
                <thead class="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                    <tr>
                        <th class="th w-12">#</th>
                        <th class="th min-w-[220px]">Học sinh</th>
                        <th class="th min-w-[160px]">Lớp</th>
                        <th v-for="col in statusCols" :key="col.key" class="th text-center">
                            {{ col.label }}
                        </th>
                        <th class="th min-w-[200px]">Thời gian</th>
                        <th class="th min-w-[240px]">Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(r, idx) in filteredRows" :key="r.studentId" class="hover:bg-slate-50 transition">
                        <td class="td text-slate-500">{{ idx + 1 }}</td>
                        <td class="td font-medium text-slate-800">{{ r.studentName }}</td>
                        <td class="td text-slate-700">{{ r.className }}</td>

                        <td v-for="col in statusCols" :key="col.key" class="td text-center">
                            <button class="dot" :class="[`dot-${col.color}`, (r.status || 'UNKNOWN') === col.key ? 'dot-active' : '']" @click="setStatus(r, col.key)" :title="col.label" />
                        </td>

                        <td class="td">
                            <div v-if="(r.status || 'UNKNOWN') !== 'UNKNOWN'" class="flex items-center gap-2 text-slate-700">
                                <Tag severity="success" value="Đã điểm danh" />
                                <span class="text-sm">
                                    <i class="fa-regular fa-clock mr-1"></i>
                                    {{ r.checkTime ? new Date(r.checkTime).toLocaleString('vi-VN') : '' }}
                                </span>
                                <span v-if="r.checkedBy" class="text-xs text-slate-500">• Bởi {{ r.checkedBy }}</span>
                            </div>
                            <div v-else class="text-slate-400 text-sm italic">Chưa có</div>
                        </td>

                        <td class="td">
                            <InputText v-model="r.note" class="w-full" placeholder="Ghi chú..." @input="dirty.add(r.studentId)" />
                        </td>
                    </tr>
                </tbody>
            </table>

            <div v-if="loading" class="px-4 py-3 text-slate-500 text-sm">Đang tải...</div>
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
.chip-violet {
    background: #f5f3ff;
    color: #5b21b6;
    border-color: #ddd6fe;
}
.chip-orange {
    background: #fff7ed;
    color: #9a3412;
    border-color: #fed7aa;
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
.dot-violet {
    color: #8b5cf6;
}
.dot-orange {
    color: #fb923c;
}
</style>
