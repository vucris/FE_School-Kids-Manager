<script setup>
import { ref, computed, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import { useLayout } from '@/layout/composables/layout';
import { useAuthStore } from '@/stores/auth.js';
import NotificationBell from '@/components/NotificationBell.vue';
import ProfileModal from '@/components/ProfileModal.vue';

const { proxy } = getCurrentInstance();

const { toggleMenu, toggleDarkMode, isDarkTheme } = useLayout();
const auth = useAuthStore();

// State
const showProfileModal = ref(false);
const showUserMenu = ref(false);
const showSearchModal = ref(false);
const searchQuery = ref('');

// User info
const userInfo = computed(() => ({
    name: auth.user?.fullName || auth.user?.name || 'Admin',
    email: auth.user?.email || 'admin@ahlkids.vn',
    role: auth.user?.role || 'Quản trị viên',
    avatar: auth.user?.avatar || null
}));

// Get initials for avatar
function getInitials(name) {
    if (!name) return 'A';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
}

// Toggle functions
function openProfileModal() {
    showUserMenu.value = false;
    showProfileModal.value = true;
}

function closeProfileModal() {
    showProfileModal.value = false;
}

function toggleUserMenu() {
    showUserMenu.value = !showUserMenu.value;
}

function closeUserMenu() {
    showUserMenu.value = false;
}

// Search
function openSearch() {
    showSearchModal.value = true;
}

function closeSearch() {
    showSearchModal.value = false;
    searchQuery.value = '';
}

// Logout
async function onLogout() {
    showUserMenu.value = false;

    const result = await proxy.$swal.fire({
        title: 'Đăng xuất?',
        text: 'Bạn có chắc muốn đăng xuất khỏi hệ thống?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Đăng xuất',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        reverseButtons: true
    });

    if (!result.isConfirmed) return;

    try {
        await auth.logout();
        if (proxy?.$alertSuccess) {
            await proxy.$alertSuccess('Đăng xuất thành công!', 'Hẹn gặp lại bạn 👋');
        }
    } catch (error) {
        if (proxy?.$alertError) {
            proxy.$alertError('Đăng xuất thất bại', 'Vui lòng thử lại sau.');
        }
    } finally {
        window.location.assign('/auth/login');
    }
}

// Quick links
const quickLinks = [
    { label: 'Điểm danh', icon: 'fa-solid fa-clipboard-check', to: '/school/attendance/check-in' },
    { label: 'Học sinh', icon: 'fa-solid fa-user-graduate', to: '/school/Hoc-Sinh' },
    { label: 'Báo cáo', icon: 'fa-solid fa-chart-pie', to: '/school/report/attendance' }
];

// Click outside to close menu
function handleClickOutside(event) {
    const userMenuEl = document.querySelector('.user-dropdown');
    if (userMenuEl && !userMenuEl.contains(event.target)) {
        showUserMenu.value = false;
    }
}

// Add/remove event listener
onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});
onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
    <header class="topbar">
        <!-- Left Section -->
        <div class="topbar-left">
            <!-- Menu Toggle -->
            <button class="topbar-btn menu-toggle" @click="toggleMenu" title="Menu">
                <i class="fa-solid fa-bars"></i>
            </button>

            <!-- Logo -->
            <router-link to="/" class="topbar-brand">
                <div class="brand-logo">
                    <img src="@/assets/logo-vcnkids.jpg" alt="Logo" />
                </div>
                <div class="brand-text">
                    <span class="brand-name">AHL Kids School</span>
                    <span class="brand-tagline">Health Tracking</span>
                </div>
            </router-link>

            <!-- Breadcrumb / Page Title (Optional) -->
            <div class="topbar-divider"></div>

            <!-- Quick Links -->
            <nav class="quick-nav">
                <router-link
                    v-for="link in quickLinks"
                    :key="link.label"
                    :to="link.to"
                    class="quick-link"
                >
                    <i :class="link.icon"></i>
                    <span>{{ link.label }}</span>
                </router-link>
            </nav>
        </div>

        <!-- Right Section -->
        <div class="topbar-right">
            <!-- Search -->
            <button class="topbar-btn search-btn" @click="openSearch" title="Tìm kiếm (⌘K)">
                <i class="fa-solid fa-magnifying-glass"></i>
                <span class="search-text">Tìm kiếm...</span>
                <kbd>⌘K</kbd>
            </button>

            <!-- Dark Mode Toggle -->
            <button
                class="topbar-btn theme-toggle"
                @click="toggleDarkMode"
                :title="isDarkTheme ? 'Chế độ sáng' : 'Chế độ tối'"
            >
                <i :class="isDarkTheme ? 'fa-solid fa-sun' : 'fa-solid fa-moon'"></i>
            </button>

            <!-- Notifications -->
            <div class="notification-wrapper">
                <NotificationBell />
            </div>

            <!-- User Menu -->
            <div class="user-dropdown" @click.stop>
                <button class="user-trigger" @click="toggleUserMenu">
                    <div class="user-avatar">
                        <img
                            v-if="userInfo.avatar"
                            :src="userInfo.avatar"
                            :alt="userInfo.name"
                        />
                        <span v-else class="avatar-initials">{{ getInitials(userInfo.name) }}</span>
                        <span class="status-dot"></span>
                    </div>
                    <div class="user-info">
                        <span class="user-name">{{ userInfo.name }}</span>
                        <span class="user-role">{{ userInfo.role }}</span>
                    </div>
                    <i
                        class="fa-solid fa-chevron-down dropdown-arrow"
                        :class="{ rotate: showUserMenu }"
                    ></i>
                </button>

                <!-- Dropdown Menu -->
                <transition name="dropdown">
                    <div v-if="showUserMenu" class="dropdown-menu">
                        <div class="dropdown-header">
                            <div class="header-avatar">
                                <img
                                    v-if="userInfo.avatar"
                                    :src="userInfo.avatar"
                                    :alt="userInfo.name"
                                />
                                <span v-else class="avatar-initials large">
                                    {{ getInitials(userInfo.name) }}
                                </span>
                            </div>
                            <div class="header-info">
                                <span class="header-name">{{ userInfo.name }}</span>
                                <span class="header-email">{{ userInfo.email }}</span>
                            </div>
                        </div>

                        <div class="dropdown-divider"></div>

                        <div class="dropdown-body">
                            <button class="dropdown-item" @click="openProfileModal">
                                <i class="fa-solid fa-user"></i>
                                <span>Hồ sơ cá nhân</span>
                            </button>
                            <router-link
                                to="/school/settings"
                                class="dropdown-item"
                                @click="closeUserMenu"
                            >
                                <i class="fa-solid fa-gear"></i>
                                <span>Cài đặt</span>
                            </router-link>
                            <router-link
                                to="/help"
                                class="dropdown-item"
                                @click="closeUserMenu"
                            >
                                <i class="fa-solid fa-circle-question"></i>
                                <span>Trợ giúp</span>
                            </router-link>
                        </div>

                        <div class="dropdown-divider"></div>

                        <div class="dropdown-footer">
                            <button class="dropdown-item logout" @click="onLogout">
                                <i class="fa-solid fa-right-from-bracket"></i>
                                <span>Đăng xuất</span>
                            </button>
                        </div>
                    </div>
                </transition>
            </div>
        </div>
    </header>

    <!-- Search Modal -->
    <transition name="fade">
        <div v-if="showSearchModal" class="search-modal-overlay" @click="closeSearch">
            <div class="search-modal" @click.stop>
                <div class="search-input-wrapper">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Tìm kiếm học sinh, lớp học, menu..."
                        autofocus
                    />
                    <kbd @click="closeSearch">ESC</kbd>
                </div>
                <div class="search-results">
                    <div class="search-section">
                        <span class="section-label">Truy cập nhanh</span>
                        <router-link
                            to="/school/Hoc-Sinh"
                            class="search-item"
                            @click="closeSearch"
                        >
                            <i class="fa-solid fa-user-graduate"></i>
                            <span>Quản lý học sinh</span>
                        </router-link>
                        <router-link
                            to="/school/class"
                            class="search-item"
                            @click="closeSearch"
                        >
                            <i class="fa-solid fa-door-open"></i>
                            <span>Quản lý lớp học</span>
                        </router-link>
                        <router-link
                            to="/school/attendance/check-in"
                            class="search-item"
                            @click="closeSearch"
                        >
                            <i class="fa-solid fa-clipboard-check"></i>
                            <span>Điểm danh hôm nay</span>
                        </router-link>
                    </div>
                </div>
            </div>
        </div>
    </transition>

    <!-- Profile Modal -->
    <ProfileModal :visible="showProfileModal" @close="closeProfileModal" />
</template>

<style scoped>
/* ===== Variables ===== */
.topbar {
    --topbar-height: 64px;

    /* ===== Vue green theme ===== */
    --topbar-bg: #42b883;         /* xanh Vue */
    --topbar-border: #36a173;    /* xanh đậm hơn chút */
    --text-primary: #f9fafb;     /* chữ chính: gần trắng */
    --text-secondary: #e5f7f0;   /* chữ phụ */
    --text-muted: #bbf7d0;       /* chữ mờ */
    --accent: #35495e;           /* xanh đậm thương hiệu Vue */
    --accent-light: rgba(53, 73, 94, 0.2);
    --hover-bg: #36a173;         /* nền khi hover */
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.25);
}


/* ===== Base ===== */
.topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--topbar-height);
    background: var(--topbar-bg);
    border-bottom: 1px solid var(--topbar-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    z-index: 1000;
    box-shadow: var(--shadow);
}

/* ===== Left Section ===== */
.topbar-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.topbar-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    font-size: 1rem;
}

.topbar-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
}

.menu-toggle:hover {
    background: var(--accent-light);
    color: var(--accent);
}

/* Brand */
.topbar-brand {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    text-decoration: none;
    padding: 0.375rem 0.5rem;
    border-radius: 10px;
    transition: background 0.2s;
}

.topbar-brand:hover {
    background: var(--hover-bg);
}

.brand-logo {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
}

.brand-logo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
}

.brand-name {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--text-primary);
}

.brand-tagline {
    font-size: 0.6875rem;
    color: var(--text-muted);
}

/* Divider */
.topbar-divider {
    width: 1px;
    height: 24px;
    background: var(--topbar-border);
    margin: 0 0.5rem;
}

/* Quick Nav */
.quick-nav {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.quick-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    text-decoration: none;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 0.2s;
}

.quick-link:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
}

.quick-link i {
    font-size: 0.875rem;
}

/* ===== Right Section ===== */
.topbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

/* Search Button */
.search-btn {
    width: auto;
    padding: 0 0.875rem;
    gap: 0.5rem;
    background: var(--hover-bg);
    border: 1px solid var(--topbar-border);
}

.search-btn:hover {
    border-color: #e2e8f0;
}

.search-text {
    font-size: 0.8125rem;
    color: var(--text-muted);
}

.search-btn kbd {
    padding: 0.125rem 0.375rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    font-size: 0.625rem;
    color: var(--text-muted);
    font-family: inherit;
}

/* Theme Toggle */
.theme-toggle {
    font-size: 1.125rem;
}

.theme-toggle:hover {
    background: #fef3c7;
    color: #f59e0b;
}

/* Notification */
.notification-wrapper {
    position: relative;
}

/* ===== User Dropdown ===== */
.user-dropdown {
    position: relative;
}

.user-trigger {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.375rem;
    padding-right: 0.75rem;
    border-radius: 12px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;
}

.user-trigger:hover {
    background: var(--hover-bg);
    border-color: var(--topbar-border);
}

.user-avatar {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
}

.user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.avatar-initials {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #056c5d, #8b5cf6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.8125rem;
}

.avatar-initials.large {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    font-size: 1rem;
}

.status-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    background: #22c55e;
    border: 2px solid white;
    border-radius: 50%;
}

.user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.2;
}

.user-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
}

.user-role {
    font-size: 0.6875rem;
    color: var(--text-muted);
}

.dropdown-arrow {
    font-size: 0.625rem;
    color: var(--text-muted);
    transition: transform 0.2s;
}

.dropdown-arrow.rotate {
    transform: rotate(180deg);
}

/* Dropdown Menu */
.dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 280px;
    background: white;
    border: 1px solid var(--topbar-border);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    z-index: 1001;
}

.dropdown-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: linear-gradient(135deg, #f8fafc, #f1f5f9);
}

.header-avatar {
    flex-shrink: 0;
}

.header-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.header-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
}

.header-email {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.dropdown-divider {
    height: 1px;
    background: var(--topbar-border);
}

.dropdown-body,
.dropdown-footer {
    padding: 0.5rem;
}

.dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border-radius: 8px;
    border: none;
    background: none;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    text-decoration: none;
    cursor: pointer;
    transition: all 0.15s;
}

.dropdown-item:hover {
    background: var(--hover-bg);
}

.dropdown-item i {
    width: 18px;
    color: var(--text-secondary);
}

.dropdown-item.logout {
    color: #ef4444;
}

.dropdown-item.logout i {
    color: #ef4444;
}

.dropdown-item.logout:hover {
    background: #fef2f2;
}

/* ===== Search Modal ===== */
.search-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    z-index: 2000;
}

.search-modal {
    width: 560px;
    max-width: 90vw;
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
    overflow: hidden;
}

.search-input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--topbar-border);
}

.search-input-wrapper i {
    font-size: 1.125rem;
    color: var(--text-muted);
}

.search-input-wrapper input {
    flex: 1;
    border: none;
    background: none;
    font-size: 1rem;
    color: var(--text-primary);
    outline: none;
}

.search-input-wrapper input::placeholder {
    color: var(--text-muted);
}

.search-input-wrapper kbd {
    padding: 0.25rem 0.5rem;
    background: var(--hover-bg);
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.75rem;
    color: var(--text-muted);
    cursor: pointer;
}

.search-results {
    padding: 0.75rem;
    max-height: 400px;
    overflow-y: auto;
}

.search-section {
    margin-bottom: 0.5rem;
}

.section-label {
    display: block;
    padding: 0.5rem 0.75rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.search-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 10px;
    text-decoration: none;
    color: var(--text-primary);
    transition: background 0.15s;
}

.search-item:hover {
    background: var(--hover-bg);
}

.search-item i {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--accent-light);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
}

.search-item span {
    font-size: 0.875rem;
    font-weight: 500;
}

/* ===== Transitions ===== */
.dropdown-enter-active,
.dropdown-leave-active {
    transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
    opacity: 0;
    transform: translateY(-8px);
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* ===== Responsive ===== */
@media (max-width: 1024px) {
    .quick-nav {
        display: none;
    }

    .topbar-divider {
        display: none;
    }
}

@media (max-width: 768px) {
    .search-btn .search-text,
    .search-btn kbd {
        display: none;
    }

    .search-btn {
        width: 40px;
        padding: 0;
    }

    .user-info {
        display: none;
    }

    .user-trigger {
        padding-right: 0.375rem;
    }

    .dropdown-arrow {
        display: none;
    }

    .brand-text {
        display: none;
    }
}

@media (max-width: 480px) {
    .topbar {
        padding: 0 0.75rem;
    }

    .dropdown-menu {
        width: calc(100vw - 1.5rem);
        right: -0.75rem;
    }
}

/* ===== Dark Mode Support ===== */
@media (prefers-color-scheme: dark) {
    .topbar {
        --topbar-bg: #1e293b;
        --topbar-border: #334155;
        --text-primary: #f1f5f9;
        --text-secondary: #94a3b8;
        --text-muted: #64748b;
        --hover-bg: #334155;
        --accent-light: rgba(14, 158, 139, 0.2);
    }

    .dropdown-menu,
    .search-modal {
        background: #1e293b;
        border-color: #334155;
    }

    .dropdown-header {
        background: linear-gradient(135deg, #334155, #1e293b);
    }

    .search-input-wrapper kbd,
    .search-btn kbd {
        background: #334155;
        border-color: #475569;
    }
}
</style>
