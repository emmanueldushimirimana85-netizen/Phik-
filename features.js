// PHIK Core & Features Logic (Batch 2 + Custom Layout)
class PhikApp {
    constructor() {
        this.currentTab = 'home';
        this.feedTab = 'for-you';
        this.currentUser = null;
        this.init();
    }

    async init() {
        // Initialization & Supabase Hook
        console.log("PHIK App Initialized with Custom Layout");
        this.renderView();
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // Toggle top feed switcher visibility (only show on home tab)
        const switcher = document.getElementById('top-feed-switcher');
        if (switcher) {
            switcher.style.display = (tab === 'home') ? 'flex' : 'none';
        }

        // Update nav icon states
        ['home', 'reels', 'shop', 'profile'].forEach(t => {
            const btn = document.getElementById(`nav-${t}`);
            if (btn) {
                if (t === tab) {
                    btn.className = "flex flex-col items-center justify-center flex-1 text-indigo-500";
                } else {
                    btn.className = "flex flex-col items-center justify-center flex-1 text-zinc-400 hover:text-white";
                }
            }
        });

        this.renderView();
    }

    switchFeedTab(feed) {
        this.feedTab = feed;
        const fyBtn = document.getElementById('tab-for-you');
        const trBtn = document.getElementById('tab-trending');
        
        if (fyBtn && trBtn) {
            if (feed === 'for-you') {
                fyBtn.className = "text-sm font-bold text-white border-b-2 border-indigo-500 pb-1";
                trBtn.className = "text-sm font-medium text-zinc-400 pb-1";
            } else {
                trBtn.className = "text-sm font-bold text-white border-b-2 border-indigo-500 pb-1";
                fyBtn.className = "text-sm font-medium text-zinc-400 pb-1";
            }
        }
        this.renderView();
    }

    renderView() {
        const container = document.getElementById('app-content');
        if (!container) return;

        if (this.currentTab === 'home') {
            container.innerHTML = `
                <div class="p-4 space-y-4">
                    <div class="bg-phik-card border border-phik-border rounded-xl p-4">
                        <h2 class="font-bold text-lg">Welcome to PHIK Feed (${this.feedTab})</h2>
                        <p class="text-sm text-zinc-400 mt-1">Discover trending content, videos, and updates from creators you follow.</p>
                    </div>
                    <div class="space-y-4">
                        <div class="bg-phik-card border border-phik-border rounded-xl p-4">
                            <div class="flex items-center space-x-3 mb-3">
                                <div class="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold">P</div>
                                <div>
                                    <h4 class="font-semibold text-sm">Pamphile</h4>
                                    <span class="text-xs text-zinc-500">Just now</span>
                                </div>
                            </div>
                            <p class="text-sm mb-3">PHIK Batch 2 is fully structured with your custom layout design! 🚀</p>
                            <div class="bg-zinc-900 h-48 rounded-lg flex items-center justify-center text-zinc-500">Media Preview</div>
                        </div>
                    </div>
                </div>`;
        } else if (this.currentTab === 'reels') {
            container.innerHTML = `
                <div class="h-full bg-black flex flex-col items-center justify-center relative">
                    <div class="absolute inset-0 flex items-center justify-center text-zinc-600 font-bold text-xl">Full-Screen Reels Feed</div>
                    <div class="absolute right-4 bottom-20 flex flex-col space-y-4 items-center">
                        <button class="w-12 h-12 bg-zinc-800/80 rounded-full flex items-center justify-center text-white"><i class="fa-solid fa-heart"></i></button>
                        <button class="w-12 h-12 bg-zinc-800/80 rounded-full flex items-center justify-center text-white"><i class="fa-solid fa-comment"></i></button>
                        <button class="w-12 h-12 bg-zinc-800/80 rounded-full flex items-center justify-center text-white"><i class="fa-solid fa-share"></i></button>
                    </div>
                </div>`;
        } else if (this.currentTab === 'shop') {
            container.innerHTML = `
                <div class="p-4 space-y-4">
                    <h2 class="text-xl font-bold">My Shop & Products</h2>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="bg-phik-card border border-phik-border rounded-xl p-3">
                            <div class="h-32 bg-zinc-800 rounded-lg mb-2"></div>
                            <h4 class="font-semibold text-sm">Sample Product</h4>
                            <span class="text-indigo-400 font-bold text-sm">$25.00</span>
                        </div>
                    </div>
                </div>`;
        } else if (this.currentTab === 'profile') {
            container.innerHTML = `
                <div class="p-4 space-y-4">
                    <div class="flex items-center space-x-4 bg-phik-card border border-phik-border p-4 rounded-xl">
                        <div class="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-bold">P</div>
                        <div>
                            <h2 class="font-bold text-lg">Pamphile</h2>
                            <span class="text-xs text-indigo-400 font-semibold">Admin (phikmedia01@gmail.com)</span>
                        </div>
                    </div>
                </div>`;
        } else if (this.currentTab === 'alerts') {
            container.innerHTML = `<div class="p-4"><h2 class="text-xl font-bold mb-4">Notifications</h2><p class="text-sm text-zinc-400">No new alerts.</p></div>`;
        } else if (this.currentTab === 'messages') {
            container.innerHTML = `<div class="p-4"><h2 class="text-xl font-bold mb-4">Messages & Spaces</h2><p class="text-sm text-zinc-400">Your direct chats appear here.</p></div>`;
        }
    }

    openCreateModal() {
        alert("Create modal: Post a Reel, Product, or Space!");
    }
}

const app = new PhikApp();