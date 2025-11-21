import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { useLoadingBarStore } from '@/stores/loadingBar';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: AppLayout,
            meta: { requiresAuth: true },
            children: [
                {
                    path: '',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue')
                },
                {
                    path: 'school/Trang-Chu',
                    name: 'TrangChu',
                    component: () => import('@/views/school/Trang-Chu.vue')
                },
                {
                    path: 'school/giao-Vien',
                    name: 'TeacherManagement',
                    component: () => import('@/views/school/Giao-Vien.vue')
                },
                {
                    path: 'school/Hoc-Sinh',
                    name: 'QLHocSinh',
                    component: () => import('@/views/school/Hoc-Sinh.vue')
                },
                {
                    path: 'school/class',
                    name: 'ClassManagement',
                    component: () => import('@/views/school/class.vue')
                },
                {
                    path: 'school/parent',
                    name: 'parentManagement',
                    component: () => import('@/views/school/phu-Huynh.vue')
                },
                {
                    path: 'school/menu',
                    name: 'MenuFeature',
                    component: () => import('@/views/school/MenuWeekly.vue')
                },
                {
                    path: 'school/AttendanceBoard',
                    name: 'AttendanceBoard',
                    component: () => import('@/views/school/AttendanceCheckIn.vue')
                },
                {
                    path: 'school/album-manager',
                    name: 'AlbumManager',
                    component: () => import('@/views/school/AlbumManager.vue')
                },
                {
                    path: 'school/new-list',
                    name: 'newsList',
                    component: () => import('@/views/school/NewList.vue')
                },
                {
                    path: 'school/feedback-inbox',
                    name: 'feedbackInbox',
                    component: () => import('@/views/school/FeedbackInbox.vue')
                },
                {
                    path: 'school/healthrecord',
                    name: 'healthrecord',
                    component: () => import('@/views/school/HealthRecord.vue')
                },
                {
                    path: 'school/leaveRequest',
                    name: 'leaveRequest',
                    component: () => import('@/views/school/LeaveRequests.vue')
                },
                {
                    path: 'school/attendance/check-in',
                    name: 'AttendanceCheckIn',
                    component: () => import('@/views/school/AttendanceCheckIn.vue')
                },
                {
                    path: 'school/attendance/check-out',
                    name: 'AttendanceCheckOut',
                    component: () => import('@/views/school/AttendanceCheckOut.vue')
                }
            ]
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
    next();
});

router.afterEach(() => {
    const loadingBar = useLoadingBarStore();
    loadingBar.stop();
});

export default router;
