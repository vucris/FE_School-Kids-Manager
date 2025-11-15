<script setup>
import { ref, computed, onMounted } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import MultiSelect from 'primevue/multiselect';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';

import Swal from 'sweetalert2';

import { fetchClassOptions } from '@/service/classService.js';
import { fetchAllMenuDishes, createMenuDishes, fetchWeeklyMenu, createWeeklyMenu } from '@/service/menuService.js';

/* ===== Tabs (Tạo thực đơn / Chi tiết thực đơn) ===== */
// SỬA Ở ĐÂY: chỉ dùng ref('create'), KHÔNG dùng toán tử < | >
const activeTab = ref('create'); // 'create' hoặc 'detail'
function switchTab(tab) {
    activeTab.value = tab;
}

/* ===== Helpers ngày dùng chung ===== */
function formatDate_ddMMyyyy(date) {
    if (!date) return null;
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}
function formatDate_yyyyMMdd(date) {
    if (!date) return null;
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
}
function formatDateDisplay(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
}
function getMonday(date) {
    if (!date) return null;
    const d = new Date(date);
    const dow = d.getDay(); // 0 sun
    const diff = (dow === 0 ? -6 : 1) - dow;
    d.setDate(d.getDate() + diff);
    return d;
}
function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

/* ===== Lớp (dùng chung) ===== */
const classOptions = ref([]);

/* ====== PHẦN 1: TẠO / SỬA THỰC ĐƠN TUẦN ====== */
const selectedClassId = ref(null);
const startDate = ref(null);
const endDate = ref(null);

const autoEndDate = computed(() => {
    if (!startDate.value) return null;
    const d = new Date(startDate.value);
    d.setDate(d.getDate() + 6);
    return d;
});

/* Danh sách món ăn */
const allDishes = ref([]); // [{ id, dishName }]
const dishOptions = computed(() =>
    allDishes.value.map((d) => ({
        label: d.dishName,
        value: d.id
    }))
);

/* weekly menu */
const daysOfWeek = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const mealTypes = ['Sáng', 'Trưa', 'Chiều'];

const weeklyMenu = ref({});
function initEmptyWeeklyMenu() {
    const m = {};
    daysOfWeek.forEach((day) => {
        m[day] = {};
        mealTypes.forEach((meal) => {
            m[day][meal] = { dishIds: [] };
        });
    });
    weeklyMenu.value = m;
}

/* Map từ BE -> weeklyMenu */
function applyMenuFromBackend(menu) {
    initEmptyWeeklyMenu();
    if (!menu?.items) return;
    menu.items.forEach((it) => {
        const day = it.dayOfWeek;
        const meal = it.mealType;
        if (!weeklyMenu.value[day] || !weeklyMenu.value[day][meal]) return;
        const ids = (it.dishes || []).map((d) => d.id);
        weeklyMenu.value[day][meal].dishIds = ids;
    });
}

const currentMenuId = ref(null);

const loadingInit = ref(false);
const loadingMenu = ref(false);
const savingMenu = ref(false);

/* Modal thêm món ăn */
const showAddDishModal = ref(false);
const newDishNamesText = ref('');

/* Init chung: lớp + món ăn + weeklyMenu */
async function init() {
    loadingInit.value = true;
    try {
        classOptions.value = await fetchClassOptions();
        allDishes.value = await fetchAllMenuDishes();
        initEmptyWeeklyMenu();
    } catch (e) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi khởi tạo',
            text: e?.message || 'Không tải được dữ liệu ban đầu'
        });
    } finally {
        loadingInit.value = false;
    }
}

/* Load 1 thực đơn tuần (Tạo/Sửa) */
async function onLoadWeeklyMenu() {
    if (!selectedClassId.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn lớp' });
        return;
    }
    if (!startDate.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn ngày bắt đầu tuần' });
        return;
    }
    const startParam = formatDate_yyyyMMdd(startDate.value);
    const endDateEffective = endDate.value || autoEndDate.value || startDate.value;
    const endParam = formatDate_yyyyMMdd(endDateEffective);

    loadingMenu.value = true;
    try {
        const menu = await fetchWeeklyMenu({
            classId: selectedClassId.value,
            startDate: startParam,
            endDate: endParam
        });
        if (!menu) {
            currentMenuId.value = null;
            initEmptyWeeklyMenu();
            Swal.fire({
                icon: 'info',
                title: 'Chưa có thực đơn tuần',
                text: 'Bạn có thể tạo mới thực đơn cho tuần này.'
            });
            return;
        }
        currentMenuId.value = menu.id;
        applyMenuFromBackend(menu);
        Swal.fire({ icon: 'success', title: 'Đã tải thực đơn tuần' });
    } catch (e) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi khi tải thực đơn tuần',
            text: e?.message || 'Đã có lỗi xảy ra'
        });
    } finally {
        loadingMenu.value = false;
    }
}

/* Lưu thực đơn tuần */
async function onSaveWeeklyMenu() {
    if (!selectedClassId.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn lớp' });
        return;
    }
    if (!startDate.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn ngày bắt đầu tuần' });
        return;
    }

    const start = startDate.value;
    const end = endDate.value || autoEndDate.value || start;

    const payload = {
        classId: selectedClassId.value,
        startDate: formatDate_ddMMyyyy(start),
        endDate: formatDate_ddMMyyyy(end),
        createdBy: 'admin',
        items: []
    };

    daysOfWeek.forEach((day) => {
        mealTypes.forEach((meal) => {
            const cell = weeklyMenu.value[day]?.[meal];
            const ids = cell?.dishIds || [];
            if (ids.length) {
                payload.items.push({
                    dayOfWeek: day,
                    mealType: meal,
                    dishIds: ids
                });
            }
        });
    });

    if (!payload.items.length) {
        Swal.fire({
            icon: 'warning',
            title: 'Thực đơn trống',
            text: 'Vui lòng chọn ít nhất một món cho tuần'
        });
        return;
    }

    savingMenu.value = true;
    try {
        await createWeeklyMenu(payload);
        Swal.fire({
            icon: 'success',
            title: 'Lưu thực đơn tuần thành công'
        });
    } catch (e) {
        Swal.fire({
            icon: 'error',
            title: 'Lưu thực đơn thất bại',
            text: e?.message || 'Đã có lỗi xảy ra'
        });
    } finally {
        savingMenu.value = false;
    }
}

/* Thêm nhiều món ăn */
async function onSaveNewDishes() {
    const names = newDishNamesText.value
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    if (!names.length) {
        Swal.fire({
            icon: 'warning',
            title: 'Chưa nhập tên món ăn'
        });
        return;
    }

    try {
        const created = await createMenuDishes(names);
        allDishes.value = await fetchAllMenuDishes();
        newDishNamesText.value = '';
        showAddDishModal.value = false;

        Swal.fire({
            icon: 'success',
            title: `Đã thêm ${created.length} món ăn mới`
        });
    } catch (e) {
        Swal.fire({
            icon: 'error',
            title: 'Tạo món ăn thất bại',
            text: e?.message || 'Đã có lỗi xảy ra'
        });
    }
}

/* ====== PHẦN 2: CHI TIẾT THỰC ĐƠN (LIST + DETAIL) ====== */
const filterFrom = ref(null);
const filterTo = ref(null);
const classFilterText = ref('');

/**
 * menuList: các thực đơn đã load
 */
const menuList = ref([]);
const selectedMenu = ref(null);

const detailMenu = ref(null); // MenuResponse
const detailLoading = ref(false);

const detailDaysOfWeek = daysOfWeek;
const detailMealTypes = ['Bữa sáng', 'Bữa trưa', 'Bữa chiều'];

function getDishesBy(day, mealType) {
    if (!detailMenu.value?.items) return [];
    const mealKey = mealType.replace('Bữa ', '');
    return detailMenu.value.items.filter((it) => it.dayOfWeek === day && (it.mealType === mealKey || it.mealType.toLowerCase() === mealKey.toLowerCase())).flatMap((it) => it.dishes || []);
}

const filteredMenuList = computed(() => {
    if (!classFilterText.value) return menuList.value;
    const q = classFilterText.value.toLowerCase().trim();
    return menuList.value.filter((m) => m.className.toLowerCase().includes(q));
});

/* Load 1 menu tuần vào list + detail */
async function loadMenus() {
    if (!filterFrom.value || !filterTo.value) {
        Swal.fire({
            icon: 'warning',
            title: 'Vui lòng chọn Từ ngày và Đến ngày'
        });
        return;
    }

    const monday = getMonday(filterFrom.value);
    const sunday = addDays(monday, 6);
    const startParam = formatDate_yyyyMMdd(monday);
    const endParam = formatDate_yyyyMMdd(sunday);

    if (!classOptions.value.length) {
        Swal.fire({
            icon: 'warning',
            title: 'Chưa có dữ liệu lớp trong hệ thống'
        });
        return;
    }

    const { value: classId } = await Swal.fire({
        title: 'Chọn khối/lớp muốn xem thực đơn',
        input: 'select',
        inputOptions: classOptions.value.reduce((obj, c) => {
            obj[c.value] = c.label;
            return obj;
        }, {}),
        inputPlaceholder: 'Chọn khối',
        showCancelButton: true,
        confirmButtonText: 'Xem thực đơn',
        cancelButtonText: 'Hủy',
        heightAuto: false
    });

    if (!classId) return;

    detailLoading.value = true;
    try {
        const menu = await fetchWeeklyMenu({
            classId,
            startDate: startParam,
            endDate: endParam
        });

        if (!menu) {
            Swal.fire({
                icon: 'info',
                title: 'Không có thực đơn tuần',
                text: 'Chưa có thực đơn trong tuần này cho khối đã chọn.'
            });
            return;
        }

        const exists = menuList.value.some((m) => m.id === menu.id && m.className === menu.className);
        if (!exists) {
            menuList.value.push({
                id: menu.id,
                classId,
                className: menu.className,
                startDate: new Date(menu.startDate),
                endDate: new Date(menu.endDate),
                createdBy: menu.createdBy
            });
        }

        selectedMenu.value = menuList.value.find((m) => m.id === menu.id) || menuList.value.at(-1);
        detailMenu.value = menu;
    } catch (e) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi khi tải thực đơn',
            text: e?.message || 'Đã có lỗi xảy ra'
        });
    } finally {
        detailLoading.value = false;
    }
}

function onSelectMenu(row) {
    selectedMenu.value = row;
}

onMounted(init);
</script>

<template>
    <div class="menu-page-wrapper">
        <!-- Tabs giống điểm danh đến / điểm danh về -->
        <div class="tabs-wrapper">
            <button class="tab-item" :class="{ active: activeTab === 'create' }" @click="switchTab('create')">Tạo thực đơn tuần</button>
            <button class="tab-item" :class="{ active: activeTab === 'detail' }" @click="switchTab('detail')">Chi tiết thực đơn</button>
        </div>

        <!-- TAB TẠO THỰC ĐƠN -->
        <div v-show="activeTab === 'create'" class="px-4 md:px-6 lg:px-8 py-5 space-y-4">
            <h1 class="text-xl font-semibold text-slate-800">Thực đơn tuần</h1>

            <!-- Bộ lọc lớp + tuần -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Lớp</label>
                    <Dropdown v-model="selectedClassId" :options="classOptions" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn lớp" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Ngày bắt đầu tuần</label>
                    <Calendar v-model="startDate" dateFormat="dd/mm/yy" class="w-full" showIcon />
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">
                        Ngày kết thúc tuần
                        <span v-if="autoEndDate" class="text-xs text-slate-500"> (gợi ý: {{ autoEndDate.toLocaleDateString('vi-VN') }}) </span>
                    </label>
                    <Calendar v-model="endDate" dateFormat="dd/mm/yy" class="w-full" showIcon />
                </div>
                <div class="flex gap-2 justify-end">
                    <Button class="!bg-slate-200 !border-0 !text-slate-800" :label="loadingMenu ? 'Đang tải...' : 'Tải thực đơn'" :disabled="loadingMenu || loadingInit" @click="onLoadWeeklyMenu" />
                    <Button class="!bg-primary !border-0 !text-white" :label="savingMenu ? 'Đang lưu...' : 'Lưu thực đơn tuần'" :disabled="savingMenu || loadingInit" @click="onSaveWeeklyMenu" />
                </div>
            </div>

            <!-- Danh sách món ăn + nút thêm -->
            <div class="flex items-center justify-between">
                <div class="text-sm text-slate-700">
                    Tổng số món ăn: <b>{{ allDishes.length }}</b>
                </div>
                <Button class="!bg-emerald-600 !border-0 !text-white" icon="fa-solid fa-plus mr-2" label="Thêm món ăn" @click="showAddDishModal = true" />
            </div>

            <!-- Bảng thực đơn tuần -->
            <div class="overflow-auto border border-slate-200 rounded-xl bg-white">
                <table class="min-w-full text-sm">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-3 py-2 border-b text-left w-32">Ngày / Bữa</th>
                            <th v-for="meal in mealTypes" :key="meal" class="px-3 py-2 border-b text-left">
                                {{ meal }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="day in daysOfWeek" :key="day">
                            <td class="px-3 py-2 border-b font-semibold text-slate-800">
                                {{ day }}
                            </td>
                            <td v-for="meal in mealTypes" :key="meal" class="px-3 py-2 border-b align-top">
                                <MultiSelect
                                    v-if="weeklyMenu[day] && weeklyMenu[day][meal]"
                                    v-model="weeklyMenu[day][meal].dishIds"
                                    :options="dishOptions"
                                    optionLabel="label"
                                    optionValue="value"
                                    display="chip"
                                    class="w-full"
                                    placeholder="Chọn món"
                                />
                                <span v-else class="text-xs text-rose-500"> đang tải thực đơn </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Modal thêm món ăn -->
            <Dialog v-model:visible="showAddDishModal" modal :draggable="false" :style="{ width: '480px' }">
                <template #header>
                    <div class="text-lg font-semibold text-slate-800">Thêm món ăn</div>
                </template>

                <div class="space-y-3">
                    <p class="text-sm text-slate-600">Nhập mỗi món ăn một dòng. Ví dụ:</p>
                    <div class="text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2">
                        Cơm gà xối mỡ<br />
                        Canh rau củ thập cẩm<br />
                        Trứng chiên<br />
                        ...
                    </div>
                    <textarea
                        v-model="newDishNamesText"
                        rows="8"
                        class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder="Nhập tên món ăn, mỗi dòng một món"
                    ></textarea>
                </div>

                <template #footer>
                    <div class="flex justify-end gap-2 w-full">
                        <Button class="!bg-slate-200 !text-slate-800 !border-0" label="Hủy" @click="showAddDishModal = false" />
                        <Button class="!bg-primary !text-white !border-0" label="Lưu món ăn" @click="onSaveNewDishes" />
                    </div>
                </template>
            </Dialog>
        </div>

        <!-- TAB CHI TIẾT THỰC ĐƠN -->
        <div v-show="activeTab === 'detail'" class="menu-page">
            <div class="page-header">
                <h1>Quản lý thực đơn</h1>
            </div>

            <div class="menu-layout">
                <!-- Left -->
                <div class="menu-left">
                    <h2 class="section-title">Danh sách thực đơn</h2>
                    <div class="filters-row">
                        <Calendar v-model="filterFrom" dateFormat="dd/mm/yy" placeholder="Từ ngày" showIcon class="w-full" />
                        <Calendar v-model="filterTo" dateFormat="dd/mm/yy" placeholder="Đến ngày" showIcon class="w-full" />
                        <Button class="btn-search" icon="fa-solid fa-magnifying-glass mr-2" label="Tìm" @click="loadMenus" />
                    </div>

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
                                <tr v-for="(row, idx) in filteredMenuList" :key="row.id" :class="{ active: selectedMenu && selectedMenu.id === row.id }" @click="onSelectMenu(row)">
                                    <td>{{ idx + 1 }}</td>
                                    <td>{{ row.className }}</td>
                                    <td>{{ formatDateDisplay(row.startDate) }}</td>
                                    <td>{{ formatDateDisplay(row.endDate) }}</td>
                                </tr>
                                <tr v-if="!filteredMenuList.length">
                                    <td colspan="4" class="empty-row">Chưa có thực đơn nào trong khoảng tìm kiếm.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="menu-pagination">
                        <span>Total {{ filteredMenuList.length }}</span>
                    </div>
                </div>

                <!-- Right -->
                <div class="menu-right">
                    <div class="detail-header-row">
                        <h2 class="section-title">Thông tin chi tiết của thực đơn</h2>
                        <Button class="btn-download" icon="fa-solid fa-download mr-2" label="Tải về" :disabled="!detailMenu" />
                    </div>

                    <div v-if="detailLoading" class="detail-loading">Đang tải chi tiết thực đơn...</div>

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
                                    <tr v-for="(day, idx) in detailDaysOfWeek" :key="day">
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

                    <div v-else class="detail-empty">Chọn một thực đơn bên trái hoặc bấm "Tìm" để xem chi tiết.</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.menu-page-wrapper {
    background: #f8fafc;
    min-height: 100vh;
}

/* Tabs */
.tabs-wrapper {
    display: flex;
    gap: 16px;
    border-bottom: 1px solid #e5e7eb;
    padding: 0 24px;
    background: #ffffff;
}
.tab-item {
    position: relative;
    display: inline-flex;
    align-items: center;
    padding: 14px 4px;
    font-size: 14px;
    font-weight: 600;
    color: #6b7280;
    background: transparent;
    border: none;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition:
        color 0.2s ease,
        border-color 0.2s ease;
}
.tab-item:hover {
    color: #1d4ed8;
}
.tab-item.active {
    color: #1d4ed8;
    border-bottom-color: #2563eb;
}

/* Phần detail view */
.menu-page {
    background: #f3f4ff;
    min-height: 100%;
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
.menu-left,
.menu-right {
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

/* Filters left */
.filters-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
}
.btn-search {
    background: #2563eb !important;
    border: 0 !important;
    color: #ffffff !important;
    height: 40px;
}
.class-filter {
    margin-top: 4px;
}
.filter-label {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 4px;
}

/* Table left */
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

/* Right panel detail */
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

/* Responsive */
@media (max-width: 1024px) {
    .menu-layout {
        grid-template-columns: 1fr;
    }
}
</style>
