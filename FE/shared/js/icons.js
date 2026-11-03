/**
 * PREPMATE — CENTRALIZED MORPHICONS ICON REGISTRY & ENGINE (WI-ICON-01)
 * Single Source of Truth for all UI iconography across PrepMate.
 * 24x24 canonical viewBox, Lucide outline family, Morphicons spring physics.
 */
(function(window, document) {
    'use strict';

    // 1. Semantic Icon Path Registry (Lucide outline family on 24x24 viewBox)
    const ICONS = {
        // Navigation & Layout
        logo: "M6 4h7a5 5 0 0 1 0 10H6zm0 0v16",
        brand: "M6 4h7a5 5 0 0 1 0 10H6zm0 0v16",
        dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
        grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
        menu: "M4 6h16M4 12h16M4 18h16",
        close: "M18 6L6 18M6 6l12 12",
        x: "M18 6L6 18M6 6l12 12",
        "chevron-down": "M6 9l6 6 6-6",
        "chevron-up": "M18 15l-6-6-6 6",
        "chevron-left": "M15 18l-6-6 6-6",
        "chevron-right": "M9 18l6-6-6-6",
        "arrow-right": "M5 12h14M12 5l7 7-7 7",
        "arrow-left": "M19 12H5M12 19l-7-7 7-7",
        "arrow-up": "M12 19V5M5 12l7-7 7 7",
        "arrow-down": "M12 5v14M19 12l-7 7-7-7",
        "more-vertical": "M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
        "more-horizontal": "M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",

        // Actions & Controls
        plus: "M5 12h14M12 5v14",
        minus: "M5 12h14",
        check: "M20 6L9 17l-5-5",
        "check-circle": "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3",
        "alert-circle": "M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0M12 8v4M12 16h.01",
        "alert-triangle": "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
        info: "M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0M12 16v-4M12 8h.01",
        "help-circle": "M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
        search: "M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M21 21l-4.35-4.35",
        filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
        refresh: "M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10",
        trash: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
        edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
        copy: "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M16 4h2a2 2 0 0 1 2 2v4M21 14H11a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2z",
        download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
        upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
        "external-link": "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3",
        eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
        "eye-off": "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22",
        star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
        "star-filled": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",

        // Interview & Media Controls
        mic: "M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8",
        "mic-off": "M1 1l22 22M9 9v2a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.68-1.33M19 10v1a7 7 0 0 1-11.37 5.5M12 18v4M8 22h8",
        video: "M23 7l-7 5 7 5V7zM1 5h15v14H1z",
        "video-off": "M1 1l22 22M16 16v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m4 0h4a2 2 0 0 1 2 2v3.5l7-5v11l-3.5-2.5",
        speaker: "M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14",
        "speaker-off": "M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6",
        play: "M5 3l14 9-14 9V3z",
        pause: "M6 4h4v16H6zM14 4h4v16h-4z",
        stop: "M4 4h16v16H4z",
        headphones: "M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z",

        // Account & System
        user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
        users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
        settings: "M12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z",
        lock: "M3 11h18v11H3zM7 11V7a5 5 0 0 1 10 0v4",
        unlock: "M3 11h18v11H3zM7 11V7a5 5 0 0 1 9.9-1",
        shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
        "shield-check": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
        logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
        login: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
        bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
        moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
        sun: "M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",

        // Reports, Metrics & Career
        "file-text": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
        file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
        briefcase: "M2 7h20v14H2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
        building: "M4 2h16v20H4zM9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01",
        "map-pin": "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
        calendar: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
        clock: "M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0M12 6v6l4 2",
        history: "M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0M12 6v6l4 2",
        chart: "M18 20V10M12 20V4M6 20v-6",
        "trending-up": "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
        target: "M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
        award: "M12 15m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M8.21 13.89L7 23l5-3 5 3-1.21-9.12",
        sparkles: "M12 3l1.912 5.885L20 10.797l-4.5 4.385L16.564 21 12 17.585 7.436 21l1.064-5.818L4 10.797l6.088-1.912L12 3z",
        zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
        "message-square": "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
        "credit-card": "M1 4h22v16H1zM1 10h22",
        compass: "M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z",
        database: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3M12 2C7 2 3 3.34 3 5s4 3 9 3 9-1.34 9-3-4-3-9-3z",
        server: "M2 2h20v8H2zM2 14h20v8H2zM6 6h.01M6 18h.01",
        activity: "M22 12h-4l-3 9L9 3l-3 9H2",
        book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
        phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
        mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
        printer: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
        share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13",
        "share-2": "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98",
        bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
        "dollar-sign": "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
        camera: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
        folder: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
        code: "M16 18l6-6-6-6M8 6l-6 6 6 6",
        send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
        "thumbs-up": "M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3",
        "thumbs-down": "M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3",
        layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
        home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
        key: "M21 2l-2 2m-1.5 1.5L14 9l-3 3-4-4-5 5 9 9 5-5-4-4 3.5-3.5M16 6l2 2"
    };

    // 2. Canonical Sizing Presets
    const SIZES = {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 20,
        xl: 24
    };

    /**
     * Resolves size in pixels from preset name or number
     */
    function resolveSize(size) {
        if (typeof size === 'number') return size;
        if (typeof size === 'string') {
            const trimmed = size.trim().toLowerCase();
            if (SIZES[trimmed]) return SIZES[trimmed];
            const parsed = parseInt(trimmed, 10);
            if (!isNaN(parsed)) return parsed;
        }
        return 16;
    }

    /**
     * Checks user reduced-motion preference
     */
    function isReducedMotion() {
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        }
        return false;
    }

    const PrepMateIcons = {
        registry: ICONS,
        sizes: SIZES,

        /**
         * Returns path d for a given icon name
         */
        getPath(name) {
            if (!name) return '';
            const key = String(name).trim().toLowerCase();
            return ICONS[key] || ICONS[key.replace(/_/g, '-')] || '';
        },

        /**
         * Renders an SVG markup string for the given icon
         * @param {string} name - Semantic icon name
         * @param {Object} options - { size, class, label, strokeWidth, color, morphable }
         */
        svg(name, options = {}) {
            const d = this.getPath(name);
            if (!d) return '';

            const px = resolveSize(options.size || 16);
            const cls = options.class ? ` ${options.class}` : '';
            const sw = options.strokeWidth || 2;
            const col = options.color || 'currentColor';
            const label = options.label;
            const a11y = label
                ? `role="img" aria-label="${escapeAttr(label)}"`
                : 'aria-hidden="true"';
            const titleTag = label ? `<title>${escapeAttr(label)}</title>` : '';

            // If morphable option requested, render as <morph-icon>
            if (options.morphable) {
                return `<morph-icon icon="${d}" size="${px}" stroke-width="${sw}" color="${col}" class="pm-morph-icon${cls}" ${a11y}></morph-icon>`;
            }

            return `<svg class="pm-icon${cls}" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${titleTag}<path d="${d}"/></svg>`;
        },

        /**
         * Alias for svg()
         */
        render(name, options) {
            return this.svg(name, options);
        },

        /**
         * Morph an existing <morph-icon> or SVG <path> element to a new icon
         * @param {HTMLElement|string} elOrSelector - target element or selector
         * @param {string} toIconName - new icon name
         * @param {Object} options - { spring: 'snappy'|'smooth'|'bouncy', duration }
         */
        morph(elOrSelector, toIconName, options = {}) {
            const target = typeof elOrSelector === 'string' ? document.querySelector(elOrSelector) : elOrSelector;
            if (!target) return;

            const nextD = this.getPath(toIconName);
            if (!nextD) return;

            // If target is <morph-icon> custom element
            if (target.tagName && target.tagName.toLowerCase() === 'morph-icon' && typeof target.morphTo === 'function') {
                target.morphTo(nextD, isReducedMotion() ? { stiffness: 9999, damping: 100 } : (options.spring || 'snappy'));
                return;
            }

            // If target is an SVG path or SVG container with path
            const pathEl = target.tagName && target.tagName.toLowerCase() === 'path' ? target : target.querySelector('path');
            if (pathEl) {
                if (window.Morphicons && typeof window.Morphicons.createMorph === 'function') {
                    try {
                        const m = window.Morphicons.createMorph(pathEl, pathEl.getAttribute('d') || nextD);
                        m.morphTo(nextD, options.spring || 'snappy');
                    } catch (e) {
                        pathEl.setAttribute('d', nextD);
                    }
                } else {
                    pathEl.setAttribute('d', nextD);
                }
            }
        },

        /**
         * Toggle an element between two semantic icons with smooth morph animation
         */
        toggle(elOrSelector, iconA, iconB, isB = false, options = {}) {
            const toIcon = isB ? iconB : iconA;
            this.morph(elOrSelector, toIcon, options);
        },

        /**
         * Scan DOM container and hydrate elements with data-icon attributes
         * Idempotent & protected against duplicate initialization
         */
        mountAll(root = document) {
            if (!root || typeof root.querySelectorAll !== 'function') return;
            const elements = root.querySelectorAll('[data-icon]');
            elements.forEach(el => {
                const iconName = el.getAttribute('data-icon');
                if (!iconName) return;
                if (el.getAttribute('data-icon-mounted') === iconName) return;
                const size = el.getAttribute('data-icon-size') || 16;
                const sw = el.getAttribute('data-icon-sw') || 2;
                const label = el.getAttribute('data-icon-label') || '';
                const morphable = el.hasAttribute('data-icon-morph');

                el.innerHTML = this.svg(iconName, {
                    size,
                    strokeWidth: sw,
                    label,
                    morphable,
                    class: el.getAttribute('data-icon-class') || ''
                });
                el.setAttribute('data-icon-mounted', iconName);
            });
        }
    };

    function escapeAttr(str) {
        return String(str || '').replace(/"/g, '&quot;');
    }

    // Attach to global window
    if (typeof window !== 'undefined') {
        window.PrepMateIcons = PrepMateIcons;

        // Auto-mount data-icon elements on DOM ready
        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => PrepMateIcons.mountAll());
            } else {
                setTimeout(() => PrepMateIcons.mountAll(), 0);
            }
        }

        // Auto-load morphicons.js if running in browser and morph-icon is not yet defined
        if (typeof document !== 'undefined' && window.customElements && !window.customElements.get('morph-icon')) {
            const currentScript = document.currentScript;
            let morphiconsSrc = '';
            if (currentScript && currentScript.src) {
                morphiconsSrc = currentScript.src.replace(/icons\.js(\?.*)?$/, 'morphicons.js$1');
            } else {
                const isRoot = !window.location.pathname.includes('/features/');
                morphiconsSrc = isRoot ? 'FE/shared/js/morphicons.js' : '../../shared/js/morphicons.js';
            }
            if (!document.querySelector('script[src*="morphicons.js"]')) {
                const script = document.createElement('script');
                script.src = morphiconsSrc;
                script.defer = true;
                if (document.head) {
                    document.head.appendChild(script);
                }
            }
        }
    }

    // If running in CommonJS / Node environment for testing
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PrepMateIcons;
    }

})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : {});
