<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import '@fortawesome/fontawesome-free/css/all.min.css';

/* ===== HERO SLIDER ===== */
const heroImages = [
    'https://images.pexels.com/photos/8613086/pexels-photo-8613086.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'https://images.pexels.com/photos/8612925/pexels-photo-8612925.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'https://images.pexels.com/photos/8617981/pexels-photo-8617981.jpeg?auto=compress&cs=tinysrgb&w=1600'
];
const currentHeroIndex = ref(0);

/* ===== GALLERY ===== */
const galleryImages = [
    'https://images.pexels.com/photos/8613086/pexels-photo-8613086.jpeg?auto=compress&cs=tinysrgb&w=1200',
    'https://images.pexels.com/photos/8617981/pexels-photo-8617981.jpeg?auto=compress&cs=tinysrgb&w=1200',
    'https://images.pexels.com/photos/8422157/pexels-photo-8422157.jpeg?auto=compress&cs=tinysrgb&w=1200',
    'https://images.pexels.com/photos/8422205/pexels-photo-8422205.jpeg?auto=compress&cs=tinysrgb&w=1200'
];
const currentGalleryIndex = ref(0);

/* ===== APP SCREENSHOTS (DEMO) ===== */
const appScreenshots = [
    'https://images.pexels.com/photos/3974414/pexels-photo-3974414.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/5053763/pexels-photo-5053763.jpeg?auto=compress&cs=tinysrgb&w=800',
    'https://images.pexels.com/photos/3974416/pexels-photo-3974416.jpeg?auto=compress&cs=tinysrgb&w=800'
];
const currentAppScreenshot = ref(0);

/* ===== SCHOOL INFO ===== */
const school = ref({
    name: 'Trường Mầm non AI Health Tracking',
    code: 'MN-AIHT-001',
    slogan: 'Đồng hành cùng sức khỏe và cảm xúc của từng bé',
    type: 'Mầm non song ngữ / chuẩn quốc tế',
    level: 'Tư thục',
    establishedYear: 2020,
    owner: 'Công ty Cổ phần AI Health Tracking Kids',
    principal: 'Cô Nguyễn Thị Thu Trang',
    vicePrincipal: 'Thầy Trương Đức',
    taxCode: '0312 999 888',
    website: 'https://aihealthtracking.edu.vn',
    email: 'contact@aihealthtracking.edu.vn',
    hotline: '0909 123 456',
    phone: '028 3 888 999',
    zalo: '0909 123 456',
    address: {
        line1: 'Số 123, đường Hoa Phượng',
        line2: 'Phường 7, Quận Phú Nhuận',
        city: 'TP. Hồ Chí Minh',
        country: 'Việt Nam'
    },
    operation: {
        openTime: '07:00',
        closeTime: '17:30',
        days: 'Thứ Hai - Thứ Sáu (có dịch vụ trông Thứ Bảy)',
        ages: 'Từ 18 tháng đến 6 tuổi',
        schoolYear: 'Năm học 2024 - 2025'
    },
    stats: {
        campus: 1,
        classes: 12,
        students: 280,
        teachers: 35,
        staff: 10
    },
    vision: 'Xây dựng môi trường mầm non an toàn, hạnh phúc, cá nhân hoá, nơi mỗi đứa trẻ được theo dõi sức khỏe toàn diện, phát triển cảm xúc – trí tuệ – thể chất với sự hỗ trợ của công nghệ AI.',
    mission: [
        'Theo dõi sức khỏe – dinh dưỡng – cảm xúc của trẻ theo thời gian thực, kết nối chặt chẽ với phụ huynh.',
        'Tạo môi trường học tập chủ động, khuyến khích khám phá và tôn trọng sự khác biệt của từng bé.',
        'Ứng dụng công nghệ AI & dữ liệu để hỗ trợ giáo viên và nhà trường trong quản lý, dự báo và ra quyết định.',
        'Xây dựng hệ sinh thái “Nhà trường – Gia đình – Công nghệ” minh bạch, tin cậy.'
    ],
    coreValues: [
        {
            key: 'A',
            title: 'AI – An toàn & Công nghệ',
            desc: 'Mọi hoạt động đều đặt yếu tố an toàn của trẻ lên hàng đầu, có sự hỗ trợ của công nghệ.'
        },
        {
            key: 'I',
            title: 'Insight – Thấu hiểu',
            desc: 'Theo dõi sự phát triển của từng bé, tôn trọng cá tính riêng.'
        },
        {
            key: 'C',
            title: 'Care – Chăm sóc toàn diện',
            desc: 'Kết hợp dinh dưỡng, sức khỏe, vận động và kỹ năng sống.'
        },
        {
            key: 'L',
            title: 'Love – Yêu thương & Tôn trọng',
            desc: 'Không gian đầy yêu thương, nơi trẻ được lắng nghe.'
        },
        {
            key: 'K',
            title: 'Kids First – Trẻ là trung tâm',
            desc: 'Mọi quyết định dựa trên lợi ích lâu dài của trẻ.'
        }
    ],
    programs: [
        {
            name: 'Nhóm Trẻ (18 – 36 tháng)',
            icon: 'fa-solid fa-baby',
            focus: 'Làm quen trường lớp, kỹ năng tự phục vụ đơn giản, phát triển giác quan và vận động thô.',
            note: 'Theo dõi sát sao giấc ngủ, ăn uống và sức khỏe hàng ngày.'
        },
        {
            name: 'Mầm / Chồi (3 – 4 tuổi)',
            icon: 'fa-solid fa-puzzle-piece',
            focus: 'Hình thành thói quen tốt, giao tiếp cơ bản, nhận biết cảm xúc.',
            note: 'Ghi nhận hành vi, tương tác của trẻ trong ngày để phụ huynh nắm bắt kịp thời.'
        },
        {
            name: 'Lá (5 – 6 tuổi – Tiền tiểu học)',
            icon: 'fa-solid fa-graduation-cap',
            focus: 'Rèn nề nếp, khả năng tập trung, kỹ năng làm việc nhóm, chuẩn bị kiến thức nền cho lớp 1.',
            note: 'Báo cáo định kỳ về sự sẵn sàng vào lớp 1 của từng bé.'
        }
    ]
});

/* ===== DERIVED DATA ===== */
const yearsOfExperience = computed(() => {
    return new Date().getFullYear() - school.value.establishedYear;
});

const statsData = computed(() => [
    {
        icon: 'fa-solid fa-children',
        displayValue: `${school.value.stats.students}+`,
        label: 'Học sinh',
        sublabel: 'Đang theo học',
        bgClass: 'bg-gradient-to-br from-blue-500 to-indigo-600'
    },
    {
        icon: 'fa-solid fa-chalkboard-teacher',
        displayValue: `${school.value.stats.teachers}+`,
        label: 'Giáo viên',
        sublabel: 'Giàu kinh nghiệm',
        bgClass: 'bg-gradient-to-br from-emerald-500 to-teal-600'
    },
    {
        icon: 'fa-solid fa-school',
        displayValue: `${school.value.stats.classes}`,
        label: 'Lớp học',
        sublabel: 'Theo độ tuổi',
        bgClass: 'bg-gradient-to-br from-amber-500 to-orange-600'
    },
    {
        icon: 'fa-solid fa-award',
        displayValue: `${yearsOfExperience.value}+`,
        label: 'Năm',
        sublabel: 'Kinh nghiệm',
        bgClass: 'bg-gradient-to-br from-rose-500 to-pink-600'
    }
]);

const aboutFeatures = [
    {
        icon: 'fa-solid fa-shield-heart',
        iconBg: 'bg-blue-100 text-blue-600',
        title: 'An toàn tuyệt đối',
        desc: 'Giám sát trẻ và ra vào trường học rõ ràng, minh bạch.'
    },
    {
        icon: 'fa-solid fa-brain',
        iconBg: 'bg-purple-100 text-purple-600',
        title: 'AI thông minh',
        desc: 'Theo dõi sức khỏe & cảnh báo sớm các bất thường.'
    },
    {
        icon: 'fa-solid fa-heart',
        iconBg: 'bg-rose-100 text-rose-600',
        title: 'Yêu thương',
        desc: 'Môi trường thân thiện, tôn trọng cảm xúc trẻ.'
    },
    {
        icon: 'fa-solid fa-users',
        iconBg: 'bg-emerald-100 text-emerald-600',
        title: 'Kết nối',
        desc: 'Kết nối chặt chẽ giữa Gia đình – Nhà trường.'
    }
];

const facilitiesData = computed(() => [
    {
        icon: 'fa-solid fa-door-open',
        iconBg: 'bg-blue-100 text-blue-600',
        title: 'Phòng học hiện đại',
        desc: 'Thoáng mát, đầy đủ ánh sáng, bố trí phù hợp trẻ nhỏ.'
    },
    {
        icon: 'fa-solid fa-video',
        iconBg: 'bg-purple-100 text-purple-600',
        title: 'Camera giám sát',
        desc: 'Theo dõi an toàn các khu vực chung (theo quy định).'
    },
    {
        icon: 'fa-solid fa-tree',
        iconBg: 'bg-emerald-100 text-emerald-600',
        title: 'Sân chơi ngoài trời',
        desc: 'Khu vận động thể chất, cát – nước – trò chơi khám phá.'
    },
    {
        icon: 'fa-solid fa-music',
        iconBg: 'bg-amber-100 text-amber-600',
        title: 'Phòng chức năng',
        desc: 'Âm nhạc, Mỹ thuật, Thư viện, kỹ năng sống.'
    },
    {
        icon: 'fa-solid fa-utensils',
        iconBg: 'bg-rose-100 text-rose-600',
        title: 'Bếp ăn 1 chiều',
        desc: 'Thực đơn do chuyên gia dinh dưỡng xây dựng.'
    },
    {
        icon: 'fa-solid fa-heart-pulse',
        iconBg: 'bg-cyan-100 text-cyan-600',
        title: 'AI Health Tracking',
        desc: 'Theo dõi sức khỏe & phát triển của bé trên hệ thống.'
    }
]);

/* ===== APP FEATURES ===== */
const appFeatures = [
    {
        icon: 'fa-solid fa-heart-pulse',
        iconBg: 'bg-rose-500/20 text-rose-200',
        title: 'Theo dõi sức khỏe',
        desc: 'Nhiệt độ, biểu hiện, lịch sử bệnh của bé.'
    },
    {
        icon: 'fa-solid fa-utensils',
        iconBg: 'bg-amber-500/20 text-amber-200',
        title: 'Thực đơn dinh dưỡng',
        desc: 'Xem món ăn, khẩu phần và lượng ăn hàng ngày.'
    },
    {
        icon: 'fa-solid fa-camera',
        iconBg: 'bg-purple-500/20 text-purple-200',
        title: 'Album hoạt động',
        desc: 'Ảnh & video hoạt động trong ngày của con.'
    },
    {
        icon: 'fa-solid fa-bell',
        iconBg: 'bg-cyan-500/20 text-cyan-200',
        title: 'Thông báo tức thì',
        desc: 'Tin nhắn từ giáo viên và nhà trường.'
    },
    {
        icon: 'fa-solid fa-calendar-check',
        iconBg: 'bg-emerald-500/20 text-emerald-200',
        title: 'Điểm danh online',
        desc: 'Lịch sử đến lớp, nghỉ phép của bé.'
    },
    {
        icon: 'fa-solid fa-chart-line',
        iconBg: 'bg-blue-500/20 text-blue-200',
        title: 'Báo cáo phát triển',
        desc: 'Biểu đồ chiều cao, cân nặng, kỹ năng.'
    }
];

/* ===== INTERVALS ===== */
let heroInterval;
let appScreenshotInterval;

onMounted(() => {
    heroInterval = setInterval(() => {
        currentHeroIndex.value = (currentHeroIndex.value + 1) % heroImages.length;
    }, 6000);

    appScreenshotInterval = setInterval(() => {
        currentAppScreenshot.value = (currentAppScreenshot.value + 1) % appScreenshots.length;
    }, 4000);
});

onUnmounted(() => {
    clearInterval(heroInterval);
    clearInterval(appScreenshotInterval);
});

/* ===== METHODS ===== */
const prevGallery = () => {
    currentGalleryIndex.value = currentGalleryIndex.value === 0 ? galleryImages.length - 1 : currentGalleryIndex.value - 1;
};

const nextGallery = () => {
    currentGalleryIndex.value = (currentGalleryIndex.value + 1) % galleryImages.length;
};

const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    }
};

const getValueColorClass = (idx) => {
    const colors = ['value-blue', 'value-purple', 'value-emerald', 'value-rose', 'value-amber'];
    return colors[idx % colors.length];
};

const getProgramColor = (idx) => {
    const colors = ['bg-gradient-to-br from-pink-500 to-rose-600', 'bg-gradient-to-br from-sky-500 to-blue-600', 'bg-gradient-to-br from-emerald-500 to-teal-600'];
    return colors[idx % colors.length];
};

const getProgramBadgeColor = (idx) => {
    const colors = ['bg-pink-100 text-pink-700', 'bg-sky-100 text-sky-700', 'bg-emerald-100 text-emerald-700'];
    return colors[idx % colors.length];
};
</script>

<template>
    <div class="school-info-page min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/60">
        <!-- HERO SECTION -->
        <section class="relative h-[520px] md:h-[580px] overflow-hidden">
            <!-- Background slider -->
            <div class="absolute inset-0">
                <img :src="heroImages[currentHeroIndex]" alt="Trường mầm non" class="w-full h-full object-cover transition-opacity duration-700" />
                <div class="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-indigo-900/75 to-purple-900/65"></div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
            </div>

            <!-- Floating blobs -->
            <div class="absolute inset-0 overflow-hidden pointer-events-none">
                <div class="floating-blob blob-1"></div>
                <div class="floating-blob blob-2"></div>
                <div class="floating-blob blob-3"></div>
            </div>

            <!-- Content -->
            <div class="relative h-full flex items-center">
                <div class="container mx-auto px-6 lg:px-10">
                    <div class="flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
                        <!-- Left side -->
                        <div class="flex-1 text-white space-y-6 text-center lg:text-left">
                            <div class="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-full px-5 py-2 border border-white/20">
                                <div class="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                                    <i class="fa-solid fa-shield-heart text-white text-sm"></i>
                                </div>
                                <span class="text-sm font-medium tracking-wide"> Hệ thống quản lý mầm non thông minh • AI Health Tracking </span>
                            </div>

                            <h1 class="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-[#ffffff]">
                                {{ school.name }}
                            </h1>

                            <p class="text-base md:text-xl text-blue-100/90 max-w-2xl leading-relaxed mx-auto lg:mx-0">
                                {{ school.slogan }}
                            </p>

                            <!-- Quick stats -->
                            <div class="flex flex-wrap justify-center lg:justify-start gap-3 pt-3">
                                <div class="hero-pill">
                                    <i class="fa-solid fa-children text-cyan-300"></i>
                                    <span>
                                        <strong>{{ school.stats.students }}+</strong> học sinh
                                    </span>
                                </div>
                                <div class="hero-pill">
                                    <i class="fa-solid fa-chalkboard-teacher text-emerald-300"></i>
                                    <span>
                                        <strong>{{ school.stats.teachers }}</strong> giáo viên
                                    </span>
                                </div>
                                <div class="hero-pill">
                                    <i class="fa-solid fa-award text-amber-300"></i>
                                    <span>
                                        <strong>{{ yearsOfExperience }}+</strong> năm đồng hành
                                    </span>
                                </div>
                            </div>

                            <!-- Buttons -->
                            <div class="flex flex-wrap justify-center lg:justify-start gap-4 pt-5">
                                <button class="btn-primary">
                                    <i class="fa-solid fa-calendar-check"></i>
                                    Đăng ký tham quan
                                </button>
                                <button class="btn-secondary" @click="scrollToSection('about')">
                                    <i class="fa-solid fa-circle-play"></i>
                                    Tìm hiểu thêm
                                </button>
                            </div>
                        </div>

                        <!-- Right side: Info card + app preview -->
                        <div class="w-full max-w-sm lg:max-w-md space-y-4">
                            <!-- School card -->
                            <div class="glass-card p-5 space-y-4">
                                <div class="flex items-center gap-4">
                                    <div class="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
                                        <i class="fa-solid fa-school text-white text-2xl"></i>
                                    </div>
                                    <div>
                                        <p class="text-white/60 text-xs uppercase tracking-wide">Mã trường</p>
                                        <p class="text-white font-bold text-xl">
                                            {{ school.code }}
                                        </p>
                                        <p class="text-xs text-blue-100">
                                            {{ school.type }}
                                        </p>
                                    </div>
                                </div>

                                <div class="space-y-3 pt-1 text-sm">
                                    <div class="info-row">
                                        <div class="info-icon bg-cyan-500/15">
                                            <i class="fa-solid fa-location-dot text-cyan-300"></i>
                                        </div>
                                        <span class="text-white/90">
                                            {{ school.address.line1 }},
                                            {{ school.address.line2 }}
                                        </span>
                                    </div>
                                    <div class="info-row">
                                        <div class="info-icon bg-emerald-500/15">
                                            <i class="fa-solid fa-phone text-emerald-300"></i>
                                        </div>
                                        <span class="text-white font-semibold">
                                            {{ school.hotline }}
                                        </span>
                                    </div>
                                    <div class="info-row">
                                        <div class="info-icon bg-amber-500/15">
                                            <i class="fa-solid fa-clock text-amber-300"></i>
                                        </div>
                                        <span class="text-white/90"> {{ school.operation.openTime }} – {{ school.operation.closeTime }} </span>
                                    </div>
                                </div>

                                <div class="pt-3 border-t border-white/20">
                                    <button class="contact-btn" @click="scrollToSection('contact')">
                                        <i class="fa-solid fa-paper-plane"></i>
                                        Liên hệ ngay với nhà trường
                                    </button>
                                </div>
                            </div>

                            <!-- Mini mobile preview -->
                            <div class="glass-card p-4 flex items-center gap-4">
                                <div class="phone-mini">
                                    <div class="phone-mini-inner">
                                        <img :src="appScreenshots[currentAppScreenshot]" alt="App demo" class="w-full h-full object-cover rounded-[18px]" />
                                    </div>
                                </div>
                                <div class="flex-1 text-xs text-blue-50 space-y-1">
                                    <p class="font-semibold text-sm text-white">Ứng dụng AI Health Tracking</p>
                                    <p>Phụ huynh xem điểm danh, sức khỏe, bữa ăn và hình ảnh hoạt động của con ngay trên điện thoại.</p>
                                    <p class="text-blue-200 flex items-center gap-2">
                                        <i class="fa-solid fa-mobile-screen-button"></i>
                                        iOS • Android
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Hero indicators -->
            <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                <button v-for="(_, idx) in heroImages" :key="idx" class="hero-indicator" :class="{ active: currentHeroIndex === idx }" @click="currentHeroIndex = idx"></button>
            </div>
        </section>

        <!-- MAIN CONTENT -->
        <div class="container mx-auto px-6 lg:px-10 py-12 space-y-20">
            <!-- Stats -->
            <section class="-mt-20 relative z-10">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    <div v-for="(stat, idx) in statsData" :key="idx" class="stat-card">
                        <div class="stat-icon" :class="stat.bgClass">
                            <i :class="stat.icon"></i>
                        </div>
                        <div>
                            <p class="stat-number">{{ stat.displayValue }}</p>
                            <p class="stat-title">{{ stat.label }}</p>
                            <p class="stat-subtitle">{{ stat.sublabel }}</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- About + Gallery -->
            <section id="about">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                    <!-- Gallery -->
                    <div class="space-y-4">
                        <div class="relative rounded-3xl overflow-hidden shadow-xl">
                            <img :src="galleryImages[currentGalleryIndex]" alt="Không gian trường" class="w-full h-80 object-cover" />
                            <div class="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent"></div>

                            <!-- Arrows -->
                            <button class="gallery-nav left-3" @click="prevGallery">
                                <i class="fa-solid fa-chevron-left"></i>
                            </button>
                            <button class="gallery-nav right-3" @click="nextGallery">
                                <i class="fa-solid fa-chevron-right"></i>
                            </button>

                            <!-- Dots -->
                            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                <button v-for="(_, idx) in galleryImages" :key="idx" class="gallery-dot" :class="{ active: currentGalleryIndex === idx }" @click="currentGalleryIndex = idx"></button>
                            </div>
                        </div>

                        <!-- Thumbnails -->
                        <div class="grid grid-cols-4 gap-3">
                            <button v-for="(img, idx) in galleryImages.slice(0, 4)" :key="idx" class="thumbnail" :class="{ active: currentGalleryIndex === idx }" @click="currentGalleryIndex = idx">
                                <img :src="img" :alt="`Hình ${idx + 1}`" class="w-full h-20 object-cover" />
                            </button>
                        </div>
                    </div>

                    <!-- About text -->
                    <div class="space-y-6">
                        <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                            <i class="fa-solid fa-info-circle"></i>
                            <span>Về nhà trường</span>
                        </div>
                        <h2 class="text-3xl md:text-4xl font-bold text-slate-800">
                            Nơi nuôi dưỡng
                            <span class="text-gradient">tương lai</span> của con bạn
                        </h2>
                        <p class="text-slate-600 leading-relaxed text-base md:text-lg">
                            {{ school.vision }}
                        </p>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div v-for="(feature, idx) in aboutFeatures" :key="idx" class="feature-item">
                                <div class="feature-icon" :class="feature.iconBg">
                                    <i :class="feature.icon"></i>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-slate-800">
                                        {{ feature.title }}
                                    </h4>
                                    <p class="text-xs md:text-sm text-slate-500">
                                        {{ feature.desc }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Principal -->
                        <div class="principal-card">
                            <div class="principal-avatar">
                                <i class="fa-solid fa-user-tie text-white text-xl"></i>
                            </div>
                            <div>
                                <p class="text-xs text-slate-500 uppercase">Ban giám hiệu</p>
                                <p class="font-bold text-slate-800 text-lg leading-snug">
                                    {{ school.principal }}
                                </p>
                                <p class="text-sm text-blue-600">{{ school.vicePrincipal }} – Phó hiệu trưởng</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- MOBILE APP SECTION: demo cho phụ huynh -->
            <section id="mobile-app">
                <div class="app-section">
                    <div class="app-bg-gradient"></div>

                    <div class="relative grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <!-- App info -->
                        <div class="space-y-6 relative z-10 text-white">
                            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/30 text-xs font-semibold uppercase tracking-wide">
                                <i class="fa-solid fa-mobile-screen-button text-cyan-200"></i>
                                <span>Ứng dụng di động cho phụ huynh</span>
                            </div>

                            <h2 class="text-3xl md:text-4xl font-bold leading-tight">
                                Theo dõi con yêu
                                <span class="text-gradient-light"> mọi lúc, mọi nơi </span>
                            </h2>

                            <p class="text-blue-100 text-sm md:text-base leading-relaxed">
                                Ứng dụng <strong>AI Health Tracking</strong> giúp phụ huynh xem lịch sử điểm danh, sức khỏe, bữa ăn, giấc ngủ và hình ảnh hoạt động của con mỗi ngày – mọi thông tin đều được cập nhật thời gian thực từ giáo viên.
                            </p>

                            <!-- App features -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div v-for="(feature, idx) in appFeatures" :key="idx" class="app-feature">
                                    <div class="app-feature-icon" :class="feature.iconBg">
                                        <i :class="feature.icon"></i>
                                    </div>
                                    <div>
                                        <h4 class="font-semibold text-white text-sm">
                                            {{ feature.title }}
                                        </h4>
                                        <p class="text-xs text-blue-100">
                                            {{ feature.desc }}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <!-- Download buttons (demo) -->
                            <div class="flex flex-wrap gap-4 pt-2">
                                <button class="store-btn">
                                    <i class="fa-brands fa-apple text-2xl"></i>
                                    <div class="text-left">
                                        <p class="text-[11px] text-slate-300">Tải về trên</p>
                                        <p class="text-sm font-semibold text-white">App Store</p>
                                    </div>
                                </button>
                                <button class="store-btn">
                                    <i class="fa-brands fa-google-play text-xl"></i>
                                    <div class="text-left">
                                        <p class="text-[11px] text-slate-300">Tải về trên</p>
                                        <p class="text-sm font-semibold text-white">Google Play</p>
                                    </div>
                                </button>
                            </div>

                            <!-- QR demo -->
                            <div class="flex items-center gap-3 pt-2">
                                <div class="qr-box">
                                    <i class="fa-solid fa-qrcode text-3xl text-slate-700"></i>
                                </div>
                                <div class="text-xs md:text-sm">
                                    <p class="font-semibold text-white">Quét mã QR (demo)</p>
                                    <p class="text-blue-100">Trong bản triển khai thực tế, phụ huynh có thể quét mã để tải app.</p>
                                </div>
                            </div>
                        </div>

                        <!-- Phone mockups -->
                        <div class="relative z-10 flex justify-center lg:justify-end">
                            <div class="phone-main">
                                <div class="phone-frame">
                                    <div class="phone-notch"></div>
                                    <div class="phone-screen">
                                        <img :src="appScreenshots[currentAppScreenshot]" alt="Màn hình app" class="w-full h-full object-cover rounded-[26px]" />
                                    </div>
                                </div>
                            </div>

                            <div class="phone-secondary">
                                <div class="phone-frame small">
                                    <div class="phone-notch"></div>
                                    <div class="phone-screen">
                                        <img :src="appScreenshots[(currentAppScreenshot + 1) % appScreenshots.length]" alt="Màn hình app 2" class="w-full h-full object-cover rounded-[22px]" />
                                    </div>
                                </div>
                            </div>

                            <div class="screenshot-dots">
                                <button v-for="(_, idx) in appScreenshots" :key="idx" class="screenshot-dot" :class="{ active: currentAppScreenshot === idx }" @click="currentAppScreenshot = idx"></button>
                            </div>
                        </div>
                    </div>

                    <!-- App stats -->
                    <div class="app-stats">
                        <div class="app-stat">
                            <p>10K+</p>
                            <span>Lượt tải (demo)</span>
                        </div>
                        <div class="app-stat-divider"></div>
                        <div class="app-stat">
                            <p>4.8</p>
                            <span>Đánh giá hài lòng</span>
                        </div>
                        <div class="app-stat-divider"></div>
                        <div class="app-stat">
                            <p>99%</p>
                            <span>Phụ huynh an tâm</span>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Vision & Mission -->
            <section>
                <div class="text-center mb-10">
                    <div class="section-badge bg-purple-100 text-purple-700 mx-auto">
                        <i class="fa-solid fa-compass"></i>
                        <span>Định hướng phát triển</span>
                    </div>
                    <h2 class="text-3xl md:text-4xl font-bold text-slate-800 mt-4 text-[##000000]">Tầm nhìn &amp; Sứ mệnh</h2>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="vision-mission-card vision">
                        <div class="vision-image">
                            <img src="https://images.pexels.com/photos/8422209/pexels-photo-8422209.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Tầm nhìn" class="w-full h-full object-cover" />
                            <div class="vision-overlay"></div>
                            <div class="vision-label">
                                <i class="fa-solid fa-eye text-2xl"></i>
                            </div>
                        </div>
                        <div class="vision-content">
                            <h3>Tầm nhìn</h3>
                            <p>{{ school.vision }}</p>
                        </div>
                    </div>

                    <div class="vision-mission-card mission">
                        <div class="vision-image">
                            <img src="https://images.pexels.com/photos/8617981/pexels-photo-8617981.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Sứ mệnh" class="w-full h-full object-cover" />
                            <div class="mission-overlay"></div>
                            <div class="vision-label mission-label">
                                <i class="fa-solid fa-bullseye text-2xl"></i>
                            </div>
                        </div>
                        <div class="vision-content">
                            <h3 class="text-slate-900">Sứ mệnh</h3>
                            <ul class="space-y-2">
                                <li v-for="(m, idx) in school.mission" :key="idx" class="flex items-start gap-2 text-sm text-[#000000]">
                                    <i class="fa-solid fa-check-circle mt-0.5 text-emerald-500"></i>
                                    <span>{{ m }}</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Core values -->
            <section>
                <div class="text-center mb-10">
                    <div class="section-badge bg-amber-100 text-amber-700 mx-auto">
                        <i class="fa-solid fa-gem"></i>
                        <span>Giá trị cốt lõi</span>
                    </div>
                    <h2 class="text-3xl md:text-4xl font-bold text-slate-800 mt-4">5 giá trị nền tảng</h2>
                    <p class="text-slate-600 max-w-2xl mx-auto text-sm md:text-base">Những giá trị định hình văn hóa và phương pháp giáo dục của nhà trường.</p>
                </div>

                <div class="values-grid">
                    <div v-for="(value, idx) in school.coreValues" :key="value.key" class="value-card" :class="getValueColorClass(idx)">
                        <div class="value-key">{{ value.key }}</div>
                        <h4 class="value-title">{{ value.title }}</h4>
                        <p class="value-desc">
                            {{ value.desc }}
                        </p>
                    </div>
                </div>
            </section>

            <!-- Programs -->
            <section>
                <div class="text-center mb-10">
                    <div class="section-badge bg-sky-100 text-sky-700 mx-auto">
                        <i class="fa-solid fa-graduation-cap"></i>
                        <span>Chương trình học</span>
                    </div>
                    <h2 class="text-3xl md:text-4xl font-bold text-slate-800 mt-4">Phát triển toàn diện theo độ tuổi</h2>
                </div>

                <div class="programs-timeline">
                    <div v-for="(prog, idx) in school.programs" :key="idx" class="program-card">
                        <div class="program-icon" :class="getProgramColor(idx)">
                            <i :class="[prog.icon, 'text-3xl text-white']"></i>
                        </div>
                        <div class="program-body">
                            <div class="program-badge" :class="getProgramBadgeColor(idx)">Giai đoạn {{ idx + 1 }}</div>
                            <h4 class="program-title">{{ prog.name }}</h4>
                            <p class="program-focus"><strong>Trọng tâm:</strong> {{ prog.focus }}</p>
                            <p class="program-note">
                                <i class="fa-solid fa-lightbulb text-amber-500 mr-2"></i>
                                {{ prog.note }}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Facilities -->
            <section>
                <div class="text-center mb-10">
                    <div class="section-badge bg-emerald-100 text-emerald-700 mx-auto">
                        <i class="fa-solid fa-building"></i>
                        <span>Cơ sở vật chất</span>
                    </div>
                    <h2 class="text-3xl md:text-4xl font-bold text-slate-800 mt-4">Môi trường học tập hiện đại</h2>
                    <p class="text-slate-600 text-sm md:text-base">Đảm bảo an toàn, thân thiện và giàu trải nghiệm cho trẻ.</p>
                </div>

                <div class="facilities-grid">
                    <div v-for="(facility, idx) in facilitiesData" :key="idx" class="facility-card">
                        <div class="facility-icon" :class="facility.iconBg">
                            <i :class="facility.icon"></i>
                        </div>
                        <div>
                            <h4 class="facility-title">{{ facility.title }}</h4>
                            <p class="facility-desc">
                                {{ facility.desc }}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Operation -->
            <section>
                <div class="operation-card">
                    <div class="operation-header">
                        <div class="operation-icon">
                            <i class="fa-solid fa-clock text-3xl text-white"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-bold text-white">Thời gian hoạt động</h3>
                            <p class="text-blue-100 text-sm">
                                {{ school.operation.schoolYear }}
                            </p>
                        </div>
                    </div>
                    <div class="operation-grid">
                        <div class="operation-item">
                            <div class="operation-item-icon bg-amber-500">
                                <i class="fa-solid fa-sun"></i>
                            </div>
                            <div>
                                <p class="operation-label">Giờ mở cửa</p>
                                <p class="operation-value">
                                    {{ school.operation.openTime }} –
                                    {{ school.operation.closeTime }}
                                </p>
                            </div>
                        </div>
                        <div class="operation-item">
                            <div class="operation-item-icon bg-blue-500">
                                <i class="fa-solid fa-calendar-week"></i>
                            </div>
                            <div>
                                <p class="operation-label">Ngày hoạt động</p>
                                <p class="operation-value">
                                    {{ school.operation.days }}
                                </p>
                            </div>
                        </div>
                        <div class="operation-item">
                            <div class="operation-item-icon bg-pink-500">
                                <i class="fa-solid fa-baby"></i>
                            </div>
                            <div>
                                <p class="operation-label">Độ tuổi tuyển sinh</p>
                                <p class="operation-value">
                                    {{ school.operation.ages }}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="operation-note">
                        <i class="fa-solid fa-shield-heart text-blue-500 text-xl"></i>
                        <p>
                            Mọi dữ liệu sức khỏe, điểm danh, thực đơn và trao đổi với phụ huynh đều được quản lý tập trung trên hệ thống
                            <strong>AI Health Tracking</strong>.
                        </p>
                    </div>
                </div>
            </section>

            <!-- Contact -->
            <section id="contact">
                <div class="contact-grid">
                    <div class="space-y-6">
                        <div class="section-badge bg-rose-100 text-rose-700 w-max">
                            <i class="fa-solid fa-headset"></i>
                            <span>Liên hệ</span>
                        </div>
                        <h2 class="text-3xl font-bold text-slate-800">Kết nối với nhà trường</h2>
                        <div class="contact-cards">
                            <div class="contact-card">
                                <div class="contact-card-icon bg-gradient-to-br from-rose-500 to-pink-600">
                                    <i class="fa-solid fa-phone-volume"></i>
                                </div>
                                <div>
                                    <p class="contact-label">Hotline</p>
                                    <p class="contact-main">
                                        {{ school.hotline }}
                                    </p>
                                    <p class="contact-sub">
                                        {{ school.phone }}
                                    </p>
                                </div>
                            </div>
                            <div class="contact-card">
                                <div class="contact-card-icon bg-gradient-to-br from-blue-500 to-indigo-600">
                                    <i class="fa-solid fa-envelope"></i>
                                </div>
                                <div>
                                    <p class="contact-label">Email</p>
                                    <p class="contact-main">
                                        {{ school.email }}
                                    </p>
                                </div>
                            </div>
                            <div class="contact-card">
                                <div class="contact-card-icon bg-gradient-to-br from-emerald-500 to-teal-600">
                                    <i class="fa-solid fa-globe"></i>
                                </div>
                                <div>
                                    <p class="contact-label">Website</p>
                                    <p class="contact-main">
                                        {{ school.website }}
                                    </p>
                                </div>
                            </div>
                            <div class="contact-card">
                                <div class="contact-card-icon bg-gradient-to-br from-sky-500 to-blue-600">
                                    <i class="fa-brands fa-facebook-messenger"></i>
                                </div>
                                <div>
                                    <p class="contact-label">Zalo hỗ trợ</p>
                                    <p class="contact-main">
                                        {{ school.zalo }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Map & address -->
                    <div class="space-y-4">
                        <div class="map-placeholder">
                            <div class="map-inner">
                                <div class="map-pin">
                                    <i class="fa-solid fa-location-dot text-3xl text-white"></i>
                                </div>
                                <p class="text-slate-100 mt-3 font-semibold">Bản đồ vị trí trường (demo)</p>
                                <p class="text-slate-300 text-xs">Triển khai thực tế có thể nhúng Google Maps</p>
                            </div>
                        </div>
                        <div class="address-card">
                            <div class="flex items-start gap-4">
                                <div class="address-icon">
                                    <i class="fa-solid fa-location-dot text-white"></i>
                                </div>
                                <div class="text-sm">
                                    <p class="font-semibold text-slate-800 mb-1">Địa chỉ</p>
                                    <p class="text-slate-600">
                                        {{ school.address.line1 }}
                                    </p>
                                    <p class="text-slate-600">
                                        {{ school.address.line2 }}
                                    </p>
                                    <p class="text-slate-600">
                                        {{ school.address.city }},
                                        {{ school.address.country }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- System info -->
            <section>
                <div class="system-grid">
                    <div class="system-card">
                        <div class="system-icon bg-blue-100">
                            <i class="fa-solid fa-qrcode text-2xl text-blue-600"></i>
                        </div>
                        <div>
                            <p class="system-label">Mã trường</p>
                            <p class="system-value">{{ school.code }}</p>
                        </div>
                    </div>
                    <div class="system-card">
                        <div class="system-icon bg-emerald-100">
                            <i class="fa-solid fa-briefcase text-2xl text-emerald-600"></i>
                        </div>
                        <div>
                            <p class="system-label">Đơn vị chủ quản</p>
                            <p class="system-value text-sm">
                                {{ school.owner }}
                            </p>
                        </div>
                    </div>
                    <div class="system-card">
                        <div class="system-icon bg-amber-100">
                            <i class="fa-solid fa-file-invoice text-2xl text-amber-600"></i>
                        </div>
                        <div>
                            <p class="system-label">Mã số thuế</p>
                            <p class="system-value">
                                {{ school.taxCode }}
                            </p>
                        </div>
                    </div>
                    <div class="system-card">
                        <div class="system-icon bg-rose-100">
                            <i class="fa-solid fa-calendar text-2xl text-rose-600"></i>
                        </div>
                        <div>
                            <p class="system-label">Năm thành lập</p>
                            <p class="system-value">
                                {{ school.establishedYear }}
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
/* ===== FLOATING BLOBS ===== */
.floating-blob {
    position: absolute;
    border-radius: 999px;
    filter: blur(2px);
    opacity: 0.9;
    animation: float 10s ease-in-out infinite;
}

.blob-1 {
    top: 10%;
    left: 5%;
    width: 160px;
    height: 160px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.25), transparent);
}

.blob-2 {
    bottom: 15%;
    right: 8%;
    width: 220px;
    height: 220px;
    background: radial-gradient(circle, rgba(168, 85, 247, 0.25), transparent);
    animation-delay: 2s;
}

.blob-3 {
    top: 45%;
    left: 35%;
    width: 140px;
    height: 140px;
    background: radial-gradient(circle, rgba(52, 211, 153, 0.25), transparent);
    animation-delay: 4s;
}

@keyframes float {
    0%,
    100% {
        transform: translate(0, 0);
    }
    50% {
        transform: translate(10px, -15px);
    }
}

/* ===== HERO ===== */
.hero-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.4);
    font-size: 13px;
}

.hero-pill i {
    font-size: 14px;
}

.btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 26px;
    border-radius: 999px;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: #fff;
    font-weight: 600;
    border: none;
    cursor: pointer;
    box-shadow: 0 14px 35px rgba(37, 99, 235, 0.55);
    transition:
        transform 0.2s ease,
        box-shadow 0.2s ease;
    font-size: 14px;
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 45px rgba(37, 99, 235, 0.65);
}

.btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(148, 163, 184, 0.6);
    color: #e5e7eb;
    font-weight: 500;
    cursor: pointer;
    font-size: 14px;
    transition:
        background 0.2s ease,
        transform 0.2s ease;
}

.btn-secondary:hover {
    background: rgba(15, 23, 42, 0.8);
    transform: translateY(-2px);
}

.glass-card {
    background: rgba(15, 23, 42, 0.6);
    border-radius: 24px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    backdrop-filter: blur(18px);
    box-shadow: 0 22px 50px rgba(15, 23, 42, 0.9);
}

.info-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.info-icon {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.contact-btn {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 16px;
    border-radius: 999px;
    background: linear-gradient(135deg, #eff6ff, #ffffff);
    color: #1d4ed8;
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition:
        box-shadow 0.2s ease,
        transform 0.2s ease;
}

.contact-btn:hover {
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.4);
    transform: translateY(-1px);
}

.hero-indicator {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.7);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
}

.hero-indicator.active {
    width: 26px;
    background: #e5e7eb;
}

/* mini phone */
.phone-mini {
    width: 70px;
    height: 120px;
    border-radius: 22px;
    padding: 4px;
    background: linear-gradient(135deg, #e5e7eb, #1f2937);
    display: flex;
    align-items: center;
    justify-content: center;
}

.phone-mini-inner {
    width: 100%;
    height: 100%;
    border-radius: 18px;
    background: #020617;
    overflow: hidden;
}

/* ===== STATS ===== */
.stat-card {
    background: #ffffff;
    border-radius: 22px;
    padding: 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: 0 10px 38px rgba(15, 23, 42, 0.06);
    transition:
        transform 0.18s ease,
        box-shadow 0.18s ease;
}

.stat-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.stat-icon {
    width: 54px;
    height: 54px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    flex-shrink: 0;
    font-size: 20px;
}

.stat-number {
    font-size: 26px;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
}

.stat-title {
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
}

.stat-subtitle {
    font-size: 11px;
    color: #94a3b8;
}

/* Section badge */
.section-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
}

/* ===== GALLERY ===== */
.gallery-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 38px;
    height: 38px;
    border-radius: 999px;
    border: none;
    background: rgba(15, 23, 42, 0.45);
    color: #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition:
        background 0.2s ease,
        transform 0.2s ease;
}

.gallery-nav:hover {
    background: rgba(15, 23, 42, 0.8);
    transform: translateY(-50%) scale(1.06);
}

.gallery-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    border: none;
    background: rgba(226, 232, 240, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
}

.gallery-dot.active {
    width: 22px;
    background: #ffffff;
}

.thumbnail {
    border-radius: 14px;
    overflow: hidden;
    border: 2px solid transparent;
    padding: 0;
    background: transparent;
    cursor: pointer;
    transition:
        transform 0.15s ease,
        box-shadow 0.15s ease,
        border-color 0.15s ease;
}

.thumbnail:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.15);
}

.thumbnail.active {
    border-color: #3b82f6;
}

/* ===== ABOUT ===== */
.text-gradient {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.feature-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 14px;
    border-radius: 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    transition:
        background 0.15s ease,
        transform 0.15s ease,
        box-shadow 0.15s ease;
}

.feature-item:hover {
    background: #eff6ff;
    transform: translateX(2px);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
}

.feature-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.principal-card {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px;
    border-radius: 18px;
    background: linear-gradient(135deg, #eff6ff, #eef2ff);
    border: 1px solid #dbeafe;
}

.principal-avatar {
    width: 52px;
    height: 52px;
    border-radius: 999px;
    background: linear-gradient(135deg, #3b82f6, #6366f1);
    display: flex;
    align-items: center;
    justify-content: center;
}

/* ===== MOBILE APP SECTION ===== */
.app-section {
    position: relative;
    border-radius: 28px;
    padding: 40px 26px;
    overflow: hidden;
    background: radial-gradient(circle at 0% 0%, #38bdf8 0, transparent 55%), radial-gradient(circle at 100% 0%, #a855f7 0, transparent 55%), radial-gradient(circle at 50% 100%, #22c55e 0, transparent 55%), #0f172a;
    color: #e5e7eb;
}

.app-bg-gradient {
    position: absolute;
    inset: 0;
    opacity: 0.25;
    background-image: radial-gradient(circle at 20% 50%, rgba(56, 189, 248, 0.5), transparent 55%), radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.6), transparent 55%),
        radial-gradient(circle at 40% 80%, rgba(52, 211, 153, 0.5), transparent 55%);
}

.app-feature {
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid rgba(148, 163, 184, 0.4);
}

.app-feature-icon {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.store-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: rgba(15, 23, 42, 0.7);
    cursor: pointer;
    transition:
        transform 0.15s ease,
        box-shadow 0.15s ease,
        background 0.15s ease;
}

.store-btn:hover {
    transform: translateY(-1px);
    background: rgba(15, 23, 42, 0.9);
    box-shadow: 0 16px 30px rgba(15, 23, 42, 0.7);
}

.qr-box {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* phones */
.phone-main {
    position: relative;
    width: 220px;
    height: 420px;
    transform: translateX(10px);
    animation: phone-main-float 5s ease-in-out infinite;
}

.phone-secondary {
    position: absolute;
    right: 16px;
    bottom: 0;
    width: 170px;
    height: 320px;
    animation: phone-secondary-float 5s ease-in-out infinite;
}

.phone-frame {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 30px;
    padding: 8px;
    background: linear-gradient(135deg, #e5e7eb, #020617);
    box-shadow: 0 26px 60px rgba(15, 23, 42, 0.9);
}

.phone-frame.small {
    border-radius: 26px;
}

.phone-notch {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 70px;
    height: 12px;
    border-radius: 999px;
    background: #020617;
}

.phone-screen {
    width: 100%;
    height: 100%;
    border-radius: 24px;
    overflow: hidden;
    background: #020617;
}

@keyframes phone-main-float {
    0%,
    100% {
        transform: translateX(10px) translateY(0);
    }
    50% {
        transform: translateX(10px) translateY(-18px);
    }
}

@keyframes phone-secondary-float {
    0%,
    100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-12px);
    }
}

.screenshot-dots {
    position: absolute;
    bottom: 10px;
    left: 14px;
    display: flex;
    gap: 6px;
}

.screenshot-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    border: none;
    background: rgba(148, 163, 184, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
}

.screenshot-dot.active {
    width: 18px;
    background: #f9fafb;
}

/* app stats */
.app-stats {
    position: relative;
    margin-top: 24px;
    display: flex;
    justify-content: center;
    gap: 12px;
    align-items: center;
    color: #e5e7eb;
    font-size: 12px;
}

.app-stat {
    text-align: center;
}

.app-stat p {
    font-size: 22px;
    font-weight: 800;
    line-height: 1;
}

.app-stat span {
    font-size: 11px;
    color: #cbd5f5;
}

.app-stat-divider {
    width: 1px;
    height: 26px;
    background: rgba(148, 163, 184, 0.6);
}

/* ===== VISION / MISSION ===== */
.vision-mission-card {
    border-radius: 24px;
    overflow: hidden;
    color: black;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.15);
}

.vision-image {
    position: relative;
    height: 180px;
    color: black;
    overflow: hidden;
}

.vision-overlay,
.mission-overlay {
    position: absolute;
    inset: 0;
}

.vision-overlay {
    background: linear-gradient(to top, rgba(49, 46, 129, 0.9), transparent);
}

.mission-overlay {
    background: linear-gradient(to top, rgba(6, 78, 59, 0.9), transparent);
}

.vision-label {
    position: absolute;
    bottom: 14px;
    left: 14px;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #6366f1;
    color: #e5e7eb;
}

.mission-label {
    background: #10b981;
}

.vision-content {
    padding: 18px 18px 20px;
    color: black;
}

.vision-content h3 {
    font-size: 18px;
    font-weight: 700;
    color: #020617;
    margin-bottom: 8px;
}
/* Vision: chữ màu đen */
.vision-mission-card.vision .vision-content h3,
.vision-mission-card.vision .vision-content p {
    color: #000;
}

/* Mission: nếu muốn chữ trắng */
.vision-mission-card.mission .vision-content h3,
.vision-mission-card.mission .vision-content li,
.vision-mission-card.mission .vision-content span {
    color: #f0fdf4; /* gần như trắng */
}
.vision-content p {
    font-size: 14px;
    color: #e5e7eb;
}

/* ===== CORE VALUES ===== */
.values-grid {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 14px;
}

@media (min-width: 640px) {
    .values-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

@media (min-width: 1024px) {
    .values-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
    }
}

.value-card {
    border-radius: 18px;
    padding: 16px 14px;
    color: #0f172a;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
    transition:
        transform 0.18s ease,
        box-shadow 0.18s ease,
        translate 0.18s ease;
}

.value-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 44px rgba(15, 23, 42, 0.08);
}

.value-key {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 16px;
    background: rgba(15, 23, 42, 0.9);
    color: #f9fafb;
    margin-bottom: 8px;
}

.value-title {
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 4px;
}

.value-desc {
    font-size: 12px;
    color: #4b5563;
}

/* color variations */
.value-blue {
    background: linear-gradient(135deg, #eff6ff, #dbeafe);
}

.value-purple {
    background: linear-gradient(135deg, #f5f3ff, #e4e4ff);
}

.value-emerald {
    background: linear-gradient(135deg, #ecfdf5, #d1fae5);
}

.value-rose {
    background: linear-gradient(135deg, #fff1f2, #fee2e2);
}

.value-amber {
    background: linear-gradient(135deg, #fffbeb, #fef3c7);
}

/* ===== PROGRAMS ===== */
.programs-timeline {
    display: grid;
    gap: 16px;
}

@media (min-width: 768px) {
    .programs-timeline {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

.program-card {
    position: relative;
    border-radius: 20px;
    padding: 18px 16px 18px;
    background: #ffffff;
    box-shadow: 0 12px 36px rgba(15, 23, 42, 0.06);
    border: 1px solid #e5e7eb;
}

.program-icon {
    width: 60px;
    height: 60px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
}

.program-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 12px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 6px;
}

.program-title {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 4px;
}

.program-focus {
    font-size: 13px;
    color: #4b5563;
    margin-bottom: 6px;
}

.program-note {
    font-size: 12px;
    color: #6b7280;
    display: flex;
    align-items: flex-start;
}

/* ===== FACILITIES ===== */
.facilities-grid {
    display: grid;
    gap: 14px;
}

@media (min-width: 640px) {
    .facilities-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (min-width: 1024px) {
    .facilities-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

.facility-card {
    border-radius: 18px;
    padding: 14px 14px 16px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    transition:
        transform 0.15s ease,
        box-shadow 0.15s ease;
}

.facility-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.facility-icon {
    width: 40px;
    height: 40px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.facility-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 2px;
}

.facility-desc {
    font-size: 12px;
    color: #4b5563;
}

/* ===== OPERATION ===== */
.operation-card {
    border-radius: 24px;
    padding: 20px 18px 18px;
    background: linear-gradient(135deg, #1d4ed8, #0f172a);
    color: #e5e7eb;
}

.operation-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 18px;
}

.operation-icon {
    width: 54px;
    height: 54px;
    border-radius: 18px;
    background: rgba(15, 23, 42, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
}

.operation-grid {
    display: grid;
    gap: 12px;
    margin-bottom: 12px;
}

@media (min-width: 640px) {
    .operation-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

.operation-item {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    border-radius: 16px;
    background: rgba(15, 23, 42, 0.6);
}

.operation-item-icon {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f9fafb;
}

.operation-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #cbd5f5;
}

.operation-value {
    font-size: 13px;
    font-weight: 600;
    color: #f9fafb;
}

.operation-note {
    margin-top: 4px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 12px;
    color: #bfdbfe;
}

/* ===== CONTACT ===== */
.contact-grid {
    display: grid;
    gap: 18px;
}

@media (min-width: 900px) {
    .contact-grid {
        grid-template-columns: 1.1fr 1fr;
        gap: 24px;
    }
}

.contact-cards {
    display: grid;
    gap: 12px;
}

@media (min-width: 640px) {
    .contact-cards {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

.contact-card {
    display: flex;
    gap: 10px;
    padding: 14px 14px 15px;
    border-radius: 18px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
}

.contact-card-icon {
    width: 40px;
    height: 40px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f9fafb;
    flex-shrink: 0;
}

.contact-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #94a3b8;
}

.contact-main {
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
}

.contact-sub {
    font-size: 12px;
    color: #6b7280;
}

/* map */
.map-placeholder {
    border-radius: 24px;
    overflow: hidden;
    background: linear-gradient(135deg, #0f172a, #1e40af);
    min-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.map-inner {
    text-align: center;
}

.map-pin {
    width: 60px;
    height: 60px;
    border-radius: 999px;
    background: linear-gradient(135deg, #ef4444, #f97316);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
}

.address-card {
    margin-top: 8px;
    padding: 14px 14px 15px;
    border-radius: 20px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
}

.address-icon {
    width: 40px;
    height: 40px;
    border-radius: 14px;
    background: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* ===== SYSTEM INFO ===== */
.system-grid {
    margin-top: 12px;
    display: grid;
    gap: 12px;
}

@media (min-width: 640px) {
    .system-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
}

.system-card {
    display: flex;
    gap: 10px;
    align-items: center;
    border-radius: 16px;
    background: #ffffff;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
}

.system-icon {
    width: 40px;
    height: 40px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.system-label {
    font-size: 11px;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.system-value {
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
}

/* ===== TEXT GRADIENT LIGHT ===== */
.text-gradient-light {
    background: linear-gradient(135deg, #a5b4fc, #67e8f9);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}
</style>
