<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
import { fetchAttendanceList, bulkUpdateAttendance } from '@/service/attendanceService.js';
import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser, getCurrentUsername, fetchCurrentUsername } from '@/service/authService.js';

/* Enum trạng thái ĐI HỌC (khớp AttendanceStatus ở BE) */
const STATUS = {
    PRESENT: { key: 'PRESENT', label: 'Đi học' },
    ABSENT: { key: 'ABSENT', label: 'Vắng' },
    LATE: { key: 'LATE', label: 'Đi muộn' },
    EARLY_LEAVE: { key: 'EARLY_LEAVE', label: 'Về sớm' },
    UNDEFINED: { key: 'UNDEFINED', label: 'Chưa xác định' }
};

const statusOptions = [
    { label: 'Tất cả', value: 'ALL' },
    { label: 'Đi học', value: 'PRESENT' },
    { label: 'Vắng', value: 'ABSENT' },
    { label: 'Đi muộn', value: 'LATE' },
    { label: 'Về sớm', value: 'EARLY_LEAVE' },
    { label: 'Chưa xác định', value: 'UNDEFINED' }
];

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

/* Người điểm danh */
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

/* Lớp, ngày, filter */
const classes = ref([]); // [{id, name}]
const selectedClassId = ref(null);
const day = ref(new Date());
const keyword = ref('');
const filterStatus = ref('ALL');

/* Data */
const loading = ref(false);
const saving = ref(false);
const rows = ref([]); // [{studentId, studentName, className, status, checkOutStatus, checkOutTime, checkOutBy, checkOutNote}]
const dirty = reactive(new Set()); // studentId nào đã sửa

/* Helper: đã về hay chưa */
function isCheckedOut(row) {
    return row.checkOutStatus && row.checkOutStatus !== 'UNDEFINED';
}

/* Thống kê */
const counts = computed(() => {
    const total = rows.value.length;
    const presentCount = rows.value.filter((r) => (r.status || 'UNDEFINED') === 'PRESENT').length;
    const checkedOutCount = rows.value.filter((r) => isCheckedOut(r)).length;

    return { total, presentCount, checkedOutCount };
});

/* Toast */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true
});

function formatTime(dtStr) {
    if (!dtStr) return '';
    const d = new Date(dtStr);
    if (Number.isNaN(d)) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function formatDateTime(dtStr) {
    if (!dtStr) return '';
    const d = new Date(dtStr);
    if (Number.isNaN(d)) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
}

/* Load danh sách lớp */
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

/* Load điểm danh list */
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
            checkOutStatus: r.checkOutStatus || 'UNDEFINED'
        }));

        swalToast.fire({ icon: 'success', title: 'Đã tải dữ liệu' });
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được dữ liệu điểm danh'
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

/* Toggle ĐÃ VỀ */
function toggleCheckOut(row) {
    if (isCheckedOut(row)) {
        // bỏ điểm danh về
        row.checkOutStatus = 'UNDEFINED';
        row.checkOutTime = null;
        row.checkOutBy = null;
        // giữ lại ghi chú, BE sẽ nhận checkOutNote
    } else {
        // đánh dấu đã về
        row.checkOutStatus = 'PRESENT';
        row.checkOutTime = new Date().toISOString();
        row.checkOutBy = checkedByUser.value;
    }
    dirty.add(row.studentId);
}

function onNoteChange(row) {
    dirty.add(row.studentId);
}

/* Lưu – gọi /attendance/bulk-update chỉ với checkOut* */
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
                // KHÔNG gửi status để không ảnh hưởng điểm danh đến
                checkOutStatus: r.checkOutStatus,
                checkOutNote: r.checkOutNote
            }))
        });

        dirty.clear();
        swalToast.fire({ icon: 'success', title: 'Đã lưu điểm danh về' });
        await loadData();
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Lưu điểm danh về thất bại'
        });
    } finally {
        saving.value = false;
    }
}

/* Enter để lưu (trừ khi đang gõ input) */
function onKeydown(e) {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    onSave();
}

/* Watch tự load */
watch(selectedClassId, () => loadData());
watch(day, () => loadData());
watch(filterStatus, () => loadData());

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
    <div class="px-4 md:px-6 lg:px-10 py-6 space-y-5 relative">
        <!-- Tabs chuyển giữa ĐẾN / VỀ / ĐƠN XIN NGHỈ -->
        <div class="flex border-b mb-4 gap-6 text-sm font-semibold">
            <!-- chỉnh lại path cho khớp router của bạn nếu khác -->
            <RouterLink to="/school/attendance/check-in" class="tab-link" :class="{ 'tab-link--active': route.path.includes('check-in') }"> Điểm danh đến </RouterLink>

            <RouterLink to="/school/attendance/check-out" class="tab-link" :class="{ 'tab-link--active': route.path.includes('check-out') }"> Điểm danh về </RouterLink>

            <RouterLink to="/school/attendance/leave-request" class="tab-link" :class="{ 'tab-link--active': route.path.includes('leave-request') }"> Đơn xin nghỉ </RouterLink>
        </div>

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
                    <div class="text-2xl font-extrabold tracking-tight text-slate-800">Điểm danh về</div>
                    <div class="text-slate-500 text-sm">
                        Ngày:
                        {{ day ? new Date(day).toLocaleDateString('vi-VN') : '' }}
                    </div>
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
                        <label class="label">Trạng thái đi học</label>
                        <Dropdown v-model="filterStatus" class="w-full" :options="statusOptions" optionLabel="label" optionValue="value" />
                    </div>
                    <div>
                        <label class="label">Tìm kiếm</label>
                        <InputText v-model="keyword" class="w-full" placeholder="Tên học sinh" />
                    </div>
                </div>
            </template>
        </Card>

        <!-- Summary line -->
        <div class="flex flex-wrap items-center gap-3 text-sm text-slate-700">
            <span
                ><strong>{{ counts.total }}</strong> học sinh</span
            >
            <span
                >Đi học: <strong>{{ counts.presentCount }}</strong></span
            >
            <span
                >Đã về: <strong>{{ counts.checkedOutCount }}</strong></span
            >
        </div>

        <!-- Table -->
        <div class="overflow-auto rounded-2xl ring-1 ring-slate-200 bg-white shadow-sm">
            <table class="min-w-full">
                <thead class="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                    <tr>
                        <th class="th w-12">#</th>
                        <th class="th min-w-[220px]">Học sinh</th>
                        <th class="th min-w-[160px]">Lớp</th>
                        <th class="th min-w-[120px] text-center">Đi học ({{ counts.presentCount }})</th>
                        <th class="th min-w-[120px] text-center">Đã về ({{ counts.checkedOutCount }})</th>
                        <th class="th min-w-[120px] text-center">Giờ về</th>
                        <th class="th min-w-[260px]">Thời gian</th>
                        <th class="th min-w-[220px]">Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(r, idx) in filteredRows" :key="r.studentId" class="hover:bg-slate-50 transition">
                        <td class="td text-slate-500">
                            {{ idx + 1 }}
                        </td>

                        <td class="td font-medium text-slate-800">
                            {{ r.studentName }}
                        </td>

                        <td class="td text-slate-700">
                            {{ r.className }}
                        </td>

                        <!-- Đi học -->
                        <td class="td text-center">
                            <span v-if="r.status === 'PRESENT'" class="badge badge-present"> Đi học </span>
                            <span v-else-if="r.status === 'ABSENT'" class="badge badge-absent"> Vắng </span>
                            <span v-else-if="r.status === 'LATE'" class="badge badge-late"> Đi muộn </span>
                            <span v-else-if="r.status === 'EARLY_LEAVE'" class="badge badge-early"> Về sớm </span>
                            <span v-else class="badge badge-undefined"> Chưa xác định </span>
                        </td>

                        <!-- Đã về -->
                        <td class="td text-center">
                            <button v-tooltip.top="isCheckedOut(r) ? 'Bỏ điểm danh về' : 'Đánh dấu đã về'" class="btn-check" :class="{ 'btn-check-on': isCheckedOut(r) }" @click="toggleCheckOut(r)">
                                <i class="fa-solid" :class="isCheckedOut(r) ? 'fa-check' : 'fa-minus'"></i>
                            </button>
                        </td>

                        <!-- Giờ về -->
                        <td class="td">
                            <div class="time-wrap" :class="{ 'opacity-40': !isCheckedOut(r) }">
                                <i class="fa-regular fa-clock mr-2 text-slate-400"></i>
                                <input class="time-display" type="text" :value="isCheckedOut(r) ? formatTime(r.checkOutTime) : ''" disabled />
                            </div>
                        </td>

                        <!-- Thời gian -->
                        <td class="td">
                            <div v-if="isCheckedOut(r)" class="flex flex-col gap-1 text-slate-700">
                                <span class="tag-checked">Đã điểm danh</span>
                                <div class="text-sm">
                                    <i class="fa-solid fa-calendar-day mr-1"></i>
                                    {{ formatDateTime(r.checkOutTime) }}
                                </div>
                                <div v-if="r.checkOutBy" class="text-sm">Bởi {{ r.checkOutBy }}</div>
                            </div>
                            <div v-else class="text-slate-400 text-sm italic">Chưa điểm danh</div>
                        </td>

                        <!-- Ghi chú -->
                        <td class="td">
                            <InputText v-model="r.checkOutNote" class="w-full" placeholder="Ghi chú..." @input="onNoteChange(r)" />
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
/* Tabs */
.tab-link {
    padding: 10px 0;
    border-bottom: 2px solid transparent;
    color: #374151;
    text-decoration: none;
}
.tab-link--active {
    color: #2563eb;
    border-color: #2563eb;
}

/* Common */
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
    white-space: nowrap;
}
.td {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
}

/* Badge Đi học */
.badge {
    display: inline-block;
    min-width: 72px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
}
.badge-present {
    background: #ecfdf5;
    color: #166534;
}
.badge-absent {
    background: #fef2f2;
    color: #b91c1c;
}
.badge-late {
    background: #fffbeb;
    color: #92400e;
}
.badge-early {
    background: #e0f2fe;
    color: #075985;
}
.badge-undefined {
    background: #f8fafc;
    color: #64748b;
}

/* Button tick ĐÃ VỀ */
.btn-check {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 2px solid #cbd5f5;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    background: #f9fafb;
    transition: all 0.15s ease;
}
.btn-check-on {
    border-color: #2563eb;
    background: #2563eb;
    color: #fff;
}

/* Giờ về */
.time-wrap {
    display: flex;
    align-items: center;
    border: 1px solid #e5e7eb;
    border-radius: 999px;
    padding: 4px 10px;
    max-width: 120px;
}
.time-display {
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;
    color: #111827;
}

/* Thời gian */
.tag-checked {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: #e0edff;
    color: #1d4ed8;
}
</style>
