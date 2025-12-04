<script setup>
import { ref, computed, onMounted } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Paginator from 'primevue/paginator';

/* ========== STATE ========== */

/** Sau này thay bằng dữ liệu từ API */
const newsList = ref([
    {
        id: 1,
        title: 'THƯ MỜI HỌP PHỤ HUYNH HỌC SINH - HỌC KỲ I, NĂM HỌC 2025 - 2026',
        category: 'NOTICE',
        scope: 'Panda Bear - B2',
        classId: 1,
        createdAt: '2025-11-11T15:45:00',
        publishedAt: '2025-11-11T15:45:00',
        updatedAt: '2025-11-11T15:45:00',
        createdBy: 'BP Tuyển sinh',
        comments: 15,
        attachments: 3,
        views: 21,
        unread: true
    },
    {
        id: 2,
        title: 'THƯ TUẦN 02 THÁNG 11 - GLOBAL',
        category: 'WEEKLY',
        scope: 'Global',
        classId: null,
        createdAt: '2025-11-08T17:31:00',
        publishedAt: '2025-11-08T17:31:00',
        updatedAt: '2025-11-08T17:31:00',
        createdBy: 'Nguyễn Thanh Tường Vy',
        comments: 7,
        attachments: 0,
        views: 10,
        unread: false
    },
    {
        id: 3,
        title: 'Nhận xét tuần 02 / 11 cho bé An',
        category: 'COMMENT',
        scope: 'Sun Bear - C1',
        classId: 2,
        createdAt: '2025-11-08T12:39:00',
        publishedAt: '2025-11-08T12:39:00',
        updatedAt: '2025-11-08T12:39:00',
        createdBy: 'Trần Ngọc Anh',
        comments: 0,
        attachments: 0,
        views: 3,
        unread: true
    }
]);

/** Sau này thay bằng fetch từ api class */
const classes = ref([
    { id: 1, name: 'Panda Bear - B2' },
    { id: 2, name: 'Sun Bear - C1' },
    { id: 3, name: 'Koala Bear - B1' }
]);

const selectedClass = ref(null);
const selectedCategory = ref(null);
const keyword = ref('');
const dateRange = ref(null);

const categories = [
    { label: 'Tất cả loại', value: null },
    { label: 'Thông báo', value: 'NOTICE' },
    { label: 'Thư tuần', value: 'WEEKLY' },
    { label: 'Nhận xét', value: 'COMMENT' }
];

const first = ref(0);
const rows = ref(10);

const categoryView = {
    NOTICE: { text: 'Thông báo', severity: 'info', icon: 'fa-regular fa-bell' },
    WEEKLY: { text: 'Thư tuần', severity: 'success', icon: 'fa-regular fa-calendar' },
    COMMENT: { text: 'Nhận xét', severity: 'warning', icon: 'fa-regular fa-message' }
};

/* ========== COMPUTED ========== */

const filteredNews = computed(() => {
    let list = [...newsList.value];
    const q = keyword.value.toLowerCase().trim();

    if (selectedClass.value?.id) {
        list = list.filter((n) => n.classId === selectedClass.value.id || n.scope === 'Global');
    }
    if (selectedCategory.value) {
        list = list.filter((n) => n.category === selectedCategory.value);
    }
    if (dateRange.value?.[0] && dateRange.value?.[1]) {
        const [from, to] = dateRange.value;
        const start = new Date(from).setHours(0, 0, 0, 0);
        const end = new Date(to).setHours(23, 59, 59, 999);
        list = list.filter((n) => {
            const pub = new Date(n.publishedAt || n.createdAt).getTime();
            return pub >= start && pub <= end;
        });
    }
    if (q) {
        list = list.filter((n) => (n.title || '').toLowerCase().includes(q) || (n.scope || '').toLowerCase().includes(q) || (n.createdBy || '').toLowerCase().includes(q));
    }
    return list;
});

const pagedNews = computed(() => {
    const start = first.value;
    const end = first.value + rows.value;
    return filteredNews.value.slice(start, end);
});

/* ========== METHODS ========== */

function onPageChange(e) {
    first.value = e.first;
    rows.value = e.rows;
}

function formatDate(dt) {
    if (!dt) return '';
    return new Date(dt).toLocaleString('vi-VN');
}

function openDetail(item) {
    // sau này router.push(`/news/${item.id}`)
    console.log('open detail', item.id);
}

onMounted(() => {
    // sau này gọi API ở đây
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-10 py-6 space-y-5">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-newspaper text-2xl text-primary"></i>
                <div>
                    <div class="text-2xl font-extrabold tracking-tight text-slate-800">Bảng tin nhà trường</div>
                    <div class="text-slate-500 text-sm">Thông báo, thư tuần, nhận xét gửi tới phụ huynh</div>
                </div>
            </div>
            <!-- Có thể thêm nút tạo bài viết cho admin -->
        </div>

        <!-- Bộ lọc -->
        <Card class="card-soft ring-1 ring-slate-100">
            <template #content>
                <div class="grid grid-cols-1 lg:grid-cols-5 gap-3">
                    <div>
                        <label class="label">Lớp</label>
                        <Dropdown v-model="selectedClass" :options="classes" optionLabel="name" class="w-full" placeholder="Tất cả lớp" />
                    </div>
                    <div>
                        <label class="label">Loại bài</label>
                        <Dropdown v-model="selectedCategory" :options="categories" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                    <div>
                        <label class="label">Khoảng ngày</label>
                        <Calendar v-model="dateRange" selectionMode="range" :manualInput="false" showIcon dateFormat="dd/mm/yy" class="w-full" placeholder="Từ ngày - đến ngày" />
                    </div>
                    <div class="lg:col-span-2">
                        <label class="label">Tìm kiếm</label>
                        <div class="flex gap-2">
                            <InputText v-model="keyword" class="flex-1" placeholder="Tiêu đề, người đăng, lớp..." />
                            <Button
                                class="btn-ghost"
                                icon="fa-solid fa-broom"
                                @click="
                                    () => {
                                        keyword = '';
                                        dateRange = null;
                                        selectedCategory = null;
                                        selectedClass = null;
                                    }
                                "
                            />
                        </div>
                    </div>
                </div>
            </template>
        </Card>

        <!-- Danh sách -->
        <div class="overflow-hidden rounded-2xl ring-1 ring-slate-200 bg-white">
            <div v-for="item in pagedNews" :key="item.id" class="flex flex-col md:flex-row items-stretch border-b last:border-0 hover:bg-slate-50 transition cursor-pointer" @click="openDetail(item)">
                <!-- Cột logo + phạm vi -->
                <div class="flex items-center justify-center md:justify-start md:w-56 px-4 py-4 gap-3">
                    <div class="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center ring-1 ring-slate-200">
                        <i class="fa-solid fa-school text-2xl text-slate-500"></i>
                    </div>
                    <div class="space-y-1">
                        <div class="text-xs text-slate-500">Phạm vi</div>
                        <Tag v-if="item.scope" :value="item.scope" severity="info" class="text-xs font-semibold" />
                    </div>
                </div>

                <!-- Nội dung chính -->
                <div class="flex-1 px-4 py-3">
                    <div class="flex items-start gap-2">
                        <span v-if="item.unread" class="inline-flex mt-1 h-2 w-2 rounded-full bg-emerald-500" title="Chưa đọc"></span>
                        <div>
                            <div class="text-base md:text-lg font-semibold text-slate-800 line-clamp-2">
                                {{ item.title }}
                            </div>
                            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>
                                    Đăng lúc {{ formatDate(item.createdAt) }}
                                    <span v-if="item.publishedAt && item.publishedAt !== item.createdAt"> • Xuất bản {{ formatDate(item.publishedAt) }} </span>
                                </span>
                                <span
                                    >• Bởi <b>{{ item.createdBy }}</b></span
                                >
                            </div>
                            <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span v-if="item.comments"> <i class="fa-regular fa-comment mr-1"></i>{{ item.comments }} bình luận </span>
                                <span v-if="item.attachments"> <i class="fa-regular fa-paperclip mr-1"></i>{{ item.attachments }} tệp </span>
                                <span v-if="item.views"> <i class="fa-regular fa-eye mr-1"></i>{{ item.views }} lượt xem </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Cột loại bài + thời gian cập nhật -->
                <div class="flex flex-col justify-between md:w-64 px-4 py-3 border-t md:border-t-0 md:border-l">
                    <div class="flex items-center justify-between md:justify-end gap-2">
                        <Tag :severity="categoryView[item.category]?.severity || 'secondary'" :value="categoryView[item.category]?.text || 'Khác'" />
                        <i :class="categoryView[item.category]?.icon || 'fa-regular fa-file-lines'" class="text-slate-500"></i>
                    </div>
                    <div class="mt-3 text-right text-xs text-slate-500">Cập nhật: {{ formatDate(item.updatedAt || item.publishedAt || item.createdAt) }}</div>
                </div>
            </div>

            <div v-if="!filteredNews.length" class="px-4 py-3 text-sm text-slate-500">Không có bài viết phù hợp.</div>
        </div>

        <!-- Pagination -->
        <div class="flex justify-end">
            <Paginator :rows="rows" :totalRecords="filteredNews.length" :first="first" @page="onPageChange" class="mt-3" />
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
.btn-ghost {
    background: #f1f5f9;
    color: #334155;
    border: 0;
}
</style>
