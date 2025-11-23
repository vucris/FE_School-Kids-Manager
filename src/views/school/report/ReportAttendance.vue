<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Card from 'primevue/card';

import Swal from 'sweetalert2';

import { fetchAttendanceList, fetchAttendanceSummary } from '@/service/attendanceService.js';
import { fetchClassOptions } from '@/service/classService.js';

/* ======= STATE ======= */

const classes = ref([]);           // [{ id, name }]
const selectedClass = ref(null);
const selectedDate = ref(new Date());
const statusFilter = ref(null);    // PRESENT / ABSENT / LATE / EARLY_LEAVE / UNDEFINED
const keyword = ref('');           // tên học sinh

const list = ref([]);              // AttendanceListItemResponse[]
const summary = ref(null);

const loadingInit = ref(false);
const loadingList = ref(false);
const loadingSummary = ref(false);
const errorMessage = ref('');

/* Trạng thái hiển thị UI */
const statusView = {
    PRESENT:      { text: 'Đi học',       class: 'bg-emerald-500 text-white' },
    ABSENT:       { text: 'Nghỉ',         class: 'bg-rose-500 text-white' },
    LATE:         { text: 'Đi học trễ',   class: 'bg-amber-500 text-white' },
    EARLY_LEAVE:  { text: 'Về sớm',       class: 'bg-sky-500 text-white' },
    UNDEFINED:    { text: 'Chưa điểm danh', class: 'bg-slate-300 text-slate-800' }
};

/* checkout status dùng lại map trên cho đơn giản */
const checkOutStatusView = {
    PRESENT:      { text: 'Đã về',        class: 'bg-emerald-500 text-white' },
    ABSENT:       { text: 'Không đến',    class: 'bg-rose-500 text-white' },
    EARLY_LEAVE:  { text: 'Về sớm',       class: 'bg-sky-500 text-white' },
    UNDEFINED:    { text: 'Chưa điểm danh về', class: 'bg-slate-300 text-slate-800' }
};

/* Toast */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true
});

/* ======= COMPUTED ======= */

const filteredList = computed(() => {
    const kw = keyword.value.trim().toLowerCase();
    let arr = [...list.value];

    if (statusFilter.value) {
        arr = arr.filter((i) => i.status === statusFilter.value);
    }

    if (kw) {
        arr = arr.filter((i) => (i.studentName || '').toLowerCase().includes(kw));
    }

    return arr;
});

/* ======= HELPERS ======= */

function formatDate(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN');
}

function formatTime(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

/* ======= LOAD DATA ======= */

async function loadClasses() {
    try {
        const opts = await fetchClassOptions(); // [{ value, label }]
        classes.value = (opts || []).map((o) => ({ id: o.value, name: o.label }));
        if (!selectedClass.value && classes.value.length) {
            selectedClass.value = classes.value[0];
        }
    } catch (e) {
        console.error(e);
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Không tải được danh sách lớp'
        });
    }
}

async function loadAttendance() {
    if (!selectedClass.value || !selectedDate.value) return;

    loadingList.value = true;
    errorMessage.value = '';

    try {
        const data = await fetchAttendanceList({
            classId: selectedClass.value.id,
            date: selectedDate.value,
            status: null,          // statusFilter xử lý ở FE
            keyword: null
        });
        list.value = data || [];
    } catch (e) {
        console.error(e);
        errorMessage.value = e.message || 'Không thể tải danh sách điểm danh';
        swalToast.fire({
            icon: 'error',
            title: errorMessage.value
        });
    } finally {
        loadingList.value = false;
    }
}

async function loadSummary() {
    if (!selectedClass.value || !selectedDate.value) return;

    loadingSummary.value = true;
    try {
        const data = await fetchAttendanceSummary({
            classId: selectedClass.value.id,
            date: selectedDate.value
        });
        summary.value = data || null;
    } catch (e) {
        console.error(e);
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Không thể tải thống kê điểm danh'
        });
    } finally {
        loadingSummary.value = false;
    }
}

async function reloadAll(showToast = false) {
    if (!selectedClass.value || !selectedDate.value) return;

    loadingInit.value = true;
    await Promise.all([loadAttendance(), loadSummary()]);
    loadingInit.value = false;

    if (showToast) {
        swalToast.fire({
            icon: 'success',
            title: 'Đã tải lại báo cáo điểm danh'
        });
    }
}

/* Auto reload khi đổi lớp / ngày */
watch([selectedClass, selectedDate], () => {
    reloadAll(false);
});

onMounted(async () => {
    await loadClasses();
    await reloadAll(false);
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-10 py-6 space-y-5 relative">
        <!-- Overlay khi init -->
        <div
            v-if="loadingInit"
            class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm"
        >
            <i class="fa-solid fa-spinner fa-spin mr-2" />
            Đang tải báo cáo điểm danh...
        </div>

        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-user-check text-2xl text-primary"></i>
                <div>
                    <div class="text-2xl font-extrabold tracking-tight text-slate-800">
                        Báo cáo điểm danh
                    </div>
                    <div class="text-slate-500 text-sm">
                        Xem đầy đủ thông tin điểm danh đến / về theo từng lớp và ngày
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-2">
                <Button
                    class="btn-ghost"
                    icon="fa-solid fa-rotate-right mr-2"
                    label="Tải lại"
                    @click="reloadAll(true)"
                />
            </div>
        </div>

        <!-- Thông báo lỗi -->
        <div
            v-if="errorMessage"
            class="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200"
        >
            {{ errorMessage }}
        </div>

        <!-- Bộ lọc -->
        <Card class="card-soft ring-1 ring-slate-100">
            <template #content>
                <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div class="md:col-span-2">
                        <label class="label">Lớp học</label>
                        <Dropdown
                            v-model="selectedClass"
                            :options="classes"
                            optionLabel="name"
                            placeholder="Chọn lớp"
                            class="w-full"
                        />
                    </div>
                    <div>
                        <label class="label">Ngày điểm danh</label>
                        <Calendar
                            v-model="selectedDate"
                            :manualInput="false"
                            dateFormat="dd/mm/yy"
                            showIcon
                            class="w-full"
                        />
                    </div>
                    <div>
                        <label class="label">Trạng thái đến</label>
                        <Dropdown
                            v-model="statusFilter"
                            :options="[
                                { label: 'Tất cả', value: null },
                                { label: 'Đi học', value: 'PRESENT' },
                                { label: 'Nghỉ', value: 'ABSENT' },
                                { label: 'Đi học trễ', value: 'LATE' },
                                { label: 'Về sớm', value: 'EARLY_LEAVE' },
                                { label: 'Chưa điểm danh', value: 'UNDEFINED' }
                            ]"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Tất cả"
                            class="w-full"
                        />
                    </div>
                    <div>
                        <label class="label">Tìm học sinh</label>
                        <InputText v-model="keyword" placeholder="Tên học sinh..." class="w-full" />
                    </div>
                </div>
            </template>
        </Card>

        <!-- Thống kê tổng quan -->
        <Card v-if="summary" class="card-soft ring-1 ring-slate-100">
            <template #content>
                <div class="flex flex-wrap gap-4 text-sm text-slate-700">
                    <div class="flex-1 min-w-[160px]">
                        <div class="font-semibold text-slate-900">
                            Lớp {{ summary.className }} • Ngày {{ formatDate(summary.date) }}
                        </div>
                        <div class="text-xs text-slate-500 mt-1">
                            Tổng số học sinh: <b>{{ summary.totalStudents }}</b>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-4">
                        <div class="stat-pill bg-emerald-50 text-emerald-700">
                            Đi học: <b>{{ summary.presentCount }}</b>
                        </div>
                        <div class="stat-pill bg-rose-50 text-rose-700">
                            Nghỉ: <b>{{ summary.absentCount }}</b>
                        </div>
                        <div class="stat-pill bg-amber-50 text-amber-700">
                            Đi trễ: <b>{{ summary.lateCount }}</b>
                        </div>
                        <div class="stat-pill bg-sky-50 text-sky-700">
                            Về sớm: <b>{{ summary.earlyLeaveCount }}</b>
                        </div>
                        <div class="stat-pill bg-slate-50 text-slate-700">
                            Chưa điểm danh: <b>{{ summary.undefinedCount }}</b>
                        </div>
                        <div class="stat-pill bg-emerald-50 text-emerald-700">
                            Đã điểm danh về: <b>{{ summary.checkedOutCount }}</b>
                        </div>
                        <div class="stat-pill bg-slate-50 text-slate-700">
                            Chưa điểm danh về: <b>{{ summary.notCheckedOutCount }}</b>
                        </div>
                    </div>
                </div>
            </template>
        </Card>

        <!-- Bảng dữ liệu -->
        <div class="overflow-auto rounded-2xl ring-1 ring-slate-200 bg-white relative">
            <!-- overlay loading list -->
            <div
                v-if="loadingList"
                class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm"
            >
                <i class="fa-solid fa-spinner fa-spin mr-2" />
                Đang tải danh sách điểm danh...
            </div>

            <table class="min-w-full">
                <thead class="bg-slate-50 border-b">
                    <tr>
                        <th class="th w-10">#</th>
                        <th class="th min-w-[220px]">Học sinh</th>
                        <th class="th min-w-[160px]">Lớp</th>
                        <th class="th min-w-[140px] text-center">Trạng thái đến</th>
                        <th class="th min-w-[160px]">Thời gian đến</th>
                        <th class="th min-w-[160px]">Người điểm danh đến</th>
                        <th class="th min-w-[200px]">Ghi chú đến</th>
                        <th class="th min-w-[160px] text-center">Trạng thái về</th>
                        <th class="th min-w-[160px]">Thời gian về</th>
                        <th class="th min-w-[160px]">Người điểm danh về</th>
                        <th class="th min-w-[200px]">Ghi chú về</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(item, idx) in filteredList"
                        :key="item.studentId"
                        class="hover:bg-slate-50 border-b last:border-0"
                    >
                        <td class="td text-slate-500">
                            {{ idx + 1 }}
                        </td>
                        <td class="td">
                            <div class="font-semibold text-slate-900">
                                {{ item.studentName }}
                            </div>
                        </td>
                        <td class="td text-slate-700">
                            {{ item.className }} <span class="text-xs text-slate-400">({{ item.classCode }})</span>
                        </td>
                        <td class="td text-center">
                            <span
                                class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold"
                                :class="statusView[item.status]?.class || 'bg-slate-300 text-slate-800'"
                            >
                                {{ statusView[item.status]?.text || item.status || 'Không xác định' }}
                            </span>
                        </td>
                        <td class="td">
                            <div v-if="item.checkTime">
                                {{ formatTime(item.checkTime) }}<br />
                                <span class="text-xs text-slate-400">
                                    {{ formatDate(item.checkTime) }}
                                </span>
                            </div>
                            <span v-else class="text-slate-400 text-sm italic">
                                Chưa có
                            </span>
                        </td>
                        <td class="td">
                            {{ item.checkedBy || '—' }}
                        </td>
                        <td class="td">
                            {{ item.note || '' }}
                        </td>
                        <td class="td text-center">
                            <span
                                class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold"
                                :class="checkOutStatusView[item.checkOutStatus]?.class || 'bg-slate-300 text-slate-800'"
                            >
                                {{
                                    checkOutStatusView[item.checkOutStatus]?.text ||
                                    item.checkOutStatus ||
                                    'Không xác định'
                                }}
                            </span>
                        </td>
                        <td class="td">
                            <div v-if="item.checkOutTime">
                                {{ formatTime(item.checkOutTime) }}<br />
                                <span class="text-xs text-slate-400">
                                    {{ formatDate(item.checkOutTime) }}
                                </span>
                            </div>
                            <span v-else class="text-slate-400 text-sm italic">
                                Chưa có
                            </span>
                        </td>
                        <td class="td">
                            {{ item.checkOutBy || '—' }}
                        </td>
                        <td class="td">
                            {{ item.checkOutNote || '' }}
                        </td>
                    </tr>

                    <tr v-if="!loadingList && !filteredList.length">
                        <td colspan="11" class="td text-center text-slate-500">
                            Không có dữ liệu điểm danh cho bộ lọc hiện tại.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

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
.btn-ghost {
    background: #f1f5f9;
    color: #334155;
    border: 0;
}
.th {
    padding: 10px 12px;
    text-align: left;
    color: #334155;
    font-weight: 700;
    font-size: 13px;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
}
.td {
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 13px;
}
.stat-pill {
    @apply px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1;
}
</style>
