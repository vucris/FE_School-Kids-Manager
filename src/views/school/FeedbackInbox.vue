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

import { fetchFeedbacks, updateFeedbackStatus, deleteFeedback } from '@/service/feedback.js';
import { fetchClassOptions } from '@/service/classService.js';

/* ========== STATE ========== */

// danh sách lớp, sẽ load từ BE
const classes = ref([]);

const feedbacks = ref([]); // list góp ý từ BE

const keywordParent = ref('');
const keywordStudent = ref('');
const selectedClass = ref(null);
const dateFilter = ref(null);
const statusFilter = ref(null);

const first = ref(0);
const rows = ref(10);

const loading = ref(false);
const errorMessage = ref('');

// Dialog chi tiết
const detailVisible = ref(false);
const detailItem = ref(null);

const statusOptions = [
    { label: 'Tất cả', value: null },
    { label: 'Mới gửi', value: 'NEW' },
    { label: 'Đang xử lý', value: 'PROCESSING' },
    { label: 'Đã đóng', value: 'CLOSED' }
];

// Map trạng thái để hiển thị UI
const statusView = {
    NEW: { text: 'Mới gửi', class: 'bg-amber-500 text-white' },
    PROCESSING: { text: 'Đang xử lý', class: 'bg-blue-600 text-white' },
    CLOSED: { text: 'Đã đóng', class: 'bg-slate-500 text-white' },
    PENDING: { text: 'Chờ xử lý', class: 'bg-amber-500 text-white' } // phòng trường hợp BE default "PENDING"
};

/* ========== COMPUTED ========== */

const filteredFeedbacks = computed(() => {
    let list = [...feedbacks.value];

    // Lọc theo lớp (client-side, vì BE trả studentId/classId)
    if (selectedClass.value?.id) {
        list = list.filter((f) => f.classId === selectedClass.value.id);
    }

    // Lọc theo status (client-side)
    if (statusFilter.value) {
        list = list.filter((f) => f.status === statusFilter.value);
    }

    // Lọc theo ngày góp ý (dựa vào messageDate hoặc createdAt)
    if (dateFilter.value) {
        const filterDay = new Date(dateFilter.value).setHours(0, 0, 0, 0);
        list = list.filter((f) => {
            const raw = f.messageDate || f.createdAt;
            if (!raw) return false;
            const d = new Date(raw).setHours(0, 0, 0, 0);
            return d === filterDay;
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

/**
 * Lấy chuỗi thời gian hiển thị:
 * - Ưu tiên dùng messageTime từ BE nếu có
 * - Nếu không có thì format từ messageDate/createdAt
 */
function displayTime(feedback) {
    if (feedback.messageTime) return feedback.messageTime;
    const raw = feedback.messageDate || feedback.createdAt;
    return formatTime(raw);
}

/**
 * Lấy ngày hiển thị:
 * - Ưu tiên messageDate
 * - fallback createdAt
 */
function displayDate(feedback) {
    const raw = feedback.messageDate || feedback.createdAt;
    return formatDate(raw);
}

/**
 * Load danh sách góp ý từ BE
 */
async function loadFeedbacks() {
    loading.value = true;
    errorMessage.value = '';
    try {
        const data = await fetchFeedbacks(); // có thể dùng param nếu muốn filter server-side
        feedbacks.value = data || [];
    } catch (e) {
        console.error(e);
        errorMessage.value = e.message || 'Có lỗi xảy ra khi tải danh sách góp ý';
    } finally {
        loading.value = false;
    }
}

/**
 * Load danh sách lớp từ BE
 */
async function loadClasses() {
    try {
        const opts = await fetchClassOptions(); // [{ value, label }]
        classes.value = (opts || []).map((o) => ({
            id: o.value,
            name: o.label
        }));
    } catch (e) {
        console.warn('Không load được danh sách lớp, dùng mock tạm:', e?.message || e);
        classes.value = [
            { id: 1, name: 'Sun Bear - C1' },
            { id: 2, name: 'Panda Bear - C2' },
            { id: 3, name: 'Koala Bear - B2' }
        ];
    }
}

/**
 * Đổi trạng thái góp ý:
 * NEW -> PROCESSING -> CLOSED -> PROCESSING...
 */
async function changeStatus(item, newStatus) {
    const oldStatus = item.status;
    item.status = newStatus; // Optimistic UI
    try {
        await updateFeedbackStatus(item.id, newStatus);
    } catch (e) {
        item.status = oldStatus; // rollback
        console.error(e);
        alert(e.message || 'Không thể cập nhật trạng thái góp ý');
    }
}

/**
 * Xóa 1 góp ý
 */
async function removeFeedback(item) {
    const ok = window.confirm('Bạn có chắc chắn muốn xóa góp ý này?');
    if (!ok) return;
    try {
        await deleteFeedback(item.id);
        feedbacks.value = feedbacks.value.filter((f) => f.id !== item.id);
    } catch (e) {
        console.error(e);
        alert(e.message || 'Không thể xóa góp ý');
    }
}

/**
 * Mở / đóng dialog chi tiết
 */
function openDetail(item) {
    detailItem.value = item;
    detailVisible.value = true;
}

function closeDetail() {
    detailVisible.value = false;
    detailItem.value = null;
}

onMounted(() => {
    loadClasses();
    loadFeedbacks();
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-10 py-6 space-y-5">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-inbox text-2xl text-primary"></i>
                <div>
                    <div class="text-2xl font-extrabold tracking-tight text-slate-800">Hòm thư góp ý</div>
                    <div class="text-slate-500 text-sm">Ghi nhận ý kiến của phụ huynh, phản hồi kịp thời, minh bạch theo từng lớp</div>
                </div>
            </div>
        </div>

        <!-- Thông báo error -->
        <div v-if="errorMessage" class="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
            {{ errorMessage }}
        </div>

        <!-- Filters -->
        <Card class="card-soft ring-1 ring-slate-100">
            <template #content>
                <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                        <label class="label">Phụ huynh</label>
                        <InputText v-model="keywordParent" placeholder="Tên phụ huynh..." class="w-full" />
                    </div>
                    <div>
                        <label class="label">Học sinh</label>
                        <InputText v-model="keywordStudent" placeholder="Tên học sinh..." class="w-full" />
                    </div>
                    <div>
                        <label class="label">Lớp học</label>
                        <Dropdown v-model="selectedClass" :options="classes" optionLabel="name" class="w-full" placeholder="Tất cả lớp" />
                    </div>
                    <div>
                        <label class="label">Ngày góp ý</label>
                        <Calendar v-model="dateFilter" :manualInput="false" showIcon dateFormat="dd/mm/yy" class="w-full" />
                    </div>
                    <div>
                        <label class="label">Trạng thái</label>
                        <Dropdown v-model="statusFilter" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                </div>
            </template>
        </Card>

        <!-- Table -->
        <div class="overflow-x-auto rounded-2xl ring-1 ring-slate-200 bg-white relative">
            <!-- Loading overlay -->
            <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải dữ liệu...</div>

            <table class="min-w-full text-sm">
                <thead class="bg-slate-50 border-b text-slate-600">
                    <tr>
                        <th class="px-3 py-3 text-left w-14">STT</th>
                        <th class="px-3 py-3 text-left min-w-[180px]">Phụ huynh</th>
                        <th class="px-3 py-3 text-left min-w-[160px]">Học sinh</th>
                        <th class="px-3 py-3 text-left min-w-[140px]">Lớp học</th>
                        <th class="px-3 py-3 text-left min-w-[150px]">Ngày góp ý</th>
                        <th class="px-3 py-3 text-left min-w-[260px]">Nội dung</th>
                        <th class="px-3 py-3 text-center w-32">Trạng thái</th>
                        <th class="px-3 py-3 text-center w-40">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(f, idx) in pagedFeedbacks" :key="f.id" class="border-b last:border-0 hover:bg-slate-50 align-top">
                        <td class="px-3 py-3 text-slate-600">
                            {{ first + idx + 1 }}
                        </td>
                        <td class="px-3 py-3">
                            <div class="font-medium text-slate-800">{{ f.parentName }}</div>
                            <div class="text-xs text-slate-500">Gửi đến: <span class="text-primary font-semibold">Giáo viên</span></div>
                            <div class="text-xs text-slate-500 flex items-center gap-1">
                                <i class="fa-regular fa-clock text-sky-500"></i>
                                {{ displayTime(f) }} {{ displayDate(f) }}
                            </div>
                        </td>
                        <td class="px-3 py-3">
                            <div class="font-medium text-slate-800">{{ f.studentName }}</div>
                        </td>
                        <td class="px-3 py-3">
                            <div class="text-slate-800">{{ f.className }}</div>
                        </td>
                        <td class="px-3 py-3">
                            {{ displayDate(f) }}
                        </td>
                        <td class="px-3 py-3">
                            <div class="max-w-xl line-clamp-3 text-slate-700">
                                {{ f.content }}
                            </div>
                        </td>
                        <td class="px-3 py-3 text-center">
                            <span class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold" :class="statusView[f.status]?.class || 'bg-slate-300 text-slate-800'">
                                {{ statusView[f.status]?.text || f.status || 'Không xác định' }}
                            </span>
                        </td>
                        <td class="px-3 py-3 text-center">
                            <div class="flex flex-col gap-1 items-stretch">
                                <!-- Xem chi tiết -->
                                <Button class="btn-ghost text-xs" label="Xem chi tiết" @click.stop="openDetail(f)" />

                                <!-- Đổi trạng thái -->
                                <Button v-if="f.status === 'NEW' || f.status === 'PENDING'" class="btn-success text-xs" label="Nhận xử lý" @click.stop="changeStatus(f, 'PROCESSING')" />
                                <Button v-else-if="f.status === 'PROCESSING'" class="btn-primary text-xs" label="Đánh dấu đã xong" @click.stop="changeStatus(f, 'CLOSED')" />
                                <Button v-else-if="f.status === 'CLOSED'" class="btn-ghost text-xs" label="Mở lại" @click.stop="changeStatus(f, 'PROCESSING')" />

                                <!-- Xóa -->
                                <Button class="btn-ghost text-xs !text-red-600" label="Xóa" icon="pi pi-trash" @click.stop="removeFeedback(f)" />
                            </div>
                        </td>
                    </tr>

                    <tr v-if="!loading && !filteredFeedbacks.length">
                        <td colspan="8" class="px-3 py-4 text-center text-slate-500">Không có góp ý phù hợp với bộ lọc hiện tại.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div class="flex justify-end">
            <Paginator :rows="rows" :totalRecords="filteredFeedbacks.length" :first="first" @page="onPageChange" class="mt-3" />
        </div>

        <!-- Dialog chi tiết góp ý -->
        <Dialog v-model:visible="detailVisible" modal :closeOnEscape="true" :dismissableMask="true" :breakpoints="{ '960px': '60vw', '640px': '95vw' }" style="width: 600px" :header="detailItem ? `Chi tiết góp ý #${detailItem.id}` : 'Chi tiết góp ý'">
            <div v-if="detailItem" class="space-y-4">
                <!-- Phụ huynh -->
                <div class="border-b pb-3">
                    <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Thông tin phụ huynh</div>
                    <div class="flex justify-between text-sm">
                        <div>
                            <div class="font-semibold text-slate-800">
                                {{ detailItem.parentName || '—' }}
                            </div>
                            <div class="text-xs text-slate-500">Gửi đến: Giáo viên lớp {{ detailItem.className }}</div>
                        </div>
                    </div>
                </div>

                <!-- Học sinh & lớp -->
                <div class="border-b pb-3">
                    <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Học sinh & lớp</div>
                    <div class="space-y-1 text-sm text-slate-700">
                        <div>
                            <span class="font-semibold">Học sinh: </span>{{ detailItem.studentName || '—' }}
                            <span v-if="detailItem.studentId" class="text-xs text-slate-500"> (ID: {{ detailItem.studentId }}) </span>
                        </div>
                        <div>
                            <span class="font-semibold">Lớp: </span>{{ detailItem.className || '—' }}
                            <span v-if="detailItem.classId" class="text-xs text-slate-500"> (ID: {{ detailItem.classId }}) </span>
                        </div>
                    </div>
                </div>

                <!-- Thời gian & trạng thái -->
                <div class="border-b pb-3 flex flex-wrap gap-3 items-center justify-between">
                    <div class="space-y-1 text-sm text-slate-700">
                        <div>
                            <span class="font-semibold">Thời gian gửi: </span>
                            {{ displayTime(detailItem) }} {{ displayDate(detailItem) }}
                        </div>
                        <div v-if="detailItem.createdAt"><span class="font-semibold">Tạo lúc: </span>{{ formatDate(detailItem.createdAt) }}</div>
                        <div v-if="detailItem.updatedAt"><span class="font-semibold">Cập nhật: </span>{{ formatDate(detailItem.updatedAt) }}</div>
                    </div>
                    <div>
                        <span class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold" :class="statusView[detailItem.status]?.class || 'bg-slate-300 text-slate-800'">
                            {{ statusView[detailItem.status]?.text || detailItem.status || 'Không xác định' }}
                        </span>
                    </div>
                </div>

                <!-- Nội dung -->
                <div>
                    <div class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Nội dung góp ý</div>
                    <div class="text-sm leading-relaxed text-slate-800 whitespace-pre-line bg-slate-50 rounded-xl p-3">
                        {{ detailItem.content }}
                    </div>
                </div>

                <div class="flex justify-end mt-3">
                    <Button label="Đóng" class="btn-ghost text-xs" @click="closeDetail" />
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
