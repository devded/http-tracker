
document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle Logic
    const themeToggle = document.getElementById('theme_toggle');
    const sunIcon = document.getElementById('sun_icon');
    const moonIcon = document.getElementById('moon_icon');
    const htmlElement = document.documentElement;

    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        htmlElement.classList.add('light-mode');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            htmlElement.classList.toggle('light-mode');
            const isLight = htmlElement.classList.contains('light-mode');

            localStorage.setItem('theme', isLight ? 'light' : 'dark');

            if (isLight) {
                sunIcon.classList.remove('hidden');
                moonIcon.classList.add('hidden');
            } else {
                sunIcon.classList.add('hidden');
                moonIcon.classList.remove('hidden');
            }
        });
    }

    document.addEventListener('click', function (e) {
        // Check if click is on a tab button or its children
        const tabBtn = e.target.closest('.details-tab-btn');
        if (tabBtn) {
            // Handle Tab Switching
            const targetId = tabBtn.getAttribute('data-target');
            if (!targetId) return;

            // Update Tab Buttons
            document.querySelectorAll('.details-tab-btn').forEach(btn => {
                btn.classList.remove('text-white', 'border-blue-500', 'active');
                btn.classList.add('text-gray-400', 'border-transparent');
            });
            tabBtn.classList.remove('text-gray-400', 'border-transparent');
            tabBtn.classList.add('text-white', 'border-blue-500', 'active');

            // Update Panels
            document.querySelectorAll('.details-tab-content').forEach(panel => {
                panel.classList.add('hidden');
            });
            const panel = document.getElementById(targetId);
            if (panel) panel.classList.remove('hidden');
        }
    });
});
