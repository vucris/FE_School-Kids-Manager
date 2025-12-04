<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth.js';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['close']);

const auth = useAuthStore();

// Lấy thông tin user từ store
const user = computed(() => auth.user || {});

// Format ngày tháng
function formatDate(dateString) {
    if (!dateString) return 'Chưa cập nhật';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Lấy chữ cái đầu tên
function getInitials(name) {
    if (!name) return 'U';
    return name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function closeModal() {
    emit('close');
}

function onOverlayClick(event) {
    if (event.target === event.currentTarget) {
        closeModal();
    }
}
</script>

<template>
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="visible" class="modal-overlay" @click="onOverlayClick">
                <div class="modal-container" role="dialog" aria-modal="true" aria-labelledby="profile-title">
                    <!-- Header với gradient đẹp -->
                    <div class="modal-header">
                        <div class="header-background"></div>
                        <button class="close-btn" @click="closeModal" aria-label="Đóng modal">
                            <i class="pi pi-times"></i>
                        </button>

                        <!-- Avatar với hiệu ứng -->
                        <div class="avatar-wrapper">
                            <div v-if="user.avatar" class="avatar">
                                <img :src="user.avatar" :alt="user.fullName" />
                            </div>
                            <div v-else class="avatar avatar-initials">
                                {{ getInitials(user.fullName || user.username) }}
                            </div>
                            <div class="status-badge online" title="Đang hoạt động"></div>
                        </div>

                        <!-- Tên và role -->
                        <h2 id="profile-title" class="user-name">{{ user.fullName || 'Người dùng' }}</h2>
                        <span class="user-role">
                            <i class="pi pi-shield"></i>
                            {{ user.role || 'Member' }}
                        </span>
                    </div>

                    <!-- Body với scroll mượt -->
                    <div class="modal-body">
                        <!-- Thông tin đăng nhập -->
                        <div class="info-section">
                            <h3 class="section-title">
                                <i class="pi pi-user"></i>
                                Thông tin tài khoản
                            </h3>

                            <div class="info-grid">
                                <div class="info-item">
                                    <div class="info-icon">
                                        <i class="pi pi-at"></i>
                                    </div>
                                    <div class="info-content">
                                        <span class="info-label">Tên đăng nhập</span>
                                        <span class="info-value">{{ user.username || 'N/A' }}</span>
                                    </div>
                                </div>

                                <div class="info-item">
                                    <div class="info-icon">
                                        <i class="pi pi-envelope"></i>
                                    </div>
                                    <div class="info-content">
                                        <span class="info-label">Email</span>
                                        <span class="info-value">{{ user.email || 'Chưa cập nhật' }}</span>
                                    </div>
                                </div>

                                <div class="info-item">
                                    <div class="info-icon">
                                        <i class="pi pi-phone"></i>
                                    </div>
                                    <div class="info-content">
                                        <span class="info-label">Số điện thoại</span>
                                        <span class="info-value">{{ user.phone || 'Chưa cập nhật' }}</span>
                                    </div>
                                </div>

                                <div class="info-item">
                                    <div class="info-icon">
                                        <i class="pi pi-calendar"></i>
                                    </div>
                                    <div class="info-content">
                                        <span class="info-label">Ngày tham gia</span>
                                        <span class="info-value">{{ formatDate(user.createdAt) }}</span>
                                    </div>
                                </div>

                                <div class="info-item">
                                    <div class="info-icon">
                                        <i class="pi pi-clock"></i>
                                    </div>
                                    <div class="info-content">
                                        <span class="info-label">Đăng nhập lần cuối</span>
                                        <span class="info-value">{{ formatDate(user.lastLogin) }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Thống kê nhanh với animation -->
                        <div class="stats-section">
                            <div class="stat-card">
                                <div class="stat-icon health">
                                    <i class="pi pi-heart-fill"></i>
                                </div>
                                <div class="stat-info">
                                    <span class="stat-value">{{ user.healthRecords || 0 }}</span>
                                    <span class="stat-label">Bản ghi sức khỏe</span>
                                </div>
                            </div>

                            <div class="stat-card">
                                <div class="stat-icon activity">
                                    <i class="pi pi-chart-line"></i>
                                </div>
                                <div class="stat-info">
                                    <span class="stat-value">{{ user.activityDays || 0 }}</span>
                                    <span class="stat-label">Ngày hoạt động</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer với buttons đẹp -->
                    <div class="modal-footer">
                        <button class="btn btn-secondary" @click="closeModal">
                            <i class="pi pi-times"></i>
                            Đóng
                        </button>
                        <router-link to="/profile/edit" class="btn btn-primary" @click="closeModal">
                            <i class="pi pi-pencil"></i>
                            Chỉnh sửa hồ sơ
                        </router-link>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
/* Modal Overlay với backdrop blur */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
    transition: opacity 0.3s ease;
}

/* Modal Container với shadow đẹp */
.modal-container {
    background: var(--surface-card, #ffffff);
    border-radius: 24px;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow: hidden;
    box-shadow:
        0 32px 64px -12px rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(255, 255, 255, 0.1);
    animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: center;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(30px) scale(0.9);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

/* Header với gradient đa sắc */
.modal-header {
    position: relative;
    padding: 2rem 1.5rem 1.5rem;
    text-align: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%);
    color: white;
    overflow: hidden;
}

.header-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    opacity: 0.6;
    animation: float 20s ease-in-out infinite;
}

@keyframes float {
    0%,
    100% {
        transform: translateY(0px) rotate(0deg);
    }
    50% {
        transform: translateY(-10px) rotate(180deg);
    }
}

.close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 2;
    backdrop-filter: blur(10px);
}

.close-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: rotate(180deg) scale(1.1);
}

/* Avatar với glow effect */
.avatar-wrapper {
    position: relative;
    display: inline-block;
    margin-bottom: 1rem;
}

.avatar {
    width: 110px;
    height: 110px;
    border-radius: 50%;
    border: 4px solid rgba(255, 255, 255, 0.9);
    box-shadow:
        0 12px 32px rgba(0, 0, 0, 0.3),
        0 0 0 2px rgba(255, 255, 255, 0.1);
    overflow: hidden;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    transition: transform 0.3s ease;
}

.avatar:hover {
    transform: scale(1.05);
}

.avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
}

.avatar:hover img {
    transform: scale(1.1);
}

.avatar-initials {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.2rem;
    font-weight: 800;
    color: white;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.status-badge {
    position: absolute;
    bottom: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 3px solid white;
    background: #95a5a6;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.status-badge.online {
    background: linear-gradient(135deg, #2ecc71, #27ae60);
    animation: pulse 2s infinite ease-in-out;
}

@keyframes pulse {
    0%,
    100% {
        box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.4);
        transform: scale(1);
    }
    50% {
        box-shadow: 0 0 0 8px rgba(46, 204, 113, 0);
        transform: scale(1.1);
    }
}

.user-name {
    margin: 0 0 0.5rem;
    font-size: 1.6rem;
    font-weight: 800;
    position: relative;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.user-role {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 24px;
    font-size: 0.9rem;
    font-weight: 600;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Body với smooth scroll */
.modal-body {
    padding: 1.5rem;
    max-height: 400px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--primary-color, #667eea) transparent;
}

.modal-body::-webkit-scrollbar {
    width: 6px;
}

.modal-body::-webkit-scrollbar-track {
    background: var(--surface-ground, #f8f9fa);
    border-radius: 3px;
}

.modal-body::-webkit-scrollbar-thumb {
    background: var(--primary-color, #667eea);
    border-radius: 3px;
}

.info-section {
    margin-bottom: 2rem;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 1.2rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-color, #333);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.section-title i {
    color: var(--primary-color, #667eea);
    font-size: 1.2rem;
}

.info-grid {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
}

.info-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.2rem;
    background: var(--surface-ground, #f8f9fa);
    border-radius: 16px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid var(--surface-border, #e9ecef);
}

.info-item:hover {
    background: var(--surface-hover, #e9ecef);
    transform: translateX(6px) scale(1.02);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.info-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.info-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
}

.info-label {
    font-size: 0.8rem;
    color: var(--text-color-secondary, #6c757d);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
}

.info-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-color, #333);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Stats Section với hover effects */
.stats-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.2rem;
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.2rem;
    background: var(--surface-ground, #f8f9fa);
    border-radius: 16px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid var(--surface-border, #e9ecef);
    cursor: pointer;
}

.stat-card:hover {
    transform: translateY(-4px) scale(1.03);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
}

.stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon.health {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
    color: white;
}

.stat-icon.activity {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    color: white;
}

.stat-info {
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: 1.8rem;
    font-weight: 800;
    color: var(--text-color, #333);
    line-height: 1;
}

.stat-label {
    font-size: 0.85rem;
    color: var(--text-color-secondary, #6c757d);
    margin-top: 6px;
    font-weight: 500;
}

/* Footer với gradient buttons */
.modal-footer {
    display: flex;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--surface-border, #e9ecef);
    background: var(--surface-ground, #fafbfc);
}

.btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0.9rem 1.5rem;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: none;
    position: relative;
    overflow: hidden;
}

.btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
}

.btn:hover::before {
    left: 100%;
}

.btn-secondary {
    background: var(--surface-ground, #f8f9fa);
    color: var(--text-color, #333);
    border: 2px solid var(--surface-border, #e9ecef);
}

.btn-secondary:hover {
    background: var(--surface-hover, #e9ecef);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
}

/* Transitions mượt mà */
.modal-enter-active,
.modal-leave-active {
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
    transform: translateY(30px) scale(0.9);
}

/* Focus states cho accessibility */
.close-btn:focus,
.btn:focus {
    outline: 2px solid var(--primary-color, #667eea);
    outline-offset: 2px;
}

/* Responsive tối ưu */
@media (max-width: 480px) {
    .modal-container {
        max-height: 95vh;
        border-radius: 20px;
        margin: 0.5rem;
    }

    .modal-header {
        padding: 1.5rem 1rem 1rem;
    }

    .avatar {
        width: 90px;
        height: 90px;
    }

    .user-name {
        font-size: 1.4rem;
    }

    .stats-section {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    .modal-footer {
        flex-direction: column;
        gap: 0.8rem;
    }

    .btn {
        padding: 1rem;
    }
}

@media (prefers-reduced-motion: reduce) {
    .modal-container,
    .avatar,
    .info-item,
    .stat-card,
    .btn,
    .close-btn,
    .status-badge {
        animation: none;
        transition: none;
    }

    .header-background {
        animation: none;
    }
}
</style>
