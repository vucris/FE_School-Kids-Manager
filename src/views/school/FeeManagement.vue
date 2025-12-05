<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Calendar from 'primevue/calendar';
import Dialog from 'primevue/dialog';
import Paginator from 'primevue/paginator';
import Checkbox from 'primevue/checkbox';

import Swal from 'sweetalert2';

import { fetchClassOptions } from '@/service/classService.js';
import { fetchStudentsByClass } from '@/service/studentService.js';
import { fetchFeesByClassAndSemesterYear, fetchFeeSummary, fetchAvailableYears, createBulkFees, exportFeesToExcel, payFee, fetchFeeDetail, deleteFee, updateFee, updateOverdueFees } from '@/service/fee.js';

import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser } from '@/service/authService.js';

/* ===== Auth ===== */
const auth = useAuthStore();
const currentUser = computed(() => getUsernameFromUser(auth?.user) || 'system');

/* ===== Route ===== */
const route = useRoute();

/* ===== Data filter ===== */
const classes = ref([]);
const months = ref(
    Array.from({ length: 12 }, (_, i) => ({
        label: `Tháng ${i + 1}`,
        value: i + 1
    }))
);
const years = ref([]);

const selectedClass = ref(null);
const selectedMonth = ref(new Date().getMonth() + 1);
const selectedYear = ref(new Date().getFullYear());

const statusFilter = ref('ALL');
const keyword = ref('');

/* ===== Data from BE ===== */
const students = ref([]);
const fees = ref([]);
const summary = ref(null);

/* ===== UI state ===== */
const loadingInit = ref(false);
const loadingList = ref(false);

const first = ref(0);
const rowsPerPage = ref(10);

const errorMessage = ref('');
const isReadyToReload = ref(false);

/* ===== Dialog states ===== */
const bulkDialogVisible = ref(false);
const bulkAmount = ref(null);
const bulkDueDate = ref(null);

const payDialogVisible = ref(false);
const payTarget = ref(null);
const payAmount = ref(null);
const payDate = ref(new Date());
const payMethod = ref('Tiền mặt');
const payTransactionCode = ref('');
const payNote = ref('');

const editDialogVisible = ref(false);
const editTarget = ref(null);
const editAmount = ref(null);
const editDueDate = ref(null);
const editNote = ref('');

const notifyDialogVisible = ref(false);
const notifySendViaApp = ref(true);
const notifySendViaEmail = ref(false);
const notifyOnlyNotPaid = ref(true);
const selectedNotifyStudentIds = ref([]);

const detailDialogVisible = ref(false);
const detailLoading = ref(false);
const detailData = ref(null);
const detailBaseRow = ref(null);

/* ===== SweetAlert Toast ===== */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
});

function confirmDialog(title, text) {
    return Swal.fire({
        title,
        text,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Đồng ý',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280',
        reverseButtons: true
    });
}

/* ===== Status config ===== */
const statusConfig = {
    NOT_CREATED: { text: 'Chưa tạo', bg: 'bg-gray-100', text_color: 'text-gray-500', icon: 'fa-minus-circle' },
    PENDING: { text: 'Chờ đóng', bg: 'bg-amber-50', text_color: 'text-amber-600', icon: 'fa-clock' },
    OVERDUE: { text: 'Quá hạn', bg: 'bg-red-50', text_color: 'text-red-600', icon: 'fa-exclamation-triangle' },
    PARTIAL: { text: 'Đóng một phần', bg: 'bg-blue-50', text_color: 'text-blue-600', icon: 'fa-adjust' },
    PAID: { text: 'Đã đóng đủ', bg: 'bg-green-50', text_color: 'text-green-600', icon: 'fa-check-circle' },
    WAITING_VERIFICATION: { text: 'Chờ xác nhận', bg: 'bg-teal-50', text_color: 'text-teal-600', icon: 'fa-hourglass-half' },
    VERIFIED: { text: 'Đã xác nhận', bg: 'bg-green-50', text_color: 'text-green-700', icon: 'fa-check-double' },
    REJECTED: { text: 'Từ chối', bg: 'bg-red-50', text_color: 'text-red-500', icon: 'fa-times-circle' }
};

/* ===== Utils ===== */
function formatCurrency(amount) {
    if (amount == null) return '—';
    return new Intl.NumberFormat('vi-VN').format(Number(amount)) + ' đ';
}

function formatDate(value) {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN');
}

function getDaysRemaining(dueDate) {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

/* ===== Computed: Progress percentage ===== */
const collectionProgress = computed(() => {
    if (!summary.value || !summary.value.totalAmount) return 0;
    return Math.round((summary.value.totalPaid / summary.value.totalAmount) * 100);
});

/* ===== Merge students + fees ===== */
const mergedRows = computed(() => {
    const stuList = students.value || [];
    const feeList = fees.value || [];

    if (stuList.length > 0) {
        const feeMap = new Map(feeList.map((f) => [f.studentId, f]));
        return stuList.map((s, idx) => {
            const fee = feeMap.get(s.id);
            return {
                index: idx + 1,
                studentId: s.id,
                studentName: s.fullName || s.name,
                studentCode: s.studentCode || s.code,
                className: s.className || selectedClass.value?.name || '',
                feeId: fee?.id || null,
                totalAmount: fee?.totalAmount ?? null,
                paidAmount: fee?.paidAmount ?? 0,
                remainingAmount: fee?.remainingAmount ?? null,
                dueDate: fee?.dueDate ?? null,
                paidDate: fee?.paidDate ?? null,
                status: fee?.status || 'NOT_CREATED',
                note: fee?.note || '',
                proofImageUrl: fee?.proofImageUrl || null
            };
        });
    }

    if (feeList.length > 0) {
        return feeList.map((f, idx) => ({
            index: idx + 1,
            studentId: f.studentId,
            studentName: f.studentName,
            studentCode: f.studentCode,
            className: f.className || selectedClass.value?.name || '',
            feeId: f.id,
            totalAmount: f.totalAmount ?? null,
            paidAmount: f.paidAmount ?? 0,
            remainingAmount: f.remainingAmount ?? null,
            dueDate: f.dueDate ?? null,
            paidDate: f.paidDate ?? null,
            status: f.status || 'PENDING',
            note: f.note || '',
            proofImageUrl: f.proofImageUrl || null
        }));
    }

    return [];
});

/* ===== Filter + pagination ===== */
const filteredRows = computed(() => {
    let list = [...mergedRows.value];

    if (statusFilter.value && statusFilter.value !== 'ALL') {
        list = list.filter((r) => r.status === statusFilter.value);
    }

    const kw = keyword.value.trim().toLowerCase();
    if (kw) {
        list = list.filter((r) => (r.studentName || '').toLowerCase().includes(kw) || (r.studentCode || '').toLowerCase().includes(kw));
    }

    return list;
});

const pagedRows = computed(() => {
    const start = first.value;
    const end = first.value + rowsPerPage.value;
    return filteredRows.value.slice(start, end);
});

/* ===== Permissions ===== */
function canPay(row) {
    if (!row.feeId) return false;
    return ['PENDING', 'OVERDUE', 'PARTIAL', 'WAITING_VERIFICATION', 'REJECTED'].includes(row.status);
}

function canEdit(row) {
    return !!row.feeId && row.status !== 'PAID';
}

function canDelete(row) {
    return !!row.feeId;
}

/* ===== Notification helpers ===== */
const notifyRows = computed(() => {
    let rows = mergedRows.value.filter((r) => r.feeId);
    if (notifyOnlyNotPaid.value) {
        rows = rows.filter((r) => r.status !== 'PAID');
    }
    return rows;
});

const allNotifyChecked = computed({
    get() {
        return notifyRows.value.length > 0 && selectedNotifyStudentIds.value.length === notifyRows.value.length;
    },
    set(val) {
        selectedNotifyStudentIds.value = val ? notifyRows.value.map((r) => r.studentId) : [];
    }
});

function toggleNotifyRow(row) {
    const idx = selectedNotifyStudentIds.value.indexOf(row.studentId);
    if (idx >= 0) {
        selectedNotifyStudentIds.value.splice(idx, 1);
    } else {
        selectedNotifyStudentIds.value.push(row.studentId);
    }
}

/* ===== API calls ===== */
async function loadClasses() {
    const opts = await fetchClassOptions();
    classes.value = (opts || []).map((o) => ({ id: o.value, name: o.label }));
    if (!selectedClass.value && classes.value.length) {
        selectedClass.value = classes.value[0];
    }
}

async function loadSemestersAndYears() {
    try {
        const yrs = await fetchAvailableYears();
        years.value = yrs?.length ? yrs : [new Date().getFullYear()];
        if (!selectedYear.value) selectedYear.value = years.value[0];
        if (!selectedMonth.value) selectedMonth.value = new Date().getMonth() + 1;
    } catch (e) {
        console.error(e);
        years.value = [new Date().getFullYear()];
        selectedYear.value = years.value[0];
        selectedMonth.value = new Date().getMonth() + 1;
    }
}

function applyRouteQueryDefaults() {
    const q = route.query || {};
    const monthParam = q.month || q.semester;
    if (monthParam != null) {
        const m = Number(monthParam);
        if (!Number.isNaN(m) && m >= 1 && m <= 12) selectedMonth.value = m;
    }
    if (q.year) {
        const yr = years.value.find((y) => String(y) === String(q.year));
        if (yr) selectedYear.value = yr;
    }
    if (q.classId) {
        const cls = classes.value.find((c) => String(c.id) === String(q.classId));
        if (cls) selectedClass.value = cls;
    }
}

async function loadData({ showToast = false } = {}) {
    if (!selectedClass.value || !selectedMonth.value || !selectedYear.value) return;

    loadingList.value = true;
    errorMessage.value = '';

    try {
        const [stu, feeList, sum] = await Promise.all([
            fetchStudentsByClass(selectedClass.value.id),
            fetchFeesByClassAndSemesterYear({
                classId: selectedClass.value.id,
                semester: selectedMonth.value,
                year: selectedYear.value
            }),
            fetchFeeSummary({
                classId: selectedClass.value.id,
                semester: selectedMonth.value,
                year: selectedYear.value
            })
        ]);

        students.value = stu || [];
        fees.value = feeList || [];
        summary.value = sum || null;

        if (showToast) {
            swalToast.fire({ icon: 'success', title: 'Đã tải dữ liệu' });
        }
    } catch (e) {
        console.error(e);
        errorMessage.value = e.message || 'Không thể tải dữ liệu học phí';
        swalToast.fire({ icon: 'error', title: errorMessage.value });
    } finally {
        loadingList.value = false;
    }
}

function onPageChange(e) {
    first.value = e.first;
    rowsPerPage.value = e.rows;
}

/* ===== Bulk fee ===== */
function openBulkDialog() {
    bulkDialogVisible.value = true;
    bulkAmount.value = null;
    bulkDueDate.value = null;
}

async function confirmBulkCreate() {
    if (!bulkAmount.value || !bulkDueDate.value) {
        swalToast.fire({ icon: 'warning', title: 'Vui lòng nhập đầy đủ thông tin' });
        return;
    }
    try {
        await createBulkFees({
            classId: selectedClass.value.id,
            semester: selectedMonth.value,
            year: selectedYear.value,
            amount: bulkAmount.value,
            dueDate: bulkDueDate.value
        });
        bulkDialogVisible.value = false;
        swalToast.fire({ icon: 'success', title: 'Tạo học phí thành công' });
        await loadData();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e.message || 'Tạo học phí thất bại' });
    }
}

/* ===== Export Excel ===== */
async function onExportExcel() {
    if (!selectedClass.value) {
        swalToast.fire({ icon: 'info', title: 'Vui lòng chọn lớp' });
        return;
    }

    try {
        const blob = await exportFeesToExcel({
            classId: selectedClass.value.id,
            semester: selectedMonth.value,
            year: selectedYear.value
        });

        if (!blob || blob.byteLength === 0) {
            swalToast.fire({ icon: 'info', title: 'Không có dữ liệu để xuất' });
            return;
        }

        const fileName = `HocPhi_${selectedClass.value.name?.replace(/\s+/g, '_')}_T${selectedMonth.value}_${selectedYear.value}.xlsx`;
        const url = window.URL.createObjectURL(new Blob([blob]));
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        swalToast.fire({ icon: 'success', title: 'Đã xuất file Excel' });
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e.message || 'Xuất Excel thất bại' });
    }
}

/* ===== Update overdue ===== */
async function onUpdateOverdue() {
    const { isConfirmed } = await confirmDialog('Cập nhật trạng thái quá hạn?', 'Hệ thống sẽ tự động đánh dấu các khoản học phí đã quá hạn.');
    if (!isConfirmed) return;

    try {
        await updateOverdueFees();
        swalToast.fire({ icon: 'success', title: 'Đã cập nhật' });
        await loadData();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e.message || 'Cập nhật thất bại' });
    }
}

/* ===== Payment ===== */
function openPayDialog(row) {
    if (!row.feeId) {
        swalToast.fire({ icon: 'info', title: 'Chưa có học phí để thu' });
        return;
    }
    payTarget.value = row;
    const remaining = row.remainingAmount ?? row.totalAmount - row.paidAmount;
    payAmount.value = remaining > 0 ? remaining : null;
    payDate.value = new Date();
    payMethod.value = 'Tiền mặt';
    payTransactionCode.value = '';
    payNote.value = '';
    payDialogVisible.value = true;
}

async function confirmPayment() {
    if (!payTarget.value?.feeId || !payAmount.value || !payDate.value) {
        swalToast.fire({ icon: 'warning', title: 'Vui lòng nhập đầy đủ thông tin' });
        return;
    }

    if (payMethod.value === 'Chuyển khoản' && !payTransactionCode.value.trim()) {
        swalToast.fire({ icon: 'warning', title: 'Vui lòng nhập mã giao dịch' });
        return;
    }

    let finalNote = payNote.value || '';
    if (payMethod.value === 'Chuyển khoản' && payTransactionCode.value.trim()) {
        finalNote = `${finalNote ? `${finalNote} | ` : ''}Mã GD: ${payTransactionCode.value.trim()}`;
    }

    try {
        await payFee({
            feeId: payTarget.value.feeId,
            amount: payAmount.value,
            paymentDate: payDate.value,
            paymentMethod: payMethod.value,
            note: finalNote,
            receivedBy: currentUser.value
        });
        payDialogVisible.value = false;
        swalToast.fire({ icon: 'success', title: 'Thu học phí thành công' });
        await loadData();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e.message || 'Thu học phí thất bại' });
    }
}

/* ===== Edit fee ===== */
function openEditDialog(row) {
    if (!row.feeId) {
        swalToast.fire({ icon: 'info', title: 'Chưa có học phí để sửa' });
        return;
    }
    editTarget.value = row;
    editAmount.value = row.totalAmount ?? 0;
    editDueDate.value = row.dueDate ? new Date(row.dueDate) : null;
    editNote.value = row.note || '';
    editDialogVisible.value = true;
}

async function confirmUpdateFee() {
    if (!editTarget.value?.feeId || !editAmount.value) {
        swalToast.fire({ icon: 'warning', title: 'Vui lòng nhập số tiền' });
        return;
    }

    try {
        await updateFee(editTarget.value.feeId, {
            totalAmount: editAmount.value,
            dueDate: editDueDate.value,
            note: editNote.value
        });
        editDialogVisible.value = false;
        swalToast.fire({ icon: 'success', title: 'Cập nhật thành công' });
        await loadData();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e.message || 'Cập nhật thất bại' });
    }
}

/* ===== Delete fee ===== */
async function onDeleteFee(row) {
    if (!row.feeId) return;

    const { isConfirmed } = await confirmDialog('Xóa học phí?', `Xóa học phí của bé "${row.studentName}"?`);
    if (!isConfirmed) return;

    try {
        await deleteFee(row.feeId);
        swalToast.fire({ icon: 'success', title: 'Đã xóa' });
        await loadData();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e.message || 'Xóa thất bại' });
    }
}

/* ===== Fee detail ===== */
async function openDetailDialog(row) {
    if (!row.feeId) {
        swalToast.fire({ icon: 'info', title: 'Chưa có học phí' });
        return;
    }
    detailBaseRow.value = row;
    detailDialogVisible.value = true;
    detailLoading.value = true;
    detailData.value = { ...row, items: [] };

    try {
        const data = await fetchFeeDetail(row.feeId);
        if (data) detailData.value = data;
    } catch (e) {
        console.error(e);
    } finally {
        detailLoading.value = false;
    }
}

/* ===== Notification ===== */
function openNotifyDialog() {
    notifyDialogVisible.value = true;
    selectedNotifyStudentIds.value = notifyRows.value.map((r) => r.studentId);
}

function onSendNotification() {
    const count = selectedNotifyStudentIds.value.length;
    swalToast.fire({
        icon: 'success',
        title: `Đã gửi thông báo cho ${count} phụ huynh`
    });
    notifyDialogVisible.value = false;
}

/* ===== Init ===== */
async function init() {
    loadingInit.value = true;
    try {
        await Promise.all([loadClasses(), loadSemestersAndYears()]);
        applyRouteQueryDefaults();
        isReadyToReload.value = true;
        await loadData();
    } finally {
        loadingInit.value = false;
    }
}

watch([selectedClass, selectedMonth, selectedYear], () => {
    if (!isReadyToReload.value) return;
    first.value = 0;
    loadData();
});

onMounted(init);
</script>

<template>
    <div class="fee-page">
        <!-- Header -->
        <header class="page-header">
            <div class="header-info">
                <div class="header-icon">
                    <i class="fa-solid fa-piggy-bank"></i>
                </div>
                <div>
                    <h1 class="page-title">Quản lý học phí</h1>
                    <p class="page-desc">Theo dõi và thu học phí các bé</p>
                </div>
            </div>
            <div class="header-actions">
                <button class="btn btn-outline" @click="onExportExcel" title="Xuất Excel">
                    <i class="fa-solid fa-file-excel"></i>
                    <span>Xuất Excel</span>
                </button>
                <button class="btn btn-outline" @click="openNotifyDialog" title="Gửi thông báo">
                    <i class="fa-solid fa-bell"></i>
                    <span>Thông báo</span>
                </button>
                <button class="btn btn-primary" @click="openBulkDialog">
                    <i class="fa-solid fa-plus"></i>
                    <span>Tạo học phí</span>
                </button>
            </div>
        </header>

        <!-- Error message -->
        <div v-if="errorMessage" class="error-banner">
            <i class="fa-solid fa-circle-exclamation"></i>
            {{ errorMessage }}
        </div>

        <!-- Filter bar -->
        <div class="filter-bar">
            <div class="filter-group">
                <label>Lớp</label>
                <Dropdown v-model="selectedClass" :options="classes" optionLabel="name" placeholder="Chọn lớp" class="filter-dropdown" />
            </div>
            <div class="filter-group">
                <label>Tháng</label>
                <Dropdown v-model="selectedMonth" :options="months" optionLabel="label" optionValue="value" placeholder="Tháng" class="filter-dropdown" />
            </div>
            <div class="filter-group">
                <label>Năm</label>
                <Dropdown v-model="selectedYear" :options="years" placeholder="Năm" class="filter-dropdown" />
            </div>
            <div class="filter-group">
                <label>Trạng thái</label>
                <Dropdown
                    v-model="statusFilter"
                    :options="[
                        { label: 'Tất cả', value: 'ALL' },
                        { label: 'Chưa tạo', value: 'NOT_CREATED' },
                        { label: 'Chờ đóng', value: 'PENDING' },
                        { label: 'Quá hạn', value: 'OVERDUE' },
                        { label: 'Đóng một phần', value: 'PARTIAL' },
                        { label: 'Đã đóng đủ', value: 'PAID' }
                    ]"
                    optionLabel="label"
                    optionValue="value"
                    class="filter-dropdown"
                />
            </div>
            <div class="filter-group filter-search">
                <label>Tìm kiếm</label>
                <div class="search-input">
                    <i class="fa-solid fa-search"></i>
                    <InputText v-model="keyword" placeholder="Tên hoặc mã bé..." />
                </div>
            </div>
        </div>

        <!-- Summary cards -->
        <div v-if="summary" class="summary-section">
            <div class="summary-card summary-main">
                <div class="summary-header">
                    <span class="summary-label">{{ summary.className }}</span>
                    <span class="summary-period">Tháng {{ summary.semester }}/{{ summary.year }}</span>
                </div>
                <div class="summary-stats">
                    <div class="stat-item">
                        <span class="stat-value">{{ summary.totalStudents }}</span>
                        <span class="stat-label">Học sinh</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-value text-green-600">{{ summary.paidCount }}</span>
                        <span class="stat-label">Đã đóng</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-value text-amber-600">{{ summary.pendingCount }}</span>
                        <span class="stat-label">Chờ đóng</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-value text-red-500">{{ summary.overdueCount }}</span>
                        <span class="stat-label">Quá hạn</span>
                    </div>
                </div>
            </div>

            <div class="summary-card summary-money">
                <div class="money-row">
                    <span class="money-label">Tổng phải thu</span>
                    <span class="money-value">{{ formatCurrency(summary.totalAmount) }}</span>
                </div>
                <div class="money-row">
                    <span class="money-label">Đã thu</span>
                    <span class="money-value text-green-600">{{ formatCurrency(summary.totalPaid) }}</span>
                </div>
                <div class="money-row">
                    <span class="money-label">Còn lại</span>
                    <span class="money-value text-amber-600">{{ formatCurrency(summary.totalRemaining) }}</span>
                </div>
                <div class="progress-section">
                    <div class="progress-bar">
                        <div class="progress-fill" :style="{ width: collectionProgress + '%' }"></div>
                    </div>
                    <span class="progress-text">{{ collectionProgress }}% hoàn thành</span>
                </div>
            </div>
        </div>

        <!-- Data table -->
        <div class="table-container">
            <!-- Loading overlay -->
            <div v-if="loadingInit || loadingList" class="loading-overlay">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Đang tải dữ liệu...</span>
            </div>

            <table class="data-table">
                <thead>
                    <tr>
                        <th class="col-index">#</th>
                        <th class="col-student">Học sinh</th>
                        <th class="col-amount text-right">Học phí</th>
                        <th class="col-paid text-right">Đã đóng</th>
                        <th class="col-remaining text-right">Còn lại</th>
                        <th class="col-due">Hạn đóng</th>
                        <th class="col-status text-center">Trạng thái</th>
                        <th class="col-actions text-center">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in pagedRows" :key="row.studentId" class="data-row">
                        <td class="col-index">{{ row.index }}</td>
                        <td class="col-student">
                            <div class="student-info">
                                <div class="student-avatar">
                                    {{ (row.studentName || '?').charAt(0).toUpperCase() }}
                                </div>
                                <div class="student-details">
                                    <span class="student-name">{{ row.studentName }}</span>
                                    <span class="student-code">{{ row.studentCode || 'Chưa có mã' }}</span>
                                </div>
                            </div>
                        </td>
                        <td class="col-amount text-right">
                            <span class="amount-text">{{ formatCurrency(row.totalAmount) }}</span>
                        </td>
                        <td class="col-paid text-right">
                            <span class="amount-text text-green-600">
                                {{ row.paidAmount ? formatCurrency(row.paidAmount) : '—' }}
                            </span>
                        </td>
                        <td class="col-remaining text-right">
                            <span class="amount-text" :class="{ 'text-amber-600': row.remainingAmount > 0 }">
                                {{ row.feeId ? formatCurrency(row.remainingAmount ?? row.totalAmount - row.paidAmount) : '—' }}
                            </span>
                        </td>
                        <td class="col-due">
                            <div v-if="row.dueDate" class="due-info">
                                <span class="due-date">{{ formatDate(row.dueDate) }}</span>
                                <span
                                    v-if="getDaysRemaining(row.dueDate) !== null && row.status !== 'PAID'"
                                    class="due-remaining"
                                    :class="{
                                        'text-red-500': getDaysRemaining(row.dueDate) < 0,
                                        'text-amber-500': getDaysRemaining(row.dueDate) >= 0 && getDaysRemaining(row.dueDate) <= 3,
                                        'text-gray-400': getDaysRemaining(row.dueDate) > 3
                                    }"
                                >
                                    {{ getDaysRemaining(row.dueDate) < 0 ? `Quá ${Math.abs(getDaysRemaining(row.dueDate))} ngày` : getDaysRemaining(row.dueDate) === 0 ? 'Hôm nay' : `Còn ${getDaysRemaining(row.dueDate)} ngày` }}
                                </span>
                            </div>
                            <span v-else class="text-gray-400">—</span>
                        </td>
                        <td class="col-status text-center">
                            <span class="status-badge" :class="[statusConfig[row.status]?.bg, statusConfig[row.status]?.text_color]">
                                <i :class="['fa-solid', statusConfig[row.status]?.icon]"></i>
                                {{ statusConfig[row.status]?.text || row.status }}
                            </span>
                        </td>
                        <td class="col-actions">
                            <div class="action-buttons">
                                <button v-if="canPay(row)" class="action-btn action-pay" @click="openPayDialog(row)" title="Thu tiền">
                                    <i class="fa-solid fa-hand-holding-dollar"></i>
                                    <span>Thu tiền</span>
                                </button>
                                <button class="action-btn action-detail" @click="openDetailDialog(row)" :disabled="!row.feeId" title="Xem chi tiết">
                                    <i class="fa-solid fa-eye"></i>
                                </button>
                                <button class="action-btn action-edit" @click="openEditDialog(row)" :disabled="!canEdit(row)" title="Sửa">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                <button class="action-btn action-delete" @click="onDeleteFee(row)" :disabled="!canDelete(row)" title="Xóa">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>

                    <tr v-if="!loadingInit && !loadingList && !filteredRows.length">
                        <td colspan="8" class="empty-state">
                            <i class="fa-solid fa-folder-open"></i>
                            <span>Không có dữ liệu học phí</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div class="pagination-section" v-if="filteredRows.length > 0">
            <div class="pagination-info">
                Hiển thị
                {{ first + 1 }}
                -
                {{ Math.min(first + rowsPerPage, filteredRows.length) }}
                /
                {{ filteredRows.length }} bản ghi
            </div>
            <Paginator :rows="rowsPerPage" :totalRecords="filteredRows.length" :first="first" @page="onPageChange" :rowsPerPageOptions="[10, 20, 50]" />
        </div>

        <!-- Quick actions floating -->
        <button class="fab-button" @click="onUpdateOverdue" title="Cập nhật quá hạn">
            <i class="fa-solid fa-clock-rotate-left"></i>
        </button>

        <!-- Dialog: Bulk fee -->
        <Dialog v-model:visible="bulkDialogVisible" modal :style="{ width: '420px' }" header="Tạo học phí cho cả lớp" :draggable="false">
            <div class="dialog-content">
                <div class="dialog-info-box">
                    <i class="fa-solid fa-info-circle"></i>
                    <span>
                        Tạo học phí tháng <b>{{ selectedMonth }}/{{ selectedYear }}</b>
                        cho lớp
                        <b>{{ selectedClass?.name }}</b>
                    </span>
                </div>

                <div class="form-group">
                    <label class="form-label">
                        Số tiền mỗi học sinh
                        <span class="required">*</span>
                    </label>
                    <InputNumber v-model="bulkAmount" :min="0" mode="decimal" :useGrouping="true" suffix=" đ" class="w-full" placeholder="Nhập số tiền..." />
                </div>

                <div class="form-group">
                    <label class="form-label">
                        Hạn đóng
                        <span class="required">*</span>
                    </label>
                    <Calendar v-model="bulkDueDate" showIcon dateFormat="dd/mm/yy" class="w-full" placeholder="Chọn ngày..." />
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <button class="btn btn-ghost" @click="bulkDialogVisible = false">Hủy</button>
                    <button class="btn btn-primary" @click="confirmBulkCreate">
                        <i class="fa-solid fa-check"></i>
                        Tạo học phí
                    </button>
                </div>
            </template>
        </Dialog>

        <!-- Dialog: Payment -->
        <Dialog v-model:visible="payDialogVisible" modal :style="{ width: '450px' }" header="Thu học phí" :draggable="false">
            <div v-if="payTarget" class="dialog-content">
                <div class="student-card">
                    <div class="student-avatar large">
                        {{ (payTarget.studentName || '?').charAt(0).toUpperCase() }}
                    </div>
                    <div class="student-info-text">
                        <span class="name">{{ payTarget.studentName }}</span>
                        <span class="meta">{{ payTarget.studentCode }} • {{ payTarget.className }}</span>
                    </div>
                </div>

                <div class="payment-summary">
                    <div class="summary-row">
                        <span>Tổng học phí:</span>
                        <span class="value">{{ formatCurrency(payTarget.totalAmount) }}</span>
                    </div>
                    <div class="summary-row">
                        <span>Đã đóng:</span>
                        <span class="value text-green-600">{{ formatCurrency(payTarget.paidAmount) }}</span>
                    </div>
                    <div class="summary-row highlight">
                        <span>Còn lại:</span>
                        <span class="value text-amber-600">
                            {{ formatCurrency(payTarget.remainingAmount ?? payTarget.totalAmount - payTarget.paidAmount) }}
                        </span>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">
                        Số tiền thu
                        <span class="required">*</span>
                    </label>
                    <InputNumber v-model="payAmount" :min="0" mode="decimal" :useGrouping="true" suffix=" đ" class="w-full" />
                </div>

                <div class="form-row">
                    <div class="form-group flex-1">
                        <label class="form-label">
                            Ngày thu
                            <span class="required">*</span>
                        </label>
                        <Calendar v-model="payDate" showIcon dateFormat="dd/mm/yy" class="w-full" />
                    </div>
                    <div class="form-group flex-1">
                        <label class="form-label">Hình thức</label>
                        <Dropdown v-model="payMethod" :options="['Tiền mặt', 'Chuyển khoản']" class="w-full" />
                    </div>
                </div>

                <div v-if="payMethod === 'Chuyển khoản'" class="form-group">
                    <label class="form-label">
                        Mã giao dịch
                        <span class="required">*</span>
                    </label>
                    <InputText v-model="payTransactionCode" class="w-full" placeholder="Nhập mã giao dịch..." />
                </div>

                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <InputText v-model="payNote" class="w-full" placeholder="Ghi chú thêm..." />
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <button class="btn btn-ghost" @click="payDialogVisible = false">Hủy</button>
                    <button class="btn btn-success" @click="confirmPayment">
                        <i class="fa-solid fa-check"></i>
                        Xác nhận thu
                    </button>
                </div>
            </template>
        </Dialog>

        <!-- Dialog: Edit fee -->
        <Dialog v-model:visible="editDialogVisible" modal :style="{ width: '420px' }" header="Sửa thông tin học phí" :draggable="false">
            <div v-if="editTarget" class="dialog-content">
                <div class="student-card small">
                    <div class="student-avatar">
                        {{ (editTarget.studentName || '?').charAt(0).toUpperCase() }}
                    </div>
                    <div class="student-info-text">
                        <span class="name">{{ editTarget.studentName }}</span>
                        <span class="meta">{{ editTarget.className }}</span>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">
                        Tổng học phí
                        <span class="required">*</span>
                    </label>
                    <InputNumber v-model="editAmount" :min="0" mode="decimal" :useGrouping="true" suffix=" đ" class="w-full" />
                </div>

                <div class="form-group">
                    <label class="form-label">Hạn đóng</label>
                    <Calendar v-model="editDueDate" showIcon dateFormat="dd/mm/yy" class="w-full" />
                </div>

                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <InputText v-model="editNote" class="w-full" placeholder="Ghi chú..." />
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <button class="btn btn-ghost" @click="editDialogVisible = false">Hủy</button>
                    <button class="btn btn-primary" @click="confirmUpdateFee">
                        <i class="fa-solid fa-save"></i>
                        Lưu thay đổi
                    </button>
                </div>
            </template>
        </Dialog>

        <!-- Dialog: Fee detail -->
        <Dialog v-model:visible="detailDialogVisible" modal :style="{ width: '600px', maxWidth: '95vw' }" header="Chi tiết học phí" :draggable="false">
            <div v-if="detailLoading" class="loading-state">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Đang tải...</span>
            </div>

            <div v-else-if="detailData" class="dialog-content">
                <div class="detail-header">
                    <div class="student-card">
                        <div class="student-avatar large">
                            {{ (detailData.studentName || detailBaseRow?.studentName || '?').charAt(0).toUpperCase() }}
                        </div>
                        <div class="student-info-text">
                            <span class="name">{{ detailData.studentName || detailBaseRow?.studentName }}</span>
                            <span class="meta">
                                {{ detailData.studentCode || detailBaseRow?.studentCode || '—' }}
                                •
                                {{ detailData.className || detailBaseRow?.className || selectedClass?.name }}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="detail-summary">
                    <div class="detail-row">
                        <span class="label">Tổng học phí</span>
                        <span class="value">
                            {{ formatCurrency(detailData.totalAmount ?? detailBaseRow?.totalAmount) }}
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Đã đóng</span>
                        <span class="value text-green-600">
                            {{ formatCurrency(detailData.paidAmount ?? detailBaseRow?.paidAmount) }}
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Còn lại</span>
                        <span class="value text-amber-600">
                            {{ formatCurrency(detailData.remainingAmount ?? detailBaseRow?.remainingAmount) }}
                        </span>
                    </div>
                    <div v-if="detailData.previousDebt != null" class="detail-row">
                        <span class="label">Nợ tháng trước</span>
                        <span class="value text-red-500">
                            {{ formatCurrency(detailData.previousDebt) }}
                        </span>
                    </div>
                </div>

                <div v-if="detailData.items?.length" class="detail-items">
                    <h4 class="items-title">Chi tiết các khoản thu</h4>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Khoản thu</th>
                                <th class="text-right">Số tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(item, idx) in detailData.items" :key="idx">
                                <td>{{ idx + 1 }}</td>
                                <td>{{ item.name || item.feeName }}</td>
                                <td class="text-right">{{ formatCurrency(item.amount) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div v-else class="no-items">
                    <i class="fa-solid fa-receipt"></i>
                    <span>Chưa có chi tiết khoản thu</span>
                </div>
            </div>
        </Dialog>

        <!-- Dialog: Notification -->
        <Dialog v-model:visible="notifyDialogVisible" modal :style="{ width: '550px' }" header="Gửi thông báo học phí" :draggable="false">
            <div class="dialog-content">
                <div class="dialog-info-box">
                    <i class="fa-solid fa-bell"></i>
                    <span>
                        Gửi thông báo cho lớp
                        <b>{{ selectedClass?.name }}</b>
                        - Tháng {{ selectedMonth }}/{{ selectedYear }}
                    </span>
                </div>

                <div class="notify-options">
                    <label class="checkbox-item">
                        <Checkbox v-model="notifySendViaApp" :binary="true" />
                        <span>Gửi qua ứng dụng</span>
                    </label>
                    <label class="checkbox-item disabled">
                        <Checkbox v-model="notifySendViaEmail" :binary="true" disabled />
                        <span>Gửi email (chưa hỗ trợ)</span>
                    </label>
                </div>

                <div class="notify-filter">
                    <label class="checkbox-item">
                        <Checkbox v-model="notifyOnlyNotPaid" :binary="true" />
                        <span>Chỉ gửi cho phụ huynh chưa đóng đủ</span>
                    </label>
                </div>

                <div class="notify-list">
                    <div class="list-header">
                        <label class="checkbox-item">
                            <Checkbox v-model="allNotifyChecked" :binary="true" />
                            <span>Chọn tất cả ({{ notifyRows.length }} học sinh)</span>
                        </label>
                    </div>
                    <div class="list-body">
                        <div v-for="row in notifyRows" :key="row.studentId" class="notify-row" @click="toggleNotifyRow(row)">
                            <Checkbox :modelValue="selectedNotifyStudentIds.includes(row.studentId)" :binary="true" @change="toggleNotifyRow(row)" />
                            <span class="row-name">{{ row.studentName }}</span>
                            <span class="row-status" :class="[statusConfig[row.status]?.bg, statusConfig[row.status]?.text_color]">
                                {{ statusConfig[row.status]?.text }}
                            </span>
                        </div>
                        <div v-if="!notifyRows.length" class="empty-list">Không có học sinh nào để gửi thông báo</div>
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <button class="btn btn-ghost" @click="notifyDialogVisible = false">Hủy</button>
                    <button class="btn btn-primary" @click="onSendNotification" :disabled="!selectedNotifyStudentIds.length">
                        <i class="fa-solid fa-paper-plane"></i>
                        Gửi thông báo ({{ selectedNotifyStudentIds.length }})
                    </button>
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* ===== Base ===== */
.fee-page {
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    background: #f8fafc;
    min-height: 100vh;
}

/* ===== Header ===== */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.header-info {
    display: flex;
    align-items: center;
    gap: 0.875rem;
}

.header-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.25rem;
}

.page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
}

.page-desc {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
}

.header-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

/* ===== Buttons ===== */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
}

.btn i {
    font-size: 0.875rem;
}

.btn-primary {
    background: #10b981;
    color: white;
}

.btn-primary:hover {
    background: #059669;
}

.btn-success {
    background: #10b981;
    color: white;
}

.btn-success:hover {
    background: #059669;
}

.btn-outline {
    background: white;
    color: #475569;
    border: 1px solid #e2e8f0;
}

.btn-outline:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
}

.btn-ghost {
    background: transparent;
    color: #64748b;
}

.btn-ghost:hover {
    background: #f1f5f9;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* ===== Error banner ===== */
.error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
}

/* ===== Filter bar ===== */
.filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 1rem;
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    margin-bottom: 1.5rem;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 140px;
}

.filter-group label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.025em;
}

.filter-dropdown {
    min-width: 140px;
}

.filter-search {
    flex: 1;
    min-width: 200px;
}

.search-input {
    position: relative;
}

.search-input i {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    font-size: 0.875rem;
}

.search-input input {
    padding-left: 2.25rem !important;
    width: 100%;
}

/* ===== Summary section ===== */
.summary-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
}

@media (max-width: 768px) {
    .summary-section {
        grid-template-columns: 1fr;
    }
}

.summary-card {
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    padding: 1.25rem;
}

.summary-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.summary-label {
    font-weight: 600;
    color: #1e293b;
    font-size: 1rem;
}

.summary-period {
    font-size: 0.875rem;
    color: #64748b;
    background: #f1f5f9;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
}

.summary-stats {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
}

.stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
}

.stat-label {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.25rem;
}

.stat-divider {
    width: 1px;
    height: 40px;
    background: #e2e8f0;
}

.money-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f1f5f9;
}

.money-row:last-of-type {
    border-bottom: none;
}

.money-label {
    color: #64748b;
    font-size: 0.875rem;
}

.money-value {
    font-weight: 600;
    color: #1e293b;
}

.progress-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #f1f5f9;
}

.progress-bar {
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
    border-radius: 4px;
    transition: width 0.3s ease;
}

.progress-text {
    display: block;
    text-align: right;
    font-size: 0.75rem;
    color: #10b981;
    font-weight: 500;
    margin-top: 0.375rem;
}

/* ===== Table ===== */
.table-container {
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    position: relative;
}

.loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(248, 250, 252, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    z-index: 10;
    font-size: 0.875rem;
    color: #475569;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
}

.data-table thead {
    background: #f8fafc;
}

.data-table th,
.data-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e2e8f0;
}

.data-table th {
    text-align: left;
    font-weight: 600;
    color: #64748b;
    white-space: nowrap;
}

.data-table tbody tr:hover {
    background: #f9fafb;
}

.col-index {
    width: 40px;
}

.col-actions {
    width: 260px;
}

.text-center {
    text-align: center;
}

.text-right {
    text-align: right;
}

.student-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.student-avatar {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: #e0f2fe;
    color: #0284c7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
}

.student-details {
    display: flex;
    flex-direction: column;
}

.student-name {
    font-weight: 500;
    color: #0f172a;
}

.student-code {
    font-size: 0.75rem;
    color: #94a3b8;
}

.amount-text {
    font-variant-numeric: tabular-nums;
}

.due-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
}

.due-date {
    font-size: 0.875rem;
    color: #0f172a;
}

.due-remaining {
    font-size: 0.75rem;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
}

.status-badge i {
    font-size: 0.75rem;
}

.action-buttons {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.35rem 0.6rem;
    border-radius: 999px;
    border: 1px solid #e2e8f0;
    background: white;
    font-size: 0.75rem;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s;
}

.action-btn i {
    font-size: 0.75rem;
}

.action-btn:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
}

.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.action-pay {
    border-color: #bbf7d0;
    color: #15803d;
}

.action-pay:hover {
    background: #ecfdf3;
    border-color: #22c55e;
}

.action-delete {
    border-color: #fecaca;
    color: #b91c1c;
}

.action-delete:hover {
    background: #fef2f2;
    border-color: #ef4444;
}

.empty-state {
    text-align: center;
    padding: 2rem 1rem;
    font-size: 0.875rem;
    color: #94a3b8;
}

.empty-state i {
    display: block;
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
}

/* ===== Pagination ===== */
.pagination-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.75rem;
}

.pagination-info {
    font-size: 0.875rem;
    color: #64748b;
}

/* ===== Floating button ===== */
.fab-button {
    position: fixed;
    right: 1.5rem;
    bottom: 1.5rem;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    border: none;
    background: #0ea5e9;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25);
    cursor: pointer;
    transition:
        transform 0.15s,
        box-shadow 0.15s,
        background 0.15s;
    z-index: 20;
}

.fab-button:hover {
    transform: translateY(-2px);
    background: #0284c7;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.3);
}

/* ===== Dialogs ===== */
.dialog-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.dialog-info-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    background: #eff6ff;
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
    color: #1d4ed8;
}

.dialog-info-box i {
    font-size: 0.875rem;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
}

/* ===== Form ===== */
.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.form-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #4b5563;
}

.required {
    color: #dc2626;
}

.form-row {
    display: flex;
    gap: 0.75rem;
}

.flex-1 {
    flex: 1;
}

/* ===== Student card in dialogs ===== */
.student-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 12px;
}

.student-card.small {
    padding: 0.5rem 0.75rem;
}

.student-avatar.large {
    width: 40px;
    height: 40px;
    font-size: 1rem;
}

.student-info-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
}

.student-info-text .name {
    font-weight: 600;
    color: #0f172a;
}

.student-info-text .meta {
    font-size: 0.75rem;
    color: #94a3b8;
}

/* ===== Payment summary ===== */
.payment-summary {
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    padding: 0.75rem 0.75rem 0.25rem;
    margin-bottom: 0.25rem;
}

.summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8125rem;
    padding: 0.25rem 0;
}

.summary-row.highlight {
    border-top: 1px dashed #e5e7eb;
    margin-top: 0.25rem;
    padding-top: 0.4rem;
}

/* ===== Detail dialog ===== */
.detail-header {
    margin-bottom: 0.75rem;
}

.detail-summary {
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
    background: #f9fafb;
}

.detail-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.8125rem;
    padding: 0.25rem 0;
}

.detail-row .label {
    color: #6b7280;
}

.detail-row .value {
    font-weight: 500;
    color: #111827;
}

.detail-items {
    margin-top: 0.5rem;
}

.items-title {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
}

.items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
}

.items-table th,
.items-table td {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid #e5e7eb;
}

.items-table th {
    text-align: left;
    color: #6b7280;
}

.no-items {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: #9ca3af;
    padding: 0.75rem 0;
}

.no-items i {
    font-size: 1.2rem;
}

/* ===== Loading state in dialogs ===== */
.loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.25rem 0;
    color: #64748b;
    font-size: 0.875rem;
}

/* ===== Notification dialog ===== */
.notify-options,
.notify-filter {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.checkbox-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #374151;
}

.checkbox-item.disabled {
    color: #9ca3af;
}

.notify-list {
    margin-top: 0.75rem;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
}

.list-header {
    padding: 0.5rem 0.75rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
}

.list-body {
    max-height: 260px;
    overflow: auto;
}

.notify-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.75rem;
    font-size: 0.875rem;
    cursor: pointer;
}

.notify-row:hover {
    background: #f9fafb;
}

.row-name {
    flex: 1;
}

.row-status {
    font-size: 0.75rem;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
}

.empty-list {
    text-align: center;
    padding: 0.75rem;
    font-size: 0.875rem;
    color: #9ca3af;
}
</style>
