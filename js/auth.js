import { isLoggedIn, setPin, clearPin } from './config.js';
import { verifyLogin } from './sheetFetcher.js';

function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appContent').style.display = 'none';
  document.getElementById('bottomNav').style.display = 'none';
}

function showAppContent() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appContent').style.display = 'block';
  document.getElementById('bottomNav').style.display = 'flex';
}

function initAuth(onAuthenticated) {
  if (isLoggedIn()) {
    showAppContent();
    onAuthenticated();
    return;
  }

  showLoginScreen();

  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = document.getElementById('pinInput').value.trim();

    if (!pin) {
      errorEl.textContent = 'Please enter your PIN';
      return;
    }

    const loginBtn = form.querySelector('button[type="submit"]');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Verifying...';
    errorEl.textContent = '';

    try {
      const valid = await verifyLogin(pin);
      if (valid) {
        setPin(pin);
        showAppContent();
        onAuthenticated();
      } else {
        errorEl.textContent = 'Invalid PIN. Try again.';
      }
    } catch (err) {
      errorEl.textContent = 'Connection failed. Check Web App URL.';
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    }
  });
}

export { initAuth };
