<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import Paginator from 'primevue/paginator';
import Checkbox from 'primevue/checkbox';

import Swal from 'sweetalert2';

import { fetchClassOptions } from '@/service/classService.js';
import { fetchStudentsByClass } from '@/service/studentService.js';
import { fetchFeesByClassAndSemesterYear, fetchFeeSummary, fetchAvailableYears, createBulkFees, downloadFeeTemplate, createFeesFromExcel, payFee, fetchFeeDetail, deleteFee, updateOverdueFees } from '@/service/fee.js';

import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser } from '@/service/authService.js';

/* ===== Auth ===== */
const auth = useAuthStore();
const currentUser = computed(() => getUsernameFromUser(auth?.user) || 'system');

/* ===== Route – nhận classId/month/year từ màn Đợt thu ===== */
const route = useRoute();

/* ===== Data filter / combobox ===== */
const classes = ref([]);
const months = ref(
    Array.from({ length: 12 }, (_, i) => ({
        label: `Tháng ${i + 1}`,
        value: i + 1
    }))
);
const years = ref([]);

const selectedClass = ref(null);
const selectedMonth = ref(new Date().getMonth() + 1); // 1–12
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
const isReadyToReload = ref(false); // để tránh loadData 2 lần khi init

/* ===== Dialog: bulk fee ===== */
const bulkDialogVisible = ref(false);
const bulkAmount = ref(null);
const bulkDueDate = ref(null);

/* ===== Dialog: import Excel ===== */
const importDialogVisible = ref(false);
const importFile = ref(null);
const importing = ref(false);
const isDragOver = ref(false);

/* ===== Dialog: payment ===== */
const payDialogVisible = ref(false);
const payTarget = ref(null);
const payAmount = ref(null);
const payDate = ref(new Date());
const payMethod = ref('Tiền mặt'); // Dropdown: Tiền mặt / Chuyển khoản
const payTransactionCode = ref('');
const payNote = ref('');

/* ===== Dialog: notification ===== */
const notifyDialogVisible = ref(false);
const notifyType = ref('FEE');
const notifySendViaApp = ref(true);
const notifySendViaEmail = ref(false);
const notifyOnlyNotPaid = ref(true);
const selectedNotifyStudentIds = ref([]);

/* ===== Dialog: Fee detail ===== */
const detailDialogVisible = ref(false);
const detailLoading = ref(false);
const detailData = ref(null);
const detailBaseRow = ref(null);

/* ===== SweetAlert Toast ===== */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true
});

function confirmDialog(title, text) {
    return Swal.fire({
        title,
        text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xác nhận',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        reverseButtons: true
    });
}

/* ===== Status view mapping ===== */
const statusView = {
    NOT_CREATED: { text: 'Chưa tạo', class: 'bg-slate-300 text-slate-800' },
    PENDING: { text: 'Chờ đóng', class: 'bg-amber-500 text-white' },
    OVERDUE: { text: 'Quá hạn', class: 'bg-red-500 text-white' },
    PARTIAL: { text: 'Đóng một phần', class: 'bg-sky-500 text-white' },
    PAID: { text: 'Đã đóng', class: 'bg-emerald-500 text-white' },
    WAITING_VERIFICATION: { text: 'Chờ xác nhận', class: 'bg-teal-500 text-white' },
    VERIFIED: { text: 'Đã xác nhận', class: 'bg-emerald-600 text-white' },
    REJECTED: { text: 'Từ chối', class: 'bg-rose-500 text-white' }
};

/* ===== Utils ===== */
function formatCurrency(amount) {
    if (amount == null) return '—';
    return new Intl.NumberFormat('vi-VN').format(Number(amount));
}

function formatDate(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN');
}

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
                className: s.className || (selectedClass.value && selectedClass.value.name) || '',
                feeId: fee?.id || null,
                totalAmount: fee?.totalAmount ?? null,
                paidAmount: fee?.paidAmount ?? null,
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
            className: f.className || (selectedClass.value && selectedClass.value.name) || '',
            feeId: f.id,
            totalAmount: f.totalAmount ?? null,
            paidAmount: f.paidAmount ?? null,
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

/* ===== Filter + phân trang ===== */
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

/* ===== Logic cho thao tác ===== */
function canPay(row) {
    if (!row.feeId) return false;
    const s = row.status;
    return ['PENDING', 'OVERDUE', 'PARTIAL', 'WAITING_VERIFICATION', 'REJECTED'].includes(s);
}

function canDelete(row) {
    return !!row.feeId;
}

/* ===== Dữ liệu cho modal Thông báo ===== */
const notifyRows = computed(() => mergedRows.value.filter((r) => r.feeId));

const allNotifyChecked = computed({
    get() {
        return notifyRows.value.length > 0 && selectedNotifyStudentIds.value.length === notifyRows.value.length;
    },
    set(val) {
        if (val) {
            selectedNotifyStudentIds.value = notifyRows.value.map((r) => r.studentId);
        } else {
            selectedNotifyStudentIds.value = [];
        }
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

/* Chỉ lấy danh sách năm, tháng là cố định 1–12 */
async function loadSemestersAndYears() {
    try {
        const yrs = await fetchAvailableYears();

        years.value = yrs && yrs.length ? yrs : [new Date().getFullYear()];

        if (!selectedYear.value && years.value.length) {
            selectedYear.value = years.value[0];
        }

        if (!selectedMonth.value) {
            selectedMonth.value = new Date().getMonth() + 1;
        }
    } catch (e) {
        console.error(e);
        years.value = [new Date().getFullYear()];
        if (!selectedYear.value) selectedYear.value = years.value[0];
        if (!selectedMonth.value) selectedMonth.value = new Date().getMonth() + 1;
    }
}

/* Đọc query từ router, gán lại bộ lọc nếu có
   /fees?classId=90003&month=1&year=2024  (vẫn hỗ trợ semester=1 cho tương thích) */
function applyRouteQueryDefaults() {
    const q = route.query || {};

    // Hỗ trợ cả ?month= và ?semester=
    const monthParam = q.month || q.semester;
    if (monthParam != null) {
        const m = Number(monthParam);
        if (!Number.isNaN(m) && m >= 1 && m <= 12) {
            selectedMonth.value = m;
        }
    }

    if (q.year) {
        const yr = years.value.find((y) => String(y) === String(q.year));
        if (yr) selectedYear.value = yr;
    }

    if (q.classId) {
        const cid = String(q.classId);
        const cls = classes.value.find((c) => String(c.id) === cid);
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
                semester: selectedMonth.value, // 👈 gửi số tháng vào field semester
                year: selectedYear.value
            }),
            fetchFeeSummary({
                classId: selectedClass.value.id,
                semester: selectedMonth.value, // 👈
                year: selectedYear.value
            })
        ]);

        students.value = stu || [];
        fees.value = feeList || [];
        summary.value = sum || null;

        if (showToast) {
            swalToast.fire({
                icon: 'success',
                title: 'Đã tải dữ liệu học phí'
            });
        }
    } catch (e) {
        console.error(e);
        const msg = e.message || 'Không thể tải dữ liệu học phí';
        errorMessage.value = msg;
        swalToast.fire({ icon: 'error', title: msg });
    } finally {
        loadingList.value = false;
    }
}

/* ===== Pagination ===== */
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
        swalToast.fire({
            icon: 'info',
            title: 'Vui lòng nhập số tiền và hạn đóng'
        });
        return;
    }
    try {
        await createBulkFees({
            classId: selectedClass.value.id,
            semester: selectedMonth.value, // 👈 tạo theo tháng
            year: selectedYear.value,
            amount: bulkAmount.value,
            dueDate: bulkDueDate.value
        });
        bulkDialogVisible.value = false;
        swalToast.fire({ icon: 'success', title: 'Tạo học phí hàng loạt thành công' });
        await loadData();
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Không thể tạo học phí hàng loạt'
        });
    }
}

/* ===== Template & Import Excel ===== */
async function onDownloadTemplate() {
    try {
        const blob = await downloadFeeTemplate();
        const url = window.URL.createObjectURL(new Blob([blob]));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'template_hoc_phi.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Không tải được file mẫu'
        });
    }
}

function openImportDialog() {
    importDialogVisible.value = true;
    importFile.value = null;
    isDragOver.value = false;
}

function setImportFile(file) {
    if (!file) return;
    importFile.value = file;
    swalToast.fire({
        icon: 'info',
        title: `Đã chọn file: ${file.name}`
    });
}

function onFileChange(e) {
    const file = e.target.files?.[0];
    setImportFile(file);
}

function onDragOver(e) {
    e.preventDefault();
    isDragOver.value = true;
}

function onDragLeave(e) {
    e.preventDefault();
    isDragOver.value = false;
}

function onDropFile(e) {
    e.preventDefault();
    isDragOver.value = false;
    const file = e.dataTransfer?.files?.[0];
    setImportFile(file);
}

async function confirmImportExcel() {
    if (!importFile.value) {
        swalToast.fire({
            icon: 'info',
            title: 'Chưa chọn file Excel'
        });
        return;
    }
    importing.value = true;
    try {
        await createFeesFromExcel({
            file: importFile.value
        });
        importDialogVisible.value = false;
        swalToast.fire({ icon: 'success', title: 'Import học phí từ Excel thành công' });
        await loadData();
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Import thất bại'
        });
    } finally {
        importing.value = false;
    }
}

/* ===== Update overdue ===== */
async function onUpdateOverdue() {
    const { isConfirmed } = await confirmDialog('Cập nhật học phí quá hạn?', 'Hệ thống sẽ đánh dấu quá hạn cho các khoản học phí đã quá hạn thanh toán.');
    if (!isConfirmed) return;
    try {
        await updateOverdueFees();
        swalToast.fire({
            icon: 'success',
            title: 'Đã cập nhật học phí quá hạn'
        });
        await loadData();
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Không thể cập nhật học phí quá hạn'
        });
    }
}

/* ===== Payment dialog ===== */
function openPayDialog(row) {
    if (!row.feeId) {
        swalToast.fire({
            icon: 'info',
            title: 'Học sinh này chưa có bản ghi học phí'
        });
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
        swalToast.fire({
            icon: 'info',
            title: 'Vui lòng nhập đầy đủ thông tin thanh toán'
        });
        return;
    }

    if (payMethod.value === 'Chuyển khoản' && !payTransactionCode.value.trim()) {
        swalToast.fire({
            icon: 'info',
            title: 'Vui lòng nhập mã giao dịch khi chọn hình thức chuyển khoản'
        });
        return;
    }

    try {
        await payFee({
            feeId: payTarget.value.feeId,
            amount: payAmount.value,
            paymentDate: payDate.value,
            paymentMethod: payMethod.value,
            transactionCode: payTransactionCode.value || null,
            note: payNote.value,
            receivedBy: currentUser.value
        });
        payDialogVisible.value = false;
        swalToast.fire({
            icon: 'success',
            title: 'Thanh toán học phí thành công'
        });
        await loadData();
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Thanh toán thất bại'
        });
    }
}

/* ===== Delete fee ===== */
async function onDeleteFee(row) {
    if (!row.feeId) {
        swalToast.fire({
            icon: 'info',
            title: 'Không có bản ghi học phí để xóa'
        });
        return;
    }
    const { isConfirmed } = await confirmDialog('Xóa học phí?', `Bạn chắc chắn muốn xóa học phí của học sinh ${row.studentName}?`);
    if (!isConfirmed) return;

    try {
        await deleteFee(row.feeId);
        swalToast.fire({ icon: 'success', title: 'Đã xóa học phí' });
        await loadData();
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Không thể xóa học phí'
        });
    }
}

/* ===== Fee detail dialog ===== */
async function openDetailDialog(row) {
    if (!row.feeId) {
        swalToast.fire({
            icon: 'info',
            title: 'Học sinh này chưa có bản ghi học phí'
        });
        return;
    }
    detailBaseRow.value = row;
    detailDialogVisible.value = true;
    detailLoading.value = true;
    detailData.value = {
        // fallback hiển thị ngay, nếu API lỗi vẫn có dữ liệu cơ bản
        ...row,
        items: []
    };
    try {
        const data = await fetchFeeDetail(row.feeId);
        if (data) {
            detailData.value = data;
        }
    } catch (e) {
        console.error(e);
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Không thể tải chi tiết học phí (hiển thị dữ liệu cơ bản)'
        });
    } finally {
        detailLoading.value = false;
    }
}

/* ===== Notification dialog actions ===== */
function openNotifyDialog() {
    notifyDialogVisible.value = true;
    selectedNotifyStudentIds.value = notifyRows.value.filter((r) => r.status !== 'PAID').map((r) => r.studentId);
}

function onSendNotification() {
    const selected = notifyRows.value.filter((r) => selectedNotifyStudentIds.value.includes(r.studentId));
    console.log('Gửi thông báo học phí cho:', selected);

    swalToast.fire({
        icon: 'success',
        title: `Đã giả lập gửi thông báo cho ${selected.length} học sinh`
    });

    notifyDialogVisible.value = false;
}

/* ===== Init ===== */
async function init() {
    loadingInit.value = true;
    try {
        await Promise.all([loadClasses(), loadSemestersAndYears()]);
        applyRouteQueryDefaults(); // đọc query từ màn Đợt thu (classId, month, year)
        isReadyToReload.value = true;
        await loadData();
    } finally {
        loadingInit.value = false;
    }
}

/* Reload khi đổi class/month/year (sau khi init xong) */
watch([selectedClass, selectedMonth, selectedYear], () => {
    if (!isReadyToReload.value) return;
    first.value = 0;
    loadData();
});

onMounted(init);
</script>

<template>
    <div class="px-4 md:px-6 lg:px-10 py-6 space-y-5">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-money-check-dollar text-2xl text-primary"></i>
                <div>
                    <div class="text-2xl font-extrabold tracking-tight text-slate-800">Quản lý học phí</div>
                    <div class="text-slate-500 text-sm">Theo dõi, thu học phí và tổng hợp theo lớp – tháng – năm</div>
                </div>
            </div>

            <div class="flex flex-wrap gap-2">
                <Button class="btn-ghost" icon="fa-solid fa-file-arrow-down mr-2" label="Tải file mẫu Excel" @click="onDownloadTemplate" />
                <Button class="btn-ghost" icon="fa-solid fa-file-import mr-2" label="Import từ Excel" @click="openImportDialog" />
                <Button class="btn-ghost" icon="fa-regular fa-bell mr-2" label="Gửi TB" @click="openNotifyDialog" />
                <Button class="btn-ghost" icon="fa-solid fa-layer-group mr-2" label="Tạo học phí hàng loạt" @click="openBulkDialog" />
                <Button class="btn-primary" icon="fa-solid fa-clock-rotate-left mr-2" label="Cập nhật quá hạn" @click="onUpdateOverdue" />
            </div>
        </div>

        <!-- Thông báo lỗi -->
        <div v-if="errorMessage" class="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
            {{ errorMessage }}
        </div>

        <!-- Bộ lọc -->
        <Card class="card-soft ring-1 ring-slate-100">
            <template #content>
                <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                        <label class="label">Lớp học</label>
                        <Dropdown v-model="selectedClass" :options="classes" optionLabel="name" class="w-full" placeholder="Chọn lớp" />
                    </div>
                    <div>
                        <label class="label">Tháng</label>
                        <Dropdown v-model="selectedMonth" :options="months" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn tháng" />
                    </div>
                    <div>
                        <label class="label">Năm</label>
                        <Dropdown v-model="selectedYear" :options="years" class="w-full" placeholder="Chọn năm" />
                    </div>
                    <div>
                        <label class="label">Trạng thái</label>
                        <Dropdown
                            v-model="statusFilter"
                            :options="[
                                { label: 'Tất cả', value: 'ALL' },
                                { label: 'Chưa tạo', value: 'NOT_CREATED' },
                                { label: 'Chờ đóng', value: 'PENDING' },
                                { label: 'Quá hạn', value: 'OVERDUE' },
                                { label: 'Đóng một phần', value: 'PARTIAL' },
                                { label: 'Đã đóng', value: 'PAID' }
                            ]"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                        />
                    </div>
                    <div>
                        <label class="label">Tìm học sinh</label>
                        <InputText v-model="keyword" placeholder="Tên hoặc mã học sinh..." class="w-full" />
                    </div>
                </div>
            </template>
        </Card>

        <!-- Tổng quan -->
        <div v-if="summary" class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card class="card-soft ring-1 ring-slate-100">
                <template #content>
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">Tổng quan</div>
                            <div class="text-lg font-bold text-slate-800 mt-1">{{ summary.className }} • Tháng {{ summary.semester }} / {{ summary.year }}</div>
                            <div class="text-xs text-slate-500 mt-1">Tổng {{ summary.totalStudents }} học sinh</div>
                        </div>
                        <i class="fa-solid fa-users text-3xl text-primary/70"></i>
                    </div>
                </template>
            </Card>
            <Card class="card-soft ring-1 ring-slate-100">
                <template #content>
                    <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">Tình trạng thanh toán</div>
                    <div class="mt-2 space-y-1 text-sm">
                        <div>
                            Đã đóng: <b>{{ summary.paidCount }}</b>
                        </div>
                        <div>
                            Chờ đóng: <b>{{ summary.pendingCount }}</b>
                        </div>
                        <div>
                            Quá hạn: <b class="text-red-600">{{ summary.overdueCount }}</b>
                        </div>
                        <div>
                            Đóng một phần: <b>{{ summary.partialCount }}</b>
                        </div>
                    </div>
                </template>
            </Card>
            <Card class="card-soft ring-1 ring-slate-100">
                <template #content>
                    <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">Số tiền</div>
                    <div class="mt-2 space-y-1 text-sm">
                        <div>
                            Tổng phải thu:
                            <b>{{ formatCurrency(summary.totalAmount) }}</b>
                        </div>
                        <div>
                            Đã thu:
                            <b class="text-emerald-600">
                                {{ formatCurrency(summary.totalPaid) }}
                            </b>
                        </div>
                        <div>
                            Còn lại:
                            <b class="text-amber-600">
                                {{ formatCurrency(summary.totalRemaining) }}
                            </b>
                        </div>
                    </div>
                </template>
            </Card>
        </div>

        <!-- Bảng dữ liệu -->
        <div class="overflow-x-auto rounded-2xl ring-1 ring-slate-200 bg-white relative">
            <div v-if="loadingInit || loadingList" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm">
                <i class="fa-solid fa-spinner fa-spin mr-2"></i>
                Đang tải dữ liệu học phí...
            </div>

            <table class="min-w-full text-sm">
                <thead class="bg-slate-50 border-b text-slate-600">
                    <tr>
                        <th class="th w-12">STT</th>
                        <th class="th min-w-[120px]">Mã HS</th>
                        <th class="th min-w-[180px]">Học sinh</th>
                        <th class="th min-w-[140px]">Lớp</th>
                        <th class="th min-w-[140px] text-right">Tổng học phí</th>
                        <th class="th min-w-[140px] text-right">Đã đóng</th>
                        <th class="th min-w-[140px] text-right">Còn lại</th>
                        <th class="th min-w-[130px]">Hạn đóng</th>
                        <th class="th min-w-[130px]">Ngày đóng</th>
                        <th class="th min-w-[130px] text-center">Trạng thái</th>
                        <th class="th min-w-[190px] text-center">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in pagedRows" :key="row.studentId" class="border-b last:border-0 hover:bg-slate-50">
                        <td class="td">{{ row.index }}</td>
                        <td class="td">{{ row.studentCode || '—' }}</td>
                        <td class="td font-medium text-slate-800">
                            {{ row.studentName }}
                        </td>
                        <td class="td">{{ row.className }}</td>
                        <td class="td text-right">{{ formatCurrency(row.totalAmount) }}</td>
                        <td class="td text-right">{{ formatCurrency(row.paidAmount) }}</td>
                        <td class="td text-right">
                            {{ row.feeId ? formatCurrency(row.remainingAmount ?? row.totalAmount - row.paidAmount) : '—' }}
                        </td>
                        <td class="td">
                            {{ row.dueDate ? formatDate(row.dueDate) : '—' }}
                        </td>
                        <td class="td">
                            {{ row.paidDate ? formatDate(row.paidDate) : '—' }}
                        </td>
                        <td class="td text-center">
                            <span class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold" :class="statusView[row.status]?.class || 'bg-slate-300 text-slate-800'">
                                {{ statusView[row.status]?.text || row.status || 'Không xác định' }}
                            </span>
                        </td>
                        <td class="td text-center">
                            <div class="flex flex-col gap-1 items-stretch">
                                <Button class="btn-success text-xs" label="Thu tiền" @click.stop="openPayDialog(row)" :disabled="!canPay(row)" />
                                <Button class="btn-ghost text-xs" label="Chi tiết" @click.stop="openDetailDialog(row)" :disabled="!row.feeId" />
                                <Button class="btn-ghost text-xs !text-red-600" label="Xóa bản ghi" @click.stop="onDeleteFee(row)" :disabled="!canDelete(row)" />
                            </div>
                        </td>
                    </tr>

                    <tr v-if="!loadingInit && !loadingList && !filteredRows.length">
                        <td colspan="11" class="px-3 py-4 text-center text-slate-500">Không có dữ liệu học phí cho bộ lọc hiện tại.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div class="flex justify-end">
            <Paginator :rows="rowsPerPage" :totalRecords="filteredRows.length" :first="first" @page="onPageChange" class="mt-3" />
        </div>

        <!-- Dialog: Bulk fee -->
        <Dialog v-model:visible="bulkDialogVisible" modal :style="{ width: '480px' }" header="Tạo học phí hàng loạt">
            <div class="space-y-4">
                <div class="text-sm text-slate-700">
                    Lớp:
                    <b>{{ selectedClass?.name }}</b>
                    • Tháng:
                    <b>{{ selectedMonth }}</b> /
                    <b>{{ selectedYear }}</b>
                </div>
                <div class="space-y-3">
                    <div>
                        <label class="label">Số tiền mỗi học sinh</label>
                        <InputNumber v-model="bulkAmount" :min="0" mode="decimal" :useGrouping="true" class="w-full" />
                    </div>
                    <div>
                        <label class="label">Hạn đóng</label>
                        <Calendar v-model="bulkDueDate" showIcon dateFormat="dd/mm/yy" class="w-full" />
                    </div>
                    <div class="text-xs text-slate-500">
                        Hệ thống sẽ tạo một bản ghi học phí
                        <b>PENDING</b> cho tất cả học sinh chưa có học phí trong lớp ở <b>tháng {{ selectedMonth }}/{{ selectedYear }}</b
                        >.
                    </div>
                </div>
                <div class="flex justify-end gap-2">
                    <Button label="Hủy" class="btn-ghost text-xs" @click="bulkDialogVisible = false" />
                    <Button label="Tạo học phí" class="btn-success text-xs" @click="confirmBulkCreate" />
                </div>
            </div>
        </Dialog>

        <!-- Dialog: Import Excel -->
        <Dialog v-model:visible="importDialogVisible" modal :style="{ width: '560px' }" header="Nhập danh sách học phí">
            <div class="space-y-4">
                <div class="import-dropzone" :class="{ 'import-dropzone--active': isDragOver }" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @drop.prevent="onDropFile">
                    <div class="flex flex-col items-center justify-center gap-2 text-center">
                        <i class="fa-solid fa-cloud-arrow-up text-3xl text-emerald-500"></i>
                        <div class="text-sm text-slate-700">
                            Kéo thả file Excel vào đây hoặc
                            <label class="text-emerald-600 font-semibold cursor-pointer">
                                chọn file từ hệ thống
                                <input type="file" accept=".xlsx,.xls" class="hidden" @change="onFileChange" />
                            </label>
                        </div>
                        <div class="text-xs text-slate-400">
                            {{ importFile ? importFile.name : 'Chưa chọn file' }}
                        </div>
                    </div>
                </div>

                <div>
                    <div class="text-xs text-slate-500 mb-1">Thứ tự cột bắt buộc (hàng đầu tiên là tiêu đề):</div>
                    <div class="text-xs px-3 py-2 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-slate-600">Mã Học Sinh, Họ Tên, Mã Lớp, Tên Lớp, Số Tiền (VNĐ), Ghi Chú</div>
                    <div class="mt-1 text-[11px] text-slate-400">Năm học, Học kỳ/Tháng và Hạn thanh toán được nhập ở phần "THÔNG TIN CHUNG" trong file (các ô B2, B3, B4).</div>
                </div>

                <div class="flex justify-between items-center pt-1">
                    <Button label="Đóng" class="btn-ghost text-xs" :disabled="importing" @click="importDialogVisible = false" />
                    <div class="flex gap-2">
                        <Button class="btn-ghost text-xs" icon="fa-solid fa-file-arrow-down mr-2" label="Tải mẫu Excel Import" :disabled="importing" @click="onDownloadTemplate" />
                        <Button class="btn-success text-xs" icon="fa-solid fa-cloud-arrow-up mr-2" :label="importing ? 'Đang tải lên...' : 'Tải lên'" :disabled="importing" @click="confirmImportExcel" />
                    </div>
                </div>
            </div>
        </Dialog>

        <!-- Dialog: Payment -->
        <Dialog v-model:visible="payDialogVisible" modal :style="{ width: '460px' }" header="Thanh toán học phí">
            <div v-if="payTarget" class="space-y-4">
                <div class="text-sm text-slate-700">
                    Học sinh:
                    <b>{{ payTarget.studentName }}</b>
                    <span class="text-xs text-slate-500"> ({{ payTarget.studentCode || 'không có mã' }}) </span>
                    <br />
                    Lớp:
                    <b>{{ payTarget.className }}</b>
                </div>

                <div class="space-y-3">
                    <div>
                        <label class="label">Số tiền thu</label>
                        <InputNumber v-model="payAmount" :min="0" mode="decimal" :useGrouping="true" class="w-full" />
                    </div>
                    <div>
                        <label class="label">Ngày thu</label>
                        <Calendar v-model="payDate" showIcon dateFormat="dd/mm/yy" class="w-full" />
                    </div>
                    <div>
                        <label class="label">Hình thức</label>
                        <Dropdown v-model="payMethod" :options="['Tiền mặt', 'Chuyển khoản']" class="w-full" placeholder="Chọn hình thức" />
                    </div>
                    <div>
                        <label class="label">Mã giao dịch (nếu chuyển khoản)</label>
                        <InputText v-model="payTransactionCode" class="w-full" />
                    </div>
                    <div>
                        <label class="label">Ghi chú</label>
                        <InputText v-model="payNote" class="w-full" />
                    </div>
                </div>

                <div class="flex justify-end gap-2">
                    <Button label="Hủy" class="btn-ghost text-xs" @click="payDialogVisible = false" />
                    <Button label="Xác nhận thu" class="btn-success text-xs" @click="confirmPayment" />
                </div>
            </div>
        </Dialog>

        <!-- Dialog: Fee detail -->
        <Dialog v-model:visible="detailDialogVisible" modal :style="{ width: '880px', maxWidth: '98vw' }" header="Chi tiết học phí">
            <div v-if="detailLoading" class="py-6 text-center text-slate-500 text-sm">
                <i class="fa-solid fa-spinner fa-spin mr-2"></i>
                Đang tải chi tiết học phí...
            </div>

            <div v-else-if="detailData" class="space-y-4 text-sm">
                <div class="grid md:grid-cols-2 gap-4">
                    <div class="border rounded-xl p-3 bg-slate-50">
                        <div class="font-semibold text-slate-700 mb-2">
                            {{ detailData.studentName || detailBaseRow?.studentName }}
                            <span class="text-xs text-slate-500"> ({{ detailData.studentCode || detailBaseRow?.studentCode || '—' }}) </span>
                        </div>
                        <div class="text-xs text-slate-600 space-y-1">
                            <div>
                                Lớp:
                                <b>
                                    {{ detailData.className || detailBaseRow?.className || selectedClass?.name }}
                                </b>
                            </div>
                            <div v-if="detailData.dateOfBirth">Ngày sinh: {{ formatDate(detailData.dateOfBirth) }}</div>
                            <div v-if="detailData.parentName">Phụ huynh: {{ detailData.parentName }}</div>
                            <div v-if="detailData.phone">SĐT: {{ detailData.phone }}</div>
                            <div v-if="detailData.email">Email: {{ detailData.email }}</div>
                        </div>
                    </div>

                    <div class="border rounded-xl p-3 bg-slate-50">
                        <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">Tổng hợp</div>
                        <div class="mt-2 space-y-1 text-sm">
                            <div>
                                Tổng tiền phải thu:
                                <b>
                                    {{ formatCurrency(detailData.totalAmount ?? detailBaseRow?.totalAmount) }}
                                </b>
                            </div>
                            <div>
                                Đã thu:
                                <b class="text-emerald-600">
                                    {{ formatCurrency(detailData.paidAmount ?? detailBaseRow?.paidAmount) }}
                                </b>
                            </div>
                            <div>
                                Còn lại:
                                <b class="text-amber-600">
                                    {{ formatCurrency(detailData.remainingAmount ?? detailBaseRow?.remainingAmount) }}
                                </b>
                            </div>
                            <div v-if="detailData.previousDebt != null">
                                Dư nợ tháng trước:
                                <b>{{ formatCurrency(detailData.previousDebt) }}</b>
                            </div>
                            <div v-if="detailData.refundedAmount != null">
                                Đã hoàn trả:
                                <b>{{ formatCurrency(detailData.refundedAmount) }}</b>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table class="min-w-full text-xs">
                        <thead class="bg-slate-50 text-slate-600">
                            <tr>
                                <th class="th w-10">#</th>
                                <th class="th">Khoản thu</th>
                                <th class="th text-right">Số tiền</th>
                                <th class="th">Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(item, idx) in detailData.items || []" :key="idx" class="border-t last:border-b-0">
                                <td class="td">{{ idx + 1 }}</td>
                                <td class="td">
                                    {{ item.name || item.feeName }}
                                </td>
                                <td class="td text-right">
                                    {{ formatCurrency(item.amount) }}
                                </td>
                                <td class="td">
                                    {{ item.note || '' }}
                                </td>
                            </tr>
                            <tr v-if="!(detailData.items && detailData.items.length)">
                                <td colspan="4" class="td text-center text-slate-500">Chưa có danh sách khoản thu chi tiết – đang hiển thị tổng số tiền.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </Dialog>

        <!-- Dialog: Notification -->
        <Dialog v-model:visible="notifyDialogVisible" modal :style="{ width: '620px' }" header="Gửi thông báo học phí">
            <div class="space-y-4 text-sm">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <div class="label text-[12px]">Loại thông báo</div>
                        <Dropdown v-model="notifyType" :options="[{ label: 'Thông báo học phí', value: 'FEE' }]" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                    <div>
                        <div class="label text-[12px]">Lớp</div>
                        <div class="px-3 py-[7px] rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">{{ selectedClass?.name || 'Chưa chọn lớp' }} • Tháng {{ selectedMonth }} / {{ selectedYear }}</div>
                    </div>
                </div>

                <div class="space-y-1">
                    <div class="label text-[12px]">Hình thức gửi tin</div>
                    <div class="flex flex-wrap gap-4">
                        <label class="flex items-center gap-2">
                            <Checkbox v-model="notifySendViaApp" :binary="true" />
                            <span>App / thông báo trong hệ thống</span>
                        </label>
                        <label class="flex items-center gap-2 text-slate-400">
                            <Checkbox v-model="notifySendViaEmail" :binary="true" disabled />
                            <span>Gửi email (chưa hỗ trợ)</span>
                        </label>
                    </div>
                </div>

                <div>
                    <label class="flex items-center gap-2 text-xs text-slate-700">
                        <Checkbox v-model="notifyOnlyNotPaid" :binary="true" />
                        <span>Chỉ gửi cho học sinh chưa đóng đủ học phí</span>
                    </label>
                </div>

                <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table class="min-w-full text-xs">
                        <thead class="bg-slate-50 text-slate-600">
                            <tr>
                                <th class="th w-10 text-center">
                                    <Checkbox v-model="allNotifyChecked" :binary="true" />
                                </th>
                                <th class="th text-left">Học sinh</th>
                                <th class="th text-left">Mã HS</th>
                                <th class="th text-left">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in notifyRows" :key="row.studentId" class="border-t last:border-b-0 hover:bg-slate-50/80">
                                <td class="td text-center">
                                    <Checkbox :modelValue="selectedNotifyStudentIds.includes(row.studentId)" :binary="true" @change="toggleNotifyRow(row)" />
                                </td>
                                <td class="td font-medium text-slate-800">
                                    {{ row.studentName }}
                                </td>
                                <td class="td">
                                    {{ row.studentCode || '—' }}
                                </td>
                                <td class="td">
                                    <span class="inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-semibold" :class="statusView[row.status]?.class || 'bg-slate-300 text-slate-800'">
                                        {{ statusView[row.status]?.text || row.status }}
                                    </span>
                                </td>
                            </tr>
                            <tr v-if="!notifyRows.length">
                                <td colspan="4" class="td text-center text-slate-500">Không có học sinh nào để gửi thông báo.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="flex justify-end gap-2">
                    <Button label="Hủy" class="btn-ghost text-xs" @click="notifyDialogVisible = false" />
                    <Button label="Gửi thông báo" class="btn-primary text-xs" icon="fa-regular fa-paper-plane mr-2" @click="onSendNotification" :disabled="!selectedNotifyStudentIds.length" />
                </div>
            </div>
        </Dialog>
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
.btn-primary {
    background: linear-gradient(135deg, #4f46e5, #3b82f6);
    color: #fff;
    border: 0;
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

.import-dropzone {
    border: 2px dashed #cbd5f5;
    border-radius: 18px;
    background-color: #f8fafc;
    padding: 20px;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
}
.import-dropzone--active {
    border-color: #10b981;
    background-color: #ecfdf5;
}
</style>
