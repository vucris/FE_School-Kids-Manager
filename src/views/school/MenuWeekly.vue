<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import Chips from 'primevue/chips';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Divider from 'primevue/divider';
import Tag from 'primevue/tag';
import InputText from 'primevue/inputtext';

import Swal from 'sweetalert2';

import { createWeeklyMenu, getWeeklyMenu, updateWeeklyMenu } from '@/service/menuService.js';
import { fetchClassesLite } from '@/service/classService.js';
import { useAuthStore } from '@/stores/auth.js';
import { getCurrentUsername, fetchCurrentUsername, getUsernameFromUser } from '@/service/authService.js';

const days = [
    { key: 'MONDAY', label: 'Thứ 2' },
    { key: 'TUESDAY', label: 'Thứ 3' },
    { key: 'WEDNESDAY', label: 'Thứ 4' },
    { key: 'THURSDAY', label: 'Thứ 5' },
    { key: 'FRIDAY', label: 'Thứ 6' },
    { key: 'SATURDAY', label: 'Thứ 7' },
    { key: 'SUNDAY', label: 'CN' }
];

const meals = [
    { key: 'BREAKFAST', label: 'Bữa sáng', color: 'bg-amber-50', ring: 'ring-amber-200', accent: 'accent-amber', icon: 'fa-solid fa-mug-saucer' },
    { key: 'SNACK', label: 'Phụ sáng', color: 'bg-sky-50', ring: 'ring-sky-200', accent: 'accent-sky', icon: 'fa-solid fa-cookie-bite' },
    { key: 'LUNCH', label: 'Bữa trưa', color: 'bg-emerald-50', ring: 'ring-emerald-200', accent: 'accent-emerald', icon: 'fa-solid fa-bowl-food' },
    { key: 'AFTERNOON_SNACK', label: 'Xế chiều', color: 'bg-fuchsia-50', ring: 'ring-fuchsia-200', accent: 'accent-fuchsia', icon: 'fa-solid fa-ice-cream' }
];

const classes = ref([]);
const selectedClass = ref(null);

/* Lấy username để gán Người tạo (từ Pinia/LocalStorage/JWT/endpoint) */
const auth = useAuthStore();
const createdBy = ref('system');

async function ensureUsername() {
    // 1) Từ Pinia store (hỗ trợ nhiều khóa: username/full_name/email/phone)
    const fromStore = getUsernameFromUser(auth?.user);
    if (fromStore) {
        createdBy.value = fromStore;
        return;
    }
    // 2) Từ localStorage/JWT
    const fromLocal = getCurrentUsername();
    if (fromLocal) {
        createdBy.value = fromLocal;
        return;
    }
    // 3) Thử gọi /auth/me nếu có
    const fromApi = await fetchCurrentUsername();
    createdBy.value = fromApi || 'system';
}

watch(
    () => auth.user,
    () => {
        ensureUsername();
    },
    { immediate: true }
);

/* Tuần hiện tại (T2 -> CN) */
function getMonday(d = new Date()) {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7; // 0=Mon
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date;
}
function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
const weekRange = ref([getMonday(), addDays(getMonday(), 6)]);

const loading = ref(false);
const saving = ref(false);
const existingMenuId = ref(null);

/* dishesMap[day][meal] = string[] */
const dishesMap = reactive({});
function ensureMap() {
    for (const d of days) {
        dishesMap[d.key] = dishesMap[d.key] || {};
        for (const m of meals) {
            if (!Array.isArray(dishesMap[d.key][m.key])) dishesMap[d.key][m.key] = [];
        }
    }
}
ensureMap();

const dateTitle = computed(() => {
    const [s, e] = weekRange.value || [];
    if (!s || !e) return '';
    return `${s.toLocaleDateString('vi-VN')} - ${e.toLocaleDateString('vi-VN')}`;
});

const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
    heightAuto: false
});

function toYMD(d) {
    if (!d) return '';
    const dd = d instanceof Date ? d : new Date(d);
    const yyyy = dd.getFullYear();
    const mm = String(dd.getMonth() + 1).padStart(2, '0');
    const day = String(dd.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${day}`;
}

async function loadClasses() {
    classes.value = await fetchClassesLite(); // mảng [{ id, name, code }]
    if (!selectedClass.value && classes.value.length) {
        selectedClass.value = classes.value[0];
    }
}

async function loadWeekly() {
    if (!selectedClass.value || !weekRange.value?.[0] || !weekRange.value?.[1]) {
        swalToast.fire({ icon: 'info', title: 'Chọn lớp và tuần để xem thực đơn' });
        return;
    }
    loading.value = true;
    existingMenuId.value = null;
    // reset
    for (const d of days) for (const m of meals) dishesMap[d.key][m.key] = [];

    try {
        const data = await getWeeklyMenu({
            classId: selectedClass.value.id,
            startDate: toYMD(weekRange.value[0]),
            endDate: toYMD(weekRange.value[1])
        });
        if (!data) {
            swalToast.fire({ icon: 'info', title: 'Chưa có thực đơn tuần này' });
            return;
        }
        existingMenuId.value = data.id;
        (data.items || []).forEach((i) => {
            if (!dishesMap[i.dayOfWeek]) dishesMap[i.dayOfWeek] = {};
            dishesMap[i.dayOfWeek][i.mealType] = Array.isArray(i.dishes) ? i.dishes : [];
        });
        ensureMap();
        swalToast.fire({ icon: 'success', title: 'Đã tải thực đơn' });
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Không tải được thực đơn' });
    } finally {
        loading.value = false;
    }
}

function buildPayload() {
    const items = [];
    for (const d of days) {
        for (const m of meals) {
            const arr = dishesMap[d.key][m.key] || [];
            if (arr.length) items.push({ dayOfWeek: d.key, mealType: m.key, dishes: arr });
        }
    }
    return {
        classId: selectedClass.value.id,
        startDate: toYMD(weekRange.value[0]),
        endDate: toYMD(weekRange.value[1]),
        createdBy: createdBy.value || 'system',
        items
    };
}

/* Enter để lưu, nhưng bỏ qua khi đang gõ trong ô Chips (để Enter thêm món) */
function onKeydown(e) {
    if (e.key !== 'Enter') return;
    // Nếu con trỏ đang trong input của Chips thì bỏ qua
    const el = e.target;
    if (el && (el.closest?.('.p-chips') || el.classList?.contains('p-chips-input'))) return;
    e.preventDefault();
    onSave();
}

function copyDay(fromKey, toKey) {
    for (const m of meals) {
        dishesMap[toKey][m.key] = [...(dishesMap[fromKey][m.key] || [])];
    }
    swalToast.fire({ icon: 'success', title: `Đã sao chép món từ ${fromKey} → ${toKey}` });
}

function clearWeek() {
    for (const d of days) for (const m of meals) dishesMap[d.key][m.key] = [];
    existingMenuId.value = null;
    swalToast.fire({ icon: 'info', title: 'Đã xóa nội dung tuần (chưa lưu)' });
}

async function onSave() {
    if (!selectedClass.value || !weekRange.value?.[0] || !weekRange.value?.[1]) {
        swalToast.fire({ icon: 'info', title: 'Thiếu lớp hoặc tuần' });
        return;
    }
    saving.value = true;
    try {
        const payload = buildPayload();
        if (existingMenuId.value) {
            await updateWeeklyMenu(existingMenuId.value, payload);
            swalToast.fire({ icon: 'success', title: 'Cập nhật thực đơn thành công' });
        } else {
            const res = await createWeeklyMenu(payload);
            existingMenuId.value = res?.id ?? null;
            swalToast.fire({ icon: 'success', title: 'Tạo thực đơn tuần thành công' });
        }
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Lưu thực đơn thất bại' });
    } finally {
        saving.value = false;
    }
}

onMounted(async () => {
    window.addEventListener('keydown', onKeydown);
    await ensureUsername();
    await loadClasses();
    if (selectedClass.value) await loadWeekly();
});
onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-10 py-6 space-y-5">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-utensils text-2xl text-primary"></i>
                <div>
                    <div class="text-2xl font-extrabold tracking-tight text-slate-800">Thực đơn tuần</div>
                    <div class="text-slate-500 text-sm">{{ dateTitle }}</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <Tag severity="info" :value="`Người tạo: ${createdBy}`" />
                <Button class="btn-ghost" icon="fa-solid fa-trash mr-2" label="Xóa nội dung tuần" @click="clearWeek" />
                <Button class="btn-primary" icon="fa-solid fa-rotate mr-2" label="Tải thực đơn" @click="loadWeekly" :disabled="loading" />
                <Button class="btn-success" icon="fa-solid fa-floppy-disk mr-2" :label="existingMenuId ? 'Cập nhật' : 'Lưu/Tạo mới (Enter)'" @click="onSave" :loading="saving" />
            </div>
        </div>

        <!-- Filters + Người tạo -->
        <Card class="shadow-md ring-1 ring-slate-100 card-soft">
            <template #content>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="label">Lớp</label>
                        <Dropdown v-model="selectedClass" :options="classes" optionLabel="name" class="w-full" placeholder="Chọn lớp" />
                    </div>
                    <div class="md:col-span-2">
                        <label class="label">Tuần</label>
                        <Calendar v-model="weekRange" selectionMode="range" :manualInput="false" class="w-full" showIcon dateFormat="dd/mm/yy" />
                        <div class="text-slate-500 text-xs mt-1">Chọn từ Thứ 2 đến Chủ nhật • Nhấn Enter để lưu nhanh</div>
                    </div>
                    <div>
                        <label class="label">Người tạo</label>
                        <InputText v-model="createdBy" class="w-full" readonly />
                        <div class="text-xs text-slate-500 mt-1">Tự động lấy theo tên đăng nhập</div>
                    </div>
                </div>
            </template>
        </Card>

        <Divider />

        <!-- Bảng dọc: Hàng là ngày, Cột là bữa -->
        <div class="overflow-auto rounded-2xl ring-1 ring-slate-200 bg-white shadow-sm">
            <table class="min-w-full">
                <thead class="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                    <tr>
                        <th class="px-3 py-3 text-left text-slate-700 font-bold w-40">Ngày/Bữa</th>
                        <th v-for="m in meals" :key="m.key" class="px-3 py-3 text-left text-slate-700 font-bold">
                            <div class="flex items-center gap-2">
                                <i :class="m.icon" class="text-slate-600"></i>
                                <span>{{ m.label }}</span>
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="d in days" :key="d.key" class="hover:bg-slate-50 transition">
                        <td class="px-3 py-3 font-semibold text-slate-800 border-b">{{ d.label }}</td>
                        <td v-for="m in meals" :key="m.key" class="px-3 py-3 border-b align-top">
                            <div class="meal-card rounded-xl p-3 ring-1" :class="[m.color, m.ring]">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="bar" :class="m.accent"></span>
                                    <Tag severity="secondary" :value="(dishesMap[d.key][m.key] || []).length + ' món'" />
                                </div>
                                <Chips v-model="dishesMap[d.key][m.key]" separator="," class="w-full" placeholder="Nhập món, Enter để thêm" :allowDuplicate="false" />
                                <div class="help-row">Gõ món và nhấn Enter để thêm • Nhấn Enter ngoài ô để Lưu</div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div v-if="loading" class="px-3 py-2 text-slate-500 text-sm">Đang tải thực đơn...</div>
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
.meal-card {
    position: relative;
    background: #fff;
}
.meal-card .bar {
    position: absolute;
    left: -1px;
    top: -1px;
    bottom: -1px;
    width: 6px;
    border-radius: 8px 0 0 8px;
}
.accent-amber {
    background: #f59e0b;
}
.accent-sky {
    background: #0ea5e9;
}
.accent-emerald {
    background: #10b981;
}
.accent-fuchsia {
    background: #d946ef;
}
.help-row {
    font-size: 11px;
    color: #475569;
    margin-top: 8px;
}
</style>
