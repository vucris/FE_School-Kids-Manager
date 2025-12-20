<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Textarea from 'primevue/textarea';

import Swal from 'sweetalert2';

import { fetchClassesLite } from '@/service/classService.js';
import {
    getAlbumsByClass,
    getAlbumsByStatus,
    getAlbumById,
    createAlbum,
    approveAlbum,
    getPhotosByAlbum,
    uploadPhotosToAlbum,
    deleteAlbum,
    deletePhoto
} from '@/service/albumService.js';
import { fetchMyTeacherClasses } from '@/service/teacherService.js';

import { useAuthStore } from '@/stores/auth.js';
import { getUsernameFromUser, getCurrentUsername, fetchCurrentUsername } from '@/service/authService.js';

const auth = useAuthStore();

/* ========= USERNAME & ROLE ========= */
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
    () => ensureUsername(),
    { immediate: true }
);

const roleName = computed(() => {
    const u = auth.user || {};
    return u.roleName || u.role?.name || u.role || '';
});

const isAdmin = computed(() => roleName.value === 'ADMIN');
const isTeacher = computed(() => roleName.value === 'TEACHER');

/* ========= FILTERS ========= */
const classes = ref([]);
const selectedClassId = ref(null);

const statusOptions = [
    { label: 'Tất cả trạng thái', value: 'ALL' },
    { label: 'Chờ duyệt', value: 'PENDING' },
    { label: 'Đã duyệt', value: 'APPROVED' },
    { label: 'Từ chối', value: 'REJECTED' }
];
const statusFilter = ref('ALL');
const keyword = ref('');

/* ========= DATA ========= */
const loading = ref(false);
const albums = ref([]);

const previewMap = ref({});
const previewLoading = ref(new Set());

/* ========= DIALOGS ========= */
const showCreate = ref(false);
const createForm = ref({ classId: null, title: '', description: '' });
const createLoading = ref(false);

const showDetail = ref(false);
const activeAlbum = ref(null);
const photos = ref([]);
const detailLoading = ref(false);

const addingPhoto = ref(false);
const photoForm = ref({ files: [], caption: '' });

// Lightbox
const showLightbox = ref(false);
const lightboxIndex = ref(0);

/* ========= STATUS CONFIG ========= */
const statusConfig = {
    PENDING: { label: 'Chờ duyệt', bg: 'bg-amber-50', color: 'text-amber-600', icon: 'fa-clock' },
    APPROVED: { label: 'Đã duyệt', bg: 'bg-green-50', color: 'text-green-600', icon: 'fa-check-circle' },
    REJECTED: { label: 'Từ chối', bg: 'bg-red-50', color: 'text-red-600', icon: 'fa-times-circle' }
};

/* ========= TOAST ========= */
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
});

function confirmDialog(title, text) {
    return Swal.fire({
        title,
        text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xác nhận',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280',
        reverseButtons: true
    });
}

/* ========= COMPUTED ========= */
const filteredAlbums = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    let list = albums.value || [];

    if (statusFilter.value !== 'ALL') {
        list = list.filter((a) => a.status === statusFilter.value);
    }

    if (q) {
        list = list.filter(
            (a) =>
                (a.title || '').toLowerCase().includes(q) ||
                (a.description || '').toLowerCase().includes(q) ||
                (a.className || '').toLowerCase().includes(q)
        );
    }
    return list;
});

const selectedClassName = computed(() => {
    const cls = classes.value.find((c) => c.id === selectedClassId.value);
    return cls?.name || '';
});

/* ========= UTILS ========= */
function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getPhotoCount(album) {
    return album?.photos?.length || album?.photoCount || 0;
}

/* ========= LOAD CLASSES ========= */
async function loadClasses() {
    try {
        let list = [];

        if (isAdmin.value) {
            const lite = await fetchClassesLite();
            list = (lite || []).map((c) => ({
                id: c.value ?? c.id,
                name: c.label ?? c.className ?? `Lớp ${c.id}`
            }));
        } else if (isTeacher.value) {
            const mine = await fetchMyTeacherClasses();
            list = (mine || []).map((c) => ({
                id: c.id,
                name: c.className || c.name || `Lớp ${c.id}`
            }));
        }

        classes.value = list;

        if (!selectedClassId.value && classes.value.length) {
            selectedClassId.value = classes.value[0].id;
        }
    } catch (e) {
        console.error(e);
        swalToast.fire({ icon: 'error', title: 'Không tải được danh sách lớp' });
    }
}

/* ========= PREVIEW ========= */
async function ensurePreview(album) {
    if (!album?.id || previewMap.value[album.id] || previewLoading.value.has(album.id)) return;

    previewLoading.value.add(album.id);
    try {
        let pics = [];
        if (Array.isArray(album.photos) && album.photos.length) {
            pics = album.photos
                .map((p) => ({
                    id: p.id,
                    url: p.photoUrl || p.url,
                    caption: p.caption || ''
                }))
                .filter((p) => !!p.url);
        } else {
            const res = await getPhotosByAlbum(album.id);
            pics = (res || [])
                .map((p) => ({
                    id: p.id,
                    url: p.url,
                    caption: p.caption || ''
                }))
                .filter((p) => !!p.url);
        }
        previewMap.value = { ...previewMap.value, [album.id]: pics.slice(0, 4) };
    } catch {
        previewMap.value = { ...previewMap.value, [album.id]: [] };
    } finally {
        previewLoading.value.delete(album.id);
    }
}

/* ========= LOAD ALBUMS ========= */
async function loadAlbums() {
    loading.value = true;
    try {
        if (selectedClassId.value) {
            albums.value = await getAlbumsByClass(selectedClassId.value);
        } else if (isAdmin.value && statusFilter.value !== 'ALL') {
            albums.value = await getAlbumsByStatus(statusFilter.value);
        } else {
            albums.value = [];
        }

        Promise.all((albums.value || []).map((a) => ensurePreview(a))).catch(() => {});
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Không tải được album' });
    } finally {
        loading.value = false;
    }
}

/* ========= CREATE ========= */
function openCreate() {
    createForm.value = {
        classId: selectedClassId.value || (classes.value[0]?.id ?? null),
        title: '',
        description: ''
    };
    showCreate.value = true;
}

async function submitCreate() {
    if (!createForm.value.classId) {
        swalToast.fire({ icon: 'warning', title: 'Vui lòng chọn lớp' });
        return;
    }
    if (!createForm.value.title.trim()) {
        swalToast.fire({ icon: 'warning', title: 'Vui lòng nhập tiêu đề album' });
        return;
    }

    createLoading.value = true;
    try {
        const payload = {
            classId: createForm.value.classId,
            title: createForm.value.title.trim(),
            description: createForm.value.description?.trim() || '',
            createdBy: currentUser.value
        };
        const res = await createAlbum(payload);
        showCreate.value = false;
        swalToast.fire({ icon: 'success', title: 'Tạo album thành công' });

        if (!selectedClassId.value || selectedClassId.value !== res.classId) {
            selectedClassId.value = res.classId;
        }
        await loadAlbums();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Tạo album thất bại' });
    } finally {
        createLoading.value = false;
    }
}

/* ========= DETAIL ========= */
async function openDetail(album) {
    detailLoading.value = true;
    showDetail.value = true;
    activeAlbum.value = album;
    photos.value = [];
    photoForm.value = { files: [], caption: '' };

    try {
        const [albumData, photoData] = await Promise.all([
            getAlbumById(album.id),
            getPhotosByAlbum(album.id)
        ]);
        activeAlbum.value = albumData;
        photos.value = photoData || [];
    } catch (e) {
        swalToast.fire({ icon: 'error', title: 'Không mở được chi tiết album' });
    } finally {
        detailLoading.value = false;
    }
}

/* ========= APPROVE ========= */
async function handleApprove(album, status) {
    if (!isAdmin.value) {
        swalToast.fire({ icon: 'info', title: 'Chỉ Admin mới được duyệt album' });
        return;
    }

    const action = status === 'APPROVED' ? 'duyệt' : 'từ chối';
    const { isConfirmed } = await confirmDialog(
        `${status === 'APPROVED' ? 'Duyệt' : 'Từ chối'} album?`,
        `Bạn có chắc muốn ${action} album "${album.title}"?`
    );
    if (!isConfirmed) return;

    try {
        const updated = await approveAlbum(album.id, {
            approvedBy: currentUser.value,
            status
        });

        if (activeAlbum.value?.id === album.id) {
            activeAlbum.value = updated;
        }

        swalToast.fire({
            icon: 'success',
            title: status === 'APPROVED' ? 'Đã duyệt album' : 'Đã từ chối album'
        });
        await loadAlbums();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Thao tác thất bại' });
    }
}

/* ========= ADD PHOTO ========= */
function onFileChange(e) {
    photoForm.value.files = Array.from(e.target.files || []);
}

async function onAddPhoto() {
    if (!activeAlbum.value) return;

    if (!photoForm.value.files?.length) {
        swalToast.fire({ icon: 'warning', title: 'Chọn ít nhất một ảnh' });
        return;
    }

    addingPhoto.value = true;
    try {
        const captions = photoForm.value.files.map(() => photoForm.value.caption?.trim() || '');

        await uploadPhotosToAlbum({
            albumId: activeAlbum.value.id,
            files: photoForm.value.files,
            captions
        });

        photoForm.value = { files: [], caption: '' };
        // Reset file input
        const fileInput = document.getElementById('photo-input');
        if (fileInput) fileInput.value = '';

        photos.value = await getPhotosByAlbum(activeAlbum.value.id);

        previewMap.value[activeAlbum.value.id] = photos.value.slice(0, 4).map((p) => ({
            id: p.id,
            url: p.url,
            caption: p.caption || ''
        }));

        swalToast.fire({ icon: 'success', title: 'Đã thêm ảnh' });
        await loadAlbums();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Thêm ảnh thất bại' });
    } finally {
        addingPhoto.value = false;
    }
}

/* ========= DELETE PHOTO ========= */
async function onDeletePhoto(photo) {
    const { isConfirmed } = await confirmDialog('Xóa ảnh?', 'Ảnh sẽ bị xóa vĩnh viễn');
    if (!isConfirmed) return;

    try {
        await deletePhoto(photo.id);
        photos.value = photos.value.filter((x) => x.id !== photo.id);

        if (activeAlbum.value?.id) {
            previewMap.value[activeAlbum.value.id] = photos.value.slice(0, 4).map((x) => ({
                id: x.id,
                url: x.url,
                caption: x.caption || ''
            }));
        }

        swalToast.fire({ icon: 'success', title: 'Đã xóa ảnh' });
        await loadAlbums();
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Xóa ảnh thất bại' });
    }
}

/* ========= DELETE ALBUM ========= */
async function onDeleteAlbum(album) {
    const { isConfirmed } = await confirmDialog(
        'Xóa album?',
        `Album "${album.title}" và tất cả ảnh bên trong sẽ bị xóa vĩnh viễn`
    );
    if (!isConfirmed) return;

    try {
        await deleteAlbum(album.id);
        albums.value = albums.value.filter((x) => x.id !== album.id);

        if (showDetail.value && activeAlbum.value?.id === album.id) {
            showDetail.value = false;
        }

        delete previewMap.value[album.id];
        swalToast.fire({ icon: 'success', title: 'Đã xóa album' });
    } catch (e) {
        swalToast.fire({ icon: 'error', title: e?.message || 'Xóa album thất bại' });
    }
}

/* ========= LIGHTBOX ========= */
function openLightbox(index) {
    lightboxIndex.value = index;
    showLightbox.value = true;
}

function nextPhoto() {
    if (lightboxIndex.value < photos.value.length - 1) {
        lightboxIndex.value++;
    }
}

function prevPhoto() {
    if (lightboxIndex.value > 0) {
        lightboxIndex.value--;
    }
}

/* ========= LIFECYCLE ========= */
onMounted(async () => {
    await ensureUsername();
    await loadClasses();
    await loadAlbums();
});
</script>

<template>
    <div class="album-page">
        <!-- Header -->
        <header class="page-header">
            <div class="header-left">
                <div class="header-icon">
                    <i class="fa-solid fa-images"></i>
                </div>
                <div>
                    <h1 class="page-title">Album ảnh</h1>
                    <p class="page-desc">Quản lý album ảnh hoạt động theo lớp</p>
                </div>
            </div>
            <button class="btn btn-primary" @click="openCreate">
                <i class="fa-solid fa-plus"></i>
                <span>Tạo album</span>
            </button>
        </header>

        <!-- Filters -->
        <div class="filter-bar">
            <div class="filter-item">
                <label>Lớp học</label>
                <Dropdown
                    v-model="selectedClassId"
                    :options="classes"
                    optionLabel="name"
                    optionValue="id"
                    placeholder="Chọn lớp"
                    class="w-full"
                    @change="loadAlbums"
                />
                <span v-if="isTeacher" class="filter-hint">Chỉ hiển thị lớp được phân công</span>
            </div>
            <div class="filter-item">
                <label>Trạng thái</label>
                <Dropdown
                    v-model="statusFilter"
                    :options="statusOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                    @change="loadAlbums"
                />
            </div>
            <div class="filter-item filter-search">
                <label>Tìm kiếm</label>
                <div class="search-box">
                    <i class="fa-solid fa-search"></i>
                    <InputText v-model="keyword" placeholder="Tên album, mô tả..." class="w-full" />
                </div>
            </div>
        </div>

        <!-- Summary -->
        <div v-if="selectedClassName" class="summary-bar">
            <div class="summary-info">
                <i class="fa-solid fa-folder-open"></i>
                <span>{{ selectedClassName }}</span>
                <span class="divider">•</span>
                <span>{{ filteredAlbums.length }} album</span>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="loading-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Đang tải album...</span>
        </div>

        <!-- Empty state -->
        <div v-else-if="!filteredAlbums.length" class="empty-state">
            <i class="fa-solid fa-images"></i>
            <h3>Chưa có album nào</h3>
            <p>Tạo album mới để lưu trữ ảnh hoạt động của lớp</p>
            <button class="btn btn-primary" @click="openCreate">
                <i class="fa-solid fa-plus"></i>
                Tạo album đầu tiên
            </button>
        </div>

        <!-- Albums Grid -->
        <div v-else class="albums-grid">
            <div v-for="album in filteredAlbums" :key="album.id" class="album-card">
                <!-- Preview -->
                <div class="album-preview" @click="openDetail(album)">
                    <div v-if="previewMap[album.id]?.length" class="preview-grid">
                        <div
                            v-for="(photo, idx) in previewMap[album.id].slice(0, 4)"
                            :key="photo.id"
                            class="preview-item"
                        >
                            <img :src="photo.url" :alt="photo.caption" />
                        </div>
                        <div v-if="getPhotoCount(album) > 4" class="preview-more">
                            +{{ getPhotoCount(album) - 4 }}
                        </div>
                    </div>
                    <div v-else class="preview-empty">
                        <i class="fa-solid fa-camera"></i>
                        <span>Chưa có ảnh</span>
                    </div>
                </div>

                <!-- Info -->
                <div class="album-info">
                    <div class="album-header">
                        <h3 class="album-title" @click="openDetail(album)">{{ album.title }}</h3>
                        <span class="status-tag" :class="statusConfig[album.status]?.bg">
                            <i :class="['fa-solid', statusConfig[album.status]?.icon]"></i>
                            {{ statusConfig[album.status]?.label }}
                        </span>
                    </div>

                    <p class="album-desc">{{ album.description || 'Không có mô tả' }}</p>

                    <div class="album-meta">
                        <span><i class="fa-solid fa-images"></i> {{ getPhotoCount(album) }} ảnh</span>
                        <span><i class="fa-solid fa-chalkboard"></i> {{ album.className }}</span>
                    </div>

                    <div class="album-footer">
                        <div class="album-author">
                            <i class="fa-solid fa-user"></i>
                            <span>{{ album.createdBy || 'Ẩn danh' }}</span>
                            <span v-if="album.createdAt" class="date">{{ formatDate(album.createdAt) }}</span>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="album-actions">
                    <button class="action-btn" @click="openDetail(album)" title="Xem chi tiết">
                        <i class="fa-solid fa-eye"></i>
                    </button>

                    <template v-if="isAdmin && album.status === 'PENDING'">
                        <button
                            class="action-btn success"
                            @click.stop="handleApprove(album, 'APPROVED')"
                            title="Duyệt"
                        >
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button
                            class="action-btn danger"
                            @click.stop="handleApprove(album, 'REJECTED')"
                            title="Từ chối"
                        >
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </template>

                    <button class="action-btn danger" @click.stop="onDeleteAlbum(album)" title="Xóa album">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- Create Dialog -->
        <Dialog v-model:visible="showCreate" modal :style="{ width: '480px', maxWidth: '95vw' }" :draggable="false">
            <template #header>
                <div class="dialog-header">
                    <i class="fa-solid fa-folder-plus"></i>
                    <span>Tạo album mới</span>
                </div>
            </template>

            <div class="dialog-body">
                <div class="form-field">
                    <label>Lớp học <span class="required">*</span></label>
                    <Dropdown
                        v-model="createForm.classId"
                        :options="classes"
                        optionLabel="name"
                        optionValue="id"
                        placeholder="Chọn lớp"
                        class="w-full"
                    />
                </div>

                <div class="form-field">
                    <label>Tiêu đề <span class="required">*</span></label>
                    <InputText
                        v-model="createForm.title"
                        placeholder="VD: Hoạt động ngoại khóa tháng 12"
                        class="w-full"
                    />
                </div>

                <div class="form-field">
                    <label>Mô tả</label>
                    <Textarea
                        v-model="createForm.description"
                        placeholder="Mô tả ngắn về album..."
                        rows="3"
                        class="w-full"
                    />
                </div>

                <div class="form-hint">
                    <i class="fa-solid fa-info-circle"></i>
                    <span>Album sẽ ở trạng thái "Chờ duyệt" sau khi tạo</span>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <button class="btn btn-ghost" @click="showCreate = false">Hủy</button>
                    <button class="btn btn-primary" @click="submitCreate" :disabled="createLoading">
                        <i v-if="createLoading" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-plus"></i>
                        <span>{{ createLoading ? 'Đang tạo...' : 'Tạo album' }}</span>
                    </button>
                </div>
            </template>
        </Dialog>

        <!-- Detail Dialog -->
        <Dialog v-model:visible="showDetail" modal :style="{ width: '900px', maxWidth: '98vw' }" :draggable="false">
            <template #header>
                <div class="dialog-header">
                    <div class="header-content">
                        <i class="fa-solid fa-images"></i>
                        <span>{{ activeAlbum?.title || 'Chi tiết album' }}</span>
                    </div>
                    <span v-if="activeAlbum" class="status-tag" :class="statusConfig[activeAlbum.status]?.bg">
                        <i :class="['fa-solid', statusConfig[activeAlbum.status]?.icon]"></i>
                        {{ statusConfig[activeAlbum.status]?.label }}
                    </span>
                </div>
            </template>

            <div class="dialog-body">
                <div v-if="detailLoading" class="loading-state">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>Đang tải...</span>
                </div>

                <template v-else>
                    <!-- Album info -->
                    <div class="detail-info">
                        <p class="detail-desc">{{ activeAlbum?.description || 'Không có mô tả' }}</p>
                        <div class="detail-meta">
                            <span><i class="fa-solid fa-chalkboard"></i> {{ activeAlbum?.className }}</span>
                            <span><i class="fa-solid fa-user"></i> {{ activeAlbum?.createdBy }}</span>
                            <span><i class="fa-solid fa-calendar"></i> {{ formatDate(activeAlbum?.createdAt) }}</span>
                        </div>
                    </div>

                    <!-- Upload section -->
                    <div class="upload-section">
                        <h4><i class="fa-solid fa-cloud-upload-alt"></i> Thêm ảnh mới</h4>
                        <div class="upload-form">
                            <div class="file-input-wrapper">
                                <input
                                    id="photo-input"
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    @change="onFileChange"
                                />
                                <label for="photo-input" class="file-label">
                                    <i class="fa-solid fa-images"></i>
                                    <span>
                                        {{
                                            photoForm.files.length
                                                ? `${photoForm.files.length} ảnh đã chọn`
                                                : 'Chọn ảnh (có thể chọn nhiều)'
                                        }}
                                    </span>
                                </label>
                            </div>
                            <InputText
                                v-model="photoForm.caption"
                                placeholder="Chú thích (tùy chọn)"
                                class="caption-input"
                            />
                            <button
                                class="btn btn-primary"
                                @click="onAddPhoto"
                                :disabled="addingPhoto || !photoForm.files.length"
                            >
                                <i :class="addingPhoto ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-upload'"></i>
                                <span>{{ addingPhoto ? 'Đang tải...' : 'Tải lên' }}</span>
                            </button>
                        </div>
                    </div>

                    <!-- Photos grid -->
                    <div class="photos-section">
                        <h4><i class="fa-solid fa-th"></i> Ảnh trong album ({{ photos.length }})</h4>

                        <div v-if="!photos.length" class="empty-photos">
                            <i class="fa-solid fa-image"></i>
                            <span>Chưa có ảnh nào trong album</span>
                        </div>

                        <div v-else class="photos-grid">
                            <div v-for="(photo, idx) in photos" :key="photo.id" class="photo-item">
                                <img :src="photo.url" :alt="photo.caption" @click="openLightbox(idx)" />
                                <div class="photo-overlay">
                                    <button class="photo-btn view" @click="openLightbox(idx)" title="Xem">
                                        <i class="fa-solid fa-expand"></i>
                                    </button>
                                    <button class="photo-btn delete" @click="onDeletePhoto(photo)" title="Xóa">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                                <div v-if="photo.caption" class="photo-caption">{{ photo.caption }}</div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <template v-if="isAdmin && activeAlbum?.status === 'PENDING'">
                        <button class="btn btn-success" @click="handleApprove(activeAlbum, 'APPROVED')">
                            <i class="fa-solid fa-check"></i>
                            Duyệt album
                        </button>
                        <button class="btn btn-danger" @click="handleApprove(activeAlbum, 'REJECTED')">
                            <i class="fa-solid fa-times"></i>
                            Từ chối
                        </button>
                    </template>
                    <button class="btn btn-ghost" @click="showDetail = false">Đóng</button>
                </div>
            </template>
        </Dialog>

        <!-- Lightbox -->
        <Dialog
            v-model:visible="showLightbox"
            modal
            :style="{ width: '90vw', maxWidth: '1200px' }"
            :draggable="false"
            class="lightbox-dialog"
        >
            <template #header>
                <div class="lightbox-header">
                    <span>{{ lightboxIndex + 1 }} / {{ photos.length }}</span>
                </div>
            </template>

            <div class="lightbox-content">
                <button v-if="lightboxIndex > 0" class="lightbox-nav prev" @click="prevPhoto">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>

                <img
                    v-if="photos[lightboxIndex]"
                    :src="photos[lightboxIndex].url"
                    :alt="photos[lightboxIndex].caption"
                />

                <button v-if="lightboxIndex < photos.length - 1" class="lightbox-nav next" @click="nextPhoto">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>

            <div v-if="photos[lightboxIndex]?.caption" class="lightbox-caption">
                {{ photos[lightboxIndex].caption }}
            </div>
        </Dialog>
    </div>
</template>

<style scoped>
/* ===== Base ===== */
.album-page {
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    background: #f8fafc;
    min-height: 100vh;
}

/* ===== Header ===== */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}
:global(.swal2-container) {
    z-index: 20000 !important;
}
:global(.swal2-popup) {
    z-index: 20001 !important;
}
:global(.swal2-toast) {
    z-index: 20002 !important;
}

/* ===== Base ===== */
.album-page {
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    background: #f8fafc;
    min-height: 100vh;
}

.header-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.25rem;
}

.page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
}

.page-desc {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
}

/* ===== Buttons ===== */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
}

.btn-primary {
    background: #6366f1;
    color: white;
}
.btn-primary:hover {
    background: #4f46e5;
}

.btn-success {
    background: #10b981;
    color: white;
}
.btn-success:hover {
    background: #059669;
}

.btn-danger {
    background: #ef4444;
    color: white;
}
.btn-danger:hover {
    background: #dc2626;
}

.btn-ghost {
    background: #f1f5f9;
    color: #475569;
}
.btn-ghost:hover {
    background: #e2e8f0;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* ===== Filter ===== */
.filter-bar {
    display: grid;
    grid-template-columns: 200px 180px 1fr;
    gap: 1rem;
    padding: 1rem;
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    margin-bottom: 1rem;
}

@media (max-width: 768px) {
    .filter-bar {
        grid-template-columns: 1fr;
    }
}

.filter-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.filter-item label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
}

.filter-hint {
    font-size: 0.7rem;
    color: #f59e0b;
}

.search-box {
    position: relative;
}

.search-box i {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
}

.search-box input {
    padding-left: 2.25rem !important;
}

/* ===== Summary ===== */
.summary-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    margin-bottom: 1rem;
}

.summary-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #475569;
}

.summary-info .divider {
    color: #cbd5e1;
}

/* ===== Loading & Empty ===== */
.loading-state,
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: #64748b;
}

.loading-state i,
.empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: #cbd5e1;
}

.empty-state h3 {
    font-size: 1.125rem;
    color: #475569;
    margin: 0 0 0.5rem;
}

.empty-state p {
    margin: 0 0 1rem;
}

/* ===== Albums Grid ===== */
.albums-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
}

.album-card {
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    transition: box-shadow 0.2s;
}

.album-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* Preview */
.album-preview {
    height: 160px;
    cursor: pointer;
    background: #f8fafc;
}

.preview-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    height: 100%;
    gap: 2px;
    position: relative;
}

.preview-item {
    overflow: hidden;
}

.preview-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.preview-more {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
}

.preview-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #cbd5e1;
}

.preview-empty i {
    font-size: 2rem;
    margin-bottom: 0.5rem;
}

/* Info */
.album-info {
    padding: 1rem;
}

.album-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.album-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
    cursor: pointer;
    line-height: 1.3;
}

.album-title:hover {
    color: #6366f1;
}

.status-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 500;
    white-space: nowrap;
}

.bg-amber-50 {
    background: #fef3c7;
    color: #d97706;
}

.bg-green-50 {
    background: #dcfce7;
    color: #16a34a;
}

.bg-red-50 {
    background: #fee2e2;
    color: #dc2626;
}

.album-desc {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0 0 0.75rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.album-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: #94a3b8;
    margin-bottom: 0.75rem;
}

.album-meta i {
    margin-right: 0.25rem;
}

.album-footer {
    padding-top: 0.75rem;
    border-top: 1px solid #f1f5f9;
}

.album-author {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #64748b;
}

.album-author .date {
    color: #94a3b8;
}

/* Actions */
.album-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
}

.action-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: none;
    background: white;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    border: 1px solid #e2e8f0;
}

.action-btn:hover {
    background: #f1f5f9;
    color: #475569;
}

.action-btn.success {
    color: #10b981;
}
.action-btn.success:hover {
    background: #dcfce7;
}

.action-btn.danger {
    color: #ef4444;
}
.action-btn.danger:hover {
    background: #fee2e2;
}

/* ===== Dialog ===== */
.dialog-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #1e293b;
}

.dialog-header .header-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
}

.dialog-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.form-field label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #475569;
}

.required {
    color: #ef4444;
}

.form-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #64748b;
    padding: 0.5rem;
    background: #f8fafc;
    border-radius: 6px;
}

/* ===== Detail ===== */
.detail-info {
    padding: 1rem;
    background: #f8fafc;
    border-radius: 8px;
}

.detail-desc {
    color: #475569;
    margin: 0 0 0.75rem;
}

.detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.875rem;
    color: #64748b;
}

.detail-meta i {
    margin-right: 0.25rem;
    color: #94a3b8;
}

/* Upload */
.upload-section {
    padding: 1rem;
    background: #f8fafc;
    border-radius: 8px;
}

.upload-section h4 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #475569;
    margin: 0 0 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.upload-form {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.file-input-wrapper {
    flex: 1;
    min-width: 200px;
}

.file-input-wrapper input {
    display: none;
}

.file-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    cursor: pointer;
    color: #64748b;
    font-size: 0.875rem;
    transition: all 0.2s;
}

.file-label:hover {
    border-color: #6366f1;
    color: #6366f1;
}

.caption-input {
    flex: 1;
    min-width: 150px;
}

/* Photos */
.photos-section {
    padding: 1rem;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.photos-section h4 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #475569;
    margin: 0 0 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.empty-photos {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    color: #94a3b8;
}

.empty-photos i {
    font-size: 2rem;
    margin-bottom: 0.5rem;
}

.photos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
}

.photo-item {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
}

.photo-item img {
    width: 100%;
    height: 120px;
    object-fit: cover;
    cursor: pointer;
    transition: transform 0.2s;
}

.photo-item:hover img {
    transform: scale(1.05);
}

.photo-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    opacity: 0;
    transition: opacity 0.2s;
}

.photo-item:hover .photo-overlay {
    opacity: 1;
}

.photo-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: white;
    color: #475569;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.photo-btn.delete {
    background: #ef4444;
    color: white;
}

.photo-caption {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.25rem 0.5rem;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 0.7rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ===== Lightbox ===== */
.lightbox-header {
    text-align: center;
    color: #64748b;
}

.lightbox-content {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
}

.lightbox-content img {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: 8px;
}

.lightbox-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
}

.lightbox-nav.prev {
    left: 1rem;
}

.lightbox-nav.next {
    right: 1rem;
}

.lightbox-caption {
    text-align: center;
    padding: 1rem;
    color: #475569;
}
</style>
