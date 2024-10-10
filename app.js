document.addEventListener('DOMContentLoaded', function() {
    // Precompila i campi del login con le credenziali salvate
    const savedEmail = localStorage.getItem('email');
    const savedPassword = localStorage.getItem('password');
    if (savedEmail) {
        document.getElementById('email').value = savedEmail;
    }
    if (savedPassword) {
        document.getElementById('password').value = savedPassword;
    }

    // Verifica lo stato del login
    checkLoginStatus();

    // Aggiungi event listener per i pulsanti
    document.getElementById('startAlarm').addEventListener('click', function() {
        controlAlarm('start');
    });

    document.getElementById('stopAlarm').addEventListener('click', function() {
        controlAlarm('stop');
    });
});

document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Salva le credenziali in localStorage
    localStorage.setItem('email', email);
    localStorage.setItem('password', password);

    getToken(email, password);
});

function getToken(email, password) {
    const apiBaseUrl = `http://${window.location.hostname}:8000/auth-service/auth/token`;

    fetch(apiBaseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.access_token) {
            localStorage.setItem('token', data.access_token);
            console.log('Login successful, token saved:', data.access_token);
            checkLoginStatus();
        } else {
            console.error('Login failed:', data);
        }
    })
    .catch(error => console.error('Error:', error));
}

function checkLoginStatus() {
    const token = localStorage.getItem('token');
    if (token) {
        const apiBaseUrl = `http://${window.location.hostname}:8000/auth-service/auth/user`;

        fetch(apiBaseUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.email) {
                document.getElementById('loginStatus').textContent = `Loggato come: ${data.email}`;
            } else {
                document.getElementById('loginStatus').textContent = 'Utente non loggato';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('loginStatus').textContent = 'Utente non loggato';
        });
    } else {
        document.getElementById('loginStatus').textContent = 'Utente non loggato';
    }
}

// Chiamata API di esempio che verifica il token
function callApi() {
    checkToken();
    const token = localStorage.getItem('token');

    fetch(`http://${window.location.hostname}:8000/some-endpoint`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error('Error:', error));
}

function controlAlarm(action) {
    const token = localStorage.getItem('token');
    const apiBaseUrl = `http://${window.location.hostname}:8000/devices-manager-service/device-group/1/${action}-listening?force_listening=False`;

    fetch(apiBaseUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const alarmStatus = document.getElementById('alarmStatus');
        if (action === 'start') {
            alarmStatus.textContent = 'Allarme acceso';
        } else {
            alarmStatus.textContent = 'Allarme spento';
        }
        console.log(`${action === 'start' ? 'Accendi' : 'Spegni'} Allarme:`, data);
    })
    .catch(error => {
        const alarmStatus = document.getElementById('alarmStatus');
        alarmStatus.textContent = `Errore: ${error.message}`;
        console.error('Error:', error);
    });
}