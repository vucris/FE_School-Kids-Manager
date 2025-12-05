<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import MultiSelect from 'primevue/multiselect';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';

import Swal from 'sweetalert2';

import { fetchClassOptions } from '@/service/classService.js';
import {
    fetchAllMenuDishes,
    createMenuDishes,
    fetchWeeklyMenu,
    createWeeklyMenu,
    updateWeeklyMenu,
    fetchMenusByClass,
    deleteMenuByDateRange,
    updateMenuDish,
    deleteMenuDish,
    deleteWeeklyMenu
} from '@/service/menuService.js';

/* ===== Tabs ===== */
const activeTab = ref('create');

/* ===== SweetAlert ===== */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
});

/* ===== Helpers ===== */
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

// Chuẩn hoá ngày (00:00:00)
function normalizeDate(date) {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/* ===== Class & Grade ===== */
const classOptions = ref([]);
const applyMode = ref('grade');
const selectedGradeForMenu = ref('');
const selectedClassId = ref(null);

const gradeOptions = computed(() => {
    const map = new Map();
    classOptions.value.forEach((cls) => {
        const label = cls.label || '';
        if (!label) return;
        const parts = label.split(' ');
        let grade = parts[0];
        if (parts[0] === 'Nhà' && parts[1] === 'trẻ') grade = 'Nhà trẻ';
        if (!map.has(grade)) {
            map.set(grade, { label: grade, value: grade });
        }
    });
    return Array.from(map.values());
});

const classesByGrade = computed(() => {
    const res = {};
    classOptions.value.forEach((cls) => {
        const label = cls.label || '';
        if (!label) return;
        const parts = label.split(' ');
        let grade = parts[0];
        if (parts[0] === 'Nhà' && parts[1] === 'trẻ') grade = 'Nhà trẻ';
        if (!res[grade]) res[grade] = [];
        res[grade].push(cls);
    });
    return res;
});

/* ===== Weekly Menu: ngày bắt đầu / kết thúc ===== */
const startDate = ref(null);
const endDate = ref(null);
const currentMenuId = ref(null);

// Hôm nay (00:00)
const today = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
})();

// minDate cho Calendar ngày kết thúc: không được < startDate và không được < hôm nay
const endMinDate = computed(() => {
    const start = normalizeDate(startDate.value);
    if (!start) return today;
    return start > today ? start : today;
});

/* ===== Days / meals / logic theo khoảng ngày ===== */

// Hiển thị từ Thứ 2 -> Thứ 7
const daysOfWeek = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const mealTypes = ['Sáng', 'Trưa', 'Chiều'];
const weeklyMenu = ref({});

// Map "Thứ x" -> JS getDay()
function vnDayLabelToJsDay(label) {
    switch (label) {
        case 'Chủ nhật':
            return 0;
        case 'Thứ 2':
            return 1;
        case 'Thứ 3':
            return 2;
        case 'Thứ 4':
            return 3;
        case 'Thứ 5':
            return 4;
        case 'Thứ 6':
            return 5;
        case 'Thứ 7':
            return 6;
        default:
            return null;
    }
}

/**
 * Tìm ngày thực tế (Date) tương ứng với "Thứ x"
 * trong khoảng [start, end]. Nếu không có thì trả về null.
 */
function getDateForDayInRange(dayLabel, start, end) {
    const s = normalizeDate(start);
    const e = normalizeDate(end);
    const targetDow = vnDayLabelToJsDay(dayLabel);

    if (!s || !e || targetDow === null || e < s) return null;

    const cur = new Date(s);
    while (cur <= e) {
        if (cur.getDay() === targetDow) {
            return new Date(cur);
        }
        cur.setDate(cur.getDate() + 1);
    }
    return null;
}

/**
 * Một "thứ" trong bảng Thực đơn tuần có được phép chỉnh sửa hay không:
 *  - Phải nằm trong khoảng [startDate, endDate]
 *  - Và không ở quá khứ so với hôm nay
 */
function isDayEnabled(dayLabel) {
    const d = getDateForDayInRange(dayLabel, startDate.value, endDate.value);
    if (!d) return false;
    const nd = normalizeDate(d);
    return nd >= today;
}

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

function applyMenuFromBackend(menu) {
    initEmptyWeeklyMenu();
    if (!menu || !menu.items) return;
    menu.items.forEach((it) => {
        const day = it.dayOfWeek;
        const meal = it.mealType;
        if (!weeklyMenu.value[day] || !weeklyMenu.value[day][meal]) return;
        const ids = (it.dishes || []).map((d) => d.id);
        weeklyMenu.value[day][meal].dishIds = ids;
    });
}

/* ===== Dishes ===== */
const allDishes = ref([]);
const dishTableFilter = ref('');
const editingDishId = ref(null);
const editingDishName = ref('');
const savingDishRow = ref(false);
const bulkSelectedDishIds = ref([]);

const dishOptions = computed(() =>
    allDishes.value.map((d) => ({ label: d.dishName, value: d.id }))
);

const filteredDishTable = computed(() => {
    const q = dishTableFilter.value.toLowerCase().trim();
    let list = allDishes.value || [];
    if (!q) return list;
    return list.filter((d) => (d.dishName || '').toLowerCase().includes(q));
});

function beginEditDish(dish) {
    editingDishId.value = dish.id;
    editingDishName.value = dish.dishName;
}

function cancelEditDish() {
    editingDishId.value = null;
    editingDishName.value = '';
}

async function saveEditDish() {
    if (!editingDishId.value) return;
    const newName = editingDishName.value.trim();
    if (!newName) {
        Swal.fire({ icon: 'warning', title: 'Tên món ăn không được để trống' });
        return;
    }
    savingDishRow.value = true;
    try {
        await updateMenuDish(editingDishId.value, newName);
        swalToast.fire({ icon: 'success', title: 'Đã cập nhật tên món ăn' });
        allDishes.value = await fetchAllMenuDishes();
        cancelEditDish();
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Cập nhật thất bại', text: e?.message });
    } finally {
        savingDishRow.value = false;
    }
}

function removeDishIdFromWeeklyMenus(dishId) {
    Object.keys(weeklyMenu.value).forEach((day) => {
        mealTypes.forEach((meal) => {
            const cell = weeklyMenu.value[day]?.[meal];
            if (cell && Array.isArray(cell.dishIds)) {
                cell.dishIds = cell.dishIds.filter((id) => id !== dishId);
            }
        });
    });
}

async function onDeleteDish(dish) {
    const { isConfirmed } = await Swal.fire({
        icon: 'warning',
        title: 'Xóa món ăn? ',
        text: `Xóa "${dish.dishName}"?`,
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#ef4444'
    });
    if (!isConfirmed) return;
    try {
        await deleteMenuDish(dish.id);
        swalToast.fire({ icon: 'success', title: 'Đã xóa món ăn' });
        allDishes.value = await fetchAllMenuDishes();
        removeDishIdFromWeeklyMenus(dish.id);
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Không thể xóa', text: e?.message });
    }
}

function toggleSelectAllDishes(event) {
    if (event.target.checked) {
        bulkSelectedDishIds.value = filteredDishTable.value.map((d) => d.id);
    } else {
        bulkSelectedDishIds.value = [];
    }
}

async function onBulkDeleteDishes() {
    if (!bulkSelectedDishIds.value.length) {
        Swal.fire({ icon: 'warning', title: 'Chưa chọn món nào' });
        return;
    }
    const count = bulkSelectedDishIds.value.length;
    const { isConfirmed } = await Swal.fire({
        icon: 'warning',
        title: `Xóa ${count} món ăn?`,
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#ef4444'
    });
    if (!isConfirmed) return;

    let ok = 0,
        fail = 0;
    for (const id of [...bulkSelectedDishIds.value]) {
        try {
            await deleteMenuDish(id);
            ok++;
            removeDishIdFromWeeklyMenus(id);
        } catch {
            fail++;
        }
    }
    allDishes.value = await fetchAllMenuDishes();
    bulkSelectedDishIds.value = [];
    swalToast.fire({
        icon: fail ? 'warning' : 'success',
        title: `Đã xóa ${ok} món${fail ? `, ${fail} lỗi` : ''}`
    });
}

/* ===== Modal Add Dish ===== */
const showAddDishModal = ref(false);
const newDishNamesText = ref('');
const dishModalTab = ref('quick');

const parsedDishes = computed(() =>
    newDishNamesText.value
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
);

function removeDish(idx) {
    const arr = parsedDishes.value;
    if (!arr[idx]) return;
    const toRemove = arr[idx];
    const lines = newDishNamesText.value.split('\n');
    newDishNamesText.value = lines.filter((l) => l.trim() !== toRemove).join('\n');
}

async function onSaveNewDishes() {
    const names = parsedDishes.value;
    if (!names.length) {
        Swal.fire({ icon: 'warning', title: 'Chưa nhập tên món ăn' });
        return;
    }
    try {
        await createMenuDishes(names);
        allDishes.value = await fetchAllMenuDishes();
        newDishNamesText.value = '';
        showAddDishModal.value = false;
        swalToast.fire({ icon: 'success', title: `Đã thêm ${names.length} món ăn` });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Tạo món thất bại', text: e?.message });
    }
}

/* ===== Loading States ===== */
const loadingInit = ref(false);
const loadingWeekly = ref(false);
const savingMenu = ref(false);

/* ===== Menu List (Detail Tab) ===== */
const menuList = ref([]);
const selectedMenu = ref(null);
const detailMenu = ref(null);
const detailLoading = ref(false);
const classFilterText = ref('');

const detailDaysOfWeek = daysOfWeek;

function getDishesBy(day, mealTypeLabel) {
    if (!detailMenu.value || !detailMenu.value.items) return [];
    const mealKey = mealTypeLabel.toLowerCase().replace('bữa ', '');
    return detailMenu.value.items
        .filter((it) => {
            const itMeal = String(it.mealType || '').toLowerCase();
            return it.dayOfWeek === day && itMeal === mealKey;
        })
        .flatMap((it) => it.dishes || []);
}

// Lấy đúng "ngày thực" cho từng thứ trong menu được chọn
function getDateOfDayInSelectedMenu(dayLabel) {
    if (!selectedMenu.value) return null;
    return getDateForDayInRange(dayLabel, selectedMenu.value.startDate, selectedMenu.value.endDate);
}

const filteredMenuList = computed(() => {
    if (!classFilterText.value) return menuList.value;
    const q = classFilterText.value.toLowerCase().trim();
    return menuList.value.filter((m) => (m.className || '').toLowerCase().includes(q));
});

function onSelectMenu(row) {
    selectedMenu.value = row;
    detailMenu.value = row.raw || null;
}

async function onDeleteSelectedMenu() {
    if (!selectedMenu.value) {
        Swal.fire({ icon: 'warning', title: 'Chưa chọn thực đơn' });
        return;
    }
    const row = selectedMenu.value;
    const classIds = row.classIds?.length ? row.classIds : [row.classId];
    const startStr = formatDate_ddMMyyyy(row.startDate);
    const endStr = formatDate_ddMMyyyy(row.endDate);

    const { isConfirmed } = await Swal.fire({
        icon: 'warning',
        title: 'Xóa thực đơn?',
        text: `Xóa thực đơn của khối "${row.className}"? `,
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#ef4444'
    });
    if (!isConfirmed) return;

    try {
        await Promise.all(classIds.map((cid) => deleteMenuByDateRange(cid, startStr, endStr).catch(() => {})));
        await initAllMenus();
        swalToast.fire({ icon: 'success', title: 'Đã xóa thực đơn' });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Xóa thất bại', text: e?.message });
    }
}

/* ===== Init ===== */
async function initAllMenus() {
    detailLoading.value = true;
    try {
        const grouped = new Map();
        for (const cls of classOptions.value) {
            const menus = await fetchMenusByClass(cls.value);
            (menus || []).forEach((m) => {
                const fullName = m.className || cls.label || '';
                const parts = fullName.split(' ');
                let grade = parts[0] || '';
                if (parts[0] === 'Nhà' && parts[1] === 'trẻ') grade = 'Nhà trẻ';

                const startD = new Date(m.startDate);
                const endD = new Date(m.endDate);
                const key = `${grade}|${startD.toISOString().substring(0, 10)}|${endD.toISOString().substring(0, 10)}`;

                if (!grouped.has(key)) {
                    grouped.set(key, {
                        id: m.id,
                        gradeName: grade,
                        classIds: [cls.value],
                        classNames: [fullName],
                        startDate: startD,
                        endDate: endD,
                        createdBy: m.createdBy,
                        raw: m
                    });
                } else {
                    const g = grouped.get(key);
                    g.classIds.push(cls.value);
                    g.classNames.push(fullName);
                }
            });
        }

        const all = Array.from(grouped.values()).map((g) => ({
            id: g.id,
            classId: g.classIds[0],
            classIds: g.classIds,
            classNames: g.classNames,
            className: g.gradeName,
            startDate: g.startDate,
            endDate: g.endDate,
            createdBy: g.createdBy,
            raw: g.raw
        }));

        all.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
        menuList.value = all;

        if (menuList.value.length > 0) {
            selectedMenu.value = menuList.value[0];
            detailMenu.value = menuList.value[0].raw;
        } else {
            selectedMenu.value = null;
            detailMenu.value = null;
        }
    } catch (e) {
        console.warn('[MenuPage] initAllMenus error:', e);
    } finally {
        detailLoading.value = false;
    }
}

async function init() {
    loadingInit.value = true;
    try {
        classOptions.value = await fetchClassOptions();
        allDishes.value = await fetchAllMenuDishes();
        initEmptyWeeklyMenu();
        await initAllMenus();
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Lỗi khởi tạo', text: e?.message });
    } finally {
        loadingInit.value = false;
    }
}

async function onLoadWeeklyMenu() {
    let targetClassId = null;
    if (applyMode.value === 'class') {
        if (!selectedClassId.value) {
            Swal.fire({ icon: 'warning', title: 'Vui lòng chọn lớp' });
            return;
        }
        targetClassId = selectedClassId.value;
    } else {
        if (!selectedGradeForMenu.value) {
            Swal.fire({ icon: 'warning', title: 'Vui lòng chọn khối' });
            return;
        }
        const list = classesByGrade.value[selectedGradeForMenu.value] || [];
        if (!list.length) {
            Swal.fire({ icon: 'warning', title: 'Khối chưa có lớp' });
            return;
        }
        targetClassId = list[0].value;
    }

    if (!startDate.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn ngày bắt đầu' });
        return;
    }
    if (!endDate.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn ngày kết thúc' });
        return;
    }

    const startParam = formatDate_yyyyMMdd(startDate.value);
    const endParam = formatDate_yyyyMMdd(endDate.value);

    loadingWeekly.value = true;
    try {
        const menu = await fetchWeeklyMenu({ classId: targetClassId, startDate: startParam, endDate: endParam });
        if (!menu) {
            currentMenuId.value = null;
            initEmptyWeeklyMenu();
            Swal.fire({ icon: 'info', title: 'Chưa có thực đơn', text: 'Bạn có thể tạo mới.' });
            return;
        }
        currentMenuId.value = menu.id || null;
        applyMenuFromBackend(menu);
        swalToast.fire({ icon: 'success', title: 'Đã tải thực đơn' });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Lỗi tải thực đơn', text: e?.message });
    } finally {
        loadingWeekly.value = false;
    }
}

async function onSaveWeeklyMenu() {
    if (!startDate.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn ngày bắt đầu' });
        return;
    }
    if (!endDate.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn ngày kết thúc' });
        return;
    }

    if (applyMode.value === 'class' && !selectedClassId.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn lớp' });
        return;
    }
    if (applyMode.value === 'grade' && !selectedGradeForMenu.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn khối' });
        return;
    }

    const start = startDate.value;
    const end = endDate.value;

    const basePayload = {
        startDate: formatDate_ddMMyyyy(start),
        endDate: formatDate_ddMMyyyy(end),
        createdBy: 'admin',
        items: []
    };

    // Chỉ lưu các ngày được phép (nằm trong khoảng & không quá khứ)
    daysOfWeek.forEach((day) => {
        if (!isDayEnabled(day)) return;
        mealTypes.forEach((meal) => {
            const cell = weeklyMenu.value[day]?.[meal];
            const ids = cell?.dishIds || [];
            if (ids.length) {
                basePayload.items.push({ dayOfWeek: day, mealType: meal, dishIds: ids });
            }
        });
    });

    if (!basePayload.items.length) {
        Swal.fire({ icon: 'warning', title: 'Thực đơn trống', text: 'Chọn ít nhất 1 món' });
        return;
    }

    savingMenu.value = true;
    try {
        if (applyMode.value === 'class') {
            const payload = { ...basePayload, classId: selectedClassId.value };
            if (currentMenuId.value) {
                await updateWeeklyMenu(currentMenuId.value, payload);
            } else {
                const created = await createWeeklyMenu(payload);
                currentMenuId.value = created?.id || null;
            }
            swalToast.fire({ icon: 'success', title: 'Đã lưu thực đơn' });
        } else {
            const list = classesByGrade.value[selectedGradeForMenu.value] || [];
            const startIso = formatDate_yyyyMMdd(start);
            const endIso = formatDate_yyyyMMdd(end);
            let ok = 0;
            for (const cls of list) {
                try {
                    const existing = await fetchWeeklyMenu({
                        classId: cls.value,
                        startDate: startIso,
                        endDate: endIso
                    });
                    const payloadForClass = { ...basePayload, classId: cls.value };
                    if (existing?.id) {
                        await updateWeeklyMenu(existing.id, payloadForClass);
                    } else {
                        await createWeeklyMenu(payloadForClass);
                    }
                    ok++;
                } catch {
                    // bỏ qua lỗi từng lớp
                }
            }
            swalToast.fire({ icon: 'success', title: `Đã áp dụng cho ${ok}/${list.length} lớp` });
        }
        await initAllMenus();
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Lưu thất bại', text: e?.message });
    } finally {
        savingMenu.value = false;
    }
}

async function onDeleteCurrentMenu() {
    if (applyMode.value !== 'class' || !currentMenuId.value) {
        Swal.fire({ icon: 'warning', title: 'Chưa có thực đơn để xóa' });
        return;
    }
    const { isConfirmed } = await Swal.fire({
        icon: 'warning',
        title: 'Xóa thực đơn? ',
        showCancelButton: true,
        confirmButtonColor: '#ef4444'
    });
    if (!isConfirmed) return;

    try {
        await deleteWeeklyMenu(currentMenuId.value);
        swalToast.fire({ icon: 'success', title: 'Đã xóa thực đơn' });
        currentMenuId.value = null;
        initEmptyWeeklyMenu();
        await initAllMenus();
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Xóa thất bại', text: e?.message });
    }
}

onMounted(init);
</script>

<template>
    <div class="menu-page">
        <!-- Loading Overlay -->
        <div v-if="loadingInit" class="loading-overlay">
            <div class="loading-content">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Đang tải dữ liệu...</p>
            </div>
        </div>

        <div v-else class="page-content">
            <!-- Header -->
            <div class="page-header">
                <div class="header-info">
                    <div class="header-icon">
                        <i class="fa-solid fa-utensils"></i>
                    </div>
                    <div>
                        <h1>Quản lý thực đơn</h1>
                        <p>Tạo và quản lý thực đơn tuần cho các khối lớp</p>
                    </div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="tabs-container">
                <button class="tab-btn" :class="{ active: activeTab === 'create' }" @click="activeTab = 'create'">
                    <i class="fa-solid fa-plus-circle"></i>
                    <span>Tạo thực đơn</span>
                </button>
                <button class="tab-btn" :class="{ active: activeTab === 'detail' }" @click="activeTab = 'detail'">
                    <i class="fa-solid fa-list"></i>
                    <span>Danh sách thực đơn</span>
                </button>
            </div>

            <!-- TAB: TẠO THỰC ĐƠN -->
            <div v-show="activeTab === 'create'" class="tab-content">
                <!-- Filter Section -->
                <div class="filter-section">
                    <div class="filter-card">
                        <div class="filter-header">
                            <i class="fa-solid fa-filter"></i>
                            <span>Cấu hình thực đơn</span>
                        </div>

                        <div class="filter-body">
                            <!-- Apply Mode -->
                            <div class="filter-group full-width">
                                <label>Áp dụng cho</label>
                                <div class="radio-group">
                                    <label class="radio-item" :class="{ active: applyMode === 'grade' }">
                                        <input type="radio" value="grade" v-model="applyMode" />
                                        <i class="fa-solid fa-layer-group"></i>
                                        <span>Cả khối</span>
                                    </label>
                                    <label class="radio-item" :class="{ active: applyMode === 'class' }">
                                        <input type="radio" value="class" v-model="applyMode" />
                                        <i class="fa-solid fa-school"></i>
                                        <span>Một lớp</span>
                                    </label>
                                </div>
                            </div>

                            <!-- Class/Grade Select -->
                            <div class="filter-group">
                                <label>{{ applyMode === 'class' ? 'Chọn lớp' : 'Chọn khối' }}</label>
                                <Dropdown
                                    v-if="applyMode === 'class'"
                                    v-model="selectedClassId"
                                    :options="classOptions"
                                    optionLabel="label"
                                    optionValue="value"
                                    placeholder="Chọn lớp"
                                    class="w-full"
                                />
                                <Dropdown
                                    v-else
                                    v-model="selectedGradeForMenu"
                                    :options="gradeOptions"
                                    optionLabel="label"
                                    optionValue="value"
                                    placeholder="Chọn khối"
                                    class="w-full"
                                />
                            </div>

                            <!-- Date Range -->
                            <div class="filter-group">
                                <label>Ngày bắt đầu (Thứ 2 - Thứ 6, không chọn ngày đã qua)</label>
                                <Calendar
                                    v-model="startDate"
                                    dateFormat="dd/mm/yy"
                                    showIcon
                                    :disabledDays="[0, 6]"
                                    :minDate="today"
                                    class="w-full"
                                />
                            </div>

                            <div class="filter-group">
                                <label>
                                    Ngày kết thúc
                                    <span v-if="endDate" class="hint">
                                        (Không trước ngày bắt đầu, không trước hôm nay)
                                    </span>
                                </label>
                                <Calendar
                                    v-model="endDate"
                                    dateFormat="dd/mm/yy"
                                    showIcon
                                    :disabledDays="[0]"      
                                    :minDate="endMinDate"
                                    class="w-full"
                                />
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="filter-actions">
                            <button class="action-btn secondary" :disabled="loadingWeekly" @click="onLoadWeeklyMenu">
                                <i class="fa-solid fa-download"></i>
                                {{ loadingWeekly ? 'Đang tải...' : 'Tải thực đơn' }}
                            </button>
                            <button
                                v-if="applyMode === 'class' && currentMenuId"
                                class="action-btn danger"
                                @click="onDeleteCurrentMenu"
                            >
                                <i class="fa-solid fa-trash"></i>
                                Xóa
                            </button>
                            <button class="action-btn primary" :disabled="savingMenu" @click="onSaveWeeklyMenu">
                                <i class="fa-solid fa-save"></i>
                                {{ savingMenu ? 'Đang lưu...' : 'Lưu thực đơn' }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Dishes Management -->
                <div class="dishes-section">
                    <div class="section-header">
                        <div class="section-title">
                            <i class="fa-solid fa-bowl-food"></i>
                            <span>Danh sách món ăn</span>
                            <span class="count-badge">{{ allDishes.length }}</span>
                        </div>
                        <div class="section-actions">
                            <button
                                v-if="bulkSelectedDishIds.length"
                                class="action-btn danger small"
                                @click="onBulkDeleteDishes"
                            >
                                <i class="fa-solid fa-trash"></i>
                                Xóa {{ bulkSelectedDishIds.length }} món
                            </button>
                            <button class="action-btn success small" @click="showAddDishModal = true">
                                <i class="fa-solid fa-plus"></i>
                                Thêm món
                            </button>
                        </div>
                    </div>

                    <div class="dishes-filter">
                        <i class="fa-solid fa-search"></i>
                        <InputText v-model="dishTableFilter" placeholder="Tìm kiếm món ăn..." />
                    </div>

                    <div class="dishes-table-wrapper">
                        <table class="dishes-table">
                            <thead>
                                <tr>
                                    <th class="col-check">
                                        <input
                                            type="checkbox"
                                            :checked="
                                                bulkSelectedDishIds.length &&
                                                bulkSelectedDishIds.length === filteredDishTable.length
                                            "
                                            @change="toggleSelectAllDishes"
                                        />
                                    </th>
                                    <th class="col-num">#</th>
                                    <th>Tên món ăn</th>
                                    <th class="col-actions">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(dish, idx) in filteredDishTable" :key="dish.id">
                                    <td>
                                        <input type="checkbox" :value="dish.id" v-model="bulkSelectedDishIds" />
                                    </td>
                                    <td>{{ idx + 1 }}</td>
                                    <td>
                                        <template v-if="editingDishId !== dish.id">
                                            {{ dish.dishName }}
                                        </template>
                                        <InputText v-else v-model="editingDishName" class="edit-input" />
                                    </td>
                                    <td>
                                        <div class="table-actions">
                                            <template v-if="editingDishId !== dish.id">
                                                <button class="icon-btn edit" @click="beginEditDish(dish)">
                                                    <i class="fa-solid fa-pen"></i>
                                                </button>
                                                <button class="icon-btn delete" @click="onDeleteDish(dish)">
                                                    <i class="fa-solid fa-trash"></i>
                                                </button>
                                            </template>
                                            <template v-else>
                                                <button
                                                    class="icon-btn save"
                                                    :disabled="savingDishRow"
                                                    @click="saveEditDish"
                                                >
                                                    <i class="fa-solid fa-check"></i>
                                                </button>
                                                <button class="icon-btn cancel" @click="cancelEditDish">
                                                    <i class="fa-solid fa-times"></i>
                                                </button>
                                            </template>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-if="!filteredDishTable.length">
                                    <td colspan="4" class="empty-row">
                                        <i class="fa-solid fa-inbox"></i>
                                        <span>Chưa có món ăn nào</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Weekly Menu Table -->
                <div class="weekly-menu-section">
                    <div class="section-header">
                        <div class="section-title">
                            <i class="fa-solid fa-calendar-week"></i>
                            <span>Thực đơn tuần</span>
                        </div>
                    </div>

                    <div class="weekly-table-wrapper">
                        <table class="weekly-table">
                            <thead>
                                <tr>
                                    <th class="col-day">Ngày</th>
                                    <th v-for="meal in mealTypes" :key="meal" class="col-meal">
                                        <div class="meal-header">
                                            <i
                                                :class="
                                                    meal === 'Sáng'
                                                        ? 'fa-solid fa-sun'
                                                        : meal === 'Trưa'
                                                        ? 'fa-solid fa-cloud-sun'
                                                        : 'fa-solid fa-moon'
                                                "
                                            ></i>
                                            <span>{{ meal }}</span>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="day in daysOfWeek"
                                    :key="day"
                                    :class="{ 'row-disabled': !isDayEnabled(day) }"
                                >
                                    <td class="cell-day">
                                        <span class="day-name">{{ day }}</span>
                                    </td>
                                    <td v-for="meal in mealTypes" :key="meal" class="cell-meal">
                                        <MultiSelect
                                            v-if="weeklyMenu[day] && weeklyMenu[day][meal]"
                                            v-model="weeklyMenu[day][meal].dishIds"
                                            :options="dishOptions"
                                            optionLabel="label"
                                            optionValue="value"
                                            display="chip"
                                            placeholder="Chọn món..."
                                            class="w-full"
                                            :disabled="!isDayEnabled(day)"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- TAB: DANH SÁCH THỰC ĐƠN -->
            <div v-show="activeTab === 'detail'" class="tab-content">
                <div class="detail-layout">
                    <!-- Left: Menu List -->
                    <div class="detail-left">
                        <div class="panel-header">
                            <h3>Danh sách thực đơn</h3>
                            <span class="count-badge">{{ filteredMenuList.length }}</span>
                        </div>

                        <div class="menu-filter">
                            <i class="fa-solid fa-search"></i>
                            <InputText v-model="classFilterText" placeholder="Tìm theo khối..." />
                        </div>

                        <div class="menu-list">
                            <div
                                v-for="(row, idx) in filteredMenuList"
                                :key="row.id"
                                class="menu-item"
                                :class="{ active: selectedMenu?.id === row.id }"
                                @click="onSelectMenu(row)"
                            >
                                <div class="menu-item-index">{{ idx + 1 }}</div>
                                <div class="menu-item-info">
                                    <div class="menu-item-grade">{{ row.className }}</div>
                                    <div class="menu-item-date">
                                        {{ formatDateDisplay(row.startDate) }} -
                                        {{ formatDateDisplay(row.endDate) }}
                                    </div>
                                </div>
                                <i class="fa-solid fa-chevron-right"></i>
                            </div>

                            <div v-if="!filteredMenuList.length" class="empty-list">
                                <i class="fa-solid fa-inbox"></i>
                                <p>Chưa có thực đơn nào</p>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Menu Detail -->
                    <div class="detail-right">
                        <div class="panel-header">
                            <h3>Chi tiết thực đơn</h3>
                            <div class="panel-actions" v-if="detailMenu">
                                <button class="action-btn danger small" @click="onDeleteSelectedMenu">
                                    <i class="fa-solid fa-trash"></i>
                                    Xóa
                                </button>
                            </div>
                        </div>

                        <div v-if="detailLoading" class="detail-loading">
                            <i class="fa-solid fa-spinner fa-spin"></i>
                            <span>Đang tải...</span>
                        </div>

                        <div v-else-if="detailMenu && selectedMenu" class="detail-content">
                            <!-- Meta Info -->
                            <div class="detail-meta">
                                <div class="meta-item">
                                    <i class="fa-solid fa-layer-group"></i>
                                    <span>Khối:</span>
                                    <strong>{{ selectedMenu.className }}</strong>
                                </div>
                                <div class="meta-item" v-if="selectedMenu.classNames?.length">
                                    <i class="fa-solid fa-school"></i>
                                    <span>Lớp:</span>
                                    <strong>{{ selectedMenu.classNames.join(', ') }}</strong>
                                </div>
                                <div class="meta-item">
                                    <i class="fa-solid fa-calendar"></i>
                                    <span>Thời gian:</span>
                                    <strong>
                                        {{ formatDateDisplay(selectedMenu.startDate) }} -
                                        {{ formatDateDisplay(selectedMenu.endDate) }}
                                    </strong>
                                </div>
                                <div class="meta-item">
                                    <i class="fa-solid fa-user"></i>
                                    <span>Người tạo:</span>
                                    <strong>{{ selectedMenu.createdBy || '—' }}</strong>
                                </div>
                            </div>

                            <!-- Detail Table -->
                            <div class="detail-table-wrapper">
                                <table class="detail-table">
                                    <thead>
                                        <tr>
                                            <th class="col-day">Ngày</th>
                                            <th>Bữa sáng</th>
                                            <th>Bữa trưa</th>
                                            <th>Bữa chiều</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="day in detailDaysOfWeek" :key="day">
                                            <td
                                                class="cell-day-detail"
                                                :class="{ 'day-disabled': !getDateOfDayInSelectedMenu(day) }"
                                            >
                                                <span class="day-label">{{ day }}</span>
                                                <span
                                                    v-if="getDateOfDayInSelectedMenu(day)"
                                                    class="day-number"
                                                >
                                                    {{ formatDateDisplay(getDateOfDayInSelectedMenu(day)) }}
                                                </span>
                                            </td>
                                            <td class="cell-dishes">
                                                <div
                                                    v-for="dish in getDishesBy(day, 'Bữa sáng')"
                                                    :key="dish.id"
                                                    class="dish-tag"
                                                >
                                                    {{ dish.dishName }}
                                                </div>
                                                <span
                                                    v-if="!getDishesBy(day, 'Bữa sáng').length"
                                                    class="no-dish"
                                                >—</span>
                                            </td>
                                            <td class="cell-dishes">
                                                <div
                                                    v-for="dish in getDishesBy(day, 'Bữa trưa')"
                                                    :key="dish.id"
                                                    class="dish-tag"
                                                >
                                                    {{ dish.dishName }}
                                                </div>
                                                <span
                                                    v-if="!getDishesBy(day, 'Bữa trưa').length"
                                                    class="no-dish"
                                                >—</span>
                                            </td>
                                            <td class="cell-dishes">
                                                <div
                                                    v-for="dish in getDishesBy(day, 'Bữa chiều')"
                                                    :key="dish.id"
                                                    class="dish-tag"
                                                >
                                                    {{ dish.dishName }}
                                                </div>
                                                <span
                                                    v-if="!getDishesBy(day, 'Bữa chiều').length"
                                                    class="no-dish"
                                                >—</span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div v-else class="detail-empty">
                            <i class="fa-solid fa-hand-pointer"></i>
                            <p>Chọn một thực đơn để xem chi tiết</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal: Add Dishes -->
        <Dialog
            v-model:visible="showAddDishModal"
            modal
            :style="{ width: '500px', maxWidth: '95vw' }"
            class="dish-modal"
        >
            <template #header>
                <div class="modal-header">
                    <div class="modal-icon">
                        <i class="fa-solid fa-plus-circle"></i>
                    </div>
                    <div>
                        <h3>Thêm món ăn</h3>
                        <p>Nhập mỗi món một dòng</p>
                    </div>
                </div>
            </template>

            <div class="modal-body">
                <!-- Tabs -->
                <div class="modal-tabs">
                    <button
                        class="modal-tab"
                        :class="{ active: dishModalTab === 'quick' }"
                        @click="dishModalTab = 'quick'"
                    >
                        <i class="fa-solid fa-keyboard"></i>
                        Nhập nhanh
                    </button>
                    <button
                        class="modal-tab"
                        :class="{ active: dishModalTab === 'list' }"
                        @click="dishModalTab = 'list'"
                    >
                        <i class="fa-solid fa-list"></i>
                        Xem trước ({{ parsedDishes.length }})
                    </button>
                </div>

                <!-- Quick Input -->
                <div v-if="dishModalTab === 'quick'" class="quick-input-section">
                    <div class="input-hint">
                        <i class="fa-solid fa-lightbulb"></i>
                        <span>Ví dụ: Cơm gà xối mỡ, Canh rau củ... </span>
                    </div>
                    <textarea
                        v-model="newDishNamesText"
                        rows="8"
                        placeholder="Nhập tên món ăn, mỗi dòng một món..."
                        class="dish-textarea"
                    ></textarea>
                    <div class="input-count">
                        Đã nhập: <strong>{{ parsedDishes.length }}</strong> món
                    </div>
                </div>

                <!-- Preview List -->
                <div v-else class="preview-section">
                    <div v-if="!parsedDishes.length" class="preview-empty">
                        <i class="fa-solid fa-inbox"></i>
                        <p>Chưa có món nào</p>
                    </div>
                    <div v-else class="preview-list">
                        <div v-for="(dish, idx) in parsedDishes" :key="idx" class="preview-item">
                            <span class="preview-index">{{ idx + 1 }}</span>
                            <span class="preview-name">{{ dish }}</span>
                            <button class="preview-remove" @click="removeDish(idx)">
                                <i class="fa-solid fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="modal-footer">
                    <button class="action-btn secondary" @click="showAddDishModal = false">Hủy</button>
                    <button
                        class="action-btn primary"
                        :disabled="!parsedDishes.length"
                        @click="onSaveNewDishes"
                    >
                        <i class="fa-solid fa-save"></i>
                        Lưu {{ parsedDishes.length }} món
                    </button>
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.menu-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 50%, #ecfdf5 100%);
}

/* Loading */
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
    color: #f97316;
}

.loading-content i {
    font-size: 48px;
    margin-bottom: 16px;
}

.loading-content p {
    color: #64748b;
}

/* Page Content */
.page-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
}

/* Header */
.page-header {
    margin-bottom: 24px;
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
    background: linear-gradient(135deg, #f97316, #fb923c);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 24px;
    box-shadow: 0 8px 24px rgba(249, 115, 22, 0.3);
}

.page-header h1 {
    font-size: 28px;
    font-weight: 800;
    color: #1e293b;
    margin: 0;
}

.page-header p {
    font-size: 14px;
    color: #64748b;
    margin: 4px 0 0;
}

/* Tabs */
.tabs-container {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    background: #fff;
    padding: 6px;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    border: none;
    border-radius: 12px;
    background: transparent;
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
}

.tab-btn:hover {
    background: #f8fafc;
}

.tab-btn.active {
    background: linear-gradient(135deg, #f97316, #fb923c);
    color: #fff;
    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
}

/* Tab Content */
.tab-content {
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Filter Section */
.filter-section {
    margin-bottom: 24px;
}

.filter-card {
    background: #fff;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.filter-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 20px;
}

.filter-header i {
    color: #f97316;
}

.filter-body {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.filter-group.full-width {
    grid-column: span 4;
}

.filter-group label {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
}

.filter-group .hint {
    font-weight: 400;
    color: #94a3b8;
    font-size: 11px;
}

/* Radio Group */
.radio-group {
    display: flex;
    gap: 16px;
}

.radio-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;
    color: #64748b;
}

.radio-item input {
    display: none;
}

.radio-item.active {
    border-color: #f97316;
    background: linear-gradient(135deg, #fff7ed, #ffedd5);
    color: #ea580c;
}

.radio-item i {
    font-size: 16px;
}

/* Filter Actions */
.filter-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid #f1f5f9;
}

/* Action Buttons */
.action-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.action-btn.small {
    padding: 8px 14px;
    font-size: 13px;
}

.action-btn.primary {
    background: linear-gradient(135deg, #f97316, #fb923c);
    color: #fff;
    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
}

.action-btn.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(249, 115, 22, 0.4);
}

.action-btn.secondary {
    background: #f1f59;
    color: #475569;
}

.action-btn.secondary:hover {
    background: #e2e8f0;
}

.action-btn.success {
    background: linear-gradient(135deg, #10b981, #34d399);
    color: #fff;
}

.action-btn.danger {
    background: linear-gradient(135deg, #ef4444, #f87171);
    color: #fff;
}

.action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
}

/* Dishes Section */
.dishes-section {
    background: #fff;
    border-radius: 20px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
}

.section-title i {
    color: #f97316;
}

.count-badge {
    background: linear-gradient(135deg, #f97316, #fb923c);
    color: #fff;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
}

.section-actions {
    display: flex;
    gap: 10px;
}

/* Dishes Filter */
.dishes-filter {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px 16px;
    background: #f8fafc;
    border-radius: 12px;
}

.dishes-filter i {
    color: #94a3b8;
}

.dishes-filter input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 14px;
}

/* Dishes Table */
.dishes-table-wrapper {
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    overflow: hidden;
    max-height: 300px;
    overflow-y: auto;
}

.dishes-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}

.dishes-table thead {
    background: #f8fafc;
    position: sticky;
    top: 0;
}

.dishes-table th {
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    color: #64748b;
    font-size: 12px;
    text-transform: uppercase;
}

.dishes-table td {
    padding: 12px 16px;
    border-top: 1px solid #f1f5f9;
}

.dishes-table tbody tr:hover {
    background: #fefce8;
}

.col-check {
    width: 40px;
    text-align: center;
}
.col-num {
    width: 50px;
}
.col-actions {
    width: 120px;
}

.edit-input {
    width: 100%;
}

.table-actions {
    display: flex;
    gap: 6px;
}

.icon-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.icon-btn.edit {
    background: #dbeafe;
    color: #2563eb;
}
.icon-btn.delete {
    background: #fee2e2;
    color: #dc2626;
}
.icon-btn.save {
    background: #d1fae5;
    color: #059669;
}
.icon-btn.cancel {
    background: #f1f5f9;
    color: #64748b;
}

.icon-btn:hover {
    transform: scale(1.1);
}

.empty-row {
    text-align: center;
    color: #94a3b8;
    padding: 32px !important;
}

.empty-row i {
    font-size: 32px;
    margin-bottom: 8px;
    display: block;
}

/* Weekly Menu Section */
.weekly-menu-section {
    background: #fff;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.weekly-table-wrapper {
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    overflow: hidden;
}

.weekly-table {
    width: 100%;
    border-collapse: collapse;
}

.weekly-table thead {
    background: linear-gradient(135deg, #fef3c7, #fde68a);
}

.weekly-table th {
    padding: 14px 16px;
    font-weight: 600;
    color: #92400e;
}

.meal-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.col-day {
    width: 100px;
}
.col-meal {
    width: 30%;
}

.weekly-table td {
    padding: 12px 16px;
    border-top: 1px solid #f1f5f9;
    vertical-align: top;
}

.cell-day {
    background: linear-gradient(135deg, #ffedd5, #fed7aa);
    text-align: center;
}

.day-name {
    font-weight: 700;
    color: #c2410c;
}

.cell-meal {
    min-width: 200px;
}

/* Hàng bị khóa (ngày không nằm trong khoảng / đã qua) */
.weekly-table tr.row-disabled .cell-day {
    background: #f8fafc;
}

.weekly-table tr.row-disabled .day-name {
    color: #94a3b8;
}

/* ====== DETAIL LAYOUT ====== */

.detail-layout {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    margin-top: 8px;
}

.detail-left {
    width: 320px;
    background: #fff;
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.detail-right {
    flex: 1;
    background: #fff;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.panel-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
}

.panel-actions {
    display: flex;
    gap: 8px;
}

/* Left list */
.menu-filter {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding: 8px 10px;
    border-radius: 10px;
    background: #f8fafc;
    font-size: 13px;
}

.menu-filter i {
    color: #94a3b8;
}

.menu-filter input {
    border: none;
    background: transparent;
    font-size: 13px;
}

.menu-list {
    margin-top: 12px;
    max-height: 360px;
    overflow-y: auto;
}

.menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
    font-size: 13px;
    color: #0f172a;
}

.menu-item + .menu-item {
    margin-top: 6px;
}

.menu-item:hover {
    background: #f9fafb;
}

.menu-item.active {
    border-color: #f97316;
    background: #fff7ed;
}

.menu-item-index {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: #fee2e2;
    color: #b91c1c;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
}

.menu-item-info {
    flex: 1;
    min-width: 0;
}

.menu-item-grade {
    font-weight: 600;
    color: #111827;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.menu-item-date {
    font-size: 12px;
    color: #64748b;
}

.menu-item > i {
    font-size: 12px;
    color: #cbd5f5;
}

.empty-list {
    margin-top: 40px;
    text-align: center;
    color: #94a3b8;
    font-size: 13px;
}

.empty-list i {
    font-size: 28px;
    margin-bottom: 6px;
    display: block;
}

/* Right detail */
.detail-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #64748b;
    font-size: 14px;
}

.detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 20px;
    margin-bottom: 16px;
    font-size: 13px;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #475569;
}

.meta-item i {
    color: #f97316;
}

.meta-item span {
    font-weight: 500;
}

.meta-item strong {
    font-weight: 700;
    color: #111827;
}

/* Detail table */
.detail-table-wrapper {
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    overflow: hidden;
}

.detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}

.detail-table thead {
    background: linear-gradient(135deg, #fef3c7, #fde68a);
}

.detail-table th {
    padding: 12px 14px;
    font-weight: 600;
    color: #92400e;
    text-align: left;
}

.detail-table td {
    padding: 10px 14px;
    border-top: 1px solid #f1f5f9;
    vertical-align: top;
}

.cell-day-detail {
    background: #fffbeb;
    min-width: 110px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.day-label {
    font-size: 14px;
    font-weight: 700;
    color: #92400e;
}

.day-number {
    font-size: 12px;
    color: #f97316;
}

/* Ngày không thuộc khoảng thực đơn */
.day-disabled {
    background: #f8fafc;
}

.day-disabled .day-label,
.day-disabled .day-number {
    color: #94a3b8;
}

.cell-dishes {
    min-height: 44px;
}

.dish-tag {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    margin: 2px 6px 2px 0;
    border-radius: 999px;
    background: #f1f5f9;
    font-size: 13px;
    color: #0f172a;
}

.no-dish {
    font-size: 13px;
    color: #cbd5f5;
}

/* Empty right */
.detail-empty {
    min-height: 220px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 14px;
    gap: 8px;
}

.detail-empty i {
    font-size: 32px;
}

/* Responsive */
@media (max-width: 1024px) {
    .detail-layout {
        flex-direction: column;
    }
    .detail-left,
    .detail-right {
        width: 100%;
    }
}
</style>
