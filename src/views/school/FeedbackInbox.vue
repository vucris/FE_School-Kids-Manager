<script setup>
import { ref, computed, onMounted } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Paginator from 'primevue/paginator';
import Dialog from 'primevue/dialog';

import Swal from 'sweetalert2';

import { fetchFeedbacks, updateFeedbackStatus, deleteFeedback } from '@/service/feedback.js';
import { fetchClassOptions } from '@/service/classService.js';
import { fetchTeacherClasses } from '@/service/teacherService.js';
import { useAuthStore } from '@/stores/auth.js';

/* ========== AUTH & ROLE ========== */
const auth = useAuthStore();
const role = computed(() => (auth?.user?.role || auth?.user?.roles?.[0] || '').toUpperCase());

/* ========== STATE ========== */
const classes = ref([]);
const allowedClassIds = ref(null);
const feedbacks = ref([]);

const keywordParent = ref('');
const keywordStudent = ref('');
const selectedClass = ref(null);
const dateFilter = ref(null);
const statusFilter = ref(null);

const first = ref(0);
const rows = ref(10);

const loadingInit = ref(false);
const loadingList = ref(false);
const errorMessage = ref('');

// Dialog chi tiết
const detailVisible = ref(false);
const detailItem = ref(null);

const statusOptions = [
    { label: 'Tất cả trạng thái', value: null, icon: 'fa-list' },
    { label: 'Mới gửi', value: 'NEW', icon: 'fa-circle-plus', color: 'text-amber-500' },
    { label: 'Đang xử lý', value: 'PROCESSING', icon: 'fa-spinner', color: 'text-blue-500' },
    { label: 'Đã đóng', value: 'CLOSED', icon: 'fa-circle-check', color: 'text-emerald-500' }
];

const statusView = {
    NEW: { text: 'Mới gửi', class: 'status-new', icon: 'fa-circle-plus' },
    PROCESSING: { text: 'Đang xử lý', class: 'status-processing', icon: 'fa-spinner' },
    CLOSED: { text: 'Đã đóng', class: 'status-closed', icon: 'fa-circle-check' },
    PENDING: { text: 'Chờ xử lý', class: 'status-new', icon: 'fa-clock' }
};

/* ===== SweetAlert2 ===== */
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
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xác nhận',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        reverseButtons: true
    });
}

/* ========== COMPUTED ========== */
const filteredFeedbacks = computed(() => {
    // sort theo ngày gửi, mới nhất lên đầu
    let list = [...feedbacks.value].sort((a, b) => {
        const ra = a.messageDate || a.createdAt;
        const rb = b.messageDate || b.createdAt;

        const da = ra ? new Date(ra) : null;
        const db = rb ? new Date(rb) : null;

        // xử lý nếu thiếu ngày
        if (!da && !db) return 0;
        if (!db) return -1;
        if (!da) return 1;

        // DESC: mới > cũ
        return db - da;
    });

    if (Array.isArray(allowedClassIds.value) && allowedClassIds.value.length) {
        list = list.filter((f) => allowedClassIds.value.includes(f.classId));
    }

    if (selectedClass.value?.id) {
        list = list.filter((f) => f.classId === selectedClass.value.id);
    }

    if (statusFilter.value) {
        list = list.filter((f) => f.status === statusFilter.value);
    }

    if (dateFilter.value) {
        const filterDay = new Date(dateFilter.value);
        filterDay.setHours(0, 0, 0, 0);

        list = list.filter((f) => {
            const raw = f.messageDate || f.createdAt;
            if (!raw) return false;
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return false;
            d.setHours(0, 0, 0, 0);
            return d.getTime() === filterDay.getTime();
        });
    }

    const p = keywordParent.value.toLowerCase().trim();
    const s = keywordStudent.value.toLowerCase().trim();

    if (p) {
        list = list.filter((f) => (f.parentName || '').toLowerCase().includes(p));
    }
    if (s) {
        list = list.filter((f) => (f.studentName || '').toLowerCase().includes(s));
    }

    return list;
});


const pagedFeedbacks = computed(() => {
    const start = first.value;
    const end = first.value + rows.value;
    return filteredFeedbacks.value.slice(start, end);
});

// Thống kê
const statsData = computed(() => {
    const all = feedbacks.value.filter((f) => {
        if (Array.isArray(allowedClassIds.value) && allowedClassIds.value.length) {
            return allowedClassIds.value.includes(f.classId);
        }
        return true;
    });

    return {
        total: all.length,
        new: all.filter((f) => f.status === 'NEW' || f.status === 'PENDING').length,
        processing: all.filter((f) => f.status === 'PROCESSING').length,
        closed: all.filter((f) => f.status === 'CLOSED').length
    };
});

/* ========== METHODS ========== */
function onPageChange(e) {
    first.value = e.first;
    rows.value = e.rows;
}

function formatTime(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN');
}

function displayTime(feedback) {
    if (feedback.messageTime) return feedback.messageTime;
    const raw = feedback.messageDate || feedback.createdAt;
    return formatTime(raw);
}

function displayDate(feedback) {
    const raw = feedback.messageDate || feedback.createdAt;
    return formatDate(raw);
}

function getRelativeTime(feedback) {
    const raw = feedback.messageDate || feedback.createdAt;
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';

    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    return formatDate(raw);
}

async function loadFeedbacks({ showErrorToast = false } = {}) {
    loadingList.value = true;
    errorMessage.value = '';
    try {
        const data = await fetchFeedbacks();
        feedbacks.value = data || [];
    } catch (e) {
        console.error(e);
        const msg = e.message || 'Có lỗi xảy ra khi tải danh sách góp ý';
        errorMessage.value = msg;
        if (showErrorToast) {
            swalToast.fire({ icon: 'error', title: msg });
        }
    } finally {
        loadingList.value = false;
    }
}

async function loadClasses() {
    try {
        const r = role.value;
        if (r === 'TEACHER') {
            const myClasses = await fetchTeacherClasses();
            classes.value = myClasses.map((c) => ({
                id: c.id,
                name: c.className || c.name || c.class_code || ''
            }));
            allowedClassIds.value = classes.value.map((c) => c.id);
        } else {
            const opts = await fetchClassOptions();
            classes.value = (opts || []).map((o) => ({
                id: o.value,
                name: o.label
            }));
            allowedClassIds.value = null;
        }
    } catch (e) {
        console.warn('Không load được danh sách lớp:', e?.message || e);
        classes.value = [];
    }
}

async function init() {
    loadingInit.value = true;
    try {
        await Promise.all([loadClasses(), loadFeedbacks()]);
        dateFilter.value = new Date();
    } finally {
        loadingInit.value = false;
    }
}

async function changeStatus(item, newStatus) {
    const oldStatus = item.status;
    item.status = newStatus;
    try {
        await updateFeedbackStatus(item.id, newStatus);
        swalToast.fire({
            icon: 'success',
            title: newStatus === 'PROCESSING' ? 'Đã nhận xử lý góp ý' : newStatus === 'CLOSED' ? 'Đã hoàn thành góp ý' : 'Đã cập nhật trạng thái'
        });
    } catch (e) {
        item.status = oldStatus;
        console.error(e);
        swalToast.fire({
            icon: 'error',
            title: e.message || 'Không thể cập nhật trạng thái'
        });
    }
}

async function removeFeedback(item) {
    const { isConfirmed } = await confirmDialog('Xóa góp ý?', `Xóa góp ý của "${item.parentName || 'Phụ huynh'}"? Không thể hoàn tác.`);
    if (!isConfirmed) return;

    try {
        await deleteFeedback(item.id);
        feedbacks.value = feedbacks.value.filter((f) => f.id !== item.id);
        swalToast.fire({ icon: 'success', title: 'Đã xóa góp ý' });
    } catch (e) {
        console.error(e);
        swalToast.fire({ icon: 'error', title: e.message || 'Không thể xóa' });
    }
}

function openDetail(item) {
    detailItem.value = item;
    detailVisible.value = true;
}

function closeDetail() {
    detailVisible.value = false;
    detailItem.value = null;
}

function showTodayOnly() {
    dateFilter.value = new Date();
    first.value = 0;
}

function showAllDays() {
    dateFilter.value = null;
    first.value = 0;
}

function clearFilters() {
    keywordParent.value = '';
    keywordStudent.value = '';
    selectedClass.value = null;
    dateFilter.value = new Date();
    statusFilter.value = null;
    first.value = 0;
}

onMounted(init);
</script>

<template>
    <div class="feedback-page">
        <!-- Loading Overlay -->
        <div v-if="loadingInit" class="loading-overlay">
            <div class="loading-content">
                <i class="fa-solid fa-spinner fa-spin text-4xl text-primary mb-4"></i>
                <p>Đang tải dữ liệu góp ý...</p>
            </div>
        </div>

        <div v-else class="page-content">
            <!-- Header -->
            <div class="page-header">
                <div class="header-info">
                    <div class="header-icon">
                        <i class="fa-solid fa-comments"></i>
                    </div>
                    <div>
                        <h1 class="header-title">Hòm thư góp ý</h1>
                        <p class="header-desc">Tiếp nhận và xử lý ý kiến từ phụ huynh</p>
                    </div>
                </div>
                <div class="header-actions">
                    <Button icon="fa-solid fa-rotate-right" class="action-btn refresh" @click="loadFeedbacks({ showErrorToast: true })" :loading="loadingList" />
                </div>
            </div>

            <!-- Stats Cards -->
            <div class="stats-grid">
                <div class="stat-card total">
                    <div class="stat-icon">
                        <i class="fa-solid fa-inbox"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">{{ statsData.total }}</div>
                        <div class="stat-label">Tổng góp ý</div>
                    </div>
                </div>
                <div class="stat-card new">
                    <div class="stat-icon">
                        <i class="fa-solid fa-circle-plus"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">{{ statsData.new }}</div>
                        <div class="stat-label">Mới gửi</div>
                    </div>
                </div>
                <div class="stat-card processing">
                    <div class="stat-icon">
                        <i class="fa-solid fa-spinner"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">{{ statsData.processing }}</div>
                        <div class="stat-label">Đang xử lý</div>
                    </div>
                </div>
                <div class="stat-card closed">
                    <div class="stat-icon">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>
                    <div class="stat-info">
                        <div class="stat-value">{{ statsData.closed }}</div>
                        <div class="stat-label">Đã hoàn thành</div>
                    </div>
                </div>
            </div>

            <!-- Error Message -->
            <div v-if="errorMessage" class="error-banner">
                <i class="fa-solid fa-circle-exclamation"></i>
                <span>{{ errorMessage }}</span>
                <button @click="errorMessage = ''">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Filters -->
            <Card class="filter-card">
                <template #content>
                    <div class="filter-header">
                        <div class="filter-title">
                            <i class="fa-solid fa-filter"></i>
                            <span>Bộ lọc tìm kiếm</span>
                        </div>
                        <button class="clear-filter-btn" @click="clearFilters">
                            <i class="fa-solid fa-eraser"></i>
                            <span>Xóa bộ lọc</span>
                        </button>
                    </div>

                    <div class="filter-grid">
                        <div class="filter-item">
                            <label class="filter-label">
                                <i class="fa-solid fa-user"></i>
                                Phụ huynh
                            </label>
                            <InputText v-model="keywordParent" placeholder="Nhập tên phụ huynh..." class="filter-input" />
                        </div>

                        <div class="filter-item">
                            <label class="filter-label">
                                <i class="fa-solid fa-child"></i>
                                Học sinh
                            </label>
                            <InputText v-model="keywordStudent" placeholder="Nhập tên học sinh..." class="filter-input" />
                        </div>

                        <div class="filter-item">
                            <label class="filter-label">
                                <i class="fa-solid fa-school"></i>
                                Lớp học
                            </label>
                            <Dropdown v-model="selectedClass" :options="classes" optionLabel="name" class="filter-input" placeholder="Tất cả lớp" showClear />
                        </div>

                        <div class="filter-item">
                            <label class="filter-label">
                                <i class="fa-solid fa-calendar"></i>
                                Ngày góp ý
                            </label>
                            <Calendar v-model="dateFilter" :manualInput="false" showIcon showButtonBar dateFormat="dd/mm/yy" class="filter-input" placeholder="Chọn ngày" />
                            <div class="date-shortcuts">
                                <button
                                    :class="{
                                        active: dateFilter && new Date(dateFilter).toDateString() === new Date().toDateString()
                                    }"
                                    @click="showTodayOnly"
                                >
                                    Hôm nay
                                </button>
                                <button :class="{ active: !dateFilter }" @click="showAllDays">Tất cả</button>
                            </div>
                        </div>

                        <div class="filter-item">
                            <label class="filter-label">
                                <i class="fa-solid fa-flag"></i>
                                Trạng thái
                            </label>
                            <Dropdown v-model="statusFilter" :options="statusOptions" optionLabel="label" optionValue="value" class="filter-input" placeholder="Tất cả" />
                        </div>
                    </div>

                    <div class="filter-result">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <span>
                            Tìm thấy <strong>{{ filteredFeedbacks.length }}</strong> góp ý
                        </span>
                    </div>
                </template>
            </Card>

            <!-- Feedback List -->
            <div class="feedback-list-wrapper">
                <!-- Loading list -->
                <div v-if="loadingList" class="list-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>Đang tải...</span>
                </div>

                <!-- Empty state -->
                <div v-else-if="!filteredFeedbacks.length" class="empty-state">
                    <div class="empty-icon">
                        <i class="fa-solid fa-inbox"></i>
                    </div>
                    <h3>Không có góp ý nào</h3>
                    <p>Chưa có góp ý phù hợp với bộ lọc hiện tại</p>
                    <button class="reset-btn" @click="clearFilters">
                        <i class="fa-solid fa-rotate-left"></i>
                        Đặt lại bộ lọc
                    </button>
                </div>

                <!-- Feedback cards -->
                <div v-else class="feedback-cards">
                    <div v-for="(f, idx) in pagedFeedbacks" :key="f.id" class="feedback-card" :class="[`status-${f.status?.toLowerCase()}`]" @click="openDetail(f)">
                        <div class="card-header">
                            <div class="sender-info">
                                <div class="sender-avatar">
                                    <i class="fa-solid fa-user"></i>
                                </div>
                                <div class="sender-details">
                                    <div class="sender-name">
                                        {{ f.parentName || 'Phụ huynh' }}
                                    </div>
                                    <div class="sender-meta">
                                        <span class="student-name">
                                            <i class="fa-solid fa-child"></i>
                                            {{ f.studentName }}
                                        </span>
                                        <span class="class-name">
                                            <i class="fa-solid fa-school"></i>
                                            {{ f.className }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div class="card-status" :class="statusView[f.status]?.class">
                                <i :class="['fa-solid', statusView[f.status]?.icon]"></i>
                                <span>{{ statusView[f.status]?.text || f.status }}</span>
                            </div>
                        </div>

                        <div class="card-content">
                            <p class="content-text">{{ f.content }}</p>
                        </div>

                        <div class="card-footer">
                            <div class="time-info">
                                <i class="fa-regular fa-clock"></i>
                                <span>{{ getRelativeTime(f) }}</span>
                                <span class="time-full"> • {{ displayTime(f) }} {{ displayDate(f) }} </span>
                            </div>
                            <div class="card-actions" @click.stop>
                                <button v-if="f.status === 'NEW' || f.status === 'PENDING'" class="action-btn process" @click="changeStatus(f, 'PROCESSING')" title="Nhận xử lý">
                                    <i class="fa-solid fa-play"></i>
                                </button>
                                <button v-else-if="f.status === 'PROCESSING'" class="action-btn complete" @click="changeStatus(f, 'CLOSED')" title="Hoàn thành">
                                    <i class="fa-solid fa-check"></i>
                                </button>
                                <button v-else-if="f.status === 'CLOSED'" class="action-btn reopen" @click="changeStatus(f, 'PROCESSING')" title="Mở lại">
                                    <i class="fa-solid fa-rotate-left"></i>
                                </button>
                                <button class="action-btn delete" @click="removeFeedback(f)" title="Xóa">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pagination -->
                <div v-if="filteredFeedbacks.length > rows" class="pagination-wrapper">
                    <Paginator :rows="rows" :totalRecords="filteredFeedbacks.length" :first="first" @page="onPageChange" :rowsPerPageOptions="[10, 20, 50]" />
                </div>
            </div>

            <!-- Detail Dialog -->
            <Dialog v-model:visible="detailVisible" modal :closeOnEscape="true" :dismissableMask="true" class="detail-dialog" :style="{ width: '600px', maxWidth: '95vw' }">
                <template #header>
                    <div class="dialog-header">
                        <div class="dialog-icon">
                            <i class="fa-solid fa-envelope-open-text"></i>
                        </div>
                        <div class="dialog-title">
                            <h3>Chi tiết góp ý</h3>
                            <p>#{{ detailItem?.id }}</p>
                        </div>
                    </div>
                </template>

                <div v-if="detailItem" class="detail-content">
                    <!-- Status -->
                    <div class="detail-status" :class="statusView[detailItem.status]?.class">
                        <i :class="['fa-solid', statusView[detailItem.status]?.icon]"></i>
                        <span>
                            {{ statusView[detailItem.status]?.text || detailItem.status }}
                        </span>
                    </div>

                    <!-- Sender Info -->
                    <div class="detail-section">
                        <div class="section-label">
                            <i class="fa-solid fa-user"></i>
                            Thông tin người gửi
                        </div>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">Phụ huynh</span>
                                <span class="info-value">
                                    {{ detailItem.parentName || '—' }}
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Học sinh</span>
                                <span class="info-value">
                                    {{ detailItem.studentName || '—' }}
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Lớp</span>
                                <span class="info-value">
                                    {{ detailItem.className || '—' }}
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Thời gian gửi</span>
                                <span class="info-value"> {{ displayTime(detailItem) }} {{ displayDate(detailItem) }} </span>
                            </div>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="detail-section">
                        <div class="section-label">
                            <i class="fa-solid fa-message"></i>
                            Nội dung góp ý
                        </div>
                        <div class="content-box">
                            {{ detailItem.content }}
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="detail-actions">
                        <button
                            v-if="detailItem.status === 'NEW' || detailItem.status === 'PENDING'"
                            class="detail-btn process"
                            @click="
                                changeStatus(detailItem, 'PROCESSING');
                                closeDetail();
                            "
                        >
                            <i class="fa-solid fa-play"></i>
                            Nhận xử lý
                        </button>
                        <button
                            v-else-if="detailItem.status === 'PROCESSING'"
                            class="detail-btn complete"
                            @click="
                                changeStatus(detailItem, 'CLOSED');
                                closeDetail();
                            "
                        >
                            <i class="fa-solid fa-check"></i>
                            Đánh dấu hoàn thành
                        </button>
                        <button
                            v-else-if="detailItem.status === 'CLOSED'"
                            class="detail-btn reopen"
                            @click="
                                changeStatus(detailItem, 'PROCESSING');
                                closeDetail();
                            "
                        >
                            <i class="fa-solid fa-rotate-left"></i>
                            Mở lại xử lý
                        </button>
                        <button class="detail-btn close" @click="closeDetail">
                            <i class="fa-solid fa-xmark"></i>
                            Đóng
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    </div>
</template>

<style scoped>
.feedback-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #f0f4ff 0%, #fdf2f8 50%, #fef3c7 100%);
    padding: 24px;
}

/* Loading Overlay */
.loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
}

.loading-content {
    text-align: center;
    color: #6366f1;
}

.loading-content p {
    color: #64748b;
    font-size: 14px;
}

/* Page Content */
.page-content {
    max-width: 1200px;
    margin: 0 auto;
}

/* Header */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
}

.header-info {
    display: flex;
    align-items: center;
    gap: 16px;
}

.header-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 24px;
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
}

.header-title {
    font-size: 28px;
    font-weight: 800;
    color: #1e293b;
    margin: 0;
}

.header-desc {
    font-size: 14px;
    color: #64748b;
    margin: 4px 0 0;
}

.header-actions .action-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
}

.action-btn.refresh {
    background: #fff;
    color: #6366f1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.action-btn.refresh:hover {
    background: #6366f1;
    color: #fff;
}

/* Stats Grid */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
}

.stat-card {
    background: #fff;
    border-radius: 16px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    transition:
        transform 0.2s,
        box-shadow 0.2s;
}

.stat-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
}

.stat-card.total .stat-icon {
    background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
    color: #4f46e5;
}

.stat-card.new .stat-icon {
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    color: #d97706;
}

.stat-card.processing .stat-icon {
    background: linear-gradient(135deg, #dbeafe, #bfdbfe);
    color: #2563eb;
}

.stat-card.closed .stat-icon {
    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
    color: #059669;
}

.stat-value {
    font-size: 28px;
    font-weight: 800;
    color: #1e293b;
}

.stat-label {
    font-size: 13px;
    color: #64748b;
}

/* Error Banner */
.error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
    color: #dc2626;
    font-size: 14px;
}

.error-banner button {
    margin-left: auto;
    background: none;
    border: none;
    color: #dc2626;
    cursor: pointer;
    padding: 4px;
}

/* Filter Card */
.filter-card {
    margin-bottom: 24px;
    border-radius: 20px !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06) !important;
}

.filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.filter-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 700;
    color: #374151;
}

.filter-title i {
    color: #6366f1;
}

.clear-filter-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: #f1f5f9;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
}

.clear-filter-btn:hover {
    background: #e2e8f0;
    color: #475569;
}

.filter-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;
}

.filter-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.filter-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #475569;
}

.filter-label i {
    color: #94a3b8;
    font-size: 12px;
}

.filter-input {
    width: 100%;
}

.date-shortcuts {
    display: flex;
    gap: 8px;
    margin-top: 6px;
}

.date-shortcuts button {
    padding: 4px 10px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 11px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
}

.date-shortcuts button.active,
.date-shortcuts button:hover {
    background: #6366f1;
    border-color: #6366f1;
    color: #fff;
}

.filter-result {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #f1f5f9;
    font-size: 14px;
    color: #64748b;
}

.filter-result i {
    color: #6366f1;
}

.filter-result strong {
    color: #6366f1;
    font-weight: 700;
}

/* Feedback List */
.feedback-list-wrapper {
    position: relative;
}

.list-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px;
    color: #64748b;
}

/* Empty State */
.empty-state {
    text-align: center;
    padding: 60px 24px;
    background: #fff;
    border-radius: 20px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.empty-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    font-size: 32px;
    color: #6366f1;
}

.empty-state h3 {
    font-size: 18px;
    font-weight: 700;
    color: #374151;
    margin: 0 0 8px;
}

.empty-state p {
    font-size: 14px;
    color: #9ca3af;
    margin: 0 0 20px;
}

.reset-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    transition: all 0.2s;
}

.reset-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.3);
}

/* Feedback Cards */
.feedback-cards {
    display: grid;
    gap: 16px;
}

.feedback-card {
    background: #fff;
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    cursor: pointer;
    transition: all 0.2s;
    border-left: 4px solid transparent;
}

.feedback-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.feedback-card.status-new {
    border-left-color: #f59e0b;
}

.feedback-card.status-pending {
    border-left-color: #f59e0b;
}

.feedback-card.status-processing {
    border-left-color: #3b82f6;
}

.feedback-card.status-closed {
    border-left-color: #10b981;
}

.card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 16px;
}

.sender-info {
    display: flex;
    align-items: center;
    gap: 14px;
}

.sender-avatar {
    width: 46px;
    height: 46px;
    border-radius: 14px;
    background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6366f1;
    font-size: 18px;
}

.sender-name {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
}

.sender-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
    font-size: 13px;
    color: #64748b;
}

.sender-meta i {
    font-size: 11px;
    color: #94a3b8;
}

.card-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
}

.status-new {
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    color: #b45309;
}

.status-processing {
    background: linear-gradient(135deg, #dbeafe, #bfdbfe);
    color: #1d4ed8;
}

.status-closed {
    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
    color: #047857;
}

.card-content {
    margin-bottom: 16px;
}

.content-text {
    font-size: 14px;
    line-height: 1.6;
    color: #475569;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin: 0;
}

.card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 16px;
    border-top: 1px solid #f1f5f9;
}

.time-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #64748b;
}

.time-info i {
    color: #94a3b8;
}

.time-full {
    color: #94a3b8;
}

.card-actions {
    display: flex;
    gap: 8px;
}

.card-actions .action-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.2s;
}

.card-actions .action-btn.process {
    background: #fef3c7;
    color: #d97706;
}

.card-actions .action-btn.process:hover {
    background: #fde68a;
}

.card-actions .action-btn.complete {
    background: #d1fae5;
    color: #059669;
}

.card-actions .action-btn.complete:hover {
    background: #a7f3d0;
}

.card-actions .action-btn.reopen {
    background: #dbeafe;
    color: #2563eb;
}

.card-actions .action-btn.reopen:hover {
    background: #bfdbfe;
}

.card-actions .action-btn.delete {
    background: #fee2e2;
    color: #dc2626;
}

.card-actions .action-btn.delete:hover {
    background: #fecaca;
}

/* Pagination */
.pagination-wrapper {
    display: flex;
    justify-content: center;
    margin-top: 24px;
}

/* Detail Dialog */
.dialog-header {
    display: flex;
    align-items: center;
    gap: 14px;
}

.dialog-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 20px;
}

.dialog-title h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
}

.dialog-title p {
    margin: 2px 0 0;
    font-size: 13px;
    color: #94a3b8;
}

.detail-content {
    padding: 20px 0;
}

.detail-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 24px;
}

.detail-section {
    margin-bottom: 24px;
}

.section-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #6366f1;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 14px;
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
}

.info-item {
    background: #f8fafc;
    padding: 12px 16px;
    border-radius: 12px;
}

.info-label {
    display: block;
    font-size: 12px;
    color: #94a3b8;
    margin-bottom: 4px;
}

.info-value {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
}

.content-box {
    background: #f8fafc;
    padding: 18px;
    border-radius: 14px;
    font-size: 15px;
    line-height: 1.7;
    color: #374151;
    white-space: pre-wrap;
}

.detail-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid #f1f5f9;
}

.detail-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
}

.detail-btn.process {
    background: linear-gradient(135deg, #f59e0b, #fbbf24);
    color: #fff;
}

.detail-btn.complete {
    background: linear-gradient(135deg, #10b981, #34d399);
    color: #fff;
}

.detail-btn.reopen {
    background: linear-gradient(135deg, #3b82f6, #60a5fa);
    color: #fff;
}

.detail-btn.close {
    background: #f1f5f9;
    color: #64748b;
}

.detail-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Responsive */
@media (max-width: 1024px) {
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .filter-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 768px) {
    .feedback-page {
        padding: 16px;
    }

    .stats-grid {
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    .stat-card {
        padding: 16px;
    }

    .stat-value {
        font-size: 22px;
    }

    .filter-grid {
        grid-template-columns: 1fr;
    }

    .info-grid {
        grid-template-columns: 1fr;
    }

    .detail-actions {
        flex-direction: column;
    }

    .detail-btn {
        width: 100%;
    }
}
</style>
