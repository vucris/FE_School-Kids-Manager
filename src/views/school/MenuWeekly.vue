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
import {
    fetchAllMenuDishes,
    createMenuDishes,
    fetchWeeklyMenu,
    createWeeklyMenu,
    updateWeeklyMenu,
    fetchMenusByClass,
    deleteMenuByDateRange
} from '@/service/menuService.js';

/* ===== Tabs (Tạo thực đơn / Chi tiết thực đơn) ===== */
const activeTab = ref('create'); // 'create' | 'detail'
function switchTab(tab) {
    activeTab.value = tab;
}

/* ===== SweetAlert toast dùng chung ===== */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true
});

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

/* ===== Lớp (dùng chung) ===== */
const classOptions = ref([]);

/* Áp dụng thực đơn: theo lớp / theo khối */
const applyMode = ref('class'); // 'class' | 'grade'
const selectedGradeForMenu = ref('');

/* Sinh danh sách khối từ tên lớp */
const gradeOptions = computed(() => {
    const map = new Map();
    classOptions.value.forEach((cls) => {
        const label = cls.label || '';
        if (!label) return;
        const parts = label.split(' ');
        if (!parts.length) return;

        let grade = parts[0];
        if (parts[0] === 'Nhà' && parts[1] === 'trẻ') grade = 'Nhà trẻ';

        if (!map.has(grade)) {
            map.set(grade, { label: grade, value: grade });
        }
    });
    return Array.from(map.values());
});

/* Gom lớp theo khối */
const classesByGrade = computed(() => {
    const res = {};
    classOptions.value.forEach((cls) => {
        const label = cls.label || '';
        if (!label) return;
        const parts = label.split(' ');
        if (!parts.length) return;

        let grade = parts[0];
        if (parts[0] === 'Nhà' && parts[1] === 'trẻ') grade = 'Nhà trẻ';

        if (!res[grade]) res[grade] = [];
        res[grade].push(cls);
    });
    return res;
});

/* ====== PHẦN 1: TẠO / SỬA THỰC ĐƠN TUẦN ====== */
const selectedClassId = ref(null);
const startDate = ref(null);
const endDate = ref(null);

// gợi ý: 6 ngày (T2 -> T7)
const autoEndDate = computed(() => {
    if (!startDate.value) return null;
    const d = new Date(startDate.value);
    d.setDate(d.getDate() + 5);
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

/* weekly menu cho tab tạo/sửa */
const daysOfWeek = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const mealTypes = ['Sáng', 'Trưa', 'Chiều'];

// weeklyMenu: { [day]: { [meal]: { dishIds: number[] } } }
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
    if (!menu || !menu.items) return;
    menu.items.forEach((it) => {
        const day = it.dayOfWeek;
        const meal = it.mealType;
        if (!weeklyMenu.value[day] || !weeklyMenu.value[day][meal]) return;
        const ids = (it.dishes || []).map((d) => d.id);
        weeklyMenu.value[day][meal].dishIds = ids;
    });
}

const currentMenuId = ref(null);

/* Loading states */
const loadingInit = ref(false); // khởi tạo chung
const loadingWeekly = ref(false); // load 1 thực đơn tuần
const savingMenu = ref(false); // lưu thực đơn tuần

/* ====== MODAL THÊM MÓN ĂN ====== */
const showAddDishModal = ref(false);
const newDishNamesText = ref('');
const dishModalTab = ref('quick'); // 'quick' | 'list'

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
    const nextLines = lines.filter((l) => l.trim() !== toRemove);
    newDishNamesText.value = nextLines.join('\n');
}

/* ====== PHẦN 2: CHI TIẾT THỰC ĐƠN (LIST + DETAIL) ====== */
const classFilterText = ref(''); // lọc theo tên khối/lớp

// mỗi row là 1 "thực đơn của khối trong 1 tuần"
// { id, classId, classIds, classNames, className (khối), startDate, endDate, createdBy, raw }
const menuList = ref([]);
const selectedMenu = ref(null);
const detailMenu = ref(null); // MenuResponse đại diện
const detailLoading = ref(false);

const detailDaysOfWeek = daysOfWeek;
const detailMealTypes = ['Bữa sáng', 'Bữa trưa', 'Bữa chiều'];

/**
 * Lấy danh sách món theo ngày + bữa để hiển thị detail
 * mealTypeLabel: 'Bữa sáng' | 'Bữa trưa' | 'Bữa chiều'
 * BE lưu: 'Sáng' | 'Trưa' | 'Chiều' trong field mealType
 */
function getDishesBy(day, mealTypeLabel) {
    if (!detailMenu.value || !detailMenu.value.items) return [];

    // 'Bữa sáng' -> 'sáng', 'Bữa trưa' -> 'trưa', ...
    const mealKey = mealTypeLabel.toLowerCase().replace('bữa ', '');

    return detailMenu.value.items
        .filter((it) => {
            const itMeal = String(it.mealType || '').toLowerCase(); // 'sáng', 'trưa', 'chiều'
            return it.dayOfWeek === day && itMeal === mealKey;
        })
        .flatMap((it) => it.dishes || []);
}

/* Lọc theo tên khối/lớp client-side */
const filteredMenuList = computed(() => {
    if (!classFilterText.value) return menuList.value;
    const q = classFilterText.value.toLowerCase().trim();
    return menuList.value.filter((m) => (m.className || '').toLowerCase().includes(q));
});

/* Chọn 1 menu trong danh sách bên trái để xem chi tiết */
function onSelectMenu(row) {
    selectedMenu.value = row;
    detailMenu.value = row.raw || null;
}

/* Xóa thực đơn đang chọn cho TOÀN BỘ LỚP trong khối */
async function onDeleteSelectedMenu() {
    if (!selectedMenu.value) {
        Swal.fire({
            icon: 'warning',
            title: 'Chưa chọn thực đơn',
            text: 'Vui lòng chọn một thực đơn ở bên trái trước.'
        });
        return;
    }

    const row = selectedMenu.value;
    const classIds = row.classIds && row.classIds.length ? row.classIds : [row.classId];
    const startStr = formatDate_ddMMyyyy(row.startDate);
    const endStr = formatDate_ddMMyyyy(row.endDate);

    const { isConfirmed } = await Swal.fire({
        icon: 'warning',
        title: 'Xóa thực đơn?',
        text: `Thực đơn tuần này sẽ bị xóa cho toàn bộ lớp trong khối "${row.className}".`,
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#dc2626',
        heightAuto: false
    });

    if (!isConfirmed) return;

    try {
        await Promise.all(
            classIds.map((cid) =>
                deleteMenuByDateRange(cid, startStr, endStr).catch((e) => {
                    console.error('Lỗi xóa menu cho lớp', cid, e);
                })
            )
        );

        await initAllMenus();

        swalToast.fire({
            icon: 'success',
            title: `Đã xóa thực đơn tuần của khối ${row.className}`
        });
    } catch (e) {
        Swal.fire({
            icon: 'error',
            title: 'Xóa thực đơn thất bại',
            text: e?.message || 'Backend không cho phép xóa thực đơn (lỗi hệ thống).'
        });
    }
}

/* ===== INIT: load lớp, món ăn, tất cả thực đơn cho tab Chi tiết ===== */
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
                const startKey = startD.toISOString().substring(0, 10);
                const endKey = endD.toISOString().substring(0, 10);

                const key = `${grade}|${startKey}|${endKey}`;

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
            classId: g.classIds[0], // đại diện
            classIds: g.classIds,
            classNames: g.classNames,
            className: g.gradeName, // HIỂN THỊ THEO KHỐI
            startDate: g.startDate,
            endDate: g.endDate,
            createdBy: g.createdBy,
            raw: g.raw // MenuResponse đại diện
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
        Swal.fire({
            icon: 'error',
            title: 'Lỗi tải danh sách thực đơn',
            text: e?.message || 'Không tải được danh sách thực đơn của các lớp'
        });
    } finally {
        detailLoading.value = false;
    }
}

/* INIT chung cho cả page */
async function init() {
    loadingInit.value = true;
    try {
        classOptions.value = await fetchClassOptions();
        allDishes.value = await fetchAllMenuDishes();
        initEmptyWeeklyMenu();
        await initAllMenus();
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

/* Load 1 thực đơn tuần vào tab Tạo/Sửa (theo lớp hoặc theo khối) */
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
            Swal.fire({
                icon: 'warning',
                title: 'Khối này chưa có lớp nào'
            });
            return;
        }
        targetClassId = list[0].value; // lấy 1 lớp đại diện
    }

    if (!startDate.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn ngày bắt đầu tuần' });
        return;
    }
    const startParam = formatDate_yyyyMMdd(startDate.value);
    const endDateEffective = endDate.value || autoEndDate.value || startDate.value;
    const endParam = formatDate_yyyyMMdd(endDateEffective);

    loadingWeekly.value = true;
    try {
        const menu = await fetchWeeklyMenu({
            classId: targetClassId,
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
        currentMenuId.value = menu.id || null;
        applyMenuFromBackend(menu);
        swalToast.fire({ icon: 'success', title: 'Đã tải thực đơn tuần' });
    } catch (e) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi khi tải thực đơn tuần',
            text: e?.message || 'Đã có lỗi xảy ra'
        });
    } finally {
        loadingWeekly.value = false;
    }
}

/* Lưu thực đơn tuần (tạo mới hoặc cập nhật, theo lớp hoặc theo khối) */
async function onSaveWeeklyMenu() {
    if (!startDate.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn ngày bắt đầu tuần' });
        return;
    }

    if (applyMode.value === 'class' && !selectedClassId.value) {
        Swal.fire({ icon: 'warning', title: 'Vui lòng chọn lớp' });
        return;
    }
    if (applyMode.value === 'grade') {
        if (!selectedGradeForMenu.value) {
            Swal.fire({ icon: 'warning', title: 'Vui lòng chọn khối' });
            return;
        }
        const listCheck = classesByGrade.value[selectedGradeForMenu.value] || [];
        if (!listCheck.length) {
            Swal.fire({
                icon: 'warning',
                title: 'Khối này chưa có lớp nào để áp dụng thực đơn'
            });
            return;
        }
    }

    const start = startDate.value;
    const end = endDate.value || autoEndDate.value || start;

    const basePayload = {
        startDate: formatDate_ddMMyyyy(start),
        endDate: formatDate_ddMMyyyy(end),
        createdBy: 'admin',
        items: []
    };

    daysOfWeek.forEach((day) => {
        mealTypes.forEach((meal) => {
            const cell = weeklyMenu.value[day] && weeklyMenu.value[day][meal];
            const ids = (cell && cell.dishIds) || [];
            if (ids.length) {
                basePayload.items.push({
                    dayOfWeek: day,
                    mealType: meal,
                    dishIds: ids
                });
            }
        });
    });

    if (!basePayload.items.length) {
        Swal.fire({
            icon: 'warning',
            title: 'Thực đơn trống',
            text: 'Vui lòng chọn ít nhất một món cho tuần'
        });
        return;
    }

    savingMenu.value = true;
    try {
        if (applyMode.value === 'class') {
            const payload = {
                ...basePayload,
                classId: selectedClassId.value
            };

            if (currentMenuId.value) {
                await updateWeeklyMenu(currentMenuId.value, payload);
                swalToast.fire({
                    icon: 'success',
                    title: 'Cập nhật thực đơn tuần thành công'
                });
            } else {
                const created = await createWeeklyMenu(payload);
                currentMenuId.value = created && created.id ? created.id : null;
                swalToast.fire({
                    icon: 'success',
                    title: 'Tạo thực đơn tuần thành công'
                });
            }
        } else {
            const list = classesByGrade.value[selectedGradeForMenu.value] || [];
            const startIso = formatDate_yyyyMMdd(start);
            const endIso = formatDate_yyyyMMdd(end);

            let ok = 0;
            let fail = 0;

            for (const cls of list) {
                try {
                    const existing = await fetchWeeklyMenu({
                        classId: cls.value,
                        startDate: startIso,
                        endDate: endIso
                    });

                    const payloadForClass = {
                        ...basePayload,
                        classId: cls.value
                    };

                    if (existing && existing.id) {
                        await updateWeeklyMenu(existing.id, payloadForClass);
                    } else {
                        await createWeeklyMenu(payloadForClass);
                    }
                    ok++;
                } catch (err) {
                    console.error('Lỗi lưu thực đơn cho lớp', cls, err);
                    fail++;
                }
            }

            swalToast.fire({
                icon: fail ? 'warning' : 'success',
                title: fail
                    ? `Đã áp dụng thực đơn cho ${ok}/${list.length} lớp trong khối`
                    : `Đã áp dụng thực đơn cho ${ok} lớp trong khối`
            });
        }

        await initAllMenus();
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

/* Thêm nhiều món ăn (dùng parsedDishes) */
async function onSaveNewDishes() {
    const names = parsedDishes.value;

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

        swalToast.fire({
            icon: 'success',
            title: `Đã thêm ${(created && created.length) || names.length} món ăn mới`
        });
    } catch (e) {
        Swal.fire({
            icon: 'error',
            title: 'Tạo món ăn thất bại',
            text: e?.message || 'Đã có lỗi xảy ra'
        });
    }
}

onMounted(init);
</script>

<template>
    <div class="menu-page-wrapper">
        <!-- Tabs -->
        <div class="tabs-wrapper">
            <button class="tab-item" :class="{ active: activeTab === 'create' }" @click="switchTab('create')">
                Tạo thực đơn tuần
            </button>
            <button class="tab-item" :class="{ active: activeTab === 'detail' }" @click="switchTab('detail')">
                Chi tiết thực đơn
            </button>
        </div>

        <!-- TAB TẠO THỰC ĐƠN -->
        <div v-show="activeTab === 'create'" class="px-4 md:px-6 lg:px-8 py-5 space-y-4 relative">
            <!-- Loading overlay -->
            <div
                v-if="loadingInit || loadingWeekly"
                class="absolute inset-0 bg-white/70 flex items-center justify-center z-10 text-slate-500 text-sm"
            >
                <i class="fa-solid fa-spinner fa-spin mr-2"></i>
                Đang tải dữ liệu thực đơn...
            </div>

            <h1 class="text-xl font-semibold text-slate-800">Thực đơn tuần</h1>

            <!-- Bộ lọc lớp / khối + tuần -->
            <div class="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <!-- Chọn chế độ áp dụng -->
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-slate-700 mb-1"> Áp dụng thực đơn cho </label>
                    <div class="flex gap-4 mt-1 text-sm text-slate-700">
                        <label class="inline-flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                value="class"
                                v-model="applyMode"
                                class="h-4 w-4 text-primary border-slate-300"
                            />
                            <span>1 lớp</span>
                        </label>
                        <label class="inline-flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                value="grade"
                                v-model="applyMode"
                                class="h-4 w-4 text-primary border-slate-300"
                            />
                            <span>Cả khối (Nhà trẻ / Mầm / Chồi / Lá)</span>
                        </label>
                    </div>
                </div>

                <!-- Chọn lớp hoặc khối -->
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">
                        {{ applyMode === 'class' ? 'Lớp' : 'Khối' }}
                    </label>
                    <Dropdown
                        v-if="applyMode === 'class'"
                        v-model="selectedClassId"
                        :options="classOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                        placeholder="Chọn lớp"
                    />
                    <Dropdown
                        v-else
                        v-model="selectedGradeForMenu"
                        :options="gradeOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                        placeholder="Chọn khối"
                    />
                </div>

                <!-- Ngày bắt đầu -->
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1"> Ngày bắt đầu tuần </label>
                    <Calendar v-model="startDate" dateFormat="dd/mm/yy" class="w-full" showIcon />
                </div>

                <!-- Ngày kết thúc -->
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">
                        Ngày kết thúc tuần
                        <span v-if="autoEndDate" class="text-xs text-slate-500">
                            (gợi ý: {{ autoEndDate && autoEndDate.toLocaleDateString('vi-VN') }})
                        </span>
                    </label>
                    <Calendar v-model="endDate" dateFormat="dd/mm/yy" class="w-full" showIcon />
                </div>

                <!-- Nút -->
                <div class="flex gap-2 justify-end">
                    <Button
                        class="!bg-slate-200 !border-0 !text-slate-800"
                        :label="loadingWeekly ? 'Đang tải...' : 'Tải thực đơn'"
                        :disabled="loadingWeekly || loadingInit"
                        @click="onLoadWeeklyMenu"
                    />
                    <Button
                        class="!bg-primary !border-0 !text-white"
                        :label="savingMenu ? 'Đang lưu...' : 'Lưu thực đơn tuần'"
                        :disabled="savingMenu || loadingInit"
                        @click="onSaveWeeklyMenu"
                    />
                </div>
            </div>

            <!-- Danh sách món ăn + nút thêm -->
            <div class="flex items-center justify-between mt-1">
                <div class="text-sm text-slate-700">
                    Tổng số món ăn: <b>{{ allDishes.length }}</b>
                </div>
                <Button
                    class="!bg-emerald-600 !border-0 !text-white"
                    icon="fa-solid fa-plus mr-2"
                    label="Thêm món ăn"
                    @click="
                        dishModalTab = 'quick';
                        showAddDishModal = true;
                    "
                />
            </div>

            <!-- Bảng thực đơn tuần -->
            <div class="overflow-auto border border-slate-200 rounded-xl bg-white mt-2">
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
                            <td
                                v-for="meal in mealTypes"
                                :key="meal"
                                class="px-3 py-2 border-b align-top"
                            >
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
                                <span v-else class="text-xs text-rose-500">đang tải thực đơn</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Modal thêm món ăn -->
            <Dialog
                v-model:visible="showAddDishModal"
                modal
                :draggable="false"
                :style="{ width: '540px', maxWidth: '95vw' }"
                contentClass="dish-modal"
            >
                <template #header>
                    <div class="flex items-center justify-between w-full">
                        <div>
                            <div class="text-lg font-semibold text-slate-800">Thêm món ăn</div>
                            <div class="text-xs text-slate-500 mt-0.5">
                                Nhập nhanh nhiều món, hệ thống sẽ tự tách thành danh sách.
                            </div>
                        </div>
                    </div>
                </template>

                <div class="space-y-4">
                    <!-- Tabs trong modal -->
                    <div
                        class="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600"
                    >
                        <button
                            type="button"
                            class="flex-1 px-3 py-2 rounded-lg transition"
                            :class="dishModalTab === 'quick' ? 'dish-tab--active' : 'dish-tab'"
                            @click="dishModalTab = 'quick'"
                        >
                            Nhập nhanh
                        </button>
                        <button
                            type="button"
                            class="flex-1 px-3 py-2 rounded-lg transition"
                            :class="dishModalTab === 'list' ? 'dish-tab--active' : 'dish-tab'"
                            @click="dishModalTab = 'list'"
                        >
                            Danh sách món ({{ parsedDishes.length }})
                        </button>
                    </div>

                    <!-- Tab: Nhập nhanh -->
                    <div v-if="dishModalTab === 'quick'" class="space-y-3">
                        <p class="text-sm text-slate-600">Nhập mỗi món ăn một dòng. Ví dụ:</p>
                        <div
                            class="text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2 leading-relaxed font-mono"
                        >
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
                        <div class="flex justify-between items-center text-xs text-slate-500">
                            <span>
                                Đã nhập: <b>{{ parsedDishes.length }}</b> món
                            </span>
                            <span v-if="parsedDishes.length" class="italic">
                                Chuyển sang tab <b>Danh sách món</b> để xem và xóa từng món.
                            </span>
                        </div>
                    </div>

                    <!-- Tab: Danh sách món -->
                    <div v-else class="space-y-2">
                        <div class="flex items-center justify-between">
                            <div class="text-sm font-semibold text-slate-700">
                                Danh sách món đã nhập ({{ parsedDishes.length }})
                            </div>
                            <div v-if="parsedDishes.length" class="text-xs text-slate-500">
                                Nhấp vào nút <span class="badge-delete">X</span> để xóa món.
                            </div>
                        </div>

                        <div
                            v-if="!parsedDishes.length"
                            class="border border-dashed border-slate-200 rounded-lg px-3 py-4 text-center text-xs text-slate-400"
                        >
                            Chưa có món nào. Hãy nhập ở tab <b>Nhập nhanh</b>.
                        </div>

                        <div
                            v-else
                            class="max-h-72 overflow-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50"
                        >
                            <div
                                v-for="(dish, idx) in parsedDishes"
                                :key="idx"
                                class="flex items-center justify-between px-3 py-2.5 bg-white/70 hover:bg-slate-50 transition"
                            >
                                <div class="flex items-center gap-2 min-w-0">
                                    <span
                                        class="w-6 text-[11px] text-slate-400 text-right flex-shrink-0"
                                    >
                                        {{ idx + 1 }}
                                    </span>
                                    <span class="text-sm text-slate-800 truncate">
                                        {{ dish }}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    class="btn-delete-chip"
                                    title="Xóa món này khỏi danh sách"
                                    @click="removeDish(idx)"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <template #footer>
                    <div class="flex justify-between items-center w-full">
                        <div class="text-xs text-slate-500">
                            Các món sau khi lưu sẽ được thêm vào danh sách món ăn của trường.
                        </div>
                        <div class="flex justify-end gap-2">
                            <Button
                                class="!bg-slate-200 !text-slate-800 !border-0 px-3"
                                label="Hủy"
                                @click="showAddDishModal = false"
                            />
                            <Button
                                class="!bg-primary !text-white !border-0 px-4"
                                :disabled="!parsedDishes.length"
                                :label="
                                    parsedDishes.length
                                        ? 'Lưu ' + parsedDishes.length + ' món ăn'
                                        : 'Chưa có món'
                                "
                                @click="onSaveNewDishes"
                            />
                        </div>
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
                    <h2 class="section-title">Danh sách thực đơn (theo khối)</h2>

                    <!-- Lọc theo tên khối -->
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
                                <tr
                                    v-for="(row, idx) in filteredMenuList"
                                    :key="row.id"
                                    :class="{
                                        active: selectedMenu && selectedMenu.id === row.id
                                    }"
                                    @click="onSelectMenu(row)"
                                >
                                    <td>{{ idx + 1 }}</td>
                                    <td>{{ row.className }}</td>
                                    <td>{{ formatDateDisplay(row.startDate) }}</td>
                                    <td>{{ formatDateDisplay(row.endDate) }}</td>
                                </tr>
                                <tr v-if="!filteredMenuList.length">
                                    <td colspan="4" class="empty-row">
                                        Chưa có thực đơn nào trong hệ thống.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="menu-pagination">
                        <span>Tổng: {{ filteredMenuList.length }}</span>
                    </div>
                </div>

                <!-- Right -->
                <div class="menu-right">
                    <div class="detail-header-row">
                        <h2 class="section-title">Thông tin chi tiết của thực đơn</h2>
                        <div class="flex gap-2">
                            <Button
                                class="!bg-rose-500 !border-0 !text-white"
                                icon="fa-solid fa-trash-can mr-2"
                                label="Xóa thực đơn"
                                :disabled="!detailMenu || !selectedMenu"
                                @click="onDeleteSelectedMenu"
                            />
                            <Button
                                class="btn-download"
                                icon="fa-solid fa-download mr-2"
                                label="Tải về"
                                :disabled="!detailMenu"
                            />
                        </div>
                    </div>

                    <div v-if="detailLoading" class="detail-loading">
                        Đang tải chi tiết thực đơn...
                    </div>

                    <div v-else-if="detailMenu && selectedMenu" class="detail-container">
                        <div class="detail-meta">
                            <div>
                                <span class="meta-label">Khối:</span>
                                <b>{{ selectedMenu.className }}</b>
                            </div>
                            <div
                                v-if="selectedMenu.classNames && selectedMenu.classNames.length"
                            >
                                <span class="meta-label">Các lớp áp dụng:</span>
                                <b>{{ selectedMenu.classNames.join(', ') }}</b>
                            </div>
                            <div>
                                <span class="meta-label">Thời gian:</span>
                                <b>
                                    {{ formatDateDisplay(selectedMenu.startDate) }} -
                                    {{ formatDateDisplay(selectedMenu.endDate) }}
                                </b>
                            </div>
                            <div>
                                <span class="meta-label">Người tạo:</span>
                                <b>{{ selectedMenu.createdBy || '-' }}</b>
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
                                            <div
                                                v-for="dish in getDishesBy(day, 'Bữa sáng')"
                                                :key="dish.id"
                                                class="dish-line"
                                            >
                                                - {{ dish.dishName }}
                                            </div>
                                        </td>
                                        <td class="cell-meal">
                                            <div
                                                v-for="dish in getDishesBy(day, 'Bữa trưa')"
                                                :key="dish.id"
                                                class="dish-line"
                                            >
                                                - {{ dish.dishName }}
                                            </div>
                                        </td>
                                        <td class="cell-meal">
                                            <div
                                                v-for="dish in getDishesBy(day, 'Bữa chiều')"
                                                :key="dish.id"
                                                class="dish-line"
                                            >
                                                - {{ dish.dishName }}
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div v-else class="detail-empty">
                        Chọn một thực đơn bên trái để xem chi tiết.
                    </div>
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

/* Left table */
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

/* Modal món ăn */
.dish-modal {
    padding-top: 0.5rem;
}
.dish-tab {
    background: transparent;
    border: none;
    cursor: pointer;
    color: #6b7280;
}
.dish-tab--active {
    background: #ffffff;
    box-shadow:
        0 1px 2px rgb(15 23 42 / 0.15),
        0 1px 3px rgb(15 23 42 / 0.1);
    color: #0f172a;
}
.badge-delete {
    padding: 0 4px;
    border-radius: 999px;
    border: 1px solid #fecaca;
    background: #fee2e2;
    color: #b91c1c;
}
.btn-delete-chip {
    inline-size: 24px;
    block-size: 24px;
    border-radius: 999px;
    border: 1px solid #fecaca;
    background: #fee2e2;
    color: #b91c1c;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

/* Responsive */
@media (max-width: 1024px) {
    .menu-layout {
        grid-template-columns: 1fr;
    }
}
</style>
