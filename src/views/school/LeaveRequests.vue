<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';

import Swal from 'sweetalert2';

import { fetchClassesLite } from '@/service/classService.js';
import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser, getCurrentUsername, fetchCurrentUsername } from '@/service/authService.js';
import { fetchLeaveRequests, updateLeaveRequestStatus } from '@/service/leaveService.js';

/**
 * Status cho đơn xin nghỉ
 * NEW: mới gửi
 * APPROVED: đã duyệt
 * REJECTED: từ chối
 * CANCELLED: phụ huynh tự hủy (nếu có)
 */
const STATUS = {
    NEW: { key: 'NEW', label: 'Mới gửi', color: 'info' },
    APPROVED: { key: 'APPROVED', label: 'Đã duyệt', color: 'success' },
    REJECTED: { key: 'REJECTED', label: 'Từ chối', color: 'danger' },
    CANCELLED: { key: 'CANCELLED', label: 'Đã hủy', color: 'secondary' }
};

const auth = useAuthStore();

/* Lấy username người xử lý */
const currentUser = ref('system');
async function ensureUsername() {
    const fromStore = getUsernameFromUser(auth?.user);
    if (fromStore) {
        currentUser.value = fromStore;
        return;
    }
    const fromLocal = getCurrentUsername();
    if (fromLocal) {
        currentUser.value = fromLocal;
        return;
    }
    const fromApi = await fetchCurrentUsername();
    currentUser.value = fromApi || 'system';
}
watch(
    () => auth.user,
    () => {
        ensureUsername();
    },
    { immediate: true }
);

/* Lớp */
const classes = ref([]);
const selectedClassId = ref(null);

/* Filters */
const keyword = ref(''); // tên học sinh / phụ huynh
const statusFilter = ref('ALL');
const dateFrom = ref(null);
const dateTo = ref(null);

/* Data */
const loading = ref(false);
const rows = ref([]);
const detailVisible = ref(false);
const detailItem = ref(null);

/* SweetAlert toast */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true
});

function formatDate(val) {
    if (!val) return '';
    const d = val instanceof Date ? val : new Date(val);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN');
}
function formatDateTime(val) {
    if (!val) return '';
    const d = val instanceof Date ? val : new Date(val);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('vi-VN');
}

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

function toYMD(d) {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/* Load list từ BE */
async function load() {
    loading.value = true;
    try {
        const params = {
            classId: selectedClassId.value || undefined,
            status: statusFilter.value === 'ALL' ? undefined : statusFilter.value,
            keyword: keyword.value || undefined,
            fromDate: dateFrom.value ? toYMD(dateFrom.value) : undefined,
            toDate: dateTo.value ? toYMD(dateTo.value) : undefined
        };
        const list = await fetchLeaveRequests(params);
        rows.value = Array.isArray(list) ? list : [];
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được danh sách đơn xin nghỉ'
        });
    } finally {
        loading.value = false;
    }
}

const filteredRows = computed(() => rows.value);

/* Đổi trạng thái đơn */
async function changeStatus(row, newStatus) {
    if (!row?.id) return;
    if (row.status === newStatus) return;

    const oldStatus = row.status;
    row.status = newStatus;

    try {
        await updateLeaveRequestStatus(row.id, {
            status: newStatus,
            processedBy: currentUser.value
        });
        swalToast.fire({
            icon: 'success',
            title: newStatus === 'APPROVED' ? 'Đã duyệt đơn' : newStatus === 'REJECTED' ? 'Đã từ chối đơn' : 'Đã cập nhật trạng thái'
        });
    } catch (e) {
        row.status = oldStatus;
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Cập nhật trạng thái thất bại'
        });
    }
}

function openDetail(row) {
    detailItem.value = row;
    detailVisible.value = true;
}

onMounted(async () => {
    await ensureUsername();
    await loadClasses();
    await load();
});

/* Tự reload khi đổi filter cơ bản */
watch([selectedClassId, statusFilter], () => {
    load();
});
watch([dateFrom, dateTo], () => {
    load();
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-8 py-5 space-y-5 relative">
        <!-- Loading overlay -->
        <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm">
            <i class="fa-solid fa-spinner fa-spin mr-2"></i>
            Đang tải đơn xin nghỉ...
        </div>

        <!-- Header -->
        <div class="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <i class="fa-regular fa-file-lines text-2xl text-primary"></i>
                <div>
                    <h1 class="text-xl font-semibold text-slate-800">Đơn xin nghỉ học</h1>
                    <p class="text-sm text-slate-500">Xem và xử lý đơn xin nghỉ của học sinh theo lớp.</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <Tag severity="info" :value="`Người xử lý: ${currentUser}`" />
                <Button class="!bg-slate-200 !border-0 !text-slate-800" icon="fa-solid fa-rotate mr-2" label="Tải lại" :disabled="loading" @click="load" />
            </div>
        </div>

        <!-- Filters -->
        <Card class="border border-slate-200 rounded-xl">
            <template #content>
                <div class="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div class="md:col-span-2">
                        <label class="field-label">Lớp</label>
                        <Dropdown v-model="selectedClassId" :options="classes" optionLabel="name" optionValue="id" class="w-full" placeholder="Tất cả lớp" />
                    </div>
                    <div>
                        <label class="field-label">Từ ngày</label>
                        <Calendar v-model="dateFrom" dateFormat="dd/mm/yy" showIcon class="w-full" />
                    </div>
                    <div>
                        <label class="field-label">Đến ngày</label>
                        <Calendar v-model="dateTo" dateFormat="dd/mm/yy" showIcon class="w-full" />
                    </div>
                    <div>
                        <label class="field-label">Trạng thái</label>
                        <Dropdown
                            v-model="statusFilter"
                            :options="[
                                { label: 'Tất cả', value: 'ALL' },
                                ...Object.values(STATUS).map((s) => ({
                                    label: s.label,
                                    value: s.key
                                }))
                            ]"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                        />
                    </div>
                    <div>
                        <label class="field-label">Tìm kiếm</label>
                        <InputText v-model="keyword" class="w-full" placeholder="Tên học sinh / phụ huynh" @keyup.enter="load" />
                    </div>
                </div>
            </template>
        </Card>

        <!-- Table -->
        <div class="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <table class="min-w-full text-sm">
                <thead class="bg-slate-50 border-b">
                    <tr class="text-slate-600">
                        <th class="px-3 py-3 w-12 text-left">#</th>
                        <th class="px-3 py-3 text-left min-w-[180px]">Học sinh</th>
                        <th class="px-3 py-3 text-left min-w-[160px]">Lớp</th>
                        <th class="px-3 py-3 text-left min-w-[140px]">Ngày nghỉ</th>
                        <th class="px-3 py-3 text-left min-w-[220px]">Lý do</th>
                        <th class="px-3 py-3 text-center w-40">Trạng thái</th>
                        <th class="px-3 py-3 text-center w-40">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(r, idx) in filteredRows" :key="r.id" class="border-b last:border-0 hover:bg-slate-50">
                        <td class="px-3 py-3 text-slate-500">{{ idx + 1 }}</td>
                        <td class="px-3 py-3">
                            <div class="font-semibold text-slate-800">
                                {{ r.studentName }}
                            </div>
                            <div class="text-xs text-slate-500">
                                Phụ huynh:
                                <b>{{ r.parentName || '-' }}</b>
                            </div>
                        </td>
                        <td class="px-3 py-3 text-slate-700">
                            {{ r.className || '-' }}
                        </td>
                        <td class="px-3 py-3">
                            <div class="text-sm text-slate-800">
                                {{ formatDate(r.fromDate) }}
                                <span v-if="r.toDate"> – {{ formatDate(r.toDate) }} </span>
                            </div>
                        </td>
                        <td class="px-3 py-3">
                            <div class="line-clamp-2 text-slate-700">
                                {{ r.reason || '—' }}
                            </div>
                        </td>
                        <td class="px-3 py-3 text-center">
                            <Tag :severity="STATUS[r.status]?.color || 'secondary'" :value="STATUS[r.status]?.label || r.status || 'Không rõ'" />
                        </td>
                        <td class="px-3 py-3 text-center">
                            <div class="flex flex-col gap-1 items-stretch">
                                <Button class="!bg-slate-100 !border-0 !text-slate-800 text-xs" label="Xem chi tiết" @click="openDetail(r)" />
                                <div class="flex gap-1 justify-center">
                                    <Button v-if="r.status === 'NEW'" class="!bg-emerald-600 !border-0 !text-white text-xs" label="Duyệt" @click="changeStatus(r, 'APPROVED')" />
                                    <Button v-if="r.status === 'NEW'" class="!bg-rose-500 !border-0 !text-white text-xs" label="Từ chối" @click="changeStatus(r, 'REJECTED')" />
                                </div>
                            </div>
                        </td>
                    </tr>

                    <tr v-if="!loading && !filteredRows.length">
                        <td colspan="7" class="px-3 py-4 text-center text-slate-500">Không có đơn xin nghỉ nào.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Detail dialog -->
        <Dialog v-model:visible="detailVisible" modal :style="{ width: '520px', maxWidth: '95vw' }" :header="detailItem ? `Đơn xin nghỉ: ${detailItem.studentName}` : 'Chi tiết đơn'">
            <div v-if="detailItem" class="space-y-3 text-sm">
                <div class="border-b pb-2">
                    <div class="font-semibold text-slate-800">
                        {{ detailItem.studentName }}
                    </div>
                    <div class="text-xs text-slate-500">Lớp: {{ detailItem.className || '-' }}</div>
                </div>
                <div>
                    <span class="font-medium">Phụ huynh:</span>
                    {{ detailItem.parentName || '-' }}
                </div>
                <div>
                    <span class="font-medium">Khoảng thời gian nghỉ:</span>
                    {{ formatDate(detailItem.fromDate) }}
                    <span v-if="detailItem.toDate"> – {{ formatDate(detailItem.toDate) }} </span>
                </div>
                <div>
                    <span class="font-medium">Lý do:</span>
                    <div class="mt-1 bg-slate-50 rounded-lg px-3 py-2">
                        {{ detailItem.reason || '—' }}
                    </div>
                </div>
                <div>
                    <span class="font-medium">Trạng thái:</span>
                    <Tag class="ml-2" :severity="STATUS[detailItem.status]?.color || 'secondary'" :value="STATUS[detailItem.status]?.label || detailItem.status || 'Không rõ'" />
                </div>
                <div>
                    <span class="font-medium">Ngày gửi:</span>
                    {{ formatDateTime(detailItem.createdAt) }}
                </div>
                <div v-if="detailItem.processedBy">
                    <span class="font-medium">Người xử lý:</span>
                    {{ detailItem.processedBy }}
                </div>
            </div>
        </Dialog>
    </div>
</template>

<style scoped>
.field-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #4b5563;
    margin-bottom: 4px;
}
</style>
