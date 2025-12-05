<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';
import * as XLSX from 'xlsx';

import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import Paginator from 'primevue/paginator';
import Checkbox from 'primevue/checkbox';

import Swal from 'sweetalert2';

import {
    fetchParents,
    exportParentsExcel,
    lockParents,
    unlockParents,
    deleteParents,
    importParentsFromExcel
} from '@/service/parentService.js';
import ParentUpsertModal from '@/components/staff/ParentUpsertModal.vue';

/* =================== Toast =================== */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
});

function confirmDialog(title, text, options = {}) {
    return Swal.fire({
        title,
        text,
        icon: options.icon || 'warning',
        showCancelButton: true,
        confirmButtonText: options.confirmText || 'Xác nhận',
        cancelButtonText: 'Hủy',
        confirmButtonColor: options.color || '#dc2626',
        cancelButtonColor: '#6b7280',
        reverseButtons: true
    });
}

/* =================== STATE =================== */
const loading = ref(false);
const rows = ref([]);
const totalRecords = ref(0);
const page = ref(1);
const size = ref(20);
const sortField = ref('name');
const sortOrder = ref(1);

const keyword = ref('');
const currentTab = ref('all');
const counts = ref({ total: 0, active: 0, blocked: 0 });

const selection = ref([]);
const selectAll = ref(false);

/* =================== TABS =================== */
const tabs = computed(() => [
    { key: 'all', label: 'Tất cả', count: counts.value.total, icon: 'fa-users' },
    { key: 'active', label: 'Hoạt động', count: counts.value.active, icon: 'fa-user-check', color: 'green' },
    { key: 'blocked', label: 'Đã khóa', count: counts.value.blocked, icon: 'fa-user-lock', color: 'red' }
]);

/* =================== DIALOGS =================== */
const showUpsert = ref(false);
const editing = ref(null);

const showImport = ref(false);
const importLoading = ref(false);
const dragOver = ref(false);
const selectedFile = ref(null);
const fileInputRef = ref(null);

/* =================== LOAD =================== */
async function load(isInit = false) {
    loading.value = true;
    try {
        const sort = sortField.value
            ? `${sortField.value},${sortOrder.value === -1 ? 'desc' : 'asc'}`
            : undefined;

        const { items, total, counts: cts } = await fetchParents({
            q: keyword.value || undefined,
            status: currentTab.value,
            page: page.value,
            size: size.value,
            sort
        });
        rows.value = items;
        totalRecords.value = total;
        counts.value = cts;
        selection.value = [];
        selectAll.value = false;
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Không tải được danh sách' });
    } finally {
        loading.value = false;
    }
}

function onPageChange(e) {
    page.value = e.page + 1;
    size.value = e.rows;
    load();
}

function switchTab(key) {
    currentTab.value = key;
    page.value = 1;
    load();
}

function onSort(field) {
    if (sortField.value === field) {
        sortOrder.value = sortOrder.value === 1 ? -1 : 1;
    } else {
        sortField.value = field;
        sortOrder.value = 1;
    }
    page.value = 1;
    load();
}

/* =================== SELECTION =================== */
function toggleSelectAll() {
    if (selectAll.value) {
        selection.value = [...rows.value];
    } else {
        selection.value = [];
    }
}

function toggleSelect(row) {
    const idx = selection.value.findIndex((r) => r.id === row.id);
    if (idx >= 0) {
        selection.value.splice(idx, 1);
    } else {
        selection.value.push(row);
    }
    selectAll.value = selection.value.length === rows.value.length;
}

function isSelected(row) {
    return selection.value.some((r) => r.id === row.id);
}

/* =================== ACTIONS =================== */
function onCreate() {
    editing.value = null;
    showUpsert.value = true;
}

function onEdit(row) {
    editing.value = row;
    showUpsert.value = true;
}

function onView(row) {
    editing.value = row;
    showUpsert.value = true;
}

async function onAfterUpsert() {
    showUpsert.value = false;
    await load();
    swalToast.fire({ icon: 'success', title: 'Lưu thông tin thành công' });
}

async function onLock(row) {
    const { isConfirmed } = await confirmDialog(
        'Khóa tài khoản?',
        `Khóa tài khoản phụ huynh "${row.name}"?`,
        { confirmText: 'Khóa', color: '#f59e0b' }
    );
    if (!isConfirmed) return;

    try {
        await lockParents([row.id]);
        swalToast.fire({ icon: 'success', title: 'Đã khóa tài khoản' });
        await load();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Khóa thất bại' });
    }
}

async function onUnlock(row) {
    const { isConfirmed } = await confirmDialog(
        'Mở khóa tài khoản?',
        `Mở khóa tài khoản phụ huynh "${row.name}"?`,
        { confirmText: 'Mở khóa', color: '#10b981', icon: 'question' }
    );
    if (!isConfirmed) return;

    try {
        await unlockParents([row.id]);
        swalToast.fire({ icon: 'success', title: 'Đã mở khóa tài khoản' });
        await load();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Mở khóa thất bại' });
    }
}

async function onDelete(row) {
    const { isConfirmed } = await confirmDialog(
        'Xóa phụ huynh?',
        `Xóa phụ huynh "${row.name}"?  Thao tác không thể hoàn tác.`,
        { confirmText: 'Xóa' }
    );
    if (!isConfirmed) return;

    try {
        await deleteParents([row.id]);
        swalToast.fire({ icon: 'success', title: 'Đã xóa phụ huynh' });
        await load();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Xóa thất bại' });
    }
}

/* =================== BULK ACTIONS =================== */
async function bulkLock() {
    if (!selection.value.length) {
        swalToast.fire({ icon: 'info', title: 'Chưa chọn phụ huynh nào' });
        return;
    }

    const { isConfirmed } = await confirmDialog(
        'Khóa tài khoản đã chọn?',
        `Khóa ${selection.value.length} tài khoản phụ huynh?`,
        { confirmText: 'Khóa', color: '#f59e0b' }
    );
    if (!isConfirmed) return;

    try {
        await lockParents(selection.value.map((r) => r.id));
        swalToast.fire({ icon: 'success', title: 'Đã khóa tài khoản' });
        await load();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Khóa thất bại' });
    }
}

async function bulkUnlock() {
    if (!selection.value.length) {
        swalToast.fire({ icon: 'info', title: 'Chưa chọn phụ huynh nào' });
        return;
    }

    const { isConfirmed } = await confirmDialog(
        'Mở khóa tài khoản đã chọn?',
        `Mở khóa ${selection.value.length} tài khoản phụ huynh?`,
        { confirmText: 'Mở khóa', color: '#10b981', icon: 'question' }
    );
    if (!isConfirmed) return;

    try {
        await unlockParents(selection.value.map((r) => r.id));
        swalToast.fire({ icon: 'success', title: 'Đã mở khóa' });
        await load();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Mở khóa thất bại' });
    }
}

async function bulkDelete() {
    if (!selection.value.length) {
        swalToast.fire({ icon: 'info', title: 'Chưa chọn phụ huynh nào' });
        return;
    }

    const { isConfirmed } = await confirmDialog(
        'Xóa phụ huynh đã chọn?',
        `Xóa ${selection.value.length} phụ huynh?  Không thể hoàn tác.`,
        { confirmText: 'Xóa' }
    );
    if (!isConfirmed) return;

    try {
        await deleteParents(selection.value.map((r) => r.id));
        swalToast.fire({ icon: 'success', title: 'Đã xóa' });
        await load();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Xóa thất bại' });
    }
}

/* =================== EXPORT =================== */
async function onExport() {
    try {
        await exportParentsExcel();
        swalToast.fire({ icon: 'success', title: 'Đang tải file Excel' });
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Xuất Excel thất bại' });
    }
}

/* =================== IMPORT =================== */
function openImport() {
    selectedFile.value = null;
    dragOver.value = false;
    showImport.value = true;
}

function closeImport() {
    if (importLoading.value) return;
    showImport.value = false;
    selectedFile.value = null;
}

function onDrop(e) {
    e.preventDefault();
    dragOver.value = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) selectedFile.value = file;
}

function onDragOver(e) {
    e.preventDefault();
    dragOver.value = true;
}

function onDragLeave(e) {
    e.preventDefault();
    dragOver.value = false;
}

function chooseFile() {
    fileInputRef.value?.click();
}

function onFileChange(e) {
    const file = e.target.files?.[0];
    if (file) selectedFile.value = file;
}

function downloadTemplate() {
    const headers = [
        'Họ và tên',
        'Email',
        'Số điện thoại',
        'Giới tính',
        'Ngày sinh',
        'Nghề nghiệp',
        'Mối quan hệ',
        'Liên hệ khẩn cấp',
        'Số điện thoại phụ'
    ];
    const example = [
        'Nguyễn Văn A',
        'email@example.com',
        '0912345678',
        'Nam',
        '01-01-1980',
        'Kinh doanh',
        'Ba',
        '0911222333',
        '0988777666'
    ];

    const wsData = XLSX.utils.aoa_to_sheet([headers]);
    const wsExample = XLSX.utils.aoa_to_sheet([headers, example]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData, 'DuLieu');
    XLSX.utils.book_append_sheet(wb, wsExample, 'Vi_du');

    XLSX.writeFile(wb, 'Mau_import_phu_huynh.xlsx');
}

async function uploadExcel() {
    if (!selectedFile.value) {
        swalToast.fire({ icon: 'info', title: 'Vui lòng chọn file Excel' });
        return;
    }

    importLoading.value = true;
    try {
        const res = await importParentsFromExcel(selectedFile.value);
        const result = res?.data || {};

        importLoading.value = false;
        if (fileInputRef.value) fileInputRef.value.value = '';
        closeImport();

        let html = `
            <div style="text-align:left;font-size:14px;">
                <div><b>Tổng bản ghi:</b> ${result.totalRecords || 0}</div>
                <div><b>Thành công:</b> ${result.successCount || 0}</div>
                <div><b>Lỗi:</b> ${result.errorCount || 0}</div>
            </div>
        `;

        if (result.errorMessages?.length) {
            html += `
                <hr style="margin:12px 0"/>
                <div style="max-height:140px;overflow:auto;text-align:left;font-size:12px;color:#dc2626;">
                    <b>Chi tiết lỗi:</b><br/>
                    ${result.errorMessages.slice(0, 5).join('<br/>')}
                    ${result.errorMessages.length > 5 ? '<br/>...' : ''}
                </div>
            `;
        }

        await Swal.fire({
            icon: result.successCount > 0 ? 'success' : 'warning',
            title: res?.message || 'Kết quả import',
            html
        });

        await load();
    } catch (err) {
        importLoading.value = false;
        if (fileInputRef.value) fileInputRef.value.value = '';
        await Swal.fire({
            icon: 'error',
            title: 'Import thất bại',
            text: err?.message || 'Đã xảy ra lỗi'
        });
    }
}

/* =================== UTILS =================== */
function getStatusConfig(row) {
    if (row.statusKey === 'blocked') {
        return {
            bg: 'bg-red-50',
            text: 'text-red-600',
            icon: 'fa-lock',
            label: 'Đã khóa'
        };
    }
    return {
        bg: 'bg-green-50',
        text: 'text-green-600',
        icon: 'fa-check-circle',
        label: 'Hoạt động'
    };
}

function getAvatar(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
}

/* =================== WATCH =================== */
let debounceTimer;
watch(keyword, () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        page.value = 1;
        load();
    }, 300);
});

onMounted(() => load(true));
</script>

<template>
    <div class="parent-page">
        <!-- Header -->
        <header class="page-header">
            <div class="header-left">
                <div class="header-icon">
                    <i class="fa-solid fa-users"></i>
                </div>
                <div>
                    <h1 class="page-title">Quản lý phụ huynh</h1>
                    <p class="page-desc">Quản lý thông tin tài khoản phụ huynh học sinh</p>
                </div>
            </div>
            <div class="header-actions">
                <button class="btn btn-outline" @click="openImport">
                    <i class="fa-solid fa-file-import"></i>
                    <span>Nhập Excel</span>
                </button>
                <button class="btn btn-outline" @click="onExport">
                    <i class="fa-solid fa-file-excel"></i>
                    <span>Xuất Excel</span>
                </button>
                <button class="btn btn-primary" @click="onCreate">
                    <i class="fa-solid fa-plus"></i>
                    <span>Thêm phụ huynh</span>
                </button>
            </div>
        </header>

        <!-- Stats -->
        <div class="stats-row">
            <div
                v-for="tab in tabs"
                :key="tab.key"
                class="stat-card"
                :class="{ active: currentTab === tab.key, [`stat-${tab.color}`]: tab.color }"
                @click="switchTab(tab.key)"
            >
                <div class="stat-icon">
                    <i :class="['fa-solid', tab.icon]"></i>
                </div>
                <div class="stat-content">
                    <span class="stat-value">{{ tab.count }}</span>
                    <span class="stat-label">{{ tab.label }}</span>
                </div>
            </div>
        </div>

        <!-- Filters & Bulk actions -->
        <div class="filter-bar">
            <div class="filter-left">
                <div class="search-box">
                    <i class="fa-solid fa-search"></i>
                    <InputText
                        v-model="keyword"
                        placeholder="Tìm tên, SĐT, email..."
                        class="w-full"
                    />
                </div>
            </div>
            <div class="filter-right">
                <div v-if="selection.length" class="bulk-info">
                    Đã chọn <b>{{ selection.length }}</b> phụ huynh
                </div>
                <button class="btn btn-sm btn-warning" @click="bulkLock" :disabled="!selection.length">
                    <i class="fa-solid fa-lock"></i>
                    <span>Khóa</span>
                </button>
                <button class="btn btn-sm btn-success" @click="bulkUnlock" :disabled="!selection.length">
                    <i class="fa-solid fa-unlock"></i>
                    <span>Mở khóa</span>
                </button>
                <button class="btn btn-sm btn-danger" @click="bulkDelete" :disabled="!selection.length">
                    <i class="fa-solid fa-trash"></i>
                    <span>Xóa</span>
                </button>
            </div>
        </div>

        <!-- Table -->
        <div class="table-container">
            <div v-if="loading" class="loading-overlay">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Đang tải...</span>
            </div>

            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 40px">
                            <Checkbox v-model="selectAll" :binary="true" @change="toggleSelectAll" />
                        </th>
                        <th style="width: 50px">#</th>
                        <th style="min-width: 220px">
                            <div class="th-sortable" @click="onSort('name')">
                                <span>Họ và tên</span>
                                <i
                                    v-if="sortField === 'name'"
                                    :class="
                                        sortOrder === 1
                                            ? 'fa-solid fa-sort-up'
                                            : 'fa-solid fa-sort-down'
                                    "
                                ></i>
                                <i v-else class="fa-solid fa-sort text-gray-300"></i>
                            </div>
                        </th>
                        <th style="min-width: 180px">Liên hệ</th>
                        <th style="min-width: 200px">Con đang học</th>
                        <th style="min-width: 120px">Trạng thái</th>
                        <th style="width: 160px" class="text-center">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(row, idx) in rows"
                        :key="row.id"
                        :class="{ 'row-selected': isSelected(row) }"
                    >
                        <td>
                            <Checkbox
                                :modelValue="isSelected(row)"
                                :binary="true"
                                @change="toggleSelect(row)"
                            />
                        </td>
                        <td>{{ (page - 1) * size + idx + 1 }}</td>
                        <td>
                            <div class="parent-cell">
                                <div class="parent-avatar">
                                    {{ getAvatar(row.name) }}
                                </div>
                                <div class="parent-info">
                                    <span class="parent-name">{{ row.name }}</span>
                                    <span class="parent-username">@{{ row.username }}</span>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="contact-cell">
                                <div class="contact-row">
                                    <i class="fa-solid fa-phone"></i>
                                    <span>{{ row.phone || '—' }}</span>
                                </div>
                                <div class="contact-row">
                                    <i class="fa-solid fa-envelope"></i>
                                    <span>{{ row.email || '—' }}</span>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="students-cell">
                                <span
                                    v-for="(st, i) in row.studentNames?.slice(0, 3)"
                                    :key="i"
                                    class="student-tag"
                                >
                                    {{ st }}
                                </span>
                                <span v-if="row.studentNames?.length > 3" class="student-more">
                                    +{{ row.studentNames.length - 3 }}
                                </span>
                                <span v-if="!row.studentNames?.length" class="text-gray-400">
                                    Chưa liên kết
                                </span>
                            </div>
                        </td>
                        <td>
                            <span
                                class="status-badge"
                                :class="[getStatusConfig(row).bg, getStatusConfig(row).text]"
                            >
                                <i
                                    :class="['fa-solid', getStatusConfig(row).icon]"
                                ></i>
                                {{ getStatusConfig(row).label }}
                            </span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button
                                    class="action-btn"
                                    @click="onView(row)"
                                    title="Xem chi tiết"
                                >
                                    <i class="fa-solid fa-eye"></i>
                                </button>
                                <button
                                    class="action-btn"
                                    @click="onEdit(row)"
                                    title="Chỉnh sửa"
                                >
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                <button
                                    v-if="row.statusKey === 'active'"
                                    class="action-btn warning"
                                    @click="onLock(row)"
                                    title="Khóa"
                                >
                                    <i class="fa-solid fa-lock"></i>
                                </button>
                                <button
                                    v-else
                                    class="action-btn success"
                                    @click="onUnlock(row)"
                                    title="Mở khóa"
                                >
                                    <i class="fa-solid fa-unlock"></i>
                                </button>
                                <button
                                    class="action-btn danger"
                                    @click="onDelete(row)"
                                    title="Xóa"
                                >
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                    <tr v-if="!loading && !rows.length">
                        <td colspan="7" class="empty-cell">
                            <i class="fa-solid fa-users-slash"></i>
                            <span>Không có phụ huynh nào</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalRecords > 0" class="pagination-wrapper">
            <span class="pagination-info">
                Hiển thị
                {{ (page - 1) * size + 1 }}
                -
                {{ Math.min(page * size, totalRecords) }}
                /
                {{ totalRecords }}
            </span>
            <Paginator
                :rows="size"
                :totalRecords="totalRecords"
                :first="(page - 1) * size"
                @page="onPageChange"
                :rowsPerPageOptions="[20, 50, 100]"
            />
        </div>

        <!-- Upsert Modal -->
        <ParentUpsertModal
            v-model:modelValue="showUpsert"
            :parent="editing"
            @saved="onAfterUpsert"
        />

        <!-- Import Dialog -->
        <Dialog v-model:visible="showImport" modal :style="{ width: '560px' }" :draggable="false">
            <template #header>
                <div class="dialog-header">
                    <i class="fa-solid fa-file-import"></i>
                    <span>Nhập danh sách phụ huynh từ Excel</span>
                </div>
            </template>

            <div class="dialog-body">
                <!-- Drop zone -->
                <div
                    class="drop-zone"
                    :class="{ 'drop-zone--active': dragOver }"
                    @drop="onDrop"
                    @dragover="onDragOver"
                    @dragleave="onDragLeave"
                    @click="chooseFile"
                >
                    <div class="drop-icon">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                    </div>
                    <p class="drop-text">
                        Kéo thả file Excel vào đây hoặc
                        <span class="drop-link">chọn file</span>
                    </p>
                    <p v-if="selectedFile" class="drop-file">
                        <i class="fa-solid fa-file-excel"></i>
                        {{ selectedFile.name }}
                    </p>
                    <p v-else class="drop-hint">Hỗ trợ định dạng .xlsx, .xls</p>
                </div>
                <input
                    ref="fileInputRef"
                    type="file"
                    accept=".xlsx,.xls"
                    class="hidden"
                    @change="onFileChange"
                />

                <!-- Template info -->
                <div class="template-info">
                    <div class="template-header">
                        <i class="fa-solid fa-info-circle"></i>
                        <span>Cấu trúc file Excel</span>
                    </div>
                    <p class="template-cols">
                        Họ và tên, Email, Số điện thoại, Giới tính, Ngày sinh, Nghề nghiệp, Mối quan hệ, Liên hệ
                        khẩn cấp, Số điện thoại phụ
                    </p>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <button class="btn btn-ghost" @click="closeImport" :disabled="importLoading">
                        Đóng
                    </button>
                    <button
                        class="btn btn-outline"
                        @click="downloadTemplate"
                        :disabled="importLoading"
                    >
                        <i class="fa-solid fa-download"></i>
                        Tải mẫu Excel
                    </button>
                    <button
                        class="btn btn-primary"
                        @click="uploadExcel"
                        :disabled="importLoading || !selectedFile"
                    >
                        <i
                            :class="
                                importLoading
                                    ? 'fa-solid fa-spinner fa-spin'
                                    : 'fa-solid fa-upload'
                            "
                        ></i>
                        {{ importLoading ? 'Đang tải...' : 'Tải lên' }}
                    </button>
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* ===== Base ===== */
.parent-page {
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
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.header-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
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

.btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
}

.btn-primary {
    background: #6366f1;
    color: white;
}
.btn-primary:hover {
    background: #4f46e5;
}

.btn-success {
    background: #10b981;
    color: white;
}
.btn-success:hover {
    background: #059669;
}

.btn-warning {
    background: #f59e0b;
    color: white;
}
.btn-warning:hover {
    background: #d97706;
}

.btn-danger {
    background: #ef4444;
    color: white;
}
.btn-danger:hover {
    background: #dc2626;
}

.btn-outline {
    background: white;
    color: #475569;
    border: 1px solid #e2e8f0;
}
.btn-outline:hover {
    background: #f8fafc;
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

/* ===== Stats ===== */
.stats-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
}

.stat-card {
    flex: 1;
    min-width: 140px;
    background: white;
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
}

.stat-card:hover {
    border-color: #e2e8f0;
}

.stat-card.active {
    border-color: #6366f1;
    background: #eef2ff;
}

.stat-card.stat-green.active {
    border-color: #10b981;
    background: #ecfdf5;
}

.stat-card.stat-red.active {
    border-color: #ef4444;
    background: #fef2f2;
}

.stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    color: #64748b;
}

.stat-card.active .stat-icon {
    background: #6366f1;
    color: white;
}

.stat-card.stat-green.active .stat-icon {
    background: #10b981;
}

.stat-card.stat-red.active .stat-icon {
    background: #ef4444;
}

.stat-content {
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
}

.stat-label {
    font-size: 0.75rem;
    color: #64748b;
}

/* ===== Filter ===== */
.filter-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    margin-bottom: 1rem;
    flex-wrap: wrap;
}

.filter-left {
    flex: 1;
    min-width: 250px;
}

.search-box {
    position: relative;
    max-width: 320px;
}

.search-box i {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
}

.search-box input {
    padding-left: 2.25rem !important;
}

.filter-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.bulk-info {
    font-size: 0.875rem;
    color: #475569;
    margin-right: 0.5rem;
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
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #64748b;
    z-index: 10;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
}

.data-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: #475569;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
}

.data-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
}

.data-table tbody tr:hover {
    background: #f8fafc;
}

.row-selected {
    background: #eef2ff !important;
}

.th-sortable {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
}

.th-sortable:hover {
    color: #6366f1;
}

/* Parent cell */
.parent-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.parent-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #a5b4fc, #818cf8);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
}

.parent-info {
    display: flex;
    flex-direction: column;
}

.parent-name {
    font-weight: 600;
    color: #1e293b;
}

.parent-username {
    font-size: 0.75rem;
    color: #94a3b8;
}

/* Contact cell */
.contact-cell {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.contact-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #475569;
}

.contact-row i {
    font-size: 0.75rem;
    color: #94a3b8;
    width: 14px;
}

/* Students cell */
.students-cell {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
}

.student-tag {
    display: inline-flex;
    padding: 0.25rem 0.5rem;
    background: #f1f5f9;
    color: #475569;
    border-radius: 4px;
    font-size: 0.75rem;
}

.student-more {
    display: inline-flex;
    padding: 0.25rem 0.5rem;
    background: #e0e7ff;
    color: #4f46e5;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
}

/* Status */
.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 500;
}

.status-badge i {
    font-size: 0.625rem;
}

/* Actions */
.action-buttons {
    display: flex;
    gap: 0.25rem;
    justify-content: center;
}

.action-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: #f1f5f9;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.action-btn:hover {
    background: #e2e8f0;
    color: #475569;
}

.action-btn.success:hover {
    background: #dcfce7;
    color: #16a34a;
}
.action-btn.warning:hover {
    background: #fef3c7;
    color: #d97706;
}
.action-btn.danger:hover {
    background: #fee2e2;
    color: #dc2626;
}

/* Empty */
.empty-cell {
    text-align: center;
    padding: 3rem !important;
    color: #94a3b8;
}

.empty-cell i {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    display: block;
}

/* ===== Pagination ===== */
.pagination-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    margin-top: 1rem;
    flex-wrap: wrap;
    gap: 1rem;
}

.pagination-info {
    font-size: 0.875rem;
    color: #64748b;
}

/* ===== Dialog ===== */
.dialog-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #1e293b;
}

.dialog-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
}

/* Drop zone */
.drop-zone {
    border: 2px dashed #cbd5e1;
    border-radius: 12px;
    padding: 2rem;
    text-align: center;
    background: #f8fafc;
    cursor: pointer;
    transition: all 0.2s;
}

.drop-zone:hover,
.drop-zone--active {
    border-color: #6366f1;
    background: #eef2ff;
}

.drop-icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 0.75rem;
    border-radius: 50%;
    background: white;
    border: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6366f1;
    font-size: 1.5rem;
}

.drop-text {
    font-size: 0.875rem;
    color: #475569;
    margin: 0;
}

.drop-link {
    color: #6366f1;
    text-decoration: underline;
}

.drop-file {
    margin: 0.75rem 0 0;
    font-size: 0.875rem;
    color: #16a34a;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}

.drop-hint {
    margin: 0.5rem 0 0;
    font-size: 0.75rem;
    color: #94a3b8;
}

/* Template info */
.template-info {
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.template-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #475569;
    margin-bottom: 0.5rem;
}

.template-cols {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0;
    line-height: 1.5;
}
</style>
