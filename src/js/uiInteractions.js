
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('details-tab-btn')) {
            // Handle Tab Switching
            const targetId = e.target.getAttribute('data-target');
            if (!targetId) return;

            // Update Tab Buttons
            document.querySelectorAll('.details-tab-btn').forEach(btn => {
                btn.classList.remove('text-white', 'border-blue-500', 'active');
                btn.classList.add('text-gray-400', 'border-transparent');
            });
            e.target.classList.remove('text-gray-400', 'border-transparent');
            e.target.classList.add('text-white', 'border-blue-500', 'active');

            // Update Panels
            document.querySelectorAll('.details-tab-content').forEach(panel => {
                panel.classList.add('hidden');
            });
            const panel = document.getElementById(targetId);
            if (panel) panel.classList.remove('hidden');
        }
    });
});
