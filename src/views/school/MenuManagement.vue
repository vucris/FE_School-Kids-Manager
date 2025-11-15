<script setup>
import { ref, computed, onMounted } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Swal from 'sweetalert2';

import { fetchClassOptions } from '@/service/classService.js';
import { fetchWeeklyMenu } from '@/service/menuService.js';

/* Helpers ngày */
function formatDateDisplay(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
}
function formatDate_yyyyMMdd(date) {
    if (!date) return null;
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
}
function getMonday(date) {
    if (!date) return null;
    const d = new Date(date);
    const dow = d.getDay(); // 0 CN
    const diff = (dow === 0 ? -6 : 1) - dow;
    d.setDate(d.getDate() + diff);
    return d;
}
function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

/* Lớp */
const classOptions = ref([]);
const classFilterText = ref('');

/**
 * menuList: các lớp có thực đơn trong tuần hiện tại
 * {
 *   classId,
 *   className,
 *   startDate,
 *   endDate,
 *   menu
 * }
 */
const menuList = ref([]);
const selectedRow = ref(null);

/* Chi tiết thực đơn bên phải */
const detailMenu = ref(null);
const detailLoading = ref(false);

/* Bảng chi tiết */
const daysOfWeek = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const mealTypes = ['Bữa sáng', 'Bữa trưa', 'Bữa chiều'];

function getDishesBy(day, mealType) {
    if (!detailMenu.value?.items) return [];
    const mealKey = mealType.replace('Bữa ', '');
    return detailMenu.value.items.filter((it) => it.dayOfWeek === day && (it.mealType === mealKey || it.mealType.toLowerCase() === mealKey.toLowerCase())).flatMap((it) => it.dishes || []);
}

/* Lọc theo ô Khối */
const filteredMenuList = computed(() => {
    if (!classFilterText.value) return menuList.value;
    const q = classFilterText.value.toLowerCase().trim();
    return menuList.value.filter((m) => m.className.toLowerCase().includes(q));
});

/* Load danh sách lớp + thực đơn tuần hiện tại, KHÔNG cần bấm Tìm */
async function init() {
    try {
        classOptions.value = await fetchClassOptions();
        if (!classOptions.value.length) {
            Swal.fire({
                icon: 'warning',
                title: 'Chưa có lớp trong hệ thống'
            });
            return;
        }

        menuList.value = [];
        detailMenu.value = null;
        selectedRow.value = null;
        detailLoading.value = true;

        const today = new Date();
        const monday = getMonday(today);
        const sunday = addDays(monday, 6);
        const startParam = formatDate_yyyyMMdd(monday);
        const endParam = formatDate_yyyyMMdd(sunday);

        for (const clazz of classOptions.value) {
            try {
                const menu = await fetchWeeklyMenu({
                    classId: clazz.value,
                    startDate: startParam,
                    endDate: endParam
                });

                if (menu) {
                    menuList.value.push({
                        classId: clazz.value,
                        className: menu.className,
                        startDate: new Date(menu.startDate),
                        endDate: new Date(menu.endDate),
                        menu
                    });
                }
            } catch (err) {
                // lớp chưa có thực đơn -> bỏ qua
                console.debug('Lớp chưa có thực đơn tuần hiện tại:', clazz.label);
            }
        }

        if (!menuList.value.length) {
            Swal.fire({
                icon: 'info',
                title: 'Chưa có thực đơn tuần',
                text: 'Không có lớp nào có thực đơn trong tuần hiện tại.'
            });
        }
    } catch (e) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi khởi tạo',
            text: e?.message || 'Không tải được dữ liệu'
        });
    } finally {
        detailLoading.value = false;
    }
}

/* Click 1 dòng -> hiển thị chi tiết */
function onSelectRow(row) {
    selectedRow.value = row;
    detailMenu.value = row.menu;
}

onMounted(init);
</script>

<template>
    <div class="menu-page">
        <div class="page-header">
            <h1>Danh sách thực đơn</h1>
        </div>

        <div class="menu-layout">
            <!-- Left: danh sách lớp có thực đơn -->
            <div class="menu-left">
                <h2 class="section-title">Danh sách thực đơn</h2>

                <!-- Chỉ có ô lọc Khối, KHÔNG có Tìm -->
                <div class="class-filter">
                    <label class="filter-label">Khối</label>
                    <InputText v-model="classFilterText" placeholder="Lọc theo tên khối" class="w-full" />
                </div>

                <div class="menu-table-wrapper">
                    <table class="menu-table">
                        <thead>
                            <tr>
                                <th style="width: 40px">STT</th>
                                <th>Khối</th>
                                <th>Từ ngày</th>
                                <th>Đến ngày</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(row, idx) in filteredMenuList" :key="row.classId + '-' + row.startDate" :class="{ active: selectedRow && selectedRow.classId === row.classId }" @click="onSelectRow(row)">
                                <td>{{ idx + 1 }}</td>
                                <td>{{ row.className }}</td>
                                <td>{{ formatDateDisplay(row.startDate) }}</td>
                                <td>{{ formatDateDisplay(row.endDate) }}</td>
                            </tr>
                            <tr v-if="!filteredMenuList.length">
                                <td colspan="4" class="empty-row">Chưa có thực đơn nào cho tuần hiện tại.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="menu-pagination">
                    <span>Total {{ filteredMenuList.length }}</span>
                </div>
            </div>

            <!-- Right: chi tiết -->
            <div class="menu-right">
                <div class="detail-header-row">
                    <h2 class="section-title">Thông tin chi tiết của thực đơn</h2>
                    <Button class="btn-download" icon="fa-solid fa-download mr-2" label="Tải về" :disabled="!detailMenu" />
                </div>

                <div v-if="detailLoading" class="detail-loading">Đang tải danh sách thực đơn...</div>

                <div v-else-if="detailMenu" class="detail-container">
                    <div class="detail-meta">
                        <div>
                            <span class="meta-label">Khối:</span>
                            <b>{{ detailMenu.className }}</b>
                        </div>
                        <div>
                            <span class="meta-label">Thời gian:</span>
                            <b>
                                {{ formatDateDisplay(detailMenu.startDate) }} -
                                {{ formatDateDisplay(detailMenu.endDate) }}
                            </b>
                        </div>
                        <div>
                            <span class="meta-label">Người tạo:</span>
                            <b>{{ detailMenu.createdBy || '-' }}</b>
                        </div>
                    </div>

                    <div class="detail-table-wrapper">
                        <table class="detail-table">
                            <thead>
                                <tr>
                                    <th class="col-day">Thứ</th>
                                    <th class="col-meal">Bữa sáng</th>
                                    <th class="col-meal">Bữa trưa</th>
                                    <th class="col-meal">Bữa chiều</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(day, idx) in daysOfWeek" :key="day">
                                    <td class="cell-day">
                                        <div class="day-index">{{ idx + 2 }}</div>
                                    </td>
                                    <td class="cell-meal">
                                        <div v-for="dish in getDishesBy(day, 'Bữa sáng')" :key="dish.id" class="dish-line">- {{ dish.dishName }}</div>
                                    </td>
                                    <td class="cell-meal">
                                        <div v-for="dish in getDishesBy(day, 'Bữa trưa')" :key="dish.id" class="dish-line">- {{ dish.dishName }}</div>
                                    </td>
                                    <td class="cell-meal">
                                        <div v-for="dish in getDishesBy(day, 'Bữa chiều')" :key="dish.id" class="dish-line">- {{ dish.dishName }}</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div v-else class="detail-empty">Chọn một lớp bên trái để xem thực đơn tuần hiện tại.</div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.menu-page {
    background: #f3f4ff;
    min-height: 100vh;
    padding: 16px 24px 24px;
}
.page-header h1 {
    font-size: 20px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 8px;
}
.menu-layout {
    margin-top: 8px;
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.6fr);
    gap: 24px;
}

/* Left */
.menu-left {
    background: #ffffff;
    border-radius: 16px;
    border: 1px solid #e5e7eb;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.section-title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
}
.class-filter {
    margin-top: 4px;
}
.filter-label {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 4px;
}
.menu-table-wrapper {
    margin-top: 6px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
    background: #ffffff;
}
.menu-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}
.menu-table thead {
    background: #f1f5f9;
}
.menu-table th {
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
    color: #6b7280;
    border-bottom: 1px solid #e5e7eb;
    font-size: 12px;
}
.menu-table td {
    padding: 8px 10px;
    border-bottom: 1px solid #e5e7eb;
    color: #111827;
}
.menu-table tbody tr {
    cursor: pointer;
}
.menu-table tbody tr:hover {
    background: #e5f0ff;
}
.menu-table tbody tr.active {
    background: #eef2ff;
    border-left: 3px solid #4f46e5;
}
.menu-table .empty-row {
    text-align: center;
    font-size: 12px;
    color: #9ca3af;
}
.menu-pagination {
    margin-top: 6px;
    font-size: 11px;
    color: #6b7280;
}

/* Right */
.menu-right {
    background: #ffffff;
    border-radius: 16px;
    border: 1px solid #e5e7eb;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.detail-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.btn-download {
    background: #4f46e5 !important;
    border: 0 !important;
    color: #ffffff !important;
    font-size: 13px !important;
}
.detail-meta {
    font-size: 13px;
    color: #374151;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.meta-label {
    color: #6b7280;
}
.detail-table-wrapper {
    margin-top: 10px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
}
.detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}
.detail-table thead tr {
    background: #bde7ff;
}
.detail-table th {
    padding: 10px;
    border-right: 1px solid #e0f2fe;
    text-align: center;
    font-weight: 600;
    color: #111827;
}
.detail-table th:last-child {
    border-right: none;
}
.detail-table td {
    border-right: 1px solid #e5e7eb;
    border-bottom: 1px solid #e5e7eb;
    padding: 10px 12px;
    vertical-align: top;
}
.detail-table td:last-child {
    border-right: none;
}
.col-day {
    width: 70px;
}
.col-meal {
    width: 33%;
}
.cell-day {
    text-align: center;
    background: #ffe4e6;
}
.day-index {
    font-weight: 700;
    color: #b91c1c;
}
.cell-meal {
    font-size: 13px;
    color: #111827;
}
.dish-line {
    margin-bottom: 4px;
}
.detail-loading,
.detail-empty {
    margin-top: 16px;
    font-size: 13px;
    color: #6b7280;
}
@media (max-width: 1024px) {
    .menu-layout {
        grid-template-columns: 1fr;
    }
}
</style>
