<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Tooltip from 'primevue/tooltip';

import Swal from 'sweetalert2';

import AttendanceTabs from '@/components/attendance/AttendanceTabs.vue';
import { fetchClassesLite } from '@/service/classService.js';
import { fetchAttendanceList, bulkUpdateAttendance } from '@/service/attendanceService.js';
import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser, getCurrentUsername, fetchCurrentUsername } from '@/service/authService.js';

import { fetchMyTeacherClasses } from '@/service/teacherService.js';

/* Enum và cột hiển thị (KHỚP BE AttendanceStatus) */
const STATUS = {
    PRESENT: { key: 'PRESENT', label: 'Đi học', color: 'emerald' },
    ABSENT: { key: 'ABSENT', label: 'Vắng', color: 'rose' },
    LATE: { key: 'LATE', label: 'Đi muộn', color: 'amber' },
    EARLY_LEAVE: { key: 'EARLY_LEAVE', label: 'Về sớm', color: 'sky' },
    UNDEFINED: { key: 'UNDEFINED', label: 'Chưa xác định', color: 'slate' }
};

const statusCols = [STATUS.PRESENT, STATUS.ABSENT, STATUS.LATE, STATUS.EARLY_LEAVE, STATUS.UNDEFINED];

const auth = useAuthStore();

/* Lấy username đăng nhập giống với màn Thực đơn */
const checkedByUser = ref('system');
async function ensureUsername() {
    const fromStore = getUsernameFromUser(auth?.user);
    if (fromStore) {
        checkedByUser.value = fromStore;
        return;
    }
    const fromLocal = getCurrentUsername();
    if (fromLocal) {
        checkedByUser.value = fromLocal;
        return;
    }
    const fromApi = await fetchCurrentUsername();
    checkedByUser.value = fromApi || 'system';
}
watch(
    () => auth.user,
    () => {
        ensureUsername();
    },
    { immediate: true }
);

/* Lớp */
const classes = ref([]); // [{ id, name }]
const selectedClassId = ref(null);

const day = ref(new Date());
const keyword = ref('');
const filterStatus = ref('ALL');

/** loading: overlay */
const loading = ref(false);
const saving = ref(false);
const rows = ref([]); // [{ studentId, studentName, className, status, hasPermission, checkedBy, checkTime, note }]
const dirty = reactive(new Set()); // track các dòng thay đổi để lưu

const counts = computed(() => {
    const c = {
        total: rows.value.length,
        permissionCount: rows.value.filter((r) => !!r.hasPermission).length
    };
    for (const col of statusCols) {
        c[col.key] = rows.value.filter((r) => (r.status || 'UNDEFINED') === col.key).length;
    }
    return c;
});

/** Toast */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true
});

async function loadClasses() {
    try {
        // Nếu là giáo viên -> chỉ lấy lớp mình dạy
        if (auth.user?.role === 'TEACHER') {
            const list = await fetchMyTeacherClasses(); // BE trả List<ClassResponse>
            classes.value = (list || []).map((c) => ({
                id: c.id,
                name: c.className || c.name || c.class_code || `Lớp ${c.id}`
            }));
        } else {
            // ADMIN / STAFF -> giữ cách cũ
            const lite = await fetchClassesLite(); // [{ value, label }]
            classes.value = (lite || []).map((c) => ({
                id: c.value,
                name: c.label
            }));
        }

        if (!selectedClassId.value && classes.value.length) {
            selectedClassId.value = classes.value[0].id;
        }
    } catch (e) {
        console.error('loadClasses error', e);
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được danh sách lớp'
        });
        classes.value = [];
    }
}


/** Tải danh sách điểm danh */
async function loadData() {
    if (!selectedClassId.value || !day.value) return;

    loading.value = true;
    dirty.clear();
    try {
        const list = await fetchAttendanceList({
            classId: selectedClassId.value,
            date: day.value,
            status: filterStatus.value === 'ALL' ? undefined : filterStatus.value,
            keyword: keyword.value || undefined
        });
        rows.value = list.map((r) => ({
            ...r,
            status: r.status || 'UNDEFINED',
            hasPermission: r.hasPermission ?? false
        }));
        swalToast.fire({ icon: 'success', title: 'Đã tải dữ liệu' });
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Không tải được điểm danh'
        });
    } finally {
        loading.value = false;
    }
}

const filteredRows = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    const st = filterStatus.value;
    return rows.value.filter((r) => {
        const okQ = !q || (r.studentName || '').toLowerCase().includes(q);
        const okS = st === 'ALL' || (r.status || 'UNDEFINED') === st;
        return okQ && okS;
    });
});

/* ====== LOGIC TRẠNG THÁI + CÓ PHÉP ====== */

function setStatus(row, newStatus) {
    if (row.status === newStatus) return;

    row.status = newStatus;

    // Nếu không phải VẮNG thì luôn bỏ "có phép"
    if (newStatus !== 'ABSENT') {
        row.hasPermission = false;
    }

    row.checkTime = new Date().toISOString();
    row.checkedBy = checkedByUser.value;
    dirty.add(row.studentId);
}

/** bulk set = gán tất cả HS (đang lọc) sang 1 trạng thái */
function bulkSet(newStatus) {
    for (const r of filteredRows.value) {
        if ((r.status || 'UNDEFINED') !== newStatus) {
            setStatus(r, newStatus);
        }
    }
}

/* Có phép: toggle + bulk – luôn đồng bộ với trạng thái */
function togglePermission(row) {
    const next = !row.hasPermission;

    if (next) {
        // Bật "Có phép" => luôn VẮNG CÓ PHÉP
        if (row.status !== 'ABSENT') {
            row.status = 'ABSENT';
            row.checkTime = new Date().toISOString();
            row.checkedBy = checkedByUser.value;
        }
    }

    row.hasPermission = next;
    dirty.add(row.studentId);
}

function setAllPermission(on) {
    filteredRows.value.forEach((r) => {
        if (on) {
            // Tất cả => VẮNG CÓ PHÉP
            r.status = 'ABSENT';
            r.hasPermission = true;
            r.checkTime = new Date().toISOString();
            r.checkedBy = checkedByUser.value;
        } else {
            // Chỉ bỏ "có phép", không ép trạng thái
            r.hasPermission = false;
        }
        dirty.add(r.studentId);
    });
}

/* ===== Dropdown ở header cho từng cột ===== */
const showStatusMenu = reactive({
    PRESENT: false,
    ABSENT: false,
    LATE: false,
    EARLY_LEAVE: false,
    UNDEFINED: false
});
const showPermMenu = ref(false);

function closeAllMenus() {
    Object.keys(showStatusMenu).forEach((k) => {
        showStatusMenu[k] = false;
    });
    showPermMenu.value = false;
}

function toggleStatusMenu(key) {
    const willOpen = !showStatusMenu[key];
    closeAllMenus();
    if (willOpen) showStatusMenu[key] = true;
}

function onClickStatusMenu(key, action) {
    if (action === 'all') {
        // gán tất cả HS (đang lọc) sang trạng thái này
        filteredRows.value.forEach((r) => {
            if ((r.status || 'UNDEFINED') !== key) {
                setStatus(r, key);
            }
        });
    } else if (action === 'clear') {
        // chỉ những HS đang ở trạng thái này => về UNDEFINED và bỏ có phép
        filteredRows.value.forEach((r) => {
            if ((r.status || 'UNDEFINED') === key) {
                r.status = 'UNDEFINED';
                r.checkTime = null;
                r.checkedBy = null;
                if (key === 'ABSENT') {
                    r.hasPermission = false;
                }
                dirty.add(r.studentId);
            }
        });
    }
    showStatusMenu[key] = false;
}

function togglePermMenu() {
    const willOpen = !showPermMenu.value;
    closeAllMenus();
    showPermMenu.value = willOpen;
}
function onClickSelectAllPermission(on) {
    setAllPermission(on);
    showPermMenu.value = false;
}

/* click ngoài để đóng menu */
function onWindowClick() {
    closeAllMenus();
}

async function onSave() {
    if (!selectedClassId.value) {
        swalToast.fire({ icon: 'info', title: 'Chưa chọn lớp' });
        return;
    }
    if (!dirty.size) {
        swalToast.fire({ icon: 'info', title: 'Không có thay đổi để lưu' });
        return;
    }
    saving.value = true;
    try {
        const dirtyRows = rows.value.filter((r) => dirty.has(r.studentId));
        await bulkUpdateAttendance({
            classId: selectedClassId.value,
            date: day.value,
            checkedBy: checkedByUser.value,
            items: dirtyRows.map((r) => ({
                studentId: r.studentId,
                status: r.status,
                note: r.note ?? '',
                hasPermission: r.hasPermission
            }))
        });

        dirty.clear();
        swalToast.fire({ icon: 'success', title: 'Đã lưu điểm danh' });
        await loadData();
    } catch (e) {
        swalToast.fire({
            icon: 'error',
            title: e?.message || 'Lưu điểm danh thất bại'
        });
    } finally {
        saving.value = false;
    }
}

/* Enter để lưu (trừ khi đang gõ trong input) */
function onKeydown(e) {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    onSave();
}

/* Auto load khi đổi lớp / ngày / filter */
watch(selectedClassId, () => {
    loadData();
});
watch(day, () => {
    loadData();
});
watch(filterStatus, () => {
    loadData();
});

onMounted(async () => {
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('click', onWindowClick);
    await ensureUsername();
    await loadClasses();
    await loadData();
});
onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('click', onWindowClick);
});
</script>

<template>
    <div class="attendance-checkin px-4 md:px-6 lg:px-10 py-6 space-y-6 relative bg-gradient-to-br from-slate-50 to-white min-h-screen">
        <!-- Tabs: Đến / Về / Đơn xin nghỉ -->
        <AttendanceTabs />

        <!-- Loading overlay với animation -->
        <div v-if="loading" class="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div class="text-center bg-white p-6 rounded-2xl shadow-xl">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
                <p class="text-slate-600 font-medium">Đang tải dữ liệu điểm danh...</p>
            </div>
        </div>

        <!-- Header với gradient và icons -->
        <div class="flex flex-wrap items-center justify-between gap-4 animate-slide-up">
            <div class="flex items-center gap-4">
                <div class="p-3 bg-primary/10 rounded-2xl shadow-sm">
                    <i class="fa-solid fa-user-check text-3xl text-primary"></i>
                </div>
                <div>
                    <h1 class="text-3xl font-bold tracking-tight text-slate-800">Điểm danh đến</h1>
                    <p class="text-slate-500 text-sm mt-1">
                        Ngày: <span class="font-medium">{{ day ? new Date(day).toLocaleDateString('vi-VN') : '' }}</span>
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <Tag severity="info" :value="`Người điểm danh: ${checkedByUser}`" class="shadow-sm" />
                <Button
                    class="btn-ghost animate-pulse-on-hover"
                    icon="fa-solid fa-rotate-right"
                    label="Tải lại"
                    :disabled="loading"
                    @click.stop="loadData"
                />
                <Button
                    class="btn-success animate-bounce-on-hover"
                    icon="fa-solid fa-floppy-disk"
                    :label="saving ? 'Đang lưu...' : 'Lưu (Enter)'"
                    :disabled="saving"
                    @click.stop="onSave"
                />
            </div>
        </div>

        <!-- Filters với card đẹp -->
        <Card class="card-soft ring-1 ring-slate-100 shadow-lg animate-fade-in" style="animation-delay: 0.1s">
            <template #content>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div class="md:col-span-1 lg:col-span-2">
                        <label class="label flex items-center gap-2">
                            <i class="fa-solid fa-school text-primary"></i>
                            Chọn lớp
                        </label>
                        <Dropdown
                            v-model="selectedClassId"
                            :options="classes"
                            optionLabel="name"
                            optionValue="id"
                            class="w-full"
                            placeholder="Chọn lớp"
                            :loading="loading"
                        />
                    </div>
                    <div>
                        <label class="label flex items-center gap-2">
                            <i class="fa-solid fa-calendar text-primary"></i>
                            Ngày
                        </label>
                        <Calendar
                            v-model="day"
                            :manualInput="false"
                            class="w-full"
                            showIcon
                            dateFormat="dd/mm/yy"
                        />
                    </div>
                    <div>
                        <label class="label flex items-center gap-2">
                            <i class="fa-solid fa-filter text-primary"></i>
                            Trạng thái
                        </label>
                        <Dropdown
                            v-model="filterStatus"
                            class="w-full"
                            :options="[
                                { label: 'Tất cả', value: 'ALL' },
                                ...Object.values(STATUS).map((s) => ({
                                    label: s.label,
                                    value: s.key
                                }))
                            ]"
                            optionLabel="label"
                            optionValue="value"
                        />
                    </div>
                    <div>
                        <label class="label flex items-center gap-2">
                            <i class="fa-solid fa-search text-primary"></i>
                            Tìm kiếm
                        </label>
                        <InputText
                            v-model="keyword"
                            class="w-full"
                            placeholder="Tên học sinh"
                        />
                    </div>
                </div>
            </template>
        </Card>

        <!-- Status header với counts + bulk actions -->
        <div class="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl shadow-sm ring-1 ring-slate-100 animate-fade-in" style="animation-delay: 0.2s">
            <div class="flex items-center gap-2 text-slate-700 font-semibold">
                <i class="fa-solid fa-users text-primary"></i>
                Tổng {{ counts.total }} học sinh
            </div>
            <div class="flex flex-wrap gap-2">
                <template v-for="s in Object.values(STATUS)" :key="s.key">
                    <button
                        v-tooltip.top="`Đặt tất cả là ${s.label}`"
                        class="chip animate-scale-on-hover"
                        :class="`chip-${s.color}`"
                        @click="bulkSet(s.key)"
                    >
                        <i class="fa-solid fa-circle text-xs"></i>
                        {{ s.label }} ({{ counts[s.key] || 0 }})
                    </button>
                </template>
            </div>
            <div class="text-sm text-slate-500 ml-auto">
                Có phép: <span class="font-bold text-purple-600">{{ counts.permissionCount }}</span>
            </div>
        </div>

        <!-- Table với improvements -->
        <div class="overflow-auto rounded-2xl ring-1 ring-slate-200 bg-white shadow-lg animate-fade-in" style="animation-delay: 0.3s">
            <table class="min-w-full">
                <thead class="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                    <tr>
                        <th class="th w-12">#</th>
                        <th class="th min-w-[220px]">Học sinh</th>
                        <th class="th min-w-[160px]">Lớp</th>

                        <!-- 5 cột trạng thái với menu -->
                        <th v-for="col in statusCols" :key="col.key" class="th text-center min-w-[100px]">
                            <div class="th-label-menu" @click.stop>
                                <span class="font-medium">{{ col.label }}</span>
                                <div class="text-xs text-slate-500">({{ counts[col.key] || 0 }})</div>
                                <button
                                    type="button"
                                    class="th-arrow-btn animate-rotate-on-hover"
                                    @click.stop="toggleStatusMenu(col.key)"
                                    :aria-expanded="showStatusMenu[col.key]"
                                    :aria-label="`Menu cho ${col.label}`"
                                >
                                    <i class="fa-solid fa-chevron-down transition-transform" :class="{ 'rotate-180': showStatusMenu[col.key] }"></i>
                                </button>

                                <div
                                    v-if="showStatusMenu[col.key]"
                                    class="th-menu animate-slide-down"
                                    @click.stop
                                    role="menu"
                                >
                                    <button
                                        type="button"
                                        class="th-menu-item"
                                        @click="onClickStatusMenu(col.key, 'all')"
                                        role="menuitem"
                                    >
                                        <i class="fa-solid fa-check mr-2"></i>
                                        Chọn tất cả
                                    </button>
                                    <button
                                        type="button"
                                        class="th-menu-item"
                                        @click="onClickStatusMenu(col.key, 'clear')"
                                        role="menuitem"
                                    >
                                        <i class="fa-solid fa-times mr-2"></i>
                                        Bỏ chọn tất cả
                                    </button>
                                </div>
                            </div>
                        </th>

                        <!-- Cột CÓ PHÉP -->
                        <th class="th min-w-[120px] text-center">
                            <div class="th-label-menu" @click.stop>
                                <span class="font-medium">Có phép</span>
                                <div class="text-xs text-slate-500">({{ counts.permissionCount }})</div>
                                <button
                                    type="button"
                                    class="th-arrow-btn animate-rotate-on-hover"
                                    @click.stop="togglePermMenu"
                                    :aria-expanded="showPermMenu"
                                    :aria-label="'Menu cho Có phép'"
                                >
                                    <i class="fa-solid fa-chevron-down transition-transform" :class="{ 'rotate-180': showPermMenu }"></i>
                                </button>

                                <div
                                    v-if="showPermMenu"
                                    class="th-menu animate-slide-down"
                                    @click.stop
                                    role="menu"
                                >
                                    <button
                                        type="button"
                                        class="th-menu-item"
                                        @click="onClickSelectAllPermission(true)"
                                        role="menuitem"
                                    >
                                        <i class="fa-solid fa-check mr-2"></i>
                                        Chọn tất cả
                                    </button>
                                    <button
                                        type="button"
                                        class="th-menu-item"
                                        @click="onClickSelectAllPermission(false)"
                                        role="menuitem"
                                    >
                                        <i class="fa-solid fa-times mr-2"></i>
                                        Bỏ chọn tất cả
                                    </button>
                                </div>
                            </div>
                        </th>

                        <th class="th min-w-[200px]">Thời gian</th>
                        <th class="th min-w-[240px]">Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(r, idx) in filteredRows"
                        :key="r.studentId"
                        class="hover:bg-slate-50/50 transition-all duration-200 animate-fade-in"
                        :style="{ animationDelay: `${idx * 0.05}s` }"
                    >
                        <td class="td text-slate-500 font-medium">{{ idx + 1 }}</td>
                        <td class="td">
                            <div class="font-semibold text-slate-800 flex items-center gap-2">
                                <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                    <i class="fa-solid fa-user text-primary text-sm"></i>
                                </div>
                                {{ r.studentName }}
                            </div>
                        </td>
                        <td class="td text-slate-700">
                            <Tag :value="r.className" severity="info" class="text-xs" />
                        </td>

                        <!-- 5 trạng thái dots -->
                        <td v-for="col in statusCols" :key="col.key" class="td text-center">
                            <button
                                class="dot animate-scale-on-hover"
                                :class="[`dot-${col.color}`, (r.status || 'UNDEFINED') === col.key ? 'dot-active' : '']"
                                @click="setStatus(r, col.key)"
                                :title="`Đặt ${col.label}`"
                                :aria-label="`Đặt trạng thái ${col.label} cho ${r.studentName}`"
                            />
                        </td>

                        <!-- Cột Có phép -->
                        <td class="td text-center">
                            <button
                                v-tooltip.top="r.hasPermission ? 'Bỏ đánh dấu có phép' : 'Đánh dấu vắng có phép'"
                                class="dot dot-purple animate-scale-on-hover"
                                :class="{ 'dot-active': r.hasPermission }"
                                @click.stop="togglePermission(r)"
                                :aria-label="`Toggle có phép cho ${r.studentName}`"
                            />
                        </td>

                        <!-- Thời gian -->
                        <td class="td">
                            <div v-if="(r.status || 'UNDEFINED') !== 'UNDEFINED'" class="space-y-1">
                                <Tag severity="success" value="Đã điểm danh" class="text-xs" />
                                <div class="text-sm text-slate-600">
                                    <i class="fa-regular fa-clock mr-1"></i>
                                    {{ r.checkTime ? new Date(r.checkTime).toLocaleString('vi-VN') : '' }}
                                </div>
                                <div v-if="r.checkedBy" class="text-xs text-slate-500">
                                    Bởi <span class="font-medium">{{ r.checkedBy }}</span>
                                </div>
                            </div>
                            <div v-else class="text-slate-400 text-sm italic flex items-center gap-1">
                                <i class="fa-solid fa-clock"></i>
                                Chưa có
                            </div>
                        </td>

                        <!-- Ghi chú -->
                        <td class="td">
                            <InputText
                                v-model="r.note"
                                class="w-full"
                                placeholder="Ghi chú..."
                                @input="dirty.add(r.studentId)"
                            />
                        </td>
                    </tr>

                    <!-- Empty state -->
                    <tr v-if="!loading && !filteredRows.length">
                        <td colspan="12" class="td text-center py-12">
                            <div class="text-slate-400">
                                <i class="fa-solid fa-inbox text-5xl mb-4 block"></i>
                                <h3 class="text-lg font-medium mb-2">Không có dữ liệu</h3>
                                <p class="text-sm">Thử thay đổi bộ lọc hoặc chọn ngày khác</p>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script>
export default {
    directives: { tooltip: Tooltip }
};
</script>

<style scoped>
.attendance-checkin {
    background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
}

/* Animations */
@keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-down {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes scale {
    from { transform: scale(1); }
    to { transform: scale(1.05); }
}

@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(180deg); }
}

.animate-fade-in { animation: fade-in 0.6s ease-out forwards; }
.animate-slide-up { animation: slide-up 0.5s ease-out forwards; }
.animate-slide-down { animation: slide-down 0.3s ease-out forwards; }
.animate-scale-on-hover:hover { animation: scale 0.2s ease-out; }
.animate-rotate-on-hover:hover { animation: rotate 0.3s ease-out; }
.animate-bounce-on-hover:hover { animation: bounce 0.5s ease-out; }

/* Components */
.label {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    font-weight: 600;
    color: #374151;
    font-size: 14px;
}

.card-soft {
    border-radius: 16px;
    background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
}

.btn-success {
    background: linear-gradient(135deg, #059669, #10b981);
    color: #fff;
    border: 1px solid #059669;
    transition: all 0.3s ease;
}

.btn-success:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(5, 150, 105, 0.3);
}

.btn-ghost {
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #e2e8f0;
    transition: all 0.3s ease;
}

.btn-ghost:hover {
    background: #e2e8f0;
    transform: translateY(-1px);
}

.th {
    padding: 16px 12px;
    text-align: left;
    color: #374151;
    font-weight: 700;
    font-size: 14px;
    border-bottom: 1px solid #e5e7eb;
}

.td {
    padding: 16px 12px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: top;
}

/* Header menu */
.th-label-menu {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    justify-content: center;
}

.th-arrow-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.th-arrow-btn:hover {
    background: #e5e7eb;
    color: #374151;
}

.th-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    padding: 8px 0;
    min-width: 160px;
    z-index: 30;
}

.th-menu-item {
    width: 100%;
    padding: 8px 16px;
    font-size: 14px;
    text-align: left;
    border: none;
    background: transparent;
    cursor: pointer;
    color: #374151;
    display: flex;
    align-items: center;
    transition: background 0.2s ease;
}

.th-menu-item:hover {
    background: #f3f4f6;
}

/* Status chips */
.chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease;
}

.chip-emerald {
    background: #ecfdf5;
    color: #065f46;
    border-color: #a7f3d0;
}

.chip-emerald:hover {
    background: #d1fae5;
    transform: translateY(-1px);
}

.chip-rose {
    background: #fef2f2;
    color: #9f1239;
    border-color: #fecaca;
}

.chip-rose:hover {
    background: #fee2e2;
    transform: translateY(-1px);
}

.chip-amber {
    background: #fffbeb;
    color: #92400e;
    border-color: #fde68a;
}

.chip-amber:hover {
    background: #fef3c7;
    transform: translateY(-1px);
}

.chip-sky {
    background: #f0f9ff;
    color: #0c4a6e;
    border-color: #bae6fd;
}

.chip-sky:hover {
    background: #e0f2fe;
    transform: translateY(-1px);
}

.chip-slate {
    background: #f8fafc;
    color: #475569;
    border-color: #e2e8f0;
}

.chip-slate:hover {
    background: #f1f5f9;
    transform: translateY(-1px);
}

/* Dots */
.dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid currentColor;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    cursor: pointer;
}

.dot::after {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: transparent;
    transition: background 0.2s ease;
}

.dot-active::after {
    background: currentColor;
}

.dot-emerald { color: #10b981; }
.dot-rose { color: #ef4444; }
.dot-amber { color: #f59e0b; }
.dot-sky { color: #0ea5e9; }
.dot-slate { color: #94a3b8; }
.dot-purple { color: #8b5cf6; }

/* Responsive */
@media (max-width: 768px) {
    .th, .td {
        padding: 12px 8px;
        font-size: 13px;
    }

    .chip {
        padding: 4px 8px;
        font-size: 12px;
    }

    .dot {
        width: 20px;
        height: 20px;
    }

    .dot::after {
        width: 10px;
        height: 10px;
    }
}
</style>
