<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Calendar from 'primevue/calendar';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import Divider from 'primevue/divider';

import Swal from 'sweetalert2';

import { fetchClassesLite } from '@/service/classService.js';
import { getAlbumsByClass, getAlbumsByStatus, getAlbumById, createAlbum, approveAlbum, getPhotosByAlbum, addPhotoToAlbum, deleteAlbum, deletePhoto } from '@/service/albumService.js';
import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser, getCurrentUsername, fetchCurrentUsername } from '@/service/authService.js';

const auth = useAuthStore();

/* Lấy username đăng nhập: ưu tiên store -> local/JWT -> /auth/me (để luôn có tên người duyệt/người tạo) */
const currentUser = ref('system');
async function ensureUsername() {
    const fromStore = getUsernameFromUser(auth?.user);
    if (fromStore) {
        currentUser.value = fromStore;
        return;
    }
    const fromLocal = getCurrentUsername();
    if (fromLocal) {
        currentUser.value = fromLocal;
        return;
    }
    const fromApi = await fetchCurrentUsername();
    currentUser.value = fromApi || 'system';
}
watch(
    () => auth.user,
    () => {
        ensureUsername();
    },
    { immediate: true }
);

/* Filters */
const classes = ref([]);
const selectedClass = ref(null);
const statusOptions = [
    { label: 'Tất cả', value: 'ALL' },
    { label: 'Chờ duyệt', value: 'PENDING' },
    { label: 'Đã duyệt', value: 'APPROVED' },
    { label: 'Từ chối', value: 'REJECTED' }
];
const statusFilter = ref('ALL');
const keyword = ref('');

/* Data */
const loading = ref(false);
const albums = ref([]);

/* Preview cache for card headers: albumId -> [{url, caption}] */
const previewMap = ref({}); // { [albumId]: Photo[] }
const previewLoading = ref(new Set()); // Set<albumId>

/* Dialogs state */
const showCreate = ref(false);
const createForm = ref({ classId: null, title: '', description: '' });

const showDetail = ref(false);
const activeAlbum = ref(null);
const photos = ref([]);
const addingPhoto = ref(false);
const photoForm = ref({ url: '', caption: '' });

/* Tag styles per status */
const statusStyle = {
    PENDING: { severity: 'warning', text: 'Chờ duyệt' },
    APPROVED: { severity: 'success', text: 'Đã duyệt' },
    REJECTED: { severity: 'danger', text: 'Từ chối' }
};

const filteredAlbums = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    let list = albums.value;
    if (statusFilter.value !== 'ALL') {
        list = list.filter((a) => a.status === statusFilter.value);
    }
    if (q) {
        list = list.filter((a) => (a.title || '').toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q) || (a.className || '').toLowerCase().includes(q));
    }
    return list;
});

const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
    heightAuto: false
});

async function loadClasses() {
    classes.value = await fetchClassesLite();
    if (!selectedClass.value && classes.value.length) {
        selectedClass.value = classes.value[0];
    }
}

async function ensurePreview(album) {
    if (!album?.id) return;
    if (previewMap.value[album.id]) return; // already cached
    if (previewLoading.value.has(album.id)) return;
    previewLoading.value.add(album.id);
    try {
        let pics = [];
        // Prefer photos embedded in album response if available
        if (Array.isArray(album.photos) && album.photos.length) {
            pics = album.photos.map((p) => ({ id: p.id, url: p.photoUrl || p.url, caption: p.caption || '' })).filter((p) => !!p.url);
        } else {
            // Fallback: fetch from /albums/{albumId}/photos
            const res = await getPhotosByAlbum(album.id);
            pics = (res || []).map((p) => ({ id: p.id, url: p.url, caption: p.caption || '' })).filter((p) => !!p.url);
        }
        // Keep only the first 4 for preview
        previewMap.value = { ...previewMap.value, [album.id]: pics.slice(0, 4) };
    } catch {
        previewMap.value = { ...previewMap.value, [album.id]: [] };
    } finally {
        previewLoading.value.delete(album.id);
    }
}

async function loadAlbums() {
    loading.value = true;
    try {
        if (selectedClass.value) {
            albums.value = await getAlbumsByClass(selectedClass.value.id);
        } else if (statusFilter.value !== 'ALL') {
            albums.value = await getAlbumsByStatus(statusFilter.value);
        } else {
            albums.value = [];
            swalToast.fire({ icon: 'info', title: 'Chọn lớp hoặc trạng thái để lọc album' });
        }
        // Warm up previews in the background (no need to await)
        Promise.all(albums.value.map((a) => ensurePreview(a))).catch(() => {});
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Không tải được album' });
    } finally {
        loading.value = false;
    }
}

function openCreate() {
    createForm.value = {
        classId: selectedClass.value?.id || null,
        title: '',
        description: ''
    };
    showCreate.value = true;
}

async function submitCreate() {
    if (!createForm.value.classId || !createForm.value.title.trim()) {
        swalToast.fire({ icon: 'info', title: 'Chọn lớp và nhập tiêu đề' });
        return;
    }
    try {
        const payload = {
            classId: createForm.value.classId,
            title: createForm.value.title.trim(),
            description: createForm.value.description?.trim() || '',
            createdBy: currentUser.value // <- username đăng nhập cho người tạo
        };
        const res = await createAlbum(payload);
        showCreate.value = false;
        swalToast.fire({ icon: 'success', title: 'Tạo album thành công' });
        // Focus lọc theo lớp chứa album
        if (!selectedClass.value || selectedClass.value.id !== res.classId) {
            const found = classes.value.find((c) => c.id === res.classId);
            if (found) selectedClass.value = found;
        }
        await loadAlbums();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Tạo album thất bại' });
    }
}

async function openDetail(album) {
    try {
        activeAlbum.value = await getAlbumById(album.id);
        photos.value = await getPhotosByAlbum(album.id);
        showDetail.value = true;
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Không mở được chi tiết album' });
    }
}

async function onApprove(status) {
    if (!activeAlbum.value) return;
    try {
        const updated = await approveAlbum(activeAlbum.value.id, {
            approvedBy: currentUser.value, // <- username đăng nhập cho người duyệt
            status // 'APPROVED' | 'REJECTED'
        });
        activeAlbum.value = updated;
        swalToast.fire({ icon: 'success', title: status === 'APPROVED' ? 'Đã duyệt album' : 'Đã từ chối album' });
        await loadAlbums();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Cập nhật phê duyệt thất bại' });
    }
}

async function onAddPhoto() {
    if (!activeAlbum.value) return;
    if (activeAlbum.value.status !== 'APPROVED') {
        swalToast.fire({ icon: 'info', title: 'Chỉ album đã duyệt mới thêm ảnh' });
        return;
    }
    if (!photoForm.value.url?.trim()) {
        swalToast.fire({ icon: 'info', title: 'Nhập đường dẫn ảnh' });
        return;
    }
    addingPhoto.value = true;
    try {
        await addPhotoToAlbum({
            albumId: activeAlbum.value.id,
            photoUrl: photoForm.value.url.trim(),
            caption: photoForm.value.caption?.trim() || ''
        });
        photoForm.value = { url: '', caption: '' };
        photos.value = await getPhotosByAlbum(activeAlbum.value.id);
        // update preview for this album too
        previewMap.value[activeAlbum.value.id] = (photos.value || []).slice(0, 4).map((p) => ({ id: p.id, url: p.url, caption: p.caption || '' }));
        swalToast.fire({ icon: 'success', title: 'Đã thêm ảnh' });
        await loadAlbums();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Thêm ảnh thất bại' });
    } finally {
        addingPhoto.value = false;
    }
}

async function onDeletePhoto(p) {
    const ok = await Swal.fire({
        title: 'Xóa ảnh?',
        text: p.caption || p.url,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Huỷ'
    });
    if (!ok.isConfirmed) return;
    try {
        await deletePhoto(p.id);
        photos.value = photos.value.filter((x) => x.id !== p.id);
        // update preview cache if detail album is open
        if (activeAlbum.value?.id) {
            previewMap.value[activeAlbum.value.id] = (photos.value || []).slice(0, 4).map((x) => ({ id: x.id, url: x.url, caption: x.caption || '' }));
        }
        swalToast.fire({ icon: 'success', title: 'Đã xóa ảnh' });
        await loadAlbums();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Xóa ảnh thất bại' });
    }
}

async function onDeleteAlbum(a) {
    const ok = await Swal.fire({
        title: 'Xóa album?',
        text: a.title,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Huỷ'
    });
    if (!ok.isConfirmed) return;
    try {
        await deleteAlbum(a.id);
        albums.value = albums.value.filter((x) => x.id !== a.id);
        if (showDetail.value && activeAlbum.value?.id === a.id) showDetail.value = false;
        delete previewMap.value[a.id];
        swalToast.fire({ icon: 'success', title: 'Đã xóa album' });
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Xóa album thất bại' });
    }
}

onMounted(async () => {
    await ensureUsername(); // lấy username ngay khi vào trang
    await loadClasses();
    await loadAlbums();
});
</script>

<template>
    <div class="px-4 md:px-6 lg:px-10 py-6 space-y-5">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-images text-2xl text-primary"></i>
                <div>
                    <div class="text-2xl font-extrabold tracking-tight text-slate-800">Quản lý album</div>
                    <div class="text-slate-500 text-sm">Tạo, duyệt và quản lý ảnh theo lớp</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <Button class="btn-primary" icon="fa-solid fa-plus mr-2" label="Tạo album" @click="openCreate" />
            </div>
        </div>

        <!-- Filters -->
        <Card class="card-soft ring-1 ring-slate-100">
            <template #content>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <label class="label">Lọc theo lớp</label>
                        <Dropdown v-model="selectedClass" :options="classes" optionLabel="name" class="w-full" placeholder="Chọn lớp" @change="loadAlbums" />
                    </div>
                    <div>
                        <label class="label">Trạng thái</label>
                        <Dropdown v-model="statusFilter" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" @change="loadAlbums" />
                    </div>
                    <div class="md:col-span-2">
                        <label class="label">Tìm kiếm</label>
                        <div class="flex gap-2">
                            <InputText v-model="keyword" placeholder="Tiêu đề, mô tả, lớp..." class="w-full" />
                            <Button class="btn-ghost" icon="fa-solid fa-magnifying-glass" @click="loadAlbums" />
                        </div>
                    </div>
                </div>
            </template>
        </Card>

        <!-- Albums grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <Card v-for="a in filteredAlbums" :key="a.id" class="album-card">
                <template #header>
                    <div class="preview-wrapper rounded-t-xl overflow-hidden">
                        <!-- Show preview grid if we have photos -->
                        <div v-if="previewMap[a.id]?.length" class="preview-grid">
                            <template v-for="(p, idx) in previewMap[a.id]" :key="p.id || idx">
                                <div class="preview-tile" :class="`tile-${idx + 1}`">
                                    <img :src="p.url" :alt="p.caption" />
                                </div>
                            </template>
                            <!-- Overlay for more count (only if BE embedded total) -->
                            <div v-if="(a.photos?.length || 0) > 4" class="preview-overlay">+{{ (a.photos?.length || 0) - 4 }}</div>
                        </div>
                        <!-- Placeholder when no photo -->
                        <div v-else class="placeholder flex items-center justify-center">
                            <i class="fa-solid fa-image text-5xl text-indigo-300"></i>
                        </div>
                    </div>
                </template>

                <template #title>
                    <div class="flex items-center justify-between">
                        <div class="line-clamp-1">{{ a.title }}</div>
                        <Tag :severity="statusStyle[a.status]?.severity" :value="statusStyle[a.status]?.text || a.status" />
                    </div>
                </template>

                <template #content>
                    <div class="space-y-2">
                        <div class="text-slate-600 text-sm line-clamp-2">{{ a.description || 'Không có mô tả' }}</div>
                        <div class="text-slate-700 text-sm"><i class="fa-solid fa-school mr-1"></i>{{ a.className }}</div>
                        <div class="text-slate-500 text-xs">
                            <i class="fa-regular fa-user mr-1"></i>Tạo bởi: <b>{{ a.createdBy || '—' }}</b>
                            <span v-if="a.createdAt"> • {{ new Date(a.createdAt).toLocaleString('vi-VN') }}</span>
                        </div>
                        <div class="text-slate-500 text-xs" v-if="a.approvedBy || a.approvedAt">
                            <i class="fa-regular fa-circle-check mr-1"></i>Duyệt: <b>{{ a.approvedBy || '—' }}</b>
                            <span v-if="a.approvedAt"> • {{ new Date(a.approvedAt).toLocaleString('vi-VN') }}</span>
                        </div>
                    </div>
                </template>

                <template #footer>
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <Button class="btn-outline" icon="fa-regular fa-images mr-2" label="Xem ảnh" @click="openDetail(a)" />
                            <Button
                                v-if="a.status === 'PENDING'"
                                class="btn-success"
                                icon="fa-solid fa-check mr-2"
                                label="Duyệt"
                                @click="
                                    async () => {
                                        activeAlbum.value = a;
                                        await onApprove('APPROVED');
                                    }
                                "
                            />
                            <Button
                                v-if="a.status === 'PENDING'"
                                class="btn-danger"
                                icon="fa-solid fa-xmark mr-2"
                                label="Từ chối"
                                @click="
                                    async () => {
                                        activeAlbum.value = a;
                                        await onApprove('REJECTED');
                                    }
                                "
                            />
                        </div>
                        <Button class="btn-ghost" icon="fa-solid fa-trash" @click="onDeleteAlbum(a)" />
                    </div>
                </template>
            </Card>
        </div>

        <div v-if="loading" class="text-slate-500 text-sm">Đang tải album...</div>

        <!-- Create dialog -->
        <Dialog v-model:visible="showCreate" modal :style="{ width: '560px', maxWidth: '95vw' }">
            <template #header>
                <div class="text-lg font-semibold text-slate-800">Tạo album mới</div>
            </template>
            <div class="space-y-3">
                <div>
                    <label class="label">Lớp <span class="req">*</span></label>
                    <Dropdown v-model="createForm.classId" :options="classes.map((c) => ({ label: c.name, value: c.id }))" optionLabel="label" optionValue="value" class="w-full" placeholder="Chọn lớp" />
                </div>
                <div>
                    <label class="label">Tiêu đề <span class="req">*</span></label>
                    <InputText v-model="createForm.title" class="w-full" placeholder="Nhập tiêu đề" />
                </div>
                <div>
                    <label class="label">Mô tả</label>
                    <InputText v-model="createForm.description" class="w-full" placeholder="Mô tả ngắn" />
                </div>
                <div class="text-xs text-slate-500">
                    Người tạo: <b>{{ currentUser }}</b>
                </div>
            </div>
            <template #footer>
                <div class="flex items-center justify-end gap-2">
                    <Button class="btn-ghost" label="Đóng" @click="showCreate = false" />
                    <Button class="btn-primary" label="Tạo" @click="submitCreate" />
                </div>
            </template>
        </Dialog>

        <!-- Detail dialog -->
        <Dialog v-model:visible="showDetail" modal :style="{ width: '980px', maxWidth: '98vw' }">
            <template #header>
                <div class="flex items-center justify-between w-full">
                    <div class="text-lg font-semibold text-slate-800">Album: {{ activeAlbum?.title }}</div>
                    <Tag :severity="statusStyle[activeAlbum?.status]?.severity" :value="statusStyle[activeAlbum?.status]?.text || activeAlbum?.status" />
                </div>
            </template>

            <div class="space-y-4">
                <div class="text-slate-600 text-sm">{{ activeAlbum?.description || 'Không có mô tả' }}</div>

                <Divider />

                <!-- Add photo -->
                <div class="rounded-xl ring-1 ring-slate-200 p-3 bg-slate-50/50">
                    <div class="font-semibold mb-2">Thêm ảnh (URL)</div>
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <InputText v-model="photoForm.url" class="md:col-span-3 w-full" placeholder="https://..." />
                        <InputText v-model="photoForm.caption" class="w-full" placeholder="Chú thích (tuỳ chọn)" />
                    </div>
                    <div class="mt-2">
                        <Button class="btn-primary" :label="addingPhoto ? 'Đang thêm...' : 'Thêm ảnh'" :disabled="addingPhoto" @click="onAddPhoto" />
                        <span class="text-xs text-slate-500 ml-2">Chỉ album đã duyệt mới thêm ảnh</span>
                    </div>
                </div>

                <!-- Photos grid -->
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <div v-for="p in photos" :key="p.id" class="photo-card">
                        <div class="relative group">
                            <img :src="p.url" :alt="p.caption" class="w-full h-40 object-cover rounded-xl ring-1 ring-slate-200" />
                            <button class="del-btn" @click="onDeletePhoto(p)" title="Xóa ảnh">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                        <div class="text-sm mt-1 font-medium line-clamp-1">{{ p.caption || '—' }}</div>
                        <div class="text-xs text-slate-500">{{ p.uploadedAt ? new Date(p.uploadedAt).toLocaleString('vi-VN') : '' }}</div>
                    </div>
                </div>

                <!-- Approver info (hiển thị rõ người duyệt) -->
                <div class="text-xs text-slate-500" v-if="activeAlbum?.approvedBy || activeAlbum?.approvedAt">
                    <i class="fa-regular fa-circle-check mr-1"></i>Duyệt bởi: <b>{{ activeAlbum?.approvedBy || '—' }}</b>
                    <span v-if="activeAlbum?.approvedAt"> • {{ new Date(activeAlbum.approvedAt).toLocaleString('vi-VN') }}</span>
                </div>
            </div>

            <template #footer>
                <div class="flex items-center justify-end gap-2">
                    <Button v-if="activeAlbum?.status === 'PENDING'" class="btn-success" label="Duyệt" @click="onApprove('APPROVED')" />
                    <Button v-if="activeAlbum?.status === 'PENDING'" class="btn-danger" label="Từ chối" @click="onApprove('REJECTED')" />
                    <Button class="btn-ghost" label="Đóng" @click="showDetail = false" />
                </div>
            </template>
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
.req {
    color: #ef4444;
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
.btn-danger {
    background: linear-gradient(135deg, #dc2626, #f43f5e);
    color: #fff;
    border: 0;
}
.btn-outline {
    background: #fff;
    color: #334155;
    border: 1px solid #e2e8f0;
}
.btn-ghost {
    background: #f1f5f9;
    color: #334155;
    border: 0;
}

.album-card {
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
}

/* Preview header */
.preview-wrapper {
    height: 10rem;
    background: linear-gradient(180deg, #eef2ff, #ffffff);
}
.placeholder {
    height: 100%;
}
.preview-grid {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    height: 100%;
    gap: 3px;
    background: #fff;
}
.preview-tile {
    position: relative;
    overflow: hidden;
    border-radius: 8px;
}
.preview-tile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

/* Optional different placements */
.tile-1 {
    grid-column: 1 / 2;
    grid-row: 1 / 2;
}
.tile-2 {
    grid-column: 2 / 3;
    grid-row: 1 / 2;
}
.tile-3 {
    grid-column: 1 / 2;
    grid-row: 2 / 3;
}
.tile-4 {
    grid-column: 2 / 3;
    grid-row: 2 / 3;
}

.preview-overlay {
    position: absolute;
    right: 8px;
    bottom: 8px;
    background: rgba(15, 23, 42, 0.7);
    color: #fff;
    font-weight: 700;
    font-size: 13px;
    padding: 4px 8px;
    border-radius: 999px;
    backdrop-filter: blur(2px);
}

/* Detail photo actions */
.photo-card .del-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(244, 63, 94, 0.92);
    color: #fff;
    border: 0;
    border-radius: 999px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transform: translateY(-4px);
    transition: all 0.15s ease;
}
.photo-card .group:hover .del-btn {
    opacity: 1;
    transform: translateY(0);
}
</style>
