<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';
import * as XLSX from 'xlsx';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Paginator from 'primevue/paginator';
import Menu from 'primevue/menu';
import Dialog from 'primevue/dialog';

import Swal from 'sweetalert2';

import { fetchParents, exportParentsExcel, lockParents, unlockParents, deleteParents, importParentsFromExcel } from '@/service/parentService.js';
import ParentUpsertModal from '@/components/staff/ParentUpsertModal.vue';

/* =================== LIST STATE =================== */
const loadingInit = ref(false);
const loadingList = ref(false);

const rows = ref([]);
const totalRecords = ref(0);

const page = ref(1);
const size = ref(50);
const sortField = ref('');
const sortOrder = ref(1);

const fSearch = ref('');

/* status tabs + counters */
const counts = ref({ total: 0, active: 0, blocked: 0 });
const currentTab = ref('all');
const statusTabs = computed(() => [
    { key: 'all', label: `Tất cả (${counts.value.total})`, bg: '' },
    { key: 'active', label: `Hoạt động (${counts.value.active})`, bg: 'tab--green' },
    { key: 'blocked', label: `Đã khóa (${counts.value.blocked})`, bg: 'tab--red' }
]);

/* selection + row menu */
const selection = ref([]);
const rowMenu = ref();
const activeRow = ref(null);

function openRowMenu(event, row) {
    activeRow.value = row;
    rowMenu.value?.toggle(event);
}

/* =================== UPSERT MODAL =================== */
const showUpsert = ref(false);
const editing = ref(null);

function onCreate() {
    editing.value = null;
    showUpsert.value = true;
}
function onEdit() {
    if (!activeRow.value) return;
    editing.value = activeRow.value;
    showUpsert.value = true;
}
function onView() {
    if (!activeRow.value) return;
    editing.value = activeRow.value;
    showUpsert.value = true;
}
async function onAfterUpsert(payload) {
    // Đóng modal trước để tránh toast nằm phía sau
    showUpsert.value = false;

    // Reload lại list
    await load(false);

    // Thông báo thành công
    await swalToast.fire({
        icon: 'success',
        title: payload?.id ? 'Cập nhật phụ huynh thành công' : 'Thêm phụ huynh thành công'
    });
}

/* =================== IMPORT EXCEL MODAL =================== */
const showImportModal = ref(false);
const importLoading = ref(false);
const dragOver = ref(false);
const selectedFile = ref(null);
const fileInputRef = ref(null);

function openImportModal() {
    selectedFile.value = null;
    dragOver.value = false;
    showImportModal.value = true;
}
function closeImportModal() {
    if (importLoading.value) return;
    showImportModal.value = false;
    selectedFile.value = null;
}

/* SweetAlert toasts */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true
});

function confirmDialog(title, text, { confirmText = 'Xác nhận', icon = 'warning' } = {}) {
    return Swal.fire({
        title,
        text,
        icon,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        reverseButtons: true
    });
}

function statusSeverity(row) {
    return row.statusKey === 'blocked' ? 'danger' : 'success';
}
function statusText(row) {
    return row.status || (row.statusKey === 'blocked' ? 'Đã khóa' : 'Hoạt động');
}

/* =================== LOAD LIST =================== */
async function load(isInit = false) {
    if (isInit) loadingInit.value = true;
    else loadingList.value = true;
    try {
        const sort = sortField.value ? `${sortField.value},${sortOrder.value === -1 ? 'desc' : 'asc'}` : undefined;
        const {
            items,
            total,
            counts: cts
        } = await fetchParents({
            q: fSearch.value || undefined,
            status: currentTab.value,
            page: page.value,
            size: size.value,
            sort
        });
        rows.value = items;
        totalRecords.value = total;
        counts.value = cts;
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được danh sách phụ huynh'
        });
    } finally {
        if (isInit) loadingInit.value = false;
        else loadingList.value = false;
    }
}

/* sort & paginate & tabs */
function onSort(field) {
    if (sortField.value === field) {
        sortOrder.value = sortOrder.value === 1 ? -1 : 1;
    } else {
        sortField.value = field;
        sortOrder.value = 1;
    }
    page.value = 1;
    load(false);
}
function onChangePage(e) {
    page.value = e.page + 1;
    size.value = e.rows;
    load(false);
}
function switchTab(k) {
    currentTab.value = k;
    page.value = 1;
    load(false);
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

/* =================== ROW ACTIONS =================== */
async function onLock() {
    if (!activeRow.value?.id) return;
    const { isConfirmed } = await confirmDialog('Khóa tài khoản phụ huynh?', `${activeRow.value.name} (${activeRow.value.phone || activeRow.value.email || '-'})`, { confirmText: 'Khóa' });
    if (!isConfirmed) return;

    try {
        await lockParents([activeRow.value.id]);
        swalToast.fire({ icon: 'success', title: 'Đã khóa tài khoản' });
        await load(false);
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Khóa tài khoản thất bại' });
    }
}

async function onUnlock() {
    if (!activeRow.value?.id) return;
    const { isConfirmed } = await confirmDialog('Mở khóa tài khoản phụ huynh?', `${activeRow.value.name} (${activeRow.value.phone || activeRow.value.email || '-'})`, { confirmText: 'Mở khóa' });
    if (!isConfirmed) return;

    try {
        await unlockParents([activeRow.value.id]);
        swalToast.fire({ icon: 'success', title: 'Đã mở khóa tài khoản' });
        await load(false);
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Mở khóa tài khoản thất bại' });
    }
}

async function onDelete() {
    if (!activeRow.value?.id) return;
    const { isConfirmed } = await confirmDialog('Xóa phụ huynh?', `Bạn có chắc muốn xóa phụ huynh "${activeRow.value.name}"? Thao tác không thể hoàn tác.`, { confirmText: 'Xóa', icon: 'warning' });
    if (!isConfirmed) return;

    try {
        await deleteParents([activeRow.value.id]);
        swalToast.fire({ icon: 'success', title: 'Đã xóa phụ huynh' });
        await load(false);
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Xóa phụ huynh thất bại' });
    }
}

/* =================== BULK ACTIONS =================== */
async function doBulk(action) {
    const ids = selection.value.map((x) => x.id);
    if (!ids.length) {
        swalToast.fire({ icon: 'info', title: 'Chưa chọn phụ huynh nào' });
        return;
    }

    if (action === 'lock') {
        const { isConfirmed } = await confirmDialog('Khóa tài khoản đã chọn?', `Sẽ khóa ${ids.length} phụ huynh.`, { confirmText: 'Khóa' });
        if (!isConfirmed) return;
        try {
            await lockParents(ids);
            swalToast.fire({ icon: 'success', title: 'Đã khóa tài khoản đã chọn' });
            selection.value = [];
            await load(false);
        } catch (e) {
            swalToast.fire({ icon: 'error', title: e?.message || 'Khóa tài khoản thất bại' });
        }
    } else if (action === 'unlock') {
        const { isConfirmed } = await confirmDialog('Mở khóa tài khoản đã chọn?', `Sẽ mở khóa ${ids.length} phụ huynh.`, { confirmText: 'Mở khóa' });
        if (!isConfirmed) return;
        try {
            await unlockParents(ids);
            swalToast.fire({ icon: 'success', title: 'Đã mở khóa tài khoản đã chọn' });
            selection.value = [];
            await load(false);
        } catch (e) {
            swalToast.fire({ icon: 'error', title: e?.message || 'Mở khóa tài khoản thất bại' });
        }
    } else if (action === 'delete') {
        const { isConfirmed } = await confirmDialog('Xóa phụ huynh đã chọn?', `Bạn có chắc muốn xóa ${ids.length} phụ huynh? Thao tác không thể hoàn tác.`, { confirmText: 'Xóa', icon: 'warning' });
        if (!isConfirmed) return;
        try {
            await deleteParents(ids);
            swalToast.fire({ icon: 'success', title: 'Đã xóa phụ huynh đã chọn' });
            selection.value = [];
            await load(false);
        } catch (e) {
            swalToast.fire({ icon: 'error', title: e?.message || 'Xóa phụ huynh thất bại' });
        }
    }
}

/* =================== ROW MENU MODEL =================== */
const rowMenuModel = ref([
    {
        label: 'Xem chi tiết',
        icon: 'fa-regular fa-eye',
        tone: 'primary',
        sub: 'Thông tin tài khoản & con đang học',
        command: () => onView()
    },
    {
        label: 'Sửa phụ huynh',
        icon: 'fa-regular fa-pen-to-square',
        tone: 'info',
        sub: 'Chỉnh sửa tên, liên hệ, email...',
        command: () => onEdit()
    },
    { separator: true },
    {
        label: 'Khóa tài khoản',
        icon: 'fa-solid fa-lock',
        tone: 'warn',
        sub: 'Ngăn đăng nhập & sử dụng app',
        command: () => onLock()
    },
    {
        label: 'Mở khóa',
        icon: 'fa-solid fa-unlock',
        tone: 'primary',
        sub: 'Cho phép đăng nhập trở lại',
        command: () => onUnlock()
    },
    { separator: true },
    {
        label: 'Xóa phụ huynh',
        icon: 'fa-regular fa-trash-can',
        tone: 'danger',
        sub: 'Không thể hoàn tác',
        command: () => onDelete()
    }
]);

/* =================== EXCEL TEMPLATE =================== */
function downloadTemplateExcel() {
    const headers = ['Họ và tên', 'Email', 'Số điện thoại', 'Giới tính', 'Ngày sinh', 'Nghề nghiệp', 'Mối quan hệ', 'Liên hệ khẩn cấp', 'Số điện thoại phụ'];

    // sheet dùng để BE import (DuLieu)
    const wsData = XLSX.utils.aoa_to_sheet([headers]);

    // sheet ví dụ (chỉ để tham khảo, BE không đọc)
    const exampleRow = ['Nguyễn Văn A', 'phuhuynhA@example.com', '0912345678', 'Nam', '01-01-1980', 'Kinh doanh', 'Ba', '0911222333', '0988777666'];
    const wsExample = XLSX.utils.aoa_to_sheet([headers, exampleRow]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData, 'DuLieu');
    XLSX.utils.book_append_sheet(wb, wsExample, 'Vi_du');

    XLSX.writeFile(wb, 'Mau_import_phu_huynh.xlsx');
}

/* =================== DRAG & DROP / CHỌN FILE =================== */
function onDrop(e) {
    e.preventDefault();
    dragOver.value = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) {
        selectedFile.value = file;
    }
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
    if (file) {
        selectedFile.value = file;
    }
}

/* =================== UPLOAD EXCEL =================== */
const requiredColsText = 'Họ và tên, Email, Số điện thoại, Giới tính, Ngày sinh, Nghề nghiệp, Mối quan hệ, Liên hệ khẩn cấp, Số điện thoại phụ';

async function uploadExcel() {
    if (!selectedFile.value) {
        swalToast.fire({ icon: 'info', title: 'Vui lòng chọn file Excel trước' });
        return;
    }

    importLoading.value = true;
    try {
        const res = await importParentsFromExcel(selectedFile.value);
        const apiStatus = res?.status;
        const apiMsg = res?.message || 'Kết quả import phụ huynh';
        const result = res?.data || {};
        const totalRecords = result.totalRecords ?? 0;
        const successCount = result.successCount ?? 0;
        const errorCount = result.errorCount ?? 0;
        const errorMessages = Array.isArray(result.errorMessages) ? result.errorMessages : [];

        let html = `
            <div style="text-align:left;font-size:14px;">
                <div><strong>Tổng bản ghi:</strong> ${totalRecords}</div>
                <div><strong>Thành công:</strong> ${successCount}</div>
                <div><strong>Lỗi:</strong> ${errorCount}</div>
            </div>
        `;

        if (errorMessages.length) {
            const topErrors = errorMessages.slice(0, 5).join('<br/>');
            html += `
                <hr/>
                <div style="max-height:160px;overflow:auto;text-align:left;font-size:12px;color:#b91c1c;">
                    <strong>Một số lỗi:</strong><br/>
                    ${topErrors}
                    ${errorMessages.length > 5 ? '<br/>...' : ''}
                </div>
            `;
        }

        // HẾT LOADING + RESET INPUT TRƯỚC
        importLoading.value = false;
        if (fileInputRef.value) fileInputRef.value.value = '';

        // ĐÓNG MODAL TRƯỚC ĐỂ Swal KHÔNG BỊ CHE
        closeImportModal();

        // Rồi mới hiển thị SweetAlert kết quả
        await Swal.fire({
            icon: apiStatus === 200 && successCount > 0 ? 'success' : 'warning',
            title: apiMsg,
            html
        });

        // Reload lại danh sách phụ huynh
        await load(false);
    } catch (err) {
        importLoading.value = false;
        if (fileInputRef.value) fileInputRef.value.value = '';

        await Swal.fire({
            icon: 'error',
            title: 'Import phụ huynh thất bại',
            text: err?.message || 'Đã xảy ra lỗi khi import'
        });
    }
}

/* =================== SEARCH DEBOUNCE =================== */
let t;
function debounce(fn, ms = 250) {
    clearTimeout(t);
    t = setTimeout(fn, ms);
}
watch(fSearch, () =>
    debounce(() => {
        page.value = 1;
        load(false);
    }, 300)
);

onMounted(() => load(true));
</script>

<template>
    <div class="px-4 md:px-6 lg:px-8 py-5 space-y-4">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-xl font-semibold text-slate-800">Phụ huynh</h1>
            <div class="flex items-center gap-2">
                <Button class="!bg-sky-600 !border-0 !text-white" icon="fa-solid fa-file-arrow-up mr-2" :label="importLoading ? 'Đang import...' : 'Nhập Excel'" :disabled="importLoading" @click="openImportModal" />
                <Button class="!bg-green-600 !border-0 !text-white" icon="fa-solid fa-file-arrow-down mr-2" label="Xuất excel" @click="onExport" />
                <Button class="!bg-primary !border-0 !text-white" icon="fa-solid fa-plus mr-2" label="Thêm phụ huynh" @click="onCreate" />
            </div>
        </div>

        <!-- Tabs -->
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-200">
            <button v-for="t in statusTabs" :key="t.key" class="tab" :class="[currentTab === t.key ? 'tab--active' : '', t.bg]" @click="switchTab(t.key)">
                <span>{{ t.label }}</span>
            </button>
        </div>

        <!-- Filters + bulk -->
        <div class="flex flex-wrap items-center gap-3 justify-between">
            <div class="flex-1 min-w-[240px]">
                <InputText v-model="fSearch" class="w-full" placeholder="Tìm tên/SĐT/Email..." />
            </div>
            <div class="flex items-center gap-2">
                <Button class="!bg-amber-500 !border-0 !text-white" icon="fa-solid fa-lock mr-2" label="Khóa" @click="doBulk('lock')" />
                <Button class="!bg-emerald-600 !border-0 !text-white" icon="fa-solid fa-unlock mr-2" label="Mở khóa" @click="doBulk('unlock')" />
                <Button class="!bg-rose-600 !border-0 !text-white" icon="fa-regular fa-trash-can mr-2" label="Xóa" @click="doBulk('delete')" />
            </div>
        </div>

        <!-- Table -->
        <div class="rounded-xl border border-slate-200 overflow-hidden bg-white relative">
            <!-- loading overlay -->
            <div v-if="loadingInit || loadingList" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải danh sách phụ huynh...</div>

            <DataTable :value="rows" v-model:selection="selection" dataKey="id" :rows="size" responsiveLayout="scroll" :rowHover="true" class="p-datatable-sm">
                <Column selectionMode="multiple" headerStyle="width: 3rem" />
                <Column header="#" :body="(_, opt) => opt.rowIndex + 1" headerStyle="width: 4rem" />

                <!-- Họ tên + username -->
                <Column>
                    <template #header>
                        <div class="header-filter">
                            <span class="font-semibold">Họ và tên</span>
                            <button class="sort-btn" @click="onSort('name')" title="Sắp xếp theo tên">
                                <i class="fa-solid fa-up-down"></i>
                            </button>
                        </div>
                    </template>
                    <template #body="{ data }">
                        <div class="font-semibold text-slate-900">{{ data.name }}</div>
                        <div class="text-slate-500 text-sm">@{{ data.username }}</div>
                    </template>
                </Column>

                <!-- Liên hệ -->
                <Column header="Liên hệ">
                    <template #body="{ data }">
                        <div class="text-slate-900"><i class="fa-solid fa-phone"></i> {{ data.phone || '-' }}</div>
                        <div class="text-slate-500 text-sm"><i class="fa-regular fa-envelope"></i> {{ data.email || '-' }}</div>
                    </template>
                </Column>

                <!-- Con đang học -->
                <Column header="Con đang học">
                    <template #body="{ data }">
                        <div class="flex flex-wrap gap-1">
                            <Tag v-for="(st, idx) in data.studentNames" :key="idx" class="!bg-slate-100 !text-slate-700 !border-0">
                                {{ st }}
                            </Tag>
                            <span v-if="!data.studentNames?.length" class="text-slate-400">-</span>
                        </div>
                    </template>
                </Column>

                <!-- Trạng thái -->
                <Column header="Trạng thái" headerStyle="width: 140px;">
                    <template #body="{ data }">
                        <Tag :severity="statusSeverity(data)">{{ statusText(data) }}</Tag>
                    </template>
                </Column>

                <!-- Hành động -->
                <Column header="Hành động" headerStyle="width: 64px; text-align: right;" bodyStyle="text-align: right;">
                    <template #body="{ data }">
                        <Button icon="fa-solid fa-ellipsis-vertical" class="!bg-transparent !border-0 !text-slate-600 hover:!bg-slate-100" @click="(e) => openRowMenu(e, data)" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Pagination -->
        <div class="border-t border-slate-200 mt-2 flex justify-end">
            <Paginator :rows="size" :totalRecords="totalRecords" :rowsPerPageOptions="[50,100]" @page="onChangePage" />
        </div>

        <!-- Row menu -->
        <Menu ref="rowMenu" :model="rowMenuModel" :popup="true" appendTo="body" :pt="{ menu: { class: 'rowmenu-panel' } }">
            <template #item="{ item, props }">
                <div v-if="item.separator" class="rowmenu-sep"></div>
                <button
                    v-else
                    type="button"
                    v-bind="props.action"
                    class="menu-item"
                    :class="{
                        'menu-item--danger': item.tone === 'danger',
                        'menu-item--warn': item.tone === 'warn',
                        'menu-item--info': item.tone === 'info',
                        'menu-item--primary': item.tone === 'primary'
                    }"
                    @click="item.command && item.command()"
                >
                    <span class="menu-item__icon">
                        <i :class="item.icon"></i>
                    </span>
                    <div class="flex-1 min-w-0 text-left">
                        <div class="menu-item__label truncate">{{ item.label }}</div>
                        <div v-if="item.sub" class="menu-item__sub truncate">{{ item.sub }}</div>
                    </div>
                </button>
            </template>
        </Menu>

        <!-- Modal thêm / sửa / xem phụ huynh -->
        <ParentUpsertModal v-model:modelValue="showUpsert" :parent="editing" @saved="onAfterUpsert" />

        <!-- ============ IMPORT EXCEL MODAL ============ -->
        <Dialog v-model:visible="showImportModal" modal header="Nhập danh sách phụ huynh" :style="{ width: '650px', maxWidth: '95vw' }" :breakpoints="{ '960px': '90vw', '640px': '95vw' }">
            <div class="space-y-4">
                <!-- Khu vực kéo thả -->
                <div class="import-dropzone" :class="{ 'import-dropzone--over': dragOver }" @drop="onDrop" @dragover="onDragOver" @dragleave="onDragLeave" @dragend="onDragLeave">
                    <div class="import-dropzone__inner" @click="chooseFile">
                        <div class="import-dropzone__icon">
                            <i class="fa-solid fa-cloud-arrow-up fa-2x"></i>
                        </div>
                        <p class="import-dropzone__text">
                            Kéo thả file Excel vào đây hoặc
                            <span class="import-dropzone__link">chọn file từ hệ thống</span>
                        </p>
                        <p v-if="selectedFile" class="import-dropzone__filename">
                            File đã chọn: <strong>{{ selectedFile.name }}</strong>
                        </p>
                        <p v-else class="import-dropzone__filename text-slate-400">Chưa có file nào được chọn</p>
                    </div>
                    <input ref="fileInputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="onFileChange" />
                </div>

                <!-- Hướng dẫn cột -->
                <div class="text-xs text-slate-600">
                    <textarea class="w-full border border-slate-200 rounded-lg p-2 text-xs bg-slate-50" rows="2" readonly>{{ requiredColsText }}</textarea>
                </div>

                <!-- Buttons -->
                <div class="flex justify-between items-center pt-2">
                    <Button class="!bg-slate-200 !border-0 !text-slate-700 px-4" label="Đóng" @click="closeImportModal" :disabled="importLoading" />
                    <div class="flex gap-2">
                        <Button class="!bg-emerald-600 !border-0 !text-white px-4" icon="fa-solid fa-download mr-2" label="Tải mẫu Excel Import" @click="downloadTemplateExcel" :disabled="importLoading" />
                        <Button class="!bg-primary !border-0 !text-white px-4" icon="fa-solid fa-cloud-arrow-up mr-2" :label="importLoading ? 'Đang tải lên...' : 'Tải lên'" :disabled="importLoading" @click="uploadExcel" />
                    </div>
                </div>
            </div>
        </Dialog>
    </div>
</template>

<style scoped>
.tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    color: #0f172a;
    border-bottom: 2px solid transparent;
    border-radius: 8px 8px 0 0;
    background: transparent;
}
.tab--active {
    border-color: #2563eb;
    color: #1d4ed8;
    background: #eef2ff;
}
.tab--green.tab--active {
    background: #bbf7d0;
}
.tab--red.tab--active {
    background: #fecaca;
}

/* Header filter */
.header-filter {
    display: flex;
    align-items: center;
    gap: 8px;
}
.sort-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
}
.sort-btn:hover {
    background: #f1f5f9;
}

/* Menu hành động */
:deep(.rowmenu-panel) {
    padding: 6px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    box-shadow:
        0 10px 15px -3px rgba(15, 23, 42, 0.15),
        0 4px 6px -4px rgba(15, 23, 42, 0.1);
    min-width: 240px;
}
.rowmenu-sep {
    height: 1px;
    background: #e5e7eb;
    margin: 6px 4px;
}
.menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    border: none;
    background: transparent;
    cursor: pointer;
}
.menu-item:hover {
    background: #f8fafc;
}
.menu-item__icon {
    width: 26px;
    height: 26px;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #e5e7eb;
    color: #0f172a;
    flex-shrink: 0;
}
.menu-item--primary .menu-item__icon {
    background: #eff6ff;
    color: #2563eb;
}
.menu-item--info .menu-item__icon {
    background: #ecfeff;
    color: #0ea5e9;
}
.menu-item--warn .menu-item__icon {
    background: #fffbeb;
    color: #f59e0b;
}
.menu-item--danger .menu-item__icon {
    background: #fef2f2;
    color: #dc2626;
}
.menu-item__label {
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
}
.menu-item__sub {
    font-size: 12px;
    color: #64748b;
}

/* Import modal styles */
.import-dropzone {
    border: 2px dashed #cbd5e1;
    border-radius: 12px;
    padding: 26px 18px;
    text-align: center;
    background: #f8fafc;
    cursor: pointer;
    transition:
        background 0.15s ease,
        border-color 0.15s ease;
}
.import-dropzone--over {
    background: #e0f2fe;
    border-color: #38bdf8;
}
.import-dropzone__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}
.import-dropzone__icon {
    width: 56px;
    height: 56px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    color: #0ea5e9;
    border: 1px solid #bae6fd;
    margin-bottom: 4px;
}
.import-dropzone__text {
    font-size: 13px;
    color: #0f172a;
}
.import-dropzone__link {
    color: #2563eb;
    text-decoration: underline;
    margin-left: 4px;
}
.import-dropzone__filename {
    font-size: 12px;
    margin-top: 4px;
}
</style>
