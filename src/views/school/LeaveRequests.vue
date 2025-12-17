<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Calendar from 'primevue/calendar';
import Dialog from 'primevue/dialog';

import Swal from 'sweetalert2';

import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser, getCurrentUsername, fetchCurrentUsername } from '@/service/authService.js';
import { fetchMyTeacherClasses } from '@/service/teacherService.js';
import {
    fetchPendingLeaveRequestsByClass,
    approveLeaveRequest,
    rejectLeaveRequest,
    fetchAllLeaveRequestsForAdmin
} from '@/service/leaveRequestService.js';

const STATUS = {
    PENDING: { key: 'PENDING', label: 'Chờ duyệt', class: 'status-pending' },
    APPROVED: { key: 'APPROVED', label: 'Đã duyệt', class: 'status-approved' },
    REJECTED: { key: 'REJECTED', label: 'Từ chối', class: 'status-rejected' },
    CANCELLED: { key: 'CANCELLED', label: 'Đã hủy', class: 'status-cancelled' }
};

const statusOptions = [
    { label: 'Tất cả trạng thái', value: 'ALL' },
    { label: 'Chờ duyệt', value: 'PENDING' },
    { label: 'Đã duyệt', value: 'APPROVED' },
    { label: 'Từ chối', value: 'REJECTED' },
    { label: 'Đã hủy', value: 'CANCELLED' }
];

const auth = useAuthStore();

/* ===================== USER / ROLE ===================== */

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

const userRole = computed(() => {
    const raw =
        auth?.user?.role ||
        auth?.user?.roleName ||
        auth?.user?.role_code ||
        auth?.user?.role?.name;

    if (typeof raw === 'string') return raw.toUpperCase();
    if (raw && typeof raw.name === 'string') return raw.name.toUpperCase();
    return '';
});

const isTeacher = computed(
    () =>
        userRole.value === 'TEACHER' ||
        userRole.value === 'ROLE_TEACHER' ||
        userRole.value.includes('TEACHER')
);

const isAdmin = computed(
    () =>
        userRole.value === 'ADMIN' ||
        userRole.value === 'ROLE_ADMIN' ||
        userRole.value.includes('ADMIN')
);

/* ===================== STATE ===================== */

const classes = ref([]);
const selectedClassId = ref(null); // cho giáo viên
const keyword = ref('');
const statusFilter = ref('ALL');
const dateFrom = ref(null);
const dateTo = ref(null);
const loading = ref(false);
const rows = ref([]);
const detailVisible = ref(false);
const detailItem = ref(null);

// Lọc theo lớp cho ADMIN (All classes)
const classFilter = ref('ALL');

/* ===================== COMMON HELPERS ===================== */

const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
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

/* ===================== LOAD DATA TEACHER + ADMIN ===================== */

async function loadTeacherClasses() {
    try {
        const list = await fetchMyTeacherClasses();
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
            title: e?.message || 'Không tải được danh sách lớp'
        });
    }
}

async function loadTeacherRequests() {
    if (!selectedClassId.value) {
        rows.value = [];
        return;
    }
    loading.value = true;
    try {
        const list = await fetchPendingLeaveRequestsByClass(selectedClassId.value);
        rows.value = Array.isArray(list) ? list : [];
    } catch (e) {
        console.error(e);
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được danh sách đơn'
        });
    } finally {
        loading.value = false;
    }
}

async function loadAdminRequests() {
    loading.value = true;
    try {
        const list = await fetchAllLeaveRequestsForAdmin();
        rows.value = Array.isArray(list) ? list : [];
    } catch (e) {
        console.error(e);
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được danh sách đơn'
        });
    } finally {
        loading.value = false;
    }
}

/** Hàm load chung cho nút "Tải lại" */
async function load() {
    if (isTeacher.value) {
        await loadTeacherRequests();
    } else if (isAdmin.value) {
        await loadAdminRequests();
    } else {
        rows.value = [];
    }
}

/* ===================== FILTER / GROUP ===================== */

// options lớp cho ADMIN (build từ dữ liệu)
const classFilterOptions = computed(() => {
    const list = rows.value || [];
    const names = Array.from(new Set(list.map((r) => r.className).filter(Boolean)));
    return [
        { label: 'Tất cả lớp', value: 'ALL' },
        ...names.map((name) => ({ label: name, value: name }))
    ];
});

const filteredRows = computed(() => {
    let data = rows.value || [];

    // Lọc theo lớp cho ADMIN
    if (classFilter.value !== 'ALL') {
        data = data.filter((r) => r.className === classFilter.value);
    }

    if (keyword.value) {
        const kw = keyword.value.toLowerCase().trim();
        data = data.filter(
            (r) =>
                (r.studentName && r.studentName.toLowerCase().includes(kw)) ||
                (r.parentName && r.parentName.toLowerCase().includes(kw))
        );
    }

    if (statusFilter.value !== 'ALL') {
        data = data.filter((r) => r.status === statusFilter.value);
    }

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

// kiểm tra đơn quá hạn duyệt: tất cả ngày nghỉ đều < hôm nay và vẫn PENDING
function isOverdueGroup(group) {
    if (!group?.items?.length) return false;
    if (group.status !== 'PENDING') return false;

    const today = new Date(toYMD(new Date())); // hôm nay 00:00
    return group.items.every((item) => {
        if (!item.leaveDate) return false;
        const d = new Date(item.leaveDate);
        if (Number.isNaN(d.getTime())) return false;
        return d < today;
    });
}

const groupedRows = computed(() => {
    const map = new Map();

    (filteredRows.value || []).forEach((r) => {
        if (!r) return;
        const explicitGroupId = r.groupId || r.groupCode || r.requestGroupId || r.batchId;
        const createdDay = r.createdAt ? toYMD(r.createdAt) : '';
        const key =
            explicitGroupId ||
            `${r.studentCode || r.studentName || ''}|${r.parentName || ''}|${r.className || ''}|${
                r.reason || ''
            }|${createdDay}`;

        if (!map.has(key)) {
            map.set(key, {
                key,
                studentName: r.studentName,
                studentCode: r.studentCode,
                className: r.className,
                parentName: r.parentName,
                reason: r.reason,
                createdAt: r.createdAt,
                items: []
            });
        }

        const g = map.get(key);
        g.items.push(r);

        if (r.createdAt && (!g.createdAt || new Date(r.createdAt) < new Date(g.createdAt))) {
            g.createdAt = r.createdAt;
        }
    });

    const groups = Array.from(map.values());

    groups.forEach((g) => {
        // sort ngày xin nghỉ trong group
        g.items.sort((a, b) => new Date(a.leaveDate) - new Date(b.leaveDate));
        g.firstLeaveDate = g.items.length ? g.items[0].leaveDate : g.createdAt;

        const statuses = Array.from(new Set(g.items.map((it) => it.status)));
        g.status = statuses.includes('PENDING') ? 'PENDING' : statuses[0] || null;

        // ngày dùng để sort: ưu tiên createdAt mới nhất trong group
        const latestCreated = g.items.reduce((max, it) => {
            if (!it.createdAt) return max;
            const d = new Date(it.createdAt);
            if (Number.isNaN(d.getTime())) return max;
            if (!max || d > max) return d;
            return max;
        }, null);

        g.orderDate =
            latestCreated || (g.firstLeaveDate ? new Date(g.firstLeaveDate) : new Date(0));
    });

    // Đơn mới nhất (orderDate mới nhất) lên đầu
    groups.sort((a, b) => b.orderDate - a.orderDate);

    return groups;
});

const stats = computed(() => {
    const all = rows.value || [];
    return {
        total: groupedRows.value.length,
        pending: groupedRows.value.filter((g) => g.status === 'PENDING').length,
        totalDays: all.length
    };
});

function formatDatesSummary(group) {
    if (!group?.items?.length) return '';
    const dates = group.items
        .map((it) => (it.leaveDate ? new Date(it.leaveDate) : null))
        .filter((d) => d && !Number.isNaN(d.getTime()))
        .sort((a, b) => a - b);

    if (!dates.length) return '';
    if (dates.length === 1) return formatDate(dates[0]);

    // kiểm tra liên tiếp
    let isContinuous = true;
    for (let i = 1; i < dates.length; i++) {
        const diffDays = Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
        if (diffDays !== 1) {
            isContinuous = false;
            break;
        }
    }

    if (isContinuous) {
        return `${formatDate(dates[0])} → ${formatDate(dates[dates.length - 1])}`;
    }

    const firstTwo = dates.slice(0, 2).map((d) => formatDate(d));
    let text = firstTwo.join(', ');
    if (dates.length > 2) text += ` (+${dates.length - 2})`;
    return text;
}

function getStatusMeta(status) {
    return STATUS[status] || { label: status || '-', class: '' };
}

// meta status cho GROUP (xử lý thêm trạng thái quá hạn)
function getGroupStatusMeta(group) {
    if (!group) return { label: '-', class: '' };
    if (isOverdueGroup(group)) {
        return { label: 'Quá hạn duyệt', class: 'status-expired' };
    }
    return getStatusMeta(group.status);
}

/* ===================== ACTIONS ===================== */

function normalizeItemsForChange(target) {
    if (!target) return [];
    if (Array.isArray(target)) return target;
    if (target.items && Array.isArray(target.items)) return target.items;
    return [target];
}

async function changeStatus(target, newStatus) {
    const itemsAll = normalizeItemsForChange(target);
    if (!itemsAll.length) return;

    const pendingItems = itemsAll.filter((it) => it.status === 'PENDING');
    if (!pendingItems.length) return;

    const count = pendingItems.length;
    const actionText = newStatus === 'APPROVED' ? 'duyệt' : 'từ chối';

    const result = await Swal.fire({
        icon: 'question',
        title: `Xác nhận ${actionText}? `,
        text:
            count > 1
                ? `${count} ngày nghỉ sẽ được ${actionText}.`
                : `Đơn xin nghỉ này sẽ được ${actionText}.`,
        showCancelButton: true,
        confirmButtonText: newStatus === 'APPROVED' ? 'Duyệt' : 'Từ chối',
        cancelButtonText: 'Hủy',
        confirmButtonColor: newStatus === 'APPROVED' ? '#10b981' : '#ef4444'
    });

    if (!result.isConfirmed) return;

    try {
        for (const row of pendingItems) {
            if (!row?.id) continue;
            if (newStatus === 'APPROVED') {
                await approveLeaveRequest(row.id, currentUser.value, row.teacherNote || '');
            } else {
                await rejectLeaveRequest(row.id, currentUser.value, row.teacherNote || '');
            }
        }

        swalToast.fire({
            icon: 'success',
            title: newStatus === 'APPROVED' ? 'Đã duyệt đơn' : 'Đã từ chối đơn'
        });

        await load();
        detailVisible.value = false;
    } catch (e) {
        console.error(e);
        swalToast.fire({ icon: 'error', title: e?.message || 'Thao tác thất bại' });
    }
}

function openDetail(group) {
    detailItem.value = group;
    detailVisible.value = true;
}

function clearFilters() {
    keyword.value = '';
    statusFilter.value = 'ALL';
    dateFrom.value = null;
    dateTo.value = null;
    classFilter.value = 'ALL';
}

/* ===================== LIFECYCLE ===================== */

// Mounted: chỉ cần đảm bảo username, còn load dữ liệu sẽ xử lý trong watch auth.user
onMounted(async () => {
    await ensureUsername();
});

/**
 * Khi thông tin user (auth.user) thay đổi / sẵn sàng:
 *  - Nếu là giáo viên: tải danh sách lớp mình dạy + đơn chờ duyệt của lớp đầu tiên
 *  - Nếu là admin: tải toàn bộ đơn trong trường
 */
watch(
    () => auth.user,
    async () => {
        await ensureUsername();

        if (isTeacher.value) {
            await loadTeacherClasses();
            await loadTeacherRequests();
        } else if (isAdmin.value) {
            await loadAdminRequests();
        } else {
            rows.value = [];
        }
    },
    { immediate: true }
);

/** Khi giáo viên đổi lớp trong combobox -> load lại đơn của lớp đó */
watch(selectedClassId, () => {
    if (selectedClassId.value && isTeacher.value) {
        loadTeacherRequests();
    }
});

</script>

<template>
    <div class="leave-page">
        <!-- Header -->
        <div class="page-header">
            <div class="header-left">
                <h1>Đơn xin nghỉ học</h1>
                <p v-if="isTeacher">Duyệt đơn xin nghỉ của học sinh trong lớp phụ trách</p>
                <p v-else-if="isAdmin">Xem và quản lý tất cả đơn xin nghỉ trong trường</p>
                <p v-else>Quản lý đơn xin nghỉ học</p>
            </div>
            <div class="header-right">
                <span class="user-badge">
                    <i class="fa-solid fa-user-tie"></i>
                    {{ currentUser }}
                </span>
            </div>
        </div>

        <!-- Stats -->
        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-icon total">
                    <i class="fa-solid fa-file-lines"></i>
                </div>
                <div class="stat-info">
                    <div class="stat-value">{{ stats.total }}</div>
                    <div class="stat-label">Tổng đơn</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon pending">
                    <i class="fa-solid fa-clock"></i>
                </div>
                <div class="stat-info">
                    <div class="stat-value">{{ stats.pending }}</div>
                    <div class="stat-label">Chờ duyệt</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon days">
                    <i class="fa-solid fa-calendar-days"></i>
                </div>
                <div class="stat-info">
                    <div class="stat-value">{{ stats.totalDays }}</div>
                    <div class="stat-label">Ngày nghỉ</div>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="filter-section">
            <div class="filter-grid">
                <!-- Lớp phụ trách: chỉ hiện cho giáo viên -->
                <div v-if="isTeacher" class="filter-item">
                    <label>Lớp phụ trách</label>
                    <Dropdown
                        v-model="selectedClassId"
                        :options="classes"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Chọn lớp"
                        class="w-full"
                    />
                </div>

                <!-- Lọc theo lớp: chỉ hiện cho admin -->
                <div v-if="isAdmin" class="filter-item">
                    <label>Lớp</label>
                    <Dropdown
                        v-model="classFilter"
                        :options="classFilterOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Tất cả lớp"
                        class="w-full"
                    />
                </div>

                <div class="filter-item">
                    <label>Trạng thái</label>
                    <Dropdown
                        v-model="statusFilter"
                        :options="statusOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                    />
                </div>

                <div class="filter-item">
                    <label>Tìm kiếm</label>
                    <InputText v-model="keyword" placeholder="Tên học sinh, phụ huynh..." class="w-full" />
                </div>

                <div class="filter-item filter-dates">
                    <div class="date-field">
                        <label>Từ ngày</label>
                        <Calendar v-model="dateFrom" dateFormat="dd/mm/yy" showIcon class="w-full" />
                    </div>
                    <div class="date-field">
                        <label>Đến ngày</label>
                        <Calendar v-model="dateTo" dateFormat="dd/mm/yy" showIcon class="w-full" />
                    </div>
                </div>
            </div>

            <div class="filter-actions">
                <span class="filter-result">
                    Hiển thị <strong>{{ groupedRows.length }}</strong> đơn
                </span>
                <div class="action-btns">
                    <button class="btn-icon" @click="clearFilters" title="Xóa bộ lọc">
                        <i class="fa-solid fa-eraser"></i>
                    </button>
                    <button class="btn-icon" :disabled="loading" @click="load" title="Tải lại">
                        <i class="fa-solid fa-rotate" :class="{ 'fa-spin': loading }"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- List -->
        <div class="list-section">
            <!-- Loading -->
            <div v-if="loading" class="loading-state">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Đang tải...</span>
            </div>

            <!-- Empty -->
            <div v-else-if="!groupedRows.length" class="empty-state">
                <i class="fa-solid fa-inbox"></i>
                <p>Không có đơn xin nghỉ nào</p>
            </div>

            <!-- Cards -->
            <div v-else class="leave-list">
                <div
                    v-for="group in groupedRows"
                    :key="group.key"
                    class="leave-card"
                    :class="{
                        'is-pending': group.status === 'PENDING',
                        'is-overdue': isOverdueGroup(group)
                    }"
                    @click="openDetail(group)"
                >
                    <div class="card-left">
                        <div class="student-avatar">
                            {{ group.studentName?.charAt(0) || '?' }}
                        </div>
                    </div>

                    <div class="card-body">
                        <div class="card-header">
                            <div class="student-name">{{ group.studentName }}</div>
                            <span class="status-badge" :class="getGroupStatusMeta(group).class">
                                {{ getGroupStatusMeta(group).label }}
                            </span>
                        </div>

                        <div class="card-meta">
                            <span>
                                <i class="fa-solid fa-id-card"></i>
                                {{ group.studentCode }}
                            </span>
                            <span>
                                <i class="fa-solid fa-school"></i>
                                {{ group.className }}
                            </span>
                        </div>

                        <div class="card-details">
                            <div class="detail-row">
                                <i class="fa-solid fa-user"></i>
                                <span>{{ group.parentName }}</span>
                            </div>
                            <div class="detail-row">
                                <i class="fa-regular fa-calendar"></i>
                                <span>{{ formatDatesSummary(group) }}</span>
                                <span class="days-count">{{ group.items.length }} ngày</span>
                            </div>
                            <div class="detail-row reason">
                                <i class="fa-solid fa-message"></i>
                                <span>{{ group.reason || 'Không ghi lý do' }}</span>
                            </div>
                        </div>

                        <div class="card-time">
                            <i class="fa-regular fa-clock"></i>
                            {{ formatDateTime(group.createdAt) }}
                        </div>
                    </div>

                    <!-- Giáo viên không thấy nút nếu đơn đã quá hạn -->
                    <div
                        class="card-actions"
                        v-if="group.status === 'PENDING' && !(isTeacher && isOverdueGroup(group))"
                        @click.stop
                    >
                        <button
                            class="action-approve"
                            @click="changeStatus(group, 'APPROVED')"
                            title="Duyệt"
                        >
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button
                            class="action-reject"
                            @click="changeStatus(group, 'REJECTED')"
                            title="Từ chối"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Detail Dialog -->
        <Dialog
            v-model:visible="detailVisible"
            modal
            :style="{ width: '480px', maxWidth: '95vw' }"
            class="detail-dialog"
        >
            <template #header>
                <div class="dialog-header">
                    <h3>Chi tiết đơn xin nghỉ</h3>
                </div>
            </template>

            <div v-if="detailItem" class="dialog-content">
                <!-- Student Info -->
                <div class="info-section">
                    <div class="info-header">
                        <div class="info-avatar">
                            {{ detailItem.studentName?.charAt(0) || '?' }}
                        </div>
                        <div class="info-main">
                            <div class="info-name">{{ detailItem.studentName }}</div>
                            <div class="info-sub">
                                {{ detailItem.studentCode }} · {{ detailItem.className }}
                            </div>
                        </div>
                        <span class="status-badge" :class="getGroupStatusMeta(detailItem).class">
                            {{ getGroupStatusMeta(detailItem).label }}
                        </span>
                    </div>
                </div>

                <!-- Details -->
                <div class="detail-list">
                    <div class="detail-item">
                        <i class="fa-solid fa-user"></i>
                        <div>
                            <div class="label">Phụ huynh</div>
                            <div class="value">{{ detailItem.parentName }}</div>
                        </div>
                    </div>
                    <div class="detail-item">
                        <i class="fa-solid fa-message"></i>
                        <div>
                            <div class="label">Lý do</div>
                            <div class="value">{{ detailItem.reason || 'Không ghi lý do' }}</div>
                        </div>
                    </div>
                    <div class="detail-item">
                        <i class="fa-regular fa-clock"></i>
                        <div>
                            <div class="label">Thời gian gửi</div>
                            <div class="value">{{ formatDateTime(detailItem.createdAt) }}</div>
                        </div>
                    </div>
                </div>

                <!-- Days Table -->
                <div class="days-section">
                    <div class="section-title">
                        Các ngày xin nghỉ ({{ detailItem.items.length }})
                    </div>
                    <div class="days-table">
                        <div v-for="(item, idx) in detailItem.items" :key="item.id" class="day-row">
                            <span class="day-index">{{ idx + 1 }}</span>
                            <span class="day-date">{{ formatDate(item.leaveDate) }}</span>
                            <span class="status-badge small" :class="getStatusMeta(item.status).class">
                                {{ getStatusMeta(item.status).label }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <button class="btn-secondary" @click="detailVisible = false">Đóng</button>
                    <div
                        v-if="
                            detailItem?.status === 'PENDING' &&
                            !(isTeacher && isOverdueGroup(detailItem))
                        "
                        class="footer-actions"
                    >
                        <button class="btn-reject" @click="changeStatus(detailItem, 'REJECTED')">
                            <i class="fa-solid fa-xmark"></i>
                            Từ chối
                        </button>
                        <button class="btn-approve" @click="changeStatus(detailItem, 'APPROVED')">
                            <i class="fa-solid fa-check"></i>
                            Duyệt
                        </button>
                    </div>
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.leave-page {
    min-height: 100vh;
    background: #f8fafc;
    padding: 24px;
}

/* Header */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
}

.header-left h1 {
    font-size: 24px;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
}

.header-left p {
    font-size: 14px;
    color: #64748b;
    margin: 4px 0 0;
}

.user-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 13px;
    color: #475569;
}

.user-badge i {
    color: #64748b;
}

/* Stats */
.stats-row {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
}

.stat-card {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
}

.stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
}

.stat-icon.total {
    background: #e0e7ff;
    color: #4f46e5;
}

.stat-icon.pending {
    background: #fef3c7;
    color: #d97706;
}

.stat-icon.days {
    background: #dbeafe;
    color: #2563eb;
}

.stat-value {
    font-size: 24px;
    font-weight: 700;
    color: #1e293b;
}

.stat-label {
    font-size: 13px;
    color: #64748b;
}

/* Filters */
.filter-section {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
}

.filter-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
}

.filter-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.filter-item label {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
}

.filter-dates {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.date-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.filter-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #f1f5f9;
}

.filter-result {
    font-size: 13px;
    color: #64748b;
}

.action-btns {
    display: flex;
    gap: 8px;
}

.btn-icon {
    width: 36px;
    height: 36px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.btn-icon:hover {
    background: #f8fafc;
    color: #475569;
}

/* List */
.list-section {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
    min-height: 400px;
}

.loading-state,
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: #94a3b8;
}

.loading-state i,
.empty-state i {
    font-size: 32px;
    margin-bottom: 12px;
}

.empty-state p {
    margin: 0;
    font-size: 14px;
}

/* Leave Cards */
.leave-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.leave-card {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.leave-card:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.leave-card.is-pending {
    border-left: 3px solid #f59e0b;
}

.leave-card.is-overdue {
    opacity: 0.7;
}

.card-left {
    flex-shrink: 0;
}

.student-avatar {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
    color: #4f46e5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
}

.card-body {
    flex: 1;
    min-width: 0;
}

.card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
}

.student-name {
    font-size: 15px;
    font-weight: 600;
    color: #1e293b;
}

.card-meta {
    display: flex;
    gap: 16px;
    margin-bottom: 10px;
    font-size: 12px;
    color: #64748b;
}

.card-meta span {
    display: flex;
    align-items: center;
    gap: 6px;
}

.card-meta i {
    font-size: 11px;
    color: #94a3b8;
}

.card-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
}

.detail-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #475569;
}

.detail-row i {
    width: 14px;
    color: #94a3b8;
    font-size: 12px;
}

.detail-row.reason {
    color: #64748b;
}

.days-count {
    margin-left: auto;
    padding: 2px 8px;
    background: #f1f5f9;
    border-radius: 4px;
    font-size: 11px;
    color: #64748b;
}

.card-time {
    font-size: 11px;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 6px;
}

.card-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
}

.action-approve,
.action-reject {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.2s;
}

.action-approve {
    background: #d1fae5;
    color: #059669;
}

.action-approve:hover {
    background: #10b981;
    color: #fff;
}

.action-reject {
    background: #fee2e2;
    color: #dc2626;
}

.action-reject:hover {
    background: #ef4444;
    color: #fff;
}

/* Status Badges */
.status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
}

.status-badge.small {
    padding: 2px 8px;
    font-size: 10px;
}

.status-pending {
    background: #fef3c7;
    color: #b45309;
}

.status-approved {
    background: #d1fae5;
    color: #047857;
}

.status-rejected {
    background: #fee2e2;
    color: #b91c1c;
}

.status-cancelled {
    background: #f1f5f9;
    color: #64748b;
}

.status-expired {
    background: #e5e7eb;
    color: #6b7280;
}

/* Dialog */
.dialog-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
}

.dialog-content {
    padding: 0;
}

.info-section {
    padding-bottom: 16px;
    border-bottom: 1px solid #f1f5f9;
    margin-bottom: 16px;
}

.info-header {
    display: flex;
    align-items: center;
    gap: 14px;
}

.info-avatar {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
    color: #4f46e5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
}

.info-main {
    flex: 1;
}

.info-name {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
}

.info-sub {
    font-size: 13px;
    color: #64748b;
    margin-top: 2px;
}

.detail-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 20px;
}

.detail-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.detail-item i {
    width: 16px;
    margin-top: 2px;
    color: #94a3b8;
}

.detail-item .label {
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 2px;
}

.detail-item .value {
    font-size: 14px;
    color: #1e293b;
}

.days-section {
    background: #f8fafc;
    border-radius: 10px;
    padding: 14px;
}

.section-title {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 12px;
}

.days-table {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.day-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: #fff;
    border-radius: 8px;
}

.day-index {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: #e2e8f0;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
}

.day-date {
    flex: 1;
    font-size: 14px;
    color: #1e293b;
}

/* Dialog Footer */
.dialog-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.footer-actions {
    display: flex;
    gap: 10px;
}

.btn-secondary,
.btn-approve,
.btn-reject {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
}

.btn-secondary {
    background: #f1f5f9;
    color: #64748b;
}

.btn-secondary:hover {
    background: #e2e8f0;
}

.btn-approve {
    background: #10b981;
    color: #fff;
}

.btn-approve:hover {
    background: #059669;
}

.btn-reject {
    background: #ef4444;
    color: #fff;
}

.btn-reject:hover {
    background: #dc2626;
}

/* Responsive */
@media (max-width: 1024px) {
    .filter-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 768px) {
    .leave-page {
        padding: 16px;
    }

    .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }

    .stats-row {
        flex-direction: column;
    }

    .filter-grid {
        grid-template-columns: 1fr;
    }

    .filter-dates {
        grid-template-columns: 1fr;
    }

    .leave-card {
        flex-direction: column;
    }

    .card-actions {
        flex-direction: row;
        width: 100%;
    }

    .action-approve,
    .action-reject {
        flex: 1;
    }
}
</style>
