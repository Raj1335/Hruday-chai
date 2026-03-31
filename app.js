/**
 * CORE APPLICATION LOGIC
 * Includes: Navigation, Cart, Offline Sync, and UI Rendering
 */

// 1. STATE MANAGEMENT
let cart = [];
let menuItems = [];
let isOnline = navigator.onLine;
let currentUser = null;
let currentRole = 'admin'; // Default

// 2. INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    initApp();
    setupEventListeners();
    setupNetworkListeners();
});

async function initApp() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        showModal('auth-modal');
    } else {
        currentUser = session.user;
        currentRole = currentUser.app_metadata?.role || 'admin';
        document.getElementById('current-user').innerText = currentUser.email;
        
        if (currentRole === 'super_admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        }
        
        hideModal('auth-modal');
        loadMenu();
        syncOfflineQueue();
    }
}

// 3. MENU & GRID LOGIC
async function loadMenu() {
    const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('grid_index', { ascending: true });

    if (error) {
        console.error("Error loading menu:", error);
        // Fallback to local storage if offline
        menuItems = JSON.parse(localStorage.getItem('cached_menu') || '[]');
    } else {
        menuItems = data;
        localStorage.setItem('cached_menu', JSON.stringify(data));
    }
    renderMenu();
}

function renderMenu() {
    const grid = document.getElementById('menu-grid');
    grid.innerHTML = '';

    menuItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.setAttribute('data-id', item.id);
        div.onclick = () => addToCart(item);
        div.innerHTML = `
            ${item.image_url ? `<img src="${item.image_url}">` : '☕'}
            <h3>${item.name}</h3>
            <p>₹${parseFloat(item.price).toFixed(2)}</p>
        `;
        grid.appendChild(div);
    });

    // Initialize Sortable if Super Admin clicks "Edit Layout"
    if (currentRole === 'super_admin') {
        new Sortable(grid, {
            animation: 150,
            disabled: true, // Start disabled
            onEnd: async (evt) => {
                const newOrder = Array.from(grid.children).map((el, index) => ({
                    id: el.getAttribute('data-id'),
                    grid_index: index
                }));
                updateMenuOrder(newOrder);
            }
        });
    }
}

// 4. CART & CHECKOUT
function addToCart(item) {
    cart.push(item);
    renderCart();
}

function renderCart() {
    const cartDiv = document.getElementById('cart-items');
    const totalSpan = document.getElementById('cart-total');
    cartDiv.innerHTML = '';
    
    let total = 0;
    cart.forEach((item, index) => {
        total += parseFloat(item.price);
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <span>${item.name}</span>
            <span>₹${parseFloat(item.price).toFixed(2)}</span>
        `;
        div.onclick = () => { cart.splice(index, 1); renderCart(); };
        cartDiv.appendChild(div);
    });
    totalSpan.innerText = `₹${total.toFixed(2)}`;
}

async function processCheckout() {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
    const saleRecord = {
        partner_id: currentUser.id,
        total: total,
        items_json: JSON.stringify(cart),
        created_at: new Date().toISOString()
    };

    if (isOnline) {
        const { error } = await supabase.from('sales').insert([saleRecord]);
        if (error) queueOffline(saleRecord);
    } else {
        queueOffline(saleRecord);
    }

    cart = [];
    renderCart();
    alert("Sale Processed!");
}

// 5. OFFLINE SYNC LOGIC
function queueOffline(record) {
    let queue = JSON.parse(localStorage.getItem('offlineSalesQueue') || '[]');
    queue.push(record);
    localStorage.setItem('offlineSalesQueue', JSON.stringify(queue));
    updateNetworkStatus();
}

async function syncOfflineQueue() {
    if (!isOnline) return;
    let queue = JSON.parse(localStorage.getItem('offlineSalesQueue') || '[]');
    if (queue.length === 0) return;

    const { error } = await supabase.from('sales').insert(queue);
    if (!error) {
        localStorage.removeItem('offlineSalesQueue');
        console.log("Synced offline sales.");
    }
}

// 6. UI HELPERS & NAVIGATION
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = (e) => {
            const target = e.target.getAttribute('data-target');
            document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
            document.getElementById(target).classList.remove('hidden');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        };
    });

    // Login
    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
        else initApp();
    };

    document.getElementById('btn-logout').onclick = () => supabase.auth.signOut().then(() => location.reload());
    document.getElementById('btn-checkout').onclick = processCheckout;
}

function setupNetworkListeners() {
    window.addEventListener('online', () => { isOnline = true; updateNetworkStatus(); syncOfflineQueue(); });
    window.addEventListener('offline', () => { isOnline = false; updateNetworkStatus(); });
    updateNetworkStatus();
}

function updateNetworkStatus() {
    const statusEl = document.getElementById('network-status');
    const queueCount = JSON.parse(localStorage.getItem('offlineSalesQueue') || '[]').length;
    
    if (isOnline) {
        statusEl.innerText = queueCount > 0 ? `Syncing (${queueCount})...` : "Online";
        statusEl.className = "badge online";
    } else {
        statusEl.innerText = `Offline (${queueCount} queued)`;
        statusEl.className = "badge offline";
    }
}

function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }
