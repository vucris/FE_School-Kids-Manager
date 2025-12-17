// src/router/index.js
import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { useLoadingBarStore } from '@/stores/loadingBar';
import { useAuthStore } from '@/stores/auth';
import { showNoPermissionToast } from '@/service/notify';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        // 🔹 KHỐI ADMIN (có AppLayout, có AppMenu, cần login)
        {
            path: '/',
            component: AppLayout,
            meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] },
            children: [
                {
                    path: '',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER', 'PARENT'] }
                },
                {
                    path: 'school/Trang-Chu',
                    name: 'TrangChu',
                    component: () => import('@/views/school/Trang-Chu.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/giao-Vien',
                    name: 'TeacherManagement',
                    component: () => import('@/views/school/Teacher.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN'] }
                },
                {
                    path: 'school/Hoc-Sinh',
                    name: 'QLHocSinh',
                    component: () => import('@/views/school/Students.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/class',
                    name: 'ClassManagement',
                    component: () => import('@/views/school/Class.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN'] }
                },
                {
                    path: 'school/parent',
                    name: 'parentManagement',
                    component: () => import('@/views/school/Parent.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/menu',
                    name: 'MenuFeature',
                    component: () => import('@/views/school/MenuWeekly.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/AttendanceBoard',
                    name: 'AttendanceBoard',
                    component: () => import('@/views/school/AttendanceCheckIn.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/album-manager',
                    name: 'AlbumManager',
                    component: () => import('@/views/school/AlbumManager.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/new-list',
                    name: 'newsList',
                    component: () => import('@/views/school/NewList.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/feedback-inbox',
                    name: 'feedbackInbox',
                    component: () => import('@/views/school/FeedbackInbox.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/healthrecord',
                    name: 'healthrecord',
                    component: () => import('@/views/school/HealthRecord.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/leaveRequest',
                    name: 'leaveRequest',
                    component: () => import('@/views/school/LeaveRequests.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/attendance/check-in',
                    name: 'AttendanceCheckIn',
                    component: () => import('@/views/school/AttendanceCheckIn.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/attendance/check-out',
                    name: 'AttendanceCheckOut',
                    component: () => import('@/views/school/AttendanceCheckOut.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/report/attendance',
                    name: 'ReportAttendance',
                    component: () => import('@/views/school/report/ReportAttendance.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                  {
                    path: 'school/report/student',
                    name: 'ReportStudent',
                    component: () => import('@/views/school/report/ReportStudent.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'school/finance/fee',
                    name: 'feeManagement',
                    component: () => import('@/views/school/FeeManagement.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN'] }
                },

                // ✅ ROUTE INFO TRONG ADMIN (có layout, cần login)
                {
                    path: 'school/info',
                    name: 'adminInfoSchool',
                    component: () => import('@/views/school/InfoSchool.vue'),
                    meta: { requiresAuth: true, roles: ['ADMIN', 'TEACHER'] }
                },
                {
                    path: 'teacher/my-students',
                    name: 'TeacherMyStudents',
                    component: () => import('@/views/pages/teacher/MyClassStudents.vue'),
                    meta: { requiresAuth: true, roles: ['TEACHER', 'ADMIN'] }
                }
            ]
        },

        // ✅ ROUTE PUBLIC: KHÔNG cần login, KHÔNG có AppLayout/AppMenu
        {
            path: '/trang-chu',
            name: 'publicInfoSchool',
            component: () => import('@/views/school/InfoSchool.vue')
            // không meta.requiresAuth
        },

        {
            path: '/landing',
            name: 'landing',
            component: () => import('@/views/pages/Landing.vue')
        },
        {
            path: '/pages/notfound',
            name: 'notfound',
            component: () => import('@/views/pages/NotFound.vue')
        },
        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue'),
            meta: { guestOnly: true }
        },
        {
            path: '/forgot-password',
            name: 'ForgotPassword',
            component: () => import('@/views/pages/auth/ForgotPassword.vue')
        },

        {
            path: '/auth/access',
            name: 'accessDenied',
            component: () => import('@/views/pages/auth/Access.vue')
        },
        {
            path: '/auth/error',
            name: 'error',
            component: () => import('@/views/pages/auth/Error.vue')
        },
        { path: '/:pathMatch(.*)*', redirect: { name: 'notfound' } }
    ]
});

router.beforeEach((to, from, next) => {
    const loadingBar = useLoadingBarStore();
    loadingBar.start();

    const auth = useAuthStore();

    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);

    // 🔒 Chỉ chặn những route có requiresAuth = true
    if (requiresAuth && !auth.isAuthenticated) {
        return next({ name: 'login', query: { redirect: to.fullPath } });
    }

    if (to.meta.guestOnly && auth.isAuthenticated) {
        loadingBar.stop();
        return next({ name: 'dashboard' });
    }

    if (to.meta.roles && to.meta.roles.length > 0) {
        const currentRole = (auth.role || auth.user?.role || '').toUpperCase();
        const allowedRoles = to.meta.roles.map((r) => r.toUpperCase());

        if (!currentRole || !allowedRoles.includes(currentRole)) {
            showNoPermissionToast();
            loadingBar.stop();
            return next(false);
        }
    }

    next();
});

router.afterEach(() => {
    const loadingBar = useLoadingBarStore();
    loadingBar.stop();
});

export default router;
