<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import Card from 'primevue/card';

import Swal from 'sweetalert2';

import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser, getCurrentUsername, fetchCurrentUsername } from '@/service/authService.js';

// ✅ Lấy lớp theo giáo viên đăng nhập
import { fetchMyTeacherClasses } from '@/service/teacherService.js';

// ✅ SERVICE LEAVE REQUEST (đã gắn token trong http.js)
import { fetchPendingLeaveRequestsByClass, approveLeaveRequest, rejectLeaveRequest } from '@/service/leaveRequestService.js';

/**
 * Status cho đơn xin nghỉ (theo enum LeaveRequestStatus)
 * PENDING: đang chờ duyệt
 * APPROVED: đã duyệt
 * REJECTED: từ chối
 * CANCELLED: phụ huynh tự hủy
 */
const STATUS = {
    PENDING: { key: 'PENDING', label: 'Đang chờ duyệt', color: 'warning' },
    APPROVED: { key: 'APPROVED', label: 'Đã duyệt', color: 'success' },
    REJECTED: { key: 'REJECTED', label: 'Từ chối', color: 'danger' },
    CANCELLED: { key: 'CANCELLED', label: 'Đã hủy', color: 'secondary' }
};

const statusOptions = [
    { label: 'Tất cả', value: 'ALL' },
    { label: STATUS.PENDING.label, value: STATUS.PENDING.key }
];

const auth = useAuthStore();

/* Lấy username người xử lý để gửi cho backend (teacherName) */
const currentUser = ref('system');
async function ensureUsername() {
    try {
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
    } catch {
        currentUser.value = 'system';
    }
}
watch(
    () => auth.user,
    () => {
        ensureUsername();
    },
    { immediate: true }
);

/* Lớp chỉ của giáo viên đang đăng nhập */
const classes = ref([]); // [{ id, name }]
const selectedClassId = ref(null);

/* Filters (lọc trên FE) */
const keyword = ref(''); // tên học sinh / phụ huynh
const statusFilter = ref('ALL');
const dateFrom = ref(null);
const dateTo = ref(null);

/* Data */
const loading = ref(false);
const rows = ref([]); // dữ liệu gốc từ backend
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

function toYMD(d) {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/* 🔹 Lấy danh sách lớp theo giáo viên đang đăng nhập */
async function loadClasses() {
    try {
        const list = await fetchMyTeacherClasses(); // ApiResponse<List<ClassResponse>>
        classes.value = (list || []).map((c) => ({
            id: c.id,
            name: c.className || c.name || `Lớp ${c.id}`
        }));

        if (!selectedClassId.value && classes.value.length) {
            selectedClassId.value = classes.value[0].id;
        }
    } catch (e) {
        console.error(e);
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được danh sách lớp của giáo viên. Có thể phiên đăng nhập đã hết hạn.'
        });
    }
}

/* 🔹 Load list từ BE: /leave-requests/teachers/classes/{classId}/pending */
async function load() {
    if (!selectedClassId.value) {
        rows.value = [];
        return;
    }
    loading.value = true;
    try {
        // ✅ service đã trả về mảng, không còn res.data.data
        const list = await fetchPendingLeaveRequestsByClass(selectedClassId.value);
        rows.value = Array.isArray(list) ? list : [];
    } catch (e) {
        console.error(e);
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được danh sách đơn xin nghỉ'
        });
    } finally {
        loading.value = false;
    }
}

/* Lọc trên FE theo keyword, status, từ ngày - đến ngày */
const filteredRows = computed(() => {
    let data = rows.value || [];

    // Lọc theo keyword (tên học sinh / phụ huynh)
    if (keyword.value) {
        const kw = keyword.value.toLowerCase().trim();
        data = data.filter((r) => {
            return (r.studentName && r.studentName.toLowerCase().includes(kw)) || (r.parentName && r.parentName.toLowerCase().includes(kw));
        });
    }

    // Lọc theo trạng thái (hiện tại backend teacher chỉ trả PENDING)
    if (statusFilter.value !== 'ALL') {
        data = data.filter((r) => r.status === statusFilter.value);
    }

    // Lọc theo ngày nghỉ (leaveDate)
    if (dateFrom.value) {
        const from = new Date(toYMD(dateFrom.value));
        data = data.filter((r) => {
            const d = new Date(r.leaveDate);
            return !Number.isNaN(d.getTime()) && d >= from;
        });
    }

    if (dateTo.value) {
        const to = new Date(toYMD(dateTo.value));
        data = data.filter((r) => {
            const d = new Date(r.leaveDate);
            return !Number.isNaN(d.getTime()) && d <= to;
        });
    }

    return data;
});

/* Helper lấy meta status */
function getStatusMeta(status) {
    return STATUS[status] || { label: status || '-', color: 'info' };
}

/* Duyệt / từ chối đơn (gọi đúng API approve/reject) */
async function changeStatus(row, newStatus) {
    if (!row?.id) return;
    if (row.status === newStatus) return;

    // Xác nhận
    const confirmText = newStatus === 'APPROVED' ? 'Bạn có chắc muốn DUYỆT đơn xin nghỉ này?' : 'Bạn có chắc muốn TỪ CHỐI đơn xin nghỉ này?';

    const result = await Swal.fire({
        icon: 'question',
        title: 'Xác nhận',
        text: confirmText,
        showCancelButton: true,
        confirmButtonText: newStatus === 'APPROVED' ? 'Duyệt' : 'Từ chối',
        cancelButtonText: 'Hủy',
        confirmButtonColor: newStatus === 'APPROVED' ? '#16a34a' : '#dc2626',
        heightAuto: false
    });
    if (!result.isConfirmed) return;

    try {
        if (newStatus === 'APPROVED') {
            await approveLeaveRequest(row.id, currentUser.value, row.teacherNote || '');
            swalToast.fire({
                icon: 'success',
                title: 'Đã duyệt đơn xin nghỉ'
            });
        } else if (newStatus === 'REJECTED') {
            await rejectLeaveRequest(row.id, currentUser.value, row.teacherNote || '');
            swalToast.fire({
                icon: 'warning',
                title: 'Đã từ chối đơn xin nghỉ'
            });
        } else {
            return;
        }

        // Reload lại danh sách pending, đơn đã xử lý sẽ biến mất
        await load();
        if (detailVisible.value) {
            detailVisible.value = false;
        }
    } catch (e) {
        console.error(e);
        swalToast.fire({
            icon: 'error',
            title: e?.response?.data?.message || e?.message || 'Cập nhật trạng thái thất bại'
        });
    }
}

function openDetail(row) {
    detailItem.value = row;
    detailVisible.value = true;
}

onMounted(async () => {
    await ensureUsername();
    await loadClasses(); // khi set selectedClassId, watch bên dưới sẽ tự gọi load()
});

/* Chỉ reload khi đổi lớp */
watch(selectedClassId, () => {
    if (selectedClassId.value) {
        load();
    }
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-8 py-5 space-y-4 leave-page">
        <!-- Header -->
        <div class="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between">
            <div>
                <h1 class="text-xl font-semibold text-slate-800">Đơn xin nghỉ học</h1>
                <p class="text-sm text-slate-500 mt-1">Giáo viên duyệt đơn xin nghỉ theo từng lớp đang phụ trách.</p>
            </div>
            <div class="hidden md:flex flex-col items-end text-xs text-slate-500">
                <span
                    >Người xử lý: <b>{{ currentUser }}</b></span
                >
            </div>
        </div>

        <!-- Bộ lọc -->
        <div class="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <!-- Chọn lớp -->
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">Lớp phụ trách</label>
                    <Dropdown v-model="selectedClassId" :options="classes" optionLabel="name" optionValue="id" placeholder="Chọn lớp" class="w-full" />
                    <p v-if="!classes.length" class="mt-1 text-[11px] text-amber-600">Tài khoản giáo viên hiện chưa được gán lớp nào hoặc bạn chưa có quyền xem lớp.</p>
                </div>

                <!-- Trạng thái -->
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">Trạng thái</label>
                    <Dropdown v-model="statusFilter" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>

                <!-- Tìm kiếm -->
                <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">Tìm kiếm</label>
                    <InputText v-model="keyword" class="w-full" placeholder="Tên học sinh hoặc phụ huynh" />
                </div>

                <!-- Từ ngày / Đến ngày -->
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-xs font-medium text-slate-600 mb-1">Từ ngày</label>
                        <Calendar v-model="dateFrom" dateFormat="dd/mm/yy" class="w-full" showIcon />
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-slate-600 mb-1">Đến ngày</label>
                        <Calendar v-model="dateTo" dateFormat="dd/mm/yy" class="w-full" showIcon />
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-between pt-1">
                <div class="text-xs text-slate-500">
                    Tổng đơn đang hiển thị:
                    <b>{{ filteredRows.length }}</b>
                </div>
                <div class="flex gap-2">
                    <Button class="!bg-slate-100 !border-0 !text-slate-700 text-xs" icon="fa-solid fa-rotate mr-2" :label="loading ? 'Đang tải...' : 'Tải lại'" :disabled="loading" @click="load" />
                </div>
            </div>
        </div>

        <!-- Danh sách đơn -->
        <div class="space-y-3">
            <div v-if="loading" class="border border-slate-200 rounded-xl bg-white px-4 py-6 flex items-center justify-center text-sm text-slate-500">
                <i class="fa-solid fa-spinner fa-spin mr-2"></i>
                Đang tải danh sách đơn xin nghỉ...
            </div>

            <div v-else-if="!filteredRows.length" class="border border-dashed border-slate-300 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Không có đơn xin nghỉ nào phù hợp với bộ lọc hiện tại.</div>

            <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Card v-for="req in filteredRows" :key="req.id" class="leave-card border border-slate-200 hover:border-indigo-300 hover:shadow-md transition cursor-pointer" @click="openDetail(req)">
                    <template #title>
                        <div class="flex items-start justify-between gap-2">
                            <div>
                                <div class="text-sm font-semibold text-slate-800">
                                    {{ req.studentName }}
                                </div>
                                <div class="text-xs text-slate-500">Mã HS: {{ req.studentCode }} · Lớp: {{ req.className }}</div>
                            </div>
                            <Tag v-if="req.status" :value="getStatusMeta(req.status).label" :severity="getStatusMeta(req.status).color" class="text-[11px]" />
                        </div>
                    </template>

                    <template #content>
                        <div class="space-y-1 text-xs text-slate-600">
                            <div>
                                <span class="font-medium">Phụ huynh:</span>
                                <span> {{ req.parentName }}</span>
                            </div>
                            <div>
                                <span class="font-medium">Ngày nghỉ:</span>
                                <span> {{ formatDate(req.leaveDate) }}</span>
                            </div>
                            <div>
                                <span class="font-medium">Lý do:</span>
                                <span> {{ req.reason || '(Không ghi rõ)' }}</span>
                            </div>
                            <div class="text-[11px] text-slate-400 mt-1">Gửi lúc: {{ formatDateTime(req.createdAt) }}</div>
                        </div>

                        <div class="flex justify-end gap-2 mt-3">
                            <Button v-if="req.status === 'PENDING'" class="!bg-emerald-600 !border-0 !text-white !text-xs" icon="fa-solid fa-check mr-2" label="Duyệt" @click.stop="changeStatus(req, 'APPROVED')" />
                            <Button v-if="req.status === 'PENDING'" class="!bg-rose-500 !border-0 !text-white !text-xs" icon="fa-solid fa-xmark mr-2" label="Từ chối" @click.stop="changeStatus(req, 'REJECTED')" />
                        </div>
                    </template>
                </Card>
            </div>
        </div>

        <!-- Dialog chi tiết đơn -->
        <Dialog v-model:visible="detailVisible" modal :style="{ width: '520px', maxWidth: '95vw' }" contentClass="leave-detail-dialog">
            <template #header>
                <div class="flex flex-col">
                    <div class="text-base font-semibold text-slate-800">Chi tiết đơn xin nghỉ</div>
                    <div v-if="detailItem" class="text-xs text-slate-500 mt-0.5">
                        Học sinh: <b>{{ detailItem.studentName }}</b> · Lớp:
                        <b>{{ detailItem.className }}</b>
                    </div>
                </div>
            </template>

            <div v-if="detailItem" class="space-y-2 text-sm text-slate-700">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="font-medium">Học sinh:</span>
                        {{ detailItem.studentName }} ({{ detailItem.studentCode }})
                    </div>
                    <Tag :value="getStatusMeta(detailItem.status).label" :severity="getStatusMeta(detailItem.status).color" class="text-[11px]" />
                </div>

                <div><span class="font-medium">Lớp:</span> {{ detailItem.className }}</div>

                <div>
                    <span class="font-medium">Phụ huynh:</span>
                    {{ detailItem.parentName }}
                </div>

                <div>
                    <span class="font-medium">Ngày nghỉ:</span>
                    {{ formatDate(detailItem.leaveDate) }}
                </div>

                <div>
                    <span class="font-medium">Lý do:</span>
                    {{ detailItem.reason || '(Không ghi rõ)' }}
                </div>

                <div>
                    <span class="font-medium">Thời gian gửi:</span>
                    {{ formatDateTime(detailItem.createdAt) }}
                </div>

                <div v-if="detailItem.approvedBy">
                    <span class="font-medium">Người xử lý:</span>
                    {{ detailItem.approvedBy }} ·
                    <span class="font-medium">Lúc:</span>
                    {{ formatDateTime(detailItem.approvedAt) }}
                </div>

                <div v-if="detailItem.teacherNote">
                    <span class="font-medium">Ghi chú của giáo viên:</span>
                    {{ detailItem.teacherNote }}
                </div>
            </div>

            <template #footer>
                <div class="flex justify-between items-center w-full">
                    <Button label="Đóng" class="p-button-text !text-slate-600" @click="detailVisible = false" />
                    <div class="flex gap-2">
                        <Button v-if="detailItem && detailItem.status === 'PENDING'" class="!bg-emerald-600 !border-0 !text-white !text-xs" icon="fa-solid fa-check mr-2" label="Duyệt" @click="changeStatus(detailItem, 'APPROVED')" />
                        <Button v-if="detailItem && detailItem.status === 'PENDING'" class="!bg-rose-500 !border-0 !text-white !text-xs" icon="fa-solid fa-xmark mr-2" label="Từ chối" @click="changeStatus(detailItem, 'REJECTED')" />
                    </div>
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.leave-page {
    background: #f8fafc;
    min-height: 100vh;
}

.leave-card :deep(.p-card-body) {
    padding: 12px 14px 10px;
}

/* Dialog */
.leave-detail-dialog {
    padding-top: 0.75rem;
}
</style>
