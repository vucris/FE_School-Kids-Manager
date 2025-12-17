<script setup>
import { ref, computed, onMounted } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Chart from 'primevue/chart';

import Swal from 'sweetalert2';

import { fetchStudents, fetchStudentStatusStatistics } from '@/service/studentService.js';

/* ================== CONSTANTS ================== */

// Map FE status (đã được map trong studentService.mapStatusFromBackend)
const STATUS_VIEW = {
    studying: { key: 'studying', label: 'Đang học', color: 'emerald' },
    dropped: { key: 'dropped', label: 'Thôi học', color: 'rose' },
    reserved: { key: 'reserved', label: 'Bảo lưu', color: 'amber' },
    graduated: { key: 'graduated', label: 'Tốt nghiệp', color: 'sky' }
};

const STATUS_FILTER_OPTIONS = [
    { label: 'Tất cả trạng thái', value: 'all' },
    ...Object.values(STATUS_VIEW).map((s) => ({
        label: s.label,
        value: s.key
    }))
];

/* ================== STATE ================== */

const loading = ref(false);
const loadingSummary = ref(false);

const studentsRaw = ref([]); // dữ liệu gốc từ fetchStudents
const summaryRaw = ref(null); // dữ liệu tổng từ fetchStudentStatusStatistics

// filter
const statusFilter = ref('all');
const classFilter = ref('ALL');
const keyword = ref('');
const fromDate = ref(null);
const toDate = ref(null);

/* ================== TOAST ================== */

const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true
});

/* ================== HELPERS ================== */

function formatDate(val) {
    if (!val) return '';
    const d = val instanceof Date ? val : new Date(val);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN');
}

/** Tổng quan: ưu tiên số từ BE, nếu không có thì tự tính từ studentsRaw */
const summary = computed(() => {
    const s = summaryRaw.value || {};
    const fromBackend = {
        total: s.totalStudents ?? s.total ?? null,
        studying: s.studyingCount ?? s.STUDYING ?? s.studying ?? null,
        dropped: s.droppedCount ?? s.DROPOUT ?? s.dropped ?? s.dropout ?? null,
        reserved: s.reservedCount ?? s.RESERVED ?? s.reserved ?? null,
        graduated: s.graduatedCount ?? s.GRADUATED ?? s.graduated ?? null
    };

    // Nếu BE chưa có thì fallback tính từ studentsRaw
    const hasBackend = fromBackend.total != null || fromBackend.studying != null || fromBackend.dropped != null || fromBackend.reserved != null || fromBackend.graduated != null;

    if (hasBackend) {
        // nếu thiếu trường nào thì fill từ studentsRaw
        const calc = calcSummaryFromStudents(studentsRaw.value);
        return {
            total: fromBackend.total ?? calc.total,
            studying: fromBackend.studying ?? calc.studying,
            dropped: fromBackend.dropped ?? calc.dropped,
            reserved: fromBackend.reserved ?? calc.reserved,
            graduated: fromBackend.graduated ?? calc.graduated
        };
    }

    return calcSummaryFromStudents(studentsRaw.value);
});

function calcSummaryFromStudents(list) {
    const result = {
        total: list?.length || 0,
        studying: 0,
        dropped: 0,
        reserved: 0,
        graduated: 0
    };
    if (!Array.isArray(list)) return result;
    for (const st of list) {
        const k = st.status || 'studying';
        if (k === 'dropped') result.dropped++;
        else if (k === 'reserved') result.reserved++;
        else if (k === 'graduated') result.graduated++;
        else result.studying++;
    }
    return result;
}

/* Lấy options lớp từ dữ liệu hiện có */
const classOptions = computed(() => {
    const set = new Set();
    for (const s of studentsRaw.value || []) {
        if (s.className) set.add(s.className);
    }
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
    return [{ label: 'Tất cả lớp', value: 'ALL' }, ...arr.map((name) => ({ label: name, value: name }))];
});

/* Lọc danh sách hiển thị */
const filteredStudents = computed(() => {
    let data = studentsRaw.value || [];

    if (statusFilter.value !== 'all') {
        data = data.filter((s) => (s.status || 'studying') === statusFilter.value);
    }

    if (classFilter.value !== 'ALL') {
        data = data.filter((s) => s.className === classFilter.value);
    }

    const kw = keyword.value.trim().toLowerCase();
    if (kw) {
        data = data.filter((s) => {
            return (s.name || '').toLowerCase().includes(kw) || (s.code || '').toLowerCase().includes(kw) || (s.parentName || '').toLowerCase().includes(kw) || (s.parentPhone || '').toLowerCase().includes(kw);
        });
    }

    // Lọc theo ngày nhập học (hoặc bạn có thể đổi sang ngày thôi học nếu BE có field riêng)
    if (fromDate.value) {
        const from = new Date(fromDate.value);
        data = data.filter((s) => {
            if (!s.enrollmentDate) return false;
            const d = new Date(s.enrollmentDate);
            return !Number.isNaN(d.getTime()) && d >= from;
        });
    }

    if (toDate.value) {
        const to = new Date(toDate.value);
        data = data.filter((s) => {
            if (!s.enrollmentDate) return false;
            const d = new Date(s.enrollmentDate);
            return !Number.isNaN(d.getTime()) && d <= to;
        });
    }

    return data;
});

/* Data cho Chart tròn */
const chartData = computed(() => {
    const s = summary.value;
    if (!s) return null;

    return {
        labels: [STATUS_VIEW.studying.label, STATUS_VIEW.dropped.label, STATUS_VIEW.reserved.label, STATUS_VIEW.graduated.label],
        datasets: [
            {
                data: [s.studying || 0, s.dropped || 0, s.reserved || 0, s.graduated || 0],
                backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#0ea5e9'],
                hoverBackgroundColor: ['#059669', '#dc2626', '#d97706', '#0284c7']
            }
        ]
    };
});

const chartOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                usePointStyle: true,
                padding: 16,
                font: { size: 12 }
            }
        },
        tooltip: {
            callbacks: {
                label: (ctx) => {
                    const label = ctx.label || '';
                    const value = ctx.parsed || 0;
                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return `${label}: ${value} (${pct}%)`;
                }
            }
        }
    }
}));

/* ================== LOAD DATA ================== */

async function loadStudents() {
    loading.value = true;
    try {
        const { items } = await fetchStudents({
            status: 'all',
            page: 1,
            size: 10000, // đủ lớn để lấy hết
            sort: 'name,asc'
        });
        studentsRaw.value = items || [];
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được danh sách học sinh'
        });
    } finally {
        loading.value = false;
    }
}

async function loadSummary() {
    loadingSummary.value = true;
    try {
        const data = await fetchStudentStatusStatistics();
        summaryRaw.value = data || null;
    } catch (e) {
        // Không critical – nếu lỗi sẽ fallback tính từ studentsRaw
        swalToast.fire({
            icon: 'warning',
            title: e?.message || 'Không lấy được thống kê, sẽ tính từ dữ liệu học sinh'
        });
    } finally {
        loadingSummary.value = false;
    }
}

async function reloadAll(showToast = false) {
    await Promise.all([loadStudents(), loadSummary()]);
    if (showToast) {
        swalToast.fire({ icon: 'success', title: 'Đã tải lại báo cáo' });
    }
}

/* Clear filter */
function clearFilters() {
    statusFilter.value = 'all';
    classFilter.value = 'ALL';
    keyword.value = '';
    fromDate.value = null;
    toDate.value = null;
}

/* Lifecycle */
onMounted(async () => {
    await reloadAll(false);
});
</script>

<template>
    <div class="student-status-report px-4 md:px-6 lg:px-10 py-6 space-y-6 relative">
        <!-- Overlay loading -->
        <div v-if="loading || loadingSummary" class="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mb-4"></div>
                <p class="text-slate-600 text-sm font-medium">Đang tải báo cáo học sinh...</p>
            </div>
        </div>

        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="p-3 bg-primary/10 rounded-2xl shadow-sm">
                    <i class="fa-solid fa-user-graduate text-3xl text-primary"></i>
                </div>
                <div>
                    <h1 class="text-3xl font-bold tracking-tight text-slate-800">Báo cáo tình trạng học sinh</h1>
                    <p class="text-slate-500 text-sm mt-1">Thống kê Đang học – Thôi học – Bảo lưu – Tốt nghiệp</p>
                </div>
            </div>

            <div class="flex items-center gap-3">
                <Button class="btn-ghost" icon="fa-solid fa-eraser" label="Xóa bộ lọc" @click="clearFilters" />
                <Button class="btn-ghost" icon="fa-solid fa-rotate-right" label="Tải lại" @click="reloadAll(true)" />
            </div>
        </div>

        <!-- Filters -->
        <Card class="card-soft">
            <template #content>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div class="lg:col-span-2">
                        <label class="label">Trạng thái</label>
                        <Dropdown v-model="statusFilter" :options="STATUS_FILTER_OPTIONS" optionLabel="label" optionValue="value" class="w-full" />
                    </div>

                    <div>
                        <label class="label">Lớp</label>
                        <Dropdown v-model="classFilter" :options="classOptions" optionLabel="label" optionValue="value" class="w-full" />
                    </div>

                    <div>
                        <label class="label">Ngày bắt đầu học từ</label>
                        <Calendar v-model="fromDate" showIcon :manualInput="false" class="w-full" dateFormat="dd/mm/yy" />
                    </div>

                    <div>
                        <label class="label">Đến ngày</label>
                        <Calendar v-model="toDate" showIcon :manualInput="false" class="w-full" dateFormat="dd/mm/yy" />
                    </div>

                    <div class="lg:col-span-2">
                        <label class="label">Tìm kiếm học sinh / phụ huynh</label>
                        <InputText v-model="keyword" class="w-full" placeholder="Nhập tên học sinh, mã học sinh, phụ huynh..." />
                    </div>
                </div>
            </template>
        </Card>

        <!-- Summary + Chart -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Cards -->
            <div class="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card class="stat-card bg-slate-50 border-slate-200">
                    <template #content>
                        <div class="text-center">
                            <div class="text-xs uppercase tracking-wide text-slate-500 mb-1">Tổng số học sinh</div>
                            <div class="text-3xl font-extrabold text-slate-900">
                                {{ summary.total || 0 }}
                            </div>
                        </div>
                    </template>
                </Card>

                <Card class="stat-card bg-emerald-50 border-emerald-200">
                    <template #content>
                        <div class="text-center">
                            <div class="text-sm text-emerald-700 mb-1">Đang học</div>
                            <div class="text-2xl font-bold text-emerald-800">
                                {{ summary.studying || 0 }}
                            </div>
                        </div>
                    </template>
                </Card>

                <Card class="stat-card bg-rose-50 border-rose-200">
                    <template #content>
                        <div class="text-center">
                            <div class="text-sm text-rose-700 mb-1">Thôi học</div>
                            <div class="text-2xl font-bold text-rose-800">
                                {{ summary.dropped || 0 }}
                            </div>
                        </div>
                    </template>
                </Card>

                <Card class="stat-card bg-amber-50 border-amber-200">
                    <template #content>
                        <div class="text-center">
                            <div class="text-sm text-amber-700 mb-1">Bảo lưu</div>
                            <div class="text-2xl font-bold text-amber-800">
                                {{ summary.reserved || 0 }}
                            </div>
                        </div>
                    </template>
                </Card>

                <Card class="stat-card bg-sky-50 border-sky-200">
                    <template #content>
                        <div class="text-center">
                            <div class="text-sm text-sky-700 mb-1">Tốt nghiệp</div>
                            <div class="text-2xl font-bold text-sky-800">
                                {{ summary.graduated || 0 }}
                            </div>
                        </div>
                    </template>
                </Card>
            </div>

            <!-- Chart -->
            <Card class="card-soft">
                <template #content>
                    <h3 class="text-base font-semibold text-slate-800 mb-3 text-center">Tỷ lệ học sinh theo trạng thái</h3>
                    <div class="h-64">
                        <Chart v-if="chartData" type="doughnut" :data="chartData" :options="chartOptions" />
                        <div v-else class="h-full flex items-center justify-center text-slate-400 text-sm">Không có dữ liệu</div>
                    </div>
                </template>
            </Card>
        </div>

        <!-- Bảng chi tiết -->
        <div class="overflow-auto rounded-2xl ring-1 ring-slate-200 bg-white shadow-lg">
            <table class="min-w-full">
                <thead class="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                    <tr>
                        <th class="th w-12">#</th>
                        <th class="th min-w-[220px]">Học sinh</th>
                        <th class="th min-w-[130px]">Mã HS</th>
                        <th class="th min-w-[150px]">Lớp</th>
                        <th class="th min-w-[120px]">Trạng thái</th>
                        <th class="th min-w-[130px]">Ngày nhập học</th>
                        <th class="th min-w-[180px]">Phụ huynh</th>
                        <th class="th min-w-[140px]">SĐT phụ huynh</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(s, idx) in filteredStudents" :key="s.id || s.code || idx" class="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                        <td class="td text-slate-500 font-medium">
                            {{ idx + 1 }}
                        </td>
                        <td class="td">
                            <div class="font-semibold text-slate-800">
                                {{ s.name }}
                            </div>
                        </td>
                        <td class="td text-slate-700">
                            {{ s.code || '—' }}
                        </td>
                        <td class="td text-slate-700">
                            <Tag v-if="s.className" :value="s.className" severity="info" />
                            <span v-else>—</span>
                        </td>
                        <td class="td">
                            <span class="status-pill" :class="`status-${s.status || 'studying'}`">
                                {{ STATUS_VIEW[s.status || 'studying']?.label || 'Đang học' }}
                            </span>
                        </td>
                        <td class="td text-slate-700">
                            {{ formatDate(s.enrollmentDate) || '—' }}
                        </td>
                        <td class="td text-slate-700">
                            {{ s.parentName || '—' }}
                        </td>
                        <td class="td text-slate-700">
                            {{ s.phone || '—' }}
                        </td>
                    </tr>

                    <tr v-if="!filteredStudents.length">
                        <td colspan="8" class="td text-center py-10">
                            <div class="text-slate-400">
                                <i class="fa-solid fa-inbox text-4xl mb-3 block"></i>
                                <div class="text-base font-medium mb-1">Không có học sinh phù hợp với bộ lọc</div>
                                <div class="text-xs">Thử đổi trạng thái, lớp hoặc xoá bớt điều kiện tìm kiếm</div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style scoped>
.student-status-report {
    background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    min-height: 100vh;
}

.label {
    display: block;
    margin-bottom: 6px;
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
}

.card-soft {
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
}

.btn-ghost {
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #e2e8f0;
    padding: 0.5rem 0.9rem;
    border-radius: 999px;
    font-size: 0.875rem;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
}

.btn-ghost:hover {
    background: #e2e8f0;
}

/* Table */
.th {
    padding: 12px 10px;
    text-align: left;
    font-weight: 700;
    font-size: 0.8rem;
    color: #374151;
}

.td {
    padding: 10px;
    font-size: 0.85rem;
}

/* Status pills */
.status-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
}

.status-studying {
    background-color: #ecfdf5;
    color: #047857;
}

.status-dropped {
    background-color: #fef2f2;
    color: #b91c1c;
}

.status-reserved {
    background-color: #fffbeb;
    color: #92400e;
}

.status-graduated {
    background-color: #eff6ff;
    color: #1d4ed8;
}

/* Cards */
.stat-card {
    border-radius: 0.9rem;
    border-width: 1px;
}
</style>
