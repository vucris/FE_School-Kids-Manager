<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Chart from 'primevue/chart';

import Swal from 'sweetalert2';

import { fetchAttendanceList, fetchAttendanceSummary } from '@/service/attendanceService.js';
import { fetchClassOptions } from '@/service/classService.js';

/* ======= STATE ======= */

const classes = ref([]); // [{ id, name }]
const selectedClass = ref(null);
const selectedDate = ref(new Date());
const statusFilter = ref(null); // PRESENT / ABSENT / LATE / EARLY_LEAVE / UNDEFINED
const keyword = ref(''); // tên học sinh

const list = ref([]); // AttendanceListItemResponse[]
const summary = ref(null);

const loadingInit = ref(false);
const loadingList = ref(false);
const loadingSummary = ref(false);
const errorMessage = ref('');

/* Trạng thái hiển thị UI */
const statusView = {
    PRESENT: { text: 'Đi học', class: 'bg-emerald-500 text-white' },
    ABSENT: { text: 'Nghỉ', class: 'bg-rose-500 text-white' },
    LATE: { text: 'Đi học trễ', class: 'bg-amber-500 text-white' },
    EARLY_LEAVE: { text: 'Về sớm', class: 'bg-sky-500 text-white' },
    UNDEFINED: { text: 'Chưa điểm danh', class: 'bg-slate-300 text-slate-800' }
};

/* checkout status dùng lại map trên cho đơn giản */
const checkOutStatusView = {
    PRESENT: { text: 'Đã về', class: 'bg-emerald-500 text-white' },
    ABSENT: { text: 'Không đến', class: 'bg-rose-500 text-white' },
    EARLY_LEAVE: { text: 'Về sớm', class: 'bg-sky-500 text-white' },
    UNDEFINED: { text: 'Chưa điểm danh về', class: 'bg-slate-300 text-slate-800' }
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

const overview = computed(() => {
    if (!summary.value) return null;

    return {
        className: summary.value.className,
        date: summary.value.date,
        totalStudents: summary.value.totalStudents,
        presentCount: summary.value.presentCount || 0,
        absentCount: summary.value.absentCount || 0,
        lateCount: summary.value.lateCount || 0,
        earlyLeaveCount: summary.value.earlyLeaveCount || 0,
        undefinedCount: summary.value.undefinedCount || 0,
        checkedOutCount: summary.value.checkedOutCount || 0,
        notCheckedOutCount: summary.value.notCheckedOutCount || 0
    };
});

/* Chart Data cho Overview */
const chartData = computed(() => {
    if (!summary.value) return null;

    const data = {
        labels: ['Đi học', 'Nghỉ', 'Đi trễ', 'Về sớm', 'Chưa điểm danh'],
        datasets: [
            {
                data: [
                    summary.value.presentCount || 0,
                    summary.value.absentCount || 0,
                    summary.value.lateCount || 0,
                    summary.value.earlyLeaveCount || 0,
                    summary.value.undefinedCount || 0
                ],
                backgroundColor: [
                    '#10b981', // emerald
                    '#ef4444', // rose
                    '#f59e0b', // amber
                    '#0ea5e9', // sky
                    '#64748b'  // slate
                ],
                hoverBackgroundColor: [
                    '#059669',
                    '#dc2626',
                    '#d97706',
                    '#0284c7',
                    '#475569'
                ]
            }
        ]
    };

    return data;
});

const chartOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                usePointStyle: true,
                padding: 20,
                font: {
                    size: 12
                }
            }
        },
        tooltip: {
            callbacks: {
                label: (context) => {
                    const label = context.label || '';
                    const value = context.parsed || 0;
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return `${label}: ${value} (${percentage}%)`;
                }
            }
        }
    }
}));

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
            status: null, // statusFilter xử lý ở FE
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
    <div class="attendance-report px-4 md:px-6 lg:px-10 py-6 space-y-6 relative">
        <!-- Loading Overlay -->
        <div v-if="loadingInit" class="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
            <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
                <p class="text-slate-600">Đang tải báo cáo điểm danh...</p>
            </div>
        </div>

        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-4 animate-fade-in">
            <div class="flex items-center gap-4">
                <div class="p-3 bg-primary/10 rounded-xl">
                    <i class="fa-solid fa-user-check text-3xl text-primary"></i>
                </div>
                <div>
                    <h1 class="text-3xl font-bold tracking-tight text-slate-800">Báo cáo điểm danh</h1>
                    <p class="text-slate-500 text-sm mt-1">Xem đầy đủ thông tin điểm danh đến / về theo từng lớp và ngày</p>
                </div>
            </div>

            <Button
                class="btn-ghost animate-pulse-on-hover"
                icon="fa-solid fa-rotate-right"
                label="Tải lại"
                @click="reloadAll(true)"
                :loading="loadingInit"
            />
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="animate-slide-down px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
            <i class="fa-solid fa-exclamation-triangle mr-2"></i>
            {{ errorMessage }}
        </div>

        <!-- Filters -->
        <Card class="card-soft ring-1 ring-slate-100 shadow-lg animate-fade-in" style="animation-delay: 0.1s">
            <template #content>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div class="md:col-span-1 lg:col-span-2">
                        <label class="label">Lớp học</label>
                        <Dropdown
                            v-model="selectedClass"
                            :options="classes"
                            optionLabel="name"
                            placeholder="Chọn lớp"
                            class="w-full"
                            :loading="loadingInit"
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
                        <InputText
                            v-model="keyword"
                            placeholder="Tên học sinh..."
                            class="w-full"
                        />
                    </div>
                </div>
            </template>
        </Card>

        <!-- Overview với Chart -->
        <div v-if="summary" class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" style="animation-delay: 0.2s">
            <!-- Stats Cards -->
            <div class="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card class="stat-card bg-emerald-50 border-emerald-200">
                    <template #content>
                        <div class="text-center">
                            <i class="fa-solid fa-check-circle text-2xl text-emerald-600 mb-2"></i>
                            <div class="text-2xl font-bold text-emerald-800">{{ summary.presentCount }}</div>
                            <div class="text-sm text-emerald-600">Đi học</div>
                        </div>
                    </template>
                </Card>

                <Card class="stat-card bg-rose-50 border-rose-200">
                    <template #content>
                        <div class="text-center">
                            <i class="fa-solid fa-times-circle text-2xl text-rose-600 mb-2"></i>
                            <div class="text-2xl font-bold text-rose-800">{{ summary.absentCount }}</div>
                            <div class="text-sm text-rose-600">Nghỉ</div>
                        </div>
                    </template>
                </Card>

                <Card class="stat-card bg-amber-50 border-amber-200">
                    <template #content>
                        <div class="text-center">
                            <i class="fa-solid fa-clock text-2xl text-amber-600 mb-2"></i>
                            <div class="text-2xl font-bold text-amber-800">{{ summary.lateCount }}</div>
                            <div class="text-sm text-amber-600">Đi trễ</div>
                        </div>
                    </template>
                </Card>

                <Card class="stat-card bg-sky-50 border-sky-200">
                    <template #content>
                        <div class="text-center">
                            <i class="fa-solid fa-sign-out-alt text-2xl text-sky-600 mb-2"></i>
                            <div class="text-2xl font-bold text-sky-800">{{ summary.earlyLeaveCount }}</div>
                            <div class="text-sm text-sky-600">Về sớm</div>
                        </div>
                    </template>
                </Card>
            </div>

            <!-- Chart -->
            <Card class="card-soft ring-1 ring-slate-100 shadow-lg">
                <template #content>
                    <h3 class="text-lg font-semibold text-slate-800 mb-4 text-center">Tỷ lệ điểm danh</h3>
                    <div class="h-64">
                        <Chart type="doughnut" :data="chartData" :options="chartOptions" />
                    </div>
                </template>
            </Card>
        </div>

        <!-- Summary Text -->
        <Card v-if="summary" class="card-soft ring-1 ring-slate-100 shadow-lg animate-fade-in" style="animation-delay: 0.3s">
            <template #content>
                <div class="flex flex-wrap items-center gap-4 text-sm text-slate-700">
                    <div class="flex-1 min-w-[200px]">
                        <div class="font-semibold text-slate-900 text-lg">
                            Lớp {{ summary.className }} • {{ formatDate(summary.date) }}
                        </div>
                        <div class="text-sm text-slate-500 mt-1">
                            Tổng số học sinh: <span class="font-bold text-slate-800">{{ summary.totalStudents }}</span>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-3">
                        <div class="stat-pill bg-slate-50 text-slate-700">
                            Chưa điểm danh: <span class="font-bold">{{ summary.undefinedCount }}</span>
                        </div>
                        <div class="stat-pill bg-emerald-50 text-emerald-700">
                            Đã điểm danh về: <span class="font-bold">{{ summary.checkedOutCount }}</span>
                        </div>
                        <div class="stat-pill bg-slate-50 text-slate-700">
                            Chưa điểm danh về: <span class="font-bold">{{ summary.notCheckedOutCount }}</span>
                        </div>
                    </div>
                </div>
            </template>
        </Card>

        <!-- Data Table -->
        <div class="overflow-auto rounded-2xl ring-1 ring-slate-200 bg-white shadow-lg relative animate-fade-in" style="animation-delay: 0.4s">
            <!-- Loading Overlay -->
            <div v-if="loadingList" class="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
                <div class="text-center">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-2"></div>
                    <p class="text-slate-600 text-sm">Đang tải danh sách...</p>
                </div>
            </div>

            <table class="min-w-full">
                <thead class="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                    <tr>
                        <th class="th w-12">#</th>
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
                    <tr v-for="(item, idx) in filteredList" :key="item.studentId" class="hover:bg-slate-50/50 border-b border-slate-100 transition-colors duration-200">
                        <td class="td text-slate-500 font-medium">
                            {{ idx + 1 }}
                        </td>
                        <td class="td">
                            <div class="font-semibold text-slate-900">
                                {{ item.studentName }}
                            </div>
                        </td>
                        <td class="td text-slate-700">
                            {{ item.className }}
                            <span class="text-xs text-slate-400 ml-1">({{ item.classCode }})</span>
                        </td>
                        <td class="td text-center">
                            <span class="status-badge" :class="statusView[item.status]?.class || 'bg-slate-300 text-slate-800'">
                                {{ statusView[item.status]?.text || item.status || 'Không xác định' }}
                            </span>
                        </td>
                        <td class="td">
                            <div v-if="item.checkTime" class="text-slate-900">
                                <div class="font-medium">{{ formatTime(item.checkTime) }}</div>
                                <div class="text-xs text-slate-500">{{ formatDate(item.checkTime) }}</div>
                            </div>
                            <span v-else class="text-slate-400 text-sm italic">Chưa có</span>
                        </td>
                        <td class="td text-slate-700">
                            {{ item.checkedBy || '—' }}
                        </td>
                        <td class="td text-slate-700">
                            {{ item.note || '—' }}
                        </td>
                        <td class="td text-center">
                            <span class="status-badge" :class="checkOutStatusView[item.checkOutStatus]?.class || 'bg-slate-300 text-slate-800'">
                                {{ checkOutStatusView[item.checkOutStatus]?.text || item.checkOutStatus || 'Không xác định' }}
                            </span>
                        </td>
                        <td class="td">
                            <div v-if="item.checkOutTime" class="text-slate-900">
                                <div class="font-medium">{{ formatTime(item.checkOutTime) }}</div>
                                <div class="text-xs text-slate-500">{{ formatDate(item.checkOutTime) }}</div>
                            </div>
                            <span v-else class="text-slate-400 text-sm italic">Chưa có</span>
                        </td>
                        <td class="td text-slate-700">
                            {{ item.checkOutBy || '—' }}
                        </td>
                        <td class="td text-slate-700">
                            {{ item.checkOutNote || '—' }}
                        </td>
                    </tr>

                    <!-- Empty State -->
                    <tr v-if="!loadingList && !filteredList.length">
                        <td colspan="11" class="td text-center py-12">
                            <div class="text-slate-400">
                                <i class="fa-solid fa-inbox text-4xl mb-4 block"></i>
                                <p class="text-lg font-medium">Không có dữ liệu điểm danh</p>
                                <p class="text-sm">Thử thay đổi bộ lọc hoặc chọn ngày khác</p>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style scoped>
.attendance-report {
    background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    min-height: 100vh;
}

/* Animations */
@keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-down {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
    animation: fade-in 0.6s ease-out forwards;
}

.animate-slide-down {
    animation: slide-down 0.4s ease-out forwards;
}

.animate-pulse-on-hover:hover {
    animation: pulse 1s infinite;
}

/* Components */
.label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #374151;
    font-size: 14px;
}

.card-soft {
    border-radius: 16px;
    background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
    border: 1px solid #e2e8f0;
}

.btn-ghost {
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
}

.btn-ghost:hover {
    background: #e2e8f0;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-card {
    border-radius: 12px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.th {
    padding: 16px 12px;
    text-align: left;
    color: #374151;
    font-weight: 700;
    font-size: 13px;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.td {
    padding: 16px 12px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 14px;
    vertical-align: top;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 20px;
    white-space: nowrap;
    min-width: 100px;
}

.stat-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 24px;
    white-space: nowrap;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(0, 0, 0, 0.1);
}

/* Color Classes */
.bg-emerald-50 { background-color: #ecfdf5; }
.bg-rose-50 { background-color: #fef2f2; }
.bg-amber-50 { background-color: #fffbeb; }
.bg-sky-50 { background-color: #f0f9ff; }
.bg-slate-50 { background-color: #f8fafc; }

.text-emerald-600 { color: #059669; }
.text-emerald-700 { color: #047857; }
.text-emerald-800 { color: #065f46; }
.text-rose-600 { color: #dc2626; }
.text-rose-700 { color: #b91c1c; }
.text-rose-800 { color: #991b1b; }
.text-amber-600 { color: #d97706; }
.text-amber-700 { color: #b45309; }
.text-amber-800 { color: #92400e; }
.text-sky-600 { color: #0284c7; }
.text-sky-700 { color: #0369a1; }
.text-sky-800 { color: #075985; }
.text-slate-500 { color: #64748b; }
.text-slate-600 { color: #475569; }
.text-slate-700 { color: #334155; }
.text-slate-800 { color: #1e293b; }
.text-slate-900 { color: #0f172a; }

.border-emerald-200 { border-color: #a7f3d0; }
.border-rose-200 { border-color: #fecaca; }
.border-amber-200 { border-color: #fde68a; }
.border-sky-200 { border-color: #bae6fd; }

/* Responsive */
@media (max-width: 768px) {
    .th, .td {
        padding: 8px 6px;
        font-size: 12px;
    }

    .status-badge {
        min-width: auto;
        padding: 4px 8px;
        font-size: 11px;
    }

    .stat-pill {
        padding: 6px 10px;
        font-size: 12px;
    }
}
</style>
