<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

// State
const searchQuery = ref('');
const isCollapsed = ref(false);

// Menu data
const menuSections = ref([
    {
        id: 'main',
        items: [
            {
                id: 'dashboard',
                label: 'Trang chủ',
                icon: 'fa-solid fa-home',
                to: '/school/Trang-Chu',
                color: '#6366f1'
            },
            {
                id: 'school-info',
                label: 'Thông tin trường',
                icon: 'fa-solid fa-school-flag',
                to: { name: 'adminInfoSchool' },
                color: '#8b5cf6'
            }
        ]
    },
    {
        id: 'management',
        label: 'Quản lý',
        items: [
            {
                id: 'classes',
                label: 'Lớp học',
                icon: 'fa-solid fa-door-open',
                to: '/school/class',
                color: '#f59e0b'
            },
            {
                id: 'teachers',
                label: 'Giáo viên',
                icon: 'fa-solid fa-person-chalkboard',
                to: '/school/giao-Vien',
                color: '#10b981'
            },
            {
                id: 'students',
                label: 'Học sinh',
                icon: 'fa-solid fa-children',
                to: '/school/Hoc-Sinh',
                color: '#3b82f6'
            },
            {
                id: 'parents',
                label: 'Phụ huynh',
                icon: 'fa-solid fa-people-roof',
                to: '/school/parent',
                color: '#ec4899'
            }
        ]
    },
    {
        id: 'activities',
        label: 'Hoạt động',
        items: [
            {
                id: 'attendance',
                label: 'Điểm danh',
                icon: 'fa-solid fa-clipboard-user',
                to: '/school/attendance/check-in',
                color: '#14b8a6'
            },
            {
                id: 'menu',
                label: 'Thực đơn',
                icon: 'fa-solid fa-bowl-food',
                to: '/school/menu',
                color: '#f97316'
            },
            {
                id: 'leave',
                label: 'Đơn xin nghỉ',
                icon: 'fa-solid fa-calendar-xmark',
                to: '/school/leaveRequest',
                color: '#ef4444',
                badge: 3
            },
            {
                id: 'health',
                label: 'Y tế',
                icon: 'fa-solid fa-heart-pulse',
                to: '/school/healthrecord',
                color: '#f43f5e'
            }
        ]
    },
    {
        id: 'content',
        label: 'Nội dung',
        items: [
            {
                id: 'albums',
                label: 'Album ảnh',
                icon: 'fa-solid fa-images',
                to: '/school/album-manager',
                color: '#a855f7'
            },
            {
                id: 'posts',
                label: 'Bài viết',
                icon: 'fa-solid fa-newspaper',
                to: '/school/new-list',
                color: '#6366f1'
            },
            {
                id: 'feedback',
                label: 'Góp ý',
                icon: 'fa-solid fa-comment-dots',
                to: '/school/feedback-inbox',
                color: '#0ea5e9',
                badge: 5
            }
        ]
    },
    {
        id: 'finance',
        label: 'Tài chính',
        items: [
            {
                id: 'fees',
                label: 'Học phí',
                icon: 'fa-solid fa-receipt',
                to: '/school/finance/fee',
                color: '#22c55e'
            }
        ]
    },
    {
        id: 'reports',
        label: 'Báo cáo',
        items: [
            {
                id: 'report-attendance',
                label: 'BC Điểm danh',
                icon: 'fa-solid fa-chart-simple',
                to: '/school/report/attendance',
                color: '#6366f1'
            },
            {
                id: 'report-quit',
                label: 'BC Tình Trạng Học Sinh',
                icon: 'fa-solid fa-chart-line',
                to: '/school/report/student',
                color: '#f59e0b'
            },
        
            {
                id: 'logs',
                label: 'Nhật ký',
                icon: 'fa-solid fa-clock-rotate-left',
                to: '/reports/logs',
                color: '#64748b'
            }
        ]
    }
]);

// Check active
function isActive(item) {
    if (!item.to) return false;
    const path = typeof item.to === 'string' ? item.to : item.to.path || '';
    const name = typeof item.to === 'object' ? item.to.name : '';
    return route.path === path || route.name === name;
}

// Filter menu by search
const filteredSections = computed(() => {
    if (!searchQuery.value.trim()) return menuSections.value;

    const query = searchQuery.value.toLowerCase();
    return menuSections.value
        .map((section) => ({
            ...section,
            items: section.items.filter((item) => item.label.toLowerCase().includes(query))
        }))
        .filter((section) => section.items.length > 0);
});

// Quick actions
const quickActions = [
    {
        icon: 'fa-solid fa-plus',
        label: 'Thêm học sinh',
        action: () => router.push('/school/Hoc-Sinh')
    },
    {
        icon: 'fa-solid fa-clipboard-check',
        label: 'Điểm danh',
        action: () => router.push('/school/attendance/check-in')
    },
    { icon: 'fa-solid fa-bell', label: 'Thông báo', action: () => {} }
];
</script>

<template>
    <aside class="sidebar" :class="{ collapsed: isCollapsed }">
        <!-- Header -->
        <div class="sidebar-header">
            <div class="logo">
                <div class="logo-icon">
                    <span>VK</span>
                </div>
                <div v-show="!isCollapsed" class="logo-text">
                    <h1>ALH Kids School</h1>
                    <span>Quản trị hệ thống</span>
                </div>
            </div>
            <button class="collapse-btn" @click="isCollapsed = !isCollapsed">
                <i :class="isCollapsed ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left'"></i>
            </button>
        </div>

        <!-- Search -->
        <div v-show="!isCollapsed" class="sidebar-search">
            <div class="search-box">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input v-model="searchQuery" type="text" placeholder="Tìm kiếm menu..." />
                <kbd v-if="!searchQuery">⌘K</kbd>
            </div>
        </div>

        <!-- Quick Actions -->
        <div v-show="!isCollapsed" class="quick-actions">
            <button v-for="action in quickActions" :key="action.label" class="quick-btn" :title="action.label" @click="action.action">
                <i :class="action.icon"></i>
            </button>
        </div>

        <!-- Menu -->
        <nav class="sidebar-nav">
            <div v-for="section in filteredSections" :key="section.id" class="nav-section">
                <div v-if="section.label && !isCollapsed" class="section-label">
                    {{ section.label }}
                </div>
                <div v-else-if="section.label && isCollapsed" class="section-divider"></div>

                <ul class="nav-list">
                    <li v-for="item in section.items" :key="item.id">
                        <router-link :to="item.to" class="nav-item" :class="{ active: isActive(item) }" :title="isCollapsed ? item.label : ''">
                            <span
                                class="nav-icon"
                                :style="{
                                    '--icon-color': item.color,
                                    '--icon-bg': item.color + '15'
                                }"
                            >
                                <i :class="item.icon"></i>
                            </span>
                            <span v-show="!isCollapsed" class="nav-label">
                                {{ item.label }}
                            </span>
                            <span v-if="item.badge && !isCollapsed" class="nav-badge">
                                {{ item.badge }}
                            </span>
                            <span v-if="item.badge && isCollapsed" class="nav-badge-dot"></span>
                        </router-link>
                    </li>
                </ul>
            </div>
        </nav>

        <!-- Footer -->
        <div class="sidebar-footer">
            <router-link to="/school/settings" class="footer-btn" :title="isCollapsed ? 'Cài đặt' : ''">
                <i class="fa-solid fa-gear"></i>
                <span v-show="!isCollapsed">Cài đặt</span>
            </router-link>

            <div v-show="!isCollapsed" class="user-card">
                <div class="user-avatar">
                    <img src="https://ui-avatars.com/api/?name=Admin&background=6366f1&color=fff" alt="Admin" />
                    <span class="user-status"></span>
                </div>
                <div class="user-info">
                    <span class="user-name">Admin</span>
                    <span class="user-email">admin@ahtkids.vn</span>
                </div>
                <button class="logout-btn" title="Đăng xuất">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                </button>
            </div>

            <button v-show="isCollapsed" class="footer-btn logout" title="Đăng xuất">
                <i class="fa-solid fa-arrow-right-from-bracket"></i>
            </button>
        </div>
    </aside>
</template>

<style scoped>
/* ===== Variables ===== */
.sidebar {
    --sidebar-width: 260px;
    --sidebar-collapsed: 72px;
    --sidebar-bg: #ffffff;
    --sidebar-border: #f1f5f9;
    --text-primary: #1e293b;
    --text-secondary: #64748b;
    --text-muted: #94a3b8;
    --hover-bg: #f8fafc;
    --active-bg: #f1f5f9;
    --accent: #6366f1;
    --accent-light: #eef2ff;
}

/* ===== Base ===== */
.sidebar {
    width: var(--sidebar-width);
    height: 100vh;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--sidebar-border);
    display: flex;
    flex-direction: column;
    position: fixed;
    left: 0;
    top: 0;
    z-index: 100;
    transition: width 0.2s ease;
}

.sidebar.collapsed {
    width: var(--sidebar-collapsed);
}

/* ===== Header ===== */
.sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--sidebar-border);
}

.logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.logo-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.logo-icon span {
    color: white;
    font-weight: 700;
    font-size: 0.875rem;
}

.logo-text h1 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.2;
}

.logo-text span {
    font-size: 0.6875rem;
    color: var(--text-muted);
}

.collapse-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: var(--hover-bg);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.collapse-btn:hover {
    background: var(--active-bg);
    color: var(--accent);
}

/* ===== Search ===== */
.sidebar-search {
    padding: 0.75rem 1rem;
}

.search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    transition: all 0.2s;
}

.search-box:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.search-box i {
    color: var(--text-muted);
    font-size: 0.8125rem;
}

.search-box input {
    flex: 1;
    border: none;
    background: none;
    font-size: 0.8125rem;
    color: var(--text-primary);
    outline: none;
}

.search-box input::placeholder {
    color: var(--text-muted);
}

.search-box kbd {
    padding: 0.125rem 0.375rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    font-size: 0.625rem;
    color: var(--text-muted);
    font-family: inherit;
}

/* ===== Quick Actions ===== */
.quick-actions {
    display: flex;
    gap: 0.375rem;
    padding: 0 1rem 0.75rem;
}

.quick-btn {
    flex: 1;
    height: 36px;
    border: 1px dashed #e2e8f0;
    border-radius: 8px;
    background: white;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.quick-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: var(--accent-light);
    border-style: solid;
}

/* ===== Navigation ===== */
.sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
}

.sidebar-nav::-webkit-scrollbar {
    width: 4px;
}

.sidebar-nav::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 4px;
}

.nav-section {
    margin-bottom: 0.5rem;
}

.section-label {
    padding: 0.5rem 0.75rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.section-divider {
    height: 1px;
    background: var(--sidebar-border);
    margin: 0.5rem 0.75rem;
}

.nav-list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    border-radius: 8px;
    text-decoration: none;
    transition: all 0.15s;
    position: relative;
}

.nav-item:hover {
    background: var(--hover-bg);
}

.nav-item.active {
    background: var(--accent-light);
}

.nav-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 20px;
    background: var(--accent);
    border-radius: 0 3px 3px 0;
}

.nav-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--icon-bg);
    color: var(--icon-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    flex-shrink: 0;
    transition: transform 0.2s;
}

.nav-item:hover .nav-icon {
    transform: scale(1.05);
}

.nav-item.active .nav-icon {
    background: var(--icon-color);
    color: white;
}

.nav-label {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.nav-item.active .nav-label {
    font-weight: 600;
    color: var(--accent);
}

.nav-badge {
    padding: 0.125rem 0.5rem;
    background: #ef4444;
    color: white;
    font-size: 0.6875rem;
    font-weight: 600;
    border-radius: 10px;
    min-width: 20px;
    text-align: center;
}

.nav-badge-dot {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    border: 2px solid white;
}

/* ===== Footer ===== */
.sidebar-footer {
    padding: 0.75rem;
    border-top: 1px solid var(--sidebar-border);
}

.footer-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border-radius: 8px;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s;
    margin-bottom: 0.5rem;
}

.footer-btn:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
}

.footer-btn.logout:hover {
    background: #fef2f2;
    color: #ef4444;
}

.user-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 10px;
}

.user-avatar {
    position: relative;
    flex-shrink: 0;
}

.user-avatar img {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    object-fit: cover;
}

.user-status {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 10px;
    height: 10px;
    background: #22c55e;
    border-radius: 50%;
    border: 2px solid white;
}

.user-info {
    flex: 1;
    min-width: 0;
}

.user-name {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.2;
}

.user-email {
    display: block;
    font-size: 0.6875rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.logout-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: white;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.logout-btn:hover {
    background: #fef2f2;
    color: #ef4444;
}

/* ===== Collapsed State ===== */
.sidebar.collapsed .sidebar-header {
    padding: 1rem 0.75rem;
    justify-content: center;
}

.sidebar.collapsed .logo-icon {
    width: 36px;
    height: 36px;
}

.sidebar.collapsed .collapse-btn {
    position: absolute;
    right: -14px;
    background: white;
    border: 1px solid var(--sidebar-border);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.sidebar.collapsed .nav-item {
    justify-content: center;
    padding: 0.625rem;
}

.sidebar.collapsed .nav-item.active::before {
    left: 4px;
    width: 2px;
    height: 16px;
}

.sidebar.collapsed .footer-btn {
    justify-content: center;
}

.sidebar.collapsed .user-card {
    display: none;
}

/* ===== Hover tooltip for collapsed ===== */
.sidebar.collapsed .nav-item:hover::after {
    content: attr(title);
    position: absolute;
    left: calc(100% + 12px);
    top: 50%;
    transform: translateY(-50%);
    padding: 0.5rem 0.75rem;
    background: var(--text-primary);
    color: white;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 6px;
    white-space: nowrap;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.sidebar.collapsed .nav-item:hover::before {
    content: '';
    position: absolute;
    left: calc(100% + 6px);
    top: 50%;
    transform: translateY(-50%);
    border: 6px solid transparent;
    border-right-color: var(--text-primary);
}

.sidebar.collapsed .nav-item.active:hover::before {
    border-right-color: var(--text-primary);
}
</style>
