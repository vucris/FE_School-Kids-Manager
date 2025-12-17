<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';
import Chart from 'primevue/chart';
import Dropdown from 'primevue/dropdown';
import { useRouter } from 'vue-router';

import { fetchDashboardStats } from '@/service/dashboardService.js';
import { fetchAllMenuDishes } from '@/service/menuService.js';
import { fetchAttendanceSummary } from '@/service/attendanceService.js';
import { fetchClassOptions } from '@/service/classService.js';
import { fetchFeeSummary, fetchAvailableSemesters, fetchAvailableYears } from '@/service/fee.js';

import { fetchFeedbacksByStatus } from '@/service/feedback.js';
import { fetchAllLeaveRequestsForAdmin } from '@/service/leaveRequestService.js';
import { getAlbumsByStatus } from '@/service/albumService.js';

// ✅ Birthday: lấy list thật từ students/teachers
import { fetchStudents } from '@/service/studentService.js';
import { fetchTeachers } from '@/service/teacherService.js'; // nếu không có, báo mình để đổi sang service khác

/* ========== STATE ========== */

const router = useRouter();

const schoolName = ref('Mầm non Canada Maple Bear');
const academicYear = ref('2024 - 2025');

/** 4 thẻ thống kê */
const stats = ref([
    { key: 'classes', label: 'Tổng số lớp', value: 0, icon: 'fa-solid fa-school', bg: 'bg-blue-100', fg: 'text-blue-600' },
    { key: 'students', label: 'Tổng số học sinh', value: 0, icon: 'fa-solid fa-children', bg: 'bg-emerald-100', fg: 'text-emerald-600' },
    { key: 'teachers', label: 'Tổng số giáo viên', value: 0, icon: 'fa-solid fa-person-chalkboard', bg: 'bg-amber-100', fg: 'text-amber-600' },
    { key: 'parents', label: 'Tổng số phụ huynh', value: 0, icon: 'fa-solid fa-people-group', bg: 'bg-cyan-100', fg: 'text-cyan-600' }
]);

/** Cache lớp */
const classOptions = ref([]); // [{ id, name }]

/** Hoạt động */
const activities = ref([
    { key: 'menuToday', label: 'Thực đơn ngày', value: '0 món', icon: 'fa-solid fa-utensils', routeName: 'MenuFeature' },
    { key: 'newStudentsThisMonth', label: 'Học sinh mới trong tháng', value: '0', icon: 'fa-solid fa-user-graduate', routeName: 'QLHocSinh' }
]);

/** Kiểm duyệt */
const review = ref([
    { key: 'leavePending', label: 'Đơn xin nghỉ chưa duyệt', value: 0, accent: 'text-red-500', routeName: 'leaveRequest' },
    { key: 'feedbackPending', label: 'Góp ý chưa xử lý', value: 0, accent: 'text-yellow-600', routeName: 'feedbackInbox' },
    { key: 'albumPending', label: 'Album chưa kiểm duyệt', value: 0, accent: 'text-teal-600', routeName: 'AlbumManager' }
]);

/* ========== Helpers chung ========== */
const studentsCount = computed(() => stats.value.find((s) => s.key === 'students')?.value ?? 0);

const todayStr = computed(() => {
    const d = new Date();
    const weekdays = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return `${weekdays[d.getDay()]}, ${d.toLocaleDateString('vi-VN')}`;
});

function formatCurrency(value) {
    const n = Number(value || 0);
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
}

/* ========== 1) Donut: Học sinh (trạng thái) ========== */
const studentStatusData = ref({
    labels: ['Đang đi học', 'Chờ phân lớp', 'Đã bảo lưu', 'Đã thôi học', 'Đã tốt nghiệp'],
    datasets: [
        {
            data: [0, 0, 0, 0, 0],
            backgroundColor: ['#4C6EF5', '#8CE0FF', '#FFC857', '#EF4444', '#5AC8FA'],
            hoverBackgroundColor: ['#3B5BDB', '#74C7EC', '#FFB020', '#DC2626', '#38BDF8'],
            borderWidth: 0
        }
    ]
});

const doughnutOptionsRightLegend = {
    cutout: '60%',
    plugins: {
        legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 10, padding: 16 } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}` } }
    },
    maintainAspectRatio: false,
    responsive: true
};

/* ========== 2) Điểm danh ========== */
const attendanceData = ref({
    labels: ['Đi học', 'Nghỉ', 'Đi trễ', 'Về sớm', 'Chưa điểm danh'],
    datasets: [
        {
            data: [0, 0, 0, 0, 0],
            backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#0ea5e9', '#64748b'],
            hoverBackgroundColor: ['#059669', '#dc2626', '#d97706', '#0284c7', '#475569'],
            borderWidth: 0
        }
    ]
});
const attendanceSummary = ref(null);
const attendanceClass = ref(null);
const attendanceDate = ref(new Date());

/* ========== 3) Thu theo kỳ (học phí) ========== */
const feeOptions = ref([]); // [{ label, value: { semester, year } }]
const selectedFee = ref(null);

const feeData = ref({
    labels: ['Số đã thu', 'Số còn phải thu'],
    datasets: [{ data: [0, 0], backgroundColor: ['#3B82F6', '#BFDBFE'], borderWidth: 0 }]
});
const feeOptionsDonut = {
    cutout: '65%',
    plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}` } }
    },
    maintainAspectRatio: false,
    responsive: true
};

const feeSummary = ref(null);
const feeTotalAmount = ref(0);
const feeCollectedAmount = ref(0);
const feeRemainingAmount = ref(0);
const feePercent = ref(0);

/* ========== 4) Sinh nhật tháng hiện tại ========== */
const birthdayMonth = computed(() => new Date().getMonth() + 1); // 1..12

// list hiển thị (tối đa 12 avatar mỗi nhóm để đẹp)
const birthdaysStudents = ref([]); // [{ id, name, dob }]
const birthdaysStaff = ref([]); // [{ id, name, dob }]

const birthdayStudentsTotal = ref(0);
const birthdayStaffTotal = ref(0);

/* ========== Loading & Error ========== */
const loading = ref(false);
const errorMessage = ref(null);

/* ========== Birthday helpers ========== */
function parseDateSafe(d) {
    if (!d) return null;
    try {
        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return null;
        return dt;
    } catch {
        return null;
    }
}

function formatDobVi(d) {
    const dt = parseDateSafe(d);
    if (!dt) return '';
    return dt.toLocaleDateString('vi-VN');
}

function getAvatarText(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return String(name)[0].toUpperCase();
}

function getAvatarClass(seed) {
    const colors = [
        'bg-blue-200 text-blue-700',
        'bg-emerald-200 text-emerald-700',
        'bg-amber-200 text-amber-700',
        'bg-purple-200 text-purple-700',
        'bg-pink-200 text-pink-700',
        'bg-cyan-200 text-cyan-700'
    ];
    const s = String(seed || '');
    const idx = s ? s.charCodeAt(0) % colors.length : 0;
    return colors[idx];
}

function isBirthdayInMonth(dob, month) {
    const dt = parseDateSafe(dob);
    if (!dt) return false;
    return dt.getMonth() + 1 === month;
}

/* ========== LOADERS RIÊNG ========== */
async function ensureClassOptions() {
    if (classOptions.value.length) return;
    try {
        const opts = await fetchClassOptions();
        classOptions.value = (opts || []).map((o) => ({ id: o.value, name: o.label }));
    } catch (e) {
        console.warn('[Dashboard] Không tải được danh sách lớp:', e?.message || e);
    }
}

async function ensureFeeOptions() {
    if (feeOptions.value.length && selectedFee.value) return;

    const [semesters, years] = await Promise.all([
        fetchAvailableSemesters().catch(() => []),
        fetchAvailableYears().catch(() => [])
    ]);

    const ys = (years || []).slice().sort((a, b) => String(b).localeCompare(String(a)));
    const ss = (semesters || []).slice().sort((a, b) => String(b).localeCompare(String(a)));

    const options = [];
    for (const y of ys) {
        for (const s of ss) {
            options.push({ label: `Học phí ${s} - ${y}`, value: { semester: s, year: y } });
        }
    }

    feeOptions.value = options;
    if (!selectedFee.value) selectedFee.value = feeOptions.value[0] || null;
}

async function loadMenuActivity() {
    try {
        const dishes = await fetchAllMenuDishes();
        const total = Array.isArray(dishes) ? dishes.length : 0;
        activities.value = activities.value.map((item) => (item.key === 'menuToday' ? { ...item, value: `${total} món` } : item));
    } catch (e) {
        console.warn('[Dashboard] loadMenuActivity lỗi:', e?.message || e);
    }
}

async function loadAttendanceSummaryForDashboard() {
    try {
        await ensureClassOptions();
        const firstClass = classOptions.value[0];
        if (!firstClass) return;

        attendanceClass.value = firstClass;
        const data = await fetchAttendanceSummary({ classId: firstClass.id, date: attendanceDate.value });
        attendanceSummary.value = data || null;

        if (data) {
            attendanceData.value = {
                ...attendanceData.value,
                datasets: [
                    {
                        ...attendanceData.value.datasets[0],
                        data: [data.presentCount || 0, data.absentCount || 0, data.lateCount || 0, data.earlyLeaveCount || 0, data.undefinedCount || 0]
                    }
                ]
            };
        }
    } catch (e) {
        console.warn('[Dashboard] loadAttendanceSummaryForDashboard lỗi:', e?.message || e);
    }
}

async function loadFeeSummaryForDashboard() {
    try {
        await ensureClassOptions();
        await ensureFeeOptions();

        const firstClass = classOptions.value[0];
        if (!firstClass) return;

        const picked = selectedFee.value?.value;
        const semester = picked?.semester;
        const year = picked?.year;
        if (!semester || !year) return;

        const summary = await fetchFeeSummary({ classId: firstClass.id, semester, year });
        feeSummary.value = summary || null;

        if (summary) {
            const totalAmount = summary.totalAmount ?? summary.totalFee ?? 0;
            const collectedAmount = summary.collectedAmount ?? summary.paidAmount ?? 0;
            const remainingAmount = summary.remainingAmount ?? summary.unpaidAmount ?? Math.max(totalAmount - collectedAmount, 0);

            feeTotalAmount.value = totalAmount;
            feeCollectedAmount.value = collectedAmount;
            feeRemainingAmount.value = remainingAmount;
            feePercent.value = totalAmount > 0 ? Math.round((collectedAmount / totalAmount) * 100) : 0;

            feeData.value = { ...feeData.value, datasets: [{ ...feeData.value.datasets[0], data: [collectedAmount, remainingAmount] }] };
        } else {
            feeTotalAmount.value = 0;
            feeCollectedAmount.value = 0;
            feeRemainingAmount.value = 0;
            feePercent.value = 0;
            feeData.value = { ...feeData.value, datasets: [{ ...feeData.value.datasets[0], data: [0, 0] }] };
        }
    } catch (e) {
        console.warn('[Dashboard] loadFeeSummaryForDashboard lỗi:', e?.message || e);
    }
}

async function loadFeedbackReview() {
    try {
        const pending = await fetchFeedbacksByStatus('PENDING');
        const count = Array.isArray(pending) ? pending.length : 0;
        review.value = review.value.map((item) => (item.key === 'feedbackPending' ? { ...item, value: count } : item));
    } catch (e) {
        console.warn('[Dashboard] loadFeedbackReview lỗi:', e?.message || e);
    }
}

async function loadLeaveReview() {
    try {
        const list = await fetchAllLeaveRequestsForAdmin();
        const items = Array.isArray(list) ? list : [];
        const pendingCount = items.filter((x) => {
            const s = String(x?.status || x?.requestStatus || '').toUpperCase();
            if (s === 'PENDING') return true;
            const vi = String(x?.status || '').toLowerCase();
            return vi.includes('chờ') || vi.includes('cho') || vi.includes('pending');
        }).length;

        review.value = review.value.map((item) => (item.key === 'leavePending' ? { ...item, value: pendingCount } : item));
    } catch (e) {
        console.warn('[Dashboard] loadLeaveReview lỗi:', e?.message || e);
    }
}

async function loadAlbumReview() {
    try {
        const albums = await getAlbumsByStatus('PENDING');
        const count = Array.isArray(albums) ? albums.length : 0;
        review.value = review.value.map((item) => (item.key === 'albumPending' ? { ...item, value: count } : item));
    } catch (e) {
        console.warn('[Dashboard] loadAlbumReview lỗi:', e?.message || e);
    }
}

/** ✅ Sinh nhật: lấy list thật từ students + teachers, lọc theo tháng hiện tại */
async function loadBirthdays() {
    const month = birthdayMonth.value;

    // students
    try {
        const all = await fetchStudents({ status: 'all', page: 1, size: 99999 }, { skipParentEnrich: true });
        const items = Array.isArray(all?.items) ? all.items : [];

        const birthdayList = items
            .filter((s) => isBirthdayInMonth(s.dob, month))
            .map((s) => ({
                id: s.id,
                name: s.name,
                dob: s.dob
            }))
            .sort((a, b) => {
                const da = parseDateSafe(a.dob);
                const db = parseDateSafe(b.dob);
                if (!da || !db) return 0;
                return da.getDate() - db.getDate();
            });

        birthdayStudentsTotal.value = birthdayList.length;
        birthdaysStudents.value = birthdayList.slice(0, 12);
    } catch (e) {
        console.warn('[Dashboard] loadBirthdays students lỗi:', e?.message || e);
        birthdayStudentsTotal.value = 0;
        birthdaysStudents.value = [];
    }

    // staff/teachers
    try {
        const res = await fetchTeachers({ status: 'all', page: 1, size: 10000 });
        const items = Array.isArray(res?.items) ? res.items : [];

        const birthdayList = items
            .filter((t) => isBirthdayInMonth(t.dateOfBirth, month))
            .map((t) => ({
                id: t.id,
                name: t.name,
                dob: t.dateOfBirth
            }))
            .sort((a, b) => {
                const da = parseDateSafe(a.dob);
                const db = parseDateSafe(b.dob);
                if (!da || !db) return 0;
                return da.getDate() - db.getDate();
            });

        birthdayStaffTotal.value = birthdayList.length;
        birthdaysStaff.value = birthdayList.slice(0, 12);
    } catch (e) {
        // Nếu teacher service không có dob hoặc không import được -> fallback 0
        console.warn('[Dashboard] loadBirthdays staff lỗi:', e?.message || e);
        birthdayStaffTotal.value = 0;
        birthdaysStaff.value = [];
    }
}

/* ========== Load data từ API thực ========== */
async function loadDashboardBasic() {
    try {
        loading.value = true;
        errorMessage.value = null;

        const statsRes = await fetchDashboardStats();

        stats.value = stats.value.map((card) => {
            if (card.key === 'classes') return { ...card, value: statsRes.classes ?? 0 };
            if (card.key === 'students') return { ...card, value: statsRes.students ?? 0 };
            if (card.key === 'teachers') return { ...card, value: statsRes.teachers ?? 0 };
            if (card.key === 'parents') return { ...card, value: statsRes.parents ?? 0 };
            return card;
        });

        if (statsRes.studentStatusCounts) {
            const c = statsRes.studentStatusCounts;
            studentStatusData.value = {
                ...studentStatusData.value,
                datasets: [
                    {
                        ...studentStatusData.value.datasets[0],
                        data: [c.studying ?? 0, c.waiting ?? 0, c.reserved ?? 0, c.left ?? 0, c.graduated ?? 0]
                    }
                ]
            };
        } else {
            studentStatusData.value = {
                ...studentStatusData.value,
                datasets: [{ ...studentStatusData.value.datasets[0], data: [statsRes.students ?? 0, 0, 0, 0, 0] }]
            };
        }

        activities.value = activities.value.map((item) => {
            if (item.key === 'newStudentsThisMonth') return { ...item, value: String(statsRes.newStudentsThisMonth ?? 0) };
            return item;
        });

        await Promise.all([
            loadMenuActivity(),
            loadAttendanceSummaryForDashboard(),
            loadFeeSummaryForDashboard(),
            loadFeedbackReview(),
            loadLeaveReview(),
            loadAlbumReview(),
            loadBirthdays()
        ]);
    } catch (e) {
        console.error(e);
        errorMessage.value = e?.message || 'Không tải được dữ liệu trang chủ.';
    } finally {
        loading.value = false;
    }
}

/* ========== HANDLERS CLICK ========== */
function handleActivityClick(item) {
    if (item.routeName) router.push({ name: item.routeName });
}
function handleReviewClick(item) {
    if (item.routeName) router.push({ name: item.routeName });
}

watch(selectedFee, () => {
    loadFeeSummaryForDashboard();
});

onMounted(() => {
    loadDashboardBasic();
});
</script>

<template>
    <div class="p-6 space-y-6">
        <div v-if="loading" class="text-sm text-gray-500 mb-2">Đang tải dữ liệu tổng quan...</div>
        <div v-if="errorMessage" class="text-sm text-red-500 mb-2">{{ errorMessage }}</div>

        <!-- Tiêu đề -->
        <div class="flex flex-wrap justify-between items-center text-surface-900 dark:text-surface-0">
            <h1 class="text-2xl font-semibold">Dashboard</h1>
            <span class="text-primary font-medium text-lg">Năm học: {{ academicYear }}</span>
        </div>

        <!-- Thẻ thống kê -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            <div v-for="s in stats" :key="s.key" class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-5 flex items-center gap-4 hover:shadow-md transition-all duration-200">
                <div :class="['w-14 h-14 flex items-center justify-center rounded-xl text-2xl', s.bg, s.fg]">
                    <i :class="s.icon"></i>
                </div>
                <div>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">{{ s.label }}</p>
                    <h3 class="text-3xl font-semibold mt-1">{{ s.value }}</h3>
                </div>
            </div>
        </div>

        <!-- Bảng tin -->
        <div class="flex items-center gap-2 text-surface-700 dark:text-surface-300 mt-8">
            <i class="fa-solid fa-newspaper text-primary text-xl"></i>
            <h2 class="text-xl font-semibold">Bảng tin - {{ todayStr }}</h2>
        </div>

        <!-- Hai cột: Hoạt động | Kiểm duyệt -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <!-- Hoạt động -->
            <section class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-6 flex flex-col">
                <header class="flex items-center gap-2 mb-5 border-b border-surface-200 dark:border-surface-700 pb-3">
                    <i class="fa-solid fa-chart-line text-primary text-xl"></i>
                    <h3 class="text-xl font-semibold">Hoạt động</h3>
                </header>

                <ul class="flex-1 space-y-2">
                    <li
                        v-for="(item, idx) in activities"
                        :key="item.key || idx"
                        class="flex justify-between items-center bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-xl px-4 py-3 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                        @click="handleActivityClick(item)"
                    >
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-50 dark:bg-surface-700">
                                <i :class="[item.icon, 'text-primary-500 text-base']"></i>
                            </div>
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ item.label }}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="font-semibold text-gray-900 dark:text-gray-100">{{ item.value }}</span>
                            <i class="fa-solid fa-chevron-right text-gray-400 text-xs"></i>
                        </div>
                    </li>
                </ul>
            </section>

            <!-- Kiểm duyệt -->
            <section class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-6 flex flex-col">
                <header class="flex items-center gap-2 mb-5 border-b border-surface-200 dark:border-surface-700 pb-3">
                    <i class="fa-solid fa-list-check text-primary text-xl"></i>
                    <h3 class="text-xl font-semibold">Kiểm duyệt</h3>
                </header>

                <ul class="flex-1 divide-y divide-surface-200 dark:divide-surface-700">
                    <li
                        v-for="(r, idx) in review"
                        :key="r.key || idx"
                        class="flex justify-between items-center py-3 px-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-all duration-200 cursor-pointer"
                        @click="handleReviewClick(r)"
                    >
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ r.label }}</span>
                        <div class="flex items-center space-x-2">
                            <span :class="['font-semibold', r.accent]">{{ r.value }}</span>
                            <i class="fa-solid fa-angle-right text-gray-400 text-xs"></i>
                        </div>
                    </li>
                </ul>
            </section>
        </div>

        <!-- Cụm 1: Học sinh | Điểm danh -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-6">
                <header class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold flex items-center gap-2">
                        <i class="fa-solid fa-user-graduate"></i>
                        {{ studentsCount }} Học sinh
                    </h3>
                    <i class="fa-solid fa-arrow-right text-primary"></i>
                </header>
                <div class="h-64">
                    <Chart type="doughnut" :data="studentStatusData" :options="doughnutOptionsRightLegend" />
                </div>
            </section>

            <section class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-6">
                <header class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold flex items-center gap-2">
                        <i class="fa-solid fa-calendar-check"></i>
                        <span v-if="attendanceSummary"> Điểm danh lớp {{ attendanceSummary.className }} ({{ attendanceSummary.totalStudents }} HS) </span>
                        <span v-else> Điểm danh {{ studentsCount }} học sinh </span>
                    </h3>
                    <i class="fa-solid fa-arrow-right text-primary"></i>
                </header>
                <div class="h-64">
                    <Chart type="doughnut" :data="attendanceData" :options="doughnutOptionsRightLegend" />
                </div>
            </section>
        </div>

        <!-- Cụm 3: Thu theo kỳ | Sinh nhật -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-6">
                <header class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold flex items-center gap-2">
                        <i class="fa-solid fa-coins"></i>
                        Tình hình thực hiện thu theo kỳ
                    </h3>
                    <div class="w-56">
                        <Dropdown v-model="selectedFee" :options="feeOptions" optionLabel="label" class="w-full" />
                    </div>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div class="md:col-span-1 h-48">
                        <Chart type="doughnut" :data="feeData" :options="feeOptionsDonut" />
                    </div>
                    <div class="md:col-span-2 space-y-6">
                        <div>
                            <div class="text-surface-500">Tổng số phải thu</div>
                            <div class="mt-2 h-px bg-surface-200 dark:bg-surface-700"></div>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <span class="inline-block w-4 h-4 rounded bg-blue-500"></span>
                                <span>Số đã thu</span>
                            </div>
                            <div class="font-semibold">{{ formatCurrency(feeCollectedAmount) }}</div>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <span class="inline-block w-4 h-4 rounded bg-blue-200"></span>
                                <span>Số còn phải thu</span>
                            </div>
                            <div class="font-semibold">{{ formatCurrency(feeRemainingAmount) }}</div>
                        </div>
                        <div class="font-semibold">Tỷ lệ thu {{ feePercent }}%</div>
                    </div>
                </div>
            </section>

            <section class="rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 p-6">
                <header class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold flex items-center gap-2">
                        <i class="fa-solid fa-cake-candles"></i>
                        Chúc mừng sinh nhật tháng {{ birthdayMonth }}
                    </h3>
                    <i class="fa-solid fa-arrow-right text-primary"></i>
                </header>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <!-- Avatar list -->
                    <div class="md:col-span-2 grid grid-rows-2 gap-y-8">
                        <!-- Students -->
                        <div>
                            <div class="text-xs text-surface-500 mb-2">Học sinh</div>
                            <div class="flex flex-wrap gap-x-3 gap-y-3">
                                <div
                                    v-for="s in birthdaysStudents"
                                    :key="s.id"
                                    class="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
                                    :class="getAvatarClass(s.name)"
                                    :title="`${s.name} - ${formatDobVi(s.dob)}`"
                                >
                                    {{ getAvatarText(s.name) }}
                                </div>
                                <span v-if="birthdayStudentsTotal > birthdaysStudents.length" class="text-xs text-surface-500 self-center">
                                    +{{ birthdayStudentsTotal - birthdaysStudents.length }}
                                </span>
                            </div>
                        </div>

                        <!-- Staff -->
                        <div>
                            <div class="text-xs text-surface-500 mb-2">Nhân viên</div>
                            <div class="flex flex-wrap gap-x-3 gap-y-3">
                                <div
                                    v-for="s in birthdaysStaff"
                                    :key="s.id"
                                    class="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
                                    :class="getAvatarClass(s.name)"
                                    :title="`${s.name} - ${formatDobVi(s.dob)}`"
                                >
                                    {{ getAvatarText(s.name) }}
                                </div>
                                <span v-if="birthdayStaffTotal > birthdaysStaff.length" class="text-xs text-surface-500 self-center">
                                    +{{ birthdayStaffTotal - birthdaysStaff.length }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Totals -->
                    <div class="md:col-span-1 flex flex-col justify-start gap-8">
                        <div class="text-right">
                            <div class="text-surface-500">Học sinh:</div>
                            <div class="text-lg font-semibold">{{ birthdayStudentsTotal }}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-surface-500">Nhân viên:</div>
                            <div class="text-lg font-semibold">{{ birthdayStaffTotal }}</div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
.text-surface-900 {
    color: #1e293b;
}
.dark .text-surface-900 {
    color: #f8fafc;
}
</style>
