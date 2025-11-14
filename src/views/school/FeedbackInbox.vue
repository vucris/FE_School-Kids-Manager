<script setup>
import { ref, computed, onMounted } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Paginator from 'primevue/paginator';

/* ========== STATE (fake data, chưa call API) ========== */

const classes = ref([
    { id: 1, name: 'Sun Bear - C1' },
    { id: 2, name: 'Panda Bear - C2' },
    { id: 3, name: 'Koala Bear - B2' }
]);

const feedbacks = ref([
    {
        id: 1,
        parentName: 'Vũ Thị Thu Hiền',
        sentTo: 'Giáo viên',
        studentName: 'Võ Chí Quang',
        className: 'Sun Bear - C1',
        classId: 1,
        sentAt: '2024-12-20T11:29:00',
        content: 'Cô ơi, hôm nay sinh nhật Sóc, chiều 3h chị đem đồ lên nhờ các cô tổ chức cho cháu với nhé. Cảm ơn cô.',
        status: 'NEW'
    },
    {
        id: 2,
        parentName: 'Trần Thị Ngọc Lan',
        sentTo: 'Giáo viên',
        studentName: 'Cao Trung Ân',
        className: 'Panda Bear - C2',
        classId: 2,
        sentAt: '2024-12-20T09:23:00',
        content: 'Cô ơi, hôm nọ Triumph off 2 ngày nên chưa được cân đo, nhờ cô sắp xếp cập nhật chỉ số giúp bố mẹ với ạ.',
        status: 'CLOSED'
    },
    {
        id: 3,
        parentName: 'Trần Thị Ngọc Huyền',
        sentTo: 'Giáo viên',
        studentName: 'Nguyễn Hoàng Bảo Lâm',
        className: 'Panda Bear - B1',
        classId: 3,
        sentAt: '2024-12-20T08:37:00',
        content: 'Mẹ chào cô, hôm nay mẹ xin cho Lâm đi học trễ ạ.',
        status: 'PROCESSING'
    }
]);

const keywordParent = ref('');
const keywordStudent = ref('');
const selectedClass = ref(null);
const dateFilter = ref(null);
const statusFilter = ref(null);

const first = ref(0);
const rows = ref(10);

const statusOptions = [
    { label: 'Tất cả', value: null },
    { label: 'Mới gửi', value: 'NEW' },
    { label: 'Đang xử lý', value: 'PROCESSING' },
    { label: 'Đã đóng', value: 'CLOSED' }
];

const statusView = {
    NEW: { text: 'Mới gửi', class: 'bg-amber-500 text-white' },
    PROCESSING: { text: 'Đang xử lý', class: 'bg-blue-600 text-white' },
    CLOSED: { text: 'Đã đóng', class: 'bg-slate-500 text-white' }
};

/* ========== COMPUTED ========== */

const filteredFeedbacks = computed(() => {
    let list = [...feedbacks.value];

    if (selectedClass.value?.id) {
        list = list.filter((f) => f.classId === selectedClass.value.id);
    }
    if (statusFilter.value) {
        list = list.filter((f) => f.status === statusFilter.value);
    }
    if (dateFilter.value) {
        const d = new Date(dateFilter.value).setHours(0, 0, 0, 0);
        list = list.filter((f) => {
            const sent = new Date(f.sentAt).setHours(0, 0, 0, 0);
            return sent === d;
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

function formatTime(dt) {
    if (!dt) return '';
    return new Date(dt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(dt) {
    if (!dt) return '';
    return new Date(dt).toLocaleDateString('vi-VN');
}

/* giả lập thay đổi trạng thái, sau này gọi API rồi cập nhật lại list */
function changeStatus(item, newStatus) {
    item.status = newStatus;
}

onMounted(() => {
    // sau này gọi API load classes + feedbacks ở đây
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
        <div class="overflow-x-auto rounded-2xl ring-1 ring-slate-200 bg-white">
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
                        <th class="px-3 py-3 text-center w-32">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(f, idx) in pagedFeedbacks" :key="f.id" class="border-b last:border-0 hover:bg-slate-50 align-top">
                        <td class="px-3 py-3 text-slate-600">
                            {{ first + idx + 1 }}
                        </td>
                        <td class="px-3 py-3">
                            <div class="font-medium text-slate-800">{{ f.parentName }}</div>
                            <div class="text-xs text-slate-500">
                                Gửi đến: <span class="text-primary font-semibold">{{ f.sentTo }}</span>
                            </div>
                            <div class="text-xs text-slate-500 flex items-center gap-1">
                                <i class="fa-regular fa-clock text-sky-500"></i>
                                {{ formatTime(f.sentAt) }} {{ formatDate(f.sentAt) }}
                            </div>
                        </td>
                        <td class="px-3 py-3">
                            <div class="font-medium text-slate-800">{{ f.studentName }}</div>
                        </td>
                        <td class="px-3 py-3">
                            <div class="text-slate-800">{{ f.className }}</div>
                        </td>
                        <td class="px-3 py-3">
                            {{ formatDate(f.sentAt) }}
                        </td>
                        <td class="px-3 py-3">
                            <div class="max-w-xl line-clamp-3 text-slate-700">
                                {{ f.content }}
                            </div>
                        </td>
                        <td class="px-3 py-3 text-center">
                            <span class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold" :class="statusView[f.status]?.class || 'bg-slate-300 text-slate-800'">
                                {{ statusView[f.status]?.text || 'Không xác định' }}
                            </span>
                        </td>
                        <td class="px-3 py-3 text-center">
                            <div class="flex flex-col gap-1 items-stretch">
                                <Button v-if="f.status === 'NEW'" class="btn-success text-xs" label="Nhận xử lý" @click.stop="changeStatus(f, 'PROCESSING')" />
                                <Button v-if="f.status === 'PROCESSING'" class="btn-primary text-xs" label="Đánh dấu đã xong" @click.stop="changeStatus(f, 'CLOSED')" />
                                <Button v-if="f.status === 'CLOSED'" class="btn-ghost text-xs" label="Mở lại" @click.stop="changeStatus(f, 'PROCESSING')" />
                            </div>
                        </td>
                    </tr>

                    <tr v-if="!filteredFeedbacks.length">
                        <td colspan="8" class="px-3 py-4 text-center text-slate-500">Không có góp ý phù hợp với bộ lọc hiện tại.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div class="flex justify-end">
            <Paginator :rows="rows" :totalRecords="filteredFeedbacks.length" :first="first" @page="onPageChange" class="mt-3" />
        </div>
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
