<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import Paginator from 'primevue/paginator';

import Swal from 'sweetalert2';

import { fetchClassOptions } from '@/service/classService.js';
import { fetchStudentsByClass } from '@/service/studentService.js';
import {
    fetchFeesByClassAndSemesterYear,
    fetchFeeSummary,
    fetchAvailableSemesters,
    fetchAvailableYears,
    createBulkFees,
    downloadFeeTemplate,
    createFeesFromExcel,
    payFee,
    deleteFee,
    updateOverdueFees
} from '@/service/fee.js';

import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser } from '@/service/authService.js';

/* ===== Auth – để lưu tên người thao tác vào payment.receivedBy ===== */
const auth = useAuthStore();
const currentUser = computed(() => getUsernameFromUser(auth?.user) || 'system');

/* ===== Data filter / combobox ===== */
const classes = ref([]); // [{ id, name }]
const semesters = ref([]); // ['HK1', 'HK2', ...]
const years = ref([]);

const selectedClass = ref(null);
const selectedSemester = ref(null);
const selectedYear = ref(null);

const statusFilter = ref('ALL');
const keyword = ref('');

/* ===== Data from BE ===== */
const students = ref([]); // toàn bộ HS trong lớp
const fees = ref([]); // FeeResponse[]
const summary = ref(null);

/* ===== UI state ===== */
const loadingInit = ref(false);
const loadingList = ref(false);

const first = ref(0);
const rowsPerPage = ref(10);

const errorMessage = ref('');

/* ===== Dialog: bulk fee ===== */
const bulkDialogVisible = ref(false);
const bulkAmount = ref(null);
const bulkDueDate = ref(null);
const bulkNote = ref('');

/* ===== Dialog: import Excel ===== */
const importDialogVisible = ref(false);
const importFile = ref(null);
const importDueDate = ref(null);
const importing = ref(false);

/* ===== Dialog: payment ===== */
const payDialogVisible = ref(false);
const payTarget = ref(null);
const payAmount = ref(null);
const payDate = ref(new Date());
const payMethod = ref('Tiền mặt');
const payNote = ref('');

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
    const feeMap = new Map((fees.value || []).map((f) => [f.studentId, f]));
    const result = [];

    (students.value || []).forEach((s, idx) => {
        const fee = feeMap.get(s.id);
        result.push({
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
        });
    });

    return result;
});

/* filter theo keyword + status + phân trang */
const filteredRows = computed(() => {
    let list = [...mergedRows.value];

    if (statusFilter.value && statusFilter.value !== 'ALL') {
        list = list.filter((r) => r.status === statusFilter.value);
    }

    const kw = keyword.value.trim().toLowerCase();
    if (kw) {
        list = list.filter(
            (r) =>
                (r.studentName || '').toLowerCase().includes(kw) ||
                (r.studentCode || '').toLowerCase().includes(kw)
        );
    }

    return list;
});

const pagedRows = computed(() => {
    const start = first.value;
    const end = first.value + rowsPerPage.value;
    return filteredRows.value.slice(start, end);
});

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
        const [sems, yrs] = await Promise.all([
            fetchAvailableSemesters(),
            fetchAvailableYears()
        ]);

        semesters.value = sems && sems.length ? sems : ['HK1', 'HK2'];
        years.value = yrs && yrs.length ? yrs : [new Date().getFullYear()];

        if (!selectedSemester.value && semesters.value.length) {
            selectedSemester.value = semesters.value[0];
        }
        if (!selectedYear.value && years.value.length) {
            selectedYear.value = years.value[0];
        }
    } catch (e) {
        console.error(e);
        semesters.value = ['HK1', 'HK2'];
        years.value = [new Date().getFullYear()];
        if (!selectedSemester.value) selectedSemester.value = semesters.value[0];
        if (!selectedYear.value) selectedYear.value = years.value[0];
    }
}

async function loadData({ showToast = false } = {}) {
    if (!selectedClass.value || !selectedSemester.value || !selectedYear.value) return;

    loadingList.value = true;
    errorMessage.value = '';

    try {
        const [stu, feeList, sum] = await Promise.all([
            fetchStudentsByClass(selectedClass.value.id),
            fetchFeesByClassAndSemesterYear({
                classId: selectedClass.value.id,
                semester: selectedSemester.value,
                year: selectedYear.value
            }),
            fetchFeeSummary({
                classId: selectedClass.value.id,
                semester: selectedSemester.value,
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
    bulkNote.value = '';
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
            semester: selectedSemester.value,
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
    importDueDate.value = null;
}

function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    importFile.value = file;
    swalToast.fire({
        icon: 'info',
        title: `Đã chọn file: ${file.name}`
    });
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
            file: importFile.value,
            semester: selectedSemester.value,
            feeYear: selectedYear.value,
            dueDate: importDueDate.value || new Date()
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
    const { isConfirmed } = await confirmDialog(
        'Cập nhật học phí quá hạn?',
        'Hệ thống sẽ đánh dấu quá hạn cho các khoản học phí đã quá hạn thanh toán.'
    );
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
    const remaining = row.remainingAmount ?? (row.totalAmount - row.paidAmount);
    payAmount.value = remaining > 0 ? remaining : null;
    payDate.value = new Date();
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
    try {
        await payFee({
            feeId: payTarget.value.feeId,
            amount: payAmount.value,
            paymentDate: payDate.value,
            paymentMethod: payMethod.value,
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
    const { isConfirmed } = await confirmDialog(
        'Xóa học phí?',
        `Bạn chắc chắn muốn xóa học phí của học sinh ${row.studentName}?`
    );
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

/* ===== Init ===== */
async function init() {
    loadingInit.value = true;
    try {
        await Promise.all([loadClasses(), loadSemestersAndYears()]);
        await loadData();
    } finally {
        loadingInit.value = false;
    }
}

watch([selectedClass, selectedSemester, selectedYear], () => {
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
                    <div class="text-slate-500 text-sm">
                        Theo dõi, thu học phí và tổng hợp theo lớp – kỳ – năm
                    </div>
                </div>
            </div>

            <div class="flex flex-wrap gap-2">
                <Button
                    class="btn-ghost"
                    icon="fa-solid fa-file-arrow-down mr-2"
                    label="Tải file mẫu Excel"
                    @click="onDownloadTemplate"
                />
                <Button
                    class="btn-ghost"
                    icon="fa-solid fa-file-import mr-2"
                    label="Import từ Excel"
                    @click="openImportDialog"
                />
                <Button
                    class="btn-ghost"
                    icon="fa-solid fa-layer-group mr-2"
                    label="Tạo học phí hàng loạt"
                    @click="openBulkDialog"
                />
                <Button
                    class="btn-primary"
                    icon="fa-solid fa-clock-rotate-left mr-2"
                    label="Cập nhật quá hạn"
                    @click="onUpdateOverdue"
                />
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
                        <Dropdown
                            v-model="selectedClass"
                            :options="classes"
                            optionLabel="name"
                            class="w-full"
                            placeholder="Chọn lớp"
                        />
                    </div>
                    <div>
                        <label class="label">Kỳ học</label>
                        <Dropdown
                            v-model="selectedSemester"
                            :options="semesters"
                            class="w-full"
                            placeholder="Chọn kỳ"
                        />
                    </div>
                    <div>
                        <label class="label">Năm</label>
                        <Dropdown
                            v-model="selectedYear"
                            :options="years"
                            class="w-full"
                            placeholder="Chọn năm"
                        />
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
                            <div class="text-lg font-bold text-slate-800 mt-1">
                                {{ summary.className }} • {{ summary.semester }} / {{ summary.year }}
                            </div>
                            <div class="text-xs text-slate-500 mt-1">
                                Tổng {{ summary.totalStudents }} học sinh
                            </div>
                        </div>
                        <i class="fa-solid fa-users text-3xl text-primary/70"></i>
                    </div>
                </template>
            </Card>
            <Card class="card-soft ring-1 ring-slate-100">
                <template #content>
                    <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">Tình trạng thanh toán</div>
                    <div class="mt-2 space-y-1 text-sm">
                        <div>Đã đóng: <b>{{ summary.paidCount }}</b></div>
                        <div>Chờ đóng: <b>{{ summary.pendingCount }}</b></div>
                        <div>Quá hạn: <b class="text-red-600">{{ summary.overdueCount }}</b></div>
                        <div>Đóng một phần: <b>{{ summary.partialCount }}</b></div>
                    </div>
                </template>
            </Card>
            <Card class="card-soft ring-1 ring-slate-100">
                <template #content>
                    <div class="text-xs uppercase tracking-wide text-slate-500 font-semibold">Số tiền</div>
                    <div class="mt-2 space-y-1 text-sm">
                        <div>Tổng phải thu: <b>{{ formatCurrency(summary.totalAmount) }}</b></div>
                        <div>Đã thu: <b class="text-emerald-600">{{ formatCurrency(summary.totalPaid) }}</b></div>
                        <div>Còn lại: <b class="text-amber-600">{{ formatCurrency(summary.totalRemaining) }}</b></div>
                    </div>
                </template>
            </Card>
        </div>

        <!-- Bảng dữ liệu -->
        <div class="overflow-x-auto rounded-2xl ring-1 ring-slate-200 bg-white relative">
            <div
                v-if="loadingInit || loadingList"
                class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm"
            >
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
                        <th class="th min-w-[160px] text-center">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="row in pagedRows"
                        :key="row.studentId"
                        class="border-b last:border-0 hover:bg-slate-50"
                    >
                        <td class="td">{{ row.index }}</td>
                        <td class="td">{{ row.studentCode || '—' }}</td>
                        <td class="td font-medium text-slate-800">{{ row.studentName }}</td>
                        <td class="td">{{ row.className }}</td>
                        <td class="td text-right">{{ formatCurrency(row.totalAmount) }}</td>
                        <td class="td text-right">{{ formatCurrency(row.paidAmount) }}</td>
                        <td class="td text-right">
                            {{
                                row.feeId
                                    ? formatCurrency(row.remainingAmount ?? row.totalAmount - row.paidAmount)
                                    : '—'
                            }}
                        </td>
                        <td class="td">{{ row.dueDate ? formatDate(row.dueDate) : '—' }}</td>
                        <td class="td">{{ row.paidDate ? formatDate(row.paidDate) : '—' }}</td>
                        <td class="td text-center">
                            <span
                                class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold"
                                :class="statusView[row.status]?.class || 'bg-slate-300 text-slate-800'"
                            >
                                {{ statusView[row.status]?.text || row.status || 'Không xác định' }}
                            </span>
                        </td>
                        <td class="td text-center">
                            <div class="flex flex-col gap-1 items-stretch">
                                <Button
                                    class="btn-success text-xs"
                                    label="Thu tiền"
                                    @click.stop="openPayDialog(row)"
                                    :disabled="row.status === 'NOT_CREATED' || row.status === 'PAID'"
                                />
                                <Button
                                    class="btn-ghost text-xs !text-red-600"
                                    label="Xóa bản ghi"
                                    @click.stop="onDeleteFee(row)"
                                    :disabled="!row.feeId"
                                />
                            </div>
                        </td>
                    </tr>

                    <tr v-if="!loadingInit && !loadingList && !filteredRows.length">
                        <td colspan="11" class="px-3 py-4 text-center text-slate-500">
                            Không có dữ liệu học phí cho bộ lọc hiện tại.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div class="flex justify-end">
            <Paginator
                :rows="rowsPerPage"
                :totalRecords="filteredRows.length"
                :first="first"
                @page="onPageChange"
                class="mt-3"
            />
        </div>

        <!-- Dialog: Bulk fee -->
        <Dialog v-model:visible="bulkDialogVisible" modal :style="{ width: '480px' }" header="Tạo học phí hàng loạt">
            <div class="space-y-4">
                <div class="text-sm text-slate-700">
                    Lớp:
                    <b>{{ selectedClass?.name }}</b> •
                    Kỳ:
                    <b>{{ selectedSemester }}</b> /
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
                        Hệ thống sẽ tạo một bản ghi học phí <b>PENDING</b> cho tất cả học sinh chưa có học phí trong
                        lớp.
                    </div>
                </div>
                <div class="flex justify-end gap-2">
                    <Button label="Hủy" class="btn-ghost text-xs" @click="bulkDialogVisible = false" />
                    <Button label="Tạo học phí" class="btn-success text-xs" @click="confirmBulkCreate" />
                </div>
            </div>
        </Dialog>

        <!-- Dialog: Import Excel -->
        <Dialog
            v-model:visible="importDialogVisible"
            modal
            :style="{ width: '520px' }"
            header="Import học phí từ Excel"
        >
            <div class="space-y-4">
                <div class="p-3 rounded-xl bg-slate-50 text-sm text-slate-700">
                    <div>
                        Lớp:
                        <b>{{ selectedClass?.name || 'Chưa chọn' }}</b>
                    </div>
                    <div>
                        Kỳ:
                        <b>{{ selectedSemester }}</b> /
                        <b>{{ selectedYear }}</b>
                    </div>
                    <div class="mt-1 text-xs text-slate-500">
                        File Excel cần đúng cấu trúc template. Hệ thống sẽ bỏ qua các dòng lỗi.
                    </div>
                </div>

                <div class="space-y-3">
                    <div>
                        <label class="label">Chọn file Excel</label>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            class="block w-full text-sm text-slate-700"
                            @change="onFileChange"
                        />
                        <div v-if="importFile" class="text-xs text-slate-500 mt-1">
                            Đã chọn:
                            <b>{{ importFile.name }}</b>
                        </div>
                    </div>
                    <div>
                        <label class="label">Hạn đóng (áp dụng cho tất cả nếu file không có)</label>
                        <Calendar v-model="importDueDate" showIcon dateFormat="dd/mm/yy" class="w-full" />
                    </div>
                </div>

                <div class="flex justify-end gap-2">
                    <Button
                        label="Hủy"
                        class="btn-ghost text-xs"
                        :disabled="importing"
                        @click="importDialogVisible = false"
                    />
                    <Button
                        :label="importing ? 'Đang import...' : 'Import'"
                        class="btn-success text-xs"
                        :disabled="importing"
                        @click="confirmImportExcel"
                    />
                </div>
            </div>
        </Dialog>

        <!-- Dialog: Payment -->
        <Dialog v-model:visible="payDialogVisible" modal :style="{ width: '460px' }" header="Thanh toán học phí">
            <div v-if="payTarget" class="space-y-4">
                <div class="text-sm text-slate-700">
                    Học sinh:
                    <b>{{ payTarget.studentName }}</b>
                    <span class="text-xs text-slate-500">
                        ({{ payTarget.studentCode || 'không có mã' }})
                    </span>
                    <br />
                    Lớp:
                    <b>{{ payTarget.className }}</b>
                </div>

                <div class="space-y-3">
                    <div>
                        <label class="label">Số tiền thu</label>
                        <InputNumber
                            v-model="payAmount"
                            :min="0"
                            mode="decimal"
                            :useGrouping="true"
                            class="w-full"
                        />
                    </div>
                    <div>
                        <label class="label">Ngày thu</label>
                        <Calendar v-model="payDate" showIcon dateFormat="dd/mm/yy" class="w-full" />
                    </div>
                    <div>
                        <label class="label">Hình thức</label>
                        <InputText v-model="payMethod" class="w-full" />
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
</style>
